import { beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdirSync, rmSync, writeFileSync } from 'fs';

// Global test setup
export const TEST_VAULT_PATH = join(tmpdir(), 'qeek-test-vault');
export const TEST_AUDIT_PATH = join(tmpdir(), 'qeek-test-audit.jsonl');
export const TEST_SESSION_PATH = join(tmpdir(), 'qeek-test-sessions');

beforeAll(() => {
  // Create test directories
  [TEST_VAULT_PATH, TEST_SESSION_PATH].forEach(dir => {
    try { mkdirSync(dir, { recursive: true }); } catch {}
  });

  // Write test vault files
  writeFileSync(join(TEST_VAULT_PATH, 'welcome.md'), `# Welcome\nTest vault for qeek`);
  writeFileSync(join(TEST_VAULT_PATH, 'preferences.md'), `# Preferences\n- theme: dark\n- language: en`);
  writeFileSync(join(TEST_VAULT_PATH, 'test-note.md'), `# Test Note\nContent for testing\n#tag1 #tag2`);

  // Set test environment
  process.env.NODE_ENV = 'test';
  process.env.ASSISTANT_VAULT_PATH = TEST_VAULT_PATH;
  process.env.MATHCORE_AUDIT = TEST_AUDIT_PATH;
  process.env.ASSISTANT_SESSION_PATH = TEST_SESSION_PATH;
  process.env.TELEMETRY_ENABLED = 'false';
  process.env.ASSISTANT_PROFILE = 'personal-assistant-headless';
});

afterAll(() => {
  // Cleanup test directories
  [TEST_VAULT_PATH, TEST_SESSION_PATH].forEach(dir => {
    try { rmSync(dir, { recursive: true, force: true }); } catch {}
  });
  try { rmSync(TEST_AUDIT_PATH, { force: true }); } catch {}
});

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// Test utilities
export function createMockContext(overrides: Record<string, any> = {}) {
  return {
    register: vi.fn(),
    provide: vi.fn(),
    on: vi.fn(),
    config: {
      capabilityConfig: { autoScan: true },
      mcpServers: {},
      ...overrides.config
    },
    plugins: [],
    ...overrides
  };
}

export function createMockAgent(overrides: Record<string, any> = {}) {
  return {
    inject: vi.fn(),
    id: 'test-agent',
    ctx: createMockContext(),
    ...overrides
  };
}

export function createMockCapability(overrides: Partial<{
  name: string;
  status: 'available' | 'degraded' | 'unavailable';
  category: string;
  priority: string;
}> = {}) {
  return {
    name: 'test.capability',
    displayName: 'Test Capability',
    description: 'A test capability',
    category: 'tools',
    subcategory: 'test',
    version: '1.0.0',
    status: 'available',
    priority: 'high',
    dependencies: [],
    conflicts: [],
    provides: ['test'],
    requires: [],
    metadata: {
      source: 'builtin',
      tags: ['test'],
      maturity: 'stable'
    },
    health: {
      lastCheck: new Date(),
      successRate: 1.0,
      avgLatency: 10,
      errorCount: 0,
      warningCount: 0
    },
    discoveredAt: new Date(),
    lastVerified: new Date(),
    ...overrides
  };
}

export async function waitFor(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function mockMathcoreResponse(result: any) {
  return {
    jsonrpc: '2.0',
    result,
    id: Date.now()
  };
}

export function mockMCPError(message: string, code = -32603) {
  return {
    jsonrpc: '2.0',
    error: { code, message },
    id: Date.now()
  };
}