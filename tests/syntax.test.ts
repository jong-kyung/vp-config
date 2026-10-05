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
      "const x = (1 as const) as const;",
      "const x = (1 as const)! as const;",
      "const x = ((1 as const) satisfies number) as const;",
      "wrap(value as unknown) as User;",
      "(value as unknown)?.field as User;",
      "(value as unknown).field as User;",
    ],
    invalid: [
      { code: "const x = value as unknown as User;", errors: 1 },
      { code: "const x = ((value as object)) as User;", errors: 1 },
      { code: "const x = <User><unknown>value;", errors: 1 },
      { code: "(value as unknown)! as User;", errors: 1 },
      { code: "((value as unknown) satisfies unknown) as User;", errors: 1 },
      { code: "(value as unknown as object)! as User;", errors: 1 },
      { code: "((value as unknown)! as object)! as User;", errors: 1 },
      { code: "(<unknown>value)! as User;", errors: 1 },
      { code: "(value?.field as unknown)! as User;", errors: 1 },
      { code: "(value as const)! as User;", errors: 1 },
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
    valid: [
      "fn.call(receiver, value);",
      "function run(Reflect) { Reflect.apply(fn, ctx, []); }",
      "var api = Reflect; var api = customApi; api.apply(fn, ctx, []);",
    ],
    invalid: [
      { code: "Reflect.apply(fn, ctx, []);", errors: 1 },
      { code: "const invoke = Reflect.apply; invoke(fn, ctx, []);", errors: 1 },
      { code: "const { apply: invoke } = Reflect; invoke(fn, ctx, []);", errors: 1 },
      { code: "const { apply: invoke = fallback } = Reflect; invoke(fn, ctx, []);", errors: 1 },
    ],
  },
  "no-reflect-get": {
    valid: [
      "const x = object.value;",
      "const Reflect = custom; Reflect.get(x, key);",
      "var api = Reflect; var api = customApi; api.get(value, key);",
      "var api = customApi; var api = Reflect; api.get(value, key);",
      "var { get } = Reflect; var { get } = customApi; get(value, key);",
      "let { get: read = fallback } = Reflect; read = customApi.get; read(value, key);",
      "var { get: read = fallback } = Reflect; var { get: read = fallback } = customApi; read(value, key);",
      "function run(Reflect) { const { get: read = fallback } = Reflect; read(value, key); }",
      "const { get: read = Reflect.get } = customApi; read(value, key);",
    ],
    invalid: [
      { code: "Reflect.get(object, key);", errors: 1 },
      { code: "globalThis.Reflect['get'](object, key);", errors: 1 },
      { code: "const reflect = Reflect; reflect.get(object, key);", errors: 1 },
      { code: "var api; var api = Reflect; api.get(value, key);", errors: 1 },
      { code: "var api = Reflect; var api; api.get(value, key);", errors: 1 },
      { code: "const { get: read = fallback } = Reflect; read(value, key);", errors: 1 },
      { code: "const { get = fallback } = Reflect; get(value, key);", errors: 1 },
      { code: "const { ['get']: read = fallback } = Reflect; read(value, key);", errors: 1 },
    ],
  },
  "no-module-mocking": {
    valid: [
      "vi.fn();",
      "vi.spyOn(target, 'run');",
      "function test(vi) { vi.mock('x'); }",
      "var api = vi; var api = service; api.mock('x');",
    ],
    invalid: [
      { code: "vi.mock('./service');", errors: 1 },
      { code: "import { vi } from 'vite-plus/test'; vi.mock('./service');", errors: 1 },
      { code: "import { vitest as v } from 'vitest'; v.mock('./service');", errors: 1 },
      { code: "jest.unstable_mockModule('./service', factory);", errors: 1 },
      { code: "import { vi as v } from 'vitest'; v.doMock('./service');", errors: 1 },
      { code: "const { mock: replace } = vi; replace('./service');", errors: 1 },
      { code: "import * as tests from 'vitest'; tests.vi.mock('./service');", errors: 1 },
      {
        code: "import { vi } from 'vitest'; const { mock = fallback } = vi; mock('x');",
        errors: 1,
      },
      { code: "const { mock: replace = fallback } = jest; replace('x');", errors: 1 },
    ],
  },
  "no-runtime-typeof": {
    valid: [
      "type T = typeof value;",
      "if (typeof window !== 'undefined') {}",
      {
        code: "function isText(value: unknown): value is string { return typeof value === 'string'; }",
        options: [{ allowInTypeGuards: true }],
      },
      {
        code: "function check(value: unknown): asserts value is string { if (typeof value !== 'string') throw Error(); }",
        options: [{ allowInTypeGuards: true }],
      },
    ],
    invalid: [
      { code: "if (typeof value === 'string') {}", errors: 1 },
      { code: "const kind = typeof value;", errors: 1 },
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
      "class User { @decorate static create() {} }",
    ],
    invalid: [
      { code: "class Utils { static run() {} }", errors: 1 },
      { code: "const Utils = class { static value = 1; };", errors: 1 },
      { code: "class Utils { constructor() {} static run() {} }", errors: 1 },
    ],
  },
  "no-array-filter-map": {
    valid: [
      "const values = list.values().filter(test).map(convert);",
      "const values = unknownFactory().filter(test).map(convert);",
      "type Array<T> = IteratorObject<T>; function run(values: Array<number>) { return values.filter(test).map(convert); }",
      "function run(Array) { return Array.from(values).filter(test).map(convert); }",
      "function run(Array) { return Array(1, 2).filter(test).map(convert); }",
      "const Array = custom; Array(1, 2).filter(test).map(convert);",
      "var values = []; var values = iterator; values.filter(test).map(convert);",
      "var values = iterator; var values = []; values.filter(test).map(convert);",
      "var values: number[] = []; var values = iterator; values.filter(test).map(convert);",
      "var A = Array; var A = custom; A().filter(test).map(convert);",
      "const values = list.filter(test);",
      "let values = []; values = iterator; values.filter(test).map(convert);",
      "function run({ values }) { return values.filter(test).map(convert); }",
      "function run({ [key]: values }: { values: number[] }) { return values.filter(test).map(convert); }",
      "function run({ values }: { values: IteratorObject<number> }) { return values.filter(test).map(convert); }",
      "function run({ nested: { values } }: { nested: { values: IteratorObject<number> }; values: number[] }) { return values.filter(test).map(convert); }",
      "function run({ values }: { values: number[] }) { values = other; return values.filter(test).map(convert); }",
      "function run([values]: [IteratorObject<number>]) { return values.filter(test).map(convert); }",
      "function run([values]: [...IteratorObject<number>[], number[]]) { return values.filter(test).map(convert); }",
      "function run({ ...values }: { value: number[] }) { return values.filter(test).map(convert); }",
      "type Array<T> = IteratorObject<T>; function run({ values }: { values: Array<number> }) { return values.filter(test).map(convert); }",
      "type Values = number[]; function outer() { type Values = IteratorObject<number>; function run(values: Values) { return values.filter(test).map(convert); } }",
      "type Values = Values; function run(values: Values) { return values.filter(test).map(convert); }",
      "type A = B; type B = A; function run(values: A) { return values.filter(test).map(convert); }",
      "type Props<T> = { values: T }; function run({ values }: Props<IteratorObject<number>>) { return values.filter(test).map(convert); }",
      "const C = class Array<T> { run(values: Array<number>) { return values.filter(test).map(convert); } };",
      "import type { Values } from './external'; function run(values: Values) { return values.filter(test).map(convert); }",
      "import Array = Custom.Array; function run(values: Array<number>) { return values.filter(test).map(convert); }",
      "function run<Array>(values: Array) { return values.filter(test).map(convert); }",
      "type Readonly<T> = IteratorObject<number>; function run(values: Readonly<number[]>) { return values.filter(test).map(convert); }",
      "import type { Readonly } from './custom'; function run(values: Readonly<number[]>) { return values.filter(test).map(convert); }",
      "function run<Readonly>(values: Readonly) { return values.filter(test).map(convert); }",
      "type Values = Readonly<Values>; function run(values: Values) { return values.filter(test).map(convert); }",
      "type Loop<T = Readonly<T>> = T; function run(values: Loop) { return values.filter(test).map(convert); }",
      "type Loop<T> = Readonly<Loop<T>>; function run(values: Loop<number[]>) { return values.filter(test).map(convert); }",
      "function run(values: Readonly<{ filter: Function; map: Function }>) { return values.filter(test).map(convert); }",
      "type Identity<Array> = Array; function run(values: Identity<IteratorObject<number>>) { return values.filter(test).map(convert); }",
      "type Values<T> = T; function run<T>(values: Values<T>) { return values.filter(test).map(convert); }",
      "type Values = number[]; function run<Values>(values: Values) { return values.filter(test).map(convert); }",
      "type Values = number[] | IteratorObject<number>; function run(values: Values) { return values.filter(test).map(convert); }",
      "type Values = number[]; let values: Values = []; values = other; values.filter(test).map(convert);",
    ],
    invalid: [
      { code: "const values = [1, 2].filter(test).map(convert);", errors: 1 },
      {
        code: "function run({ values }: { values: number[] }) { return values.filter(test).map(convert); }",
        errors: 1,
      },
      {
        code: "function run({ values: items }: { values: number[] }) { return items.filter(test).map(convert); }",
        errors: 1,
      },
      {
        code: "function run({ values = [] }: { values?: number[] }) { return values.filter(test).map(convert); }",
        errors: 1,
      },
      {
        code: "function run({ values }: { values: number[] } = { values: [] }) { return values.filter(test).map(convert); }",
        errors: 1,
      },
      {
        code: "function run({ nested: { values } }: { nested: { values: readonly number[] } }) { return values.filter(test).map(convert); }",
        errors: 1,
      },
      {
        code: "function run({ ['values']: items }: { values: ReadonlyArray<number> }) { return items.filter(test).map(convert); }",
        errors: 1,
      },
      {
        code: "const { values }: { values: number[] } = data; values.filter(test).map(convert);",
        errors: 1,
      },
      {
        code: "function run([values]: [number[]]) { return values.filter(test).map(convert); }",
        errors: 1,
      },
      {
        code: "function run([, values]: readonly [string, values: number[]]) { return values.filter(test).map(convert); }",
        errors: 1,
      },
      {
        code: "function run([values]: number[][]) { return values.filter(test).map(convert); }",
        errors: 1,
      },
      {
        code: "function run([values]: ReadonlyArray<number[]>) { return values.filter(test).map(convert); }",
        errors: 1,
      },
      {
        code: "function run({ items: [values] }: { items: [number[]] }) { return values.filter(test).map(convert); }",
        errors: 1,
      },
      {
        code: "function run([, ...values]: number[]) { return values.filter(test).map(convert); }",
        errors: 1,
      },
      { code: "Array(1, 2).filter(test).map(convert);", errors: 1 },
      {
        code: "function run(values: Readonly<number[]>) { return values.filter(test).map(convert); }",
        errors: 1,
      },
      {
        code: "function run(values: Readonly<[number, number]>) { return values.filter(test).map(convert); }",
        errors: 1,
      },
      {
        code: "function run(values: Readonly<readonly number[]>) { return values.filter(test).map(convert); }",
        errors: 1,
      },
      {
        code: "function run(values: Readonly<ReadonlyArray<number>>) { return values.filter(test).map(convert); }",
        errors: 1,
      },
      {
        code: "type Values<T> = Readonly<T[]>; function run(values: Values<number>) { return values.filter(test).map(convert); }",
        errors: 1,
      },
      {
        code: "type Wrap<T> = Readonly<T>; function run(values: Wrap<Wrap<number[]>>) { return values.filter(test).map(convert); }",
        errors: 1,
      },
      {
        code: "type Wrap<T = number[]> = Readonly<T>; function run(values: Wrap) { return values.filter(test).map(convert); }",
        errors: 1,
      },
      {
        code: "function run([values]: Readonly<[number[]]>) { return values.filter(test).map(convert); }",
        errors: 1,
      },
      {
        code: "function run({ values }: Readonly<{ values: number[] }>) { return values.filter(test).map(convert); }",
        errors: 1,
      },
      {
        code: "type Values = number[]; function run(values: Values) { return values.filter(test).map(convert); }",
        errors: 1,
      },
      {
        code: "function run(values: Values) { return values.filter(test).map(convert); } type Values = number[];",
        errors: 1,
      },
      {
        code: "type Values<T> = T[]; function run(values: Values<number>) { return values.filter(test).map(convert); }",
        errors: 1,
      },
      {
        code: "type Identity<T> = T; type Values<T = number> = ReadonlyArray<T>; function run(values: Identity<Values>) { return values.filter(test).map(convert); }",
        errors: 1,
      },
      {
        code: "type Values = readonly [number, number]; function run(values: Values) { return values.filter(test).map(convert); }",
        errors: 1,
      },
      {
        code: "type Values = number[]; function run(values: Values) { type Values = IteratorObject<number>; return values.filter(test).map(convert); }",
        errors: 1,
      },
      {
        code: "type Values = readonly number[]; function run({ values }: { values: Values }) { return values.filter(test).map(convert); }",
        errors: 1,
      },
      {
        code: "type Props<T> = { values: T }; function run({ values }: Props<number[]>) { return values.filter(test).map(convert); }",
        errors: 1,
      },
      {
        code: "type Pair<T> = [T]; function run([values]: Pair<number[]>) { return values.filter(test).map(convert); }",
        errors: 1,
      },
      {
        code: "type Rows<T> = ReadonlyArray<T>; function run([values]: Rows<number[]>) { return values.filter(test).map(convert); }",
        errors: 1,
      },
      {
        code: "type Props<T> = { nested: [T] }; function run({ nested: [values] }: Props<number[]>) { return values.filter(test).map(convert); }",
        errors: 1,
      },
      {
        code: "type Array<T> = T[]; function run(values: Array<number>) { return values.filter(test).map(convert); }",
        errors: 1,
      },
      { code: "globalThis.Array(1, 2).filter(test).map(convert);", errors: 1 },
      {
        code: "const Array = custom; function run(values: Array<number>) { return values.filter(test).map(convert); }",
        errors: 1,
      },
      { code: "const A = Array; A(1, 2).filter(test).map(convert);", errors: 1 },
      {
        code: "type Values<T = number[]> = T; function run(values: Values) { return values.filter(test).map(convert); }",
        errors: 1,
      },
      {
        code: "type Values = readonly Values[]; function run(values: Values) { return values.filter(test).map(convert); }",
        errors: 1,
      },
      { code: "var values; var values = []; values.filter(test).map(convert);", errors: 1 },
      {
        code: "function run(values: number[]) { return values.map(convert).filter(test); }",
        errors: 1,
      },
      {
        code: "function run(values: readonly number[]) { return values.filter(test).map(convert); }",
        errors: 1,
      },
      { code: "const a = [1]; const b = a; b.filter(test).map(convert);", errors: 1 },
      { code: "const a: Array<number> = load(); a.slice().filter(test).map(convert);", errors: 1 },
    ],
  },
  "no-reduce-accumulator-copy": {
    valid: [
      "items.reduce((acc, item) => { acc.push(item); return acc; }, []);",
      "items.reduce((acc, item) => Object.assign(acc, item), {});",
      "items.reduce((acc, item) => Object.assign(acc as Result, item), {});",
      "items.reduce((acc, item) => Object.assign(target as Result, acc, item), {});",
      "function run(Object) { return items.reduce((acc, item) => Object.assign({} as Result, acc, item), {}); }",
      "items.reduce((acc, item) => Object.assign({} as Result, item), {});",
      "items.reduce((acc, item) => item.slice(), []);",
      "items.reduce((acc, item) => acc.concat(item), '');",
      "function run(Array) { return items.reduce((acc, item) => acc.concat(item), Array()); }",
      "items.reduce((acc, item) => { var copy = acc; var copy = []; return copy.slice(); }, []);",
      "items.reduce(wrap((acc, item) => acc.concat(item)), []);",
      "items.reduce((acc, item) => { function inner(acc) { return acc.concat(item); } return acc; }, []);",
      "items.reduce(((acc, item) => acc.concat(item)) as Reducer, '');",
      "items.reduce((acc, item) => acc.map(normalize), custom);",
      "items.reduce((acc, item) => item.map(normalize), []);",
      "items.reduce((acc, item) => { function inner(acc) { return acc.map(normalize); } return acc; }, []);",
      "items.reduce((acc, item) => { let alias = acc; alias = other; return alias.map(normalize); }, []);",
    ],
    invalid: [
      { code: "items.reduce((acc, item) => acc.concat(item), []);", errors: 1 },
      ...["map(normalize)", "filter(test)", "flat()", "flatMap(normalize)"].flatMap((method) => [
        { code: `items.reduce((acc, item) => acc.${method}, []);`, errors: 1 },
        { code: `items.reduce((acc, item) => acc.${method}.concat(item), []);`, errors: 1 },
      ]),
      {
        code: "items.reduceRight((acc, item) => { const alias = acc; return alias.map(normalize); }, []);",
        errors: 1,
      },
      {
        code: "function run({ values }: { values: number[] }) { return items.reduce((acc, item) => acc.concat(item), values); }",
        errors: 1,
      },
      { code: "items.reduce((acc, item) => acc.concat(item), Array());", errors: 1 },
      {
        code: "type Values = number[]; function run(values: Values) { return items.reduce((acc, item) => acc.concat(item), values); }",
        errors: 1,
      },
      {
        code: "type Values = number[]; items.reduce((acc: Values, item) => acc.map(normalize));",
        errors: 1,
      },
      { code: "const A = Array; items.reduce((acc, item) => acc.slice(), A());", errors: 1 },
      { code: "items.reduce((acc, item) => Object.assign({}, acc, item), {});", errors: 1 },
      {
        code: "items.reduce((acc, item) => Object.assign({} as Result, acc, item), {});",
        errors: 1,
      },
      {
        code: "items.reduce((acc, item) => Object.assign({} satisfies Result, acc, item), {});",
        errors: 1,
      },
      { code: "items.reduce((acc, item) => Object.assign(({})!, acc, item), {});", errors: 1 },
      { code: "items.reduce((acc, item) => Object.assign(<Result>{}, acc, item), {});", errors: 1 },
      {
        code: "const assign = Object.assign; items.reduceRight((acc, item) => assign(({ value: item } as Result)!, acc), {});",
        errors: 1,
      },
      {
        code: "function run(values: Readonly<number[]>) { return items.reduce((acc, item) => acc.concat(item), values); }",
        errors: 1,
      },
      { code: "items.reduce((acc, item) => Array.from(acc), []);", errors: 1 },
      { code: "items.reduce(((acc, item) => acc.concat(item)) as Reducer, []);", errors: 1 },
      { code: "items.reduce(((acc, item) => acc.concat(item)) satisfies Reducer, []);", errors: 1 },
      { code: "items.reduce(((acc, item) => acc.concat(item))!, []);", errors: 1 },
      { code: "items.reduce(<Reducer>((acc, item) => acc.concat(item)), []);", errors: 1 },
      { code: "items.reduce((((acc, item) => acc.concat(item)) as Reducer)!, []);", errors: 1 },
      {
        code: "items.reduce((acc, item) => { const alias = acc; return alias.slice(); }, []);",
        errors: 1,
      },
    ],
  },
} satisfies Record<string, RuleTester.TestCases>)) {
  tester.run(name, plugin.rules[name]!, cases);
}
