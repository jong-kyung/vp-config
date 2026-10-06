import { defineRule } from "vite-plus/lint/plugins";
import type { ESTree } from "vite-plus/lint/plugins";
import { binding, enclosingFunction, isConstType, resolveValue } from "../../analysis/ast.ts";
import type { Ast } from "../../analysis/ast.ts";
import { createTypeAnalysis } from "../../analysis/type-analysis.ts";

export default defineRule({
  meta: {
    schema: [],
    messages: {
      avoid:
        "Preserve known information with inference or satisfies instead of widening this value.",
    },
  },
  create(context) {
    const types = createTypeAnalysis(context);
    function check(type: ESTree.TSType | undefined, value: Ast | null | undefined, report: Ast) {
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

    function checkAssertion(node: ESTree.TSAsExpression | ESTree.TSTypeAssertion) {
      if (!isConstType(node.typeAnnotation)) check(node.typeAnnotation, node.expression, node);
    }

    return {
      VariableDeclarator(node) {
        check(types.annotation(node.id), node.init, node);
      },
      AssignmentExpression(node) {
        if (node.operator !== "=") return;
        const variable = binding(context, node.left);
        const type = variable?.identifiers.map(types.annotation).find((item) => item !== undefined);
        check(type, node.right, node);
      },
      ReturnStatement(node) {
        check(enclosingFunction(node)?.returnType?.typeAnnotation, node.argument, node);
      },
      ArrowFunctionExpression(node) {
        if (node.expression) check(node.returnType?.typeAnnotation, node.body, node.body);
      },
      TSAsExpression: checkAssertion,
      TSTypeAssertion: checkAssertion,
    };
  },
});
