# Small plugin SDK — quick guide

This document describes a minimal plugin shape for Zoveli and an example plugin you can use as a reference.

Goals
- Keep the plugin API tiny and clearly versioned
- Make plugins easy to write in TypeScript (Node) and hot-loadable by the host
- Provide a manifest so the host can introspect capabilities without executing code

Plugin structure (recommended)

plugins/<plugin-name>/
  ├─ plugin.json           # manifest (name, version, exports, capabilities)
  ├─ dist/index.js         # compiled CommonJS entry (runtime)
  ├─ src/index.ts          # source (optional)
  └─ README.md

Minimal manifest (plugin.json)
{
  "name": "example-plugin",
  "version": "0.1.0",
  "main": "dist/index.js",
  "capabilities": ["tool", "command"],
  "description": "A tiny example plugin that registers a ping tool."
}

Runtime plugin shape (CommonJS)
module.exports = {
  register: async function (host) {
    host.registerTool({
      id: 'example.ping',
      name: 'Ping',
      description: 'Responds with pong and runtime info',
      run: async (context, input) => {
        return { ok: true, result: `pong (pid=${process.pid})` }
      }
    })
  }
}

Host contract (what the host provides)
- host.registerTool(toolDescriptor) — registers a tool. toolDescriptor: { id, name, description, run }
- host.log(level, message)
- host.config() — returns runtime config
- host.storage.get/set for plugin-local storage (optional)

Versioning and compatibility
- The host must guarantee a stable plugin API. Use semantic versioning for plugin.json `version` and a `plugin_api_version` field when the host API changes.

Security notes
- Plugins are executable code — prefer sandboxing or run untrusted plugins with reduced privileges.
- Prefer manifest-only discovery (plugin.json) and validate manifest fields before loading.
