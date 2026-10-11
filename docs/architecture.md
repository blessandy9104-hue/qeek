# qeek Architecture

> See ADRs 001–005 for decisions. This is the map; ADRs are the reasons.

## Runtime composition

```
User (CLI / Web / Desktop)
  → dsh profile (config/*.cordis.yml)
    → Cordis context (ctx)
      → qeek plugins (47 total)
        → capabilities (scanner → registry → adaptation)
        → tools (guarded pre/post pipeline)
        → sessions (JSONL + projections)
        → external systems (mathcore MCP, vault FS, LLM APIs)
```

## Plugin inventory

| Area | Plugins |
|------|---------|
| Core | `assistant-core`, `assistant-agent`, `assistant-session`, `assistant-tools`, `assistant-llm`, `assistant-scope` |
| Execution | `assistant-fs`, `assistant-shell`, `assistant-browser`, `assistant-sandbox`, `assistant-terminal`, `assistant-computer-use`, `assistant-lsp` |
| Intelligence | `assistant-subagent`, `assistant-workflow`, `assistant-plan`, `assistant-agent-teams`, `assistant-goals`, `assistant-preset`, `assistant-todo`, `assistant-schedule`, `assistant-workspace` |
| Memory/context | `assistant-memory`, `assistant-context`, `assistant-compaction`, `assistant-document`, `assistant-attachment`, `assistant-conversation` |
| System | `assistant-settings`, `assistant-credentials`, `assistant-telemetry`, `assistant-guard`, `assistant-identity`, `assistant-interaction`, `assistant-feedback`, `assistant-storage`, `assistant-webhook`, `assistant-plugin-manager`, `assistant-acp`, `assistant-sdk` |
| qeek differentiators | `assistant-math` (mathcore), `assistant-skills`, `qeek-capability`, `qeek-languages`, `qeek-search`, `qeek-event-logger`, `qeek-telemetry`, `qeek-code-analysis`, `qeek-docgen`, `qeek-health`, `qeek-graph`, `qeek-scheduler`, `qeek-secscan` |

## Data flows

- **Chat turn:** `turn/start` → `agent/pre-step` → prompt assembly → `llm/stream` → `tools/*` → `step/end` → `turn/end`. All model-visible inputs are durable session events.
- **Verified math:** agent proposes → `mathcore_compute` → MCP stdio → sealed certificate → `OutputGuard` renders only releasable values → hash-chained audit log.
- **Memory:** agent tools → vault FS (`knowledge-vault/`) → Tantivy index (`qeek-search`) + wiki-link graph (`qeek-graph`).
- **Languages:** `language_detect` → `language_analyze`/`lint` → `language_format` → `language_run_tests`; tooling guide via `language_get_tooling`.

## Profiles

- `config/personal-assistant.cordis.yml` — web (all plugins + web bundle).
- `config/personal-assistant-headless.cordis.yml` — CLI (all plugins + headless bundle).

## Observability

In-memory meters always on (`qeek_turns_total`, `qeek_tools_called`, `qeek_math_verified`, `qeek_memory_operations`); Prometheus + OTLP when `TELEMETRY_ENABLED=true`. Grafana dashboard in `docker/grafana/dashboards/qeek-overview.json`. Event tracing via `qeek-event-logger` at `/debug/events`.
