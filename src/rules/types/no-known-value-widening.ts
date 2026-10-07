import { defineRule } from "vite-plus/lint/plugins";
import type { Context, ESTree } from "vite-plus/lint/plugins";
import { binding, enclosingFunction, isConstType, resolveValue } from "../../analysis/ast.ts";
import type { Ast } from "../../analysis/ast.ts";
import { TypeAnalysis } from "../../analysis/type-analysis.ts";

function checkWidening(
  context: Context,
  types: TypeAnalysis,
  type: ESTree.TSType | undefined,
  value: Ast | null | undefined,
  report: Ast,
): void {
  if (!type || !value || !types.wide(type) || !types.known(value)) return;
  const expression = resolveValue(context, value);

  if (
    types.openDictionary(type) &&
    expression.type === "ObjectExpression" &&
    expression.properties.length === 0
  )
    return;
  context.report({ node: report, messageId: "avoid" });
}

function checkAssertion(
  context: Context,
  types: TypeAnalysis,
  node: ESTree.TSAsExpression | ESTree.TSTypeAssertion,
): void {
  if (!isConstType(node.typeAnnotation))
    checkWidening(context, types, node.typeAnnotation, node.expression, node);
}

export default defineRule({
  meta: {
    schema: [],
    messages: {
      avoid:
        "Preserve known information with inference or satisfies instead of widening this value.",
    },
  },
  create(context) {
    const types = new TypeAnalysis(context);

    const check = (node: ESTree.TSAsExpression | ESTree.TSTypeAssertion) =>
      checkAssertion(context, types, node);

    return {
      VariableDeclarator(node) {
        checkWidening(context, types, types.annotation(node.id), node.init, node);
      },
      AssignmentPattern(node) {
        checkWidening(context, types, types.annotation(node.left), node.right, node);
      },
      PropertyDefinition(node) {
        checkWidening(context, types, types.annotation(node), node.value, node);
      },
      AccessorProperty(node) {
        checkWidening(context, types, types.annotation(node), node.value, node);
      },
      AssignmentExpression(node) {
        if (node.operator !== "=") return;
        const variable = binding(context, node.left);
        const type = variable?.identifiers.map(types.annotation).find((item) => item !== undefined);
        checkWidening(context, types, type, node.right, node);
      },
      ReturnStatement(node) {
        checkWidening(
          context,
          types,
          enclosingFunction(node)?.returnType?.typeAnnotation,
          node.argument,
          node,
        );
      },
      ArrowFunctionExpression(node) {
        if (node.expression)
          checkWidening(context, types, node.returnType?.typeAnnotation, node.body, node.body);
      },
      TSAsExpression: check,
      TSTypeAssertion: check,
    };
  },
});
