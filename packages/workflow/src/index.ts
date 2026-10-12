import { definePlugin } from '@deepseek-ai/dsh-core';

export const zoveliWorkflow = definePlugin({
  name: 'zoveli-workflow',
  description: 'Workflow orchestration and execution',

  setup(ctx) {
    ctx.register('workflow-engine', {
      executor: 'builtin',
      persistence: 'session',
      maxParallel: 3,
      retryPolicy: { maxRetries: 2, backoff: 'exponential' },
      timeout: 3600000
    });

    ctx.register('workflow-templates', {
      'research-report': {
        name: 'Research Report',
        steps: [
          { id: 'plan', type: 'skill', skill: 'task-planning', input: '{{topic}}' },
          { id: 'research', type: 'skill', skill: 'research', dependsOn: ['plan'] },
          { id: 'synthesize', type: 'agent', prompt: 'Synthesize findings', dependsOn: ['research'] },
          { id: 'save', type: 'tool', tool: 'memory_create_note', dependsOn: ['synthesize'] }
        ]
      },
      'code-review': {
        name: 'Code Review',
        steps: [
          { id: 'analyze', type: 'skill', skill: 'code-review', input: '{{files}}' },
          { id: 'report', type: 'agent', prompt: 'Generate review report', dependsOn: ['analyze'] },
          { id: 'save', type: 'tool', tool: 'memory_create_note', dependsOn: ['report'] }
        ]
      },
      'daily-briefing': {
        name: 'Daily Briefing',
        steps: [
          { id: 'briefing', type: 'skill', skill: 'daily-briefing' },
          { id: 'save', type: 'tool', tool: 'memory_create_note', dependsOn: ['briefing'] }
        ]
      }
    });

    ctx.register('workflow-tools', [
      {
        name: 'run_workflow',
        description: 'Execute a workflow template',
        parameters: {
          type: 'object',
          properties: {
            template: { type: 'string' },
            inputs: { type: 'object' }
          },
          required: ['template']
        }
      }
    ]);
  }
});

export default zoveliWorkflow;

