import type { RuleTester } from "vite-plus/lint/plugins-dev";
import plugin from "../../src/plugin.ts";
import { tester } from "../helpers/rule-tester.ts";

const cases = {
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
} satisfies RuleTester.TestCases;

tester.run("no-reflect-get", plugin.rules["no-reflect-get"]!, cases);
