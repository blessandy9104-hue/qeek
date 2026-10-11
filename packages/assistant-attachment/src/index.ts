import { definePlugin } from '@deepseek-ai/dsh-core';
import * as path from 'path';
import * as os from 'os';

export const assistantAttachment = definePlugin({
  name: 'assistant-attachment',
  description: 'File attachment handling and processing',

  setup(ctx) {
    ctx.register('attachment-config', {
      maxFileSize: 100 * 1024 * 1024, // 100MB
      maxFiles: 20,
      allowedTypes: [
        'image/*', 'application/pdf', 'text/*',
        'application/json', 'application/xml',
        'application/zip', 'application/x-tar'
      ],
      storage: 'local',
      storagePath: path.join(os.tmpdir(), 'assistant-attachments'),
      cleanup: { maxAge: 86400000, maxSize: 1024 * 1024 * 1024 } // 24h, 1GB
    });

    ctx.register('attachment-processors', {
      image: {
        extractText: true,
        maxDimension: 2048,
        thumbnail: { width: 256, height: 256 }
      },
      pdf: {
        extractText: true,
        maxPages: 100,
        renderPages: [1]
      },
      text: {
        maxLength: 100000,
        encoding: 'utf-8'
      },
      archive: {
        extract: true,
        maxFiles: 100,
        maxTotalSize: 500 * 1024 * 1024
      }
    });

    ctx.register('attachment-tools', [
      {
        name: 'attachment_upload',
        description: 'Upload an attachment',
        parameters: {
          type: 'object',
          properties: { file: { type: 'string' }, name: { type: 'string' }, type: { type: 'string' } },
          required: ['file']
        }
      },
      {
        name: 'attachment_process',
        description: 'Process attachment for content extraction',
        parameters: {
          type: 'object',
          properties: { attachmentId: { type: 'string' }, operations: { type: 'array', items: { type: 'string' } } },
          required: ['attachmentId']
        }
      },
      {
        name: 'attachment_delete',
        description: 'Delete an attachment',
        parameters: {
          type: 'object',
          properties: { attachmentId: { type: 'string' } },
          required: ['attachmentId']
        }
      }
    ]);
  }
});

export default assistantAttachment;