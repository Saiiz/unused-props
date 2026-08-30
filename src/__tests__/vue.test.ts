import { describe, expect, it } from "vitest";
import { analyzeVueProject } from "../analyzers/vue.js";

describe("analyzeVueProject", () => {
  it("flags a defineProps() prop that never appears in the template", () => {
    const result = analyzeVueProject({
      patterns: ["src/__tests__/fixtures/Badge.vue"],
      ignoreProps: [],
    });

    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]?.propName).toBe("color");
  });

  it("does not flag props used in the template", () => {
    const result = analyzeVueProject({
      patterns: ["src/__tests__/fixtures/Badge.vue"],
      ignoreProps: [],
    });

    const flaggedNames = result.issues.map((issue) => issue.propName);
    expect(flaggedNames).not.toContain("label");
  });
});
