import { defineRule } from "vite-plus/lint/plugins";
import { isSignature, walk } from "../../analysis/ast.ts";
import { createTypeAnalysis } from "../../analysis/type-analysis.ts";

export default defineRule({
  meta: {
    schema: [],
    messages: {
      avoid: "Return a concrete contract, or document why unvalidated data leaves this boundary.",
    },
  },
  create(context) {
    return {
      "Program:exit"(program) {
        const types = createTypeAnalysis(context);
        walk(context, program, (node) => {
          if (!isSignature(node)) return;
          const type = node.returnType?.typeAnnotation;

          if (type && types.contains(types.use(type), ["TSUnknownKeyword"], true))
            context.report({ node: type, messageId: "avoid" });
        });
      },
    };
  },
});
