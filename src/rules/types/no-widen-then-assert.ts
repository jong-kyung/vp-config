import { defineRule } from "vite-plus/lint/plugins";
import type { Context, ESTree } from "vite-plus/lint/plugins";
import { isConstType } from "../../analysis/ast.ts";
import { TypeAnalysis } from "../../analysis/type-analysis.ts";

function checkAssertion(
  context: Context,
  types: TypeAnalysis,
  node: ESTree.TSAsExpression | ESTree.TSTypeAssertion,
): void {
  if (!isConstType(node.typeAnnotation) && types.widened(node.expression))
    context.report({ node, messageId: "avoid" });
}

export default defineRule({
  meta: {
    schema: [],
    messages: {
      avoid: "Preserve the original type instead of erasing it and asserting another contract.",
    },
  },
  create(context) {
    const types = new TypeAnalysis(context);

    const check = (node: ESTree.TSAsExpression | ESTree.TSTypeAssertion) =>
      checkAssertion(context, types, node);

    return {
      TSAsExpression: check,
      TSTypeAssertion: check,
    };
  },
});
