import type { Tool } from '@deepseek-ai/dsh-core';
import { mathcore } from './transport.js';
import { memorizeVerified, recallSimilar, getMathStats, recordMismatch } from './intelligence.js';
import { routeDomain } from './domains.js';

export const mathcoreTools: Tool[] = [
  {
    name: 'mathcore_compute',
    description: 'Compute a mathematical expression with verified results using mathcore (auto-memorized)',
    parameters: {
      type: 'object',
      properties: {
        expression: { type: 'string', description: 'Mathematical expression to compute' },
        operation: { type: 'string', description: 'Operation type: evaluate, solve, derivative, integrate, simplify, factor, expand, limit, determinant, eigenvalues, is_prime, factor_int, gcd, lcm, modpow, factorial, choose, sat, prove, stat, convert, shortest_path', enum: ['evaluate', 'solve', 'derivative', 'integrate', 'simplify', 'factor', 'expand', 'limit', 'determinant', 'eigenvalues', 'linsolve', 'matmul', 'inverse', 'rank', 'is_prime', 'factor_int', 'gcd', 'lcm', 'modpow', 'factorial', 'choose', 'sat', 'prove', 'stat', 'convert', 'shortest_path'] }
      },
      required: ['expression']
    },
    async execute({ expression, operation }: { expression: string; operation?: string }) {
      const cmd = operation ? `${operation} ${expression}` : expression;
      const out = await mathcore.compute(cmd);
      // AI layer: memorize verified proofs, best-effort (never breaks compute).
      try {
        await memorizeVerified(cmd, out);
      } catch {
        // ignore
      }
      return out;
    }
  },
  {
    name: 'mathcore_check_answer',
    description: 'Verify an answer against mathcore verified computation',
    parameters: {
      type: 'object',
      properties: {
        question: { type: 'string', description: 'Original mathematical question' },
        answer: { type: 'string', description: 'Proposed answer to verify' }
      },
      required: ['question', 'answer']
    },
    async execute({ question, answer }: { question: string; answer: string }) {
      const out = await mathcore.checkAnswer(question, answer);
      if (/MISMATCH/i.test(out)) recordMismatch();
      return out;
    }
  },
  {
    name: 'mathcore_list_operations',
    description: 'Check mathcore MCP server liveness and tool catalog',
    parameters: { type: 'object', properties: {} },
    async execute() {
      // mathcore has no list_operations MCP method; the operation catalog
      // lives in the tool schemas above. Report liveness instead.
      const tools = await mathcore.listTools();
      return { mcpTools: tools.map((t: any) => t.name), status: 'ok' };
    }
  },
];

export const mathIntelligenceTools: Tool[] = [
  {
    name: 'math_recall',
    description: 'Recall verified proofs from math memory similar to the question',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Question to find similar verified proofs for' },
        limit: { type: 'number', default: 5 },
        domain: { type: 'string', enum: ['algebra', 'calculus', 'general'], description: 'Restrict recall to a specialist domain' },
      },
      required: ['query'],
    },
    async execute({ query, limit = 5, domain = 'general' }: { query: string; limit?: number; domain?: 'algebra' | 'calculus' | 'general' }) {
      return { results: await recallSimilar(query, limit, domain) };
    },
  },
  {
    name: 'math_route',
    description: 'Classify a math request to its specialist domain (no computation)',
    parameters: {
      type: 'object',
      properties: {
        request: { type: 'string', description: 'Math request to classify' },
        operation: { type: 'string', description: 'Explicit mathcore operation, if known' },
      },
      required: ['request'],
    },
    async execute({ request, operation }: { request: string; operation?: string }) {
      return { domain: routeDomain({ request, operation }) };
    },
  },
  {
    name: 'math_memorize',
    description: 'Explicitly memorize a verified result (auto-memorize covers compute)',
    parameters: {
      type: 'object',
      properties: {
        request: { type: 'string' },
        result: { type: 'string' },
      },
      required: ['request', 'result'],
    },
    async execute({ request, result }: { request: string; result: string }) {
      return { memorized: await memorizeVerified(request, result) };
    },
  },
  {
    name: 'math_stats',
    description: 'Math intelligence counters (verified/withheld/mismatches/recalls)',
    parameters: { type: 'object', properties: {} },
    async execute() {
      return getMathStats();
    },
  },
];
