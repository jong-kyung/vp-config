import { defineRule } from "vite-plus/lint/plugins";
import type { Context, ESTree } from "vite-plus/lint/plugins";
import type { Ast } from "../../analysis/ast.ts";
import { TypeAnalysis } from "../../analysis/type-analysis.ts";

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

function checkDictionary(
  context: Context,
  types: TypeAnalysis,
  node: ESTree.TSIndexSignature | ESTree.TSTypeReference | ESTree.TSMappedType,
): void {
  if (inConstraint(node)) return;

  const unsafe =
    node.type === "TSIndexSignature"
      ? types.unsafeValue(node.typeAnnotation.typeAnnotation)
      : types.unsafeDictionary(node);

  if (unsafe) context.report({ node, messageId: "avoid" });
}

export default defineRule({
  meta: {
    schema: [],
    messages: {
      avoid: "Give dictionary values a concrete contract, or document this raw-data boundary.",
    },
  },
  create(context) {
    const types = new TypeAnalysis(context);

    const check = (node: ESTree.TSIndexSignature | ESTree.TSTypeReference | ESTree.TSMappedType) =>
      checkDictionary(context, types, node);

    return {
      TSIndexSignature: check,
      TSTypeReference: check,
      TSMappedType: check,
    };
  },
});
