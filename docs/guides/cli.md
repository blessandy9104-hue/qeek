# qeek CLI Guide

## Install
```bash
pip install -e ../mathcore
pnpm install && pnpm run build
```

## Run
```bash
pnpm run dev
# or
node apps/assistant-cli/dist/cli.js
```

## Everyday flows
- **Verified math:** `compute derivative of x^2` → expect `[VERIFIED]`
- **Remember:** `remember that I prefer dark mode` → saved to `knowledge-vault/`
- **Recall:** `what do I prefer?` → searched via vault
- **Review code:** `review src/index.ts` → `code_review` findings
- **Check health:** `check project health` → `project_health` score
- **Scan secrets:** `scan . for secrets` → `security_scan` summary
- **Schedule day:** `plan my tasks: ...` → `tasks_schedule` blocks

## Env
`ASSISTANT_VAULT_PATH`, `MATHCORE_AUDIT`, `TELEMETRY_ENABLED`, `OTLP_ENDPOINT`, `PROM_PORT`.

## Troubleshooting
- mathcore missing → `pip install -e ../mathcore`; verify `mathcore "2+2"`.
- No capabilities → `capability_scan`; see `docs/runbooks/capability-scan-failures.md`.
- Slow search → `vault` reindex runs every 5 min; check `qeek-search` logs.
