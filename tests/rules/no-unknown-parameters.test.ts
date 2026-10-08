import type { RuleTester } from "vite-plus/lint/plugins-dev";
import plugin from "../../src/plugin.ts";
import { tester } from "../helpers/rule-tester.ts";

const cases = {
  valid: [
    "function run(cause: unknown) {}",
    "function isUser(input: unknown): input is User { return true; }",
    "function check(input: unknown): asserts input is User {}",
    "class State { isReady(this: unknown): this is Ready { return true; } }",
    "class State { assertReady(this: unknown): asserts this is Ready {} }",
    "type Input = unknown; function outer() { type Input = string; function run(input: Input) {} }",
  ],
  invalid: [
    { code: "function run(input: unknown) {}", errors: 1 },
    { code: "class State { run(this: unknown) {} }", errors: 1 },
    {
      code: "class State { isReady(this: unknown, other: unknown): this is Ready { return true; } }",
      errors: 1,
    },
    { code: "type Input = unknown; const run = (input: Input) => {};", errors: 1 },
    { code: "interface Service { run(input: unknown): void; }", errors: 1 },
    { code: "type Callback = (input: unknown) => void;", errors: 1 },
    {
      code: "function isUser(input: unknown, other: unknown): input is User { return true; }",
      errors: 1,
    },
  ],
} satisfies RuleTester.TestCases;

tester.run("no-unknown-parameters", plugin.rules["no-unknown-parameters"]!, cases);
