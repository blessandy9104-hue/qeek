import { definePlugin } from '@deepseek-ai/dsh-core';

export const assistantContext = definePlugin({
  name: 'assistant-context',
  description: 'Context management and injection',

  setup(ctx) {
    ctx.register('context-sources', [
      { id: 'session', name: 'Session History', priority: 100, enabled: true },
      { id: 'memory', name: 'Knowledge Vault', priority: 90, enabled: true },
      { id: 'workspace', name: 'Workspace Files', priority: 80, enabled: true },
      { id: 'system', name: 'System Prompt', priority: 1000, enabled: true },
      { id: 'skills', name: 'Active Skills', priority: 70, enabled: true },
      { id: 'goals', name: 'Current Goals', priority: 60, enabled: true }
    ]);

    ctx.register('context-injection', {
      modes: ['auto', 'manual', 'selective'],
      defaultMode: 'auto',
      maxTokens: 32000,
      compressionEnabled: true
    });

    ctx.register('context-tools', [
      {
        name: 'context_inject',
        description: 'Inject context into current session',
        parameters: {
          type: 'object',
          properties: {
            source: { type: 'string', enum: ['memory', 'workspace', 'custom'] },
            query: { type: 'string' },
            maxTokens: { type: 'number' }
          },
          required: ['source']
        }
      },
      {
        name: 'context_clear',
        description: 'Clear injected context',
        parameters: {
          type: 'object',
          properties: { source: { type: 'string' } }
        }
      }
    ]);
  }
});

export default assistantContext;