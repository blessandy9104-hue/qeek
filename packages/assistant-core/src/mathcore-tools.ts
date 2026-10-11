import type { Tool } from '@deepseek-ai/dsh-core';
import { mathcore } from './mathcore-mcp.js';

export const mathcoreTools: Tool[] = [
  {
    name: 'mathcore_compute',
    description: 'Compute a mathematical expression with verified results using mathcore',
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
      return await mathcore.compute(cmd);
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
      return await mathcore.checkAnswer(question, answer);
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
  }
];