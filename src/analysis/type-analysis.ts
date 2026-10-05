import type { Context, ESTree, Variable } from "vite-plus/lint/plugins";
import {
  binding,
  declaration,
  isFunction,
  isTransparentWrapper,
  resolveValue,
  unwrap,
  walk,
} from "./ast.ts";
import type { Ast, FunctionNode } from "./ast.ts";

export interface TypeUse {
  node: ESTree.TSType;
  bindings: ReadonlyMap<string, TypeUse>;
}

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

  function lookup(
    name: string,
    from: Ast,
  ): ESTree.TSTypeAliasDeclaration | ESTree.TSTypeParameter | null | undefined {
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
      if ("typeParameters" in node) {
        const parameter = node.typeParameters?.params.find((item) => item.name.name === name);

        if (parameter) return parameter;
      }

      const entries = scopes.get(node);

      if (entries?.has(name)) return entries.get(name);
      node = node.parent;
    }

    return undefined;
  }

  function use(node: ESTree.TSType, bindings: ReadonlyMap<string, TypeUse> = new Map()): TypeUse {
    return { node, bindings };
  }

  function expand(input: TypeUse, unwrapReadonly = false): TypeUse {
    let current = input;
    const seen = new Set<Ast>();
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

      if (unwrapReadonly && standard(current, "Readonly")) {
        const argument = node.typeArguments?.params[0];

        /** Generic wrappers can share an AST node while carrying different bindings. */
        if (!argument || substitutions.has(current)) return current;
        substitutions.add(current);
        current = use(argument, current.bindings);

        continue;
      }

      if (seen.has(node)) return current;
      seen.add(node);
      const alias = lookup(node.typeName.name, node);

      if (alias?.type !== "TSTypeAliasDeclaration") return current;
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

  function unsafeValue(input: TypeUse, includeAny = true, seen = new Set<Ast>()): boolean {
    const current = expand(input);
    const node = current.node;

    if (seen.has(node)) return false;

    if (node.type === "TSUnionType") {
      const next = new Set(seen).add(node);

      return node.types.some((type) => unsafeValue(use(type, current.bindings), includeAny, next));
    }

    return (
      ["TSUnknownKeyword", "TSObjectKeyword"].includes(node.type) ||
      (includeAny && node.type === "TSAnyKeyword") ||
      (node.type === "TSTypeLiteral" && node.members.length === 0)
    );
  }

  function unsafeDictionary(input: TypeUse): boolean {
    const current = expand(input);
    const node = current.node;

    if (standard(current, "Record") && node.type === "TSTypeReference") {
      const value = node.typeArguments?.params[1];

      return !!value && openDictionary(current) && unsafeValue(use(value, current.bindings));
    }

    if (node.type === "TSTypeLiteral") {
      return node.members.some(
        (member) =>
          member.type === "TSIndexSignature" &&
          unsafeValue(use(member.typeAnnotation.typeAnnotation, current.bindings)),
      );
    }

    if (node.type === "TSMappedType" && node.typeAnnotation && openDictionary(current))
      return unsafeValue(use(node.typeAnnotation, current.bindings));

    return false;
  }

  function openDictionary(input: TypeUse): boolean {
    const current = expand(input);
    const node = current.node;

    let key: TypeUse | undefined;

    if (standard(current, "Record") && node.type === "TSTypeReference") {
      const argument = node.typeArguments?.params[0];

      if (argument) key = use(argument, current.bindings);
    } else if (node.type === "TSMappedType") {
      const constraint = use(node.constraint, current.bindings);
      key = node.nameType
        ? use(node.nameType, new Map(current.bindings).set(node.key.name, constraint))
        : constraint;
    }

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

  function wide(input: TypeUse, includeAny = false): boolean {
    return (
      unsafeValue(input, includeAny) || input.node.type === "TSTypeLiteral" || openDictionary(input)
    );
  }

  function annotation(node: Ast): ESTree.TSType | undefined {
    if (node.type === "TSParameterProperty") return annotation(node.parameter);

    if (node.type === "AssignmentPattern") return annotation(node.left);

    return "typeAnnotation" in node && node.typeAnnotation?.type === "TSTypeAnnotation"
      ? node.typeAnnotation.typeAnnotation
      : undefined;
  }

  /** ponytail: scan tuple prefixes per argument. Cache projections if large tuples become costly. */
  function restElement(input: TypeUse, index: number, seen = new Set<Ast>()): TypeUse | undefined {
    const current = expand(input, true);
    const node = current.node;

    if (seen.has(node)) return undefined;
    const next = new Set(seen).add(node);

    if (node.type === "TSNamedTupleMember") {
      const element = node.elementType;

      return restElement(
        use(
          element.type === "TSOptionalType" || element.type === "TSRestType"
            ? element.typeAnnotation
            : element,
          current.bindings,
        ),
        index,
        next,
      );
    }

    if (node.type === "TSTypeOperator" && node.operator === "readonly")
      return restElement(use(node.typeAnnotation, current.bindings), index, next);

    if (node.type === "TSArrayType") return use(node.elementType, current.bindings);

    if (
      node.type === "TSTypeReference" &&
      (standard(current, "Array") || standard(current, "ReadonlyArray"))
    ) {
      const element = node.typeArguments?.params[0];

      return element && use(element, current.bindings);
    }

    if (node.type !== "TSTupleType") return undefined;

    for (let position = 0; position <= index; position++) {
      const member = node.elementTypes[position];
      const element = member?.type === "TSNamedTupleMember" ? member.elementType : member;

      if (!element) return undefined;

      if (element.type === "TSRestType") {
        /** ponytail: only trailing variadics. Model tuple arity before selecting later fields. */
        return position === node.elementTypes.length - 1
          ? restElement(use(element.typeAnnotation, current.bindings), index - position, next)
          : undefined;
      }

      if (position === index)
        return use(
          element.type === "TSOptionalType" ? element.typeAnnotation : element,
          current.bindings,
        );
    }

    return undefined;
  }

  function functionValue(node: Ast): FunctionNode | undefined {
    const value = resolveValue(context, node);

    if (isFunction(value)) return value;
    const variable = binding(context, value);

    let fn: FunctionNode | undefined;

    for (const definition of variable?.defs ?? []) {
      if (!isFunction(definition.node)) continue;

      /** Overload selection requires argument type information unavailable to this analysis. */
      if (fn) return undefined;
      fn = definition.node;
    }

    return fn;
  }

  function callBindings(node: ESTree.CallExpression, fn: FunctionNode) {
    if (!node.typeArguments || !fn.typeParameters) return undefined;
    const bindings = new Map<string, TypeUse>();

    for (const [index, parameter] of fn.typeParameters.params.entries()) {
      const argument = node.typeArguments.params[index];

      if (argument) bindings.set(parameter.name.name, use(argument));
      else if (parameter.default)
        bindings.set(parameter.name.name, use(parameter.default, bindings));
    }

    return bindings;
  }

  function knownType(input: TypeUse, seen = new Set<Ast>()): boolean {
    const current = expand(input);
    const node = current.node;

    if (
      seen.has(node) ||
      ["TSUnknownKeyword", "TSAnyKeyword", "TSObjectKeyword"].includes(node.type)
    )
      return false;

    if (node.type === "TSUnionType") {
      const next = new Set(seen).add(node);

      return node.types.every((type) => knownType(use(type, current.bindings), next));
    }

    return (
      node.type !== "TSTypeReference" ||
      node.typeName.type !== "Identifier" ||
      lookup(node.typeName.name, node)?.type !== "TSTypeParameter"
    );
  }

  function known(node: Ast, seen = new Set<Variable>()): boolean {
    if (isTransparentWrapper(node)) {
      if (
        (node.type === "TSAsExpression" || node.type === "TSTypeAssertion") &&
        contains(use(node.typeAnnotation), ["TSUnknownKeyword", "TSAnyKeyword", "TSObjectKeyword"])
      )
        return false;

      return known(node.expression, seen);
    }

    if (
      [
        "Literal",
        "ObjectExpression",
        "ArrayExpression",
        "TemplateLiteral",
        "FunctionExpression",
        "ArrowFunctionExpression",
        "ClassExpression",
        "NewExpression",
      ].includes(node.type)
    )
      return true;

    if (node.type === "Identifier") {
      const variable = binding(context, node);

      if (!variable || seen.has(variable)) return false;
      const next = new Set(seen).add(variable);

      for (const identifier of variable.identifiers) {
        const type = annotation(identifier);

        if (type) return knownType(use(type));
      }

      const decl = declaration(context, node);

      if (decl?.init) return known(decl.init, next);

      return variable.defs.some((definition) => isFunction(definition.node));
    }

    if (node.type === "CallExpression") {
      const fn = functionValue(node.callee);

      if (!fn?.returnType) return false;

      return knownType(use(fn.returnType.typeAnnotation, callBindings(node, fn)));
    }

    if (node.type === "ConditionalExpression")
      return known(node.consequent, seen) && known(node.alternate, seen);

    if (node.type === "UnaryExpression") return node.operator !== "void";

    if (node.type === "BinaryExpression")
      return (
        ["===", "!==", "==", "!=", "<", "<=", ">", ">=", "in", "instanceof"].includes(
          node.operator,
        ) ||
        (known(node.left, seen) && known(node.right, seen))
      );

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

    if (type && wide(use(type), true) && known(decl.init)) return true;
    let initializer: Ast = decl.init;

    while (isTransparentWrapper(initializer)) {
      if (
        (initializer.type === "TSAsExpression" || initializer.type === "TSTypeAssertion") &&
        wide(use(initializer.typeAnnotation), true) &&
        known(initializer.expression)
      )
        return true;
      initializer = initializer.expression;
    }

    return widened(initializer, next);
  }

  return {
    use,
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
    functionValue,
    callBindings,
    restElement,
  };
}
