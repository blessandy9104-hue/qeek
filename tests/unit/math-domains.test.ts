import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  routeDomain,
  DOMAIN_OPERATIONS,
  domainMemoryTag,
  memorizeVerified,
  recallSimilar,
  resetMathStatsForTests,
} from '../../packages/math-intelligence/src/index';
import { zoveliMathAlgebra, zoveliMathCalculus } from '../../packages/math-domains/src/index';
import { resetStoreForTests } from '../../packages/memory-store/src/store';
import { createMockContext } from '../setup';

describe('governed math domains', () => {
  beforeEach(() => {
    process.env.ZOVELI_MEMORY_DB = ':memory:';
    process.env.ZOVELI_MEMORY_EXPORT = '0';
    process.env.ZOVELI_MATH_MEMORIZE = '1';
    resetStoreForTests();
    resetMathStatsForTests();
  });

  afterEach(() => {
    resetStoreForTests();
    resetMathStatsForTests();
    delete process.env.ZOVELI_MEMORY_DB;
    delete process.env.ZOVELI_MEMORY_EXPORT;
    delete process.env.ZOVELI_MATH_MEMORIZE;
  });

  it('routes explicit operations to the owning specialist', () => {
    expect(routeDomain({ operation: 'solve', request: '' })).toBe('algebra');
    expect(routeDomain({ operation: 'eigenvalues', request: '' })).toBe('algebra');
    expect(routeDomain({ operation: 'derivative', request: '' })).toBe('calculus');
    expect(routeDomain({ operation: 'integrate', request: '' })).toBe('calculus');
    expect(routeDomain({ operation: 'sat', request: '' })).toBe('general');
    expect(routeDomain({ operation: 'prove', request: '' })).toBe('general');
  });

  it('routes keyword requests without an operation', () => {
    expect(routeDomain({ request: 'derivative of x^2' })).toBe('calculus');
    expect(routeDomain({ request: 'integrate sin(x) dx' })).toBe('calculus');
    expect(routeDomain({ request: 'solve x^2 - 5x + 6 = 0' })).toBe('algebra');
    expect(routeDomain({ request: '2+2' })).toBe('algebra');
    expect(routeDomain({ request: 'prove this tautology' })).toBe('general');
  });

  it('every routed operation is owned by exactly one specialist', () => {
    const seen = new Map<string, string>();
    for (const [domain, ops] of Object.entries(DOMAIN_OPERATIONS)) {
      for (const op of ops) {
        expect(seen.has(op)).toBe(false);
        seen.set(op, domain);
        expect(routeDomain({ operation: op, request: '' })).toBe(domain);
      }
    }
  });

  it('namespaces proof memory per domain with shared base tag', async () => {
    const a = await memorizeVerified('solve x^2 = 4', 'VERIFIED: x = 2, x = -2', 'algebra');
    const c = await memorizeVerified('integrate x dx', 'VERIFIED: x^2/2', 'calculus');
    expect(a).toContain('math/algebra/');
    expect(c).toContain('math/calculus/');
    // Domain-filtered recall isolates; unfiltered recall finds both.
    const onlyAlgebra = await recallSimilar('solve quadratic roots', 10, 'algebra');
    expect(onlyAlgebra.every((r) => r.title.startsWith('math/algebra/'))).toBe(true);
    const all = await recallSimilar('x', 10, 'general');
    expect(all.length).toBeGreaterThanOrEqual(2);
    expect(domainMemoryTag('algebra')).toBe('math/algebra');
  });

  it('specialists register distinct tools, configs, hints, capabilities', () => {
    const ctxA = createMockContext();
    zoveliMathAlgebra.setup(ctxA);
    const ctxC = createMockContext();
    zoveliMathCalculus.setup(ctxC);

    const toolsA = ctxA.register.mock.calls.find((c) => c[0] === 'math-algebra-tools')?.[1] as any[];
    const toolsC = ctxC.register.mock.calls.find((c) => c[0] === 'math-calculus-tools')?.[1] as any[];
    expect(toolsA.some((t) => t.name === 'math_algebra_solve')).toBe(true);
    expect(toolsC.some((t) => t.name === 'math_calculus_solve')).toBe(true);

    expect(ctxA.register.mock.calls.some((c) => c[0] === 'math-domain-algebra')).toBe(true);
    expect(ctxC.register.mock.calls.some((c) => c[0] === 'math-domain-calculus')).toBe(true);

    const capsA = (zoveliMathAlgebra as any).capabilities as any[];
    expect(capsA[0].name).toBe('math.algebra');
    expect(capsA[0].metadata.governor).toBe('zoveli-math-intelligence');
  });

  it('specialist solve rejects out-of-domain operations without spawning', async () => {
    const ctx = createMockContext();
    zoveliMathAlgebra.setup(ctx);
    const tools = ctx.register.mock.calls.find((c) => c[0] === 'math-algebra-tools')?.[1] as any[];
    const solve = tools.find((t) => t.name === 'math_algebra_solve');
    await expect(solve.execute({ request: 'x', operation: 'integrate' })).rejects.toThrow(/not a algebra operation/);
  });
});
