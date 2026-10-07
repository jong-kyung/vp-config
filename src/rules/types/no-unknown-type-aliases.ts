import { defineRule } from "vite-plus/lint/plugins";
import { TypeAnalysis } from "../../analysis/type-analysis.ts";

export default defineRule({
  meta: { schema: [], messages: { avoid: "Do not hide unknown behind a type alias." } },
  create(context) {
    const types = new TypeAnalysis(context);

    return {
      TSTypeAliasDeclaration(node) {
        if (types.contains(node.typeAnnotation, ["TSUnknownKeyword"]))
          context.report({ node, messageId: "avoid" });
      },
    };
  },
});
