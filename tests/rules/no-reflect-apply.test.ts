import type { RuleTester } from "vite-plus/lint/plugins-dev";
import plugin from "../../src/plugin.ts";
import { tester } from "../helpers/rule-tester.ts";

const cases = {
  valid: ["fn.call(receiver, value);", "function run(Reflect) { Reflect.apply(fn, ctx, []); }"],
  invalid: [
    { code: "Reflect.apply(fn, ctx, []);", errors: 1 },
    { code: "const invoke = Reflect.apply; invoke(fn, ctx, []);", errors: 1 },
  ],
} satisfies RuleTester.TestCases;

tester.run("no-reflect-apply", plugin.rules["no-reflect-apply"]!, cases);
