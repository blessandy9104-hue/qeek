import { definePlugin } from '@deepseek-ai/dsh-core';

export const zoveliGoals = definePlugin({
  name: 'zoveli-goals',
  description: 'Goal and objective management',

  setup(ctx) {
    ctx.register('goals-config', {
      maxGoals: 20,
      categories: ['personal', 'work', 'learning', 'health', 'finance', 'creative'],
      timeframes: ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'],
      persistence: 'vault',
      vaultPath: 'goals/',
      trackingEnabled: true
    });

    ctx.register('goals-tools', [
      {
        name: 'goal_create',
        description: 'Create a new goal',
        parameters: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            description: { type: 'string' },
            category: { type: 'string' },
            timeframe: { type: 'string' },
            targetDate: { type: 'string' },
            metrics: { type: 'array', items: { type: 'object' } }
          },
          required: ['title', 'category', 'timeframe']
        }
      },
      {
        name: 'goal_update',
        description: 'Update goal progress',
        parameters: {
          type: 'object',
          properties: {
            goalId: { type: 'string' },
            progress: { type: 'number' },
            status: { type: 'string', enum: ['not_started', 'in_progress', 'completed', 'paused', 'cancelled'] },
            notes: { type: 'string' }
          },
          required: ['goalId']
        }
      },
      {
        name: 'goal_list',
        description: 'List goals',
        parameters: {
          type: 'object',
          properties: { category: { type: 'string' }, timeframe: { type: 'string' }, status: { type: 'string' } }
        }
      },
      {
        name: 'goal_review',
        description: 'Review goal progress',
        parameters: { type: 'object', properties: { goalId: { type: 'string' } } }
      }
    ]);
  }
});

export default zoveliGoals;

