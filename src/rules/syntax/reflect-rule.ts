import { defineRule } from "vite-plus/lint/plugins";
import type { Rule } from "vite-plus/lint/plugins";
import { referencePath } from "../../analysis/ast.ts";

export function reflectRule(method: "apply" | "get"): Rule {
  return defineRule({
    meta: { schema: [], messages: { avoid: `Use typed access instead of Reflect.${method}().` } },
    create(context) {
      return {
        CallExpression(node) {
          if (referencePath(context, node.callee) === `Reflect.${method}`)
            context.report({ node, messageId: "avoid" });
        },
      };
    },
  });
}
