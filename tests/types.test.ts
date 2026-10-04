import { describe, it } from "vite-plus/test";
import { RuleTester } from "vite-plus/lint/plugins-dev";
import { typeRules } from "../src/rules/types.ts";

RuleTester.describe = describe;
RuleTester.it = it;

const tester = new RuleTester({ languageOptions: { parserOptions: { lang: "ts" } } });

const rules = new Map(Object.entries(typeRules));

for (const [name, cases] of Object.entries({
  "no-object-parameters": {
    valid: [
      "function run(value: { name: string }) {}",
      "function run(value: User) {}",
      "type Input = object; function outer() { type Input = string; function run(value: Input) {} }",
      "type Loop = Loop; function run(value: Loop) {}",
    ],
    invalid: [
      { code: "function run(value: object) {}", errors: 1 },
      { code: "const run = (value: object | null) => {};", errors: 1 },
      { code: "type Box<T> = T; function run(value: Box<object>) {}", errors: 1 },
      { code: "type Callback = (value: object) => void;", errors: 1 },
      { code: "class C { constructor(public value: object) {} }", errors: 1 },
    ],
  },
  "no-unknown-parameters": {
    valid: [
      "function run(cause: unknown) {}",
      "function isUser(input: unknown): input is User { return true; }",
      "function check(input: unknown): asserts input is User {}",
      "function run<T>(input: T) {}",
      "type Input = unknown; function run<Input>(input: Input) {}",
      "import type { Input } from './elsewhere'; function run(input: Input) {}",
    ],
    invalid: [
      { code: "function run(input: unknown) {}", errors: 1 },
      {
        code: "type Box<T> = T; type Value = Box<unknown>; function run(input: Value) {}",
        errors: 1,
      },
      { code: "type Box<T> = T; function run(input: Box<Box<unknown>>) {}", errors: 1 },
      {
        code: "function isUser(input: unknown, other: unknown): input is User { return true; }",
        errors: 1,
      },
      { code: "interface Service { run(input: unknown): void; }", errors: 1 },
    ],
  },
  "no-unknown-returns": {
    valid: [
      "function run(): User { return user; }",
      "const run = () => value;",
      "type Promise<T> = string; function run(): Promise<unknown> { return ''; }",
    ],
    invalid: [
      { code: "function run(): unknown { return value; }", errors: 1 },
      { code: "async function run(): Promise<unknown> { return value; }", errors: 1 },
      { code: "type Box<T> = T; const run = (): PromiseLike<Box<unknown>> => value;", errors: 1 },
      { code: "interface Service { run(): unknown; }", errors: 1 },
    ],
  },
  "no-unknown-type-aliases": {
    valid: [
      "type User = { name: string };",
      "type Values = unknown[];",
      "type Loop = Loop;",
      "type Left = Right; type Right = Left;",
      "type Loop<T> = Loop<T>; type Recursive = Loop<string>;",
      "type Loop<T = T> = T; type Recursive = Loop;",
      "type Identity<T> = T;",
      "type Identity<T> = T; type Value = Identity<string>;",
    ],
    invalid: [
      { code: "type Raw = unknown;", errors: 1 },
      { code: "type Identity<T = unknown> = T; type Raw = Identity;", errors: 1 },
      { code: "type A = unknown; type B = A;", errors: 2 },
      { code: "type Raw = unknown | string;", errors: 1 },
      { code: "type Identity<T> = T; type Raw = Identity<unknown>;", errors: 1 },
      { code: "function run() { type Raw = unknown; }", errors: 1 },
    ],
  },
  "no-unsafe-dictionary-type": {
    valid: [
      "type Users = Record<string, User>;",
      "function run<T extends Record<string, unknown>>(value: T) {}",
      "type Record<K, V> = { value: string }; type Value = Record<string, unknown>;",
      "type User = { value: unknown };",
    ],
    invalid: [
      { code: "type Data = Record<string, unknown>;", errors: 1 },
      { code: "type Data = Record<string, any>;", errors: 1 },
      { code: "type Data = { [key: string]: object };", errors: 1 },
      { code: "interface Data { [key: string]: {}; }", errors: 1 },
      { code: "type Wide = unknown; type Data = Record<string, Wide>;", errors: 1 },
      { code: "type Data = { [K in string]: unknown };", errors: 1 },
    ],
  },
  "no-trivial-type-aliases": {
    valid: [
      "type Raw = unknown;",
      "type Id = string & { readonly brand: unique symbol };",
      "type State = 'a' | 'b';",
      "type User = { name: string };",
      "type Identity<T> = T;",
      "function run() { type Local = string; }",
      "import type { User } from './user'; type Account = User;",
    ],
    invalid: [
      { code: "type Id = string;", errors: 1 },
      { code: "type A = number; type B = A;", errors: 2 },
      { code: "export type Flag = boolean;", errors: 1 },
    ],
  },
  "no-known-value-widening": {
    valid: [
      "function run(input: unknown) { const value: unknown = input; }",
      "const handlers = { start } satisfies Record<string, Handler>;",
      "const empty: Record<string, Handler> = {};",
      "const handlers: Record<'start', Handler> = { start };",
      "const user: User = { name: 'Kim' };",
    ],
    invalid: [
      { code: "const value: unknown = 'ready';", errors: 1 },
      { code: "let value: unknown; value = 123;", errors: 1 },
      { code: "const value: unknown = 123 as unknown;", errors: 1 },
      { code: "const handlers: Record<string, Handler> = { start };", errors: 1 },
      { code: "const value: { name: string } = { name: 'Kim' };", errors: 1 },
      {
        code: "function isUser(value: unknown): value is User { return true; } const user: User = load(); isUser(user);",
        errors: 1,
      },
      { code: "function run(): unknown { return 123; }", errors: 1 },
      { code: "const run = (): object => ({ name: 'Kim' });", errors: 1 },
    ],
  },
  "no-widen-then-assert": {
    valid: [
      "function run(input: unknown) { return input as User; }",
      "const value: User = load(); const alias = value; alias as User;",
      "let erased: unknown = 1; erased = input; erased as User;",
      "const value: unknown = [1]; value as const;",
    ],
    invalid: [
      {
        code: "const user: User = load(); const erased: unknown = user; const result = erased as Admin;",
        errors: 1,
      },
      { code: "const erased: unknown = 123; const alias = erased; alias as number;", errors: 1 },
      { code: "const erased: any = { name: 'Kim' }; erased as User;", errors: 1 },
      {
        code: "const value = { name: 'Kim' } as unknown; const result = value as User;",
        errors: 1,
      },
    ],
  },
} satisfies Record<string, RuleTester.TestCases>)) {
  tester.run(name, rules.get(name)!, cases);
}
