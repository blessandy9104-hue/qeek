import { definePlugin } from '@deepseek-ai/dsh-core';

export const zoveliAgent = definePlugin({
  name: 'zoveli-agent',
  description: 'Agent runtime with loop, registry, and event system',

  setup(ctx) {
    // Register agent interface
    ctx.register('assistant-agent-interface', {
      id: 'assistant-agent',
      name: 'Personal Assistant Agent',
      capabilities: [
        'chat', 'tools', 'memory', 'math', 'skills',
        'subagents', 'workflow', 'planning', 'goals'
      ]
    });

    // Agent loop configuration
    ctx.register('assistant-agent-loop-config', {
      maxTurns: 50,
      maxStepsPerTurn: 10,
      stepTimeout: 120000,
      turnTimeout: 300000,
      enableCompaction: true,
      compactionThreshold: 0.8
    });

    // Agent events
    ctx.on('agent/created', (agent) => {
      agent.inject({
        type: 'system',
        content: 'You are a Personal Assistant with verified math, persistent memory, and full tool access.'
      });
    });

    ctx.on('agent/pre-step', (next, input) => {
      // Enhance with context from memory, goals, etc.
      return next(input);
    });
  }
});

export default zoveliAgent;

