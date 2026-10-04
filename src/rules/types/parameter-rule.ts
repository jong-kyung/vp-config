import { defineRule } from "vite-plus/lint/plugins";
import type { ESTree, Rule } from "vite-plus/lint/plugins";
import type { Ast, Signature } from "../../analysis/ast.ts";
import { createTypeAnalysis } from "../../analysis/type-analysis.ts";

function parameterBinding(node: ESTree.ParamPattern): Ast {
  if (node.type === "TSParameterProperty") return parameterBinding(node.parameter);

  if (node.type === "AssignmentPattern") return node.left;

  return node;
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
      const types = createTypeAnalysis(context);
      function check(node: Signature) {
        for (const parameter of node.params) {
          const target = parameterBinding(parameter);
          const type = types.annotation(parameter);

          if (!type || !types.contains(types.use(type), [kind])) continue;

          if (kind === "TSUnknownKeyword" && target.type === "Identifier") {
            if (target.name === "cause") continue;
            const predicate = node.returnType?.typeAnnotation;

            if (
              predicate?.type === "TSTypePredicate" &&
              predicate.parameterName.type === "Identifier" &&
              predicate.parameterName.name === target.name
            )
              continue;
          }

          context.report({ node: type, messageId: "avoid" });
        }
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
}
