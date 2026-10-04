import { defineRule } from "vite-plus/lint/plugins";
import type { Context, ESTree } from "vite-plus/lint/plugins";
import { binding, enclosingFunction, isConstType, unwrap, walk } from "../../analysis/ast.ts";
import type { Ast } from "../../analysis/ast.ts";
import { createTypeAnalysis } from "../../analysis/type-analysis.ts";

function checkWidening(context: Context, program: ESTree.Program): void {
  const types = createTypeAnalysis(context);
  function check(type: ESTree.TSType | undefined, value: Ast | null | undefined, report: Ast) {
    if (!type || !value || !types.wide(type) || !types.known(value)) return;
    const expression = unwrap(value);

    if (
      types.openDictionary(types.use(type)) &&
      expression.type === "ObjectExpression" &&
      expression.properties.length === 0
    )
      return;
    context.report({ node: report, messageId: "avoid" });
  }

  walk(context, program, (node) => {
    if (node.type === "VariableDeclarator") check(types.annotation(node.id), node.init, node);
    else if (node.type === "AssignmentExpression" && node.operator === "=") {
      const variable = binding(context, node.left);
      const type = variable?.identifiers.map(types.annotation).find((item) => item !== undefined);
      check(type, node.right, node);
    } else if (node.type === "ReturnStatement") {
      check(enclosingFunction(node)?.returnType?.typeAnnotation, node.argument, node);
    } else if (node.type === "ArrowFunctionExpression" && node.expression) {
      check(node.returnType?.typeAnnotation, node.body, node.body);
    } else if (node.type === "CallExpression") {
      const fn = types.functionValue(node.callee);

      if (!fn) return;

      for (const [index, argument] of node.arguments.entries()) {
        const parameter = fn.params[index];

        if (parameter && argument.type !== "SpreadElement")
          check(types.annotation(parameter), argument, argument);
      }
    } else if (node.type === "TSAsExpression" || node.type === "TSTypeAssertion") {
      if (!isConstType(node.typeAnnotation)) check(node.typeAnnotation, node.expression, node);
    }
  });
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
    return { "Program:exit": (program) => checkWidening(context, program) };
  },
});
