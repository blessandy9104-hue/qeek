# Example plugin — example-plugin

This is a minimal example plugin that registers a small "ping" tool with the host. It's intentionally tiny so you can copy it as a starting point.

Usage
- Place this folder under `plugins/example-plugin`
- Build (if you use TypeScript) and ensure `plugin.json` points to the runtime entry

plugin.json
{
  "name": "example-plugin",
  "version": "0.1.0",
  "main": "dist/index.js",
  "capabilities": ["tool"],
  "description": "A tiny example plugin that registers a ping tool."
}

src/index.ts
```ts
import type { Host } from '../../types/host'

export async function register(host: Host) {
  host.registerTool({
    id: 'example.ping',
    name: 'Ping',
    description: 'Responds with pong and runtime info',
    run: async (_context: any, _input: any) => {
      return { ok: true, result: `pong (pid=${process.pid})` }
    }
  })
}
```
