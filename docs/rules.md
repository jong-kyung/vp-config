# Approved rule decisions

These are explicit interview decisions for Vite+ 1.0.0 and its bundled Oxlint 1.85.0. The custom rule names describe independently implemented behavior, not dependencies on the reference plugins. Unselected optional rules and framework presets are deferred.

## Custom anti-slop behavioral equivalents

error:

- no-array-filter-map
- no-reduce-accumulator-copy
- no-chained-type-assertions
- no-conditional-empty-object-spread
- no-object-parameters
- no-reflect-apply
- no-reflect-get
- no-unknown-type-aliases
- no-widen-then-assert
- require-readable-spacing

warn:

- no-known-value-widening
- no-module-mocking
- no-runtime-typeof, allowInTypeGuards:true
- no-unknown-parameters
- no-unknown-returns
- no-unsafe-dictionary-type
- require-safety-comment-for-type-assertion, default SAFETY marker

off/excluded:

- no-shape-in-symbol-names
- Effect-specific rules outside scope

## Custom antfu/slop behavioral equivalents

- no-static-only-class: error, preserve meaningful class exemptions.
- prefer-jsdoc: warn, safe autofix; do not create required docs where absent. Guard against directive conversion and embedded */ unsafe output. Object literal property comments excluded per actual upstream behavior.
- no-trivial-type-aliases: warn for primitive aliases. Unknown alias cases delegated to existing no-unknown-type-aliases error, avoiding duplicate diagnostics. Top-level non-generic same-file scope.
- no-trivial-functions: excluded.
- max-comment-length: excluded.
- no-jargon: excluded.
- no-em-dash: error, full source including strings, not only comments. Do not claim Markdown-wide language support.
- no-chained-type-assertions duplicate: already covered once by existing error rule.

Total own custom rules selected: 21, consisting of 12 error and 9 warn.

## Native decisions

Already selected outside default queue: oxc/no-accumulating-spread = error. Do not ask again.

| Position | Rule                                      | Decision                                                                                                                                                              |
| -------- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1        | typescript/no-floating-promises           | error, defaults ignoreVoid:true, checkThenables:false, ignoreIIFE:false                                                                                               |
| 2        | typescript/await-thenable                 | error                                                                                                                                                                 |
| 3        | eslint/no-async-promise-executor          | error                                                                                                                                                                 |
| 4        | eslint/no-unsafe-optional-chaining        | error, disallowArithmeticOperators:true                                                                                                                               |
| 5        | eslint/valid-typeof                       | error, default requireStringLiterals:false                                                                                                                            |
| 6        | typescript/no-array-delete                | error                                                                                                                                                                 |
| 7        | typescript/no-base-to-string              | error, defaults checkUnknown:false, ignoredTypeNames:[Error,RegExp,URL,URLSearchParams]                                                                               |
| 8        | typescript/no-duplicate-type-constituents | error, ignoreUnions:false, ignoreIntersections:false                                                                                                                  |
| 9        | typescript/no-for-in-array                | error                                                                                                                                                                 |
| 10       | typescript/no-implied-eval                | error                                                                                                                                                                 |
| 11       | typescript/no-meaningless-void-operator   | error, checkNever:false                                                                                                                                               |
| 12       | typescript/no-misused-spread              | error, allow:[]                                                                                                                                                       |
| 13       | typescript/no-redundant-type-constituents | error                                                                                                                                                                 |
| 14       | typescript/no-unsafe-unary-minus          | off, high TS compiler overlap                                                                                                                                         |
| 15       | typescript/no-useless-default-assignment  | warn, strictNullChecks prerequisite disclosed; do not alter consumer tsconfig automatically                                                                           |
| 16       | typescript/require-array-sort-compare     | error, ignoreStringArrays:true                                                                                                                                        |
| 17       | typescript/restrict-template-expressions  | error, defaults: allowAny:true, allowArray:false, allowBoolean:true, allowNullish:true, allowNumber:true, allowRegExp:true, allowNever:false, standard lib allow list |
| 18       | typescript/unbound-method                 | error, ignoreStatic:false                                                                                                                                             |
| 19       | eslint/constructor-super                  | off, TS compiler overlap                                                                                                                                              |
| 20       | eslint/for-direction                      | error, no dangerous auto-fix flags                                                                                                                                    |

| 21 | eslint/getter-return | off |
| 22 | eslint/no-caller | off |
| 23 | eslint/no-class-assign | off |
| 24 | eslint/no-compare-neg-zero | error |
| 25 | eslint/no-cond-assign | error, always |
| 26 | eslint/no-const-assign | off |
| 27 | eslint/no-constant-binary-expression | error, checkRelationalComparisons:true |
| 28 | eslint/no-constant-condition | error, checkLoops:allExceptWhileTrue |
| 29 | eslint/no-control-regex | warn |
| 30 | eslint/no-debugger | error |

| 31 | eslint/no-delete-var | off |
| 32 | eslint/no-dupe-class-members | off |
| 33 | eslint/no-dupe-else-if | error |
| 34 | eslint/no-dupe-keys | off |
| 35 | eslint/no-duplicate-case | error |
| 36 | eslint/no-empty-character-class | error |
| 37 | eslint/no-empty-pattern | error, allowObjectPatternsAsParameters:false |
| 38 | eslint/no-empty-static-block | error |
| 39 | eslint/no-eval | error, allowIndirect:false |
| 40 | eslint/no-ex-assign | error |

| 41 | eslint/no-extra-boolean-cast | error, enforceForInnerExpressions:false |
| 42 | eslint/no-func-assign | off |
| 43 | eslint/no-global-assign | error, exceptions:[] |
| 44 | eslint/no-import-assign | error |
| 45 | eslint/no-invalid-regexp | error, allowConstructorFlags:[] |
| 46 | eslint/no-irregular-whitespace | error, installed defaults skipStrings:true, skipComments:false, skipRegExps:true, skipTemplates:true, skipJSXText:true |
| 47 | eslint/no-iterator | off |
| 48 | eslint/no-loss-of-precision | error |
| 49 | eslint/no-misleading-character-class | error, allowEscape:false |
| 50 | eslint/no-new-native-nonconstructor | off |

| 51 | eslint/no-nonoctal-decimal-escape | off |
| 52 | eslint/no-obj-calls | off |
| 53 | eslint/no-self-assign | error, props:true |
| 54 | eslint/no-setter-return | off |
| 55 | eslint/no-shadow-restricted-names | error, reportGlobalThis:true |
| 56 | eslint/no-sparse-arrays | error |
| 57 | eslint/no-this-before-super | off |
| 58 | eslint/no-unassigned-vars | error |
| 59 | eslint/no-unreachable | error |
| 60 | eslint/no-unsafe-finally | error |

| 61 | eslint/no-unsafe-negation | off |
| 62 | eslint/no-unused-expressions | error, default options (short-circuit/ternary/tagged templates not allowed, JSX enforcement false) |
| 63 | eslint/no-unused-labels | error |
| 64 | eslint/no-unused-private-class-members | error |
| 65 | eslint/no-unused-vars | error, vars:all, args:all, caughtErrors:all, argsIgnorePattern:^_, caughtErrorsIgnorePattern:^_, no general vars/import ignore pattern, ignoreRestSiblings:true, remaining defaults and suggestion-only removals |
| 66 | eslint/no-useless-backreference | error |
| 67 | eslint/no-useless-catch | error |
| 68 | eslint/no-useless-escape | error, allowRegexCharacters:[] |
| 69 | eslint/no-useless-rename | error, ignoreDestructuring:false, ignoreImport:false, ignoreExport:false |
| 70 | eslint/no-with | off |

| 71 | eslint/require-yield | error |
| 72 | eslint/use-isnan | off, avoid native global isNaN autofix coercion with staged --fix; TS partial overlap disclosed |
| 73 | oxc/bad-array-method-on-arguments | off |
| 74 | oxc/bad-char-at-comparison | error |
| 75 | oxc/bad-comparison-sequence | error |
| 76 | oxc/bad-match-all-arg | error |
| 77 | oxc/bad-min-max-func | error |
| 78 | oxc/bad-object-literal-comparison | off, overlap with TS and no-constant-binary-expression |
| 79 | oxc/bad-replace-all-arg | error |
| 80 | oxc/const-comparisons | error |

| 81 | oxc/double-comparisons | warn, suggestions may change NaN/coercion behavior |
| 82 | oxc/erasing-op | warn, dangerous fixes remain disabled |
| 83 | oxc/missing-throw | error |
| 84 | oxc/number-arg-out-of-range | off, stale precision maxima in installed native rule |
| 85 | oxc/only-used-in-recursion | warn, no dangerous fix; duplicate coverage needs fixture |
| 86 | oxc/uninvoked-array-callback | off, implementation does not whitelist method names |
| 87 | typescript/no-duplicate-enum-values | error |
| 88 | typescript/no-extra-non-null-assertion | error |
| 89 | typescript/no-misused-new | error |
| 90 | typescript/no-non-null-asserted-optional-chain | error |

| 91 | typescript/no-this-alias | error, allowDestructuring:true, allowedNames:[] |
| 92 | typescript/no-unnecessary-parameter-property-assignment | warn, unsafe suggestion needs manual review |
| 93 | typescript/no-unsafe-declaration-merging | error |
| 94 | typescript/no-useless-empty-export | off, source-level ordinary-fix safety concern not runtime-verified |
| 95 | typescript/no-wrapper-object-types | error, review public type contract changes after fix |
| 96 | typescript/prefer-as-const | error, as const is exempt from selected SAFETY-comment requirement |
| 97 | typescript/prefer-namespace-keyword | off, deprecated legacy syntax rule |
| 98 | typescript/triple-slash-reference | error, lib:always, path:never, types:prefer-import |
| 99 | unicorn/no-await-in-promise-methods | error, suggestions can change scheduling/error flow |
| 100 | unicorn/no-empty-file | warn |

| 101 | unicorn/no-invalid-fetch-options | error, method inference limitations disclosed |
| 102 | unicorn/no-invalid-remove-event-listener | error |
| 103 | unicorn/no-new-array | error, no dangerous suggestion auto-application |
| 104 | unicorn/no-single-promise-in-promise-methods | off, ordinary fixes alter Promise timing/error semantics |
| 105 | unicorn/no-thenable | warn |
| 106 | unicorn/no-unnecessary-await | off, overlap with await-thenable and scheduling-sensitive ordinary fix |
| 107 | unicorn/no-useless-fallback-in-spread | error |
| 108 | unicorn/no-useless-length-check | warn |
| 109 | unicorn/no-useless-spread | warn, USER EXPLICITLY accepted ordinary --fix possibility despite metadata; preserve decision and add behavior fixture, do not silently turn off |
| 110 | unicorn/prefer-set-size | error |
| 111 | unicorn/prefer-string-starts-ends-with | off, deprecated untyped rule with coercion/newline-sensitive ordinary fix |

## Approved optional native additions

All9 shortlisted optional candidates reviewed individually and adopted:

1. typescript/no-misused-promises: error; checksConditionals:true, checksSpreads:true, checksVoidReturn:true (all six subcontexts true).
2. typescript/switch-exhaustiveness-check: error; allowDefaultCaseForExhaustiveSwitch:true, considerDefaultExhaustiveForUnions:false, requireDefaultForNonUnion:false, no custom default comment pattern.
3. typescript/no-unsafe-assignment: error, no options.
4. typescript/no-unsafe-argument: error, no options.
5. typescript/no-unsafe-call: error, no options.
6. typescript/no-unsafe-member-access: error, allowOptionalChaining:false.
7. typescript/no-unsafe-return: error, no options. Intentional any/unknown-return exceptions disclosed.
8. typescript/only-throw-error: error; allow:[], allowRethrowing:true, allowThrowingAny:true, allowThrowingUnknown:true.
9. typescript/no-explicit-any: warn; fixToUnknown:false, ignoreRestArgs:false. No automatic any-to-unknown conversion.

FINAL COUNTS: native defaults73error10warn28off; extra native accumulation1error; optional8error1warn; custom12error9warn. Enabled114 =94error+20warn. Native enabled93, custom21. Rule selection complete. Await final shared-understanding/delivery-scope confirmation before writing repository files.
