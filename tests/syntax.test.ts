import { describe, it } from "vite-plus/test";
import { RuleTester } from "vite-plus/lint/plugins-dev";
import { syntaxRules } from "../src/rules/syntax.ts";

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
    valid: ["fn.call(receiver, value);", "function run(Reflect) { Reflect.apply(fn, ctx, []); }"],
    invalid: [
      { code: "Reflect.apply(fn, ctx, []);", errors: 1 },
      { code: "const invoke = Reflect.apply; invoke(fn, ctx, []);", errors: 1 },
      { code: "const { apply: invoke } = Reflect; invoke(fn, ctx, []);", errors: 1 },
    ],
  },
  "no-reflect-get": {
    valid: ["const x = object.value;", "const Reflect = custom; Reflect.get(x, key);"],
    invalid: [
      { code: "Reflect.get(object, key);", errors: 1 },
      { code: "globalThis.Reflect['get'](object, key);", errors: 1 },
      { code: "const reflect = Reflect; reflect.get(object, key);", errors: 1 },
    ],
  },
  "no-module-mocking": {
    valid: ["vi.fn();", "vi.spyOn(target, 'run');", "function test(vi) { vi.mock('x'); }"],
    invalid: [
      { code: "vi.mock('./service');", errors: 1 },
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
      "const values = list.filter(test);",
      "let values = []; values = iterator; values.filter(test).map(convert);",
    ],
    invalid: [
      { code: "const values = [1, 2].filter(test).map(convert);", errors: 1 },
      {
        code: "function run(values: number[]) { return values.map(convert).filter(test); }",
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
    ],
    invalid: [
      { code: "items.reduce((acc, item) => acc.concat(item), []);", errors: 1 },
      { code: "items.reduce((acc, item) => Object.assign({}, acc, item), {});", errors: 1 },
      { code: "items.reduce((acc, item) => Array.from(acc), []);", errors: 1 },
      {
        code: "items.reduce((acc, item) => { const alias = acc; return alias.slice(); }, []);",
        errors: 1,
      },
    ],
  },
} satisfies Record<string, RuleTester.TestCases>)) {
  tester.run(name, syntaxRules[name]!, cases);
}
