// Programmatic entry point, for consumers who want to run the
// analyzers from their own scripts (e.g. a custom ESLint rule
// wrapper) instead of the CLI.

export { analyzeReactProject } from "./analyzers/react.js";
export { analyzeVueProject } from "./analyzers/vue.js";
export type { AnalyzerOptions, AnalyzerResult, UnusedPropIssue } from "./types.js";
