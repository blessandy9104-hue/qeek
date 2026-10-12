# ADR 005: Programming Languages Capability

## Status
Accepted

## Context
qeek agents routinely read, write, review, and test code. Ad-hoc handling per language leads to inconsistent results, missing tooling guidance, and unverified claims about code quality.

## Decision
Add a dedicated `@zoveli/languages` plugin providing:
- **Detection** by extension → filename → shebang → content heuristics (17 languages).
- **Analysis** with LOC/comments/blanks, cyclomatic + cognitive complexity, maintainability index, function/class/import/export extraction, universal issue checks + LSP diagnostics.
- **Formatting** via native tools in temp dirs (`prettier`, `black`, `rustfmt`, `gofmt`) with deterministic fallback.
- **Linting** via universal checks + eslint JSON + LSP, normalized to `CodeIssue[]`.
- **Test running** via `vitest` / `pytest` / `cargo test` / `go test` with structured `TestResult`.
- **Tooling guide** with per-language LSP/formatter/linter/test-runner, install hints, and live availability probes.

Expose as 6 agent tools (`language_detect`, `language_analyze`, `language_format`, `language_lint`, `language_run_tests`, `language_get_tooling`) and register `languages.polyglot` in the capability scanner.

## Consequences

### Positive
- Consistent polyglot code workflows across CLI/Web/Desktop profiles.
- Offline-safe: fallbacks work with zero native tools installed.
- Testable: pure detector + file-injected analyzer/formatter covered by unit tests.
- Discoverable: capability report shows language support explicitly.

### Negative
- **Heuristic analysis**: regex-based structure extraction misses edge cases (macros, decorators, complex generics).
- **Native tool dependence**: best results still require `prettier`/`black`/`rustfmt`/`eslint` on PATH or via npx.
- **Test parser brittleness**: vitest/pytest output formats change across versions.

## Workarounds
- Heuristics documented as baseline; LSP diagnostics layered on top when available; tree-sitter upgrade path reserved (see WORKAROUNDS.md).
- `npx --yes` fallback for JS/TS tools; install hints + availability probes guide setup.
- Parsers written defensively (NDJSON + array handling, regex fallbacks returning `skipped` instead of false failures).

## References
- `docs/capabilities/languages.md`
- `docs/WORKAROUNDS.md`
- ADR 002 (Capability Awareness), ADR 001 (Cordis plugins)

