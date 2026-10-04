import type { Context, ESTree, Variable } from "vite-plus/lint/plugins";
import { binding, declaration, isFunction, resolveValue, unwrap, walk } from "./ast.ts";
import type { Ast, FunctionNode } from "./ast.ts";

interface TypeUse {
  node: ESTree.TSType;
  bindings: ReadonlyMap<string, TypeUse>;
}

export function createTypeAnalysis(context: Context) {
  const scopes = new Map<Ast, Map<string, ESTree.TSTypeAliasDeclaration | null>>();

  function declare(node: Ast, name: string, alias: ESTree.TSTypeAliasDeclaration | null) {
    let owner = node.parent;
    while (owner?.type === "ExportNamedDeclaration" || owner?.type === "ImportDeclaration")
      owner = owner.parent;
    if (!owner) return;
    let entries = scopes.get(owner);
    if (!entries) {
      entries = new Map();
      scopes.set(owner, entries);
    }
    entries.set(name, alias);
  }

  walk(context, context.sourceCode.ast, (node) => {
    if (node.type === "TSTypeAliasDeclaration") declare(node, node.id.name, node);
    else if (node.type === "TSInterfaceDeclaration" || node.type === "ClassDeclaration") {
      if (node.id) declare(node, node.id.name, null);
    } else if (
      node.type === "ImportSpecifier" ||
      node.type === "ImportDefaultSpecifier" ||
      node.type === "ImportNamespaceSpecifier"
    ) {
      declare(node, node.local.name, null);
    }
  });

  function lookup(name: string, from: Ast): ESTree.TSTypeAliasDeclaration | null | undefined {
    let node: Ast | null = from;
    while (node) {
      if (
        "typeParameters" in node &&
        node.typeParameters?.params.some((parameter) => parameter.name.name === name)
      )
        return null;
      const entries = scopes.get(node);
      if (entries?.has(name)) return entries.get(name);
      node = node.parent;
    }
    return undefined;
  }

  function use(node: ESTree.TSType, bindings: ReadonlyMap<string, TypeUse> = new Map()): TypeUse {
    return { node, bindings };
  }

  function expand(input: TypeUse, seen = new Set<Ast>()): TypeUse {
    let current = input;
    const substitutions = new Set<TypeUse>();
    for (;;) {
      const node = current.node;
      if (node.type === "TSParenthesizedType") {
        current = use(node.typeAnnotation, current.bindings);
        continue;
      }
      if (node.type !== "TSTypeReference" || node.typeName.type !== "Identifier") return current;
      const replacement = current.bindings.get(node.typeName.name);
      if (replacement) {
        if (substitutions.has(current)) return current;
        substitutions.add(current);
        current = replacement;
        continue;
      }
      if (seen.has(node)) return current;
      seen.add(node);
      const alias = lookup(node.typeName.name, node);
      if (!alias) return current;
      const argumentsMap = new Map<string, TypeUse>();
      for (const [index, parameter] of (alias.typeParameters?.params ?? []).entries()) {
        const argument = node.typeArguments?.params[index];
        if (argument) argumentsMap.set(parameter.name.name, use(argument, current.bindings));
        else if (parameter.default)
          argumentsMap.set(parameter.name.name, use(parameter.default, argumentsMap));
      }
      current = use(alias.typeAnnotation, argumentsMap);
    }
  }

  function standard(input: TypeUse, name: string): boolean {
    const { node } = input;
    return (
      node.type === "TSTypeReference" &&
      node.typeName.type === "Identifier" &&
      node.typeName.name === name &&
      lookup(name, node) === undefined
    );
  }

  function contains(
    input: TypeUse,
    kinds: readonly string[],
    promises = false,
    seen = new Set<Ast>(),
  ): boolean {
    const current = expand(input);
    const node = current.node;
    if (kinds.includes(node.type)) return true;
    if (seen.has(node)) return false;
    const next = new Set(seen).add(node);
    if (node.type === "TSUnionType")
      return node.types.some((type) =>
        contains(use(type, current.bindings), kinds, promises, next),
      );
    if (
      promises &&
      node.type === "TSTypeReference" &&
      (standard(current, "Promise") || standard(current, "PromiseLike"))
    ) {
      const result = node.typeArguments?.params[0];
      return !!result && contains(use(result, current.bindings), kinds, true, next);
    }
    return false;
  }

  function unsafeValue(input: TypeUse): boolean {
    const current = expand(input);
    if (contains(current, ["TSUnknownKeyword", "TSAnyKeyword", "TSObjectKeyword"])) return true;
    const node = current.node;
    return node.type === "TSTypeLiteral" && node.members.length === 0;
  }

  function unsafeDictionary(input: TypeUse): boolean {
    const current = expand(input);
    const node = current.node;
    if (standard(current, "Record") && node.type === "TSTypeReference") {
      const value = node.typeArguments?.params[1];
      return !!value && unsafeValue(use(value, current.bindings));
    }
    if (node.type === "TSTypeLiteral") {
      return node.members.some(
        (member) =>
          member.type === "TSIndexSignature" &&
          unsafeValue(use(member.typeAnnotation.typeAnnotation, current.bindings)),
      );
    }
    if (node.type === "TSMappedType" && node.typeAnnotation)
      return unsafeValue(use(node.typeAnnotation, current.bindings));
    return false;
  }

  function openDictionary(input: TypeUse): boolean {
    const current = expand(input);
    const node = current.node;
    if (standard(current, "Record") && node.type === "TSTypeReference") {
      const key = node.typeArguments?.params[0];
      return (
        !!key &&
        contains(use(key, current.bindings), [
          "TSStringKeyword",
          "TSNumberKeyword",
          "TSSymbolKeyword",
          "TSAnyKeyword",
        ])
      );
    }
    return (
      node.type === "TSTypeLiteral" &&
      node.members.some((member) => member.type === "TSIndexSignature")
    );
  }

  function wide(type: ESTree.TSType, includeAny = false): boolean {
    const input = use(type);
    return (
      contains(
        input,
        includeAny
          ? ["TSUnknownKeyword", "TSObjectKeyword", "TSAnyKeyword"]
          : ["TSUnknownKeyword", "TSObjectKeyword"],
      ) ||
      type.type === "TSTypeLiteral" ||
      openDictionary(input)
    );
  }

  function annotation(node: Ast): ESTree.TSType | undefined {
    if (node.type === "TSParameterProperty") return annotation(node.parameter);
    if (node.type === "AssignmentPattern") return annotation(node.left);
    return "typeAnnotation" in node && node.typeAnnotation?.type === "TSTypeAnnotation"
      ? node.typeAnnotation.typeAnnotation
      : undefined;
  }

  function functionValue(node: Ast): FunctionNode | undefined {
    const value = resolveValue(context, node);
    if (isFunction(value)) return value;
    const variable = binding(context, value);
    for (const definition of variable?.defs ?? []) {
      if (isFunction(definition.node)) return definition.node;
    }
    return undefined;
  }

  function known(input: Ast, seen = new Set<Variable>()): boolean {
    if (input.type === "ParenthesizedExpression") return known(input.expression, seen);
    if (
      (input.type === "TSAsExpression" || input.type === "TSTypeAssertion") &&
      contains(use(input.typeAnnotation), ["TSUnknownKeyword", "TSAnyKeyword", "TSObjectKeyword"])
    )
      return false;
    const node = unwrap(input);
    if (
      [
        "Literal",
        "ObjectExpression",
        "ArrayExpression",
        "TemplateLiteral",
        "FunctionExpression",
        "ArrowFunctionExpression",
        "ClassExpression",
      ].includes(node.type)
    )
      return true;
    if (node.type === "Identifier") {
      const variable = binding(context, node);
      if (!variable || seen.has(variable)) return false;
      const next = new Set(seen).add(variable);
      for (const identifier of variable.identifiers) {
        const type = annotation(identifier);
        if (type) {
          if (contains(use(type), ["TSUnknownKeyword", "TSAnyKeyword", "TSObjectKeyword"]))
            return false;
          const resolved = expand(use(type)).node;
          if (
            resolved.type === "TSTypeReference" &&
            resolved.typeName.type === "Identifier" &&
            lookup(resolved.typeName.name, resolved) === null
          ) {
            // Imported and interface contracts are known; a bare generic parameter is not.
            const name = resolved.typeName.name;
            let parent: Ast | null = resolved.parent;
            while (parent) {
              if (
                "typeParameters" in parent &&
                parent.typeParameters?.params.some((parameter) => parameter.name.name === name)
              )
                return false;
              parent = parent.parent;
            }
          }
          return true;
        }
      }
      const decl = declaration(context, node);
      if (decl?.init) return known(decl.init, next);
      return variable.defs.some((definition) => isFunction(definition.node));
    }
    if (node.type === "CallExpression") {
      const fn = functionValue(node.callee);
      const type = fn?.returnType?.typeAnnotation;
      return (
        !!type && !contains(use(type), ["TSUnknownKeyword", "TSAnyKeyword", "TSObjectKeyword"])
      );
    }
    if (node.type === "UnaryExpression") return node.operator !== "void";
    if (node.type === "BinaryExpression") return known(node.left, seen) && known(node.right, seen);
    return false;
  }

  function widened(input: Ast, seen = new Set<Variable>()): boolean {
    const node = unwrap(input);
    if (node.type !== "Identifier") return false;
    const variable = binding(context, node);
    if (!variable || seen.has(variable)) return false;
    const decl = declaration(context, node);
    if (
      !decl?.init ||
      decl.id.type !== "Identifier" ||
      decl.parent.type !== "VariableDeclaration" ||
      decl.parent.kind !== "const"
    )
      return false;
    const next = new Set(seen).add(variable);
    const type = annotation(decl.id);
    if (type && wide(type, true) && known(decl.init)) return true;
    let initializer: Ast = decl.init;
    while (initializer.type === "ParenthesizedExpression") initializer = initializer.expression;
    if (
      (initializer.type === "TSAsExpression" || initializer.type === "TSTypeAssertion") &&
      wide(initializer.typeAnnotation, true) &&
      known(initializer.expression)
    )
      return true;
    return widened(initializer, next);
  }

  return {
    use,
    expand,
    contains,
    unsafeValue,
    unsafeDictionary,
    openDictionary,
    wide,
    annotation,
    known,
    widened,
    functionValue,
  };
}
