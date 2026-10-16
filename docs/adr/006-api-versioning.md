# ADR 006: Defer HTTP API Versioning

## Status
Accepted

## Context
The web server exposes a small HTTP surface (`/health`, `/api/tools`,
`/api/chat`, `/api/run`, login + `/api/auth/*`). Consumers today are our
own CLI/web/desktop and local scripts — no external clients pin versions.
Adding a `/v1` prefix now would double every route and test for zero
current benefit.

## Decision
No version prefix until the first breaking change. When a breaking change
to any endpoint ships, introduce `/v1` (current shape frozen) and serve
the new shape unprefixed, with the old shape kept for one release and a
migration note in the release draft.

## Consequences

### Positive
- One canonical route table; docs, e2e, and install scripts stay simple.
- Versioning cost is paid only when it buys compatibility.

### Negative
- The first breaking change must do the prefixing work under time
  pressure; the rule above pre-commits the shape to keep it cheap.

## Triggers (revisit this ADR when any hits)
- An external client outside this repo consumes the API.
- A breaking change to any endpoint is proposed.
- The API gains a second consumer class (e.g., mobile app, SaaS relay).

## References
- `docs/api/README.md` (HTTP endpoints section)
- `apps/web/src/server.ts` (route table)
