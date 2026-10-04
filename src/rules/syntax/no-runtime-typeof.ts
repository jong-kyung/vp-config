import { defineRule } from "vite-plus/lint/plugins";
import { enclosingFunction, isOptionsObject, unwrap } from "../../analysis/ast.ts";
import type { Ast } from "../../analysis/ast.ts";

export default defineRule({
  meta: {
    schema: [
      {
        type: "object",
        properties: { allowInTypeGuards: { type: "boolean" } },
        additionalProperties: false,
      },
    ],
    messages: { avoid: "Validate boundary values in a parser or an explicit type guard." },
  },
  create(context) {
    const option = context.options[0];

    const allowInTypeGuards = isOptionsObject(option) && option.allowInTypeGuards === true;

    return {
      UnaryExpression(node) {
        if (node.operator !== "typeof") return;
        let parent: Ast = node;

        while (parent.parent?.type === "ParenthesizedExpression") parent = parent.parent;
        const comparison = parent.parent;

        if (
          comparison?.type === "BinaryExpression" &&
          ["==", "===", "!=", "!=="].includes(comparison.operator)
        ) {
          const other = unwrap(comparison.left === parent ? comparison.right : comparison.left);

          if (other.type === "Literal" && other.value === "undefined") return;
        }

        const fn = enclosingFunction(node);

        if (allowInTypeGuards && fn?.returnType?.typeAnnotation.type === "TSTypePredicate") return;
        context.report({ node, messageId: "avoid" });
      },
    };
  },
});
