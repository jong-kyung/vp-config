import { defineRule } from "vite-plus/lint/plugins";
import type { Context, ESTree } from "vite-plus/lint/plugins";
import { isConstType, isTransparentWrapper } from "../../analysis/ast.ts";
import type { Ast } from "../../analysis/ast.ts";

function assertionChain(node: Ast): (ESTree.TSAsExpression | ESTree.TSTypeAssertion)[] {
  const assertions: (ESTree.TSAsExpression | ESTree.TSTypeAssertion)[] = [];

  while (isTransparentWrapper(node)) {
    if (node.type === "TSAsExpression" || node.type === "TSTypeAssertion") assertions.push(node);
    node = node.expression;
  }

  return assertions;
}

function checkAssertion(
  context: Context,
  node: ESTree.TSAsExpression | ESTree.TSTypeAssertion,
): void {
  let parent: Ast | null = node.parent;

  while (parent && isTransparentWrapper(parent)) {
    if (parent.type === "TSAsExpression" || parent.type === "TSTypeAssertion") return;
    parent = parent.parent;
  }

  const chain = assertionChain(node);

  if (chain.length > 1 && chain.some((item) => !isConstType(item.typeAnnotation)))
    context.report({ node, messageId: "avoid" });
}

export default defineRule({
  meta: {
    schema: [],
    messages: { avoid: "Validate the value instead of chaining type assertions." },
  },
  create(context) {
    const check = (node: ESTree.TSAsExpression | ESTree.TSTypeAssertion) =>
      checkAssertion(context, node);

    return { TSAsExpression: check, TSTypeAssertion: check };
  },
});
