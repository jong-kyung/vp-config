import type { RuleTester } from "vite-plus/lint/plugins-dev";
import plugin from "../../src/plugin.ts";
import { tester } from "../helpers/rule-tester.ts";

const cases = {
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
      output: "function run() {\n  const value = {\n    name: 'Kim',\n  };\n\n  const next = 2;\n}",
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
} satisfies RuleTester.TestCases;

tester.run("require-readable-spacing", plugin.rules["require-readable-spacing"]!, cases);
