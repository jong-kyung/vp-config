import { defineRule } from "vite-plus/lint/plugins";
import type { Context, ESTree, Rule } from "vite-plus/lint/plugins";
import type { Ast, Signature } from "../../analysis/ast.ts";
import { TypeAnalysis } from "../../analysis/type-analysis.ts";

function parameterBinding(node: ESTree.ParamPattern): Ast {
  if (node.type === "TSParameterProperty") return parameterBinding(node.parameter);

  if (node.type === "AssignmentPattern") return node.left;

  return node;
}

function checkParameters(
  context: Context,
  types: TypeAnalysis,
  kind: "TSUnknownKeyword" | "TSObjectKeyword",
  node: Signature,
): void {
  for (const parameter of node.params) {
    const target = parameterBinding(parameter);
    const type = types.annotation(parameter);

    if (!type || !types.contains(type, [kind])) continue;

    if (kind === "TSUnknownKeyword" && target.type === "Identifier") {
      if (target.name === "cause") continue;
      const predicate = node.returnType?.typeAnnotation;

      if (
        predicate?.type === "TSTypePredicate" &&
        (predicate.parameterName.type === "TSThisType" ? "this" : predicate.parameterName.name) ===
          target.name
      )
        continue;
    }

    context.report({ node: type, messageId: "avoid" });
  }
}

export function parameterRule(kind: "TSUnknownKeyword" | "TSObjectKeyword"): Rule {
  return defineRule({
    meta: {
      schema: [],
      messages: {
        avoid:
          kind === "TSUnknownKeyword"
            ? "Give inputs a concrete contract, or document this unvalidated boundary."
            : "Describe the input's structure instead of accepting object.",
      },
    },
    create(context) {
      const types = new TypeAnalysis(context);
      const check = (node: Signature) => checkParameters(context, types, kind, node);

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
}
