import { defineRule } from "vite-plus/lint/plugins";
import type { Context, ESTree } from "vite-plus/lint/plugins";
import {
  binding,
  enclosingFunction,
  isTransparentWrapper,
  memberName,
  referencePath,
  resolveValue,
  unwrap,
} from "../../analysis/ast.ts";
import type { Ast } from "../../analysis/ast.ts";
import { createArrayAnalysis } from "../../analysis/array-analysis.ts";

function checkReducerCopy(
  context: Context,
  node: ESTree.CallExpression,
  isArray: (input: Ast) => boolean,
): void {
  const fn = enclosingFunction(node);

  if (!fn) return;
  let parent: Ast = fn;

  while (parent.parent && isTransparentWrapper(parent.parent)) parent = parent.parent;
  const call = parent.parent;

  if (
    call?.type !== "CallExpression" ||
    call.arguments[0] !== parent ||
    !["reduce", "reduceRight"].includes(memberName(unwrap(call.callee)) ?? "")
  )
    return;
  const accumulator = fn.params[0];

  if (accumulator?.type !== "Identifier") return;
  const variable = binding(context, accumulator);

  if (!variable) return;

  const isAccumulator = (value: Ast): boolean =>
    binding(context, resolveValue(context, value)) === variable;

  const path = referencePath(context, node.callee);
  const initial = call.arguments[1];
  const arrayAccumulator = (initial && isArray(initial)) || isArray(accumulator);
  let copies = false;

  if (path === "Object.assign" && node.arguments[0]?.type === "ObjectExpression") {
    copies = node.arguments.slice(1).some(isAccumulator);
  } else if (arrayAccumulator && path === "Array.from" && node.arguments[0]) {
    copies = isAccumulator(node.arguments[0]);
  } else {
    const callee = unwrap(node.callee);
    copies =
      !!arrayAccumulator &&
      callee.type === "MemberExpression" &&
      [
        "concat",
        "slice",
        "map",
        "filter",
        "flat",
        "flatMap",
        "toSorted",
        "toReversed",
        "toSpliced",
        "with",
      ].includes(memberName(callee) ?? "") &&
      isAccumulator(callee.object);
  }

  if (copies) context.report({ node, messageId: "avoid" });
}

export default defineRule({
  meta: {
    schema: [],
    messages: {
      avoid: "Update a fresh local accumulator instead of copying it on each iteration.",
    },
  },
  create(context) {
    const isArray = createArrayAnalysis(context);

    return { CallExpression: (node) => checkReducerCopy(context, node, isArray) };
  },
});
