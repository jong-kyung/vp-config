import type { RuleTester } from "vite-plus/lint/plugins-dev";
import plugin from "../../src/plugin.ts";
import { tester } from "../helpers/rule-tester.ts";

const cases = {
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
} satisfies RuleTester.TestCases;

tester.run(
  "require-safety-comment-for-type-assertion",
  plugin.rules["require-safety-comment-for-type-assertion"]!,
  cases,
);
