import type { RuleTester } from "vite-plus/lint/plugins-dev";
import plugin from "../../src/plugin.ts";
import { tester } from "../helpers/rule-tester.ts";

const cases = {
  valid: ["vi.fn();", "vi.spyOn(target, 'run');", "function test(vi) { vi.mock('x'); }"],
  invalid: [
    { code: "vi.mock('./service');", errors: 1 },
    { code: "type vi = {}; vi.mock('./service');", errors: 1 },
    { code: "import { vi as v } from 'vitest'; v.doMock('./service');", errors: 1 },
    { code: "jest.unstable_mockModule('./service', factory);", errors: 1 },
    { code: "const { mock: replace } = vi; replace('./service');", errors: 1 },
  ],
} satisfies RuleTester.TestCases;

tester.run("no-module-mocking", plugin.rules["no-module-mocking"]!, cases);
