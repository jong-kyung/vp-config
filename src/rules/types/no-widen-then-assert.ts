import { defineRule } from "vite-plus/lint/plugins";
import type { ESTree } from "vite-plus/lint/plugins";
import { isConstType } from "../../analysis/ast.ts";
import { createTypeAnalysis } from "../../analysis/type-analysis.ts";

export default defineRule({
  meta: {
    schema: [],
    messages: {
      avoid: "Preserve the original type instead of erasing it and asserting another contract.",
    },
  },
  create(context) {
    const types = createTypeAnalysis(context);
    function check(node: ESTree.TSAsExpression | ESTree.TSTypeAssertion) {
      if (!isConstType(node.typeAnnotation) && types.widened(node.expression))
        context.report({ node, messageId: "avoid" });
    }

    return {
      TSAsExpression: check,
      TSTypeAssertion: check,
    };
  },
});
