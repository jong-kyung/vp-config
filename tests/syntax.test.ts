import { describe, it } from "vite-plus/test";
import { RuleTester } from "vite-plus/lint/plugins-dev";
import plugin from "../src/plugin.ts";

RuleTester.describe = describe;
RuleTester.it = it;

const tester = new RuleTester({ languageOptions: { parserOptions: { lang: "ts" } } });

for (const [name, cases] of Object.entries({
  "no-chained-type-assertions": {
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
  },
  "no-conditional-empty-object-spread": {
    valid: ["const x = { ...options };", "const x = { ...(ok ? left : right) };"],
    invalid: [
      { code: "const x = { ...(ok ? { value } : {}) };", errors: 1 },
      { code: "const x = { ...(ok ? {} : options) };", errors: 1 },
    ],
  },
  "no-reflect-apply": {
    valid: ["fn.call(receiver, value);", "function run(Reflect) { Reflect.apply(fn, ctx, []); }"],
    invalid: [
      { code: "Reflect.apply(fn, ctx, []);", errors: 1 },
      { code: "const invoke = Reflect.apply; invoke(fn, ctx, []);", errors: 1 },
    ],
  },
  "no-reflect-get": {
    valid: [
      "const x = object.value;",
      "const Reflect = custom; Reflect.get(x, key);",
      "const Reflect = custom; function run() { type Reflect = {}; Reflect.get(object, key); }",
      "const get = 'get'; Reflect[get](object, key);",
      "Reflect[`g${suffix}`](object, key);",
      "let read = Reflect.get; read = custom; read(object, key);",
      "var api = Reflect; var api = custom; api.get(object, key);",
    ],
    invalid: [
      { code: "Reflect.get(object, key);", errors: 1 },
      { code: "type Reflect = {}; Reflect.get(object, key);", errors: 1 },
      { code: "interface Reflect {} Reflect.get(object, key);", errors: 1 },
      { code: "function run<Reflect>() { Reflect.get(object, key); }", errors: 1 },
      {
        code: "const api = Reflect; function run() { type api = {}; api.get(object, key); }",
        errors: 1,
      },
      { code: "globalThis.Reflect['get'](object, key);", errors: 1 },
      { code: "Reflect[`get`](object, key);", errors: 1 },
      { code: "const reflect = Reflect; reflect.get(object, key);", errors: 1 },
      { code: "const { get: read = fallback } = Reflect; read(object, key);", errors: 1 },
    ],
  },
  "no-module-mocking": {
    valid: ["vi.fn();", "vi.spyOn(target, 'run');", "function test(vi) { vi.mock('x'); }"],
    invalid: [
      { code: "vi.mock('./service');", errors: 1 },
      { code: "type vi = {}; vi.mock('./service');", errors: 1 },
      { code: "import { vi as v } from 'vitest'; v.doMock('./service');", errors: 1 },
      { code: "jest.unstable_mockModule('./service', factory);", errors: 1 },
      { code: "const { mock: replace } = vi; replace('./service');", errors: 1 },
    ],
  },
  "no-runtime-typeof": {
    valid: [
      "type T = typeof value;",
      "if (typeof window !== 'undefined') {}",
      "if (typeof window !== `undefined`) {}",
      "if (`undefined` === typeof window) {}",
      {
        code: "function isText(value: unknown): value is string { return typeof value === 'string'; }",
        options: [{ allowInTypeGuards: true }],
      },
    ],
    invalid: [
      { code: "if (typeof value === 'string') {}", errors: 1 },
      { code: "if (typeof value === `string`) {}", errors: 1 },
      { code: "if (typeof window !== undefined) {}", errors: 1 },
      { code: "if (typeof window !== `un${part}`) {}", errors: 1 },
      {
        code: "function isText(value: unknown): value is string { return typeof value === 'string'; }",
        errors: 1,
      },
      {
        code: "function isText(value: unknown): value is string { const test = () => typeof value; return true; }",
        options: [{ allowInTypeGuards: true }],
        errors: 1,
      },
    ],
  },
  "no-static-only-class": {
    valid: [
      "class Empty {}",
      "class User { name = ''; static create() {} }",
      "class User extends Base { static create() {} }",
      "abstract class User { static create() {} }",
      "class User { static {} static create() {} }",
      "class User { constructor(value) {} static create() {} }",
      "@decorate class User { static create() {} }",
      "declare namespace SDK { class Helpers { static run(): void; } }",
      'declare module "sdk" { export class Helpers { static run(): void; } }',
      ...["types.d.ts", "types.d.mts", "types.d.cts"].map((filename) => ({
        filename,
        code: "export class Helpers { static run(): void; }",
      })),
      "class Base { protected constructor() {} static create() {} }",
      "class Base { protected static configure() {} }",
      "const Base = class { static run() {} protected static value = 1; };",
    ],
    invalid: [
      { code: "class Utils { static run() {} }", errors: 1 },
      { code: "class Utils { private static value = 1; public static run() {} }", errors: 1 },
      { code: "class Utils { private constructor() {} static run() {} }", errors: 1 },
      { code: "namespace SDK { export class Helpers { static run() {} } }", errors: 1 },
      { code: "const Utils = class { static value = 1; };", errors: 1 },
    ],
  },
  "no-array-filter-map": {
    valid: [
      "list.values().filter(test).map(convert);",
      "unknownFactory().filter(test).map(convert);",
      "function run(Array) { return Array.from(values).filter(test).map(convert); }",
      "type Array<T> = IteratorObject<T>; function run(values: Array<number>) { return values.filter(test).map(convert); }",
      "export default interface Array<T> extends IteratorObject<T> {} function run(values: Array<number>) { return values.filter(test).map(convert); }",
      "let values = []; values = other; values.filter(test).map(convert);",
      "function run<Array>(values: Array) { return values.filter(test).map(convert); }",
      "const values = other; const other = values; values.filter(test).map(convert);",
      "function run({ values }: { values: number[] }) { return values.filter(test).map(convert); }",
      "type Values<T> = T[]; function run(values: Values<number>) { return values.filter(test).map(convert); }",
      "function run(values: number[] | readonly number[]) { return values.filter(test).map(convert); }",
      "function run(values: Readonly<number[]>) { return values.filter(test).map(convert); }",
    ],
    invalid: [
      { code: "[1, 2].filter(test).map(convert);", errors: 1 },
      { code: "[1, 2].map(convert).filter(test);", errors: 1 },
      {
        code: "const values = [1, 2]; const alias = values; alias.filter(test).map(convert);",
        errors: 1,
      },
      {
        code: "function run(values: number[]) { return values.filter(test).map(convert); }",
        errors: 1,
      },
      {
        code: "function run(values: readonly number[]) { return values.filter(test).map(convert); }",
        errors: 1,
      },
      {
        code: "function run(values: [number, number]) { return values.filter(test).map(convert); }",
        errors: 1,
      },
      {
        code: "type Values = number[]; function run(values: Values) { return values.filter(test).map(convert); }",
        errors: 1,
      },
      {
        code: "function run(values: ReadonlyArray<number>) { return values.filter(test).map(convert); }",
        errors: 1,
      },
      { code: "Array(1, 2).filter(test).map(convert);", errors: 1 },
      { code: "Array.from(source).filter(test).map(convert);", errors: 1 },
      { code: "type Array = {}; Array.from(source).filter(test).map(convert);", errors: 1 },
      { code: "const values = [3, 1, 2]; values.sort().filter(test).map(convert);", errors: 1 },
      { code: "[1, 2][`filter`](test)[`map`](convert);", errors: 1 },
    ],
  },
  "no-reduce-accumulator-copy": {
    valid: [
      "items.reduce((acc, item) => { acc.push(item); return acc; }, []);",
      "items.reduce((acc, item) => Object.assign(acc, item), {});",
      "items.reduce((acc, item) => acc.sort(), []);",
      "items.reduce((acc, item) => item.slice(), []);",
      "items.reduce((acc, item) => acc.concat(item), '');",
      "items.reduce((acc, item) => { acc = item.bucket; return acc.concat(item); }, []);",
      "items.reduce((acc: Item[] = [], item) => { acc = item.bucket; return acc.concat(item); }, []);",
      "items.reduce((acc, item) => { acc = item.bucket; return Object.assign({}, acc); }, {});",
      "function run(Array) { return items.reduce((acc, item) => acc.concat(item), Array()); }",
      "function run(Object) { return items.reduce((acc, item) => Object.assign({}, acc, item), {}); }",
    ],
    invalid: [
      { code: "items.reduce((acc, item) => acc.concat(item), []);", errors: 1 },
      { code: "items.reduce((acc: Item[] = [], item) => acc.concat(item), []);", errors: 1 },
      { code: "items.reduce((acc = {}, item) => Object.assign({}, acc, item), {});", errors: 1 },
      { code: "items.reduce((acc, item) => acc.slice(), []);", errors: 1 },
      { code: "items.reduce((acc, item) => acc.map(convert), []);", errors: 1 },
      { code: "items.reduce((acc, item) => Object.assign({}, acc, item), {});", errors: 1 },
      {
        code: "items.reduce((acc, item) => Object.assign({} as Result, acc, item), {});",
        errors: 1,
      },
      { code: "items.reduce((acc, item) => Array.from(acc), []);", errors: 1 },
      { code: "items.reduce(((acc, item) => acc.concat(item)) as Reducer, []);", errors: 1 },
    ],
  },
} satisfies Record<string, RuleTester.TestCases>)) {
  tester.run(name, plugin.rules[name]!, cases);
}
