import { fileURLToPath } from "node:url";
import type { UserConfig } from "vite-plus";
import type { OxlintConfig } from "vite-plus/lint";
import { nativeLint } from "./native.ts";

const lint: OxlintConfig = {
  ...nativeLint,
  jsPlugins: [
    { name: "jong-kyung", specifier: fileURLToPath(new URL("./plugin.mjs", import.meta.url)) },
  ],
  rules: {
    ...nativeLint.rules,
    "jong-kyung/no-array-filter-map": "error",
    "jong-kyung/no-reduce-accumulator-copy": "error",
    "jong-kyung/no-chained-type-assertions": "error",
    "jong-kyung/no-conditional-empty-object-spread": "error",
    "jong-kyung/no-object-parameters": "error",
    "jong-kyung/no-reflect-apply": "error",
    "jong-kyung/no-reflect-get": "error",
    "jong-kyung/no-unknown-type-aliases": "error",
    "jong-kyung/no-widen-then-assert": "error",
    "jong-kyung/require-readable-spacing": "error",
    "jong-kyung/no-known-value-widening": "warn",
    "jong-kyung/no-module-mocking": "warn",
    "jong-kyung/no-runtime-typeof": ["warn", { allowInTypeGuards: true }],
    "jong-kyung/no-unknown-parameters": "warn",
    "jong-kyung/no-unknown-returns": "warn",
    "jong-kyung/no-unsafe-dictionary-type": "warn",
    "jong-kyung/require-safety-comment-for-type-assertion": ["warn", { markers: ["SAFETY"] }],
    "jong-kyung/no-static-only-class": "error",
    "jong-kyung/no-em-dash": "error",
    "jong-kyung/prefer-jsdoc": "warn",
    "jong-kyung/no-trivial-type-aliases": "warn",
  },
};

export const nodeConfig = {
  lint: { extends: [lint] },
} satisfies UserConfig;

export const libConfig = {
  ...nodeConfig,
  pack: {
    platform: "neutral",
    format: ["esm"],
    target: "es2022",
    dts: true,
    exports: false,
  },
} satisfies UserConfig;
