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
| Intelligence | `assistant-subagent`, `assistant-workflow`, `assistant-plan`, `assistant-agent-teams`, `assistant-goals`, `assistant-preset`, `assistant-todo`, `assistant-schedule`, `assistant-workspace`, `assistant-mcp` |
| Memory/context | `assistant-memory`, `assistant-context`, `assistant-compaction`, `assistant-document`, `assistant-attachment`, `assistant-conversation` |
| System | `assistant-settings`, `assistant-credentials`, `assistant-telemetry`, `assistant-guard`, `assistant-identity`, `assistant-interaction`, `assistant-feedback`, `assistant-storage`, `assistant-webhook`, `assistant-plugin-manager`, `assistant-acp`, `assistant-sdk` |
| qeek differentiators | `assistant-math` (mathcore), `assistant-skills`, `zoveli-capability`, `qeek-languages`, `qeek-search`, `qeek-event-logger`, `qeek-telemetry`, `qeek-code-analysis`, `qeek-docgen`, `qeek-health`, `qeek-graph`, `qeek-scheduler`, `qeek-secscan`, `qeek-sysinfo`, `qeek-auth` |
| Host + compat | `qeek-host` (loader, REPL, chat, HTTP wiring), `shim-dsh-core` (local authoring shim, not a runtime) |

## Data flows

- **Chat turn (qeek-host):** user text → optional math fast-path → OpenAI-compatible `chat/completions` with function tools → tool execution → follow-up turn, up to `maxSteps`. History is in-memory per session; durable session log is future work.
- **Verified math:** agent proposes → `mathcore_compute` → MCP stdio → sealed certificate → `OutputGuard` renders only releasable values → hash-chained audit log.
- **Memory:** agent tools → vault FS (`knowledge-vault/`) → in-memory TF index (`qeek-search`, dependency-free) + wiki-link graph (`qeek-graph`).
- **Languages:** `language_detect` → `language_analyze`/`lint` → `language_format` → `language_run_tests`; tooling guide via `language_get_tooling`.

## Profiles and runtime

Apps boot through `@zoveli/host` (`QeekHost.mount` + REPL/HTTP), not
through a Cordis launcher. `config/*.cordis.yml` declares the intended
full-profile plugin composition for future upstream-Cordis integration;
today they are documentation, not executed code. The web server mounts
`defaultPlugins` + `qeek-auth`; the CLI mounts `defaultPlugins`.

## Observability

In-memory meters always on (`qeek_turns_total`, `qeek_tools_called`, `qeek_math_verified`, `qeek_memory_operations`); Prometheus + OTLP when `TELEMETRY_ENABLED=true`. Grafana dashboard in `docker/grafana/dashboards/qeek-overview.json`. Event tracing via `qeek-event-logger` at `/debug/events`.

