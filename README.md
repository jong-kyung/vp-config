# @jong-kyung/vp-config

My shared lint, formatting, and staged-check policy for TypeScript libraries and Node tools using Vite+ 1.0.0. It exports plain `lint`, `fmt`, and `staged` objects. React presets are outside this release.

## Use

In an existing Vite+ project, install the package and its exact peer dependency:

```bash
vp add -D --save-exact @jong-kyung/vp-config vite-plus@1.0.0
```

Configure `vite.config.ts`:

```ts
import { defineConfig } from "vite-plus";
import { lint, fmt, staged } from "@jong-kyung/vp-config";

export default defineConfig({ lint, fmt, staged });
```

Run `vp check` to check formatting, lint, and types. Run `vp check --fix` to apply ordinary fixes. The configuration enables both `typeAware` and `typeCheck`, so keep a working `tsconfig.json` in the consuming project. Some native checks rely on strict null checking. This package does not change your TypeScript configuration.

`fmt` uses Oxfmt defaults. `staged` contains `{ "*": "vp check --fix" }`. Run `vp config` in your project if you want Vite+ to install commit hooks. Importing this package and installing its tarball do not install hooks.

Warnings remain nonblocking in commit checks and CI. They can still produce ordinary autofixes. In particular, `unicorn/no-useless-spread` remains a warning with its native ordinary fixes enabled. Review those changes because warning severity does not guarantee semantic safety. The staged command enables neither dangerous fixes nor suggestion fixes.

## Override the policy

Use Oxlint's native composition rather than a configuration factory:

```ts
import { defineConfig } from "vite-plus";
import { lint, fmt, staged } from "@jong-kyung/vp-config";

export default defineConfig({
  lint: {
    extends: [lint],
    rules: {
      "jong-kyung/no-unknown-parameters": "off",
    },
    overrides: [
      {
        files: ["**/*.test.ts"],
        rules: { "jong-kyung/no-module-mocking": "off" },
      },
    ],
  },
  fmt,
  staged,
});
```

Compose `fmt` and `staged` with ordinary object spread when needed. Keep the exported objects unchanged and place project-specific changes in your own objects.

For a local exception, use an Oxlint suppression comment with a reason. Assertion comments serve a different purpose: explain the checked invariant with a nearby `SAFETY:` comment. `as const` does not need that comment. You can configure alternative markers through `jong-kyung/require-safety-comment-for-type-assertion`.

## Policy

The preset enables 114 rules: 94 errors and 20 warnings. It uses 93 native rules and 21 independently implemented JavaScript rules. It also records 28 native rules as disabled. See [the native configuration](src/native.ts) and [preset exports](src/index.ts) for severities and options.

All seven native categories are disabled before the reviewed rule map is applied, which prevents unreviewed default rules from entering the preset. The native plugins are TypeScript, Oxc, and Unicorn. Consumers can add plugins or override rules through native configuration.

The custom namespace is `jong-kyung`. The plugin entry is `@jong-kyung/vp-config/plugin`; normal consumers only need the three configuration objects. The preset resolves the plugin relative to its installed package, not the consumer's working directory.

| Custom rule                                 | Behavior                                                                                                                                                      |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `no-array-filter-map`                       | Flags adjacent eager array filter and map passes when local syntax establishes an array.                                                                      |
| `no-reduce-accumulator-copy`                | Flags copying inline reducer accumulators through array-copy methods, `Array.from`, or `Object.assign`. The native accumulation rule covers spread copies.    |
| `no-chained-type-assertions`                | Flags consecutive assertions, with an exception for chains consisting only of const assertions.                                                               |
| `no-conditional-empty-object-spread`        | Flags object spreads whose conditional expression has an empty-object branch.                                                                                 |
| `no-object-parameters`                      | Flags `object` input contracts, including local aliases and unions.                                                                                           |
| `no-reflect-apply`                          | Flags calls to the global reflection API, including local aliases.                                                                                            |
| `no-reflect-get`                            | Flags calls to the global reflection API, including local aliases.                                                                                            |
| `no-unknown-type-aliases`                   | Flags aliases that resolve to `unknown` or unions containing it.                                                                                              |
| `no-widen-then-assert`                      | Flags asserting a new contract after erasing known information through const bindings.                                                                        |
| `require-readable-spacing`                  | Inserts blank lines between declaration groups, around multiline bindings, before control flow, and after blocks.                                             |
| `no-known-value-widening`                   | Warns about known local values flowing into explicit broad contracts. Empty dictionary accumulators and finite-key records remain valid.                      |
| `no-module-mocking`                         | Warns about `mock`, `doMock`, and `unstable_mockModule` calls through Jest, Vitest, and Vite+ test bindings.                                                  |
| `no-runtime-typeof`                         | Warns about runtime representation checks outside explicit type predicates and assertion functions. Undefined existence probes remain valid.                  |
| `no-unknown-parameters`                     | Warns about unknown input contracts, except `cause` and the exact subject of a type predicate.                                                                |
| `no-unknown-returns`                        | Warns about explicit unknown returns, including Promise and PromiseLike wrappers.                                                                             |
| `no-unsafe-dictionary-type`                 | Warns about dictionary values described as unknown, any, object, or an empty type literal. Generic constraints remain valid.                                  |
| `require-safety-comment-for-type-assertion` | Requires a nonempty invariant explanation near a non-const assertion.                                                                                         |
| `no-static-only-class`                      | Flags static-only classes while preserving meaningful inheritance, decorators, abstract classes, static blocks, and constructors.                             |
| `no-em-dash`                                | Flags literal em-dash characters anywhere in the parsed source, including strings. It does not rewrite string values.                                         |
| `prefer-jsdoc`                              | Converts existing attached declaration comments to JSDoc while preserving directives and avoiding unsafe comment text. It does not require new documentation. |
| `no-trivial-type-aliases`                   | Warns about top-level, nongeneric primitive aliases. Unknown aliases belong to the separate error rule.                                                       |

Only the custom spacing and JSDoc rules offer autofixes. Spacing fixes preserve attached comments, imports, and overload groups. JSDoc conversion excludes object-literal property comments.

### Analysis boundaries

The custom rules are syntax checks, not a partial TypeScript type checker. They inspect direct annotations, ordinary local type aliases, and explicit built-in forms such as `Promise<unknown>` and `Record<string, unknown>`. Name shadowing and alias cycles are handled. Known-value checks use literals, value creation, direct concrete annotations, and simple local value aliases.

Array checks recognize literals, direct array and tuple annotations, ordinary local aliases, and standard array-producing calls. Copy checks inspect inline reducer callbacks. Reflection and mocking checks follow lexical aliases and static property names, not runtime property mutations or cross-file exports.

Generic argument substitution and defaults, call-site parameter and return contracts, type projection through destructuring and tuple elements, array unions, utility-type evaluation such as `Readonly<T>`, expression-result inference, and control-flow analysis are deliberately out of scope. Unsupported forms are skipped rather than guessed. Missing coverage in these forms is not a bug to patch case by case. Expanding this scope requires an explicit support decision.

Reviews should prioritize incorrect diagnostics within the supported scope, unsafe autofixes, and broken configuration or packaging. License comments, suppression directives, and assertion SAFETY comments remain protected.

Rules inspect the whole selected file. Staging selects files rather than restricting diagnostics to changed lines. `no-em-dash` covers source accepted by the linter, not Markdown documents or arbitrary assets.

## Compatibility and updates

The package is ESM-only and requires Vite+ **1.0.0** as its only runtime peer. It imports plugin APIs through `vite-plus/lint/plugins`. It does not install or bundle external lint plugins.

The Node engine range follows Vite+: `^22.18.0 || ^24.11.0 || >=26.0.0`. Local verification used Node 24.21.0 on macOS. Other Node versions and operating systems have not completed a separate compatibility matrix.

The verified toolchain contains Oxlint 1.85.0, Oxfmt 0.70.0, and oxlint-tsgolint 7.0.2003. Vite+'s JavaScript plugin API is experimental. Review the rule inventory, selected options, fixes, and packed-consumer tests before widening the Vite+ peer range. Upstream policy changes do not enter this package through automatic plugin updates.

Vite+ 1.0.0 omits JavaScript rule settings from `vp lint --print-config`. Use that output to inspect native settings and plugin loading. The tests check custom settings and diagnostics separately.

## Development

```bash
vp install
vp check
vp test
vp run build
```

The tests build and pack the package, install its tarball into an external temporary project, and exercise configuration inheritance, warning and error exits, type-aware checks, formatter convergence, and partial staging. The consumer installation runs offline using dependencies populated by `vp install`. Git and the global `vp` command must be available.

To inspect a release artifact without publishing:

```bash
vp run build
vp pm pack --out /tmp/vp-config.tgz
```

Publishing, pushing, and creating a pull request are separate manual steps.

## License

MIT. The custom implementations use independently written code and regression cases. Behavioral references are anti-slop at `c44ef22ca116d0ba62a3ff663a0bd13a3f3fa40b` and eslint-plugin-slop at `98391afefc5000c0a40dfaf83c647dce479a80ee`.
