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

export function propertyName(node: Ast, computed = false): string | undefined {
  if (!computed && (node.type === "Identifier" || node.type === "PrivateIdentifier"))
    return node.name;

  if (node.type === "Literal" && isString(node.value)) return node.value;

  if (node.type === "TemplateLiteral" && node.expressions.length === 0)
    return node.quasis[0]?.value.cooked ?? undefined;

  return undefined;
}

export function memberName(node: Ast): string | undefined {
  return node.type === "MemberExpression" ? propertyName(node.property, node.computed) : undefined;
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
export function hasReassignment(variable: Variable): boolean {
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

      const object = referencePath(context, decl.init, seen);
      const key = propertyName(property.key, property.computed);

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
