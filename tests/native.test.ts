import { readFileSync } from "node:fs";
import { expect, test } from "vite-plus/test";
import { nativeLint } from "../src/native.ts";

const optionalRules = [
  "oxc/no-accumulating-spread",
  "typescript/no-misused-promises",
  "typescript/switch-exhaustiveness-check",
  "typescript/no-unsafe-assignment",
  "typescript/no-unsafe-argument",
  "typescript/no-unsafe-call",
  "typescript/no-unsafe-member-access",
  "typescript/no-unsafe-return",
  "typescript/only-throw-error",
  "typescript/no-explicit-any",
];

test("native severities match every approved default decision", () => {
  const decisions = readFileSync(new URL("../docs/rules.md", import.meta.url), "utf8");
  const rows = [...decisions.matchAll(/^\|\s*\d+\s*\|\s*(\S+)\s*\|\s*(error|warn|off)\b/gm)];
  expect(rows).toHaveLength(111);
  const names: string[] = [];

  for (const [, id, expected] of rows) {
    const name = id!.replace(/^eslint\//, "");
    names.push(name);
    const setting = nativeLint.rules![name];
    expect(Array.isArray(setting) ? setting[0] : setting, name).toBe(expected);
  }

  expect(Object.keys(nativeLint.rules!).sort()).toEqual([...names, ...optionalRules].sort());
});

test("only approved rules are active and warnings stay nonblocking", () => {
  const levels = Object.values(nativeLint.rules!).map((value) =>
    Array.isArray(value) ? value[0] : value,
  );

  expect(levels.filter((level) => level === "error")).toHaveLength(82);
  expect(levels.filter((level) => level === "warn")).toHaveLength(11);
  expect(levels.filter((level) => level === "off")).toHaveLength(28);
  expect(nativeLint.categories).toEqual({
    correctness: "off",
    nursery: "off",
    pedantic: "off",
    perf: "off",
    restriction: "off",
    style: "off",
    suspicious: "off",
  });
  expect(nativeLint.options).toEqual({ typeAware: true, typeCheck: true });
  expect(nativeLint.plugins).toEqual(["typescript", "oxc", "unicorn"]);
});

test("nondefault choices and safety-sensitive options remain explicit", () => {
  expect(nativeLint.rules!["no-unsafe-optional-chaining"]).toEqual([
    "error",
    { disallowArithmeticOperators: true },
  ]);
  expect(nativeLint.rules!["no-cond-assign"]).toEqual(["error", "always"]);
  expect(nativeLint.rules!["no-unused-vars"]).toEqual([
    "error",
    {
      vars: "all",
      args: "all",
      caughtErrors: "all",
      argsIgnorePattern: "^_",
      caughtErrorsIgnorePattern: "^_",
      ignoreRestSiblings: true,
    },
  ]);
  expect(nativeLint.rules!["typescript/no-explicit-any"]).toEqual([
    "warn",
    { fixToUnknown: false, ignoreRestArgs: false },
  ]);
  expect(nativeLint.rules!["unicorn/no-useless-spread"]).toBe("warn");
});
