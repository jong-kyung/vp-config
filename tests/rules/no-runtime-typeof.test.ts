import type { RuleTester } from "vite-plus/lint/plugins-dev";
import plugin from "../../src/plugin.ts";
import { tester } from "../helpers/rule-tester.ts";

const cases = {
  valid: [
    "type T = typeof value;",
    "if (typeof window !== 'undefined') {}",
    "if (typeof window !== `undefined`) {}",
    "if (`undefined` === typeof window) {}",
    {
      code: "function isText(value: unknown): value is string { return typeof value === 'string'; }",
      options: [{ allowInTypeGuards: true }],
    },
  ],
  invalid: [
    { code: "if (typeof value === 'string') {}", errors: 1 },
    { code: "if (typeof value === `string`) {}", errors: 1 },
    { code: "if (typeof window !== undefined) {}", errors: 1 },
    { code: "if (typeof window !== `un${part}`) {}", errors: 1 },
    {
      code: "function isText(value: unknown): value is string { return typeof value === 'string'; }",
      errors: 1,
    },
    {
      code: "function isText(value: unknown): value is string { const test = () => typeof value; return true; }",
      options: [{ allowInTypeGuards: true }],
      errors: 1,
    },
  ],
} satisfies RuleTester.TestCases;

tester.run("no-runtime-typeof", plugin.rules["no-runtime-typeof"]!, cases);
