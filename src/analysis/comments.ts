import type { Context, ESTree } from "vite-plus/lint/plugins";
import type { Ast } from "./ast.ts";

export function exportedNode(node: Ast): Ast {
  return node.parent?.type === "ExportNamedDeclaration" ||
    node.parent?.type === "ExportDefaultDeclaration"
    ? node.parent
    : node;
}

export function attachedComments(context: Context, node: Ast): ESTree.Comment[] {
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
