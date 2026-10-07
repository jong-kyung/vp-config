import { defineConfig, mergeConfig } from "vite-plus";
import { nodeConfig } from "./src/index.ts";

export default defineConfig({
  ...mergeConfig(nodeConfig, {
    staged: { "*": "vp check --fix" },
    pack: {
      entry: ["src/index.ts", "src/plugin.ts"],
      target: "node22.18",
      dts: {
        generator: "tsgo",
      },
      exports: false,
    },
  }),
  // Replace inherited lint to load source without requiring an earlier package build.
  lint: {
    ...nodeConfig.lint.extends[0],
    jsPlugins: [{ name: "jong-kyung", specifier: "./src/plugin.ts" }],
  },
});
