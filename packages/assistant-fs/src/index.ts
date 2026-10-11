import { definePlugin } from '@deepseek-ai/dsh-core';
import * as path from 'path';
import * as os from 'os';

export const assistantFS = definePlugin({
  name: 'assistant-fs',
  description: 'Filesystem access with policy',

  setup(ctx) {
    ctx.register('fs-providers', {
      local: {
        id: 'local',
        root: process.cwd(),
        readOnly: false,
        allowHidden: false,
        maxFileSize: 100 * 1024 * 1024, // 100MB
        allowedExtensions: ['.txt', '.md', '.json', '.js', '.ts', '.py', '.html', '.css', '.yaml', '.yml', '.toml']
      },
      vault: {
        id: 'vault',
        root: process.env.ASSISTANT_VAULT_PATH || './knowledge-vault',
        readOnly: false,
        allowHidden: true
      },
      sandbox: {
        id: 'sandbox',
        root: path.join(os.tmpdir(), 'assistant-sandbox'),
        readOnly: false,
        allowHidden: true
      }
    });

    ctx.register('fs-policy', {
      defaultProvider: 'local',
      denyPatterns: ['**/node_modules/**', '**/.git/**', '**/*.log', '**/*.lock'],
      requireConfirmation: ['write', 'delete', 'move'],
      maxOperationsPerTurn: 50
    });
  }
});

export default assistantFS;