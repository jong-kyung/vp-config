import type { Context, ESTree, Variable } from "vite-plus/lint/plugins";
import { binding, declaration, isFunction, isTransparentWrapper, unwrap, walk } from "./ast.ts";
import type { Ast } from "./ast.ts";

export function createTypeAnalysis(context: Context) {
  const scopes = new Map<Ast, Map<string, ESTree.TSTypeAliasDeclaration | null>>();
  let indexed = false;

  function declare(node: Ast, name: string, alias: ESTree.TSTypeAliasDeclaration | null) {
    let owner = node.type === "ClassExpression" ? node : node.parent;

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

  function lookup(name: string, from: Ast): ESTree.TSTypeAliasDeclaration | null | undefined {
    if (!indexed) {
      walk(context, context.sourceCode.ast, (node) => {
        if (node.type === "TSTypeAliasDeclaration") declare(node, node.id.name, node);
        else if (
          node.type === "TSInterfaceDeclaration" ||
          node.type === "ClassDeclaration" ||
          node.type === "ClassExpression"
        ) {
          if (node.id) declare(node, node.id.name, null);
        } else if (
          node.type === "ImportSpecifier" ||
          node.type === "ImportDefaultSpecifier" ||
          node.type === "ImportNamespaceSpecifier"
        ) {
          declare(node, node.local.name, null);
        } else if (node.type === "TSImportEqualsDeclaration") {
          declare(node, node.id.name, null);
        }
      });
      indexed = true;
    }

    let node: Ast | null = from;

    while (node) {
      if (
        ("typeParameters" in node &&
          node.typeParameters?.params.some((parameter) => parameter.name.name === name)) ||
        (node.type === "TSMappedType" && node.key.name === name)
      )
        return null;
      const entries = scopes.get(node);

      if (entries?.has(name)) return entries.get(name);
      node = node.parent;
    }

    return undefined;
  }

  /** Follow ordinary aliases only. Generic instantiation belongs to the type checker. */
  function expand(input: ESTree.TSType): ESTree.TSType {
    let node = input;
    const seen = new Set<Ast>();

    while (!seen.has(node)) {
      seen.add(node);

      if (node.type === "TSParenthesizedType") {
        node = node.typeAnnotation;
      } else if (node.type === "TSTypeReference" && node.typeName.type === "Identifier") {
        const alias = lookup(node.typeName.name, node);

        if (!alias || alias.typeParameters?.params.length || node.typeArguments) break;
        node = alias.typeAnnotation;
      } else break;
    }

    return node;
  }

  function standard(node: ESTree.TSType, name: string): boolean {
    return (
      node.type === "TSTypeReference" &&
      node.typeName.type === "Identifier" &&
      node.typeName.name === name &&
      lookup(name, node) === undefined
    );
  }

  function contains(
    input: ESTree.TSType,
    kinds: readonly string[],
    promises = false,
    seen = new Set<Ast>(),
  ): boolean {
    const node = expand(input);

    if (kinds.includes(node.type)) return true;

    if (seen.has(node)) return false;
    const next = new Set(seen).add(node);

    if (node.type === "TSUnionType")
      return node.types.some((type) => contains(type, kinds, promises, next));

    if (
      promises &&
      node.type === "TSTypeReference" &&
      (standard(node, "Promise") || standard(node, "PromiseLike"))
    ) {
      const result = node.typeArguments?.params[0];

      return !!result && contains(result, kinds, true, next);
    }

    return false;
  }

  function unsafeValue(input: ESTree.TSType, includeAny = true, seen = new Set<Ast>()): boolean {
    const node = expand(input);

    if (seen.has(node)) return false;

    if (node.type === "TSUnionType") {
      const next = new Set(seen).add(node);

      return node.types.some((type) => unsafeValue(type, includeAny, next));
    }

    return (
      ["TSUnknownKeyword", "TSObjectKeyword"].includes(node.type) ||
      (includeAny && node.type === "TSAnyKeyword") ||
      (node.type === "TSTypeLiteral" && node.members.length === 0)
    );
  }

  function openDictionary(input: ESTree.TSType): boolean {
    const node = expand(input);
    let key: ESTree.TSType | undefined;

    if (node.type === "TSTypeReference" && standard(node, "Record"))
      key = node.typeArguments?.params[0];
    else if (node.type === "TSMappedType") key = node.nameType ?? node.constraint;

    if (key)
      return contains(key, [
        "TSStringKeyword",
        "TSNumberKeyword",
        "TSSymbolKeyword",
        "TSAnyKeyword",
      ]);

    return (
      node.type === "TSTypeLiteral" &&
      node.members.some((member) => member.type === "TSIndexSignature")
    );
  }

  function unsafeDictionary(input: ESTree.TSType): boolean {
    const node = expand(input);

    if (!openDictionary(node)) return false;

    if (node.type === "TSTypeReference") {
      const value = node.typeArguments?.params[1];

      return !!value && unsafeValue(value);
    }

    if (node.type === "TSMappedType")
      return !!node.typeAnnotation && unsafeValue(node.typeAnnotation);

    return (
      node.type === "TSTypeLiteral" &&
      node.members.some(
        (member) =>
          member.type === "TSIndexSignature" && unsafeValue(member.typeAnnotation.typeAnnotation),
      )
    );
  }

  function wide(type: ESTree.TSType, includeAny = false): boolean {
    return unsafeValue(type, includeAny) || type.type === "TSTypeLiteral" || openDictionary(type);
  }

  function annotation(node: Ast): ESTree.TSType | undefined {
    if (node.type === "TSParameterProperty") return annotation(node.parameter);

    if (node.type === "AssignmentPattern") return annotation(node.left);

    return "typeAnnotation" in node && node.typeAnnotation?.type === "TSTypeAnnotation"
      ? node.typeAnnotation.typeAnnotation
      : undefined;
  }

  function known(node: Ast, seen = new Set<Variable>()): boolean {
    if (isTransparentWrapper(node)) {
      if (
        (node.type === "TSAsExpression" || node.type === "TSTypeAssertion") &&
        unsafeValue(node.typeAnnotation)
      )
        return false;

      return known(node.expression, seen);
    }

    if (isFunction(node)) return true;

    if (
      [
        "Literal",
        "ObjectExpression",
        "ArrayExpression",
        "TemplateLiteral",
        "ClassExpression",
        "NewExpression",
      ].includes(node.type)
    )
      return true;

    if (node.type !== "Identifier") return false;
    const variable = binding(context, node);

    if (!variable || seen.has(variable)) return false;
    seen.add(variable);
    const type = variable.identifiers.map(annotation).find((item) => item !== undefined);

    if (type)
      return [
        "TSStringKeyword",
        "TSNumberKeyword",
        "TSBooleanKeyword",
        "TSBigIntKeyword",
        "TSSymbolKeyword",
        "TSNullKeyword",
        "TSUndefinedKeyword",
        "TSLiteralType",
        "TSArrayType",
        "TSTupleType",
        "TSTypeLiteral",
        "TSFunctionType",
        "TSConstructorType",
      ].includes(expand(type).type);
    const decl = declaration(context, node);

    return decl?.init
      ? known(decl.init, seen)
      : variable.defs.some((definition) => isFunction(definition.node));
  }

  function widened(input: Ast, seen = new Set<Variable>()): boolean {
    const node = unwrap(input);

    if (node.type !== "Identifier") return false;
    const variable = binding(context, node);
    const decl = declaration(context, node);

    if (
      !variable ||
      seen.has(variable) ||
      !decl?.init ||
      decl.id.type !== "Identifier" ||
      decl.parent.type !== "VariableDeclaration" ||
      decl.parent.kind !== "const"
    )
      return false;
    seen.add(variable);
    const type = annotation(decl.id);

    if (type && wide(type, true) && known(decl.init)) return true;
    let initializer: Ast = decl.init;

    while (isTransparentWrapper(initializer)) {
      if (
        (initializer.type === "TSAsExpression" || initializer.type === "TSTypeAssertion") &&
        wide(initializer.typeAnnotation, true) &&
        known(initializer.expression)
      )
        return true;
      initializer = initializer.expression;
    }

    return widened(initializer, seen);
  }

  return {
    expand,
    standard,
    contains,
    unsafeValue,
    unsafeDictionary,
    openDictionary,
    wide,
    annotation,
    known,
    widened,
  };
}
