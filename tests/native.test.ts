import { expect, test } from "vite-plus/test";
import { nativeLint } from "../src/native.ts";

test("native rule inventory and severities match the approved policy", () => {
  const severities = Object.fromEntries(
    Object.entries(nativeLint.rules!).map(([name, setting]) => [
      name,
      Array.isArray(setting) ? setting[0] : setting,
    ]),
  );

  expect(severities).toMatchInlineSnapshot(`
    {
      "constructor-super": "off",
      "for-direction": "error",
      "getter-return": "off",
      "no-async-promise-executor": "error",
      "no-caller": "off",
      "no-class-assign": "off",
      "no-compare-neg-zero": "error",
      "no-cond-assign": "error",
      "no-const-assign": "off",
      "no-constant-binary-expression": "error",
      "no-constant-condition": "error",
      "no-control-regex": "warn",
      "no-debugger": "error",
      "no-delete-var": "off",
      "no-dupe-class-members": "off",
      "no-dupe-else-if": "error",
      "no-dupe-keys": "off",
      "no-duplicate-case": "error",
      "no-empty-character-class": "error",
      "no-empty-pattern": "error",
      "no-empty-static-block": "error",
      "no-eval": "error",
      "no-ex-assign": "error",
      "no-extra-boolean-cast": "error",
      "no-func-assign": "off",
      "no-global-assign": "error",
      "no-import-assign": "error",
      "no-invalid-regexp": "error",
      "no-irregular-whitespace": "error",
      "no-iterator": "off",
      "no-loss-of-precision": "error",
      "no-misleading-character-class": "error",
      "no-new-native-nonconstructor": "off",
      "no-nonoctal-decimal-escape": "off",
      "no-obj-calls": "off",
      "no-self-assign": "error",
      "no-setter-return": "off",
      "no-shadow-restricted-names": "error",
      "no-sparse-arrays": "error",
      "no-this-before-super": "off",
      "no-unassigned-vars": "error",
      "no-unreachable": "error",
      "no-unsafe-finally": "error",
      "no-unsafe-negation": "off",
      "no-unsafe-optional-chaining": "error",
      "no-unused-expressions": "error",
      "no-unused-labels": "error",
      "no-unused-private-class-members": "error",
      "no-unused-vars": "error",
      "no-useless-backreference": "error",
      "no-useless-catch": "error",
      "no-useless-escape": "error",
      "no-useless-rename": "error",
      "no-with": "off",
      "oxc/bad-array-method-on-arguments": "off",
      "oxc/bad-char-at-comparison": "error",
      "oxc/bad-comparison-sequence": "error",
      "oxc/bad-match-all-arg": "error",
      "oxc/bad-min-max-func": "error",
      "oxc/bad-object-literal-comparison": "off",
      "oxc/bad-replace-all-arg": "error",
      "oxc/const-comparisons": "error",
      "oxc/double-comparisons": "warn",
      "oxc/erasing-op": "warn",
      "oxc/missing-throw": "error",
      "oxc/no-accumulating-spread": "error",
      "oxc/number-arg-out-of-range": "off",
      "oxc/only-used-in-recursion": "warn",
      "oxc/uninvoked-array-callback": "off",
      "require-yield": "error",
      "typescript/await-thenable": "error",
      "typescript/no-array-delete": "error",
      "typescript/no-base-to-string": "error",
      "typescript/no-duplicate-enum-values": "error",
      "typescript/no-duplicate-type-constituents": "error",
      "typescript/no-explicit-any": "warn",
      "typescript/no-extra-non-null-assertion": "error",
      "typescript/no-floating-promises": "error",
      "typescript/no-for-in-array": "error",
      "typescript/no-implied-eval": "error",
      "typescript/no-meaningless-void-operator": "error",
      "typescript/no-misused-new": "error",
      "typescript/no-misused-promises": "error",
      "typescript/no-misused-spread": "error",
      "typescript/no-non-null-asserted-optional-chain": "error",
      "typescript/no-redundant-type-constituents": "error",
      "typescript/no-this-alias": "error",
      "typescript/no-unnecessary-parameter-property-assignment": "warn",
      "typescript/no-unsafe-argument": "error",
      "typescript/no-unsafe-assignment": "error",
      "typescript/no-unsafe-call": "error",
      "typescript/no-unsafe-declaration-merging": "error",
      "typescript/no-unsafe-member-access": "error",
      "typescript/no-unsafe-return": "error",
      "typescript/no-unsafe-unary-minus": "off",
      "typescript/no-useless-default-assignment": "warn",
      "typescript/no-useless-empty-export": "off",
      "typescript/no-wrapper-object-types": "error",
      "typescript/only-throw-error": "error",
      "typescript/prefer-as-const": "error",
      "typescript/prefer-namespace-keyword": "off",
      "typescript/require-array-sort-compare": "error",
      "typescript/restrict-template-expressions": "error",
      "typescript/switch-exhaustiveness-check": "error",
      "typescript/triple-slash-reference": "error",
      "typescript/unbound-method": "error",
      "unicorn/no-await-in-promise-methods": "error",
      "unicorn/no-empty-file": "warn",
      "unicorn/no-invalid-fetch-options": "error",
      "unicorn/no-invalid-remove-event-listener": "error",
      "unicorn/no-new-array": "error",
      "unicorn/no-single-promise-in-promise-methods": "off",
      "unicorn/no-thenable": "warn",
      "unicorn/no-unnecessary-await": "off",
      "unicorn/no-useless-fallback-in-spread": "error",
      "unicorn/no-useless-length-check": "warn",
      "unicorn/no-useless-spread": "warn",
      "unicorn/prefer-set-size": "error",
      "unicorn/prefer-string-starts-ends-with": "off",
      "use-isnan": "off",
      "valid-typeof": "error",
    }
  `);
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
