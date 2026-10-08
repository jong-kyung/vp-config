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

Vitest discovers `tests/**/*.test.ts` through `vite.config.ts`. The consumer tests build and pack the package, install its tarball in a temporary project, and exercise configuration inheritance, lint diagnostics, type checking, fixes, library packaging, and partial staging. Consumer installation requires network access, uses the same Node version, disables lifecycle scripts, and permits a missing lockfile. It does not require a warm dependency cache.

To inspect the package without publishing:

```bash
vp run build
vp pm pack --out /tmp/vp-config.tgz
```

## CI

CI runs `vp check`, Knip, and Vitest on PRs, main pushes, manual runs, and Sundays at 02:00 UTC. Duplication checks run on PRs and main pushes.

[autofix.ci](https://autofix.ci/setup) receives changed file contents and commits fixes to PRs when its GitHub App is enabled. The workflow excludes `.github` paths from automatic fixes.
