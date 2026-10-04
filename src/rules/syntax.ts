import { defineRule } from "vite-plus/lint/plugins";
import type { Context, ESTree, Rule } from "vite-plus/lint/plugins";
import {
  binding,
  enclosingFunction,
  isArray,
  isConstType,
  isOptionsObject,
  memberName,
  referencePath,
  resolveValue,
  unwrap,
} from "./ast.ts";
import type { Ast } from "./ast.ts";

function assertionChain(node: Ast): (ESTree.TSAsExpression | ESTree.TSTypeAssertion)[] {
  const assertions: (ESTree.TSAsExpression | ESTree.TSTypeAssertion)[] = [];

  for (;;) {
    if (node.type === "ParenthesizedExpression") node = node.expression;
    else if (node.type === "TSAsExpression" || node.type === "TSTypeAssertion") {
      assertions.push(node);
      node = node.expression;
    } else return assertions;
  }
}

function isEmptyObject(node: Ast): boolean {
  const value = unwrap(node);

  return value.type === "ObjectExpression" && value.properties.length === 0;
}

function reflectRule(method: "apply" | "get"): Rule {
  return defineRule({
    meta: { schema: [], messages: { avoid: `Use typed access instead of Reflect.${method}().` } },
    create(context) {
      return {
        CallExpression(node) {
          if (referencePath(context, node.callee) === `Reflect.${method}`)
            context.report({ node, messageId: "avoid" });
        },
      };
    },
  });
}

function checkStaticClass(context: Context, node: ESTree.Class): void {
  if (
    node.superClass ||
    node.abstract ||
    node.declare ||
    node.decorators.length ||
    node.implements?.length
  )
    return;
  let count = 0;

  for (const member of node.body.body) {
    if (
      member.type === "StaticBlock" ||
      member.type === "TSIndexSignature" ||
      member.decorators.length
    )
      return;

    if (
      member.type === "MethodDefinition" &&
      member.kind === "constructor" &&
      member.value.params.length === 0 &&
      !member.value.body?.body.length
    )
      continue;

    if (!member.static) return;
    count++;
  }

  if (count > 0) context.report({ node, messageId: "avoid" });
}

function checkReducerCopy(context: Context, node: ESTree.CallExpression): void {
  const fn = enclosingFunction(node);

  if (!fn) return;
  let parent: Ast = fn;

  while (parent.parent?.type === "ParenthesizedExpression") parent = parent.parent;
  const call = parent.parent;

  if (
    call?.type !== "CallExpression" ||
    call.arguments[0] !== parent ||
    !["reduce", "reduceRight"].includes(memberName(unwrap(call.callee)) ?? "")
  )
    return;
  const accumulator = fn.params[0];

  if (accumulator?.type !== "Identifier") return;
  const variable = binding(context, accumulator);

  if (!variable) return;

  const isAccumulator = (value: Ast): boolean =>
    binding(context, resolveValue(context, value)) === variable;

  const path = referencePath(context, node.callee);
  const initial = call.arguments[1];
  const arrayAccumulator = (initial && isArray(context, initial)) || isArray(context, accumulator);
  let copies = false;

  if (path === "Object.assign" && node.arguments[0]?.type === "ObjectExpression") {
    copies = node.arguments.slice(1).some(isAccumulator);
  } else if (arrayAccumulator && path === "Array.from" && node.arguments[0]) {
    copies = isAccumulator(node.arguments[0]);
  } else {
    const callee = unwrap(node.callee);
    copies =
      !!arrayAccumulator &&
      callee.type === "MemberExpression" &&
      ["concat", "slice", "toSorted", "toReversed", "toSpliced", "with"].includes(
        memberName(callee) ?? "",
      ) &&
      isAccumulator(callee.object);
  }

  if (copies) context.report({ node, messageId: "avoid" });
}

export const syntaxRules = {
  "no-chained-type-assertions": defineRule({
    meta: {
      schema: [],
      messages: { avoid: "Validate the value instead of chaining type assertions." },
    },
    create(context) {
      function check(node: ESTree.TSAsExpression | ESTree.TSTypeAssertion) {
        let parent = node.parent;

        while (parent.type === "ParenthesizedExpression") parent = parent.parent;

        if (parent.type === "TSAsExpression" || parent.type === "TSTypeAssertion") return;
        const chain = assertionChain(node);

        if (chain.length > 1 && chain.some((item) => !isConstType(item.typeAnnotation)))
          context.report({ node, messageId: "avoid" });
      }

      return { TSAsExpression: check, TSTypeAssertion: check };
    },
  }),
  "no-conditional-empty-object-spread": defineRule({
    meta: {
      schema: [],
      messages: {
        avoid:
          "Express conditional property omission without spreading a conditional empty object.",
      },
    },
    create(context) {
      return {
        SpreadElement(node) {
          if (node.parent.type !== "ObjectExpression") return;
          const value = unwrap(node.argument);

          if (
            value.type === "ConditionalExpression" &&
            (isEmptyObject(value.consequent) || isEmptyObject(value.alternate))
          )
            context.report({ node, messageId: "avoid" });
        },
      };
    },
  }),
  "no-reflect-apply": reflectRule("apply"),
  "no-reflect-get": reflectRule("get"),
  "no-module-mocking": defineRule({
    meta: {
      schema: [],
      messages: { avoid: "Use an explicit dependency boundary instead of replacing a module." },
    },
    create(context) {
      return {
        CallExpression(node) {
          const path = referencePath(context, node.callee);

          if (
            path &&
            /^(?:vi|vitest|jest|(?:vitest|vite-plus\/test)\.(?:vi|vitest)|@jest\/globals\.jest)\.(?:mock|doMock|unstable_mockModule)$/.test(
              path,
            )
          )
            context.report({ node, messageId: "avoid" });
        },
      };
    },
  }),
  "no-runtime-typeof": defineRule({
    meta: {
      schema: [
        {
          type: "object",
          properties: { allowInTypeGuards: { type: "boolean" } },
          additionalProperties: false,
        },
      ],
      messages: { avoid: "Validate boundary values in a parser or an explicit type guard." },
    },
    create(context) {
      const option = context.options[0];

      const allowInTypeGuards = isOptionsObject(option) && option.allowInTypeGuards === true;

      return {
        UnaryExpression(node) {
          if (node.operator !== "typeof") return;
          let parent: Ast = node;

          while (parent.parent?.type === "ParenthesizedExpression") parent = parent.parent;
          const comparison = parent.parent;

          if (
            comparison?.type === "BinaryExpression" &&
            ["==", "===", "!=", "!=="].includes(comparison.operator)
          ) {
            const other = unwrap(comparison.left === parent ? comparison.right : comparison.left);

            if (other.type === "Literal" && other.value === "undefined") return;
          }

          const fn = enclosingFunction(node);

          if (allowInTypeGuards && fn?.returnType?.typeAnnotation.type === "TSTypePredicate")
            return;
          context.report({ node, messageId: "avoid" });
        },
      };
    },
  }),
  "no-static-only-class": defineRule({
    meta: {
      schema: [],
      messages: { avoid: "Use module functions or values instead of a static-only class." },
    },
    create(context) {
      return {
        ClassDeclaration: (node) => checkStaticClass(context, node),
        ClassExpression: (node) => checkStaticClass(context, node),
      };
    },
  }),
  "no-array-filter-map": defineRule({
    meta: {
      schema: [],
      messages: { avoid: "Combine adjacent eager array filter and map passes deliberately." },
    },
    create(context) {
      return {
        CallExpression(node) {
          const outer = unwrap(node.callee);

          if (outer.type !== "MemberExpression") return;
          const method = memberName(outer);

          if (method !== "map" && method !== "filter") return;
          const innerCall = unwrap(outer.object);

          if (innerCall.type !== "CallExpression") return;
          const inner = unwrap(innerCall.callee);

          if (
            inner.type !== "MemberExpression" ||
            memberName(inner) !== (method === "map" ? "filter" : "map")
          )
            return;

          if (isArray(context, inner.object)) context.report({ node, messageId: "avoid" });
        },
      };
    },
  }),
  "no-reduce-accumulator-copy": defineRule({
    meta: {
      schema: [],
      messages: {
        avoid: "Update a fresh local accumulator instead of copying it on each iteration.",
      },
    },
    create(context) {
      return { CallExpression: (node) => checkReducerCopy(context, node) };
    },
  }),
} satisfies Record<string, Rule>;
