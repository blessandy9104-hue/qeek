import { definePlugin } from '@deepseek-ai/dsh-core';
import * as path from 'path';
import * as os from 'os';

export const assistantPluginManager = definePlugin({
  name: 'assistant-plugin-manager',
  description: 'Plugin installation and management',

  setup(ctx) {
    ctx.register('plugin-sources', {
      official: { name: 'Official Registry', url: 'https://registry.deepseek-ai.com', trusted: true },
      github: { name: 'GitHub', url: 'https://github.com', trusted: false },
      npm: { name: 'NPM', url: 'https://registry.npmjs.org', trusted: false },
      local: { name: 'Local', path: path.join(os.homedir(), '.personal-assistant', 'plugins'), trusted: true }
    });

    ctx.register('plugin-config', {
      autoUpdate: false,
      checkInterval: 86400000,
      allowUntrusted: false,
      maxPlugins: 50
    });

    ctx.register('plugin-tools', [
      {
        name: 'plugin_install',
        description: 'Install a plugin',
        parameters: {
          type: 'object',
          properties: { source: { type: 'string' }, name: { type: 'string' }, version: { type: 'string' } },
          required: ['source', 'name']
        }
      },
      {
        name: 'plugin_uninstall',
        description: 'Uninstall a plugin',
        parameters: {
          type: 'object',
          properties: { name: { type: 'string' } },
          required: ['name']
        }
      },
      {
        name: 'plugin_list',
        description: 'List installed plugins',
        parameters: { type: 'object', properties: { enabled: { type: 'boolean' } } }
      },
      {
        name: 'plugin_update',
        description: 'Update a plugin',
        parameters: {
          type: 'object',
          properties: { name: { type: 'string' }, version: { type: 'string' } },
          required: ['name']
        }
      }
    ]);
  }
});

export default assistantPluginManager;