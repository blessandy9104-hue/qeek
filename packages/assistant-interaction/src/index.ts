import { definePlugin } from '@deepseek-ai/dsh-core';

export const assistantInteraction = definePlugin({
  name: 'assistant-interaction',
  description: 'Human interaction and confirmation handling',

  setup(ctx) {
    ctx.register('interaction-config', {
      defaultTimeout: 120000,
      methods: ['cli', 'web', 'notification', 'voice'],
      defaultMethod: 'web',
      persistResponses: true
    });

    ctx.register('interaction-types', {
      confirm: { name: 'Confirmation', schema: { type: 'object', properties: { message: { type: 'string' }, default: { type: 'boolean' } } } },
      input: { name: 'Text Input', schema: { type: 'object', properties: { prompt: { type: 'string' }, placeholder: { type: 'string' }, multiline: { type: 'boolean' } } } },
      select: { name: 'Selection', schema: { type: 'object', properties: { prompt: { type: 'string' }, options: { type: 'array', items: { type: 'object', properties: { label: { type: 'string' }, value: { type: 'string' } } } } } } },
      file: { name: 'File Picker', schema: { type: 'object', properties: { accept: { type: 'string' }, multiple: { type: 'boolean' } } } },
      form: { name: 'Form', schema: { type: 'object', properties: { fields: { type: 'array', items: { type: 'object' } } } } }
    });

    ctx.register('interaction-tools', [
      {
        name: 'interaction_confirm',
        description: 'Request confirmation',
        parameters: {
          type: 'object',
          properties: { message: { type: 'string' }, default: { type: 'boolean' }, timeout: { type: 'number' } },
          required: ['message']
        }
      },
      {
        name: 'interaction_input',
        description: 'Request text input',
        parameters: {
          type: 'object',
          properties: { prompt: { type: 'string' }, placeholder: { type: 'string' }, multiline: { type: 'boolean' }, timeout: { type: 'number' } },
          required: ['prompt']
        }
      },
      {
        name: 'interaction_select',
        description: 'Request selection from options',
        parameters: {
          type: 'object',
          properties: { prompt: { type: 'string' }, options: { type: 'array', items: { type: 'object', properties: { label: { type: 'string' }, value: { type: 'string' } } } }, timeout: { type: 'number' } },
          required: ['prompt', 'options']
        }
      }
    ]);
  }
});

export default assistantInteraction;