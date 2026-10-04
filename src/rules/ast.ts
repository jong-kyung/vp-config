import type { Context, ESTree, Options, Variable } from "vite-plus/lint/plugins";

export type Ast = ESTree.Node;

export type FunctionNode = ESTree.Function | ESTree.ArrowFunctionExpression;

export function unwrap(node: Ast): Ast {
  while (
    node.type === "ParenthesizedExpression" ||
    node.type === "ChainExpression" ||
    node.type === "TSAsExpression" ||
    node.type === "TSTypeAssertion" ||
    node.type === "TSSatisfiesExpression" ||
    node.type === "TSNonNullExpression"
  ) {
    node = node.expression;
  }

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
  let scope = context.sourceCode.getScope(node);

  for (;;) {
    const variable = scope.set.get(node.name);

    if (variable) return variable;

    if (!scope.upper) return undefined;
    scope = scope.upper;
  }
}

export function declaration(context: Context, node: Ast): ESTree.VariableDeclarator | undefined {
  const variable = binding(context, node);

  if (!variable || variable.references.some((reference) => reference.isWrite() && !reference.init))
    return undefined;
  const definition = variable.defs.find((item) => item.node.type === "VariableDeclarator");

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
      if (
        property.type !== "Property" ||
        property.value.type !== "Identifier" ||
        property.value.name !== node.name
      )
        continue;

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

export function isArray(context: Context, input: Ast, seen = new Set<Variable>()): boolean {
  const node = unwrap(input);

  if (node.type === "ArrayExpression") return true;

  if (node.type === "Identifier") {
    const variable = binding(context, node);

    if (!variable || seen.has(variable)) return false;
    seen.add(variable);

    if (variable.references.some((reference) => reference.isWrite() && !reference.init))
      return false;

    const identifier = variable.identifiers.find(
      (id) => id.type === "Identifier" && id.typeAnnotation,
    );

    let annotation =
      identifier && "typeAnnotation" in identifier
        ? identifier.typeAnnotation?.typeAnnotation
        : undefined;

    while (
      annotation?.type === "TSParenthesizedType" ||
      (annotation?.type === "TSTypeOperator" && annotation.operator === "readonly")
    ) {
      annotation = annotation.typeAnnotation;
    }

    if (annotation?.type === "TSArrayType" || annotation?.type === "TSTupleType") return true;

    if (
      annotation?.type === "TSTypeReference" &&
      annotation.typeName.type === "Identifier" &&
      ["Array", "ReadonlyArray"].includes(annotation.typeName.name) &&
      !binding(context, annotation.typeName)?.defs.length
    )
      return true;
    const decl = declaration(context, node);

    return !!decl?.init && decl.id.type === "Identifier" && isArray(context, decl.init, seen);
  }

  if (node.type === "NewExpression") return referencePath(context, node.callee) === "Array";

  if (node.type !== "CallExpression") return false;

  if (["Array.from", "Array.of"].includes(referencePath(context, node.callee) ?? "")) return true;
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
