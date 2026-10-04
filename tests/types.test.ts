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
      "function run(value: User) {}",
      "type Input = object; function outer() { type Input = string; function run(value: Input) {} }",
      "type Loop = Loop; function run(value: Loop) {}",
      "function outer() { function run(value: Input) {} type Input = string; } type Input = object;",
    ],
    invalid: [
      { code: "function run(value: object) {}", errors: 1 },
      { code: "const run = (value: object | null) => {};", errors: 1 },
      { code: "type Box<T> = T; function run(value: Box<object>) {}", errors: 1 },
      { code: "type Callback = (value: object) => void;", errors: 1 },
      { code: "class C { constructor(public value: object) {} }", errors: 1 },
      { code: "function run(value: Input) {} type Input = object;", errors: 1 },
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
      { code: "const run = function(input: unknown) {};", errors: 1 },
      { code: "const run = (input: unknown) => {};", errors: 1 },
      { code: "declare function run(input: unknown): void;", errors: 1 },
      { code: "declare class Service { run(input: unknown): void; }", errors: 1 },
      { code: "type Callback = (input: unknown) => void;", errors: 1 },
      { code: "type Factory = new(input: unknown) => Service;", errors: 1 },
      { code: "interface Callback { (input: unknown): void; }", errors: 1 },
      { code: "interface Factory { new(input: unknown): Service; }", errors: 1 },
      { code: "declare function run(input: Input): void; type Input = unknown;", errors: 1 },
    ],
  },
  "no-unknown-returns": {
    valid: [
      "function run(): User { return user; }",
      "const run = () => value;",
      "type Promise<T> = string; function run(): Promise<unknown> { return ''; }",
      "const C = class Promise<T> { run(): Promise<unknown> { return this; } };",
      "const C = class PromiseLike<T> { run(): PromiseLike<unknown> { return this; } };",
    ],
    invalid: [
      { code: "function run(): unknown { return value; }", errors: 1 },
      { code: "async function run(): Promise<unknown> { return value; }", errors: 1 },
      { code: "type Box<T> = T; const run = (): PromiseLike<Box<unknown>> => value;", errors: 1 },
      { code: "interface Service { run(): unknown; }", errors: 1 },
      { code: "const run = function(): unknown { return null; };", errors: 1 },
      { code: "declare function run(): unknown;", errors: 1 },
      { code: "declare class Service { run(): unknown; }", errors: 1 },
      { code: "type Callback = () => unknown;", errors: 1 },
      { code: "type Factory = new() => unknown;", errors: 1 },
      { code: "interface Callback { (): unknown; }", errors: 1 },
      { code: "interface Factory { new(): unknown; }", errors: 1 },
      { code: "function run(): Result { return null; } type Result = unknown;", errors: 1 },
      {
        code: "const C = class Promise<T> { run(): Promise<unknown> { return this; } }; function outside(): Promise<unknown> { return load(); }",
        errors: 1,
      },
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
      { code: "type B = A; type A = unknown;", errors: 2 },
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
      "type Identity<T extends { nested: Record<string, unknown> }> = T;",
      "const C = class Record<K, V> { value: Record<string, unknown>; };",
      "type Data = Record<string, {} & { id: string }>;",
      "type Data = Record<string, {}[]>;",
      "type Data = Record<string, { value: {} } | null>;",
      "type Loop = Loop | null; type Data = Record<string, Loop>;",
    ],
    invalid: [
      { code: "type Data = Record<string, unknown>;", errors: 1 },
      { code: "type Data = Record<string, any>;", errors: 1 },
      { code: "type Data = Record<string, {} | null>;", errors: 1 },
      { code: "type Empty = {}; type Data = Record<string, Empty | null>;", errors: 1 },
      { code: "type Maybe<T> = T | null; type Data = Record<string, Maybe<{}>>;", errors: 1 },
      { code: "type Loop = Loop | {}; type Data = Record<string, Loop>;", errors: 1 },
      { code: "type Data = { [key: string]: {} | null };", errors: 1 },
      { code: "type Data = { [K in string]: {} | null };", errors: 1 },
      {
        code: "const C = (class Record<K, V> { value: Record<string, unknown>; }) as Record<string, unknown>;",
        errors: 1,
      },
      { code: "type Data = { [key: string]: object };", errors: 1 },
      { code: "interface Data { [key: string]: {}; }", errors: 1 },
      { code: "type Wide = unknown; type Data = Record<string, Wide>;", errors: 1 },
      { code: "type Data = { [K in string]: unknown };", errors: 1 },
      {
        code: "type Identity<T extends Record<string, unknown> = Record<string, unknown>> = T;",
        errors: 1,
      },
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
      { code: "type B = A; type A = number;", errors: 2 },
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
      "const handlers: { [K in 'start']: Handler } = { start };",
      "const handlers: { [K in string as 'start']: Handler } = { start };",
      "type Keys = 'start' | 'stop'; const handlers: { [K in Keys]: Handler } = { start, stop };",
      "const empty: { [K in string]: Handler } = {};",
      "function run<K extends string>() { const handlers: { [P in K]: Handler } = { start }; }",
      "declare function id<T>(x: T): T; declare const input: unknown; const value: unknown = id(input);",
      "declare function id<T>(x: T): T | null; declare const input: unknown; const value: unknown = id(input);",
      "type Result<T> = T; declare function id<T>(x: T): Result<T>; declare const input: unknown; const value: unknown = id(input);",
      "function run<T>(input: T | null) { const value: unknown = input; }",
      "type Loop = Loop | null; declare function load(): Loop; const value: unknown = load();",
      "declare const input: any; const value: unknown = input + 1;",
      "declare const input: unknown; const value: unknown = input && true;",
      "declare const input: unknown; const value: unknown = input || true;",
      "declare const input: unknown; const value: unknown = input ?? true;",
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
      { code: "accept(1); function accept(value: unknown) {}", errors: 1 },
      { code: "const handlers: { [K in string]: Handler } = { start };", errors: 1 },
      { code: "const handlers: { [K in number]: Handler } = { 0: start };", errors: 1 },
      { code: "const handlers: { [K in symbol]: Handler } = { [key]: start };", errors: 1 },
      { code: "const handlers: { [K in any]: Handler } = { start };", errors: 1 },
      { code: "const handlers: { [K in 'start' as string]: Handler } = { start };", errors: 1 },
      { code: "const handlers: { [K in string as K]: Handler } = { start };", errors: 1 },
      {
        code: "type Key = string; const handlers: { [K in Key]: Handler } = { start };",
        errors: 1,
      },
      {
        code: "type Dict<K extends string> = { [P in K]: Handler }; const handlers: Dict<string> = { start };",
        errors: 1,
      },
      {
        code: "type Rename<K> = K; const handlers: { [K in string as Rename<K>]: Handler } = { start };",
        errors: 1,
      },
      ...["===", "!==", "==", "!=", "<", "<=", ">", ">="].map((operator) => ({
        code: `declare const input: any; const value: unknown = input ${operator} 1;`,
        errors: 1,
      })),
      { code: "function run(input: object) { const value: unknown = 'x' in input; }", errors: 1 },
      {
        code: "function run(input: unknown) { const value: unknown = input instanceof Date; }",
        errors: 1,
      },
      {
        code: "declare function wrap<T>(x: T): T[]; declare const input: unknown; const value: unknown = wrap(input);",
        errors: 1,
      },
      {
        code: "declare function wrap<T>(x: T): { value: T }; declare const input: unknown; const value: unknown = wrap(input);",
        errors: 1,
      },
      {
        code: "declare function wrap<T>(x: T): Promise<T>; declare const input: unknown; const value: unknown = wrap(input);",
        errors: 1,
      },
      {
        code: "function outer<T>() { function inner() { interface T { id: string; } function get(): T { return { id: 'x' }; } const value: unknown = get(); } }",
        errors: 1,
      },
      {
        code: "function outer<T>() { function inner() { interface T { id: string; } const item: T = load(); const value: unknown = item; } }",
        errors: 1,
      },
    ],
  },
  "no-widen-then-assert": {
    valid: [
      "function run(input: unknown) { return input as User; }",
      "const value: User = load(); const alias = value; alias as User;",
      "let erased: unknown = 1; erased = input; erased as User;",
      "const value: unknown = [1]; value as const;",
      "declare function id<T>(x: T): T; declare const input: unknown; const value: unknown = id(input); value as User;",
      "declare function id<T>(x: T): T | null; declare const input: unknown; const value: unknown = id(input); value as User;",
    ],
    invalid: [
      {
        code: "const user: User = load(); const erased: unknown = user; const result = erased as Admin;",
        errors: 1,
      },
      { code: "const erased: unknown = 123; const alias = erased; alias as number;", errors: 1 },
      { code: "const erased: any = { name: 'Kim' }; erased as User;", errors: 1 },
      { code: "erased as number; const erased: unknown = 123;", errors: 1 },
      {
        code: "const value = { name: 'Kim' } as unknown; const result = value as User;",
        errors: 1,
      },
    ],
  },
} satisfies Record<string, RuleTester.TestCases>)) {
  tester.run(name, plugin.rules[name]!, cases);
}
