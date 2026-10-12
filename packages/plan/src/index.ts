import { definePlugin } from '@deepseek-ai/dsh-core';

export const zoveliPlan = definePlugin({
  name: 'zoveli-plan',
  description: 'Plan management and execution tracking',

  setup(ctx) {
    ctx.register('plan-config', {
      maxSteps: 50,
      autoUpdate: true,
      persistToVault: true,
      vaultPath: 'plans/',
      templatePath: 'templates/plans/'
    });

    ctx.register('plan-templates', {
      'feature-development': {
        name: 'Feature Development',
        phases: ['Requirements', 'Design', 'Implementation', 'Testing', 'Review', 'Deploy'],
        stepsPerPhase: 3
      },
      'research-project': {
        name: 'Research Project',
        phases: ['Literature Review', 'Hypothesis', 'Experiment', 'Analysis', 'Writeup'],
        stepsPerPhase: 5
      },
      'learning-plan': {
        name: 'Learning Plan',
        phases: ['Assessment', 'Resources', 'Practice', 'Projects', 'Review'],
        stepsPerPhase: 4
      }
    });

    ctx.register('plan-tools', [
      {
        name: 'plan_create',
        description: 'Create a new plan',
        parameters: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            template: { type: 'string' },
            goal: { type: 'string' },
            deadline: { type: 'string' }
          },
          required: ['title', 'goal']
        }
      },
      {
        name: 'plan_update',
        description: 'Update plan progress',
        parameters: {
          type: 'object',
          properties: { planId: { type: 'string' }, stepId: { type: 'string' }, status: { type: 'string', enum: ['pending', 'in_progress', 'completed', 'blocked'] }, notes: { type: 'string' } },
          required: ['planId', 'stepId', 'status']
        }
      },
      {
        name: 'plan_list',
        description: 'List all plans',
        parameters: { type: 'object', properties: { status: { type: 'string' } } }
      }
    ]);
  }
});

export default zoveliPlan;

