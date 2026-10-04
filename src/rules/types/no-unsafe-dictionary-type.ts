import { defineRule } from "vite-plus/lint/plugins";
import type { ESTree } from "vite-plus/lint/plugins";
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
    const types = createTypeAnalysis(context);
    function check(node: ESTree.TSIndexSignature | ESTree.TSTypeReference | ESTree.TSMappedType) {
      if (inConstraint(node)) return;

      const unsafe =
        node.type === "TSIndexSignature"
          ? types.unsafeValue(types.use(node.typeAnnotation.typeAnnotation))
          : types.unsafeDictionary(types.use(node));

      if (unsafe) context.report({ node, messageId: "avoid" });
    }

    return {
      TSIndexSignature: check,
      TSTypeReference: check,
      TSMappedType: check,
    };
  },
});
