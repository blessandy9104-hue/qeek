import { definePlugin } from '@deepseek-ai/dsh-core';
import { mathcoreTools } from './mathcore-tools';
import { memoryTools } from './memory-tools';
import { assistantPrompt } from './system-prompt';

export const assistantCore = definePlugin({
  name: 'personal-assistant-core',
  description: 'Personal Assistant AI core integration plugin',

  setup(ctx) {
    ctx.register('assistant-prompt', assistantPrompt);
    ctx.register('assistant-math-tools', mathcoreTools);
    ctx.register('assistant-memory-tools', memoryTools);

    ctx.on('agent/pre-step', (next, input) => {
      const enhancedInput = enhanceWithContext(input);
      return next(enhancedInput);
    });
  }
});

function enhanceWithContext(input: any) {
  return {
    ...input,
    metadata: {
      ...input.metadata,
      assistantVersion: '0.1.0',
      capabilities: ['verified-math', 'persistent-memory', 'skill-system']
    }
  };
}

export { assistantPrompt } from './system-prompt';
export { mathcoreTools } from './mathcore-tools';
export { memoryTools } from './memory-tools';