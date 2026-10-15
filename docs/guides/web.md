# Zoveli Web Guide

## Run
```bash
pnpm run web
# → http://127.0.0.1:3080
```

## UI surfaces
- **Chat:** streaming messages, `VERIFIED` badges on math, tool-call nodes.
  Every reply names its model (`via mathcore` / `via qwen3:4b`, …) with a
  `stays on this machine` note for local providers; URLs in messages render
  as safe links. Recent chats persist in the browser only (capped at 100)
  and can be wiped anytime with **Clear chats**.
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
- Upload trims: 1MB bodies, 50k-char chat messages.

## TLS termination (for any network exposure)

The server binds plain `http://127.0.0.1` by design. To expose it beyond
localhost, terminate TLS at a reverse proxy so the app sees
`X-Forwarded-Proto: https` (which enables HSTS responses):

```caddy
# Caddyfile: automatic HTTPS + reverse proxy
zoveli.example.com {
    reverse_proxy 127.0.0.1:3080
}
```

Never expose the port directly without a token: set `ZOVELI_API_TOKEN`
(min 16 chars) to require bearer auth on `/api/run` and `/api/chat`.

## Interface themes (your choice of look)

The chat and login pages ship 5 looks, switchable from the theme bar
(choice persists in the browser — no account, no network):

- **Daylight** (default), **Midnight**, **Forest**, **Sunset** — pure CSS,
  fully offline.
- **Unicorn** — animated Unicorn Studio WebGL backdrop over a light
  glass UI. The runtime loads from its CDN **only** when you pick this
  theme; every other theme makes zero external requests.

Smooth scrolling throughout is Lenis, served vendored from
`/vendor/lenis.min.js` (pinned 1.3.26, same origin); if it ever fails to
load, pages fall back to native scroll.

Point Unicorn at your own scene: publish a scene in
[Unicorn Studio](https://www.unicorn.studio), then set
`ZOVELI_UNICORN_PROJECT=<your-project-id>` before `pnpm run web`.
The default is their public Fluted Gradient example.

## Docker
```bash
docker compose -f docker/docker-compose.yml --profile web up --build
docker compose -f docker/docker-compose.yml --profile monitoring up
```
