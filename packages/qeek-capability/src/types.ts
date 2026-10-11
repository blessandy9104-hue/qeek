export interface Capability {
  name: string;
  displayName: string;
  description: string;
  category: CapabilityCategory;
  subcategory?: string;
  version: string;
  status: CapabilityStatus;
  priority: 'critical' | 'high' | 'medium' | 'low' | 'optional';
  dependencies: string[];
  conflicts: string[];
  provides: string[];
  requires: CapabilityRequirement[];
  metadata: CapabilityMetadata;
  health: CapabilityHealth;
  discoveredAt: Date;
  lastVerified: Date;
}

export type CapabilityCategory = 
  | 'computation'      // mathcore, symbolic, numeric
  | 'memory'           // vault, session, storage, cache
  | 'tools'            // fs, shell, browser, terminal, lsp
  | 'agents'           // loop, subagent, teams, workflow
  | 'workflows'        // templates, scheduling, orchestration
  | 'communication'    // mcp, acp, webhook, sdk
  | 'perception'       // computer-use, vision, audio
  | 'action'           // click, type, execute, control
  | 'reasoning'        // planning, compaction, context
  | 'learning'         // feedback, adaptation, plugin-manager
  | 'system';          // settings, credentials, telemetry, guard

export type CapabilityStatus = 
  | 'available'        // Fully functional
  | 'degraded'         // Partially functional
  | 'unavailable'      // Not functional
  | 'unknown'          // Status unknown
  | 'initializing'     // Starting up
  | 'maintenance';     // Under maintenance

export interface CapabilityRequirement {
  type: 'package' | 'binary' | 'service' | 'env' | 'permission' | 'capability';
  name: string;
  version?: string;
  optional: boolean;
  description: string;
}

export interface CapabilityMetadata {
  source: 'builtin' | 'plugin' | 'mcp' | 'external' | 'virtual';
  pluginId?: string;
  mcpServer?: string;
  executable?: string;
  apiEndpoint?: string;
  documentation?: string;
  tags: string[];
  maturity: 'experimental' | 'beta' | 'stable' | 'deprecated' | 'unknown';
  maintainer?: string;
  license?: string;
}

export interface CapabilityHealth {
  lastCheck: Date;
  successRate: number;
  avgLatency: number;
  errorCount: number;
  warningCount: number;
  details?: Record<string, any>;
}

export interface CapabilityScanOptions {
  deep?: boolean;
  category?: CapabilityCategory;
  includeHidden?: boolean;
  forceRefresh?: boolean;
}

export interface CapabilityAdaptationOptions {
  task: any;
  preferences?: {
    preferLocal?: boolean;
    preferVerified?: boolean;
    maxLatency?: number;
    minReliability?: number;
    costOptimize?: boolean;
  };
}

export interface CapabilityReport {
  timestamp: Date;
  summary: {
    total: number;
    available: number;
    degraded: number;
    unavailable: number;
    byCategory: Record<CapabilityCategory, number>;
  };
  capabilities: Capability[];
  recommendations: CapabilityRecommendation[];
  gaps: CapabilityGap[];
}

export interface CapabilityRecommendation {
  type: 'enable' | 'upgrade' | 'replace' | 'configure' | 'install';
  capability: string;
  reason: string;
  impact: 'high' | 'medium' | 'low';
  effort: 'low' | 'medium' | 'high';
  steps: string[];
}

export interface CapabilityGap {
  needed: string;
  reason: string;
  alternatives: string[];
  blockers: string[];
}