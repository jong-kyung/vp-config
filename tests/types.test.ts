import { describe, it } from "vite-plus/test";
import { RuleTester } from "vite-plus/lint/plugins-dev";
import plugin from "../src/plugin.ts";

RuleTester.describe = describe;
RuleTester.it = it;

const tester = new RuleTester({ languageOptions: { parserOptions: { lang: "ts" } } });

for (const [name, cases] of Object.entries({
  "no-object-parameters": {
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
  },
  "no-unknown-parameters": {
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
  },
  "no-unknown-returns": {
    valid: [
      "const run = () => value;",
      "type Promise<T> = string; function run(): Promise<unknown> { return ''; }",
      "import Promise = Custom.Promise; declare function load(): Promise<unknown>;",
    ],
    invalid: [
      { code: "function run(): unknown { return value; }", errors: 1 },
      { code: "async function run(): Promise<unknown> { return value; }", errors: 1 },
      { code: "type Result = unknown; declare function run(): Result;", errors: 1 },
      { code: "interface Service { run(): PromiseLike<unknown>; }", errors: 1 },
    ],
  },
  "no-unknown-type-aliases": {
    valid: [
      "type User = { value: unknown };",
      "type Values = unknown[];",
      "type Loop = Loop | null;",
      "type Hidden<T = unknown> = T; type Value = Hidden;",
    ],
    invalid: [
      { code: "type Raw = unknown;", errors: 1 },
      { code: "type A = unknown; type B = A;", errors: 2 },
      { code: "type B = A; type A = unknown;", errors: 2 },
      { code: "type Raw = unknown | string;", errors: 1 },
    ],
  },
  "no-unsafe-dictionary-type": {
    valid: [
      "type Users = Record<string, User>;",
      "type User = { value: unknown };",
      "type Data = Record<'value', unknown>;",
      "type Data = { [K in 'value']: unknown };",
      "type Data = { [K in string as 'value']: unknown };",
      "function run<T extends Record<string, unknown>>(value: T) {}",
      "type Record<K, V> = { value: string }; type Data = Record<string, unknown>;",
    ],
    invalid: [
      { code: "type Data = Record<string, unknown>;", errors: 1 },
      { code: "type Data = Record<string, any>;", errors: 1 },
      { code: "interface Data { [key: string]: {}; }", errors: 1 },
      { code: "type Raw = unknown; type Data = Record<string, Raw>;", errors: 1 },
      { code: "type Data = { [K in string]: unknown };", errors: 1 },
      { code: "type Data = { [K in 'value' as string]: unknown };", errors: 1 },
    ],
  },
  "no-trivial-type-aliases": {
    valid: [
      "type User = { name: string };",
      "type State = 'ready' | 'done';",
      "type Identity<T> = T;",
      "function run() { type Label = string; }",
    ],
    invalid: [
      { code: "type Label = string;", errors: 1 },
      { code: "export type Count = number;", errors: 1 },
      { code: "type First = string; type Second = First;", errors: 2 },
    ],
  },
  "no-known-value-widening": {
    valid: [
      "function run(input: unknown) { const value: unknown = input; }",
      "const handlers = { start } satisfies Record<string, Handler>;",
      "const empty: Record<string, Handler> = {};",
      "const empty = {}; const alias = empty; const handlers: Record<string, Handler> = alias;",
      "const handlers: Record<'start', Handler> = { start };",
      "type User = { name: string }; const user: User = { name: 'Kim' };",
      "function accept(value: unknown) {} accept(1);",
      "declare const load: () => number; const value: unknown = load();",
      "const value: unknown = enabled ? 1 : 2;",
      "type Hidden<T> = T; const value: Hidden<unknown> = 1;",
      "type Result<T> = T extends string ? string : unknown; declare const input: Result<number>; const value: unknown = input;",
    ],
    invalid: [
      { code: "const value: unknown = 'ready';", errors: 1 },
      { code: "const known = 1; const value: unknown = known;", errors: 1 },
      { code: "declare const known: number; const value: unknown = known;", errors: 1 },
      { code: "type Broad = {}; const value: Broad = 1;", errors: 1 },
      { code: "let value: unknown; value = 1;", errors: 1 },
      { code: "function run(): unknown { return 1; }", errors: 1 },
      { code: "const run = (): object => ({ name: 'Kim' });", errors: 1 },
      { code: "const handlers: Record<string, Handler> = { start };", errors: 1 },
      {
        code: "const known = { start }; const handlers: Record<string, Handler> = known;",
        errors: 1,
      },
      { code: "const value: { name: string } = { name: 'Kim' };", errors: 1 },
      { code: "const value: unknown = new Date();", errors: 1 },
      { code: "const value: unknown = (1 as unknown)!;", errors: 1 },
    ],
  },
  "no-widen-then-assert": {
    valid: [
      "const value = load(); value as User;",
      "const value: unknown = load(); value as User;",
      "declare const raw: unknown; const value = raw as unknown; value as User;",
      "let value: unknown = 1; value = other; value as User;",
    ],
    invalid: [
      { code: "const value: unknown = 1; value as number;", errors: 1 },
      { code: "const value = { name: 'Kim' } as unknown; value as User;", errors: 1 },
      { code: "const value: unknown = 1; const alias = value; alias as number;", errors: 1 },
      { code: "const value = (1 as unknown)!; value as number;", errors: 1 },
      { code: "type Broad = {}; const value: Broad = 1; value as number;", errors: 1 },
    ],
  },
} satisfies Record<string, RuleTester.TestCases>)) {
  tester.run(name, plugin.rules[name]!, cases);
}
