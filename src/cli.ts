#!/usr/bin/env node
// CLI entry point: resolves target files, runs the React and Vue
// analyzers, and prints a human-readable report. Exits with code 1
// if any unused prop is found, so it can be used as a CI gate.

import { Command } from "commander";
import fg from "fast-glob";
import { analyzeReactProject } from "./analyzers/react.js";
import { analyzeVueProject } from "./analyzers/vue.js";
import type { UnusedPropIssue } from "./types.js";

interface CliArgs {
  dir: string;
  ignore: string[];
  json: boolean;
}

function printReport(issues: UnusedPropIssue[], filesScanned: number, asJson: boolean): void {
  if (asJson) {
    console.log(JSON.stringify({ issues, filesScanned }, null, 2));
    return;
  }

  console.log(`Scanned ${filesScanned} file(s).`);

  if (issues.length === 0) {
    console.log("No unused props found.");
    return;
  }

  console.log(`\nFound ${issues.length} unused prop(s):\n`);
  for (const issue of issues) {
    console.log(`  ${issue.filePath}:${issue.line}  ${issue.componentName} -> "${issue.propName}" is never used`);
  }
}

async function run(): Promise<void> {
  const program = new Command();

  program
    .name("unused-props")
    .description("Detect props declared but never used in React and Vue components")
    .argument("[dir]", "directory to scan", ".")
    .option("--ignore <names...>", "prop names to ignore", [])
    .option("--json", "output results as JSON", false)
    .parse(process.argv);

  const args: CliArgs = {
    dir: program.args[0] ?? ".",
    ignore: (program.opts().ignore as string[]) ?? [],
    json: Boolean(program.opts().json),
  };

  const reactPatterns = await fg([`${args.dir}/**/*.tsx`], {
    ignore: ["**/node_modules/**", "**/dist/**"],
  });
  const vueFiles = await fg([`${args.dir}/**/*.vue`], {
    ignore: ["**/node_modules/**", "**/dist/**"],
  });

  const reactResult = analyzeReactProject({ patterns: reactPatterns, ignoreProps: args.ignore });
  const vueResult = analyzeVueProject({ patterns: vueFiles, ignoreProps: args.ignore });

  const allIssues = [...reactResult.issues, ...vueResult.issues];
  const totalFiles = reactResult.filesScanned + vueResult.filesScanned;

  printReport(allIssues, totalFiles, args.json);

  if (allIssues.length > 0) {
    process.exitCode = 1;
  }
}

run().catch((error: unknown) => {
  console.error("unused-props failed:", error);
  process.exitCode = 1;
});
