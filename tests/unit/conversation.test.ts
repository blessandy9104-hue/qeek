import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdirSync, rmSync } from 'node:fs';
import { zoveliPrompt, promptSectionsText } from '../../packages/core/src/system-prompt';
import { ZoveliHost } from '../../packages/host/src/host';
import {
  chat,
  chatTemperature,
  buildMemoryBrief,
  isLocalProvider,
  memoryBriefAllowed,
} from '../../packages/host/src/chat';
import { resetStoreForTests, MemoryStore } from '../../packages/memory-store/src/store';

const ENV_KEYS = ['ZOVELI_TEMPERATURE', 'ZOVELI_MEMORY_BRIEF', 'ZOVELI_MEMORY_DB', 'ZOVELI_VAULT_PATH', 'ZOVELI_MEMORY_EXPORT'];
let savedEnv: Record<string, string | undefined> = {};
let emptyVault = '';

beforeEach(() => {
  savedEnv = {};
  for (const k of ENV_KEYS) savedEnv[k] = process.env[k];
  // Empty vault dir: no legacy .md import, so each test owns its memory.
  emptyVault = join(tmpdir(), `zoveli-conv-${process.pid}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`);
  mkdirSync(emptyVault, { recursive: true });
  process.env.ZOVELI_VAULT_PATH = emptyVault;
  resetStoreForTests();
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
  resetStoreForTests();
  try { rmSync(emptyVault, { recursive: true, force: true }); } catch { /* ignore */ }
});

describe('conversation persona', () => {
  it('has a conversation section with a natural voice', () => {
    const sec = zoveliPrompt.sections.find((s: any) => s.id === 'conversation');
    expect(sec).toBeDefined();
    expect(sec.content).toContain('short by default');
  });

  it('prompt rollup includes persona/security but never duplicates MATH RULES', () => {
    const text = promptSectionsText();
    expect(text).toContain('Conversation Style');
    expect(text).toContain('Who You Help');
    expect(text).toContain('Security Rules');
    expect(text).not.toContain('MATH RULES:');
  });

  it('self-description speaks problems solved, never jargon', () => {
    const sec = zoveliPrompt.sections.find((s: any) => s.id === 'who-it-helps');
    expect(sec).toBeDefined();
    expect(sec.content).toContain('student');
    expect(sec.content).toContain('engineer');
    expect(sec.content).toContain('homework');
    // The spoken example (what users actually hear) must be jargon-free;
    // the guidance list naming banned terms is instructions, not speech.
    const example = sec.content.slice(sec.content.indexOf('Example:'));
    expect(example.length).toBeGreaterThan(20);
    for (const term of ['MCP', 'quorum', 'SQLite', 'FTS5', 'subagent', 'embeddings', 'Ollama']) {
      expect(example, `example leaks ${term}`).not.toContain(term);
    }
  });
});

describe('chatTemperature', () => {  it('defaults to 0.7 and clamps 0..2', () => {
    delete process.env.ZOVELI_TEMPERATURE;
    expect(chatTemperature()).toBe(0.7);
    process.env.ZOVELI_TEMPERATURE = '0.2';
    expect(chatTemperature()).toBe(0.2);
    process.env.ZOVELI_TEMPERATURE = 'nonsense';
    expect(chatTemperature()).toBe(0.7);
    process.env.ZOVELI_TEMPERATURE = '5';
    expect(chatTemperature()).toBe(2);
    process.env.ZOVELI_TEMPERATURE = '-1';
    expect(chatTemperature()).toBe(0);
  });
});

describe('buildMemoryBrief', () => {
  it('is empty when disabled or when no store exists yet', async () => {
    process.env.ZOVELI_MEMORY_BRIEF = '0';
    expect(await buildMemoryBrief()).toBe('');
    delete process.env.ZOVELI_MEMORY_BRIEF;
    process.env.ZOVELI_MEMORY_DB = 'C:\\no-such-dir-xyz\\memory.db';
    expect(await buildMemoryBrief()).toBe('');
  });

  it('recalls user notes without announcing itself', async () => {
    const store = new MemoryStore(':memory:', emptyVault);
    store.createNote({ title: 'User likes tea', content: 'prefers green tea in the morning', tags: ['preference'] });
    const brief = await buildMemoryBrief(store);
    expect(brief).toContain('User likes tea');
    expect(brief).toContain('use naturally');
    store.close();
  });
});

describe('chat() natural-turn wiring', () => {
  it('forwards temperature and appends the memory brief to system', async () => {
    process.env.ZOVELI_TEMPERATURE = '0.9';
    // Seed the same singleton instance chat() resolves internally
    // (bare specifier → dist build): behavior parity, not module identity.
    const dist = await import('../../packages/memory-store/dist/index.js');
    process.env.ZOVELI_MEMORY_DB = ':memory:';
    process.env.ZOVELI_MEMORY_EXPORT = '0';
    dist.resetStoreForTests();
    dist.getStore().createNote({ title: 'User likes tea', content: 'prefers green tea', tags: ['preference'] });

    let seenBody: any = null;
    const origFetch = globalThis.fetch;
    (globalThis as any).fetch = async (_url: string, init: any) => {
      seenBody = JSON.parse(init.body);
      return new Response(
        JSON.stringify({ choices: [{ message: { role: 'assistant', content: 'hello there' } }] }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    };
    try {
      const host = new ZoveliHost();
      host.mount([]);
      await chat(
        host,
        { apiKey: 'ollama', baseUrl: 'http://127.0.0.1:1/v1', model: 'qwen3:4b' },
        'be kind',
        [],
        'say hi',
        () => {}
      );
      expect(seenBody.temperature).toBe(0.9);
      expect(seenBody.messages[0].role).toBe('system');
      expect(seenBody.messages[0].content).toContain('be kind');
      expect(seenBody.messages[0].content).toContain('User likes tea');
    } finally {
      globalThis.fetch = origFetch;
    }
  });
});

describe('memory-brief privacy gate (local only by default)', () => {
  it('treats loopback providers as local, cloud as remote', () => {
    expect(isLocalProvider({ provider: 'ollama', baseUrl: 'http://localhost:11434/v1' })).toBe(true);
    expect(isLocalProvider({ provider: 'custom', baseUrl: 'http://127.0.0.1:8080/v1' })).toBe(true);
    expect(isLocalProvider({ provider: 'openai', baseUrl: 'https://api.openai.com/v1' })).toBe(false);
  });

  it('allows briefs locally, gates cloud behind explicit opt-in', () => {
    const prev = process.env.ZOVELI_MEMORY_TO_CLOUD;
    const prevBrief = process.env.ZOVELI_MEMORY_BRIEF;
    try {
      delete process.env.ZOVELI_MEMORY_TO_CLOUD;
      delete process.env.ZOVELI_MEMORY_BRIEF;
      const cloud = { provider: 'openai', baseUrl: 'https://api.openai.com/v1' };
      const local = { provider: 'ollama', baseUrl: 'http://localhost:11434/v1' };
      expect(memoryBriefAllowed(local)).toBe(true);
      expect(memoryBriefAllowed(cloud)).toBe(false);
      process.env.ZOVELI_MEMORY_TO_CLOUD = '1';
      expect(memoryBriefAllowed(cloud)).toBe(true);
      process.env.ZOVELI_MEMORY_BRIEF = '0';
      expect(memoryBriefAllowed(local)).toBe(false);
    } finally {
      if (prev === undefined) delete process.env.ZOVELI_MEMORY_TO_CLOUD;
      else process.env.ZOVELI_MEMORY_TO_CLOUD = prev;
      if (prevBrief === undefined) delete process.env.ZOVELI_MEMORY_BRIEF;
      else process.env.ZOVELI_MEMORY_BRIEF = prevBrief;
    }
  });
});
