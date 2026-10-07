# RFC: Project-kind Configuration Presets

## Summary

Add `nodeConfig` and `libConfig` configuration presets to `@jong-kyung/vp-config`. Consumers select a preset and use Vite+'s `mergeConfig` to combine it with project-specific settings.

Both presets include the existing lint policy. The library preset also provides environment-neutral ESM packaging with an ES2022 target and TypeScript declarations. Formatting and staged checks remain consumer-owned settings. The package provides configuration objects rather than its own `defineConfig` function or merge implementation.

## Motivation

Consumers need a shared lint policy and library packaging defaults such as the output format, JavaScript target, and declaration generation. Project presets provide those defaults without separate section-level exports.

An empty formatting object adds nothing to Oxfmt's defaults. Staged commands are a project choice, so consumers should provide them rather than override a shared command.

The intended users are the author's Node applications and environment-neutral TypeScript libraries. The goal is to reduce configuration repeated across those projects while keeping project-specific settings visible in `vite.config.ts`.

The existing custom lint plugin remains part of the package. This proposal adds project-level configuration without changing rule behavior or attempting to reduce plugin maintenance costs.

## User Workflows

### Node application

Use the Node application preset without additional configuration:

```ts
import { nodeConfig } from "@jong-kyung/vp-config";

export default nodeConfig;
```

Add project-specific settings through the native merge function:

```ts
import { mergeConfig } from "vite-plus";
import { nodeConfig } from "@jong-kyung/vp-config";

export default mergeConfig(nodeConfig, {
  lint: {
    rules: {
      "jong-kyung/no-runtime-typeof": "off",
    },
  },
});
```

The Node preset does not prescribe an application build, packaging configuration, or execution command. Consumers retain control of those settings.

### TypeScript library

Select the library preset and specify the package's entry points:

```ts
import { mergeConfig } from "vite-plus";
import { libConfig } from "@jong-kyung/vp-config";

export default mergeConfig(libConfig, {
  pack: {
    entry: ["src/index.ts"],
  },
});
```

The preset supplies shared packaging defaults. Entry points remain project-specific, and the package adds no entry-point discovery.

### Environment-dependent configuration

Use Vite+'s native `defineConfig` for environment callbacks or asynchronous configuration. Call `mergeConfig` after producing a configuration object:

```ts
import { defineConfig, mergeConfig } from "vite-plus";
import { libConfig } from "@jong-kyung/vp-config";

export default defineConfig(({ mode }) =>
  mergeConfig(libConfig, {
    pack: {
      entry: ["src/index.ts"],
      sourcemap: mode !== "production",
    },
  }),
);
```

The package does not interpret callbacks or promises. `mergeConfig` merges configuration objects, while native `defineConfig` supports the surrounding configuration callback.

### Formatting and staged checks

Neither preset defines `fmt` or `staged`. Add these settings through native composition when the project needs them:

```ts
import { mergeConfig } from "vite-plus";
import { nodeConfig } from "@jong-kyung/vp-config";

export default mergeConfig(nodeConfig, {
  fmt: { singleQuote: true },
  staged: { "*": "vp check --fix" },
});
```

Oxfmt defaults apply without a `fmt` setting. Consumers must configure `staged` before using `vp staged`, which fails when that setting is missing.

### Explicit replacement

Vite's array merging appends values. Consumers who need replacement can construct the relevant section before merging other project settings:

```ts
import { mergeConfig } from "vite-plus";
import { libConfig } from "@jong-kyung/vp-config";

const config = {
  ...libConfig,
  pack: {
    ...libConfig.pack,
    platform: "node",
    format: ["cjs"],
  },
};

export default mergeConfig(config, {
  pack: {
    entry: ["src/index.ts"],
  },
});
```

This consumer opts into Node-targeted CommonJS output. Replacing `format` before merging the entry points avoids retaining ESM as an additional output format.

## Configuration

### Public exports

| Export       | Purpose                                                                                       |
| ------------ | --------------------------------------------------------------------------------------------- |
| `nodeConfig` | Shared lint settings for Node applications.                                                   |
| `libConfig`  | The same shared lint settings with environment-neutral TypeScript library packaging defaults. |

Keep `@jong-kyung/vp-config/plugin` as the plugin entry. Normal preset consumers do not need to register it themselves.

### Preset structure

Expose only the two project presets from `src/index.ts`:

```ts
import type { UserConfig } from "vite-plus";

// lint is the existing policy, kept internal to this module.
export const nodeConfig = {
  lint: {
    extends: [lint],
  },
} satisfies UserConfig;

export const libConfig = {
  ...nodeConfig,
  pack: {
    platform: "neutral",
    format: ["esm"],
    target: "es2022",
    dts: true,
    exports: false,
  },
} satisfies UserConfig;
```

Use `satisfies UserConfig` to check the objects against Vite+'s configuration type while preserving their concrete shapes for consumers.

Treat exported presets as shared values. Consumers compose new objects rather than mutating a preset or its nested settings. The package adds no runtime freezing or cloning API.

### Library packaging defaults

| Setting    | Default     | Reason                                                                                               |
| ---------- | ----------- | ---------------------------------------------------------------------------------------------------- |
| `platform` | `"neutral"` | Avoid Node-specific resolution defaults for libraries used in Node and browsers.                     |
| `format`   | `["esm"]`   | Produce one module format by default.                                                                |
| `target`   | `"es2022"`  | Keep the library's syntax target independent of the development toolchain's Node version.            |
| `dts`      | `true`      | Generate declarations without relying on existing package metadata or tsconfig declaration settings. |
| `exports`  | `false`     | Leave automatic package manifest updates disabled.                                                   |

Vite+ 1.0.0 bundles tsdown 0.23.0. In that version, tsdown defaults to the Node platform and can infer a target from `package.json`'s `engines.node` even when the platform is neutral. Specify both platform and target to avoid that coupling.

Environment-neutral packaging does not make Node-specific source code portable. The ES2022 target controls syntax transformation, not runtime API availability or polyfills. Library authors remain responsible for their supported environments.

Leave source maps, minification, dependency externalization, and declaration-generator selection to the installed toolchain's defaults. Consumers can configure these through native packaging options.

Consumers manage their package entry points in `package.json` or opt into native exports generation themselves. Setting `exports: false` disables that generation by default, but it does not prevent side effects from user-provided plugins or tasks.

## Behavior

### Native merge semantics

Use `mergeConfig` from `vite-plus` without wrapping or modifying its behavior. With the inspected Vite+ 1.0.0 implementation:

- Object fields merge recursively.
- Scalar overrides replace scalar defaults.
- When either value is an array, the values concatenate.
- Null and undefined overrides do not remove an existing setting.

Examples with the proposed defaults:

| Preset value            | Consumer value                   | Merged value                     |
| ----------------------- | -------------------------------- | -------------------------------- |
| No `pack.entry`         | `["src/index.ts"]`               | `["src/index.ts"]`               |
| `pack.format: ["esm"]`  | `["cjs"]`                        | `["esm", "cjs"]`                 |
| `pack.target: "es2022"` | `"es2020"`                       | `"es2020"`                       |
| `pack.target: "es2022"` | `["es2020", "node20"]`           | `["es2022", "es2020", "node20"]` |
| No `staged`             | `{ "*": ["vp lint", "vp fmt"] }` | `{ "*": ["vp lint", "vp fmt"] }` |

The package does not promise that every user setting replaces a default. Document native array behavior and show explicit replacement where needed.

Neither preset defines formatting or staged settings, so they introduce no array collisions in those sections. The library preset has no default entry points, so adding an entry array does not duplicate entries.

For multiple packaging configurations, consumers construct the resulting `pack` array themselves. The package does not distribute defaults across multiple builds. Directly merging the preset's pack object with an array can retain that object as an additional array item because native merging concatenates the values.

### Lint inheritance

Each project preset places the shared lint policy inside `lint.extends`. Consumer rules therefore occupy the root `lint.rules` object instead of merging into the shared rule map through Vite.

For example, the existing policy contains:

```json
{
  "jong-kyung/no-runtime-typeof": ["warn", { "allowInTypeGuards": true }]
}
```

Merging a root override of `"off"` into the project preset preserves that tuple in the inherited configuration and places `"off"` in the consumer's root rules. Oxlint then resolves the configuration using its native extension precedence.

Directly merging the shared rule map with that override would concatenate the tuple and `"off"`. Keep the policy internal and expose it through preset inheritance instead.

Additional consumer `lint.extends` entries append after the shared preset. Preserve automatic package-relative custom-plugin registration in the inherited configuration. The package does not normalize arbitrary rule maps from other user configurations.

### Existing policy

Preserve the native and custom rule settings, warning severities, SAFETY-comment requirements, and function-and-class scope of JSDoc enforcement. Keep the deliberately limited local type analysis.

Formatting uses Oxfmt defaults when the consumer does not configure it. The package supplies no staged-check policy. Importing a preset does not install Git hooks. Consumers configure their staged commands and use Vite+'s hook setup when they want that integration.

## Decisions

### Preset objects instead of a configuration function

Provide `nodeConfig` and `libConfig` objects. Do not add a package-specific `defineConfig` or `createConfig` function.

A custom function could enforce replacement semantics and hide exceptional cases. It would also require the package to maintain those semantics, handle native input forms, and test another public API. Consumers can use the native merge function for the selected scope and perform explicit replacement when they need it.

### Consumer-owned formatting and staged checks

Keep `lint` internal and remove the separate `fmt` and `staged` values. Do not include either section in the presets. Consumers can supply them through `mergeConfig` without inheriting a default staged command.

### Explicit project selection

Consumers choose the preset through an import. Do not detect project kinds from dependencies, package metadata, workspace layout, or source files.

### Library packaging only

Share packaging defaults for environment-neutral TypeScript libraries. Leave Node application builds and execution commands to each application.

Do not add frontend framework presets, shared test or coverage policies, or common task aliases. Consumers can still provide native Vite+ settings for those areas.

### Keep the custom plugin in the package

The project presets reuse the existing plugin and lint policy. Splitting the plugin into another package would introduce a separate release boundary without reducing repeated project configuration.

## Implementation Architecture

### Preset exports

Expose the two typed objects from `src/index.ts` and reuse the internal `lint` value. Remove the `fmt` and `staged` declarations. Do not add a merge utility, configuration factory, project detector, or runtime dependency.

Keep the package's root and plugin export paths. Removing the individual configuration exports is a breaking API change. Existing consumers must switch to a project preset and supply any formatting and staged settings they need.

### Documentation

Update the README to lead with Node application and library workflows. Document native array concatenation, explicit replacement, and lint inheritance next to the examples.

Document consumer-owned formatting and staged checks, and retain the custom-rule documentation. Explain that consumers import `defineConfig` and `mergeConfig` from `vite-plus`, not from this package.

### Key files

| File                     | Change                                                                                             |
| ------------------------ | -------------------------------------------------------------------------------------------------- |
| `src/index.ts`           | Export only `nodeConfig` and `libConfig`, with internal lint and no formatting or staged defaults. |
| `vite.config.ts`         | Use the project preset's lint policy and define this repository's own staged command.              |
| `tests/index.test.ts`    | Cover preset defaults, inherited lint shape, and native merge behavior.                            |
| `tests/consumer.test.ts` | Verify packed-package imports, actual lint resolution, and library packaging.                      |
| `README.md`              | Document project presets and consumer-owned composition.                                           |

The rule implementations and their regression tests require no policy changes.

## Comparison with Other Approaches

| Approach                                       | Trade-off                                                                                                            |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Individual `lint`, `fmt`, and `staged` exports | Add separate public values, including an empty formatter object and a staged policy consumers can define themselves. |
| Package-specific configuration function        | Can define custom replacement behavior, but adds input handling and merge semantics to maintain.                     |
| Project presets with native `mergeConfig`      | Reuse shared settings without a new function API. Consumers own explicit replacement and native merge behavior.      |
| Automatic project detection                    | Reduces explicit choices but requires discovery rules and workspace behavior outside the selected scope.             |

[liangmiQwQ/vp-config](https://github.com/liangmiQwQ/vp-config) provides broader, detection-driven configuration that includes packaging, testing, and tasks. [kazupon/vp-config](https://github.com/kazupon/vp-config) focuses on lint and formatting builders. This proposal shares project-level defaults while leaving composition to Vite+.

## Tests

### Configuration tests

- The `nodeConfig` preset includes only inherited lint. Neither preset defines formatting or staged settings.
- The `libConfig` preset includes the specified platform, module format, syntax target, declaration generation, and exports settings.
- Merging an entry array preserves it because the preset has no default entries.
- Format and target arrays follow native concatenation. Explicit object replacement produces the consumer's requested values.
- Consumer formatting and staged settings are preserved without additional preset values.
- A root rule override leaves the inherited tuple intact. Additional lint extensions follow the shared preset.
- Composing configurations does not mutate the exported presets or the input configurations.
- Only `nodeConfig` and `libConfig` are exported from the package root. The plugin entry and automatic registration remain available.

### Consumer tests

Build and pack the package, install its tarball into a separate consumer project, and verify:

1. The consumer can import exactly the two project presets from the package root and load the separate plugin entry.
2. Native and custom lint rules run through the inherited configuration without manual plugin registration.
3. Disabling an option-bearing rule through a root override works during actual lint execution.
4. A library fixture builds to ESM and generates declarations without changing its package manifest under the default settings.
5. The documented native callback pattern loads through Vite+.
6. Formatting converges without preset formatting settings. Staged checks require a consumer-provided policy and preserve partial staging and failure recovery.

Run `vp check`, `vp test`, and `vp run build` for the implementation. Merge-shape probes alone do not establish actual lint resolution, plugin loading, or the packed-package contract.
