import { definePlugin } from '@deepseek-ai/dsh-core';

export const assistantFeedback = definePlugin({
  name: 'assistant-feedback',
  description: 'User feedback collection and processing',

  setup(ctx) {
    ctx.register('feedback-config', {
      enabled: true,
      types: ['thumbs', 'rating', 'text', 'categorical'],
      storage: 'session',
      anonymize: true
    });

    ctx.register('feedback-prompts', {
      afterTurn: { enabled: true, delay: 2000, type: 'thumbs' },
      afterTool: { enabled: false, type: 'rating' },
      onError: { enabled: true, type: 'categorical', categories: ['wrong_answer', 'tool_failed', 'slow', 'confusing', 'other'] },
      periodic: { enabled: true, interval: 3600000, type: 'rating' }
    });

    ctx.register('feedback-tools', [
      {
        name: 'feedback_submit',
        description: 'Submit feedback',
        parameters: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['thumbs', 'rating', 'text', 'categorical'] },
            value: { type: 'string' },
            targetId: { type: 'string' },
            metadata: { type: 'object' }
          },
          required: ['type', 'value']
        }
      }
    ]);
  }
});

export default assistantFeedback;