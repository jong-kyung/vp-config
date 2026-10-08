# Contributing

## Setup

Use the Node version in `.node-version`, which also selects the CI runtime. Install the global Vite+ CLI and Git, then install dependencies:

```bash
vp install
```

The package's supported Node range matches Vite+. Package manager settings are in `package.json`.

## Make changes

Add regression cases in `tests/` when changing a rule. Custom rules are exported from `src/plugin.ts` and registered in `src/index.ts`. Native rule settings are in `src/native.ts`.

Run these checks before submitting changes:

```bash
vp check
vp run knip
vp run duplication --baseline-from-ref origin/main
vp test
vp run build
```

Knip checks unused files, exports, and dependencies. The duplication command scans `src` against the supplied Git ref. Existing clones are allowed. New clones or an unavailable baseline fail the check. Tests are outside the duplication scope.

## Tests and snapshots

Vitest discovers `tests/**/*.test.ts` through `vite.config.ts`. Each custom rule has a file in `tests/rules/`. Define its valid and invalid inputs once and run them with the shared RuleTester in `tests/helpers/rule-tester.ts`. Keep options, declaration filenames, local-analysis boundaries, directives, and exact line endings in regression cases. Remove a case only when its input, options, and verification purpose duplicate another case.

Public preset settings, including native severities and options, are captured together in `tests/__snapshots__/index.test.ts.snap`. Only the checkout-specific plugin path is normalized. Keep explicit assertions for relationships such as plugin registration completeness, shared method identity, and unchanged output.

The `no-runtime-typeof` and `prefer-jsdoc` suites also run the same inputs through the installed `vp lint` CLI. This is a limited snapshot pilot, not a replacement for RuleTester. Each suite batches its inputs in a temporary directory under `node_modules`, activates only the tested rule through native Vite+ overrides, and cleans up afterward. It does not build or install a consumer package and needs no network after dependency installation.

CLI snapshots record rule identifiers, severity, messages, start and end positions, and fixed source in external `.snap` files. Locations use SARIF's one-based Unicode code point columns, with an exclusive end position. Original diagnostics are collected before `--fix`, because that command reports only remaining issues. Explicit comparisons against the shared RuleTester expectations preserve error counts, unchanged code, exact CRLF bytes, and fixed output. A second fix run must leave the output unchanged. CLI fixing may apply multiple passes, so it is compared with RuleTester's default single-pass expectation rather than assumed equivalent.

Review snapshot diffs as behavior changes. Update only the affected suite after checking its inputs and intended results, then rerun without update mode:

```bash
vp test tests/rules/prefer-jsdoc.test.ts --update
vp test tests/rules/prefer-jsdoc.test.ts
```

Keep the pilot limited to these two rules until diagnostic accuracy, repeatability, runtime, and maintenance cost have been evaluated. The CLI helper currently supports code, names, options, numeric error counts, and optional fixed output. Extend its contract explicitly before using cases with custom filenames, parser settings, or hooks.

Packed-consumer installation, consumer library builds, type-checking integration, CLI exit-code policy, and Git staging behavior are no longer covered by the test suite. Configuration snapshots do not replace those integration checks.

To inspect the package without publishing:

```bash
vp run build
vp pm pack --out /tmp/vp-config.tgz
```

## CI

CI runs `vp check`, Knip, and Vitest on PRs, main pushes, manual runs, and Sundays at 02:00 UTC. Duplication checks run on PRs and main pushes.

[autofix.ci](https://autofix.ci/setup) receives changed file contents and commits fixes to PRs when its GitHub App is enabled. The workflow excludes `.github` paths from automatic fixes.
