# ADR 001: Cordis Plugin Architecture

## Status
Accepted

## Context
qeek needs a modular, extensible architecture where every feature is a plugin that can be:
- Added/removed without core changes
- Hot-reloaded during development
- Composed into different profiles (CLI, Web, Desktop)
- Versioned and distributed independently
- Tested in isolation

## Decision
Use **Cordis** as the plugin framework, following the DeepSeek Harness pattern.

### Key Principles
1. **Everything is a plugin** - Agent loop, tools, LLM adapters, session manager, etc.
2. **Services via context** - Plugins register services on `ctx` key (e.g., `ctx.tools`, `ctx.llm`)
3. **Events for extension** - Extension points are typed events (e.g., `agent/pre-step`, `tools/pre-execute`)
4. **Reversible effects** - Plugin registration is an effect that unwinds on unload
5. **Profiles compose bundles** - Bundles are distribution units; profiles stack bundles + patches

### Structure
```
packages/
  qeek-core/          # Core integration plugin
  qeek-agent/         # Agent loop, registry
  qeek-session/       # Session log, persistence
  qeek-tools/         # Tool registry, built-in tools
  qeek-llm/           # LLM provider adapters
  qeek-mcp/           # MCP client/server
  qeek-fs/            # Filesystem with policy
  qeek-shell/         # Shell execution
  qeek-browser/       # Browser automation
  qeek-sandbox/       # Process sandboxing
  qeek-subagent/      # Subagent delegation
  qeek-workflow/      # Workflow orchestration
  qeek-*/             # 30+ more plugins
config/
  personal-assistant.cordis.yml      # Web profile
  personal-assistant-headless.cordis.yml  # CLI profile
```

## Consequences

### Positive
- **Extensibility**: New features = new plugins, no core changes
- **Composability**: Profiles enable CLI/Web/Desktop from same codebase
- **Testability**: Plugins can be tested in isolation with mock context
- **Hot Reload**: Development iteration without restart
- **Distribution**: Bundles can be published to npm independently
- **Alignment**: Compatible with DeepSeek Harness ecosystem

### Negative
- **Complexity**: Cordis learning curve for new contributors
- **Debugging**: Event-driven flow harder to trace than direct calls
- **Performance**: Indirect service lookup adds minimal overhead
- **Bundle Size**: All plugins included unless tree-shaken

## Implementation Notes

### Plugin Template
```typescript
import { definePlugin } from '@deepseek-ai/dsh-core';

export const myPlugin = definePlugin({
  name: 'my-plugin',
  description: 'What this plugin does',
  setup(ctx) {
    // Register services
    ctx.register('my-service', { /* implementation */ });
    
    // Listen to events
    ctx.on('agent/pre-step', (next, input) => {
      // Modify/observe
      return next(input);
    });
    
    // Provide API
    ctx.provide('myApi', { /* methods */ });
  }
});
```

### Profile Composition
```yaml
# config/profile.cordis.yml
- id: base-bundle
  name: '@deepseek-ai/dsh-bundle-base'
- insert:
      - id: my-plugin
        name: '@zoveli/my-plugin'
```

## References
- [Cordis Documentation](https://github.com/cordiverse/cordis)
- [DeepSeek Harness Architecture](https://github.com/deepseek-ai/deepseek-harness)
- [ADR 002: Capability Awareness System](./002-capability-awareness.md)