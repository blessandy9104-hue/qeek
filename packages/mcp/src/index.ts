import { definePlugin } from '@deepseek-ai/dsh-core';
import { MATHCORE_MCP_COMMAND, MATHCORE_MCP_SERVER_ID, defaultMathcoreAuditPath } from '@zoveli/math';

export const zoveliMCP = definePlugin({
  name: 'zoveli-mcp',
  description: 'MCP client and server integration',

  setup(ctx) {
    // mathcore entry: same one subsystem — command/env single-sourced from
    // @zoveli/math so the server address can never drift between plugins.
    ctx.register('mcp-servers', {
      [MATHCORE_MCP_SERVER_ID]: {
        command: MATHCORE_MCP_COMMAND,
        transport: 'stdio',
        env: {
          MATHCORE_AUDIT: defaultMathcoreAuditPath(),
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

