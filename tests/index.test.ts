import { fileURLToPath } from "node:url";
import { expect, test } from "vite-plus/test";
import { libConfig, nodeConfig } from "../src/index.ts";
import { nativeLint } from "../src/native.ts";
import plugin from "../src/plugin.ts";

const lint = nodeConfig.lint.extends[0]!;

const root = fileURLToPath(new URL("../", import.meta.url));

expect.addSnapshotSerializer({
  test: (value): value is string => typeof value === "string" && value.startsWith(root),
  serialize: (value) =>
    JSON.stringify(String(value).replace(root, "<root>/").replaceAll("\\", "/")),
});

test("registers every custom plugin rule in the preset", () => {
  const ownRules = Object.keys(lint.rules!)
    .filter((name) => name.startsWith("jong-kyung/"))
    .map((name) => name.slice("jong-kyung/".length));

  expect(ownRules.sort()).toEqual(Object.keys(plugin.rules).sort());
});

test("presets preserve native settings and share the same lint policy", () => {
  expect(lint).toMatchObject(nativeLint);
  expect(libConfig.lint).toBe(nodeConfig.lint);
  expect(libConfig).toEqual({ ...nodeConfig, pack: libConfig.pack });
});

test("public presets and fixable rules match the approved policy", () => {
  expect({
    nodeConfig,
    libPack: libConfig.pack,
    fixableRules: Object.entries(plugin.rules)
      .filter(([, rule]) => rule.meta?.fixable)
      .map(([name]) => name)
      .sort(),
  }).toMatchSnapshot();
});
