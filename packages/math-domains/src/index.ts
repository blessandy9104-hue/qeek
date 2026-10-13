import { definePlugin } from '@deepseek-ai/dsh-core';
import {
  DOMAIN_OPERATIONS,
  domainMemoryTag,
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
    hint: 'ALGEBRA SPECIALIST: you own evaluate/simplify/expand/factor/solve and linear-algebra/number-theory ops. CALL math_algebra_solve; STATE ONLY VERIFIED values.',
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
          const out = await mathcore.compute(`${op} ${request}`);
          try {
            await memorizeVerified(`${op} ${request}`, out, domain);
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
              request: { type: 'string', description: `${domain} problem to solve` },
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
            const out = await mathcore.compute(`${op} ${request}`);
            try {
              await memorizeVerified(`${op} ${request}`, out, domain);
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

export default zoveliMathAlgebra;
