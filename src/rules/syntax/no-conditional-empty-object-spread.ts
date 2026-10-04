import { defineRule } from "vite-plus/lint/plugins";
import { unwrap } from "../../analysis/ast.ts";
import type { Ast } from "../../analysis/ast.ts";

function isEmptyObject(node: Ast): boolean {
  const value = unwrap(node);

  return value.type === "ObjectExpression" && value.properties.length === 0;
}

export default defineRule({
  meta: {
    schema: [],
    messages: {
      avoid: "Express conditional property omission without spreading a conditional empty object.",
    },
  },
  create(context) {
    return {
      SpreadElement(node) {
        if (node.parent.type !== "ObjectExpression") return;
        const value = unwrap(node.argument);

        if (
          value.type === "ConditionalExpression" &&
          (isEmptyObject(value.consequent) || isEmptyObject(value.alternate))
        )
          context.report({ node, messageId: "avoid" });
      },
    };
  },
});
