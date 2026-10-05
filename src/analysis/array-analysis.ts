import type { Context, Variable } from "vite-plus/lint/plugins";
import {
  binding,
  declaration,
  hasReassignment,
  memberName,
  propertyName,
  referencePath,
  unwrap,
} from "./ast.ts";
import type { Ast } from "./ast.ts";
import { createTypeAnalysis } from "./type-analysis.ts";
import type { TypeUse } from "./type-analysis.ts";

export function createArrayAnalysis(context: Context) {
  const types = createTypeAnalysis(context);

  function arrayType(input: TypeUse | undefined): TypeUse | undefined {
    if (input && isArrayReference(input)) return input;
    const current = input && types.expand(input, true);

    if (current?.node.type === "TSTypeOperator" && current.node.operator === "readonly")
      return types.use(current.node.typeAnnotation, current.bindings);

    return current;
  }

  function isArrayReference(type: TypeUse): boolean {
    const node = type.node;

    return (
      node.type === "TSTypeReference" &&
      node.typeName.type === "Identifier" &&
      ["Array", "ReadonlyArray"].includes(node.typeName.name) &&
      !type.bindings.has(node.typeName.name) &&
      (!binding(context, node.typeName)?.defs.length || types.standard(type, node.typeName.name))
    );
  }

  /** Preserve generic bindings while projecting pattern annotations onto their members. */
  function bindingAnnotation(node: Ast): TypeUse | undefined {
    const annotation = types.annotation(node);

    if (annotation) return types.use(annotation);
    const parent = node.parent;

    if (parent?.type === "AssignmentPattern" && parent.left === node)
      return bindingAnnotation(parent);

    if (
      parent?.type === "Property" &&
      parent.value === node &&
      parent.parent.type === "ObjectPattern"
    ) {
      if (parent.computed && parent.key.type !== "Literal") return undefined;
      const name = propertyName(parent.key);
      const type = arrayType(bindingAnnotation(parent.parent));

      if (name === undefined || type?.node.type !== "TSTypeLiteral") return undefined;

      const member = type.node.members.find(
        (item) =>
          item.type === "TSPropertySignature" &&
          (!item.computed || item.key.type === "Literal") &&
          propertyName(item.key) === name,
      );

      return member?.type === "TSPropertySignature" && member.typeAnnotation
        ? types.use(member.typeAnnotation.typeAnnotation, type.bindings)
        : undefined;
    }

    if (parent?.type === "ArrayPattern") {
      const type = arrayType(bindingAnnotation(parent));

      if (!type) return undefined;

      if (type.node.type === "TSArrayType") return types.use(type.node.elementType, type.bindings);

      if (isArrayReference(type) && type.node.type === "TSTypeReference") {
        const element = type.node.typeArguments?.params[0];

        return element && types.use(element, type.bindings);
      }

      if (type.node.type !== "TSTupleType") return undefined;
      const index = parent.elements.findIndex((element) => element === node);

      for (let position = 0; position <= index; position++) {
        const item = type.node.elementTypes[position];
        const element = item?.type === "TSNamedTupleMember" ? item.elementType : item;

        /** A variadic segment makes subsequent positional selections ambiguous. */
        if (element?.type === "TSRestType") return undefined;

        if (position === index && element)
          return types.use(
            element.type === "TSOptionalType" ? element.typeAnnotation : element,
            type.bindings,
          );
      }
    }

    return undefined;
  }

  function isArray(input: Ast, seen = new Set<Variable>()): boolean {
    const node = unwrap(input);

    if (node.type === "ArrayExpression") return true;

    if (node.type === "Identifier") {
      const variable = binding(context, node);

      if (!variable || seen.has(variable)) return false;
      seen.add(variable);

      if (hasReassignment(variable)) return false;

      for (const identifier of variable.identifiers) {
        if (
          identifier.parent?.type === "RestElement" &&
          identifier.parent.parent.type === "ArrayPattern"
        )
          return true;
        const annotation = arrayType(bindingAnnotation(identifier));

        if (
          annotation &&
          (annotation.node.type === "TSArrayType" ||
            annotation.node.type === "TSTupleType" ||
            isArrayReference(annotation))
        )
          return true;
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
