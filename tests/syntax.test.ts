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
    ],
    invalid: [
      { code: "const x = value as unknown as User;", errors: 1 },
      { code: "const x = ((value as object)) as User;", errors: 1 },
      { code: "const x = <User><unknown>value;", errors: 1 },
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
    ],
  },
  "no-reflect-get": {
    valid: [
      "const x = object.value;",
      "const Reflect = custom; Reflect.get(x, key);",
      "var api = Reflect; var api = customApi; api.get(value, key);",
      "var api = customApi; var api = Reflect; api.get(value, key);",
      "var { get } = Reflect; var { get } = customApi; get(value, key);",
    ],
    invalid: [
      { code: "Reflect.get(object, key);", errors: 1 },
      { code: "globalThis.Reflect['get'](object, key);", errors: 1 },
      { code: "const reflect = Reflect; reflect.get(object, key);", errors: 1 },
      { code: "var api; var api = Reflect; api.get(value, key);", errors: 1 },
      { code: "var api = Reflect; var api; api.get(value, key);", errors: 1 },
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
    ],
    invalid: [
      { code: "const values = [1, 2].filter(test).map(convert);", errors: 1 },
      { code: "Array(1, 2).filter(test).map(convert);", errors: 1 },
      { code: "globalThis.Array(1, 2).filter(test).map(convert);", errors: 1 },
      { code: "const A = Array; A(1, 2).filter(test).map(convert);", errors: 1 },
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
      "items.reduce((acc, item) => item.slice(), []);",
      "items.reduce((acc, item) => acc.concat(item), '');",
      "function run(Array) { return items.reduce((acc, item) => acc.concat(item), Array()); }",
      "items.reduce((acc, item) => { var copy = acc; var copy = []; return copy.slice(); }, []);",
    ],
    invalid: [
      { code: "items.reduce((acc, item) => acc.concat(item), []);", errors: 1 },
      { code: "items.reduce((acc, item) => acc.concat(item), Array());", errors: 1 },
      { code: "const A = Array; items.reduce((acc, item) => acc.slice(), A());", errors: 1 },
      { code: "items.reduce((acc, item) => Object.assign({}, acc, item), {});", errors: 1 },
      { code: "items.reduce((acc, item) => Array.from(acc), []);", errors: 1 },
      {
        code: "items.reduce((acc, item) => { const alias = acc; return alias.slice(); }, []);",
        errors: 1,
      },
    ],
  },
} satisfies Record<string, RuleTester.TestCases>)) {
  tester.run(name, plugin.rules[name]!, cases);
}
