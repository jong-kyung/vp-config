import type { RuleTester } from "vite-plus/lint/plugins-dev";
import plugin from "../../src/plugin.ts";
import { tester } from "../helpers/rule-tester.ts";

const cases = {
  valid: [
    "const value = load(); value as User;",
    "const value: unknown = 1; value as unknown;",
    "const value: object = {}; value as object;",
    "const value: {} = 1; value as {};",
    "const value: any = 1; value as any;",
    "const value = 1 as unknown; value as unknown;",
    "const value = {} as object; value as object;",
    "const value = 1 as {}; value as {};",
    "const value = 1 as any; value as any;",
    "const value: unknown = 1 as any; value as unknown;",
    "const source: object = {}; const value: unknown = source; value as unknown;",
    "const value: unknown = 1; const alias = value; alias as unknown;",
    "type Broad = unknown; type Other = Broad; const value: Broad = 1; value as Other;",
    "type Broad = {}; const value: Broad = 1; value as {};",
    "type Dictionary = Record<string, string>; const value: Dictionary = { name: 'Kim' }; value as Dictionary;",
    "function run(undefined: unknown) { const value: unknown = undefined; value as User; }",
    "const value: unknown = load(); value as User;",
    "declare const raw: unknown; const value = raw as unknown; value as User;",
    "let value: unknown = 1; value = other; value as User;",
    "const value: { name: string } = { name: 'Kim' }; value as User;",
    "const value = { name: 'Kim' } as { name: string }; value as User;",
    "type User = { name: string }; const value: User = { name: 'Kim' }; value as User;",
  ],
  invalid: [
    { code: "const value: unknown = 1; value as number;", errors: 1 },
    { code: "const value: unknown = undefined; value as User;", errors: 1 },
    { code: "const value: unknown = 1; value as object;", errors: 1 },
    { code: "const value: object = {}; value as {};", errors: 1 },
    { code: "const value: unknown = 1; value as Record<string, number>;", errors: 1 },
    { code: "const value: unknown = 1; value as { name: string };", errors: 1 },
    {
      code: "type Broad = unknown; const value: Broad = 1; function run() { type Broad = object; value as Broad; }",
      errors: 1,
    },
    { code: "const value = { name: 'Kim' } as unknown; value as User;", errors: 1 },
    { code: "const value: unknown = 1; const alias = value; alias as number;", errors: 1 },
    { code: "const value = (1 as unknown)!; value as number;", errors: 1 },
    { code: "type Broad = {}; const value: Broad = 1; value as number;", errors: 1 },
    { code: "const value: {} = 1; value as number;", errors: 1 },
    {
      code: "const value: { [key: string]: string } = { name: 'Kim' }; value as User;",
      errors: 1,
    },
  ],
} satisfies RuleTester.TestCases;

tester.run("no-widen-then-assert", plugin.rules["no-widen-then-assert"]!, cases);
