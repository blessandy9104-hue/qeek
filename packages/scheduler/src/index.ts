import { definePlugin } from '@deepseek-ai/dsh-core';

interface TaskInput {
  title: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  effortMin?: number;
  energy?: 'low' | 'medium' | 'high';
  deadline?: string;
  tags?: string[];
}

interface ScheduledTask extends TaskInput {
  score: number;
  suggestedBlock: 'deep-work' | 'admin' | 'quick-wins' | 'low-energy';
  reason: string;
}

const PRIORITY_W = { low: 1, medium: 2, high: 3, urgent: 5 } as const;
const ENERGY_W = { low: 1, medium: 2, high: 3 } as const;

export const zoveliScheduler = definePlugin({
  name: 'zoveli-scheduler',
  description: 'Energy-aware task prioritization and time-blocking',

  setup(ctx) {
    function schedule(tasks: TaskInput[], now = new Date()): ScheduledTask[] {
      return tasks
        .map((t) => {
          const p = PRIORITY_W[t.priority ?? 'medium'];
          const e = ENERGY_W[t.energy ?? 'medium'];
          const effort = t.effortMin ?? 30;
          let urgency = 0;
          if (t.deadline) {
            const ms = new Date(t.deadline).getTime() - now.getTime();
            const days = ms / 86400000;
            if (days < 0) urgency = 5;
            else if (days < 1) urgency = 4;
            else if (days < 3) urgency = 3;
            else if (days < 7) urgency = 1;
          }
          const score = p * 3 + urgency * 2 + (effort <= 15 ? 1.5 : 0) + e * 0.5;

          let block: ScheduledTask['suggestedBlock'] = 'admin';
          let reason = '';
          if ((t.energy ?? 'medium') === 'high' && effort >= 45) {
            block = 'deep-work'; reason = 'High energy + long effort → 9–11am deep-work block';
          } else if (effort <= 15) {
            block = 'quick-wins'; reason = 'Short task → batch in quick-wins window';
          } else if ((t.energy ?? 'medium') === 'low') {
            block = 'low-energy'; reason = 'Low energy → after-lunch low-energy slot';
          } else {
            block = 'admin'; reason = 'Default communication/admin window';
          }
          return { ...t, score: Math.round(score * 10) / 10, suggestedBlock: block, reason };
        })
        .sort((a, b) => b.score - a.score);
    }

    ctx.provide('scheduler', { schedule });

    ctx.register('scheduler-tools', [
      {
        name: 'tasks_schedule',
        description: 'Prioritize tasks with energy-aware time-blocking',
        parameters: {
          type: 'object',
          properties: {
            tasks: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
                  effortMin: { type: 'number' },
                  energy: { type: 'string', enum: ['low', 'medium', 'high'] },
                  deadline: { type: 'string' },
                  tags: { type: 'array', items: { type: 'string' } },
                },
                required: ['title'],
              },
            },
          },
          required: ['tasks'],
        },
        async execute({ tasks }: { tasks: TaskInput[] }) {
          return { scheduled: schedule(tasks) };
        },
      },
    ]);
  },
});

export default zoveliScheduler;


