import { definePlugin } from '@deepseek-ai/dsh-core';
import {
  DOMAIN_OPERATIONS,
  domainMemoryTag,
  buildCommand,
  mathcore,
  memorizeVerified,
  recallSimilar,
  type MathDomain,
} from '@zoveli/math-intelligence';

export type SpecialistDomain = Exclude<MathDomain, 'general'>;

interface SpecialistConfig {
  tool: string;
  defaultOp: string;
  hint: string;
}

const SPECIALISTS: Record<SpecialistDomain, SpecialistConfig> = {
  algebra: {
    tool: 'math_algebra_solve',
    defaultOp: 'solve',
    hint: 'ALGEBRA SPECIALIST: you own evaluate/simplify/expand/factor/solve (linear/number moved to linear/number specialists). CALL math_algebra_solve; STATE ONLY VERIFIED values.',
  },
  calculus: {
    tool: 'math_calculus_solve',
    defaultOp: 'integrate',
    hint: 'CALCULUS SPECIALIST: you own derivative/integrate/limit/dsolve. CALL math_calculus_solve; STATE ONLY VERIFIED values.',
  },
  statistics: {
    tool: 'math_stats_solve',
    defaultOp: 'stat',
    hint: 'STATISTICS SPECIALIST: you own the stat operation (descriptive stats over data). CALL math_stats_solve; STATE ONLY VERIFIED values.',
  },
  logic: {
    tool: 'math_logic_solve',
    defaultOp: 'sat',
    hint: 'LOGIC SPECIALIST: you own sat/prove (satisfiability and logical proof). CALL math_logic_solve; STATE ONLY VERIFIED values.',
  },
  units: {
    tool: 'math_units_solve',
    defaultOp: 'convert',
    hint: 'UNITS SPECIALIST: you own convert (unit conversion across length, mass, time, volume, energy, temperature). CALL math_units_solve; STATE ONLY VERIFIED values.',
  },
  discrete: {
    tool: 'math_discrete_solve',
    defaultOp: 'shortest_path',
    hint: 'DISCRETE SPECIALIST: you own shortest_path (cheapest path in weighted graphs). CALL math_discrete_solve; STATE ONLY VERIFIED values.',
  },
  arithmetic: {
    tool: 'math_arithmetic_solve',
    defaultOp: 'percent',
    hint: 'ARITHMETIC SPECIALIST: you own percent/ratio. CALL math_arithmetic_solve; STATE ONLY VERIFIED values.',
  },
  geometry: {
    tool: 'math_geometry_solve',
    defaultOp: 'area',
    hint: 'GEOMETRY SPECIALIST: you own area/volume/pythagoras. CALL math_geometry_solve; STATE ONLY VERIFIED values.',
  },
  trigonometry: {
    tool: 'math_trigonometry_solve',
    defaultOp: 'trig',
    hint: 'TRIGONOMETRY SPECIALIST: you own trig. CALL math_trigonometry_solve; STATE ONLY VERIFIED values.',
  },
  probability: {
    tool: 'math_probability_solve',
    defaultOp: 'probability',
    hint: 'PROBABILITY SPECIALIST: you own probability. CALL math_probability_solve; STATE ONLY VERIFIED values.',
  },
  linear: {
    tool: 'math_linear_solve',
    defaultOp: 'linsolve',
    hint: 'LINEAR SPECIALIST: you own determinant/rank/inverse/linsolve/matmul/eigenvalues. CALL math_linear_solve; STATE ONLY VERIFIED values.',
  },
  number: {
    tool: 'math_number_solve',
    defaultOp: 'is_prime',
    hint: 'NUMBER SPECIALIST: you own is_prime/factor_int/gcd/lcm/modpow/factorial/choose. CALL math_number_solve; STATE ONLY VERIFIED values.',
  },
};

/**
 * Specialist plugin factory. Specialists never spawn mathcore themselves —
 * they call the governor's shared transport and memorize into their own
 * memory namespace (`math/<domain>/…`). The governor enforces
 * verified-or-withheld globally and routes via `math_route`.
 */
function defineDomainSpecialist(domain: SpecialistDomain) {
  const operations = DOMAIN_OPERATIONS[domain];
  const { tool: solveTool, defaultOp, hint } = SPECIALISTS[domain];
  const plugin = definePlugin({
    name: `zoveli-math-${domain}`,
    description: `${domain} specialist under the math-intelligence governor (ops: ${operations.join(', ')})`,
    setup(ctx) {
      ctx.register(`math-domain-${domain}`, {
        domain,
        operations,
        memoryTag: domainMemoryTag(domain),
        governor: '@zoveli/math-intelligence',
      });
      ctx.provide(`math-domain-${domain}`, {
        domain,
        operations,
        async solve(request: string, operation?: string) {
          const op = operation || defaultOp;
          const cmd = buildCommand(op, request);
          const out = await mathcore.compute(cmd);
          try {
            await memorizeVerified(cmd, out, domain);
          } catch {
            // memorization never breaks solving
          }
          return out;
        },
        async recall(query: string, limit = 5) {
          return recallSimilar(query, limit, domain);
        },
      });
      ctx.register(`math-${domain}-tools`, [
        {
          name: solveTool,
          description: `Verified ${domain} computation via the governed mathcore transport (auto-memorized to ${domain} memory)`,
          parameters: {
            type: 'object',
            properties: {
              request: { type: 'string', description: `${domain} problem excluding the operation head ("x^2-1" for solve; full phrase for stat, e.g. "mean of 1,2,3")` },
              operation: {
                type: 'string',
                description: `Operation (must be one of: ${operations.join(', ')})`,
                enum: operations,
              },
            },
            required: ['request'],
          },
          async execute({ request, operation }: { request: string; operation?: string }) {
            const op = operation || defaultOp;
            if (!operations.includes(op)) {
              throw new Error(`${op} is not a ${domain} operation (governor: math_route to classify)`);
            }
            const cmd = buildCommand(op, request);
            const out = await mathcore.compute(cmd);
            try {
              await memorizeVerified(cmd, out, domain);
            } catch {
              // ignore
            }
            return out;
          },
        },
      ]);
      ctx.on('agent/created', (agent) => {
        agent.inject({ type: 'system', content: hint });
      });
    },
  });
  // Capability declaration for Cordis-class hosts: the local ZoveliHost
  // reads registrations/tools, but a full host discovers this entry.
  (plugin as Record<string, unknown>).capabilities = [
    {
      name: `math.${domain}`,
      displayName: `${domain[0].toUpperCase()}${domain.slice(1)} Specialist`,
      description: `Governed verified ${domain} computation (memorized to ${domainMemoryTag(domain)})`,
      category: 'computation',
      subcategory: `verified-math/${domain}`,
      version: '1.0.0',
      status: 'available',
      priority: 'high',
      dependencies: ['mathcore-mcp'],
      conflicts: [],
      provides: operations,
      requires: [
        { type: 'capability', name: 'mathcore.verified-compute', optional: false, description: 'Governor transport' },
      ],
      metadata: {
        source: 'plugin',
        pluginId: `zoveli-math-${domain}`,
        governor: 'zoveli-math-intelligence',
        tags: ['verified', 'offline', 'specialist', domain],
        maturity: 'beta',
      },
    },
  ];
  return plugin;
}

export const zoveliMathAlgebra = defineDomainSpecialist('algebra');
export const zoveliMathCalculus = defineDomainSpecialist('calculus');
export const zoveliMathStatistics = defineDomainSpecialist('statistics');
export const zoveliMathLogic = defineDomainSpecialist('logic');
export const zoveliMathUnits = defineDomainSpecialist('units');
export const zoveliMathDiscrete = defineDomainSpecialist('discrete');
export const zoveliMathArithmetic = defineDomainSpecialist('arithmetic');
export const zoveliMathGeometry = defineDomainSpecialist('geometry');
export const zoveliMathTrigonometry = defineDomainSpecialist('trigonometry');
export const zoveliMathProbability = defineDomainSpecialist('probability');
export const zoveliMathLinear = defineDomainSpecialist('linear');
export const zoveliMathNumber = defineDomainSpecialist('number');

export default zoveliMathAlgebra;
