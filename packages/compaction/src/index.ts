import { definePlugin } from '@deepseek-ai/dsh-core';

export const zoveliCompaction = definePlugin({
  name: 'zoveli-compaction',
  description: 'Context compaction and summarization',

  setup(ctx) {
    ctx.register('compaction-config', {
      enabled: true,
      threshold: 0.8,
      strategy: 'summarize',
      preserveRecent: 5,
      preserveSystem: true,
      preserveTools: true
    });

    ctx.register('compaction-strategies', {
      summarize: {
        name: 'Summarize',
        model: 'deepseek-chat',
        prompt: 'Summarize the following conversation, preserving key facts, decisions, and tool results:',
        maxTokens: 2000
      },
      truncate: {
        name: 'Truncate Oldest',
        preserveRecent: 10
      },
      hybrid: {
        name: 'Hybrid',
        summarizeThreshold: 0.6,
        truncateThreshold: 0.9
      }
    });

    ctx.register('compaction-tools', [
      {
        name: 'compact_context',
        description: 'Manually trigger context compaction',
        parameters: {
          type: 'object',
          properties: { strategy: { type: 'string', enum: ['summarize', 'truncate', 'hybrid'] }, threshold: { type: 'number' } }
        }
      },
      {
        name: 'get_compaction_status',
        description: 'Get current context usage',
        parameters: { type: 'object', properties: {} }
      }
    ]);
  }
});

export default zoveliCompaction;

