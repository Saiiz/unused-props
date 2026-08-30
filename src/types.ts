// Shared types used across React and Vue analyzers.

export interface UnusedPropIssue {
  /** Absolute or relative path to the file containing the issue. */
  filePath: string;
  /** Name of the component where the unused prop was found. */
  componentName: string;
  /** Name of the prop that is declared but never read. */
  propName: string;
  /** 1-based line number where the prop is declared. */
  line: number;
}

export interface AnalyzerResult {
  issues: UnusedPropIssue[];
  /** Files that were scanned, for reporting purposes. */
  filesScanned: number;
}

export interface AnalyzerOptions {
  /** Glob patterns (relative to cwd) pointing at source files to scan. */
  patterns: string[];
  /** Prop names to always ignore (e.g. "children", "className"). */
  ignoreProps: string[];
}
