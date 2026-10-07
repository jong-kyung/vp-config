import { defineRule } from "vite-plus/lint/plugins";
import type { Context } from "vite-plus/lint/plugins";
import type { Signature } from "../../analysis/ast.ts";
import { TypeAnalysis } from "../../analysis/type-analysis.ts";

function checkReturn(context: Context, types: TypeAnalysis, node: Signature): void {
  const type = node.returnType?.typeAnnotation;

  if (type && types.contains(type, ["TSUnknownKeyword"], true))
    context.report({ node: type, messageId: "avoid" });
}

export default defineRule({
  meta: {
    schema: [],
    messages: {
      avoid: "Return a concrete contract, or document why unvalidated data leaves this boundary.",
    },
  },
  create(context) {
    const types = new TypeAnalysis(context);
    const check = (node: Signature) => checkReturn(context, types, node);

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
