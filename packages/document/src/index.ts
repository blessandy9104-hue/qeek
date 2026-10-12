import { definePlugin } from '@deepseek-ai/dsh-core';

export const zoveliDocument = definePlugin({
  name: 'zoveli-document',
  description: 'Document processing and management',

  setup(ctx) {
    ctx.register('document-config', {
      supportedFormats: ['md', 'txt', 'pdf', 'docx', 'html', 'json', 'yaml', 'csv'],
      maxSize: 50 * 1024 * 1024,
      processing: {
        extractText: true,
        extractMetadata: true,
        generateEmbeddings: false,
        chunkSize: 1000,
        chunkOverlap: 200
      }
    });

    ctx.register('document-tools', [
      {
        name: 'document_read',
        description: 'Read and parse a document',
        parameters: {
          type: 'object',
          properties: { path: { type: 'string' }, format: { type: 'string' } },
          required: ['path']
        }
      },
      {
        name: 'document_search',
        description: 'Search within documents',
        parameters: {
          type: 'object',
          properties: { query: { type: 'string' }, paths: { type: 'array', items: { type: 'string' } }, limit: { type: 'number', default: 10 } },
          required: ['query']
        }
      },
      {
        name: 'document_summarize',
        description: 'Summarize a document',
        parameters: {
          type: 'object',
          properties: { path: { type: 'string' }, maxLength: { type: 'number', default: 500 } },
          required: ['path']
        }
      },
      {
        name: 'document_chunk',
        description: 'Split document into chunks',
        parameters: {
          type: 'object',
          properties: { path: { type: 'string' }, chunkSize: { type: 'number', default: 1000 }, overlap: { type: 'number', default: 200 } },
          required: ['path']
        }
      }
    ]);
  }
});

export default zoveliDocument;

