import { describe, it } from "vite-plus/test";
import { RuleTester } from "vite-plus/lint/plugins-dev";
import plugin from "../src/plugin.ts";

RuleTester.describe = describe;
RuleTester.it = it;

const tester = new RuleTester({ languageOptions: { parserOptions: { lang: "ts" } } });

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
      "function read() { /* SAFETY: The decoder checked this value. */ return raw as Value; }",
      "class C {\n  // SAFETY: The decoder checked this value.\n  value = raw as Value;\n}",
      "class C {\n  // SAFETY: The decoder checked this value.\n  accessor value = raw as Value;\n}",
      "class C {\n  // SAFETY: The decoder checked this value.\n  static #value = raw as Value;\n}",
      "class C { value = /* SAFETY: The decoder checked this value. */ raw as Value; }",
      "const result = {\n // SAFETY: The decoder checked this field.\n value: raw as Value\n};",
      "const result = { nested: {\n // SAFETY: The decoder checked this field.\n value: raw as Value\n} };",
      "const result = { value: /* SAFETY: The decoder checked this field. */ raw as Value };",
      "const result = {\n /** SAFETY: The key belongs to the validated set. */\n [key as Key]: value\n};",
      {
        code: "const result = {\n // INVARIANT: The decoder checked this field.\n value: raw as Value\n};",
        options: [{ markers: ["INVARIANT"] }],
      },
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
      {
        code: "validate(raw); // SAFETY: raw was decoded\nconst id = unrelated as Id;",
        errors: 1,
      },
      {
        code: "const first = raw as Id // SAFETY: raw was decoded\nconst second = unrelated as Id;",
        errors: 1,
      },
      { code: "const id = <Id>value;", errors: 1 },
      { code: "const result = { value: raw as Value };", errors: 1 },
      {
        code: "const result = {\n // SAFETY: Only the first field was checked.\n value: raw as Value,\n other: data as Other\n};",
        errors: 1,
      },
      {
        code: "// SAFETY: This documents the object, not its fields.\nconst result = { value: raw as Value, other: data as Other };",
        errors: 2,
      },
      {
        code: "const result = {\n // SAFETY: This documents the function, not its result.\n value: () => raw as Value\n};",
        errors: 1,
      },
      { code: "const result = {\n // SAFETY:\n value: raw as Value\n};", errors: 1 },
      {
        code: "const result = {\n // SAFETY: This comment is detached.\n\n value: raw as Value\n};",
        errors: 1,
      },
      {
        code: "// SAFETY: This documents the class, not its fields.\nclass C {\n  value = raw as Value;\n  other = data as Other;\n}",
        errors: 2,
      },
      {
        code: "// SAFETY: This documents the class, not its accessor.\nclass C { accessor value = raw as Value; }",
        errors: 1,
      },
      {
        code: "class C {\n  // SAFETY: Only the first value was decoded.\n  first = raw as Value;\n  second = data as Other;\n}",
        errors: 1,
      },
    ],
  },
  "prefer-jsdoc": {
    valid: [
      "const value = 1;",
      "//\nconst value = 1;",
      "/* */\nconst value = 1;",
      "/** User-facing name. */\nconst name = 'Kim';",
      "/*! Copyright Example */\nconst value = 1;",
      "/*! Copyright Example */\nexport function run() {}",
      "/*!\r\n * Copyright Example\r\n */\r\nclass Example {}",
      "/*! Copyright Example */\n// Details.\nconst value = 1;",
      "/*! Copyright Example */\n\nconst value = 1;",
      "/* @license MIT */\nconst value = 1;",
      "/* @preserve attribution */\nconst value = 1;",
      "class Example {\n  /*! Preserve this. */\n  value = 1;\n}",
      "// oxlint-disable-next-line no-debugger\ndebugger;",
      "// @ts-expect-error: Intentionally invalid input.\nconst value: number = '';",
      "// prettier-ignore\nconst value = { a: 1 };",
      "/* node:coverage ignore next */\nfunction unused() {}",
      "/* global SDK */\nconst value = SDK;",
      "/* globals SDK */\nconst value = SDK;",
      "/* exported api */\nvar api = 1;",
      "// Do not embed */ in a generated block.\nconst value = 1;",
      "const object = {\n  // Property explanation.\n  value: 1,\n};",
      "// Detached heading.\n\nconst value = 1;",
      "/// <reference types='node' />\nconst value = 1;",
      "/// <amd-module name='example' />\nconst value = 1;",
    ],
    invalid: [
      {
        code: "// globalThis provides shared state.\nconst value = globalThis;",
        output: "/** globalThis provides shared state. */\nconst value = globalThis;",
        errors: 1,
      },
      {
        code: "// See https://example.com\nconst value = 1;",
        output: "/** See https://example.com */\nconst value = 1;",
        errors: 1,
      },
      {
        code: "// Input/output mapping.\nconst value = 1;",
        output: "/** Input/output mapping. */\nconst value = 1;",
        errors: 1,
      },
      {
        code: "// /api/users endpoint.\nconst value = 1;",
        output: "/** /api/users endpoint. */\nconst value = 1;",
        errors: 1,
      },
      {
        code: "/* /api/users endpoint. */\nconst value = 1;",
        output: "/** /api/users endpoint. */\nconst value = 1;",
        errors: 1,
      },
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
        code: "/* ! Ordinary explanation. */\nconst value = 1;",
        output: "/** ! Ordinary explanation. */\nconst value = 1;",
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
      "doWork(); // oxlint-disable-next-line no-unused-vars\nconst unused = 1;",
      "const unused = 1; // oxlint-disable-line no-unused-vars\nrun();",
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
        code: "doWork();\n// oxlint-disable-next-line no-unused-vars\nconst unused = 1;",
        output: "doWork();\n\n// oxlint-disable-next-line no-unused-vars\nconst unused = 1;",
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
  tester.run(name, plugin.rules[name]!, cases);
}
