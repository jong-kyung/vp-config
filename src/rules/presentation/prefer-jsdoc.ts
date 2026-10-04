import { defineRule } from "vite-plus/lint/plugins";
import type { ESTree } from "vite-plus/lint/plugins";
import { walk } from "../../analysis/ast.ts";
import { attachedComments, exportedNode } from "../../analysis/comments.ts";

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

export default defineRule({
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
});
