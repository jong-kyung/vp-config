import type { Context, ESTree, Variable } from "vite-plus/lint/plugins";
import { binding, declaration, isFunction, isTransparentWrapper, unwrap, walk } from "./ast.ts";
import type { Ast } from "./ast.ts";

export class TypeAnalysis {
  readonly #context: Context;
  readonly #scopes = new Map<Ast, Map<string, ESTree.TSTypeAliasDeclaration | null>>();
  #indexed = false;

  constructor(context: Context) {
    this.#context = context;
  }

  #declare(node: Ast, name: string, alias: ESTree.TSTypeAliasDeclaration | null) {
    let owner = node.type === "ClassExpression" ? node : node.parent;

    while (owner?.type === "ExportNamedDeclaration" || owner?.type === "ImportDeclaration")
      owner = owner.parent;

    if (!owner) return;
    let entries = this.#scopes.get(owner);

    if (!entries) {
      entries = new Map();
      this.#scopes.set(owner, entries);
    }

    entries.set(name, alias);
  }

  #lookup(name: string, from: Ast): ESTree.TSTypeAliasDeclaration | null | undefined {
    if (!this.#indexed) {
      walk(this.#context, this.#context.sourceCode.ast, (node) => {
        if (node.type === "TSTypeAliasDeclaration") this.#declare(node, node.id.name, node);
        else if (
          node.type === "TSInterfaceDeclaration" ||
          node.type === "ClassDeclaration" ||
          node.type === "ClassExpression"
        ) {
          if (node.id) this.#declare(node, node.id.name, null);
        } else if (
          node.type === "ImportSpecifier" ||
          node.type === "ImportDefaultSpecifier" ||
          node.type === "ImportNamespaceSpecifier"
        ) {
          this.#declare(node, node.local.name, null);
        } else if (node.type === "TSImportEqualsDeclaration") {
          this.#declare(node, node.id.name, null);
        }
      });
      this.#indexed = true;
    }

    let node: Ast | null = from;

    while (node) {
      if (
        ("typeParameters" in node &&
          node.typeParameters?.params.some((parameter) => parameter.name.name === name)) ||
        (node.type === "TSMappedType" && node.key.name === name)
      )
        return null;
      const entries = this.#scopes.get(node);

      if (entries?.has(name)) return entries.get(name);
      node = node.parent;
    }

    return undefined;
  }

  /** Follow ordinary aliases only. Generic instantiation belongs to the type checker. */
  expand(input: ESTree.TSType): ESTree.TSType {
    let node = input;
    const seen = new Set<Ast>();

    while (!seen.has(node)) {
      seen.add(node);

      if (node.type === "TSParenthesizedType") {
        node = node.typeAnnotation;
      } else if (node.type === "TSTypeReference" && node.typeName.type === "Identifier") {
        const alias = this.#lookup(node.typeName.name, node);

        if (!alias || alias.typeParameters?.params.length || node.typeArguments) break;
        node = alias.typeAnnotation;
      } else break;
    }

    return node;
  }

  standard(node: ESTree.TSType, name: string): boolean {
    return (
      node.type === "TSTypeReference" &&
      node.typeName.type === "Identifier" &&
      node.typeName.name === name &&
      this.#lookup(name, node) === undefined
    );
  }

  contains(
    input: ESTree.TSType,
    kinds: readonly string[],
    promises = false,
    seen = new Set<Ast>(),
  ): boolean {
    const node = this.expand(input);

    if (kinds.includes(node.type)) return true;

    if (seen.has(node)) return false;
    const next = new Set(seen).add(node);

    if (node.type === "TSUnionType")
      return node.types.some((type) => this.contains(type, kinds, promises, next));

    if (
      promises &&
      node.type === "TSTypeReference" &&
      (this.standard(node, "Promise") || this.standard(node, "PromiseLike"))
    ) {
      const result = node.typeArguments?.params[0];

      return !!result && this.contains(result, kinds, true, next);
    }

    return false;
  }

  unsafeValue(input: ESTree.TSType, includeAny = true, seen = new Set<Ast>()): boolean {
    const node = this.expand(input);

    if (seen.has(node)) return false;

    if (node.type === "TSUnionType") {
      const next = new Set(seen).add(node);

      return node.types.some((type) => this.unsafeValue(type, includeAny, next));
    }

    return (
      ["TSUnknownKeyword", "TSObjectKeyword"].includes(node.type) ||
      (includeAny && node.type === "TSAnyKeyword") ||
      (node.type === "TSTypeLiteral" && node.members.length === 0)
    );
  }

  openDictionary(input: ESTree.TSType): boolean {
    const node = this.expand(input);
    let key: ESTree.TSType | undefined;

    if (node.type === "TSTypeReference" && this.standard(node, "Record"))
      key = node.typeArguments?.params[0];
    else if (node.type === "TSMappedType") key = node.nameType ?? node.constraint;

    if (key)
      return this.contains(key, [
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

  unsafeDictionary(input: ESTree.TSType): boolean {
    const node = this.expand(input);

    if (!this.openDictionary(node)) return false;

    if (node.type === "TSTypeReference") {
      const value = node.typeArguments?.params[1];

      return !!value && this.unsafeValue(value);
    }

    if (node.type === "TSMappedType")
      return !!node.typeAnnotation && this.unsafeValue(node.typeAnnotation);

    return (
      node.type === "TSTypeLiteral" &&
      node.members.some(
        (member) =>
          member.type === "TSIndexSignature" &&
          this.unsafeValue(member.typeAnnotation.typeAnnotation),
      )
    );
  }

  wide(type: ESTree.TSType, includeAny = false): boolean {
    return this.unsafeValue(type, includeAny) || this.openDictionary(type);
  }

  annotation(this: void, node: Ast): ESTree.TSType | undefined {
    while (node.type === "TSParameterProperty" || node.type === "AssignmentPattern")
      node = node.type === "TSParameterProperty" ? node.parameter : node.left;

    return "typeAnnotation" in node && node.typeAnnotation?.type === "TSTypeAnnotation"
      ? node.typeAnnotation.typeAnnotation
      : undefined;
  }

  known(node: Ast, seen = new Set<Variable>()): boolean {
    if (isTransparentWrapper(node)) {
      if (
        (node.type === "TSAsExpression" || node.type === "TSTypeAssertion") &&
        this.unsafeValue(node.typeAnnotation)
      )
        return false;

      return this.known(node.expression, seen);
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
    const variable = binding(this.#context, node);

    if (!variable || seen.has(variable)) return false;
    seen.add(variable);
    const type = variable.identifiers.map(this.annotation).find((item) => item !== undefined);

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
      ].includes(this.expand(type).type);
    const decl = declaration(this.#context, node);

    return decl?.init
      ? this.known(decl.init, seen)
      : variable.defs.some((definition) => isFunction(definition.node));
  }

  widened(input: Ast, seen = new Set<Variable>()): boolean {
    const node = unwrap(input);

    if (node.type !== "Identifier") return false;
    const variable = binding(this.#context, node);
    const decl = declaration(this.#context, node);

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
    const type = this.annotation(decl.id);

    if (type && this.wide(type, true) && this.known(decl.init)) return true;
    let initializer: Ast = decl.init;

    while (isTransparentWrapper(initializer)) {
      if (
        (initializer.type === "TSAsExpression" || initializer.type === "TSTypeAssertion") &&
        this.wide(initializer.typeAnnotation, true) &&
        this.known(initializer.expression)
      )
        return true;
      initializer = initializer.expression;
    }

    return this.widened(initializer, seen);
  }
}
