# Zoveli Architecture

> See ADRs 001–005 for decisions. This is the map; ADRs are the reasons.
> Math and memory subsystems have their own maps:
> [math-subsystem.md](math-subsystem.md), [memory-store.md](memory-store.md).

## Runtime composition

```
User (CLI / Web / Desktop)
  → dsh profile (config/*.cordis.yml)
    → Cordis context (ctx)
      → zoveli plugins (61 packages; 19 mounted by default)
        → capabilities (scanner → registry → adaptation)
        → tools (guarded pre/post pipeline, ~48 live)
        → sessions (JSONL + projections)
        → external systems (mathcore MCP, SQLite store, vault FS, LLM APIs)
```

## Plugin inventory

| Area | Plugins |
|------|---------|
| Core | `core`, `agent`, `session`, `tools`, `llm`, `scope` |
| Execution | `fs`, `shell`, `browser`, `sandbox`, `terminal`, `computer-use`, `lsp` |
| Intelligence | `subagent`, `workflow`, `plan`, `agent-teams`, `goals`, `preset`, `todo`, `schedule`, `workspace`, `mcp` |
| Memory/context | `memory`, `memory-store`, `context`, `compaction`, `document`, `attachment`, `conversation` |
| System | `settings`, `credentials`, `telemetry`, `guard`, `identity`, `interaction`, `feedback`, `storage`, `webhook`, `plugin-manager`, `acp`, `sdk` |
| Zoveli differentiators | `math-intelligence` (governor: verified compute + proof memory + rules), `math-domains` (algebra/calculus/statistics/logic/units/discrete specialists), `math` (back-compat shim), `skills`, `capability`, `languages`, `search`, `event-logger`, `otel`, `code-analysis`, `docgen`, `health`, `graph`, `scheduler`, `secscan`, `sysinfo`, `auth` |
| Host + compat | `host` (loader, REPL, chat, HTTP wiring), `shim-dsh-core` (local authoring shim, not a runtime) |

The host's `defaultPlugins` (19) are the tool-bearing set: core,
math-intelligence, the 4 math specialists, memory-store, memory, skills,
languages, sysinfo, search, scheduler, secscan, health, graph, docgen,
code-analysis, capability.

## Data flows

- **Chat turn (zoveli-host):** user text → optional math fast-path → OpenAI-compatible `chat/completions` with function tools → tool execution → follow-up turn, up to `maxSteps`. History is in-memory per session; durable session log is future work.
- **Verified math:** agent proposes → `math_route` (classify) → specialist solve (`math_algebra_solve`, …) or `mathcore_compute` → MCP stdio → sealed certificate → auto-memorized proof note → `OutputGuard` renders only releasable values → hash-chained audit log.
- **Memory:** agent tools → SQLite store (`~/.zoveli/memory.db`, FTS5-ranked) → Markdown export mirror (`knowledge-vault/`) → wiki-link graph (`graph`). Legacy `.md` files import once on first boot.
- **Languages:** `language_detect` → `language_analyze`/`lint` → `language_format` → `language_run_tests`; tooling guide via `language_get_tooling`.

## Profiles and runtime

Apps boot through `@zoveli/host` (`ZoveliHost.mount` + REPL/HTTP), not
through a Cordis launcher. `config/*.cordis.yml` declares the intended
full-profile plugin composition for future upstream-Cordis integration;
today they are documentation, not executed code. The web server mounts
`defaultPlugins` + `zoveli-auth`; the CLI mounts `defaultPlugins`.

## Observability

In-memory meters always on (`zoveli_turns_total`, `zoveli_tools_called`, `zoveli_math_verified`, `zoveli_memory_operations`); Prometheus + OTLP when `TELEMETRY_ENABLED=true`. Grafana dashboard in `docker/grafana/dashboards/zoveli-overview.json`. Event tracing via `event-logger` at `/debug/events`.
