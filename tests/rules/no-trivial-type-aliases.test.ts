import type { RuleTester } from "vite-plus/lint/plugins-dev";
import plugin from "../../src/plugin.ts";
import { tester } from "../helpers/rule-tester.ts";

const cases = {
  valid: [
    "type User = { name: string };",
    "type State = 'ready' | 'done';",
    "type Identity<T> = T;",
    "function run() { type Label = string; }",
  ],
  invalid: [
    { code: "type Label = string;", errors: 1 },
    { code: "export type Count = number;", errors: 1 },
    { code: "type First = string; type Second = First;", errors: 2 },
  ],
} satisfies RuleTester.TestCases;

tester.run("no-trivial-type-aliases", plugin.rules["no-trivial-type-aliases"]!, cases);
