import type { RuleTester } from "vite-plus/lint/plugins-dev";
import plugin from "../../src/plugin.ts";
import { tester } from "../helpers/rule-tester.ts";

const cases = {
  valid: [
    "const run = () => value;",
    "type Promise<T> = string; function run(): Promise<unknown> { return ''; }",
    "import Promise = Custom.Promise; declare function load(): Promise<unknown>;",
    "export default interface Promise<T> {} declare function load(): Promise<unknown>;",
    "export default class Promise<T> {} declare function load(): Promise<unknown>;",
  ],
  invalid: [
    { code: "function run(): unknown { return value; }", errors: 1 },
    { code: "async function run(): Promise<unknown> { return value; }", errors: 1 },
    { code: "type Result = unknown; declare function run(): Result;", errors: 1 },
    { code: "interface Service { run(): PromiseLike<unknown>; }", errors: 1 },
    {
      code: "export default (class Promise<T> {}); declare function load(): Promise<unknown>;",
      errors: 1,
    },
  ],
} satisfies RuleTester.TestCases;

tester.run("no-unknown-returns", plugin.rules["no-unknown-returns"]!, cases);
