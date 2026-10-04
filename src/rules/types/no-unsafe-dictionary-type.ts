import { defineRule } from "vite-plus/lint/plugins";
import { walk } from "../../analysis/ast.ts";
import type { Ast } from "../../analysis/ast.ts";
import { createTypeAnalysis } from "../../analysis/type-analysis.ts";

function inConstraint(node: Ast): boolean {
  const range = node.range;
  let parent = node.parent;

  while (parent) {
    if (
      parent.type === "TSTypeParameter" &&
      parent.constraint &&
      parent.constraint.range[0] <= range[0] &&
      parent.constraint.range[1] >= range[1]
    )
      return true;
    parent = parent.parent;
  }

  return false;
}

export default defineRule({
  meta: {
    schema: [],
    messages: {
      avoid: "Give dictionary values a concrete contract, or document this raw-data boundary.",
    },
  },
  create(context) {
    return {
      "Program:exit"(program) {
        const types = createTypeAnalysis(context);
        walk(context, program, (node) => {
          if (inConstraint(node)) return;

          if (node.type === "TSIndexSignature") {
            if (types.unsafeValue(types.use(node.typeAnnotation.typeAnnotation)))
              context.report({ node, messageId: "avoid" });
          } else if (
            (node.type === "TSTypeReference" || node.type === "TSMappedType") &&
            types.unsafeDictionary(types.use(node))
          ) {
            context.report({ node, messageId: "avoid" });
          }
        });
      },
    };
  },
});
