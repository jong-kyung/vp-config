import type { Context, ESTree, Options, Scope, Variable } from "vite-plus/lint/plugins";

export type Ast = ESTree.Node;

export type FunctionNode = ESTree.Function | ESTree.ArrowFunctionExpression;

export type Signature =
  | FunctionNode
  | ESTree.TSFunctionType
  | ESTree.TSConstructorType
  | ESTree.TSCallSignatureDeclaration
  | ESTree.TSConstructSignatureDeclaration
  | ESTree.TSMethodSignature;

export function isTransparentWrapper(node: Ast): node is Ast & { expression: Ast } {
  return (
    node.type === "ParenthesizedExpression" ||
    node.type === "ChainExpression" ||
    node.type === "TSAsExpression" ||
    node.type === "TSTypeAssertion" ||
    node.type === "TSSatisfiesExpression" ||
    node.type === "TSNonNullExpression"
  );
}

export function unwrap(node: Ast): Ast {
  while (isTransparentWrapper(node)) node = node.expression;

  return node;
}

export function isConstType(type: ESTree.TSType): boolean {
  return (
    type.type === "TSTypeReference" &&
    type.typeName.type === "Identifier" &&
    type.typeName.name === "const"
  );
}

export function isString(value: unknown): value is string {
  return typeof value === "string";
}

export function isOptionsObject(value: Options[number]): value is Record<string, Options[number]> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function propertyName(node: Ast): string | undefined {
  if (node.type === "Identifier" || node.type === "PrivateIdentifier") return node.name;

  if (node.type === "Literal" && isString(node.value)) return node.value;

  return undefined;
}

export function memberName(node: Ast): string | undefined {
  if (node.type !== "MemberExpression") return undefined;

  if (node.computed && node.property.type !== "Literal") return undefined;

  return propertyName(node.property);
}

export function binding(context: Context, node: Ast): Variable | undefined {
  if (node.type !== "Identifier") return undefined;
  let scope: Scope | null = context.sourceCode.getScope(node);

  while (scope) {
    const variable = scope.set.get(node.name);

    if (variable) return variable;
    scope = scope.upper;
  }

  return undefined;
}

/** Destructuring defaults can produce multiple initializer references to the same identifier. */
function hasReassignment(variable: Variable): boolean {
  let initializer: Ast | undefined;

  for (const reference of variable.references) {
    if (!reference.isWrite()) continue;

    if (!reference.init || (initializer && initializer !== reference.identifier)) return true;
    initializer = reference.identifier;
  }

  return false;
}

export function declaration(context: Context, node: Ast): ESTree.VariableDeclarator | undefined {
  const variable = binding(context, node);

  if (!variable || hasReassignment(variable)) return undefined;

  const definition = variable.defs.find(
    (item) => item.node.type === "VariableDeclarator" && item.node.init,
  );

  if (definition?.node.type === "VariableDeclarator") return definition.node;

  return undefined;
}

export function resolveValue(context: Context, input: Ast, seen = new Set<Variable>()): Ast {
  const node = unwrap(input);

  if (node.type !== "Identifier") return node;
  const variable = binding(context, node);

  if (!variable || seen.has(variable)) return node;
  seen.add(variable);
  const decl = declaration(context, node);

  if (decl?.id.type === "Identifier" && decl.init) return resolveValue(context, decl.init, seen);

  return node;
}

/** Resolve only lexical aliases, not arbitrary calls or runtime property writes. */
export function referencePath(
  context: Context,
  input: Ast,
  seen = new Set<Variable>(),
): string | undefined {
  const node = unwrap(input);

  if (node.type === "MemberExpression") {
    const object = referencePath(context, node.object, seen);
    const property = memberName(node);

    return object && property ? `${object}.${property}`.replace(/^globalThis\./, "") : undefined;
  }

  if (node.type !== "Identifier") return undefined;
  const variable = binding(context, node);

  if (!variable || variable.defs.length === 0) return node.name;

  if (seen.has(variable)) return undefined;
  seen.add(variable);

  for (const definition of variable.defs) {
    const imported = definition.node;

    if (imported.type === "ImportSpecifier" || imported.type === "ImportNamespaceSpecifier") {
      const parent = imported.parent;

      if (parent.type !== "ImportDeclaration") continue;

      return imported.type === "ImportNamespaceSpecifier"
        ? parent.source.value
        : `${parent.source.value}.${propertyName(imported.imported)}`;
    }
  }

  const decl = declaration(context, node);

  if (!decl?.init) return undefined;

  if (decl.id.type === "Identifier") return referencePath(context, decl.init, seen);

  if (decl.id.type === "ObjectPattern") {
    for (const property of decl.id.properties) {
      if (property.type !== "Property") continue;

      const target =
        property.value.type === "AssignmentPattern" ? property.value.left : property.value;

      if (target.type !== "Identifier" || target.name !== node.name) continue;

      if (property.computed && property.key.type !== "Literal") continue;
      const object = referencePath(context, decl.init, seen);
      const key = propertyName(property.key);

      if (object && key) return `${object}.${key}`;
    }
  }

  return undefined;
}

export function isFunction(node: Ast): node is FunctionNode {
  return (
    node.type === "FunctionDeclaration" ||
    node.type === "FunctionExpression" ||
    node.type === "ArrowFunctionExpression" ||
    node.type === "TSDeclareFunction" ||
    node.type === "TSEmptyBodyFunctionExpression"
  );
}

export function enclosingFunction(node: Ast): FunctionNode | undefined {
  let parent = node.parent;

  while (parent) {
    if (isFunction(parent)) return parent;
    parent = parent.parent;
  }

  return undefined;
}

function unwrapArrayType(type: ESTree.TSType | undefined): ESTree.TSType | undefined {
  while (
    type?.type === "TSParenthesizedType" ||
    (type?.type === "TSTypeOperator" && type.operator === "readonly")
  ) {
    type = type.typeAnnotation;
  }

  return type;
}

function isArrayReference(context: Context, type: ESTree.TSType): type is ESTree.TSTypeReference {
  return (
    type.type === "TSTypeReference" &&
    type.typeName.type === "Identifier" &&
    ["Array", "ReadonlyArray"].includes(type.typeName.name) &&
    !binding(context, type.typeName)?.defs.length
  );
}

/** Project inline pattern annotations without inferring imported or computed property types. */
function bindingAnnotation(context: Context, node: Ast): ESTree.TSType | undefined {
  if ("typeAnnotation" in node && node.typeAnnotation?.type === "TSTypeAnnotation")
    return node.typeAnnotation.typeAnnotation;
  const parent = node.parent;

  if (parent?.type === "AssignmentPattern" && parent.left === node)
    return bindingAnnotation(context, parent);

  if (
    parent?.type === "Property" &&
    parent.value === node &&
    parent.parent.type === "ObjectPattern"
  ) {
    if (parent.computed && parent.key.type !== "Literal") return undefined;
    const name = propertyName(parent.key);
    const type = unwrapArrayType(bindingAnnotation(context, parent.parent));

    if (name === undefined || type?.type !== "TSTypeLiteral") return undefined;

    const member = type.members.find(
      (item) =>
        item.type === "TSPropertySignature" &&
        (!item.computed || item.key.type === "Literal") &&
        propertyName(item.key) === name,
    );

    return member?.type === "TSPropertySignature"
      ? member.typeAnnotation?.typeAnnotation
      : undefined;
  }

  if (parent?.type === "ArrayPattern") {
    const type = unwrapArrayType(bindingAnnotation(context, parent));

    if (!type) return undefined;

    if (type.type === "TSArrayType") return type.elementType;

    if (isArrayReference(context, type)) return type.typeArguments?.params[0];

    if (type.type !== "TSTupleType") return undefined;
    const index = parent.elements.findIndex((element) => element === node);

    for (let position = 0; position <= index; position++) {
      const item = type.elementTypes[position];
      const element = item?.type === "TSNamedTupleMember" ? item.elementType : item;

      /** A variadic segment makes subsequent positional selections ambiguous. */
      if (element?.type === "TSRestType") return undefined;

      if (position === index)
        return element?.type === "TSOptionalType" ? element.typeAnnotation : element;
    }
  }

  return undefined;
}

export function isArray(context: Context, input: Ast, seen = new Set<Variable>()): boolean {
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
      const annotation = unwrapArrayType(bindingAnnotation(context, identifier));

      if (
        annotation &&
        (annotation.type === "TSArrayType" ||
          annotation.type === "TSTupleType" ||
          isArrayReference(context, annotation))
      )
        return true;
    }

    const decl = declaration(context, node);

    return !!decl?.init && decl.id.type === "Identifier" && isArray(context, decl.init, seen);
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
    isArray(context, callee.object, seen)
  );
}

export function walk(context: Context, node: Ast, visit: (node: Ast) => void): void {
  visit(node);

  for (const key of context.sourceCode.visitorKeys[node.type] ?? []) {
    /** SAFETY: Vite+'s visitor keys select only child nodes from its parsed AST. */
    const child = (node as Ast & Record<string, Ast | Ast[] | null>)[key];

    if (Array.isArray(child)) {
      for (const item of child) if (item) walk(context, item, visit);
    } else if (child) {
      walk(context, child, visit);
    }
  }
}
