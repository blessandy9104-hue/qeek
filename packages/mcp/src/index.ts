import { definePlugin } from '@deepseek-ai/dsh-core';

export const zoveliMCP = definePlugin({
  name: 'zoveli-mcp',
  description: 'MCP client and server integration',

  setup(ctx) {
    // mathcore MCP server (already configured in assistant-math)
    ctx.register('mcp-servers', {
      mathcore: {
        command: 'mathcore-mcp',
        transport: 'stdio',
        env: {
          MATHCORE_AUDIT: process.env.MATHCORE_AUDIT ||
            require('path').join(require('os').homedir(), '.mathcore', 'audit.jsonl')
        }
      },
      filesystem: {
        command: 'npx',
        args: ['@modelcontextprotocol/server-filesystem', process.cwd()],
        transport: 'stdio'
      },
      github: {
        command: 'npx',
        args: ['@modelcontextprotocol/server-github'],
        transport: 'stdio',
        env: { GITHUB_PERSONAL_ACCESS_TOKEN: process.env.GITHUB_TOKEN }
      }
    });

    // MCP client configuration
    ctx.register('mcp-client', {
      autoConnect: true,
      reconnectInterval: 5000,
      maxRetries: 3
    });

    // Expose MCP tools to agent
    ctx.on('agent/created', (agent) => {
      agent.inject({
        type: 'system',
        content: 'Available MCP servers: mathcore (verified math), filesystem, github. Use tools via standard tool calls.'
      });
    });
  }
});

export default zoveliMCP;

