import type { RuleTester } from "vite-plus/lint/plugins-dev";
import plugin from "../../src/plugin.ts";
import { tester } from "../helpers/rule-tester.ts";

const cases = {
  valid: [
    "function run(value: { name: string }) {}",
    "type Input = object; function run<Input>(value: Input) {}",
    "type Box<T> = T; function run(value: Box<object>) {}",
  ],
  invalid: [
    { code: "function run(value: object | null) {}", errors: 1 },
    { code: "type Input = object; function run(value: Input) {}", errors: 1 },
    { code: "class C { constructor(public value: object) {} }", errors: 1 },
  ],
} satisfies RuleTester.TestCases;

tester.run("no-object-parameters", plugin.rules["no-object-parameters"]!, cases);
