import { definePlugin } from '@deepseek-ai/dsh-core';
import * as path from 'path';
import * as os from 'os';

export const zoveliSettings = definePlugin({
  name: 'zoveli-settings',
  description: 'Settings management with UI cards',

  setup(ctx) {
    ctx.register('settings-categories', [
      {
        id: 'general',
        label: 'General',
        icon: 'settings',
        order: 1,
        settings: [
          { key: 'language', type: 'select', options: ['en', 'zh', 'es', 'fr'], default: 'en' },
          { key: 'theme', type: 'select', options: ['light', 'dark', 'system'], default: 'system' },
          { key: 'autoSave', type: 'boolean', default: true },
          { key: 'confirmActions', type: 'boolean', default: true }
        ]
      },
      {
        id: 'assistant',
        label: 'Assistant',
        icon: 'bot',
        order: 2,
        settings: [
          { key: 'defaultModel', type: 'select', options: ['deepseek-chat', 'deepseek-coder', 'local-llama'], default: 'deepseek-chat' },
          { key: 'maxTurns', type: 'number', min: 10, max: 200, default: 50 },
          { key: 'mathVerification', type: 'select', options: ['required', 'optional', 'disabled'], default: 'required' },
          { key: 'systemPrompt', type: 'textarea', default: '' }
        ]
      },
      {
        id: 'memory',
        label: 'Memory',
        icon: 'database',
        order: 3,
        settings: [
          { key: 'vaultPath', type: 'path', default: './knowledge-vault' },
          { key: 'autoIndex', type: 'boolean', default: true },
          { key: 'maxSearchResults', type: 'number', min: 5, max: 50, default: 10 }
        ]
      },
      {
        id: 'tools',
        label: 'Tools',
        icon: 'wrench',
        order: 4,
        settings: [
          { key: 'shellEnabled', type: 'boolean', default: true },
          { key: 'browserEnabled', type: 'boolean', default: true },
          { key: 'fsEnabled', type: 'boolean', default: true },
          { key: 'mcpEnabled', type: 'boolean', default: true }
        ]
      },
      {
        id: 'privacy',
        label: 'Privacy',
        icon: 'shield',
        order: 5,
        settings: [
          { key: 'telemetryEnabled', type: 'boolean', default: false },
          { key: 'localOnly', type: 'boolean', default: true },
          { key: 'auditLogRetention', type: 'number', min: 1, max: 365, default: 90 }
        ]
      }
    ]);

    ctx.register('settings-storage', {
      type: 'file',
      path: path.join(os.homedir(), '.personal-assistant', 'settings.json'),
      encryption: false
    });
  }
});

export default zoveliSettings;

