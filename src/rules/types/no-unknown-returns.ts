import { defineRule } from "vite-plus/lint/plugins";
import type { Signature } from "../../analysis/ast.ts";
import { createTypeAnalysis } from "../../analysis/type-analysis.ts";

export default defineRule({
  meta: {
    schema: [],
    messages: {
      avoid: "Return a concrete contract, or document why unvalidated data leaves this boundary.",
    },
  },
  create(context) {
    const types = createTypeAnalysis(context);
    function check(node: Signature) {
      const type = node.returnType?.typeAnnotation;

      if (type && types.contains(type, ["TSUnknownKeyword"], true))
        context.report({ node: type, messageId: "avoid" });
    }

    return {
      FunctionDeclaration: check,
      FunctionExpression: check,
      ArrowFunctionExpression: check,
      TSDeclareFunction: check,
      TSEmptyBodyFunctionExpression: check,
      TSFunctionType: check,
      TSConstructorType: check,
      TSCallSignatureDeclaration: check,
      TSConstructSignatureDeclaration: check,
      TSMethodSignature: check,
    };
  },
});
