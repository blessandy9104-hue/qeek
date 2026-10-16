import { beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';

// Global test setup.
// NOTE: temp dirs are unique per test file run (mkdtempSync in beforeAll).
// The old fixed names (zoveli-test-vault, ...) raced on CI: parallel
// workers share tmpdir(), so one worker's afterAll rm -rf deleted the dir
// while another worker's beforeAll was writing (ENOENT on Windows).
// Unique base dirs eliminate the race on all platforms.
export let TEST_VAULT_PATH = join(tmpdir(), `zoveli-test-vault-${process.pid}`);
export let TEST_AUDIT_PATH = join(tmpdir(), `zoveli-test-audit-${process.pid}.jsonl`);
export let TEST_SESSION_PATH = join(tmpdir(), `zoveli-test-sessions-${process.pid}`);

beforeAll(() => {
  // Unique base per file run; no cross-worker collisions.
  const base = mkdtempSync(join(tmpdir(), 'zoveli-test-'));
  TEST_VAULT_PATH = join(base, 'vault');
  TEST_SESSION_PATH = join(base, 'sessions');
  TEST_AUDIT_PATH = join(base, 'audit.jsonl');

  // Create test directories (throw on failure — never swallow mkdir errors)
  mkdirSync(TEST_VAULT_PATH, { recursive: true });
  mkdirSync(TEST_SESSION_PATH, { recursive: true });

  // Write test vault files
  writeFileSync(join(TEST_VAULT_PATH, 'welcome.md'), `# Welcome\nTest vault for Zoveli`);
  writeFileSync(join(TEST_VAULT_PATH, 'preferences.md'), `# Preferences\n- theme: dark\n- language: en`);
  writeFileSync(join(TEST_VAULT_PATH, 'test-note.md'), `# Test Note\nContent for testing\n#tag1 #tag2`);

  // Set test environment (isolated from the real vault/sessions)
  process.env.NODE_ENV = 'test';
  process.env.ZOVELI_VAULT_PATH = TEST_VAULT_PATH;
  process.env.MATHCORE_AUDIT = TEST_AUDIT_PATH;
  process.env.ZOVELI_SESSION_PATH = TEST_SESSION_PATH;
  process.env.TELEMETRY_ENABLED = 'false';
  process.env.ZOVELI_PROFILE = 'zoveli-headless';
});

afterAll(() => {
  // Cleanup the unique base dir for this file run (vault + sessions + audit)
  try { rmSync(dirname(TEST_VAULT_PATH), { recursive: true, force: true }); } catch {}
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
