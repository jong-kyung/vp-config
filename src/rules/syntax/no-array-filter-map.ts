import { defineRule } from "vite-plus/lint/plugins";
import { isArray, memberName, unwrap } from "../../analysis/ast.ts";

export default defineRule({
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
});
