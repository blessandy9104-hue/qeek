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

## Docker
```bash
docker compose -f docker/docker-compose.yml --profile web up --build
docker compose -f docker/docker-compose.yml --profile monitoring up
```
