import type { Context, ESTree, Variable } from "vite-plus/lint/plugins";
import { binding, declaration, hasReassignment, memberName, referencePath, unwrap } from "./ast.ts";
import type { Ast } from "./ast.ts";
import { createTypeAnalysis } from "./type-analysis.ts";

export function createArrayAnalysis(context: Context) {
  const types = createTypeAnalysis(context);

  function arrayType(input: ESTree.TSType): boolean {
    /** Standard arrays need no local type-alias index. */
    if (
      input.type === "TSTypeReference" &&
      input.typeName.type === "Identifier" &&
      ["Array", "ReadonlyArray"].includes(input.typeName.name) &&
      !binding(context, input.typeName, true)?.defs.length
    )
      return true;
    let node = types.expand(input);

    if (node.type === "TSTypeOperator" && node.operator === "readonly") node = node.typeAnnotation;

    return (
      node.type === "TSArrayType" ||
      node.type === "TSTupleType" ||
      types.standard(node, "Array") ||
      types.standard(node, "ReadonlyArray")
    );
  }

  function isArray(input: Ast, seen = new Set<Variable>()): boolean {
    const node = unwrap(input);

    if (node.type === "ArrayExpression") return true;

    if (node.type === "Identifier") {
      const variable = binding(context, node);

      if (!variable || seen.has(variable) || hasReassignment(variable)) return false;
      seen.add(variable);

      for (const identifier of variable.identifiers) {
        const type = types.annotation(identifier);

        if (type && arrayType(type)) return true;
      }

      const decl = declaration(context, node);

      return !!decl?.init && decl.id.type === "Identifier" && isArray(decl.init, seen);
    }

    if (node.type === "NewExpression") return referencePath(context, node.callee) === "Array";

    if (node.type !== "CallExpression") return false;

    if (["Array", "Array.from", "Array.of"].includes(referencePath(context, node.callee) ?? ""))
      return true;
    const callee = unwrap(node.callee);

    return (
      callee.type === "MemberExpression" &&
      [
        "filter",
        "map",
        "slice",
        "concat",
        "sort",
        "reverse",
        "fill",
        "copyWithin",
        "splice",
        "flat",
        "flatMap",
        "toSorted",
        "toReversed",
        "toSpliced",
        "with",
      ].includes(memberName(callee) ?? "") &&
      isArray(callee.object, seen)
    );
  }

  return isArray;
}
