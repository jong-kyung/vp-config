import type { RuleTester } from "vite-plus/lint/plugins-dev";
import plugin from "../../src/plugin.ts";
import { tester } from "../helpers/rule-tester.ts";

const cases = {
  valid: [
    "type User = { value: unknown };",
    "type Values = unknown[];",
    "type Loop = Loop | null;",
    "type Hidden<T = unknown> = T; type Value = Hidden;",
  ],
  invalid: [
    { code: "type Raw = unknown;", errors: 1 },
    { code: "type A = unknown; type B = A;", errors: 2 },
    { code: "type B = A; type A = unknown;", errors: 2 },
    { code: "type Raw = unknown | string;", errors: 1 },
  ],
} satisfies RuleTester.TestCases;

tester.run("no-unknown-type-aliases", plugin.rules["no-unknown-type-aliases"]!, cases);
