# @jong-kyung/vp-config

Shared Vite+ lint presets for Node applications and TypeScript libraries.

## Install

In an existing Vite+ project:

```bash
vp add -D --save-exact @jong-kyung/vp-config vite-plus@1.0.0
```

## Use

### Node applications

In `vite.config.ts`:

```ts
import { nodeConfig } from "@jong-kyung/vp-config";

export default nodeConfig;
```

`nodeConfig` provides the shared lint policy without prescribing an application build or execution command. Keep a working `tsconfig.json`, because the preset enables type-aware linting and TypeScript checks.

### TypeScript libraries

```ts
import { mergeConfig } from "vite-plus";
import { libConfig } from "@jong-kyung/vp-config";

export default mergeConfig(libConfig, {
  pack: { entry: ["src/index.ts"] },
});
```

Run `vp pack` to build. `libConfig` adds environment-neutral ESM output targeting ES2022, with declaration files. It does not generate package exports, so define your public entry points in `package.json`. These defaults do not add polyfills or make Node-specific code portable.

### Checks and customization

```bash
vp check
vp check --fix
```

Use Vite+'s `mergeConfig` to add project settings or override rules:

```ts
import { mergeConfig } from "vite-plus";
import { nodeConfig } from "@jong-kyung/vp-config";

export default mergeConfig(nodeConfig, {
  lint: {
    rules: { "jong-kyung/no-runtime-typeof": "off" },
    overrides: [
      {
        files: ["**/*.test.ts"],
        rules: { "jong-kyung/no-module-mocking": "off" },
      },
    ],
  },
  fmt: { singleQuote: true },
  staged: { "*": "vp check --fix" },
});
```

Formatting and staged checks are consumer-owned. Without `fmt`, Oxfmt defaults apply. Configure `staged` before running `vp staged`. Run `vp config` to install commit hooks. Installing this package does not install hooks.

`mergeConfig` concatenates arrays. Adding `pack.format: ["cjs"]` to `libConfig` keeps ESM output too. To replace a value, override it in a copied preset before merging other settings. Do not mutate the imported presets.

## Custom lint rules

Both presets register the plugin automatically. Rule names use the `jong-kyung/` prefix. Errors fail checks. Warnings are nonblocking and may still offer fixes.

| Rule                                        | Default | Behavior                                                                                                                                                   |
| ------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `no-array-filter-map`                       | error   | Flags adjacent eager array filter and map passes when local syntax establishes an array.                                                                   |
| `no-reduce-accumulator-copy`                | error   | Flags copying inline reducer accumulators through array-copy methods, `Array.from`, or `Object.assign`. The native accumulation rule covers spread copies. |
| `no-chained-type-assertions`                | error   | Flags consecutive assertions, except chains consisting only of const assertions.                                                                           |
| `no-conditional-empty-object-spread`        | error   | Flags object spreads whose conditional expression has an empty-object branch.                                                                              |
| `no-object-parameters`                      | error   | Flags `object` input contracts, including local aliases and unions.                                                                                        |
| `no-reflect-apply`                          | error   | Flags global `Reflect.apply` calls, including local aliases.                                                                                               |
| `no-reflect-get`                            | error   | Flags global `Reflect.get` calls, including local aliases.                                                                                                 |
| `no-unknown-type-aliases`                   | error   | Flags aliases that resolve to `unknown` or unions containing it.                                                                                           |
| `no-widen-then-assert`                      | error   | Flags asserting a new contract after erasing known information through const bindings.                                                                     |
| `require-readable-spacing`                  | error   | Inserts blank lines between declaration groups, around multiline bindings, before control flow, and after blocks.                                          |
| `no-known-value-widening`                   | warn    | Warns about known local values flowing into explicit broad contracts. Empty dictionary accumulators and finite-key records remain valid.                   |
| `no-module-mocking`                         | warn    | Warns about `mock`, `doMock`, and `unstable_mockModule` calls through Jest, Vitest, and Vite+ test bindings.                                               |
| `no-runtime-typeof`                         | warn    | Warns about runtime representation checks outside explicit type predicates and assertion functions. Undefined existence probes remain valid.               |
| `no-unknown-parameters`                     | warn    | Warns about unknown input contracts, except `cause` and the exact subject of a type predicate.                                                             |
| `no-unknown-returns`                        | warn    | Warns about explicit unknown returns, including Promise and PromiseLike wrappers.                                                                          |
| `no-unsafe-dictionary-type`                 | warn    | Warns about dictionary values described as unknown, any, object, or an empty type literal. Generic constraints remain valid.                               |
| `require-safety-comment-for-type-assertion` | warn    | Requires a nonempty invariant explanation near a non-const assertion.                                                                                      |
| `no-static-only-class`                      | error   | Flags static-only classes while preserving meaningful inheritance, decorators, abstract classes, static blocks, and constructors.                          |
| `no-em-dash`                                | error   | Flags literal em-dash characters in parsed source, including strings. It does not rewrite string values.                                                   |
| `prefer-jsdoc`                              | warn    | Converts existing function and class comments to JSDoc. Preserves directives and does not require new documentation.                                       |
| `no-trivial-type-aliases`                   | warn    | Warns about top-level, nongeneric primitive aliases. Unknown aliases belong to the separate error rule.                                                    |

Only `require-readable-spacing` and `prefer-jsdoc` offer custom autofixes. Spacing fixes preserve attached comments, imports, and overload groups. JSDoc conversion includes methods and functions assigned to variables or properties. Other declaration comments need not use JSDoc.

For intentional exceptions, use an Oxlint suppression comment with a reason. For type assertions, a nearby `SAFETY:` comment explains the checked invariant. It is not a rule suppression. `as const` is exempt from the comment requirement.

See [CONTRIBUTING.md](CONTRIBUTING.md) for development and CI instructions. Licensed under [MIT](LICENSE).
