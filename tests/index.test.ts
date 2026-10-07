import { mergeConfig } from "vite-plus";
import { expect, test } from "vite-plus/test";
import { nodeConfig, libConfig } from "../src/index.ts";
import plugin from "../src/plugin.ts";
import manifest from "../package.json" with { type: "json" };

const lint = nodeConfig.lint.extends[0]!;

const severity = (setting: NonNullable<typeof lint.rules>[string]) =>
  Array.isArray(setting) ? setting[0] : setting;

test("exports plain configuration objects and the exact approved inventory", () => {
  expect(manifest.peerDependencies).toEqual({ "vite-plus": "catalog:" });
  expect(manifest.devDependencies).toEqual({
    "@types/node": "catalog:",
    typescript: "catalog:",
    "vite-plus": "catalog:",
  });
  expect("dependencies" in manifest).toBe(false);
  expect(Object.getPrototypeOf(lint)).toBe(Object.prototype);
  const levels = Object.values(lint.rules!).map(severity);
  expect(levels.filter((level) => level === "error")).toHaveLength(94);
  expect(levels.filter((level) => level === "warn")).toHaveLength(20);
  expect(levels.filter((level) => level === "off")).toHaveLength(28);

  const ownRules = Object.keys(lint.rules!)
    .filter((name) => name.startsWith("jong-kyung/"))
    .map((name) => name.slice("jong-kyung/".length));

  expect(ownRules.sort()).toEqual(Object.keys(plugin.rules).sort());
  expect(ownRules).toHaveLength(21);
});

test("exports project presets with inherited lint and library-only packaging defaults", () => {
  expect(Object.getPrototypeOf(nodeConfig)).toBe(Object.prototype);
  expect(nodeConfig).toEqual({
    lint: { extends: [lint] },
  });
  expect(libConfig).toEqual({
    ...nodeConfig,
    pack: {
      platform: "neutral",
      format: ["esm"],
      target: "es2022",
      dts: true,
      exports: false,
    },
  });
  expect(mergeConfig(nodeConfig, { pack: { entry: ["server.ts"] } }).pack).toEqual({
    entry: ["server.ts"],
  });
});

test("composes root lint overrides without changing inherited rules or input objects", () => {
  const extension = { rules: { curly: "error" } };

  const overrides = {
    lint: {
      extends: [extension],
      rules: { "jong-kyung/no-runtime-typeof": "off" },
    },
    fmt: { singleQuote: true },
    test: { include: ["test/**/*.ts"] },
    resolve: { alias: { "@": "/src" } },
  };

  const before = structuredClone({ nodeConfig, libConfig, overrides });

  expect(mergeConfig(nodeConfig, overrides)).toEqual({
    ...nodeConfig,
    ...overrides,
    lint: {
      extends: [lint, extension],
      rules: { "jong-kyung/no-runtime-typeof": "off" },
    },
  });
  expect(mergeConfig(libConfig, { pack: { entry: ["src/index.ts"] } }).pack).toEqual({
    ...libConfig.pack,
    entry: ["src/index.ts"],
  });
  expect({ nodeConfig, libConfig, overrides }).toEqual(before);
});

test("retains native array concatenation and permits explicit section replacement", () => {
  const merged = mergeConfig(libConfig, {
    pack: { format: ["cjs"], target: ["es2020", "node20"], entry: ["src/index.ts"] },
    staged: { "*": ["vp lint", "vp fmt"] },
  });

  expect(merged).toMatchObject({
    pack: {
      format: ["esm", "cjs"],
      target: ["es2022", "es2020", "node20"],
      entry: ["src/index.ts"],
    },
    staged: { "*": ["vp lint", "vp fmt"] },
  });
  expect(
    mergeConfig(
      { ...libConfig, pack: { ...libConfig.pack, format: ["cjs"] } },
      { pack: { entry: ["src/index.ts"] } },
    ),
  ).toMatchObject({ pack: { format: ["cjs"], entry: ["src/index.ts"] } });
  expect(
    mergeConfig(libConfig, { pack: { target: "es2020" }, staged: { "*": "vp lint" } }),
  ).toMatchObject({ pack: { target: "es2020" }, staged: { "*": "vp lint" } });
});

test("preserves the selected custom rule options", () => {
  expect(lint.rules!["jong-kyung/no-runtime-typeof"]).toEqual([
    "warn",
    { allowInTypeGuards: true },
  ]);
  expect(lint.rules!["jong-kyung/require-safety-comment-for-type-assertion"]).toEqual([
    "warn",
    { markers: ["SAFETY"] },
  ]);
  expect(
    Object.entries(plugin.rules)
      .filter(([, rule]) => rule.meta?.fixable)
      .map(([name]) => name)
      .sort(),
  ).toEqual(["prefer-jsdoc", "require-readable-spacing"]);
});
