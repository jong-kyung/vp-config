# Shared Vite+ configuration

## Approved contract

Publish `@jong-kyung/vp-config` as an ESM configuration package for personal TypeScript libraries and Node tools. The first release targets Vite+ 1.0.0. React presets, project generation, publishing automation, and support for other Vite+ versions are outside this implementation.

Export three plain objects: `lint`, `fmt`, and `staged`. Consumers compose lint with the native `extends`, `rules`, and `overrides` options. They compose the other objects with ordinary JavaScript. Do not add a configuration factory or a custom deep merge.

```ts
import { defineConfig } from "vite-plus";
import { lint, fmt, staged } from "@jong-kyung/vp-config";

export default defineConfig({ lint, fmt, staged });
```

The runtime contract requires only Vite+. Use its plugin and test APIs instead of installing Oxlint, ESLint, anti-slop, or eslint-plugin-slop. Development-only dependencies are permitted. Require the consumer's Vite+ as an exact peer dependency and use the same version during development.

## Rules and execution

The interview approved 114 active rules, consisting of 94 errors and 20 warnings. The 111 reviewed native defaults include 28 explicitly disabled rules. One additional accumulation rule and nine optional native rules are approved. Twenty-one custom rules need independent implementations. The complete decisions are in [rules.md](rules.md).

Use native rules from the bundled Oxlint. Implement custom rules from the agreed behavior, without copying upstream implementation code or embedding external plugins. Behavioral reference revisions are anti-slop `c44ef22ca116d0ba62a3ff663a0bd13a3f3fa40b` and eslint-plugin-slop `98391afefc5000c0a40dfaf83c647dce479a80ee`. Write our own regression examples and implementations. These references do not authorize automatic upstream updates.

Explicitly disable the known native rule categories before enabling the approved rules. Keep reviewed disabled rules explicit. Preserve the selected options and validate composition with a real consumer. New upstream rules should not silently enter this preset. Review inventory, options, fixes, and consumer compatibility before expanding Vite+ support.

Enable both `typeAware` and `typeCheck`. Leave Oxfmt at its defaults. Export `staged: { "*": "vp check --fix" }`. Do not install Git hooks as an import side effect. Consumers install hooks themselves with Vite+.

Warnings remain nonblocking. Do not enable `denyWarnings`, a zero warning threshold, dangerous fixes, or suggestion fixes. Warning-level ordinary fixes may still run. In particular, the user selected `unicorn/no-useless-spread` as a warning after reviewing its ordinary-fix risk. Preserve that choice and test it rather than silently disabling it.

Apply rules to the entire selected file. Do not add recent-Git-change filtering. Allow consumer rule overrides and localized suppression comments explaining legitimate exceptions. Do not change consumer tsconfig files automatically.

## Implementation units

### U1. Capture the policy and native configuration

Record the approved decisions. Implement and test the explicit native rule map. Replace starter package metadata and prepare typed ESM package entries. Validate native configuration with Vite+ 1.0.0, including warning exit status and consumer overrides.

### U2. Implement syntax and code-structure rules

Implement independent array, reflection, mocking, assertion, class, comment, and spacing rules. Write tests before each behavior group. Use Vite+'s AST, scope, source, and fixer APIs. Resolve lexical bindings rather than matching unrelated user-defined globals by name. Keep autofixes limited to the agreed spacing and documentation changes.

### U3. Implement local type-policy analysis

Implement local alias resolution, unknown and object contracts, dictionaries, known-value widening, and widening followed by assertions. Handle lexical shadowing, transparent generic aliases, cycles, and allowed generic constraints. Do not claim cross-file type-checker analysis. Document genuine analysis boundaries instead of concealing behavior differences.

### U4. Integrate and verify the distributable package

Register all 21 rules under the package's own namespace and expose the three configuration objects. Bundle a loadable plugin entry with no external runtime package other than Vite+. Use package-relative resolution that remains correct outside this repository. Apply the configuration to this repository with only explained, narrow exceptions required by plugin authoring and fixtures.

Verify a packed consumer, overrides, warning-only success, error failure, ordinary fixes, and repeated-fix convergence. Check staged partial-file behavior in a disposable repository. Document installation, supported runtimes, custom rule behavior, overrides, warning semantics, and update policy.

## Verification and completion

The starter baseline passed `vp check` and `vp test` before implementation. For behavior groups, observe failing regression cases before implementing them, then run the focused tests. Native configuration changes use configuration and consumer characterization instead of duplicating native rule implementations.

Before completion, run `vp check`, `vp test`, and `vp run build`. Inspect emitted declarations, packed contents, peer dependency requirements, and plugin loading from an external consumer. Verify that default exports do not share mutable per-file analysis state. Ensure the custom rule inventory and enabled severity counts match the decisions.

Commit complete, verified units on the feature branch. Keep unrelated changes out of commits. The user authorized local commits but not push, PR creation, or npm publication. If a material approved behavior cannot be implemented or a selected fix causes destructive results, preserve the evidence and ask before changing the policy.
