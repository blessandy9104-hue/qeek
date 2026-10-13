import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  cosine,
  keywordScore,
  recallSemantic,
} from '../../packages/math-intelligence/src/semantic';
import { memorizeVerified, resetMathStatsForTests } from '../../packages/math-intelligence/src/index';
import { resetStoreForTests } from '../../packages/memory-store/src/store';

describe('semantic recall over proof memory', () => {
  beforeEach(() => {
    process.env.ZOVELI_MEMORY_DB = ':memory:';
    process.env.ZOVELI_MEMORY_EXPORT = '0';
    process.env.ZOVELI_MATH_MEMORIZE = '1';
    delete process.env.ZOVELI_EMBED_MODEL;
    delete process.env.ZOVELI_OLLAMA_URL;
    resetStoreForTests();
    resetMathStatsForTests();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    resetStoreForTests();
    resetMathStatsForTests();
    vi.unstubAllGlobals();
    delete process.env.ZOVELI_MEMORY_DB;
    delete process.env.ZOVELI_MEMORY_EXPORT;
    delete process.env.ZOVELI_MATH_MEMORIZE;
  });

  it('cosine is 1 for identical vectors, 0 for orthogonal/degenerate', () => {
    expect(cosine([1, 0], [1, 0])).toBeCloseTo(1);
    expect(cosine([1, 0], [0, 1])).toBeCloseTo(0);
    expect(cosine([], [])).toBe(0);
    expect(cosine([0, 0], [1, 1])).toBe(0);
  });

  it('keywordScore ranks title overlap above body-only overlap', () => {
    const titleHit = keywordScore('quadratic roots', 'quadratic formula', 'unrelated body text here');
    const bodyHit = keywordScore('quadratic roots', 'other note', 'quadratic roots appear in this body');
    expect(titleHit).toBeGreaterThan(bodyHit);
    expect(keywordScore('', 'anything', 'body')).toBe(0);
  });

  it('degrades to keyword mode when no embedder is reachable', async () => {
    process.env.ZOVELI_OLLAMA_URL = 'http://127.0.0.1:9';
    await memorizeVerified('solve quadratic equation', 'VERIFIED: x = 2', 'algebra');
    const out = await recallSemantic('quadratic solutions', { domain: 'algebra', limit: 5 });
    expect(out.mode).toBe('keyword');
    expect(out.model).toBeNull();
    expect(out.results.length).toBeGreaterThanOrEqual(1);
    expect(out.results[0].title).toContain('math/algebra/');
  });

  it('uses vector mode and cosine ranking when an embedder answers', async () => {
    await memorizeVerified('solve quadratic equation roots', 'VERIFIED: x = 2', 'algebra');
    await memorizeVerified('integrate sine wave area', 'VERIFIED: -cos(x)', 'calculus');
    // Stub fetch: query embedding [1,0]; quadratic note [1,0]; calculus [0,1].
    let calls = 0;
    vi.stubGlobal('fetch', async () => {
      calls++;
      const vec = calls === 1 ? [1, 0] : calls === 2 ? [1, 0] : [0, 1];
      return { ok: true, json: async () => ({ embedding: vec }) };
    });
    const out = await recallSemantic('quadratic roots zeros', { limit: 5 });
    expect(out.mode).toBe('vector');
    expect(out.model).toBe('nomic-embed-text');
    expect(out.results[0].title).toContain('quadratic');
    expect(out.results[0].score).toBeCloseTo(1);
  });

  it('returns empty results (never throws) when memory is empty', async () => {
    process.env.ZOVELI_OLLAMA_URL = 'http://127.0.0.1:9';
    const out = await recallSemantic('anything at all');
    expect(out.results).toEqual([]);
  });
});
