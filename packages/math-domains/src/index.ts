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

const DOMAIN_HINTS: Record<SpecialistDomain, string> = {
  algebra:
    'ALGEBRA SPECIALIST: you own evaluate/simplify/expand/factor/solve and linear-algebra/number-theory ops. CALL math_algebra_solve; STATE ONLY VERIFIED values.',
  calculus:
    'CALCULUS SPECIALIST: you own derivative/integrate/limit/dsolve. CALL math_calculus_solve; STATE ONLY VERIFIED values.',
};

/**
 * Specialist plugin factory. Specialists never spawn mathcore themselves —
 * they call the governor's shared transport and memorize into their own
 * memory namespace (`math/<domain>/…`). The governor enforces
 * verified-or-withheld globally and routes via `math_route`.
 */
function defineDomainSpecialist(domain: SpecialistDomain) {
  const operations = DOMAIN_OPERATIONS[domain];
  const solveTool = domain === 'algebra' ? 'math_algebra_solve' : 'math_calculus_solve';
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
          const op = operation || (domain === 'algebra' ? 'solve' : 'integrate');
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
            const op = operation || (domain === 'algebra' ? 'solve' : 'integrate');
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
        agent.inject({ type: 'system', content: DOMAIN_HINTS[domain] });
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

export default zoveliMathAlgebra;
