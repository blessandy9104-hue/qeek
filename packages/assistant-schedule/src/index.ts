import { definePlugin } from '@deepseek-ai/dsh-core';

export const assistantSchedule = definePlugin({
  name: 'assistant-schedule',
  description: 'Scheduling and timer management',

  setup(ctx) {
    ctx.register('schedule-config', {
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      precision: 'minute',
      maxJobs: 100,
      persistence: 'vault',
      vaultPath: 'schedules/'
    });

    ctx.register('schedule-tools', [
      {
        name: 'schedule_create',
        description: 'Create a scheduled job',
        parameters: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            cron: { type: 'string' },
            action: { type: 'string', enum: ['skill', 'workflow', 'tool', 'agent'] },
            payload: { type: 'object' },
            enabled: { type: 'boolean', default: true }
          },
          required: ['name', 'cron', 'action', 'payload']
        }
      },
      {
        name: 'schedule_list',
        description: 'List scheduled jobs',
        parameters: { type: 'object', properties: { enabled: { type: 'boolean' } } }
      },
      {
        name: 'schedule_enable',
        description: 'Enable/disable a job',
        parameters: {
          type: 'object',
          properties: { jobId: { type: 'string' }, enabled: { type: 'boolean' } },
          required: ['jobId', 'enabled']
        }
      },
      {
        name: 'schedule_delete',
        description: 'Delete a scheduled job',
        parameters: {
          type: 'object',
          properties: { jobId: { type: 'string' } },
          required: ['jobId']
        }
      }
    ]);
  }
});

export default assistantSchedule;