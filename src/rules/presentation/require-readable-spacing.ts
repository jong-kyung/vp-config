import { defineRule } from "vite-plus/lint/plugins";
import type { Context } from "vite-plus/lint/plugins";
import { isFunction } from "../../analysis/ast.ts";
import type { Ast } from "../../analysis/ast.ts";
import { attachedComments } from "../../analysis/comments.ts";

function declarationNode(node: Ast): Ast {
  if (
    (node.type === "ExportNamedDeclaration" || node.type === "ExportDefaultDeclaration") &&
    node.declaration
  )
    return node.declaration;

  return node;
}

function isDeclaration(node: Ast): boolean {
  return /Declaration$/.test(node.type);
}

function multilineBinding(node: Ast): boolean {
  return node.type === "VariableDeclaration" && node.loc.end.line > node.loc.start.line;
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

    const comments = attachedComments(context, current);

    /** Preserve line-sensitive directives by leaving trailing comment boundaries alone. */
    if (comments.some((comment) => comment.loc.start.line <= previous.loc.end.line)) continue;
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

export default defineRule({
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
});
