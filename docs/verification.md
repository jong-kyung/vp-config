# Local verification

## Tested environment

The implementation was verified on macOS with Node 24.21.0 and pnpm 12.9.1. Vite+ 1.0.0 supplied Oxlint 1.85.0, Oxfmt 0.70.0, oxlint-tsgolint 7.0.2003, Vitest 5.0.1, and tsdown 0.23.0.

The final checks passed:

- `vp check` reported no formatting, lint, or type issues.
- `vp test` passed 203 tests across six files.
- `vp run build` emitted both ESM entries and their declarations.
- `git diff --check` found no whitespace errors.

The build reports that the TypeScript 7 API is experimental. Declaration generation and consumer type checking succeeded with TypeScript 7.0.2.

## Coverage

`tests/native.test.ts` compares all 111 reviewed defaults with the recorded decisions, verifies the ten additional native rules, and checks selected nondefault options. The native configuration has 82 errors, 11 warnings, and 28 disabled rules.

`tests/index.test.ts` checks the exact Vite+ peer, the absence of other runtime dependencies, the plain configuration objects, the custom plugin inventory, and the combined counts of 94 errors and 20 warnings. It also limits custom autofixes to spacing and existing-comment conversion.

The three rule suites cover 193 custom-rule cases. They include lexical aliases, shadowing, type predicates, transparent generic aliases, recursive aliases, dictionary constraints, assertion comments, directive preservation, overload grouping, CRLF spacing, and unsafe comment text. Each behavior group began with a failing test run. Direct review added regression cases for shadowed array types, readonly array parameters, Vite+ test imports, and the Vitest named alias.

`tests/consumer.test.ts` builds an npm tarball and installs it offline into a temporary project outside the repository. That project uses its own dependencies rather than linking the source package. Its checks cover:

- Loading the configuration and plugin through package exports.
- Emitted declarations and package-relative plugin resolution.
- The exact effective native inventory and all seven disabled categories.
- Warning-only success, custom-rule failure, compiler failure, and type-aware promise diagnostics.
- Native inheritance and file-specific severity overrides.
- Ordinary warning fixes, repeated-fix convergence, and preservation of TypeScript directives.
- Warning-only staged checks and partial staging that preserves unstaged changes.
- Restoration of both the index and working file after a failed staged check.

Vite+ 1.0.0 omits JavaScript rule settings from `--print-config`. The tests compare its output only with the native rule map. Separate inventory assertions, plugin loading, custom diagnostics, and override tests cover the JavaScript rules.

## Remaining boundaries

Custom type analysis is local and syntactic. The README describes unsupported inference paths. This implementation does not claim full upstream plugin equivalence or cross-file TypeScript analysis.

The declared Node range follows Vite+, but only Node 24.21.0 on macOS was exercised. Other runtimes and operating systems still need a compatibility matrix. The JavaScript plugin API and the TypeScript declaration generator remain experimental dependencies of the pinned toolchain.

The review ran in the implementation session. No independent reviewer or external review model was used. The source changes and behavioral references do not include copied upstream plugin implementations.

No npm publication, push, pull request, or release tag was created. Package-name ownership and registry availability remain unverified. Publishing requires a separate decision after reviewing the artifact.
