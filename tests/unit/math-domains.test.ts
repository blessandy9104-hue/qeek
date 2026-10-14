import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  routeDomain,
  DOMAIN_OPERATIONS,
  domainMemoryTag,
  buildCommand,
  invocationHead,
  memorizeVerified,
  recallSimilar,
  resetMathStatsForTests,
} from '../../packages/math-intelligence/src/index';
import { zoveliMathAlgebra, zoveliMathCalculus, zoveliMathStatistics, zoveliMathLogic, zoveliMathUnits, zoveliMathDiscrete } from '../../packages/math-domains/src/index';
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
    expect(routeDomain({ operation: 'stat', request: '' })).toBe('statistics');
    expect(routeDomain({ operation: 'sat', request: '' })).toBe('logic');
    expect(routeDomain({ operation: 'prove', request: '' })).toBe('logic');
    expect(routeDomain({ operation: 'convert', request: '' })).toBe('units');
    expect(routeDomain({ operation: 'shortest_path', request: '' })).toBe('discrete');
    expect(routeDomain({ operation: 'frobnicate', request: '' })).toBe('general');
  });

  it('routes keyword requests without an operation', () => {
    expect(routeDomain({ request: 'derivative of x^2' })).toBe('calculus');
    expect(routeDomain({ request: 'integrate sin(x) dx' })).toBe('calculus');
    expect(routeDomain({ request: 'solve x^2 - 5x + 6 = 0' })).toBe('algebra');
    expect(routeDomain({ request: '2+2' })).toBe('algebra');
    expect(routeDomain({ request: 'mean and standard deviation of the sample' })).toBe('statistics');
    expect(routeDomain({ request: 'is this formula satisfiable' })).toBe('logic');
    expect(routeDomain({ request: 'prove this tautology' })).toBe('logic');
    expect(routeDomain({ request: 'convert 72 F to C' })).toBe('units');
    expect(routeDomain({ request: 'how many kilograms in a pound' })).toBe('units');
    expect(routeDomain({ request: 'shortest path from A to C in A-B:3, B-C:4' })).toBe('discrete');
    expect(routeDomain({ request: 'hello, how are you' })).toBe('general');
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
    // All 27 mathcore ops are owned now; general takes only the unknown.
    expect(Object.values(DOMAIN_OPERATIONS).flat().length).toBe(27);
  });

  it('builds parser-compatible commands (surface heads, not op ids)', () => {
    expect(buildCommand('solve', 'x^2-1')).toBe('solve x^2-1');
    expect(buildCommand(undefined, '2+2')).toBe('2+2');
    expect(buildCommand('shortest_path', 'from A to C in A-B:3')).toBe('shortest path from A to C in A-B:3');
    expect(buildCommand('is_prime', '17 prime')).toBe('is 17 prime');
    expect(buildCommand('factor_int', '100')).toBe('factor 100');
    expect(buildCommand('linsolve', 'x+y=3')).toBe('solve linear system x+y=3');
    expect(buildCommand('matmul', 'A B')).toBe('multiply A B');
    expect(buildCommand('stat', 'mean of 1,2,3')).toBe('mean of 1,2,3');
    expect(invocationHead('convert')).toBe('convert');
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
    const ctxS = createMockContext();
    zoveliMathStatistics.setup(ctxS);
    const ctxL = createMockContext();
    zoveliMathLogic.setup(ctxL);
    const ctxU = createMockContext();
    zoveliMathUnits.setup(ctxU);
    const ctxD = createMockContext();
    zoveliMathDiscrete.setup(ctxD);

    const toolsA = ctxA.register.mock.calls.find((c) => c[0] === 'math-algebra-tools')?.[1] as any[];
    const toolsC = ctxC.register.mock.calls.find((c) => c[0] === 'math-calculus-tools')?.[1] as any[];
    const toolsS = ctxS.register.mock.calls.find((c) => c[0] === 'math-statistics-tools')?.[1] as any[];
    const toolsL = ctxL.register.mock.calls.find((c) => c[0] === 'math-logic-tools')?.[1] as any[];
    const toolsU = ctxU.register.mock.calls.find((c) => c[0] === 'math-units-tools')?.[1] as any[];
    const toolsD = ctxD.register.mock.calls.find((c) => c[0] === 'math-discrete-tools')?.[1] as any[];
    expect(toolsA.some((t) => t.name === 'math_algebra_solve')).toBe(true);
    expect(toolsC.some((t) => t.name === 'math_calculus_solve')).toBe(true);
    expect(toolsS.some((t) => t.name === 'math_stats_solve')).toBe(true);
    expect(toolsL.some((t) => t.name === 'math_logic_solve')).toBe(true);
    expect(toolsU.some((t) => t.name === 'math_units_solve')).toBe(true);
    expect(toolsD.some((t) => t.name === 'math_discrete_solve')).toBe(true);

    expect(ctxU.register.mock.calls.some((c) => c[0] === 'math-domain-units')).toBe(true);
    expect(ctxD.register.mock.calls.some((c) => c[0] === 'math-domain-discrete')).toBe(true);

    const capsU = (zoveliMathUnits as any).capabilities as any[];
    expect(capsU[0].name).toBe('math.units');
    expect(capsU[0].provides).toContain('convert');
    const capsD = (zoveliMathDiscrete as any).capabilities as any[];
    expect(capsD[0].name).toBe('math.discrete');
    expect(capsD[0].provides).toContain('shortest_path');

    expect(ctxS.register.mock.calls.some((c) => c[0] === 'math-domain-statistics')).toBe(true);
    expect(ctxL.register.mock.calls.some((c) => c[0] === 'math-domain-logic')).toBe(true);

    const capsS = (zoveliMathStatistics as any).capabilities as any[];
    expect(capsS[0].name).toBe('math.statistics');
    expect(capsS[0].provides).toContain('stat');
    const capsL = (zoveliMathLogic as any).capabilities as any[];
    expect(capsL[0].name).toBe('math.logic');
    expect(capsL[0].provides).toEqual(expect.arrayContaining(['sat', 'prove']));
  });

  it('specialist solve rejects out-of-domain operations without spawning', async () => {
    const ctx = createMockContext();
    zoveliMathAlgebra.setup(ctx);
    const tools = ctx.register.mock.calls.find((c) => c[0] === 'math-algebra-tools')?.[1] as any[];
    const solve = tools.find((t) => t.name === 'math_algebra_solve');
    await expect(solve.execute({ request: 'x', operation: 'integrate' })).rejects.toThrow(/not a algebra operation/);
  });
});
