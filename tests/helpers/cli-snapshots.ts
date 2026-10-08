import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { UserConfig } from "vite-plus";
import type { RuleTester } from "vite-plus/lint/plugins-dev";
import { afterAll, beforeAll, describe, expect, test } from "vite-plus/test";

const root = fileURLToPath(new URL("../../", import.meta.url));

type CliCase = Pick<RuleTester.ValidTestCase, "code" | "name" | "options"> & {
  errors?: number;
  output?: string | null;
};

function isSource(entry: string | CliCase): entry is string {
  return typeof entry === "string";
}

function lint(directory: string, filenames: string[], fix = false): string {
  const result = spawnSync(
    "vp",
    [
      "lint",
      "--format=default",
      "--threads=1",
      "--no-ignore",
      ...(fix ? ["--fix"] : []),
      ...filenames,
    ],
    {
      cwd: directory,
      encoding: "utf8",
      timeout: 30_000,
      maxBuffer: 2_000_000,
      // Oxlint forces a colored Unicode theme when CI is set, even with NO_COLOR.
      // Only the lint subprocess uses this environment; the test runner keeps its CI behavior.
      env: { ...process.env, CI: undefined, NO_COLOR: "1", FORCE_COLOR: "0" },
    },
  );

  expect(result.error, result.stderr).toBeUndefined();
  expect(result.stderr).toBe("");
  expect([0, 1], result.stdout).toContain(result.status);

  const output = result.stdout.replaceAll("\r\n", "\n");
  const timing = /\n?Finished in [^\n]+\n?$/;
  expect(output).toMatch(timing);

  return output.replace(timing, "").trim();
}

/** Compares the two pilot rules through the public CLI while retaining RuleTester as the oracle. */
export function snapshotCliRule(
  name: string,
  cases: { valid: (string | CliCase)[]; invalid: (CliCase & { errors: number })[] },
) {
  describe(`${name} CLI snapshots`, () => {
    const fixtures = Object.entries(cases).flatMap(([kind, entries]) =>
      entries.map((entry, index) => ({
        ...(isSource(entry) ? { code: entry } : entry),
        kind,
        filename: `${kind}-${index + 1}.ts`,
      })),
    );

    const filenames = fixtures.map(({ filename }) => filename);
    let directory: string;
    let diagnostics: string[];
    let outputs: string[];

    beforeAll(() => {
      // Keep resolution on the installed toolchain without installing a consumer package.
      directory = mkdtempSync(join(root, "node_modules/.vp-config-cli-"));

      const config = {
        lint: {
          categories: { correctness: "off" },
          plugins: [],
          jsPlugins: [{ name: "jong-kyung", specifier: join(root, "src/plugin.ts") }],
          overrides: fixtures.map((fixture) => ({
            files: [fixture.filename],
            rules: { [`jong-kyung/${name}`]: ["error", ...(fixture.options ?? [])] },
          })),
        },
      } satisfies UserConfig;

      writeFileSync(
        join(directory, "vite.config.ts"),
        `export default ${JSON.stringify(config)};\n`,
      );

      for (const fixture of fixtures)
        writeFileSync(join(directory, fixture.filename), fixture.code);

      // --fix reports only remaining diagnostics, so capture original diagnostics first.
      const validFiles = fixtures
        .filter(({ kind }) => kind === "valid")
        .map(({ filename }) => filename);

      const validDiagnostics = validFiles.length > 0 ? lint(directory, validFiles) : "";
      // ponytail: one CLI render per invalid case. Use a public in-process reporter before expanding the pilot.
      diagnostics = fixtures.map(({ kind, filename }) =>
        kind === "valid"
          ? validDiagnostics
          : lint(directory, [filename]).replaceAll(`,-[${filename}:`, ",-[case.ts:"),
      );

      lint(directory, filenames, true);
      outputs = fixtures.map(({ filename }) => readFileSync(join(directory, filename), "utf8"));
      lint(directory, filenames, true);

      for (const [index, fixture] of fixtures.entries()) {
        expect(readFileSync(join(directory, fixture.filename), "utf8")).toBe(outputs[index]);
      }
    }, 120_000);

    afterAll(() => {
      if (directory) rmSync(directory, { recursive: true, force: true });
    });

    for (const [index, fixture] of fixtures.entries()) {
      test(`${fixture.kind}: ${fixture.name ?? fixture.code.replaceAll("\r", "\\r")}`, () => {
        const errors = fixture.errors ?? 0;
        const actual = diagnostics[index]!;

        // Match RuleTester's counts and exact output, including unchanged code and CRLF bytes.
        expect(actual).toContain(
          `Found 0 warnings and ${errors} ${errors === 1 ? "error" : "errors"}.`,
        );

        if (errors > 0) expect(actual).toContain(`jong-kyung(${name})`);
        expect(outputs[index]).toBe(fixture.output ?? fixture.code);
        expect(actual).toMatchSnapshot("diagnostics");

        if (fixture.output != null) expect(outputs[index]).toMatchSnapshot("fixed code");
      });
    }
  });
}
