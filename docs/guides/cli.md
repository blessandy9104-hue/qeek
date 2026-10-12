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
- **Chat:** any other text, once `DEEPSEEK_API_KEY` is set
  (or `ZOVELI_API_BASE` for a local OpenAI-compatible server)

## Env

`ZOVELI_VAULT_PATH`, `MATHCORE_AUDIT`, `MATHCORE_TIMEOUT_MS`,
`TELEMETRY_ENABLED`, `OTLP_ENDPOINT`, `PROM_PORT`, `DEEPSEEK_API_KEY`,
`ZOVELI_API_BASE`, `ZOVELI_MODEL`.

## Troubleshooting

- mathcore missing → `pip install -e ./mathcore`; verify `mathcore "2+2"`.
- No capabilities → `capability_scan`; see `docs/runbooks/capability-scan-failures.md`.
- Slow search → vault reindex runs every 5 min; check `zoveli-search` logs.
