import { definePlugin } from '@deepseek-ai/dsh-core';

export const zoveliLLM = definePlugin({
  name: 'zoveli-llm',
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
          id: 'openai',
          name: 'OpenAI',
          model: 'gpt-4o-mini',
          apiBase: 'https://api.openai.com/v1',
          capabilities: ['chat', 'streaming', 'tools', 'vision']
        },
        {
          id: 'openrouter',
          name: 'OpenRouter (any model)',
          model: 'openai/gpt-4o-mini',
          apiBase: 'https://openrouter.ai/api/v1',
          capabilities: ['chat', 'streaming', 'tools']
        },
        {
          id: 'groq',
          name: 'Groq (fast local-class inference)',
          model: 'llama-3.3-70b-versatile',
          apiBase: 'https://api.groq.com/openai/v1',
          capabilities: ['chat', 'streaming', 'tools']
        },
        {
          id: 'together',
          name: 'Together AI (open models)',
          model: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',
          apiBase: 'https://api.together.xyz/v1',
          capabilities: ['chat', 'streaming', 'tools']
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

export default zoveliLLM;

