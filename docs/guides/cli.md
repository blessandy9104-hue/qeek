# Zoveli CLI Guide

## Install

```bash
pip install -e ./mathcore   # vendored verified-math backend
pnpm install && pnpm run build
```

## Run

```bash
pnpm start
# or
node apps/cli/dist/cli.js
```

## Everyday flows

- **Verified math:** `/math solve x^2 - 5x + 6 = 0` → `VERIFIED` + certificate,
  or type a bare expression like `2+2`
- **Audit an answer:** `/check integrate x^2 from 0 to 3 ;; the answer is 9`
  → `MATCH` (wrong answers get `MISMATCH`, never a silent guess)
- **Host facts:** `/sys` → OS/CPU/RAM/disk/GPU snapshot
- **Capabilities:** `/caps` → available/total count
- **Tool list:** `/tools` → all ~37 local tools
- **Chat:** any other text, once a chat model is available (see below —
  any API key or free local Ollama)

## Chat models (your preference, zero cost possible)

Resolution order: any API key → free local Ollama → tools-only offline.

```bash
# Option A — free and local, no keys, no cost:
# 1. Install from https://ollama.com, then:
ollama pull llama3.1
pnpm start   # auto-detects Ollama, chat just works

# Option B — any API key (OpenAI-compatible providers):
OPENAI_API_KEY=sk-... pnpm start        # or DEEPSEEK_API_KEY,
# OPENROUTER_API_KEY, GROQ_API_KEY, TOGETHER_API_KEY, ZOVELI_API_KEY
ZOVELI_MODEL=gpt-4o-mini pnpm start     # pick any model name
ZOVELI_API_BASE=https://my-proxy/v1 ZOVELI_API_KEY=... pnpm start  # custom endpoint

# Docker: ollama runs as a sibling service, already wired:
docker compose --profile local-llm up ollama
docker exec zoveli-ollama ollama pull llama3.1
docker compose --profile cli up --build
```

`ZOVELI_OLLAMA_URL` overrides the Ollama address (default
`http://localhost:11434`; Docker Compose sets it to `http://ollama:11434`).

## Env

`ZOVELI_VAULT_PATH`, `MATHCORE_AUDIT`, `MATHCORE_TIMEOUT_MS`,
`TELEMETRY_ENABLED`, `OTLP_ENDPOINT`, `PROM_PORT`, `ZOVELI_API_KEY`,
`OPENAI_API_KEY`, `DEEPSEEK_API_KEY`, `OPENROUTER_API_KEY`, `GROQ_API_KEY`,
`TOGETHER_API_KEY`, `ZOVELI_API_BASE`, `ZOVELI_MODEL`, `ZOVELI_OLLAMA_URL`,
`ZOVELI_OLLAMA_MODEL`.

## Troubleshooting

- mathcore missing → `pip install -e ./mathcore`; verify `mathcore "2+2"`.
- No capabilities → `capability_scan`; see `docs/runbooks/capability-scan-failures.md`.
- Slow search → vault reindex runs every 5 min; check `zoveli-search` logs.
