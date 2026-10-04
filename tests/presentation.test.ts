import { describe, it } from "vite-plus/test";
import { RuleTester } from "vite-plus/lint/plugins-dev";
import { presentationRules } from "../src/rules/presentation.ts";

RuleTester.describe = describe;
RuleTester.it = it;

const tester = new RuleTester({ languageOptions: { parserOptions: { lang: "ts" } } });

const rules = new Map(Object.entries(presentationRules));

for (const [name, cases] of Object.entries({
  "no-em-dash": {
    valid: ["const label = 'a-b';", "const label = '\\u2014';"],
    invalid: [
      { code: "// a \u2014 b\nconst x = 1;", errors: 1 },
      { code: "const label = 'a\u2014b';", errors: 1 },
      { code: "const label = `a\u2014${value}\u2014b`;", errors: 2 },
    ],
  },
  "require-safety-comment-for-type-assertion": {
    valid: [
      "const x = [1] as const;",
      "// SAFETY: The parser validated this identifier.\nexport const id = value as Id;",
      "const id = /* SAFETY: Validation ran at the boundary. */ value as Id;",
      "/** SAFETY: The decoder checked the payload. */\nconst payload = (\n  value as Payload\n);",
      {
        code: "// INVARIANT: The bounds were checked.\nconst id = value as Id;",
        options: [{ markers: ["INVARIANT"] }],
      },
    ],
    invalid: [
      { code: "const id = value as Id;", errors: 1 },
      { code: "// SAFETY:\nconst id = value as Id;", errors: 1 },
      { code: "/** SAFETY:\n *\n */\nconst id = value as Id;", errors: 1 },
      {
        code: "// SAFETY: An unrelated earlier operation was checked.\nrun();\nconst id = value as Id;",
        errors: 1,
      },
      {
        code: "// SAFETY: This documents the function, not its implementation.\nfunction run() { return value as Id; }",
        errors: 1,
      },
      { code: "const id = <Id>value;", errors: 1 },
    ],
  },
  "prefer-jsdoc": {
    valid: [
      "const value = 1;",
      "//\nconst value = 1;",
      "/* */\nconst value = 1;",
      "/** User-facing name. */\nconst name = 'Kim';",
      "// oxlint-disable-next-line no-debugger\ndebugger;",
      "// @ts-expect-error: Intentionally invalid input.\nconst value: number = '';",
      "// prettier-ignore\nconst value = { a: 1 };",
      "// Do not embed */ in a generated block.\nconst value = 1;",
      "const object = {\n  // Property explanation.\n  value: 1,\n};",
      "// Detached heading.\n\nconst value = 1;",
      "/// <reference types='node' />\nconst value = 1;",
    ],
    invalid: [
      {
        code: "// User-facing name.\nexport const name = 'Kim';",
        output: "/** User-facing name. */\nexport const name = 'Kim';",
        errors: 1,
      },
      {
        code: "/* User-facing name. */\nconst name = 'Kim';",
        output: "/** User-facing name. */\nconst name = 'Kim';",
        errors: 1,
      },
      {
        code: "// First line.\n// Second line.\nfunction run() {}",
        output: "/**\n * First line.\n * Second line.\n */\nfunction run() {}",
        errors: 1,
      },
      {
        code: "class User {\n  // User-facing name.\n  name = '';\n}",
        output: "class User {\n  /** User-facing name. */\n  name = '';\n}",
        errors: 1,
      },
    ],
  },
  "require-readable-spacing": {
    valid: [
      "const first = 1;\n\nconst second = 2;",
      "import a from 'a';\nimport b from 'b';",
      "function run() {\n  const first = 1;\n  const second = 2;\n}",
      "function run(x: string): string;\nfunction run(x: number): number;\nfunction run(x) { return x; }",
      "const first = 1;\n\n/** Documentation. */\nconst second = 2;",
    ],
    invalid: [
      {
        code: "const first = 1;\nconst second = 2;",
        output: "const first = 1;\n\nconst second = 2;",
        errors: 1,
      },
      {
        code: "const first = 1; const second = 2;",
        output: "const first = 1;\n\nconst second = 2;",
        errors: 1,
      },
      {
        code: "const first = 1;\n/** Documentation. */\nconst second = 2;",
        output: "const first = 1;\n\n/** Documentation. */\nconst second = 2;",
        errors: 1,
      },
      {
        code: "function run() {\n  const value = 1;\n  return value;\n}",
        output: "function run() {\n  const value = 1;\n\n  return value;\n}",
        errors: 1,
      },
      {
        code: "function run() {\n  const value = {\n    name: 'Kim',\n  };\n  const next = 2;\n}",
        output:
          "function run() {\n  const value = {\n    name: 'Kim',\n  };\n\n  const next = 2;\n}",
        errors: 1,
      },
      {
        code: "function run() {\n  if (ok) { run(); }\n  finish();\n}",
        output: "function run() {\n  if (ok) { run(); }\n\n  finish();\n}",
        errors: 1,
      },
      {
        code: "const first = 1;\r\nconst second = 2;",
        output: "const first = 1;\r\n\r\nconst second = 2;",
        errors: 1,
      },
    ],
  },
} satisfies Record<string, RuleTester.TestCases>)) {
  tester.run(name, rules.get(name)!, cases);
}
