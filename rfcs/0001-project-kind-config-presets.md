# RFC: Project-kind Configuration Presets

## Summary

Add `nodeConfig` and `libConfig` configuration presets to `@jong-kyung/vp-config`. Consumers select a preset and use Vite+'s `mergeConfig` to combine it with project-specific settings.

Both presets include the existing lint, formatting, and staged-check policy. The library preset also provides environment-neutral ESM packaging with an ES2022 target and TypeScript declarations. The package provides configuration objects rather than its own `defineConfig` function or merge implementation.

## Motivation

The package currently exports `lint`, `fmt`, and `staged` objects. Consumers assemble these sections in each project:

```ts
import { defineConfig } from "vite-plus";
import { lint, fmt, staged } from "@jong-kyung/vp-config";

export default defineConfig({ lint, fmt, staged });
```

Library projects also need packaging settings such as the output format, JavaScript target, and declaration generation. The current exports do not provide shared defaults for those settings.

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

### Explicit replacement

Vite's array merging appends values. Consumers who need replacement can construct the relevant section after merging:

```ts
import { mergeConfig } from "vite-plus";
import { libConfig } from "@jong-kyung/vp-config";

const config = mergeConfig(libConfig, {
  pack: {
    entry: ["src/index.ts"],
  },
});

export default {
  ...config,
  staged: {
    "*": ["vp lint", "vp fmt"],
  },
};
```

This replaces the staged configuration instead of retaining the preset's `vp check --fix` command alongside the new commands. The replacement changes the check policy, so the consumer must choose the commands it needs.

## Configuration

### Public exports

| Export       | Purpose                                                                                  |
| ------------ | ---------------------------------------------------------------------------------------- |
| `nodeConfig` | Shared lint, formatting, and staged-check settings for Node applications.                |
| `libConfig`  | The same shared settings with environment-neutral TypeScript library packaging defaults. |
| `lint`       | Existing lint policy for native Oxlint configuration composition.                        |
| `fmt`        | Existing formatter configuration.                                                        |
| `staged`     | Existing staged-check configuration.                                                     |

Keep `@jong-kyung/vp-config/plugin` as the plugin entry. Normal preset consumers do not need to register it themselves.

### Preset structure

Add the presets alongside the existing exports in `src/index.ts`:

```ts
import type { UserConfig } from "vite-plus";

// lint, fmt, and staged are the existing configuration exports.
export const nodeConfig = {
  lint: {
    extends: [lint],
  },
  fmt,
  staged,
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

| Preset value                    | Consumer value          | Merged value                              |
| ------------------------------- | ----------------------- | ----------------------------------------- |
| No `pack.entry`                 | `["src/index.ts"]`      | `["src/index.ts"]`                        |
| `pack.format: ["esm"]`          | `["cjs"]`               | `["esm", "cjs"]`                          |
| `pack.target: "es2022"`         | `"es2020"`              | `"es2020"`                                |
| `pack.target: "es2022"`         | `["es2020", "node20"]`  | `["es2022", "es2020", "node20"]`          |
| `staged["*"]: "vp check --fix"` | `"vp lint"`             | `"vp lint"`                               |
| `staged["*"]: "vp check --fix"` | `["vp lint", "vp fmt"]` | `["vp check --fix", "vp lint", "vp fmt"]` |

The package does not promise that every user setting replaces a default. Document native array behavior and show explicit replacement where needed.

The current formatter preset is empty, so it introduces no array collision. The library preset has no default entry points, so adding an entry array does not duplicate entries.

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

Directly merging the raw `lint` export with that override would concatenate the tuple and `"off"`. Keep the raw export for native Oxlint composition, and lead the README with the project presets for whole-config merging.

Additional consumer `lint.extends` entries append after the shared preset. Preserve automatic package-relative custom-plugin registration in the inherited configuration. The package does not normalize arbitrary rule maps from other user configurations.

### Existing policy

Preserve the native and custom rule settings, warning severities, SAFETY-comment requirements, and function-and-class scope of JSDoc enforcement. Keep the deliberately limited local type analysis.

Formatting continues to use Oxfmt defaults. Staged checks retain `{ "*": "vp check --fix" }`. Importing a preset does not install Git hooks. Consumers use Vite+'s hook setup when they want that integration.

## Decisions

### Preset objects instead of a configuration function

Provide `nodeConfig` and `libConfig` objects. Do not add a package-specific `defineConfig` or `createConfig` function.

A custom function could enforce replacement semantics and hide exceptional cases. It would also require the package to maintain those semantics, handle native input forms, and test another public API. Consumers can use the native merge function for the selected scope and perform explicit replacement when they need it.

### Explicit project selection

Consumers choose the preset through an import. Do not detect project kinds from dependencies, package metadata, workspace layout, or source files.

### Library packaging only

Share packaging defaults for environment-neutral TypeScript libraries. Leave Node application builds and execution commands to each application.

Do not add frontend framework presets, shared test or coverage policies, or common task aliases. Consumers can still provide native Vite+ settings for those areas.

### Keep the custom plugin in the package

The project presets reuse the existing plugin and lint policy. Splitting the plugin into another package would introduce a separate release boundary without reducing repeated project configuration.

## Implementation Architecture

### Preset exports

Extend `src/index.ts` with the two typed objects. Reuse the existing `lint`, `fmt`, and `staged` values. Do not add a merge utility, configuration factory, project detector, or runtime dependency.

Keep the package's root and plugin export paths. Existing consumers can continue importing the individual configuration objects.

### Documentation

Update the README to lead with Node application and library workflows. Document native array concatenation, explicit replacement, and lint inheritance next to the examples.

Retain documentation for individual settings and custom rules. Explain that consumers import `defineConfig` and `mergeConfig` from `vite-plus`, not from this package.

### Key files

| File                     | Change                                                                        |
| ------------------------ | ----------------------------------------------------------------------------- |
| `src/index.ts`           | Add `nodeConfig` and `libConfig` preset exports.                              |
| `tests/index.test.ts`    | Cover preset defaults, inherited lint shape, and native merge behavior.       |
| `tests/consumer.test.ts` | Verify packed-package imports, actual lint resolution, and library packaging. |
| `README.md`              | Document project presets and consumer-owned composition.                      |

The rule implementations and their regression tests require no policy changes.

## Comparison with Other Approaches

| Approach                                       | Trade-off                                                                                                                 |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Individual `lint`, `fmt`, and `staged` exports | Preserve explicit section-level composition, but consumers repeat the project assembly. Keep this API for existing users. |
| Package-specific configuration function        | Can define custom replacement behavior, but adds input handling and merge semantics to maintain.                          |
| Project presets with native `mergeConfig`      | Reuse shared settings without a new function API. Consumers own explicit replacement and native merge behavior.           |
| Automatic project detection                    | Reduces explicit choices but requires discovery rules and workspace behavior outside the selected scope.                  |

[liangmiQwQ/vp-config](https://github.com/liangmiQwQ/vp-config) provides broader, detection-driven configuration that includes packaging, testing, and tasks. [kazupon/vp-config](https://github.com/kazupon/vp-config) focuses on lint and formatting builders. This proposal shares project-level defaults while leaving composition to Vite+.

## Tests

### Configuration tests

- The `nodeConfig` preset includes inherited lint, formatting, and staged settings, with no packaging defaults.
- The `libConfig` preset includes the specified platform, module format, syntax target, declaration generation, and exports settings.
- Merging an entry array preserves it because the preset has no default entries.
- Format, target, and staged-command arrays follow native concatenation. Explicit object replacement produces the consumer's requested values.
- A root rule override leaves the inherited tuple intact. Additional lint extensions follow the shared preset.
- Composing configurations does not mutate the exported presets or the input configurations.
- Existing individual exports and plugin registration remain available.

### Consumer tests

Build and pack the package, install its tarball into a separate consumer project, and verify:

1. The consumer can import the project presets and existing exports.
2. Native and custom lint rules run through the inherited configuration without manual plugin registration.
3. Disabling an option-bearing rule through a root override works during actual lint execution.
4. A library fixture builds to ESM and generates declarations without changing its package manifest under the default settings.
5. The documented native callback pattern loads through Vite+.

Run `vp check`, `vp test`, and `vp run build` for the implementation. Merge-shape probes alone do not establish actual lint resolution, plugin loading, or the packed-package contract.
