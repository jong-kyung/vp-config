import { defineRule } from "vite-plus/lint/plugins";
import type { Context, ESTree } from "vite-plus/lint/plugins";
import { isConstType, isFunction, isOptionsObject, isString } from "../../analysis/ast.ts";
import type { Ast } from "../../analysis/ast.ts";
import { attachedComments, exportedNode } from "../../analysis/comments.ts";

function assertionAnchor(node: Ast): Ast {
  let anchor = node;

  while (anchor.parent && anchor.parent.type !== "Program" && !isFunction(anchor.parent)) {
    if (
      /Statement$|Declaration$/.test(anchor.type) ||
      anchor.type === "Property" ||
      anchor.type === "PropertyDefinition" ||
      anchor.type === "AccessorProperty"
    )
      break;
    anchor = anchor.parent;
  }

  return exportedNode(anchor);
}

function checkSafety(
  context: Context,
  node: ESTree.TSAsExpression | ESTree.TSTypeAssertion,
  markers: readonly string[],
): void {
  if (isConstType(node.typeAnnotation)) return;
  const anchor = assertionAnchor(node);
  const parent = anchor.parent;

  const siblings =
    parent?.type === "SwitchCase"
      ? parent.consequent
      : parent && "body" in parent && Array.isArray(parent.body)
        ? parent.body
        : [];

  /** ponytail: scan siblings per assertion. Index predecessors if large files need it. */
  const previous = siblings.findLast((sibling) => sibling.range[1] <= anchor.range[0]);

  const candidates = new Set([
    ...attachedComments(context, anchor).filter(
      (comment) => !previous || comment.loc.start.line > previous.loc.end.line,
    ),
    ...attachedComments(context, node),
  ]);

  for (const comment of context.sourceCode.getCommentsAfter(node)) {
    if (comment.loc.start.line === node.loc.end.line) candidates.add(comment);
  }

  for (const comment of candidates) {
    const lines = comment.value.split(/\r?\n/).map((line) => line.replace(/^\s*\*?\s*/, ""));

    if (
      lines.some((line) =>
        markers.some(
          (marker) =>
            line.startsWith(`${marker}:`) && line.slice(marker.length + 1).trim().length > 0,
        ),
      )
    )
      return;
  }

  context.report({ node, messageId: "safety" });
}

export default defineRule({
  meta: {
    schema: [
      {
        type: "object",
        properties: {
          markers: { type: "array", items: { type: "string", minLength: 1 }, minItems: 1 },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      safety:
        "Explain the checked invariant in a nearby SAFETY: comment before asserting this type.",
    },
  },
  create(context) {
    const option = context.options[0];

    const configured = isOptionsObject(option) ? option.markers : undefined;
    const markers = Array.isArray(configured) ? configured.filter(isString) : ["SAFETY"];

    return {
      TSAsExpression: (node) => checkSafety(context, node, markers),
      TSTypeAssertion: (node) => checkSafety(context, node, markers),
    };
  },
});
