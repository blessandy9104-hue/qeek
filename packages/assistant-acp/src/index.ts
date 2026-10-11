import { definePlugin } from '@deepseek-ai/dsh-core';

export const assistantACP = definePlugin({
  name: 'assistant-acp',
  description: 'Agent Communication Protocol server',

  setup(ctx) {
    ctx.register('acp-server', {
      enabled: true,
      port: process.env.ACP_PORT || 3082,
      host: '127.0.0.1',
      auth: { type: 'token', token: process.env.ACP_TOKEN },
      cors: true,
      rateLimit: { windowMs: 60000, max: 1000 }
    });

    ctx.register('acp-capabilities', {
      agents: true,
      sessions: true,
      tools: true,
      streaming: true,
      notifications: true,
      fileOperations: true
    });

    ctx.register('acp-tools', [
      {
        name: 'acp_create_session',
        description: 'Create ACP session',
        parameters: { type: 'object', properties: { agentId: { type: 'string' }, metadata: { type: 'object' } } }
      },
      {
        name: 'acp_send_message',
        description: 'Send message via ACP',
        parameters: { type: 'object', properties: { sessionId: { type: 'string' }, content: { type: 'string' }, role: { type: 'string' } }, required: ['sessionId', 'content'] }
      }
    ]);
  }
});

export default assistantACP;