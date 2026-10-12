import { definePlugin } from '@deepseek-ai/dsh-core';

export const zoveliSubagent = definePlugin({
  name: 'zoveli-subagent',
  description: 'Subagent delegation and management',

  setup(ctx) {
    ctx.register('subagent-types', {
      child: {
        name: 'Child Agent',
        description: 'Fresh agent with inherited context',
        inheritsContext: true,
        inheritsTools: true,
        maxDepth: 3
      },
      delegated: {
        name: 'Delegated Turn',
        description: 'Single turn in existing agent',
        inheritsContext: true,
        inheritsTools: true,
        maxDepth: 1
      },
      specialist: {
        name: 'Specialist Agent',
        description: 'Pre-configured for specific domain',
        inheritsContext: false,
        inheritsTools: false,
        preset: 'specialist',
        maxDepth: 1
      }
    });

    ctx.register('subagent-policy', {
      maxConcurrent: 5,
      maxTotal: 20,
      defaultType: 'child',
      timeout: 180000,
      shareSession: true,
      autoSummarize: true
    });

    // Subagent tools
    ctx.register('subagent-tools', [
      {
        name: 'spawn_subagent',
        description: 'Spawn a subagent for a task',
        parameters: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['child', 'delegated', 'specialist'] },
            task: { type: 'string' },
            context: { type: 'string' },
            tools: { type: 'array', items: { type: 'string' } }
          },
          required: ['task']
        }
      },
      {
        name: 'await_subagent',
        description: 'Wait for subagent completion',
        parameters: {
          type: 'object',
          properties: { subagentId: { type: 'string' } },
          required: ['subagentId']
        }
      }
    ]);
  }
});

export default zoveliSubagent;

