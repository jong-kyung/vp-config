import { definePlugin } from "vite-plus/lint/plugins";
import { syntaxRules } from "./rules/syntax.ts";
import { typeRules } from "./rules/types.ts";
import { presentationRules } from "./rules/presentation.ts";

export default definePlugin({
  meta: { name: "jong-kyung" },
  rules: { ...syntaxRules, ...typeRules, ...presentationRules },
});
