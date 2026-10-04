import { defineRule } from "vite-plus/lint/plugins";
import { isConstType, walk } from "../../analysis/ast.ts";
import { createTypeAnalysis } from "../../analysis/type-analysis.ts";

export default defineRule({
  meta: {
    schema: [],
    messages: {
      avoid: "Preserve the original type instead of erasing it and asserting another contract.",
    },
  },
  create(context) {
    return {
      "Program:exit"(program) {
        const types = createTypeAnalysis(context);
        walk(context, program, (node) => {
          if (
            (node.type === "TSAsExpression" || node.type === "TSTypeAssertion") &&
            !isConstType(node.typeAnnotation) &&
            types.widened(node.expression)
          )
            context.report({ node, messageId: "avoid" });
        });
      },
    };
  },
});
