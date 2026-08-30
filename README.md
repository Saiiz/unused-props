# unused-props

Detects props that are declared but never used, across **React** and **Vue** components — using real TypeScript type analysis instead of AST pattern-matching.

## Why

Existing tools fall short on this specific problem:

- ESLint's `react/no-unused-prop-types` has open, unresolved bugs when combined with TypeScript and the newer JSX transform.
- ESLint's `vue/no-unused-properties` produces false positives on functional components and can't reliably track usage through mixins or `$refs`.

`unused-props` resolves the actual props type (via `ts-morph`, wrapping the TypeScript Compiler API) and checks real usage in the component body or template, rather than relying on fragile AST heuristics.

## Status: early v0.1

This is a proof of concept. Current coverage:

| Pattern | React | Vue |
|---|---|---|
| `props: Props` + `props.x` access | ✅ | — |
| Destructured props (`{ title }: Props`) | ✅ | — |
| Renamed destructured props (`{ title: t }`) | ✅ | — |
| Destructuring with a rest element (`{ title, ...rest }`) | ⚠️ skipped safely (see below) | — |
| `defineProps<Props>()` (script setup) | — | ✅ |
| `defineProps({ ... })` (runtime/Options API) | — | 🚧 not yet supported |

See [Limitations](#limitations) before relying on this in CI.

## Install

```bash
npm install --save-dev unused-props
```

## Usage

```bash
npx unused-props ./src
npx unused-props ./src --ignore variant size
npx unused-props ./src --json
```

Exits with code `1` if any unused prop is found — safe to use as a CI gate.

## Programmatic usage

```ts
import { analyzeReactProject, analyzeVueProject } from "unused-props";

const result = analyzeReactProject({
  patterns: ["src/**/*.tsx"],
  ignoreProps: ["className"],
});
```

## Limitations

- When a component destructures props with a rest element (`{ title, ...rest }`), the whole component is skipped — `rest` could be forwarded to a child component (`<Child {...rest} />`), so usage can't be determined safely without deeper call-graph analysis.
- Nested destructuring (`{ meta: { author } }`) isn't analyzed yet.
- Props typed in a file other than the component's own file aren't resolved yet (cross-file type imports are out of scope for v0.1).
- Vue support currently covers `<script setup lang="ts">` with the generic `defineProps<Props>()` form only.
- This tool aims for **zero false positives** over broad coverage. If you hit one, please open an issue — a tool like this is only useful in CI if it can be trusted.

## Contributing

Issues and PRs welcome. Please include a minimal repro (a small `.tsx` or `.vue` snippet) for any false positive or false negative report.

## License

MIT
