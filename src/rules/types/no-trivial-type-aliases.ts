import { defineRule } from "vite-plus/lint/plugins";
import { walk } from "../../analysis/ast.ts";
import { createTypeAnalysis } from "../../analysis/type-analysis.ts";

export default defineRule({
  meta: {
    schema: [],
    messages: {
      avoid:
        "A primitive alias does not distinguish values; use a meaningful contract when distinction matters.",
    },
  },
  create(context) {
    return {
      "Program:exit"(program) {
        const types = createTypeAnalysis(context);
        walk(context, program, (node) => {
          if (node.type !== "TSTypeAliasDeclaration" || node.typeParameters?.params.length) return;

          const parent =
            node.parent.type === "ExportNamedDeclaration" ? node.parent.parent : node.parent;

          if (parent.type !== "Program") return;
          const type = types.expand(types.use(node.typeAnnotation)).node;

          if (
            [
              "TSStringKeyword",
              "TSNumberKeyword",
              "TSBooleanKeyword",
              "TSBigIntKeyword",
              "TSSymbolKeyword",
              "TSNullKeyword",
              "TSUndefinedKeyword",
            ].includes(type.type)
          )
            context.report({ node, messageId: "avoid" });
        });
      },
    };
  },
});
