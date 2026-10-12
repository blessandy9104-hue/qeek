import { definePlugin } from '@deepseek-ai/dsh-core';

export const zoveliPreset = definePlugin({
  name: 'zoveli-preset',
  description: 'Agent presets and configuration profiles',

  setup(ctx) {
    ctx.register('presets', {
      'general-assistant': {
        name: 'General Assistant',
        description: 'Balanced assistant for everyday tasks',
        tools: ['fs', 'shell', 'browser', 'memory', 'math'],
        skills: ['daily-briefing', 'research', 'task-planning'],
        model: 'deepseek-chat',
        policy: 'balanced'
      },
      'coding-assistant': {
        name: 'Coding Assistant',
        description: 'Specialized for software development',
        tools: ['fs', 'shell', 'lsp', 'terminal', 'git', 'browser', 'memory', 'math'],
        skills: ['code-review', 'task-planning', 'research'],
        model: 'deepseek-coder',
        policy: 'permissive'
      },
      'research-assistant': {
        name: 'Research Assistant',
        description: 'Optimized for research and analysis',
        tools: ['browser', 'memory', 'math', 'document', 'fs'],
        skills: ['research', 'daily-briefing'],
        model: 'deepseek-chat',
        policy: 'balanced'
      },
      'creative-assistant': {
        name: 'Creative Assistant',
        description: 'For writing, design, and creative tasks',
        tools: ['fs', 'browser', 'memory', 'document'],
        skills: ['daily-briefing'],
        model: 'deepseek-chat',
        policy: 'permissive'
      },
      'minimal': {
        name: 'Minimal',
        description: 'Core assistant with minimal tools',
        tools: ['memory', 'math'],
        skills: [],
        model: 'deepseek-chat',
        policy: 'strict'
      }
    });

    ctx.register('preset-tools', [
      {
        name: 'preset_list',
        description: 'List available presets',
        parameters: { type: 'object', properties: {} }
      },
      {
        name: 'preset_apply',
        description: 'Apply a preset to current session',
        parameters: {
          type: 'object',
          properties: { preset: { type: 'string' } },
          required: ['preset']
        }
      }
    ]);
  }
});

export default zoveliPreset;

