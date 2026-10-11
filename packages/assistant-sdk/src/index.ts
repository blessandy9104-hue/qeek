import { definePlugin } from '@deepseek-ai/dsh-core';

export const assistantSDK = definePlugin({
  name: 'assistant-sdk',
  description: 'SDK for embedding the assistant',

  setup(ctx) {
    ctx.register('sdk-config', {
      transport: 'stdio',
      protocol: 'jsonrpc',
      version: '2.0',
      heartbeat: 30000
    });

    ctx.register('sdk-methods', [
      'agent.create', 'agent.delete', 'agent.list',
      'session.create', 'session.delete', 'session.get', 'session.list',
      'turn.start', 'turn.cancel', 'turn.status',
      'tool.call', 'tool.result',
      'context.inject', 'context.clear',
      'skill.invoke', 'workflow.run',
      'memory.read', 'memory.write', 'memory.search',
      'math.compute', 'math.verify'
    ]);

    ctx.register('sdk-client-config', {
      reconnect: true,
      reconnectInterval: 5000,
      maxRetries: 5,
      timeout: 60000
    });
  }
});

export default assistantSDK;