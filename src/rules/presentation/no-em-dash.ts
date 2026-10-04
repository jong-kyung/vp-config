import { defineRule } from "vite-plus/lint/plugins";

export default defineRule({
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
});
