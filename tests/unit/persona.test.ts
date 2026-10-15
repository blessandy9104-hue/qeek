import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  PERSONAS,
  DEFAULT_PERSONA,
  PERSONA_BASE,
  resolvePersona,
  zoveliPersona,
} from '../../packages/persona/src/index';
import { ZoveliHost } from '../../packages/host/src/host';
import { chat } from '../../packages/host/src/chat';
import { createMockContext } from '../setup';

const ENV_KEYS = ['ZOVELI_PERSONA', 'ZOVELI_MEMORY_DB', 'ZOVELI_VAULT_PATH', 'ZOVELI_MEMORY_EXPORT', 'ZOVELI_MEMORY_BRIEF'];
let savedEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  savedEnv = {};
  for (const k of ENV_KEYS) savedEnv[k] = process.env[k];
  delete process.env.ZOVELI_PERSONA;
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
});

describe('persona catalog (trusted, personal, for everyone)', () => {
  it('ships friend (default), tutor, engineer, coach', () => {
    expect(Object.keys(PERSONAS).sort()).toEqual(['coach', 'engineer', 'friend', 'tutor']);
    expect(DEFAULT_PERSONA).toBe('friend');
  });

  it('every persona carries the trust charter', () => {
    for (const p of Object.values(PERSONAS)) {
      expect(p.prompt).toContain(PERSONA_BASE);
      expect(p.prompt).toContain('privacy is absolute');
      expect(p.prompt).toContain('equally');
    }
  });

  it('persona prompts never use technical terms', () => {
    for (const p of Object.values(PERSONAS)) {
      for (const term of ['MCP', 'quorum', 'SQLite', 'FTS5', 'subagent', 'embeddings', 'Ollama', 'inference']) {
        expect(p.prompt, `${p.id} leaks ${term}`).not.toContain(term);
      }
    }
  });
});

describe('resolvePersona (explicit wins, then inference, then friend)', () => {
  it('infers from the message', () => {
    expect(resolvePersona('help me with my homework').id).toBe('tutor');
    expect(resolvePersona('explain simply please').id).toBe('tutor');
    expect(resolvePersona('debug this code with me').id).toBe('engineer');
    expect(resolvePersona('my goal is to run daily').id).toBe('coach');
    expect(resolvePersona('hello there').id).toBe('friend');
  });

  it('explicit preference beats inference', () => {
    expect(resolvePersona('debug this code', 'coach').id).toBe('coach');
  });

  it('ZOVELI_PERSONA env wins over everything', () => {
    process.env.ZOVELI_PERSONA = 'engineer';
    expect(resolvePersona('help with homework').id).toBe('engineer');
    process.env.ZOVELI_PERSONA = 'nonsense';
    expect(resolvePersona('hello').id).toBe('friend');
  });
});

describe('persona plugin (switch + persist)', () => {
  it('registers switch/current tools and a persona service', () => {
    const ctx = createMockContext();
    zoveliPersona.setup(ctx);
    const tools = ctx.register.mock.calls.find((c) => c[0] === 'persona-tools')?.[1] as any[];
    expect(tools.map((t) => t.name).sort()).toEqual(['persona_current', 'persona_switch']);
    expect(ctx.provide).toHaveBeenCalledWith('persona', expect.any(Object));
  });

  it('switch persists to memory and current reads it back', async () => {
    const dist = await import('../../packages/memory-store/dist/index.js');
    process.env.ZOVELI_MEMORY_DB = ':memory:';
    process.env.ZOVELI_MEMORY_EXPORT = '0';
    dist.resetStoreForTests();

    const ctx = createMockContext();
    zoveliPersona.setup(ctx);
    const tools = ctx.register.mock.calls.find((c) => c[0] === 'persona-tools')?.[1] as any[];
    const sw = tools.find((t) => t.name === 'persona_switch');
    const cur = tools.find((t) => t.name === 'persona_current');
    await expect(sw.execute({ persona: 'tutor' })).resolves.toEqual({ success: true, persona: 'tutor' });
    await expect(cur.execute({})).resolves.toMatchObject({ current: 'tutor' });
    await expect(sw.execute({ persona: 'nope' })).rejects.toThrow('unknown persona');
    dist.resetStoreForTests();
  });
});

describe('chat() persona alignment', () => {
  it('injects the inferred persona for a student message', async () => {
    process.env.ZOVELI_MEMORY_BRIEF = '0';
    let seenBody: any = null;
    const origFetch = globalThis.fetch;
    (globalThis as any).fetch = async (_url: string, init: any) => {
      seenBody = JSON.parse(init.body);
      return new Response(
        JSON.stringify({ choices: [{ message: { role: 'assistant', content: 'sure thing' } }] }),
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
        'help me with my homework please',
        () => {}
      );
      expect(seenBody.messages[0].content).toContain('patient teacher');
    } finally {
      globalThis.fetch = origFetch;
    }
  });
});
