import { defineConfig } from "vite-plus";
import { lint, fmt, staged } from "./src/index.ts";

export default defineConfig({
  staged,
  pack: {
    entry: ["src/index.ts", "src/plugin.ts"],
    target: "node22.18",
    dts: {
      generator: "tsgo",
    },
    exports: false,
  },
  lint: {
    ...lint,
    // Load source while developing, without requiring an earlier package build.
    jsPlugins: [{ name: "jong-kyung", specifier: "./src/plugin.ts" }],
  },
  fmt,
});
