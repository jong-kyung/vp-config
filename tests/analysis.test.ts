import { expect } from "vite-plus/test";
import { defineRule } from "vite-plus/lint/plugins";
import { TypeAnalysis } from "../src/analysis/type-analysis.ts";
import { ArrayAnalysis } from "../src/analysis/array-analysis.ts";

import { tester } from "./helpers/rule-tester.ts";

tester.run(
  "shared analysis methods",
  defineRule({
    meta: { schema: [] },
    create(context) {
      const types = new TypeAnalysis(context);
      const other = new TypeAnalysis(context);

      for (const name of [
        "expand",
        "standard",
        "contains",
        "unsafeValue",
        "unsafeDictionary",
        "openDictionary",
        "wide",
        "annotation",
        "known",
        "widenedType",
      ] as const)
        expect(types[name]).toBe(other[name]);

      expect(new ArrayAnalysis(context).isArray === new ArrayAnalysis(context).isArray).toBe(true);

      return {
        FunctionDeclaration(node) {
          expect(node.params.map(types.annotation).map((type) => type?.type)).toMatchSnapshot(
            "parameter annotations",
          );
        },
        TSParameterProperty(node) {
          const { annotation } = types;
          expect(annotation(node)?.type).toMatchSnapshot("detached annotation method");
        },
      };
    },
  }),
  {
    valid: [
      "function run(value: string = '') {} class State { constructor(public value: string = '') {} }",
    ],
    invalid: [],
  },
);
