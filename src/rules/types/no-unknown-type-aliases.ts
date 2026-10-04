import { defineRule } from "vite-plus/lint/plugins";
import { createTypeAnalysis } from "../../analysis/type-analysis.ts";

export default defineRule({
  meta: { schema: [], messages: { avoid: "Do not hide unknown behind a type alias." } },
  create(context) {
    const types = createTypeAnalysis(context);

    return {
      TSTypeAliasDeclaration(node) {
        if (types.contains(types.use(node.typeAnnotation), ["TSUnknownKeyword"]))
          context.report({ node, messageId: "avoid" });
      },
    };
  },
});
