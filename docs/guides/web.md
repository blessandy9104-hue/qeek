# Zoveli Web Guide

## Run
```bash
pnpm run web
# → http://127.0.0.1:3080
```

## UI surfaces
- **Chat:** streaming messages, `VERIFIED` badges on math, tool-call nodes.
- **Vault sidebar:** browse/search notes, click wiki-links.
- **Debug:** `/debug/events` (event trace), `/debug/events/stats`, `/metrics` (Prometheus).
- **Grafana:** `docker compose --profile monitoring up` → `:3000` (admin/admin).

## Security posture (localhost server)

- Binds `127.0.0.1` only; non-loopback `Host` headers get 403
  (DNS-rebinding guard; `ZOVELI_ALLOWED_HOSTS` adds explicit extras).
- Hardening headers on every response; `HttpOnly` + `SameSite=Lax` cookies.
- Per-IP rate limits: auth routes 30/min, `/api/chat` + `/api/run` 120/min.
- Optional bearer token for tool-running routes: set `ZOVELI_API_TOKEN`
  (min 16 chars) to require `Authorization: Bearer` on `POST /api/run`
  and `POST /api/chat`. Off by default to preserve no-account local UX.
- Server errors are secret-redacted; math certificates pass through.

## Docker
```bash
docker compose -f docker/docker-compose.yml --profile web up --build
docker compose -f docker/docker-compose.yml --profile monitoring up
```
