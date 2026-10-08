import { expect, test } from "vite-plus/test";
import { nodeConfig } from "../src/index.ts";
import plugin from "../src/plugin.ts";

const lint = nodeConfig.lint.extends[0]!;

test("registers every custom plugin rule in the preset", () => {
  const ownRules = Object.keys(lint.rules!)
    .filter((name) => name.startsWith("jong-kyung/"))
    .map((name) => name.slice("jong-kyung/".length));

  expect(ownRules.sort()).toEqual(Object.keys(plugin.rules).sort());
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
