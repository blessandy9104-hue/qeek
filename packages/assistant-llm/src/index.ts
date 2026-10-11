import { definePlugin } from '@deepseek-ai/dsh-core';

export const assistantLLM = definePlugin({
  name: 'assistant-llm',
  description: 'LLM provider registry and streaming',

  setup(ctx) {
    ctx.register('llm-providers', {
      default: 'deepseek-chat',
      providers: [
        {
          id: 'deepseek-chat',
          name: 'DeepSeek Chat',
          model: 'deepseek-chat',
          apiBase: 'https://api.deepseek.com/v1',
          capabilities: ['chat', 'streaming', 'tools', 'vision']
        },
        {
          id: 'deepseek-coder',
          name: 'DeepSeek Coder',
          model: 'deepseek-coder',
          apiBase: 'https://api.deepseek.com/v1',
          capabilities: ['chat', 'streaming', 'tools', 'code']
        },
        {
          id: 'local-llama',
          name: 'Local Llama (Ollama)',
          model: 'llama3.1',
          apiBase: 'http://localhost:11434/v1',
          capabilities: ['chat', 'streaming', 'tools']
        }
      ]
    });

    ctx.register('llm-defaults', {
      temperature: 0.7,
      maxTokens: 8192,
      topP: 0.95,
      presencePenalty: 0,
      frequencyPenalty: 0
    });

    ctx.register('llm-streaming', {
      enabled: true,
      chunkSize: 100,
      heartbeatInterval: 5000
    });
  }
});

export default assistantLLM;