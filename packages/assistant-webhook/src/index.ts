import { definePlugin } from '@deepseek-ai/dsh-core';

export const assistantWebhook = definePlugin({
  name: 'assistant-webhook',
  description: 'Webhook server and event dispatch',

  setup(ctx) {
    ctx.register('webhook-server', {
      port: process.env.WEBHOOK_PORT || 3081,
      path: '/webhook',
      secret: process.env.WEBHOOK_SECRET,
      cors: true,
      rateLimit: { windowMs: 60000, max: 100 }
    });

    ctx.register('webhook-rules', [
      {
        id: 'github-push',
        source: 'github',
        events: ['push', 'pull_request'],
        filter: (payload: any) => payload.repository?.full_name === 'user/repo',
        action: 'trigger_workflow',
        workflow: 'code-review',
        inputs: { files: '{{commits.modified}}' }
      },
      {
        id: 'slack-command',
        source: 'slack',
        events: ['app_mention', 'message'],
        filter: (payload: any) => payload.text?.startsWith('/assistant'),
        action: 'create_session',
        preset: 'chat'
      }
    ]);

    ctx.register('webhook-tools', [
      {
        name: 'register_webhook',
        description: 'Register a new webhook endpoint',
        parameters: {
          type: 'object',
          properties: {
            url: { type: 'string' },
            events: { type: 'array', items: { type: 'string' } },
            secret: { type: 'string' }
          },
          required: ['url', 'events']
        }
      }
    ]);
  }
});

export default assistantWebhook;