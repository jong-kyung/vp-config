import { defineRule } from "vite-plus/lint/plugins";
import { walk } from "../../analysis/ast.ts";
import { createTypeAnalysis } from "../../analysis/type-analysis.ts";

export default defineRule({
  meta: { schema: [], messages: { avoid: "Do not hide unknown behind a type alias." } },
  create(context) {
    return {
      "Program:exit"(program) {
        const types = createTypeAnalysis(context);
        walk(context, program, (node) => {
          if (
            node.type === "TSTypeAliasDeclaration" &&
            types.contains(types.use(node.typeAnnotation), ["TSUnknownKeyword"])
          )
            context.report({ node, messageId: "avoid" });
        });
      },
    };
  },
});
