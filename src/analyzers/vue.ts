// Vue analyzer: parses .vue Single File Components and flags props
// declared via `defineProps<Props>()` (script setup, TS-typed props)
// that never appear in the template or in the script block.
//
// v0.1 scope: TypeScript `defineProps<Props>()` generic form only.
// The runtime object form (`defineProps({ foo: String })`) and the
// Options API `props: {...}` form are not yet supported — tracked as
// a follow-up once the generic-type path is solid.

import { readFileSync } from "node:fs";
import { parse as parseSFC } from "@vue/compiler-sfc";
import { Project, SyntaxKind } from "ts-morph";
import type { AnalyzerOptions, AnalyzerResult, UnusedPropIssue } from "../types.js";

const DEFAULT_IGNORED_PROPS = new Set(["class", "style"]);

function extractPropsTypeSource(scriptSetupContent: string): string | null {
  const match = scriptSetupContent.match(/defineProps<([\s\S]*?)>\s*\(/);
  return match ? match[1] ?? null : null;
}

function extractDeclaredPropNames(propsTypeSource: string): string[] {
  // Wrap the extracted generic argument in a throwaway interface so
  // ts-morph can parse it as a real type and enumerate its members,
  // even when the type is an inline object literal like `{ foo: string }`.
  const project = new Project({ useInMemoryFileSystem: true });
  const virtualFile = project.createSourceFile(
    "virtual-props.ts",
    `type __Props = ${propsTypeSource};`,
  );

  const typeAlias = virtualFile.getTypeAliasOrThrow("__Props");
  const propertySignatures = typeAlias.getDescendantsOfKind(SyntaxKind.PropertySignature);
  return propertySignatures.map((p) => p.getNameNode().getText());
}

function analyzeSingleFile(filePath: string, ignoreProps: Set<string>): UnusedPropIssue[] {
  const raw = readFileSync(filePath, "utf-8");
  const { descriptor } = parseSFC(raw, { filename: filePath });

  const scriptSetup = descriptor.scriptSetup;
  if (!scriptSetup) return [];

  const propsTypeSource = extractPropsTypeSource(scriptSetup.content);
  if (!propsTypeSource) return [];

  const declaredPropNames = extractDeclaredPropNames(propsTypeSource);
  if (declaredPropNames.length === 0) return [];

  const templateContent = descriptor.template?.content ?? "";
  const scriptContent = scriptSetup.content;

  const issues: UnusedPropIssue[] = [];
  const componentName = filePath.split("/").pop()?.replace(".vue", "") ?? "<unknown>";

  for (const propName of declaredPropNames) {
    if (ignoreProps.has(propName)) continue;

    // A prop counts as used if it's referenced in the template (as-is,
    // or kebab-case for multi-word props) or accessed via `props.x` in
    // the script block.
    const kebabName = propName.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
    const usedInTemplate = templateContent.includes(propName) || templateContent.includes(kebabName);
    const usedInScript = new RegExp(`props\\.${propName}\\b`).test(scriptContent);

    if (!usedInTemplate && !usedInScript) {
      issues.push({
        filePath,
        componentName,
        propName,
        // Line number within the SFC isn't tracked precisely in v0.1;
        // points to the start of the script setup block as an approximation.
        line: scriptSetup.loc.start.line,
      });
    }
  }

  return issues;
}

export function analyzeVueProject(options: AnalyzerOptions): AnalyzerResult {
  const ignoreProps = new Set([...DEFAULT_IGNORED_PROPS, ...options.ignoreProps]);
  const issues: UnusedPropIssue[] = [];

  // Patterns are expected to already be resolved to concrete .vue file
  // paths by the CLI layer (see src/cli.ts), which uses fast-glob.
  for (const filePath of options.patterns) {
    issues.push(...analyzeSingleFile(filePath, ignoreProps));
  }

  return { issues, filesScanned: options.patterns.length };
}
