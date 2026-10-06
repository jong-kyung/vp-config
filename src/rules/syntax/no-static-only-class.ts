import { defineRule } from "vite-plus/lint/plugins";
import type { Context, ESTree } from "vite-plus/lint/plugins";

function checkStaticClass(context: Context, node: ESTree.Class): void {
  if (
    node.superClass ||
    node.abstract ||
    node.declare ||
    node.decorators.length ||
    node.implements?.length
  )
    return;

  for (let parent: ESTree.Node | null = node.parent; parent; parent = parent.parent) {
    if (parent.type === "TSModuleDeclaration" && parent.declare) return;
  }

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

export default defineRule({
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
});
