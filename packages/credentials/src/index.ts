import { definePlugin } from '@deepseek-ai/dsh-core';
import * as path from 'path';
import * as os from 'os';

export const zoveliCredentials = definePlugin({
  name: 'zoveli-credentials',
  description: 'Secure credential storage',

  setup(ctx) {
    ctx.register('credential-stores', {
      default: 'os-keychain',
      stores: [
        {
          id: 'os-keychain',
          name: 'OS Keychain',
          type: 'keychain',
          sync: false
        },
        {
          id: 'encrypted-file',
          name: 'Encrypted File',
          type: 'file',
          path: path.join(os.homedir(), '.personal-assistant', 'credentials.enc'),
          algorithm: 'aes-256-gcm'
        },
        {
          id: 'env-vars',
          name: 'Environment Variables',
          type: 'env',
          prefix: 'ZOVELI_'
        }
      ]
    });

    ctx.register('credential-schema', {
      required: [
        { key: 'DEEPSEEK_API_KEY', label: 'DeepSeek API Key', type: 'password' },
        { key: 'GITHUB_TOKEN', label: 'GitHub Token', type: 'password', optional: true },
        { key: 'OPENAI_API_KEY', label: 'OpenAI API Key', type: 'password', optional: true },
        { key: 'ANTHROPIC_API_KEY', label: 'Anthropic API Key', type: 'password', optional: true },
        { key: 'ZOVELI_API_KEY', label: 'Universal API Key (any OpenAI-compatible endpoint)', type: 'password', optional: true },
        { key: 'OPENROUTER_API_KEY', label: 'OpenRouter API Key', type: 'password', optional: true },
        { key: 'GROQ_API_KEY', label: 'Groq API Key', type: 'password', optional: true },
        { key: 'TOGETHER_API_KEY', label: 'Together API Key', type: 'password', optional: true }
      ],
      optional: [
        { key: 'SLACK_BOT_TOKEN', label: 'Slack Bot Token', type: 'password', optional: true },
        { key: 'DISCORD_TOKEN', label: 'Discord Token', type: 'password', optional: true },
        { key: 'NOTION_TOKEN', label: 'Notion Token', type: 'password', optional: true }
      ]
    });

    ctx.register('credential-tools', [
      {
        name: 'get_credential',
        description: 'Get a stored credential',
        parameters: {
          type: 'object',
          properties: { key: { type: 'string' } },
          required: ['key']
        }
      },
      {
        name: 'set_credential',
        description: 'Store a credential',
        parameters: {
          type: 'object',
          properties: { key: { type: 'string' }, value: { type: 'string' } },
          required: ['key', 'value']
        }
      },
      {
        name: 'list_credentials',
        description: 'List stored credential keys',
        parameters: { type: 'object', properties: {} }
      }
    ]);
  }
});

export default zoveliCredentials;


