# Workarounds for Known Negative Consequences

This document provides practical workarounds for all identified negative consequences in the Zoveli architecture.

---

## ADR 001: Cordis Plugin Architecture

### Negative: Cordis Learning Curve
**Workaround:**
- **Interactive Tutorial**: `docs/tutorials/cordis-basics.md` with runnable examples
- **Plugin Generator**: `pnpm run create:plugin <name>` scaffolds boilerplate
- **VS Code Extension**: Cordis snippets, hover docs, go-to-definition for ctx keys
- **Mentor Program**: Pair new contributors with experienced plugin authors
- **Decision**: Document "Cordis Mental Model" - think of it as React hooks for backend services

### Negative: Event-Driven Debugging Difficulty
**Workaround:**
- **Event Logger Plugin**: `event-logger` captures all events with timestamps, correlation IDs
- **Visual Trace Viewer**: Web UI at `/debug/events` shows event flow as sequence diagram
- **Correlation IDs**: Every request gets `x-correlation-id` propagated through all events
- **Replay Tool**: `pnpm run replay:event <correlation-id>` reproduces event sequence
- **Structured Logging**: All events emit JSON with `event`, `plugin`, `duration`, `result`

### Negative: Service Lookup Overhead
**Workaround:**
- **Service Cache**: Plugins memoize `ctx.get('service')` on first access
- **Direct Injection**: Critical paths use `ctx.provide('api', implementation)` for direct access
- **Benchmark**: Overhead measured at <0.1ms per lookup (negligible vs LLM latency)
- **Tree Shaking**: Build-time analysis removes unused service registrations

### Negative: Bundle Size
**Workaround:**
- **Profile-Specific Bundles**: `pnpm run build:cli` only includes CLI-required plugins
- **Dynamic Imports**: Heavy plugins (browser, sandbox) loaded on-demand via `import()`
- **Plugin Manifest**: `plugin.json` declares `optional: true` for tree-shaking
- **Size Budget**: CI fails if bundle exceeds 50MB (current: ~12MB CLI, ~25MB Web)

---

## ADR 002: Capability Awareness System

### Negative: Scanning Overhead
**Workaround:**
- **Incremental Scanning**: Only re-scan changed sources (file watchers, MCP health checks)
- **Cache with TTL**: 5-minute cache, invalidated on plugin load/unload
- **Background Worker**: Scanning runs in separate worker thread, non-blocking
- **Priority Scanning**: Critical capabilities scanned first, optional deferred

### Negative: System Complexity
**Workaround:**
- **Unified API**: Single `ctx.capability` object with `scan()`, `check()`, `adapt()`, `report()`
- **Auto-Configuration**: Sensible defaults, zero-config for 90% of use cases
- **Documentation**: Capability catalog at `docs/capabilities/` with examples
- **Migration Path**: Legacy `tool_*` calls auto-mapped to capability checks

### Negative: False Positives
**Workaround:**
- **Health Verification**: Active probe on first use (not just registration)
- **Degraded State**: Capability moves to `degraded` after 3 failures, auto-recovers on success
- **User Override**: `capability_check` tool accepts `force: true` to bypass cache
- **Telemetry**: False positive rate tracked, alerting if >5%

---

## ADR 003: mathcore Integration

### Negative: Python Dependency
**Workaround:**
- **Bundled Python**: Docker images include Python + mathcore pre-installed
- **Standalone Binary**: PyInstaller builds `mathcore-mcp` executable (no Python needed)
- **Fallback Calculator**: Built-in JS math for basic ops when mathcore unavailable
- **Install Script**: `scripts/install-mathcore.sh` handles all platforms

### Negative: MCP Latency
**Workaround:**
- **Connection Pooling**: Reuse stdio connection across calls (single process)
- **Batch Operations**: `mathcore_compute_batch` for multiple expressions
- **Async Pipeline**: Non-blocking, agent continues while mathcore computes
- **Cache Results**: Deterministic expressions cached (e.g., `2+2` always `4`)

### Negative: Limited Coverage
**Workaround:**
- **Domain Extensions**: Plugin system for custom math domains
- **Hybrid Mode**: LLM reasoning + mathcore verification for unsupported ops
- **Community Registry**: `mathcore-contrib` for user-contributed operations
- **Feature Requests**: GitHub Issues template for new operation requests

### Negative: Maintenance Burden
**Workaround:**
- **Automated Testing**: CI runs mathcore test suite on every PR
- **Version Pinning**: `mathcore==1.2.*` in requirements, auto-updates via Dependabot
- **Compatibility Layer**: Adapter handles mathcore API changes
- **Fallback Mode**: Graceful degradation to LLM-only with warning

---

## ADR 004: Local-First Memory (SQLite store; vault as export mirror)

> Superseded in substance by [memory-store.md](memory-store.md). The
> flat-file negatives below applied to the old vault-as-truth design.

### Negative: Search Performance
**Workaround:**
- **SQLite FTS5**: ranked full-text index maintained transactionally (implemented in `packages/memory-store/`)
- **Query Optimization**: Tag-first filtering before full-text
- **Legacy note (vault era)**: Tantivy background index / incremental fs.watch indexing

### Negative: Concurrency Issues
**Workaround (store era):**
- **ACID**: single-writer SQLite with WAL mode; no file races
- **Multi-User**: Not supported (single-user design), document clearly
- **Legacy note (vault era)**: `flock()` on note files, write-to-temp + atomic rename, last-write-wins with `.bak`

### Negative: Schema Evolution
**Workaround:**
- **Schema in code**: `MemoryStore` DDL is versioned with the package; export Markdown stays backward compatible
- **Migration Scripts**: `pnpm run migrate:vault` applies transformations
- **Backward Compatibility**: Readers handle missing/extra fields gracefully
- **Schema Registry**: Central `vault-schema.json` with validation

### Negative: Binary Files
**Workaround:**
- **Attachment Store**: Separate `attachments/` dir with content-addressable storage
- **References in Notes**: `![image](attachment:sha256:abc123)`
- **Preview Generation**: Thumbnails for images, text extraction for PDFs
- **Git LFS**: Optional Git LFS for large attachments

---

## General Architecture Workarounds

### Local Model Performance Gap
**Workaround:**
- **Hybrid Mode**: Local for privacy-sensitive, cloud for complex reasoning
- **Model Router**: Automatic selection based on task complexity
- **Quantization**: 4-bit GGUF models via llama.cpp for speed
- **Speculative Decoding**: Small draft model + large verify model

### Vault Corruption Risk
**Workaround:**
- **SQLite backup**: scheduled copy of `~/.zoveli/memory.db` (single file) to encrypted remote
- **Markdown mirror in git**: `knowledge-vault/` export mirror committed; legacy notes re-import on demand
- **Integrity Checks**: SHA-256 manifest, `pnpm run vault:verify`
- **Recovery Tool**: restore DB backup, or rebuild from the git mirror via one-time import

### Plugin Supply Chain
**Workaround:**
- **Signed Plugins**: Cosign verification for all installed plugins
- **Trusted Registry**: Official plugins from `registry.zoveli.dev`
- **Sandbox Execution**: Untrusted plugins run in gVisor/Firecracker
- **Permission Model**: Explicit user consent for new capabilities

### Configuration Drift
**Workaround:**
- **Config as Code**: All profiles in Git, no runtime mutation
- **Drift Detection**: `pnpm run config:diff` compares running vs stored
- **Immutable Profiles**: Profiles frozen at startup, changes require restart
- **Schema Validation**: JSON Schema for all config files

---

## Implementation Checklist

| Workaround | Status | Location |
|------------|--------|----------|
| Event Logger Plugin | ✅ Implemented | `packages/event-logger/` |
| Visual Trace Viewer | ✅ Implemented | `/debug/events` routes in `packages/event-logger/src/index.ts` |
| In-Memory Search Index | ✅ Implemented | `packages/memory-store/` (SQLite FTS5, transactional; replaced the TF index in `packages/search/`, now a delegate) |
| mathcore Binary Build | 📋 Planned | `scripts/build-mathcore-binary.sh` (not created yet) |
| Connection Pooling | 📋 Planned | single stdio MCP connection per server today; pool extraction pending |
| Plugin Generator | 📋 Planned | `scripts/create-plugin.ts` (not created yet) |
| Capability Health Probes | ✅ Implemented | `packages/capability/src/scanner.ts` (`verifyCapabilities`) |
| Vault Migration System | 📋 Planned | schema-versioned frontmatter; no migrator yet |
| Git Auto-Commit Hooks | 📋 Planned | no `.husky/` yet |
| Config Drift Detection | 📋 Planned | `scripts/config-diff.ts` (not created yet) |
| Programming Languages Fallbacks | ✅ Implemented | `packages/languages/` (native → deterministic fallback) |
| Knowledge Graph Export | ✅ Implemented | `packages/graph/` (JSON + DOT) |
| Security Secret Patterns | ✅ Implemented | `packages/secscan/` (7 pattern families) |
| Telemetry Fallback Meters | ✅ Implemented | `packages/otel/` (in-memory + lazy OTel) |

---

## Contributing Workarounds

If you discover a new negative consequence:

1. Document it in the relevant ADR
2. Add workaround here with implementation plan
3. Create tracking issue with `workaround` label
4. Assign to relevant package owner

All workarounds should follow the principle: **explicit over implicit, configurable over hardcoded, graceful over failing**.
