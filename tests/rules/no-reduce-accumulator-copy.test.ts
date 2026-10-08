import type { RuleTester } from "vite-plus/lint/plugins-dev";
import plugin from "../../src/plugin.ts";
import { tester } from "../helpers/rule-tester.ts";

const cases = {
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
} satisfies RuleTester.TestCases;

tester.run("no-reduce-accumulator-copy", plugin.rules["no-reduce-accumulator-copy"]!, cases);
