// React analyzer: finds props declared in a component's props type
// (interface, type alias, or inline type literal) that are never read
// inside the component body — via destructuring, `props.x` access, or
// a renamed destructured binding (`{ title: t }`).

import { Project, SyntaxKind, type SourceFile, type Node, type FunctionDeclaration, type ArrowFunction, type FunctionExpression } from "ts-morph";
import type { AnalyzerOptions, AnalyzerResult, UnusedPropIssue } from "../types.js";

const DEFAULT_IGNORED_PROPS = new Set(["children", "className", "key", "ref"]);

type ComponentFunction = FunctionDeclaration | ArrowFunction | FunctionExpression;

/**
 * Extracts the list of { name, line } prop members from a type node.
 *
 * The type node on a parameter (e.g. `props: CardProps`) is just a
 * TypeReference — the identifier "CardProps" — not the interface body
 * itself. To read the actual members we resolve the reference to its
 * declaration (interface or type alias) in the same source file first,
 * and only fall back to reading PropertySignatures directly on the node
 * for inline type literals (e.g. `props: { title: string }`).
 */
function extractPropMembers(typeNode: Node, sourceFile: SourceFile): { name: string; line: number }[] {
  let targetNode: Node = typeNode;

  if (typeNode.getKind() === SyntaxKind.TypeReference) {
    const typeName = typeNode.getFirstChildByKind(SyntaxKind.Identifier)?.getText();
    if (!typeName) return [];

    const interfaceDecl = sourceFile.getInterface(typeName);
    const typeAliasDecl = sourceFile.getTypeAlias(typeName);
    const resolved = interfaceDecl ?? typeAliasDecl;
    if (!resolved) return []; // declared in another file — out of scope for v0.1

    targetNode = resolved;
  }

  const members: { name: string; line: number }[] = [];
  const propertySignatures = targetNode.getDescendantsOfKind(SyntaxKind.PropertySignature);
  for (const prop of propertySignatures) {
    const nameNode = prop.getNameNode();
    members.push({
      name: nameNode.getText(),
      line: prop.getStartLineNumber(),
    });
  }

  return members;
}

/**
 * Handles the `props: Props` + `props.x` pattern: returns every prop
 * name accessed as a property of the props parameter inside the body.
 */
function findUsedPropsViaMemberAccess(componentBody: Node, propsParamName: string): Set<string> {
  const used = new Set<string>();

  const propertyAccesses = componentBody.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression);
  for (const access of propertyAccesses) {
    const expression = access.getExpression();
    if (expression.getText() === propsParamName) {
      used.add(access.getName());
    }
  }

  return used;
}

/**
 * Handles the `{ title, subtitle: sub, ...rest }: Props` pattern.
 *
 * Returns `null` when the pattern contains a rest element (`...rest`):
 * a rest spread can carry any remaining prop forward to a child
 * component (e.g. `<Child {...rest} />`), so we can't safely determine
 * usage without deeper call-graph analysis. Bailing out avoids false
 * positives, at the cost of not analyzing that component in v0.1.
 *
 * Otherwise returns a map of declared prop name -> whether the local
 * binding it was destructured into is actually referenced in the body.
 */
function analyzeDestructuredBinding(
  bindingPattern: Node,
  componentBody: Node,
): Map<string, boolean> | null {
  const result = new Map<string, boolean>();
  const elements = bindingPattern.getDescendantsOfKind(SyntaxKind.BindingElement);

  for (const element of elements) {
    if (element.getDotDotDotToken() !== undefined) {
      return null; // rest element present — bail out, see doc comment above
    }

    const nameNode = element.getNameNode();
    // Nested destructuring (`{ meta: { author } }`) isn't supported in
    // v0.1 — skip it rather than risk a false positive.
    if (nameNode.getKind() !== SyntaxKind.Identifier) continue;

    const localName = nameNode.getText();
    const propertyNameNode = element.getPropertyNameNode();
    const propName = propertyNameNode ? propertyNameNode.getText() : localName;

    const identifiersInBody = componentBody.getDescendantsOfKind(SyntaxKind.Identifier);
    const isReferenced = identifiersInBody.some((id) => id.getText() === localName);

    result.set(propName, isReferenced);
  }

  return result;
}

function getComponentName(fn: ComponentFunction): string {
  if (fn.getKind() === SyntaxKind.FunctionDeclaration) {
    return (fn as FunctionDeclaration).getName() ?? "<anonymous>";
  }

  // Arrow functions and function expressions: look for
  // `const ComponentName = (props) => ...` to recover a usable name.
  const parent = fn.getParent();
  if (parent?.getKind() === SyntaxKind.VariableDeclaration) {
    const nameNode = parent.asKindOrThrow(SyntaxKind.VariableDeclaration).getNameNode();
    if (nameNode.getKind() === SyntaxKind.Identifier) {
      return nameNode.getText();
    }
  }

  return "<anonymous>";
}

function analyzeSourceFile(sourceFile: SourceFile, ignoreProps: Set<string>): UnusedPropIssue[] {
  const issues: UnusedPropIssue[] = [];

  const functions: ComponentFunction[] = [
    ...sourceFile.getDescendantsOfKind(SyntaxKind.FunctionDeclaration),
    ...sourceFile.getDescendantsOfKind(SyntaxKind.ArrowFunction),
    ...sourceFile.getDescendantsOfKind(SyntaxKind.FunctionExpression),
  ];

  for (const fn of functions) {
    const firstParam = fn.getParameters()[0];
    if (!firstParam) continue;

    const typeNode = firstParam.getTypeNode();
    if (!typeNode) continue;

    const body = fn.getBody();
    if (!body) continue;

    const declaredProps = extractPropMembers(typeNode, sourceFile);
    if (declaredProps.length === 0) continue;

    const componentName = getComponentName(fn);
    const nameNode = firstParam.getNameNode();

    if (nameNode.getKind() === SyntaxKind.ObjectBindingPattern) {
      const destructuredUsage = analyzeDestructuredBinding(nameNode, body);
      if (destructuredUsage === null) continue; // rest element present, skip safely

      for (const prop of declaredProps) {
        if (ignoreProps.has(prop.name)) continue;

        // A declared prop that was never even destructured is unused.
        // A prop that was destructured but whose local binding is never
        // referenced again in the body is also unused.
        const wasDestructuredAndUsed = destructuredUsage.get(prop.name);
        if (wasDestructuredAndUsed === undefined || wasDestructuredAndUsed === false) {
          issues.push({
            filePath: sourceFile.getFilePath(),
            componentName,
            propName: prop.name,
            line: prop.line,
          });
        }
      }
      continue;
    }

    // Non-destructured: `props: Props` + `props.x` access pattern.
    const propsParamName = nameNode.getText();
    const usedProps = findUsedPropsViaMemberAccess(body, propsParamName);

    for (const prop of declaredProps) {
      if (ignoreProps.has(prop.name)) continue;
      if (!usedProps.has(prop.name)) {
        issues.push({
          filePath: sourceFile.getFilePath(),
          componentName,
          propName: prop.name,
          line: prop.line,
        });
      }
    }
  }

  return issues;
}

export function analyzeReactProject(options: AnalyzerOptions): AnalyzerResult {
  const project = new Project({
    skipAddingFilesFromTsConfig: true,
  });

  project.addSourceFilesAtPaths(options.patterns);

  const ignoreProps = new Set([...DEFAULT_IGNORED_PROPS, ...options.ignoreProps]);
  const issues: UnusedPropIssue[] = [];

  const sourceFiles = project.getSourceFiles();
  for (const sourceFile of sourceFiles) {
    issues.push(...analyzeSourceFile(sourceFile, ignoreProps));
  }

  return { issues, filesScanned: sourceFiles.length };
}
