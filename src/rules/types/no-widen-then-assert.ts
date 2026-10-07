import { defineRule } from "vite-plus/lint/plugins";
import type { Context, ESTree } from "vite-plus/lint/plugins";
import { isConstType } from "../../analysis/ast.ts";
import { TypeAnalysis } from "../../analysis/type-analysis.ts";

function checkAssertion(
  context: Context,
  types: TypeAnalysis,
  node: ESTree.TSAsExpression | ESTree.TSTypeAssertion,
): void {
  if (isConstType(node.typeAnnotation)) return;
  const previous = types.widenedType(node.expression);

  if (!previous) return;
  const target = types.expand(node.typeAnnotation);

  if (
    previous === target ||
    (previous.type === target.type &&
      (["TSUnknownKeyword", "TSAnyKeyword", "TSObjectKeyword"].includes(target.type) ||
        (previous.type === "TSTypeLiteral" &&
          target.type === "TSTypeLiteral" &&
          previous.members.length === 0 &&
          target.members.length === 0)))
  )
    return;
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
