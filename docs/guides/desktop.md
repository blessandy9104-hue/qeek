# qeek Desktop Guide

## Run (development)

```bash
pnpm install
pnpm run build
pnpm --filter @personal-assistant/assistant-desktop start
```

The shell spawns `assistant-web` locally, waits for `/health`, then opens
it in a window. No remote servers, no accounts. Set `QEEK_DESKTOP_PORT`
to change the port (default 3080).

## Verify without a window

```bash
QEEK_DESKTOP_SMOKE=1 pnpm --filter @personal-assistant/assistant-desktop start
# → "qeek desktop smoke OK: server healthy on 127.0.0.1:3080"
```

## Packaged installers

Not shipped: `.exe`/`.dmg`/`.AppImage` builds require OS code-signing
certificates and `electron-builder` configuration, which are intentionally
not in this repo. The development shell above is the supported path.
