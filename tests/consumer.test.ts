import { mkdtempSync, readFileSync, writeFileSync, existsSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { beforeAll, afterAll, beforeEach, expect, test } from "vite-plus/test";
import { nativeLint } from "../src/native.ts";

const root = fileURLToPath(new URL("../", import.meta.url));

const consumer = mkdtempSync(join(tmpdir(), "vp-config-consumer-"));

const config = `import { defineConfig } from "vite-plus";
import { lint, fmt, staged } from "@jong-kyung/vp-config";

export default defineConfig({ lint, fmt, staged });
`;

function run(command: string, args: string[], cwd = consumer) {
  return spawnSync(command, args, { cwd, encoding: "utf8", timeout: 30_000, maxBuffer: 2_000_000 });
}

function pass(command: string, args: string[], cwd = consumer): string {
  const result = run(command, args, cwd);
  expect(result.status, `${result.error?.message ?? ""}\n${result.stdout}\n${result.stderr}`).toBe(
    0,
  );

  return result.stdout;
}

function fixture(source: string, fix = false) {
  writeFileSync(join(consumer, "case.ts"), source);

  return run("vp", fix ? ["check", "--fix", "case.ts"] : ["check", "case.ts"]);
}

beforeAll(() => {
  pass("vp", ["run", "build"], root);
  pass("vp", ["pm", "pack", "--out", join(consumer, "package.tgz")], root);
  writeFileSync(
    join(consumer, "package.json"),
    JSON.stringify(
      {
        name: "vp-config-consumer",
        private: true,
        type: "module",
        devDependencies: {
          "@jong-kyung/vp-config": "file:./package.tgz",
          "vite-plus": "1.0.0",
          typescript: "7.0.2",
          "@types/node": "26.6.4",
        },
        devEngines: { packageManager: { name: "pnpm", version: "12.9.1", onFail: "download" } },
      },
      null,
      2,
    ),
  );
  writeFileSync(
    join(consumer, "pnpm-workspace.yaml"),
    readFileSync(join(root, "pnpm-workspace.yaml")),
  );
  writeFileSync(
    join(consumer, "tsconfig.json"),
    JSON.stringify(
      {
        compilerOptions: {
          target: "ES2023",
          module: "NodeNext",
          strict: true,
          noEmit: true,
          types: ["node"],
          skipLibCheck: true,
        },
        include: ["*.ts"],
      },
      null,
      2,
    ),
  );
  pass("vp", ["install", "--offline", "--ignore-scripts"]);
}, 120_000);

afterAll(() => rmSync(consumer, { recursive: true, force: true }));
beforeEach(() => writeFileSync(join(consumer, "vite.config.ts"), config));

test("loads the actual tarball and freezes the effective native rule inventory", () => {
  const output = pass(process.execPath, [
    "--input-type=module",
    "-e",
    `
    import * as config from '@jong-kyung/vp-config';
    import plugin from '@jong-kyung/vp-config/plugin';
    if (Object.keys(plugin.rules).length !== 21) throw Error('Wrong plugin inventory');
    console.log(Object.keys(config).sort().join(','));
  `,
  ]);

  expect(output.trim()).toBe("fmt,libConfig,lint,nodeConfig,staged");
  expect(existsSync(join(consumer, ".vite-hooks"))).toBe(false);
  const installed = join(consumer, "node_modules/@jong-kyung/vp-config");
  expect(JSON.parse(readFileSync(join(installed, "package.json"), "utf8"))).toMatchObject({
    peerDependencies: { "vite-plus": "1.0.0" },
    devDependencies: {
      "@types/node": "^26.1.1",
      typescript: "^7.0.2",
      "vite-plus": "1.0.0",
    },
  });
  expect(readdirSync(join(installed, "dist")).sort()).toEqual([
    "index.d.mts",
    "index.mjs",
    "plugin.d.mts",
    "plugin.mjs",
  ]);
  expect(existsSync(join(installed, "src"))).toBe(false);
  expect(readFileSync(join(installed, "dist/index.d.mts"), "utf8")).toContain(
    'from "vite-plus/lint"',
  );
  expect(readFileSync(join(installed, "dist/plugin.mjs"), "utf8")).toContain(
    'from "vite-plus/lint/plugins"',
  );

  /** SAFETY: The pinned Vite+ command emits its documented configuration JSON; assertions below check the relevant fields. */
  const effective = JSON.parse(pass("vp", ["lint", "--print-config"])) as {
    rules: Record<string, string | [string]>;
    categories: Record<string, string>;
    jsPlugins: { name: string; specifier: string }[];
  };

  // Vite+ 1.0.0 prints native settings but omits JavaScript plugin rule settings.
  expect(Object.keys(effective.rules).sort()).toEqual(Object.keys(nativeLint.rules!).sort());
  expect(Object.values(effective.categories)).toEqual(Array(7).fill("allow"));

  for (const [name, setting] of Object.entries(nativeLint.rules!)) {
    const expected = Array.isArray(setting) ? setting[0] : setting;
    const actual = effective.rules[name]!;
    expect(Array.isArray(actual) ? actual[0] : actual, name).toBe(
      expected === "error" ? "deny" : expected === "off" ? "allow" : "warn",
    );
  }

  expect(effective.jsPlugins).toHaveLength(1);
  expect(effective.jsPlugins[0]?.specifier).toContain("/dist/plugin.mjs");
}, 30_000);

test("honors warning exit codes, errors, type checks, and ordinary warning fixes", () => {
  const warning = fixture("export type Boundary = any;\n");
  expect(warning.status, warning.stdout + warning.stderr).toBe(0);
  expect(warning.stdout + warning.stderr).toContain("no-explicit-any");
  const error = fixture("export const label = 'a\u2014b';\n", true);
  expect(error.status).not.toBe(0);
  expect(error.stdout + error.stderr).toContain("no-em-dash");
  const typeError = fixture('export const value: number = "wrong";\n');
  expect(typeError.status).not.toBe(0);
  expect(typeError.stdout + typeError.stderr).toContain("TS2322");
  const promise = fixture("Promise.resolve(1);\n");
  expect(promise.status).not.toBe(0);
  expect(promise.stdout + promise.stderr).toContain("no-floating-promises");
  const spread = fixture("export const values = [...[1, 2]];\n", true);
  expect(spread.status, spread.stdout + spread.stderr).toBe(0);
  expect(readFileSync(join(consumer, "case.ts"), "utf8")).toBe("export const values = [1, 2];\n");
}, 30_000);

test("uses native inheritance and file overrides without a custom merge", () => {
  writeFileSync(
    join(consumer, "vite.config.ts"),
    config.replace(
      "defineConfig({ lint, fmt, staged })",
      `defineConfig({ lint: { extends: [lint], rules: { "jong-kyung/no-em-dash": "off" } }, fmt, staged })`,
    ),
  );
  const disabled = fixture('export const label = "a\u2014b";\n');
  expect(disabled.status, disabled.stdout + disabled.stderr).toBe(0);
  writeFileSync(
    join(consumer, "vite.config.ts"),
    config.replace(
      "defineConfig({ lint, fmt, staged })",
      `defineConfig({ lint: { extends: [lint], overrides: [{ files: ["case.ts"], rules: { "jong-kyung/no-em-dash": "warn" } }] }, fmt, staged })`,
    ),
  );
  const overridden = run("vp", ["check", "case.ts"]);
  expect(overridden.status, overridden.stdout + overridden.stderr).toBe(0);
  expect(overridden.stdout + overridden.stderr).toContain("no-em-dash");
}, 30_000);

test("converges formatting and fixes while preserving compiler directives", () => {
  const first = fixture(
    `// User-facing title.
export const title=()=>'Kim';
// @ts-expect-error: The fixture checks directive preservation.
export const deliberate: number = "raw";
`,
    true,
  );

  expect(first.status, first.stdout + first.stderr).toBe(0);
  const fixed = readFileSync(join(consumer, "case.ts"), "utf8");
  expect(fixed).toContain("/** User-facing title. */");
  expect(fixed).toContain("\n\n// @ts-expect-error:");
  pass("vp", ["check", "--fix", "case.ts"]);
  expect(readFileSync(join(consumer, "case.ts"), "utf8")).toBe(fixed);
  pass("vp", ["check", "case.ts"]);
}, 30_000);

test("preserves partial staging and restores the index and worktree after failure", () => {
  pass("git", ["init", "-q"]);
  pass("git", ["config", "user.name", "Config fixture"]);
  pass("git", ["config", "user.email", "fixture@example.invalid"]);
  writeFileSync(join(consumer, ".gitignore"), "node_modules/\n*.tgz\n");
  writeFileSync(join(consumer, "case.ts"), "export const first = 1;\n\nexport const second = 2;\n");
  pass("git", ["add", "case.ts"]);
  pass("git", [
    "-c",
    "commit.gpgsign=false",
    "-c",
    "core.hooksPath=/dev/null",
    "commit",
    "-qm",
    "Fixture baseline",
  ]);
  writeFileSync(join(consumer, "case.ts"), "export type Boundary = any;\n");
  pass("git", ["add", "case.ts"]);
  pass("vp", ["staged"]);
  writeFileSync(join(consumer, "case.ts"), "export const first=3;\n\nexport const second = 2;\n");
  pass("git", ["add", "case.ts"]);
  writeFileSync(join(consumer, "case.ts"), "export const first=3;\n\nexport const second = 4;\n");
  pass("vp", ["staged"]);
  expect(pass("git", ["show", ":case.ts"])).toBe(
    "export const first = 3;\n\nexport const second = 2;\n",
  );
  expect(readFileSync(join(consumer, "case.ts"), "utf8")).toBe(
    "export const first = 3;\n\nexport const second = 4;\n",
  );
  const bad = 'export const first="a\u2014b";\n\nexport const second = 2;\n';
  writeFileSync(join(consumer, "case.ts"), bad);
  pass("git", ["add", "case.ts"]);
  const unstaged = bad.replace("second = 2", "second = 4");
  writeFileSync(join(consumer, "case.ts"), unstaged);
  const failed = run("vp", ["staged"]);
  expect(failed.status).not.toBe(0);
  expect(failed.stdout + failed.stderr).toContain("no-em-dash");
  expect(pass("git", ["show", ":case.ts"])).toBe(bad);
  expect(readFileSync(join(consumer, "case.ts"), "utf8")).toBe(unstaged);
}, 30_000);
