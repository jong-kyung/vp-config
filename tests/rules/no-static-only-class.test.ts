import type { RuleTester } from "vite-plus/lint/plugins-dev";
import plugin from "../../src/plugin.ts";
import { tester } from "../helpers/rule-tester.ts";

const cases = {
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
} satisfies RuleTester.TestCases;

tester.run("no-static-only-class", plugin.rules["no-static-only-class"]!, cases);
