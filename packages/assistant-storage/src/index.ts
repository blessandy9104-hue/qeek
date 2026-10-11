import { definePlugin } from '@deepseek-ai/dsh-core';
import * as path from 'path';
import * as os from 'os';

export const assistantStorage = definePlugin({
  name: 'assistant-storage',
  description: 'Persistent storage backends',

  setup(ctx) {
    ctx.register('storage-backends', {
      memory: { type: 'memory', name: 'In-Memory' },
      file: { type: 'file', name: 'File System', path: path.join(os.homedir(), '.personal-assistant', 'storage') },
      sqlite: { type: 'sqlite', name: 'SQLite', path: path.join(os.homedir(), '.personal-assistant', 'storage.db') },
      redis: { type: 'redis', name: 'Redis', url: process.env.REDIS_URL },
      s3: { type: 's3', name: 'S3 Compatible', bucket: process.env.S3_BUCKET, endpoint: process.env.S3_ENDPOINT }
    });

    ctx.register('storage-config', {
      defaultBackend: 'file',
      namespaces: ['sessions', 'settings', 'credentials', 'cache', 'embeddings', 'logs'],
      encryption: { enabled: false, algorithm: 'aes-256-gcm' },
      compression: { enabled: true, algorithm: 'zstd' },
      ttl: { default: 2592000000, cache: 3600000 } // 30 days default, 1h cache
    });

    ctx.register('storage-tools', [
      {
        name: 'storage_get',
        description: 'Get value from storage',
        parameters: {
          type: 'object',
          properties: { namespace: { type: 'string' }, key: { type: 'string' } },
          required: ['namespace', 'key']
        }
      },
      {
        name: 'storage_set',
        description: 'Set value in storage',
        parameters: {
          type: 'object',
          properties: { namespace: { type: 'string' }, key: { type: 'string' }, value: { type: 'string' }, ttl: { type: 'number' } },
          required: ['namespace', 'key', 'value']
        }
      },
      {
        name: 'storage_delete',
        description: 'Delete value from storage',
        parameters: {
          type: 'object',
          properties: { namespace: { type: 'string' }, key: { type: 'string' } },
          required: ['namespace', 'key']
        }
      },
      {
        name: 'storage_list',
        description: 'List keys in namespace',
        parameters: {
          type: 'object',
          properties: { namespace: { type: 'string' }, prefix: { type: 'string' } },
          required: ['namespace']
        }
      }
    ]);
  }
});

export default assistantStorage;