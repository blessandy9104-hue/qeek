# ADR 002: Capability Awareness System

## Status
Accepted

## Context
qeek has 43+ plugins providing diverse capabilities (math, browser, shell, LSP, etc.). The agent needs to:
- Know what capabilities are available at runtime
- Adapt task execution based on available capabilities
- Detect degraded/unavailable capabilities
- Provide introspection for users and debugging
- Enable graceful degradation

## Decision
Implement a **Capability Awareness System** with three components:

### 1. CapabilityScanner
Discovers capabilities from multiple sources:
- **Builtin**: Hardcoded core capabilities (mathcore, vault, agent loop)
- **Plugins**: Capabilities exposed by loaded plugins
- **MCP Servers**: Tools/resources from connected MCP servers
- **External**: System binaries (docker, git, python, node)
- **Virtual**: LLM reasoning, planning (derived capabilities)

### 2. CapabilityRegistry
Maintains registered capabilities with:
- Status tracking (available/degraded/unavailable)
- Health metrics (success rate, latency, errors)
- Dependency resolution
- Filtering by category, status, priority

### 3. CapabilityAdaptation
Adapts task execution:
- Maps task types to required capabilities
- Selects optimal capability combination
- Handles fallbacks when preferred unavailable
- Generates recommendations and gap analysis

## Capability Model

```typescript
interface Capability {
  name: string;
  displayName: string;
  description: string;
  category: CapabilityCategory;
  version: string;
  status: CapabilityStatus;
  priority: 'critical' | 'high' | 'medium' | 'low' | 'optional';
  dependencies: string[];
  provides: string[];
  requires: CapabilityRequirement[];
  health: CapabilityHealth;
}
```

## Integration Points

### Agent Injection
On `agent/created`, inject capability summary.

### Tools
- `capability_scan` - Discover all capabilities
- `capability_check` - Check specific capability
- `capability_list` - List with filters
- `capability_adapt` - Get adaptation for task
- `capability_report` - Generate awareness report

### Periodic Scanning
- Auto-scan on `turn/start` (incremental)
- Full scan every 5 minutes
- Deep scan on demand

## Consequences

### Positive
- Self-Awareness: Agent knows its own limits
- Graceful Degradation: Falls back when capabilities unavailable
- User Transparency: Users can query capabilities
- Debugging: Clear picture of system state
- Optimization: Selects best capability for task

### Negative
- Overhead: Scanning adds latency (mitigated by caching)
- Complexity: Additional system to maintain
- False Positives: May report available when degraded

## Implementation
Located in `packages/qeek-capability/`