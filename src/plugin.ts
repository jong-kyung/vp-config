import { definePlugin } from "vite-plus/lint/plugins";
import noChainedTypeAssertions from "./rules/syntax/no-chained-type-assertions.ts";
import noConditionalEmptyObjectSpread from "./rules/syntax/no-conditional-empty-object-spread.ts";
import noReflectApply from "./rules/syntax/no-reflect-apply.ts";
import noReflectGet from "./rules/syntax/no-reflect-get.ts";
import noModuleMocking from "./rules/syntax/no-module-mocking.ts";
import noRuntimeTypeof from "./rules/syntax/no-runtime-typeof.ts";
import noStaticOnlyClass from "./rules/syntax/no-static-only-class.ts";
import noArrayFilterMap from "./rules/syntax/no-array-filter-map.ts";
import noReduceAccumulatorCopy from "./rules/syntax/no-reduce-accumulator-copy.ts";
import noObjectParameters from "./rules/types/no-object-parameters.ts";
import noUnknownParameters from "./rules/types/no-unknown-parameters.ts";
import noUnknownReturns from "./rules/types/no-unknown-returns.ts";
import noUnknownTypeAliases from "./rules/types/no-unknown-type-aliases.ts";
import noUnsafeDictionaryType from "./rules/types/no-unsafe-dictionary-type.ts";
import noTrivialTypeAliases from "./rules/types/no-trivial-type-aliases.ts";
import noKnownValueWidening from "./rules/types/no-known-value-widening.ts";
import noWidenThenAssert from "./rules/types/no-widen-then-assert.ts";
import noEmDash from "./rules/presentation/no-em-dash.ts";
import requireReadableSpacing from "./rules/presentation/require-readable-spacing.ts";
import requireSafetyCommentForTypeAssertion from "./rules/presentation/require-safety-comment-for-type-assertion.ts";
import preferJsdoc from "./rules/presentation/prefer-jsdoc.ts";

export default definePlugin({
  meta: { name: "jong-kyung" },
  rules: {
    "no-chained-type-assertions": noChainedTypeAssertions,
    "no-conditional-empty-object-spread": noConditionalEmptyObjectSpread,
    "no-reflect-apply": noReflectApply,
    "no-reflect-get": noReflectGet,
    "no-module-mocking": noModuleMocking,
    "no-runtime-typeof": noRuntimeTypeof,
    "no-static-only-class": noStaticOnlyClass,
    "no-array-filter-map": noArrayFilterMap,
    "no-reduce-accumulator-copy": noReduceAccumulatorCopy,
    "no-object-parameters": noObjectParameters,
    "no-unknown-parameters": noUnknownParameters,
    "no-unknown-returns": noUnknownReturns,
    "no-unknown-type-aliases": noUnknownTypeAliases,
    "no-unsafe-dictionary-type": noUnsafeDictionaryType,
    "no-trivial-type-aliases": noTrivialTypeAliases,
    "no-known-value-widening": noKnownValueWidening,
    "no-widen-then-assert": noWidenThenAssert,
    "no-em-dash": noEmDash,
    "require-readable-spacing": requireReadableSpacing,
    "require-safety-comment-for-type-assertion": requireSafetyCommentForTypeAssertion,
    "prefer-jsdoc": preferJsdoc,
  },
});
