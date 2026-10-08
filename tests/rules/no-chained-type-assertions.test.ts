import type { RuleTester } from "vite-plus/lint/plugins-dev";
import plugin from "../../src/plugin.ts";
import { tester } from "../helpers/rule-tester.ts";

const cases = {
  valid: [
    "const x = value as User;",
    "const x = [1] as const;",
    "const x = (1 as const)! as const;",
    "wrap(value as unknown) as User;",
    "(value as unknown).field as User;",
  ],
  invalid: [
    { code: "value as unknown as User;", errors: 1 },
    { code: "(<unknown>value) as User;", errors: 1 },
    { code: "((value as unknown) satisfies unknown)! as User;", errors: 1 },
    { code: "(value as unknown as object)! as User;", errors: 1 },
  ],
} satisfies RuleTester.TestCases;

tester.run("no-chained-type-assertions", plugin.rules["no-chained-type-assertions"]!, cases);
