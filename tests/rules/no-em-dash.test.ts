import type { RuleTester } from "vite-plus/lint/plugins-dev";
import plugin from "../../src/plugin.ts";
import { tester } from "../helpers/rule-tester.ts";

const cases = {
  valid: ["const label = 'a-b';", "const label = '\\u2014';"],
  invalid: [
    { code: "// a \u2014 b\nconst x = 1;", errors: 1 },
    { code: "const label = 'a\u2014b';", errors: 1 },
    { code: "const label = `a\u2014${value}\u2014b`;", errors: 2 },
  ],
} satisfies RuleTester.TestCases;

tester.run("no-em-dash", plugin.rules["no-em-dash"]!, cases);
