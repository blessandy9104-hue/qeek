// ---------------------------------------------------------------------------
// Governor-owned routing table: the ONE place that maps operations and
// request keywords to specialist domains. Specialist plugins
// (@zoveli/math-domains) import this — never their own copies.
// ---------------------------------------------------------------------------

export type MathDomain = 'algebra' | 'calculus' | 'statistics' | 'logic' | 'general';

/** Canonical operation set per domain (mirrors mathcore's op catalog). */
export const DOMAIN_OPERATIONS: Record<Exclude<MathDomain, 'general'>, string[]> = {
  algebra: [
    'evaluate', 'simplify', 'expand', 'factor', 'solve',
    'determinant', 'rank', 'inverse', 'linsolve', 'matmul', 'eigenvalues',
    'is_prime', 'factor_int', 'gcd', 'lcm', 'modpow', 'factorial', 'choose',
  ],
  calculus: ['derivative', 'integrate', 'limit', 'dsolve'],
  statistics: ['stat'],
  logic: ['sat', 'prove'],
};

const CALCULUS_HINT =
  /\b(derivative|differentiat\w*|integrat\w*|integral|antiderivative|limit|dsolve|differential equation)\b|d\/d[xyt]\b/i;
const STATISTICS_HINT =
  /\b(statistic\w*|probability|probabilities|mean|median|variance|std|standard deviation|regression|correlation|confidence|p-value|hypothesis|anova|histogram|distribution|quartile|percentile)\b/i;
const LOGIC_HINT =
  /\b(sat|satisfi\w*|unsat|tautolog\w*|contradiction|prove|proof|propositional|predicate logic|SMT|boolean)\b/i;
const ALGEBRA_HINT =
  /\b(solve|equation|factor|simplify|expand|determinant|eigenvalu|matrix|prime|gcd|lcm|modpow|factorial)\b/i;

/**
 * Route a request to its specialist domain. Explicit `operation` wins;
 * otherwise keyword hints (calculus → statistics → logic → algebra);
 * unknown falls through to `general` (governor handles directly —
 * convert/shortest_path live here until they earn their own specialists).
 */
export function routeDomain(input: { operation?: string; request: string }): MathDomain {
  const op = (input.operation || '').trim().toLowerCase();
  if (op) {
    for (const [domain, ops] of Object.entries(DOMAIN_OPERATIONS) as [Exclude<MathDomain, 'general'>, string[]][]) {
      if (ops.includes(op)) return domain;
    }
    return 'general';
  }
  const text = input.request || '';
  if (CALCULUS_HINT.test(text)) return 'calculus';
  if (STATISTICS_HINT.test(text)) return 'statistics';
  if (LOGIC_HINT.test(text)) return 'logic';
  if (ALGEBRA_HINT.test(text)) return 'algebra';
  if (/^[0-9\s+\-*/^().!%]+$/.test(text.trim()) && /\d/.test(text)) return 'algebra';
  return 'general';
}

/** Memory tag namespacing proof notes per domain (`math`, `math/algebra`). */
export function domainMemoryTag(domain: MathDomain): string {
  return domain === 'general' ? 'math' : `math/${domain}`;
}

/** Proof-note title prefix per domain (`math/…` or `math/algebra/…`). */
export function domainTitlePrefix(domain: MathDomain): string {
  return domain === 'general' ? 'math/' : `math/${domain}/`;
}
