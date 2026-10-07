import { defineConfig } from "vite-plus";
import { nodeConfig } from "./src/index.ts";

export default defineConfig({
  staged: { "*": "vp check --fix" },
  pack: {
    entry: ["src/index.ts", "src/plugin.ts"],
    target: "node22.18",
    dts: {
      generator: "tsgo",
    },
    exports: false,
  },
  lint: {
    ...nodeConfig.lint.extends[0],
    // Load source while developing, without requiring an earlier package build.
    jsPlugins: [{ name: "jong-kyung", specifier: "./src/plugin.ts" }],
  },
});
