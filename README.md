# @jong-kyung/vp-config

Shared Vite+ 1.0.0 configuration for my Node applications and environment-neutral TypeScript libraries. Use `nodeConfig` or `libConfig` and compose project-specific settings with Vite+'s `mergeConfig`. React presets are outside this release.

## Use

In an existing Vite+ project, install the package and its exact peer dependency:

```bash
vp add -D --save-exact @jong-kyung/vp-config vite-plus@1.0.0
```

### Node applications

Configure `vite.config.ts`:

```ts
import { nodeConfig } from "@jong-kyung/vp-config";

export default nodeConfig;
```

The preset includes the shared lint policy. It does not prescribe an application build, packaging configuration, or execution command.

### TypeScript libraries

```ts
import { mergeConfig } from "vite-plus";
import { libConfig } from "@jong-kyung/vp-config";

export default mergeConfig(libConfig, {
  pack: {
    entry: ["src/index.ts"],
  },
});
```

Run `vp pack` to build the library. `libConfig` includes the same shared policy as `nodeConfig` and these packaging defaults:

```json
{
  "platform": "neutral",
  "format": ["esm"],
  "target": "es2022",
  "dts": true,
  "exports": false
}
```

Provide your own entry points. Manage public package entry points in `package.json`, or opt into native exports generation in your project. Other packaging options use the toolchain's defaults.

The neutral platform and ES2022 target do not make Node-specific code portable or add runtime polyfills. Library authors remain responsible for their supported environments. Shared test, coverage, and task policies are not included.

### Checks and hooks

Run `vp check` to check formatting, lint, and types. Run `vp check --fix` to apply ordinary fixes. The configuration enables both `typeAware` and `typeCheck`, so keep a working `tsconfig.json` in the consuming project. Some native checks rely on strict null checking. This package does not change your TypeScript configuration.

Neither preset defines `fmt` or `staged`. Oxfmt defaults apply when you do not configure formatting. Add your own settings as needed:

```ts
import { mergeConfig } from "vite-plus";
import { nodeConfig } from "@jong-kyung/vp-config";

export default mergeConfig(nodeConfig, {
  fmt: { singleQuote: true },
  staged: { "*": "vp check --fix" },
});
```

Configure `staged` before running `vp staged`, which fails without that setting. Run `vp config` in your project if you want Vite+ to install commit hooks. Importing this package and installing its tarball do not install hooks.

Warnings remain nonblocking in commit checks and CI. They can still produce ordinary autofixes. In particular, `unicorn/no-useless-spread` remains a warning with its native ordinary fixes enabled. Review those changes because warning severity does not guarantee semantic safety. The example staged command enables neither dangerous fixes nor suggestion fixes.

## Override the presets

Import `mergeConfig` from `vite-plus`, not from this package:

```ts
import { mergeConfig } from "vite-plus";
import { nodeConfig } from "@jong-kyung/vp-config";

export default mergeConfig(nodeConfig, {
  lint: {
    rules: {
      "jong-kyung/no-runtime-typeof": "off",
    },
    overrides: [
      {
        files: ["**/*.test.ts"],
        rules: { "jong-kyung/no-module-mocking": "off" },
      },
    ],
  },
});
```

The project presets inherit the shared lint policy through `lint.extends`. Root rule overrides therefore use Oxlint's native precedence without merging into the preset's rule-option arrays.

### Array merging and replacement

`mergeConfig` recursively merges objects and concatenates values when either side is an array. Adding `pack.format: ["cjs"]` to `libConfig` produces `["esm", "cjs"]`, not a replacement. Entry arrays do not duplicate preset entries because no default entries are supplied.

For replacement, construct the relevant section before merging other project settings. For example, a consumer that needs Node-targeted CommonJS output can replace the library format:

```ts
import { mergeConfig } from "vite-plus";
import { libConfig } from "@jong-kyung/vp-config";

const config = {
  ...libConfig,
  pack: { ...libConfig.pack, platform: "node", format: ["cjs"] },
};

export default mergeConfig(config, {
  pack: { entry: ["src/index.ts"] },
});
```

There are no preset formatting or staged values to concatenate with consumer settings. The package does not provide custom merge behavior or distribute library defaults across multiple pack configurations.

For environment callbacks or asynchronous setup, use `defineConfig` from `vite-plus` and call `mergeConfig` after producing your configuration object. Treat presets as shared values and compose new objects rather than mutating them.

For a local exception, use an Oxlint suppression comment with a reason. Assertion comments serve a different purpose: explain the checked invariant with a nearby `SAFETY:` comment. `as const` does not need that comment. You can configure alternative markers through `jong-kyung/require-safety-comment-for-type-assertion`.

## Policy

The preset enables 114 rules: 94 errors and 20 warnings. It uses 93 native rules and 21 independently implemented JavaScript rules. It also records 28 native rules as disabled. See [the native configuration](src/native.ts) and [preset exports](src/index.ts) for severities and options.

All seven native categories are disabled before the reviewed rule map is applied, which prevents unreviewed default rules from entering the preset. The native plugins are TypeScript, Oxc, and Unicorn. Consumers can add plugins or override rules through native configuration.

The custom namespace is `jong-kyung`. The plugin entry is `@jong-kyung/vp-config/plugin`; normal consumers only need a project preset. The preset resolves the plugin relative to its installed package, not the consumer's working directory.

| Custom rule                                 | Behavior                                                                                                                                                                              |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `no-array-filter-map`                       | Flags adjacent eager array filter and map passes when local syntax establishes an array.                                                                                              |
| `no-reduce-accumulator-copy`                | Flags copying inline reducer accumulators through array-copy methods, `Array.from`, or `Object.assign`. The native accumulation rule covers spread copies.                            |
| `no-chained-type-assertions`                | Flags consecutive assertions, with an exception for chains consisting only of const assertions.                                                                                       |
| `no-conditional-empty-object-spread`        | Flags object spreads whose conditional expression has an empty-object branch.                                                                                                         |
| `no-object-parameters`                      | Flags `object` input contracts, including local aliases and unions.                                                                                                                   |
| `no-reflect-apply`                          | Flags calls to the global reflection API, including local aliases.                                                                                                                    |
| `no-reflect-get`                            | Flags calls to the global reflection API, including local aliases.                                                                                                                    |
| `no-unknown-type-aliases`                   | Flags aliases that resolve to `unknown` or unions containing it.                                                                                                                      |
| `no-widen-then-assert`                      | Flags asserting a new contract after erasing known information through const bindings.                                                                                                |
| `require-readable-spacing`                  | Inserts blank lines between declaration groups, around multiline bindings, before control flow, and after blocks.                                                                     |
| `no-known-value-widening`                   | Warns about known local values flowing into explicit broad contracts. Empty dictionary accumulators and finite-key records remain valid.                                              |
| `no-module-mocking`                         | Warns about `mock`, `doMock`, and `unstable_mockModule` calls through Jest, Vitest, and Vite+ test bindings.                                                                          |
| `no-runtime-typeof`                         | Warns about runtime representation checks outside explicit type predicates and assertion functions. Undefined existence probes remain valid.                                          |
| `no-unknown-parameters`                     | Warns about unknown input contracts, except `cause` and the exact subject of a type predicate.                                                                                        |
| `no-unknown-returns`                        | Warns about explicit unknown returns, including Promise and PromiseLike wrappers.                                                                                                     |
| `no-unsafe-dictionary-type`                 | Warns about dictionary values described as unknown, any, object, or an empty type literal. Generic constraints remain valid.                                                          |
| `require-safety-comment-for-type-assertion` | Requires a nonempty invariant explanation near a non-const assertion.                                                                                                                 |
| `no-static-only-class`                      | Flags static-only classes while preserving meaningful inheritance, decorators, abstract classes, static blocks, and constructors.                                                     |
| `no-em-dash`                                | Flags literal em-dash characters anywhere in the parsed source, including strings. It does not rewrite string values.                                                                 |
| `prefer-jsdoc`                              | Converts existing function and class comments to JSDoc, including arrow functions, function expressions, and methods. It preserves directives and does not require new documentation. |
| `no-trivial-type-aliases`                   | Warns about top-level, nongeneric primitive aliases. Unknown aliases belong to the separate error rule.                                                                               |

Only the custom spacing and JSDoc rules offer autofixes. Spacing fixes preserve attached comments, imports, and overload groups. JSDoc conversion applies to function and class definitions, including those assigned to variables or properties. Other variables, types, interfaces, enums, and data properties allow both ordinary comments and JSDoc.

## Development

Use the Node version in `.node-version`, which also selects the CI runtime. The package's supported Node range matches Vite+.

```bash
vp install
vp check
vp run knip
vp run duplication --baseline-from-ref origin/main
vp test
vp run build
```

The tests build and pack the package, install its tarball into an external temporary project, and exercise configuration inheritance, warning and error exits, type-aware checks, formatter convergence, and partial staging. The consumer uses the same Node version and can download dependencies, so it does not require a warm cache. Its installation disables lifecycle scripts and permits a missing lockfile. Root CI installations use the frozen lockfile. Git and the global `vp` command must be available.

Knip checks unused files, exports, and dependencies. The duplication command checks `src` against the supplied Git ref, permits existing clones, and fails on new clones or an unavailable baseline. Tests are outside the duplication scope.

To inspect a release artifact without publishing:

```bash
vp run build
vp pm pack --out /tmp/vp-config.tgz
```

Publishing, pushing, and creating a pull request are separate manual steps.

## CI

Checks, Knip, and the full test suite run independently on Ubuntu for PRs, main pushes, manual runs, and Sundays at 02:00 UTC. The test suite includes the package build and installed-consumer checks. Duplication runs on PRs and main pushes, comparing against the PR base or the previous main commit. CI invokes the pinned jscpd CLI directly so failures propagate to the job.

The `autofix.ci` workflow runs only on PRs and leaves other checks running. Enable the [autofix.ci GitHub App](https://autofix.ci/setup) for this repository separately. The service receives changed file contents and uses its own App permissions to push automatic fix commits. Fork PRs require the author's permission for maintainer edits. Workflow runners use read-only repository permissions and do not retain checkout credentials.

Paths containing `.github` are checked by ordinary CI but excluded from automatic fixes because the service rejects patches containing those paths. There are no release or deployment workflows.

## License

MIT. The custom implementations use independently written code and regression cases. Behavioral references are anti-slop at `c44ef22ca116d0ba62a3ff663a0bd13a3f3fa40b` and eslint-plugin-slop at `98391afefc5000c0a40dfaf83c647dce479a80ee`.
