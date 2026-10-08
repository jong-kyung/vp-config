import type { RuleTester } from "vite-plus/lint/plugins-dev";
import plugin from "../../src/plugin.ts";
import { tester } from "../helpers/rule-tester.ts";

const cases = {
  valid: ["const x = { ...options };", "const x = { ...(ok ? left : right) };"],
  invalid: [
    { code: "const x = { ...(ok ? { value } : {}) };", errors: 1 },
    { code: "const x = { ...(ok ? {} : options) };", errors: 1 },
  ],
} satisfies RuleTester.TestCases;

tester.run(
  "no-conditional-empty-object-spread",
  plugin.rules["no-conditional-empty-object-spread"]!,
  cases,
);
