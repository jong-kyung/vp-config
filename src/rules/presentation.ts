import { defineRule } from "vite-plus/lint/plugins";
import type { Context, ESTree, Rule } from "vite-plus/lint/plugins";
import { isConstType, isFunction, isOptionsObject, isString, walk } from "./ast.ts";
import type { Ast } from "./ast.ts";

function declarationNode(node: Ast): Ast {
  if (
    (node.type === "ExportNamedDeclaration" || node.type === "ExportDefaultDeclaration") &&
    node.declaration
  )
    return node.declaration;

  return node;
}

function exportedNode(node: Ast): Ast {
  return node.parent?.type === "ExportNamedDeclaration" ||
    node.parent?.type === "ExportDefaultDeclaration"
    ? node.parent
    : node;
}

function attachedComments(context: Context, node: Ast): ESTree.Comment[] {
  const comments = context.sourceCode.getCommentsBefore(node);
  const attached: ESTree.Comment[] = [];
  let start = node.range[0];
  let line = node.loc.start.line;

  for (const comment of comments.toReversed()) {
    if (
      comment.loc.end.line < line - 1 ||
      !/^\s*$/.test(context.sourceCode.text.slice(comment.range[1], start))
    )
      break;
    attached.unshift(comment);
    start = comment.range[0];
    line = comment.loc.start.line;
  }

  return attached;
}

function checkSpacing(context: Context, statements: readonly Ast[], topLevel: boolean): void {
  const source = context.sourceCode;
  const newline = source.text.includes("\r\n") ? "\r\n" : "\n";

  for (let index = 1; index < statements.length; index++) {
    const previous = statements[index - 1]!;
    const current = statements[index]!;
    const left = declarationNode(previous);
    const right = declarationNode(current);

    if (left.type === "ImportDeclaration" && right.type === "ImportDeclaration") continue;

    if (isFunction(left) && isFunction(right) && !left.body && left.id?.name === right.id?.name)
      continue;
    const isDeclaration = (node: Ast): boolean => /Declaration$/.test(node.type);

    const multilineBinding = (node: Ast): boolean =>
      node.type === "VariableDeclaration" && node.loc.end.line > node.loc.start.line;

    const controlFlow =
      /^(?:Return|Throw|If|For|ForIn|ForOf|While|DoWhile|Switch|Try|Break|Continue)Statement$/.test(
        right.type,
      );

    const afterBlock = source.getLastToken(previous)?.value === "}";

    if (
      !(topLevel && (isDeclaration(left) || isDeclaration(right))) &&
      !multilineBinding(left) &&
      !multilineBinding(right) &&
      !controlFlow &&
      !afterBlock
    )
      continue;

    const comments = attachedComments(context, current).filter(
      (comment) => comment.loc.start.line > previous.loc.end.line,
    );

    const first = comments[0] ?? current;

    if (first.loc.start.line - previous.loc.end.line > 1) continue;
    const gap = source.text.slice(previous.range[1], first.range[0]);
    context.report({
      node: current,
      messageId: "spacing",
      fix(fixer) {
        if (first.loc.start.line === previous.loc.end.line) {
          if (/^[\t ]*$/.test(gap))
            return fixer.replaceTextRange(
              [previous.range[1], first.range[0]],
              `${newline}${newline}`,
            );

          return fixer.insertTextBeforeRange(first.range, `${newline}${newline}`);
        }

        const startOfLine = source.text.lastIndexOf("\n", first.range[0] - 1) + 1;

        return fixer.insertTextBeforeRange([startOfLine, startOfLine], newline);
      },
    });
  }
}

function assertionAnchor(node: Ast): Ast {
  let anchor = node;

  while (anchor.parent && anchor.parent.type !== "Program" && !isFunction(anchor.parent)) {
    if (/Statement$|Declaration$/.test(anchor.type)) break;
    anchor = anchor.parent;
  }

  return exportedNode(anchor);
}

function checkSafety(
  context: Context,
  node: ESTree.TSAsExpression | ESTree.TSTypeAssertion,
  markers: readonly string[],
): void {
  if (isConstType(node.typeAnnotation)) return;
  const anchor = assertionAnchor(node);

  const candidates = new Set([
    ...attachedComments(context, anchor),
    ...attachedComments(context, node),
  ]);

  for (const comment of context.sourceCode.getCommentsAfter(node)) {
    if (comment.loc.start.line === node.loc.end.line) candidates.add(comment);
  }

  for (const comment of candidates) {
    const lines = comment.value.split(/\r?\n/).map((line) => line.replace(/^\s*\*?\s*/, ""));

    if (
      lines.some((line) =>
        markers.some(
          (marker) =>
            line.startsWith(`${marker}:`) && line.slice(marker.length + 1).trim().length > 0,
        ),
      )
    )
      return;
  }

  context.report({ node, messageId: "safety" });
}

const documentationTargets = new Set([
  "VariableDeclaration",
  "FunctionDeclaration",
  "TSDeclareFunction",
  "ClassDeclaration",
  "TSTypeAliasDeclaration",
  "TSInterfaceDeclaration",
  "TSEnumDeclaration",
  "MethodDefinition",
  "PropertyDefinition",
  "AccessorProperty",
  "TSMethodSignature",
  "TSPropertySignature",
]);

function directiveComment(comment: ESTree.Comment): boolean {
  return /(?:^|\n)\s*\*?\s*(?:eslint|oxlint|@ts-|prettier|istanbul|c8\b|v8\b|biome|deno-lint|[@#]__(?:PURE|NO_SIDE_EFFECTS)__|@vite-ignore|@license|@preserve|sourceMappingURL|sourceURL|webpack|\/)/.test(
    comment.value,
  );
}

export const presentationRules = {
  "no-em-dash": defineRule({
    meta: {
      schema: [],
      messages: { punctuation: "Use appropriate punctuation instead of an em dash." },
    },
    create(context) {
      return {
        Program() {
          for (const match of context.sourceCode.text.matchAll(/\u2014/g)) {
            context.report({
              loc: {
                start: context.sourceCode.getLocFromIndex(match.index),
                end: context.sourceCode.getLocFromIndex(match.index + 1),
              },
              messageId: "punctuation",
            });
          }
        },
      };
    },
  }),
  "require-readable-spacing": defineRule({
    meta: {
      schema: [],
      fixable: "whitespace",
      messages: { spacing: "Separate these logical groups with a blank line." },
    },
    create(context) {
      return {
        Program: (node) => checkSpacing(context, node.body, true),
        BlockStatement: (node) => checkSpacing(context, node.body, false),
        StaticBlock: (node) => checkSpacing(context, node.body, false),
        TSModuleBlock: (node) => checkSpacing(context, node.body, true),
        SwitchCase: (node) => checkSpacing(context, node.consequent, false),
      };
    },
  }),
  "require-safety-comment-for-type-assertion": defineRule({
    meta: {
      schema: [
        {
          type: "object",
          properties: {
            markers: { type: "array", items: { type: "string", minLength: 1 }, minItems: 1 },
          },
          additionalProperties: false,
        },
      ],
      messages: {
        safety:
          "Explain the checked invariant in a nearby SAFETY: comment before asserting this type.",
      },
    },
    create(context) {
      const option = context.options[0];

      const configured = isOptionsObject(option) ? option.markers : undefined;
      const markers = Array.isArray(configured) ? configured.filter(isString) : ["SAFETY"];

      return {
        TSAsExpression: (node) => checkSafety(context, node, markers),
        TSTypeAssertion: (node) => checkSafety(context, node, markers),
      };
    },
  }),
  "prefer-jsdoc": defineRule({
    meta: {
      schema: [],
      fixable: "code",
      messages: { documentation: "Use JSDoc for this existing declaration comment." },
    },
    create(context) {
      return {
        Program(program) {
          const reported = new Set<number>();
          const source = context.sourceCode;
          const newline = source.text.includes("\r\n") ? "\r\n" : "\n";
          walk(context, program, (node) => {
            if (!documentationTargets.has(node.type)) return;
            const target = exportedNode(node);
            const comments = attachedComments(context, target);

            if (comments.every((comment) => comment.value.trim().length === 0)) return;
            const first = comments[0];
            const last = comments.at(-1);

            if (
              !first ||
              !last ||
              reported.has(first.range[0]) ||
              first.loc.start.line === target.loc.start.line
            )
              return;

            if (
              comments.some(
                (comment) =>
                  directiveComment(comment) ||
                  source.text.slice(comment.range[0], comment.range[0] + 3) === "/**",
              )
            )
              return;

            const prefix = source.text.slice(
              source.text.lastIndexOf("\n", first.range[0] - 1) + 1,
              first.range[0],
            );

            if (!/^[\t ]*$/.test(prefix)) return;

            if (comments.some((comment) => comment.type === "Line" && comment.value.includes("*/")))
              return;
            let replacement: string;

            if (comments.length === 1 && first.type === "Block") {
              replacement = `/**${first.value}*/`;
            } else {
              if (comments.some((comment) => comment.type !== "Line")) return;
              const lines = comments.map((comment) => comment.value.trim());

              if (lines.length === 1) replacement = `/** ${lines[0]} */`;
              else
                replacement = [
                  "/**",
                  ...lines.map((line) => `${prefix} *${line ? ` ${line}` : ""}`),
                  `${prefix} */`,
                ].join(newline);
            }

            reported.add(first.range[0]);
            context.report({
              loc: first.loc,
              messageId: "documentation",
              fix: (fixer) => fixer.replaceTextRange([first.range[0], last.range[1]], replacement),
            });
          });
        },
      };
    },
  }),
} satisfies Record<string, Rule>;
