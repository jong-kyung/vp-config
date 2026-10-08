import type { RuleTester } from "vite-plus/lint/plugins-dev";
import plugin from "../../src/plugin.ts";
import { tester } from "../helpers/rule-tester.ts";

const cases = {
  valid: [
    "type Users = Record<string, User>;",
    "type User = { value: unknown };",
    "type Data = Record<'value', unknown>;",
    "type Data = { [K in 'value']: unknown };",
    "type Data = { [K in string as 'value']: unknown };",
    "function run<T extends Record<string, unknown>>(value: T) {}",
    "type Record<K, V> = { value: string }; type Data = Record<string, unknown>;",
    "export default interface Record<K, V> {} type Data = Record<string, unknown>;",
  ],
  invalid: [
    { code: "type Data = Record<string, unknown>;", errors: 1 },
    { code: "type Data = Record<string, any>;", errors: 1 },
    { code: "interface Data { [key: string]: {}; }", errors: 1 },
    { code: "type Raw = unknown; type Data = Record<string, Raw>;", errors: 1 },
    { code: "type Data = { [K in string]: unknown };", errors: 1 },
    { code: "type Data = { [K in 'value' as string]: unknown };", errors: 1 },
  ],
} satisfies RuleTester.TestCases;

tester.run("no-unsafe-dictionary-type", plugin.rules["no-unsafe-dictionary-type"]!, cases);
