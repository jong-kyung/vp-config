import { defineRule } from "vite-plus/lint/plugins";
import type { Context, ESTree, Variable } from "vite-plus/lint/plugins";
import {
  binding,
  enclosingFunction,
  hasReassignment,
  isTransparentWrapper,
  memberName,
  referencePath,
  resolveValue,
  unwrap,
} from "../../analysis/ast.ts";
import type { Ast } from "../../analysis/ast.ts";
import { ArrayAnalysis } from "../../analysis/array-analysis.ts";

function isAccumulator(context: Context, value: Ast, variable: Variable): boolean {
  return binding(context, resolveValue(context, value)) === variable;
}

function checkReducerCopy(
  context: Context,
  node: ESTree.CallExpression,
  arrays: ArrayAnalysis,
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
  const first = fn.params[0];
  const accumulator = first?.type === "AssignmentPattern" ? first.left : first;

  if (accumulator?.type !== "Identifier") return;
  const variable = binding(context, accumulator);

  if (!variable || hasReassignment(variable)) return;

  const path = referencePath(context, node.callee);
  const initial = call.arguments[1];
  const arrayAccumulator = (initial && arrays.isArray(initial)) || arrays.isArray(accumulator);
  let copies = false;

  if (
    path === "Object.assign" &&
    node.arguments[0] &&
    unwrap(node.arguments[0]).type === "ObjectExpression"
  ) {
    copies = node.arguments.slice(1).some((value) => isAccumulator(context, value, variable));
  } else if (arrayAccumulator && path === "Array.from" && node.arguments[0]) {
    copies = isAccumulator(context, node.arguments[0], variable);
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
      isAccumulator(context, callee.object, variable);
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
    const arrays = new ArrayAnalysis(context);

    return { CallExpression: (node) => checkReducerCopy(context, node, arrays) };
  },
});
