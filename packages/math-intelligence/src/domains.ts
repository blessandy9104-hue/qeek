// ---------------------------------------------------------------------------
// Governor-owned routing table: the ONE place that maps operations and
// request keywords to specialist domains. Specialist plugins
// (@zoveli/math-domains) import this — never their own copies.
// ---------------------------------------------------------------------------

export type MathDomain = 'algebra' | 'calculus' | 'statistics' | 'logic' | 'units' | 'discrete' | 'arithmetic' | 'geometry' | 'trigonometry' | 'probability' | 'linear' | 'number' | 'general';

/** Canonical operation set per domain (mirrors mathcore's op catalog). */
export const DOMAIN_OPERATIONS: Record<Exclude<MathDomain, 'general'>, string[]> = {
  algebra: [
    'evaluate', 'simplify', 'expand', 'factor', 'solve',
  ],
  calculus: ['derivative', 'integrate', 'limit', 'dsolve'],
  statistics: ['stat'],
  logic: ['sat', 'prove'],
  units: ['convert'],
  discrete: ['shortest_path'],
  arithmetic: ['percent', 'ratio'],
  geometry: ['area', 'volume', 'pythagoras'],
  trigonometry: ['trig'],
  probability: ['probability'],
  linear: ['determinant', 'rank', 'inverse', 'linsolve', 'matmul', 'eigenvalues'],
  number: ['is_prime', 'factor_int', 'gcd', 'lcm', 'modpow', 'factorial', 'choose'],
};

const CALCULUS_HINT =
  /\b(derivative|differentiat\w*|integrat\w*|integral|antiderivative|limit|dsolve|differential equation)\b|d\/d[xyt]\b/i;
const STATISTICS_HINT =
  /\b(statistic\w*|mean|median|variance|std|standard deviation|regression|correlation|confidence|p-value|hypothesis|anova|histogram|quartile|percentile)\b/i;
const LOGIC_HINT =
  /\b(sat|satisfi\w*|unsat|tautolog\w*|contradiction|prove|proof|propositional|predicate logic|SMT|boolean)\b/i;
const UNITS_HINT =
  /\b(convert\w*|fahrenheit|celsius|kelvin|meters?|metres?|kilometers?|feet|foot|inches?|miles?|pounds?|kilograms?|ounces?|gallons?|liters?|litres?|yards?)\b/i;
const DISCRETE_HINT =
  /\b(shortest path|shortest-path|dijkstra|bellman)\b/i;
const ALGEBRA_HINT =
  /\b(solve|equation|factor|simplify|expand)\b/i;
const ARITHMETIC_HINT =
  /\b(percent|percentage|ratio|proportion)\b/i;
const GEOMETRY_HINT =
  /\b(area|volume|pythagoras|triangle|circle|rectangle|sphere|hypotenuse|perimeter)\b/i;
const TRIG_HINT =
  /\b(trig|sine|cosine|tangent|degrees|radians|sin|cos|tan)\b/i;
const PROBABILITY_HINT =
  /\b(probability|binomial|dice|coin|distribution)\b/i;
const LINEAR_HINT =
  /\b(determinant|eigenvalu|matrix|linsolve|linear system|matmul|rank|inverse)\b/i;
const NUMBER_HINT =
  /\b(prime|factor integer|gcd|lcm|modpow|factorial|choose)\b/i;

/**
 * Route a request to its specialist domain. Explicit `operation` wins;
 * otherwise keyword hints (calculus → statistics → probability → logic →
 * units → discrete → geometry → trigonometry → arithmetic → linear →
 * number → algebra); unknown falls through to `general` (governor
 * handles directly).
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
  if (PROBABILITY_HINT.test(text)) return 'probability';
  if (LOGIC_HINT.test(text)) return 'logic';
  if (UNITS_HINT.test(text)) return 'units';
  if (DISCRETE_HINT.test(text)) return 'discrete';
  if (GEOMETRY_HINT.test(text)) return 'geometry';
  if (TRIG_HINT.test(text)) return 'trigonometry';
  if (ARITHMETIC_HINT.test(text)) return 'arithmetic';
  if (LINEAR_HINT.test(text)) return 'linear';
  if (NUMBER_HINT.test(text)) return 'number';
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

// ---------------------------------------------------------------------------
// Invocation surface: mathcore's text parser keys on NATURAL keywords, which
// differ from op ids for several ops ("shortest_path" must be sent as
// "shortest path", "stat" takes no head at all). This map is the ONE place
// that translates op → surface head. `null` = pass the request through
// unchanged (the request itself must be the full natural command).
// ---------------------------------------------------------------------------

export const OP_INVOCATION: Record<string, string | null> = {
  shortest_path: 'shortest path',
  is_prime: 'is',
  factor_int: 'factor',
  linsolve: 'solve linear system',
  matmul: 'multiply',
  stat: null,
  trig: null,
  probability: null,
  pythagoras: 'pythagoras',
  percent: 'percent',
  ratio: 'ratio',
  area: 'area',
  volume: 'volume',
};

/** Surface head for an op id (identity when the id is already the keyword). */
export function invocationHead(operation: string): string | null {
  if (Object.hasOwn(OP_INVOCATION, operation)) return OP_INVOCATION[operation];
  return operation;
}

/**
 * Build the exact command string sent to mathcore. Convention: `request`
 * excludes the operation head ("x^2-1" + solve), except null-head ops
 * where `request` is the full natural phrase ("mean of 1,2,3" + stat).
 */
export function buildCommand(operation: string | undefined, expression: string): string {
  if (!operation) return expression;
  const head = invocationHead(operation);
  return head ? `${head} ${expression}` : expression;
}
