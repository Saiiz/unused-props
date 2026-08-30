import { describe, expect, it } from "vitest";
import { analyzeReactProject } from "../analyzers/react.js";

describe("analyzeReactProject", () => {
  it("flags a declared prop that is never read via props.x", () => {
    const result = analyzeReactProject({
      patterns: ["src/__tests__/fixtures/Card.tsx"],
      ignoreProps: [],
    });

    expect(result.filesScanned).toBe(1);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]?.propName).toBe("subtitle");
    expect(result.issues[0]?.componentName).toBe("Card");
  });

  it("does not flag props that are read", () => {
    const result = analyzeReactProject({
      patterns: ["src/__tests__/fixtures/Card.tsx"],
      ignoreProps: [],
    });

    const flaggedNames = result.issues.map((issue) => issue.propName);
    expect(flaggedNames).not.toContain("title");
  });

  it("respects the ignoreProps option", () => {
    const result = analyzeReactProject({
      patterns: ["src/__tests__/fixtures/Card.tsx"],
      ignoreProps: ["subtitle"],
    });

    expect(result.issues).toHaveLength(0);
  });

  it("flags a destructured prop whose local binding is never referenced again", () => {
    const result = analyzeReactProject({
      patterns: ["src/__tests__/fixtures/Avatar.tsx"],
      ignoreProps: [],
    });

    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]?.propName).toBe("size");
  });

  it("flags a prop that was never destructured at all, in an arrow function component", () => {
    const result = analyzeReactProject({
      patterns: ["src/__tests__/fixtures/Button.tsx"],
      ignoreProps: [],
    });

    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]?.propName).toBe("variant");
    expect(result.issues[0]?.componentName).toBe("Button");
  });

  it("does not flag a renamed destructured prop that is used under its local name", () => {
    const result = analyzeReactProject({
      patterns: ["src/__tests__/fixtures/Button.tsx"],
      ignoreProps: [],
    });

    const flaggedNames = result.issues.map((issue) => issue.propName);
    expect(flaggedNames).not.toContain("onClick");
  });

  it("bails out safely when a rest element is present, to avoid false positives", () => {
    const result = analyzeReactProject({
      patterns: ["src/__tests__/fixtures/Panel.tsx"],
      ignoreProps: [],
    });

    expect(result.issues).toHaveLength(0);
  });
});
