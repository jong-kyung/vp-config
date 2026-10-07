import { expect, test } from "vite-plus/test";
import { lint, fmt, staged } from "../src/index.ts";
import plugin from "../src/plugin.ts";
import manifest from "../package.json" with { type: "json" };

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
  expect(fmt).toEqual({});
  expect(staged).toEqual({ "*": "vp check --fix" });
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
