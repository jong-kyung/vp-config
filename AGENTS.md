# Project guidance

This package provides shared Vite+ presets and custom lint rules. Its public presets are `nodeConfig` and `libConfig`.

## Code layout

- `src/index.ts` defines the presets and custom rule settings. `src/native.ts` defines native lint settings.
- `src/plugin.ts` exports the custom plugin. Rule implementations live in `src/rules/` and share helpers in `src/analysis/`.
- `tests/` contains rule regression tests and packed-consumer integration tests.

## Rule changes

- Preserve rule registration, severities, and options when refactoring.
- Keep type and array analysis within its existing local-analysis boundaries.
- Keep JSDoc fixes limited to existing function and class explanations. Preserve directives and attached comments.
- Preserve the assertion safety-comment policy and the `as const` exemption.
- Add focused regression cases for changed rule behavior. Use native Vite+ configuration and `mergeConfig` rather than introducing custom configuration helpers.

## Documentation and validation

Keep package usage and custom rule guidance in `README.md`. Keep development and CI instructions in `CONTRIBUTING.md`, and follow its validation commands before committing.

<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend tooling in a single global CLI called `vp`. Vite+ is distinct from Vite, and it invokes Vite through `vp dev` and `vp build`. Run `vp help` to print a list of commands and `vp <command> --help` for information about a specific command.

Docs are local at `node_modules/vite-plus/docs` or online at https://viteplus.dev/guide/.

## Built-in Commands vs Scripts

`vp <name>` runs a built-in command. `vp run <name>` runs a `package.json` script or a `vite.config.ts` task. Scripts cannot overwrite built-ins, so `vp dev` and `vp run dev` may do different things. Check `package.json` and `vite.config.ts` first, and run `vp run <name>` when the project defines a script or task with that name.

## Tool Versions

Run `vp toolchain` to show versions and relationships in the active Vite+
release. Add a tool name to select part of the graph. For example, run
`vp toolchain vite`. Use `--global` to ignore the local `vite-plus` package. Use
`vp why <package>` to show the package-manager dependency graph.

## Review Checklist

- [ ] Run `vp install` after pulling remote changes and before getting started.
- [ ] Run `vp check` and `vp test` to format, lint, type check and test changes.
- [ ] Check if there are `vite.config.ts` tasks or `package.json` scripts necessary for validation, run via `vp run <script>`.
- [ ] If setup, runtime, or package-manager behavior looks wrong, run `vp env doctor` and include its output when asking for help.

<!--VITE PLUS END-->
