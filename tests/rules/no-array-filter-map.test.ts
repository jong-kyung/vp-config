import type { RuleTester } from "vite-plus/lint/plugins-dev";
import plugin from "../../src/plugin.ts";
import { tester } from "../helpers/rule-tester.ts";

const cases = {
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
} satisfies RuleTester.TestCases;

tester.run("no-array-filter-map", plugin.rules["no-array-filter-map"]!, cases);
