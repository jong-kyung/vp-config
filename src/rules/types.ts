import { defineRule } from "vite-plus/lint/plugins";
import type { Context, ESTree, Rule } from "vite-plus/lint/plugins";
import { binding, enclosingFunction, unwrap, walk } from "./ast.ts";
import type { Ast, FunctionNode } from "./ast.ts";
import { createTypeAnalysis } from "./type-analysis.ts";

type Signature =
  | FunctionNode
  | ESTree.TSFunctionType
  | ESTree.TSConstructorType
  | ESTree.TSCallSignatureDeclaration
  | ESTree.TSConstructSignatureDeclaration
  | ESTree.TSMethodSignature;

function isSignature(node: Ast): node is Signature {
  return "params" in node && "returnType" in node;
}

function parameterBinding(node: ESTree.ParamPattern): Ast {
  if (node.type === "TSParameterProperty") return parameterBinding(node.parameter);
  if (node.type === "AssignmentPattern") return node.left;
  return node;
}

function inConstraint(node: Ast): boolean {
  const range = node.range;
  let parent = node.parent;
  while (parent) {
    if (
      parent.type === "TSTypeParameter" &&
      parent.constraint &&
      parent.constraint.range[0] <= range[0] &&
      parent.constraint.range[1] >= range[1]
    )
      return true;
    parent = parent.parent;
  }
  return false;
}

function parameterRule(kind: "TSUnknownKeyword" | "TSObjectKeyword"): Rule {
  return defineRule({
    meta: {
      schema: [],
      messages: {
        avoid:
          kind === "TSUnknownKeyword"
            ? "Give inputs a concrete contract, or document this unvalidated boundary."
            : "Describe the input's structure instead of accepting object.",
      },
    },
    create(context) {
      return {
        "Program:exit"(program) {
          const types = createTypeAnalysis(context);
          walk(context, program, (node) => {
            if (!isSignature(node)) return;
            for (const parameter of node.params) {
              const target = parameterBinding(parameter);
              const type = types.annotation(parameter);
              if (!type || !types.contains(types.use(type), [kind])) continue;
              if (kind === "TSUnknownKeyword" && target.type === "Identifier") {
                if (target.name === "cause") continue;
                const predicate = node.returnType?.typeAnnotation;
                if (
                  predicate?.type === "TSTypePredicate" &&
                  predicate.parameterName.type === "Identifier" &&
                  predicate.parameterName.name === target.name
                )
                  continue;
              }
              context.report({ node: type, messageId: "avoid" });
            }
          });
        },
      };
    },
  });
}

function isConstType(type: ESTree.TSType): boolean {
  return (
    type.type === "TSTypeReference" &&
    type.typeName.type === "Identifier" &&
    type.typeName.name === "const"
  );
}

function checkWidening(context: Context, program: ESTree.Program): void {
  const types = createTypeAnalysis(context);
  function check(type: ESTree.TSType | undefined, value: Ast | null | undefined, report: Ast) {
    if (!type || !value || !types.wide(type) || !types.known(value)) return;
    const expression = unwrap(value);
    if (
      types.openDictionary(types.use(type)) &&
      expression.type === "ObjectExpression" &&
      expression.properties.length === 0
    )
      return;
    context.report({ node: report, messageId: "avoid" });
  }
  walk(context, program, (node) => {
    if (node.type === "VariableDeclarator") check(types.annotation(node.id), node.init, node);
    else if (node.type === "AssignmentExpression" && node.operator === "=") {
      const variable = binding(context, node.left);
      const type = variable?.identifiers.map(types.annotation).find((item) => item !== undefined);
      check(type, node.right, node);
    } else if (node.type === "ReturnStatement") {
      check(enclosingFunction(node)?.returnType?.typeAnnotation, node.argument, node);
    } else if (node.type === "ArrowFunctionExpression" && node.expression) {
      check(node.returnType?.typeAnnotation, node.body, node.body);
    } else if (node.type === "CallExpression") {
      const fn = types.functionValue(node.callee);
      if (!fn) return;
      for (const [index, argument] of node.arguments.entries()) {
        const parameter = fn.params[index];
        if (parameter && argument.type !== "SpreadElement")
          check(types.annotation(parameter), argument, argument);
      }
    } else if (node.type === "TSAsExpression" || node.type === "TSTypeAssertion") {
      if (!isConstType(node.typeAnnotation)) check(node.typeAnnotation, node.expression, node);
    }
  });
}

export const typeRules: Record<string, Rule> = {
  "no-object-parameters": parameterRule("TSObjectKeyword"),
  "no-unknown-parameters": parameterRule("TSUnknownKeyword"),
  "no-unknown-returns": defineRule({
    meta: {
      schema: [],
      messages: {
        avoid: "Return a concrete contract, or document why unvalidated data leaves this boundary.",
      },
    },
    create(context) {
      return {
        "Program:exit"(program) {
          const types = createTypeAnalysis(context);
          walk(context, program, (node) => {
            if (!isSignature(node)) return;
            const type = node.returnType?.typeAnnotation;
            if (type && types.contains(types.use(type), ["TSUnknownKeyword"], true))
              context.report({ node: type, messageId: "avoid" });
          });
        },
      };
    },
  }),
  "no-unknown-type-aliases": defineRule({
    meta: { schema: [], messages: { avoid: "Do not hide unknown behind a type alias." } },
    create(context) {
      return {
        "Program:exit"(program) {
          const types = createTypeAnalysis(context);
          walk(context, program, (node) => {
            if (
              node.type === "TSTypeAliasDeclaration" &&
              types.contains(types.use(node.typeAnnotation), ["TSUnknownKeyword"])
            )
              context.report({ node, messageId: "avoid" });
          });
        },
      };
    },
  }),
  "no-unsafe-dictionary-type": defineRule({
    meta: {
      schema: [],
      messages: {
        avoid: "Give dictionary values a concrete contract, or document this raw-data boundary.",
      },
    },
    create(context) {
      return {
        "Program:exit"(program) {
          const types = createTypeAnalysis(context);
          walk(context, program, (node) => {
            if (inConstraint(node)) return;
            if (node.type === "TSIndexSignature") {
              if (types.unsafeValue(types.use(node.typeAnnotation.typeAnnotation)))
                context.report({ node, messageId: "avoid" });
            } else if (
              (node.type === "TSTypeReference" || node.type === "TSMappedType") &&
              types.unsafeDictionary(types.use(node))
            ) {
              context.report({ node, messageId: "avoid" });
            }
          });
        },
      };
    },
  }),
  "no-trivial-type-aliases": defineRule({
    meta: {
      schema: [],
      messages: {
        avoid:
          "A primitive alias does not distinguish values; use a meaningful contract when distinction matters.",
      },
    },
    create(context) {
      return {
        "Program:exit"(program) {
          const types = createTypeAnalysis(context);
          walk(context, program, (node) => {
            if (node.type !== "TSTypeAliasDeclaration" || node.typeParameters?.params.length)
              return;
            const parent =
              node.parent.type === "ExportNamedDeclaration" ? node.parent.parent : node.parent;
            if (parent.type !== "Program") return;
            const type = types.expand(types.use(node.typeAnnotation)).node;
            if (
              [
                "TSStringKeyword",
                "TSNumberKeyword",
                "TSBooleanKeyword",
                "TSBigIntKeyword",
                "TSSymbolKeyword",
                "TSNullKeyword",
                "TSUndefinedKeyword",
              ].includes(type.type)
            )
              context.report({ node, messageId: "avoid" });
          });
        },
      };
    },
  }),
  "no-known-value-widening": defineRule({
    meta: {
      schema: [],
      messages: {
        avoid:
          "Preserve known information with inference or satisfies instead of widening this value.",
      },
    },
    create(context) {
      return { "Program:exit": (program) => checkWidening(context, program) };
    },
  }),
  "no-widen-then-assert": defineRule({
    meta: {
      schema: [],
      messages: {
        avoid: "Preserve the original type instead of erasing it and asserting another contract.",
      },
    },
    create(context) {
      return {
        "Program:exit"(program) {
          const types = createTypeAnalysis(context);
          walk(context, program, (node) => {
            if (
              (node.type === "TSAsExpression" || node.type === "TSTypeAssertion") &&
              !isConstType(node.typeAnnotation) &&
              types.widened(node.expression)
            )
              context.report({ node, messageId: "avoid" });
          });
        },
      };
    },
  }),
};
