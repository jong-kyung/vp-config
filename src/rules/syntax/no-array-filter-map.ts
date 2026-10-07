import { defineRule } from "vite-plus/lint/plugins";
import { memberName, unwrap } from "../../analysis/ast.ts";
import { ArrayAnalysis } from "../../analysis/array-analysis.ts";

export default defineRule({
  meta: {
    schema: [],
    messages: { avoid: "Combine adjacent eager array filter and map passes deliberately." },
  },
  create(context) {
    const arrays = new ArrayAnalysis(context);

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

        if (arrays.isArray(inner.object)) context.report({ node, messageId: "avoid" });
      },
    };
  },
});
