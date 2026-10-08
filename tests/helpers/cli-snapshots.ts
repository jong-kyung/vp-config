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

interface Diagnostic {
  ruleId: string;
  level: string;
  message: { text: string };
  locations: {
    physicalLocation: {
      artifactLocation: { uri: string };
      region: { startLine: number; startColumn: number; endLine: number; endColumn: number };
    };
  }[];
}

function isSource(entry: string | CliCase): entry is string {
  return typeof entry === "string";
}

function lint(directory: string, filenames: string[], fix = false): Diagnostic[] {
  const result = spawnSync(
    "vp",
    [
      "lint",
      "--format=sarif",
      "--threads=1",
      "--no-ignore",
      ...(fix ? ["--fix"] : []),
      ...filenames,
    ],
    { cwd: directory, encoding: "utf8", timeout: 30_000, maxBuffer: 2_000_000 },
  );

  expect(result.error, result.stderr).toBeUndefined();
  expect(result.stderr).toBe("");
  expect([0, 1], result.stdout).toContain(result.status);

  /** SAFETY: The installed Vite+ CLI emits SARIF; the envelope and each case's diagnostic contract are checked below. */
  const report = JSON.parse(result.stdout) as {
    version: string;
    runs: { results: Diagnostic[]; columnKind?: string }[];
  };

  expect(report.version).toBe("2.1.0");
  expect(report.runs).toHaveLength(1);
  expect(Array.isArray(report.runs[0]!.results)).toBe(true);

  if (report.runs[0]!.results.length > 0)
    expect(report.runs[0]!.columnKind).toBe("unicodeCodePoints");

  return report.runs[0]!.results;
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
    let diagnostics: Diagnostic[];
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
      diagnostics = lint(directory, filenames);

      for (const diagnostic of diagnostics) {
        expect(diagnostic.ruleId).toBe(`jong-kyung(${name})`);
        expect(diagnostic.locations).toHaveLength(1);
        expect(filenames).toContain(diagnostic.locations[0]!.physicalLocation.artifactLocation.uri);
      }

      lint(directory, filenames, true);
      outputs = fixtures.map(({ filename }) => readFileSync(join(directory, filename), "utf8"));
      lint(directory, filenames, true);

      for (const [index, fixture] of fixtures.entries()) {
        expect(readFileSync(join(directory, fixture.filename), "utf8")).toBe(outputs[index]);
      }
    }, 30_000);

    afterAll(() => {
      if (directory) rmSync(directory, { recursive: true, force: true });
    });

    for (const [index, fixture] of fixtures.entries()) {
      test(`${fixture.kind}: ${fixture.name ?? fixture.code.replaceAll("\r", "\\r")}`, () => {
        const actual = diagnostics.filter(
          (diagnostic) =>
            diagnostic.locations[0]!.physicalLocation.artifactLocation.uri === fixture.filename,
        );

        // Match RuleTester's counts and exact output, including unchanged code and CRLF bytes.
        expect(actual).toHaveLength(fixture.errors ?? 0);
        expect(outputs[index]).toBe(fixture.output ?? fixture.code);
        expect({
          diagnostics: actual.map(({ ruleId, level, message, locations }) => ({
            ruleId,
            severity: level,
            message: message.text,
            locations: locations.map(({ physicalLocation }) => physicalLocation.region),
          })),
          output: outputs[index],
        }).toMatchSnapshot();
      });
    }
  });
}
