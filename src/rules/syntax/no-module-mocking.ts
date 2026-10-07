import { defineRule } from "vite-plus/lint/plugins";
import { referencePath } from "../../analysis/ast.ts";

export default defineRule({
  meta: {
    schema: [],
    messages: { avoid: "Use an explicit dependency boundary instead of replacing a module." },
  },
  create(context) {
    return {
      CallExpression(node) {
        const path = referencePath(context, node.callee);

        if (
          path &&
          /^(?:vi|vitest|jest|(?:vitest|vite-plus\/test)\.(?:vi|vitest)|@jest\/globals\.jest)\.(?:mock|doMock|unstable_mockModule)$/.test(
            path,
          )
        )
          context.report({ node, messageId: "avoid" });
      },
    };
  },
});
