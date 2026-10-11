import { definePlugin } from '@deepseek-ai/dsh-core';

export const assistantMath = definePlugin({
  name: 'assistant-math',
  description: 'mathcore verified mathematics via MCP',

  setup(ctx) {
    const mathcoreConfig = {
      id: 'mathcore-mcp',
      name: '@deepseek-ai/dsh-mcp-client',
      config: {
        serverName: 'mathcore',
        transport: 'stdio',
        command: 'mathcore-mcp',
        cwd: process.cwd(),
        env: {
          MATHCORE_AUDIT: process.env.MATHCORE_AUDIT || 
            require('path').join(require('os').homedir(), '.mathcore', 'audit.jsonl')
        }
      }
    };

    ctx.register('mathcore-mcp-client', mathcoreConfig);

    ctx.on('agent/created', (agent) => {
      agent.inject({
        type: 'system',
        content: `MATH RULES: For any arithmetic, algebra, calculus, linear algebra, number theory, logic, statistics or unit conversion:
1. DO NOT compute in your head
2. CALL mathcore_compute with the request
3. STATE ONLY values it returns as VERIFIED
4. If WITHHELD, say result could not be verified; DO NOT GUESS
5. Before stating any numeric/symbolic result, CALL mathcore_check_answer and correct if MISMATCH`
      });
    });
  }
});

export default assistantMath;