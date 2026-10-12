# Runbook: MCP Disconnect (mathcore)

## Symptoms
- `mathcore_compute` fails / times out
- Capability `mathcore.verified-compute` shows `degraded`/`unavailable`

## Diagnosis
1. `mathcore "2+2"` directly — if this fails, the server itself is down.
2. Check process: `ps aux | grep mathcore-mcp`.
3. Check audit log writable: `ls -la ~/.mathcore/audit.jsonl`.
4. Check `capability_check {capability: "mathcore.verified-compute", details: true}`.

## Resolution
```bash
pip install -e ./mathcore --force-reinstall
mkdir -p ~/.mathcore && touch ~/.mathcore/audit.jsonl
MATHCORE_AUDIT=~/.mathcore/audit.jsonl mathcore "2+2"
# restart Zoveli afterwards
```
Fallback: agent uses LLM reasoning with explicit `UNVERIFIED` prefix until MCP recovers (see `capability_adapt`).

## Prevention
- Startup probe runs `mathcore "2+2"` and marks capability accordingly.
- CI installs mathcore and runs `tests/integration/capability.integration.test.ts`.
