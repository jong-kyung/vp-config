import { defineRule } from "vite-plus/lint/plugins";
import type { ESTree } from "vite-plus/lint/plugins";
import { isConstType } from "../../analysis/ast.ts";
import type { Ast } from "../../analysis/ast.ts";

function assertionChain(node: Ast): (ESTree.TSAsExpression | ESTree.TSTypeAssertion)[] {
  const assertions: (ESTree.TSAsExpression | ESTree.TSTypeAssertion)[] = [];

  for (;;) {
    if (node.type === "ParenthesizedExpression") node = node.expression;
    else if (node.type === "TSAsExpression" || node.type === "TSTypeAssertion") {
      assertions.push(node);
      node = node.expression;
    } else return assertions;
  }
}

export default defineRule({
  meta: {
    schema: [],
    messages: { avoid: "Validate the value instead of chaining type assertions." },
  },
  create(context) {
    function check(node: ESTree.TSAsExpression | ESTree.TSTypeAssertion) {
      let parent = node.parent;

      while (parent.type === "ParenthesizedExpression") parent = parent.parent;

      if (parent.type === "TSAsExpression" || parent.type === "TSTypeAssertion") return;
      const chain = assertionChain(node);

      if (chain.length > 1 && chain.some((item) => !isConstType(item.typeAnnotation)))
        context.report({ node, messageId: "avoid" });
    }

    return { TSAsExpression: check, TSTypeAssertion: check };
  },
});
