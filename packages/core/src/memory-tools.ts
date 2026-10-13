import type { Tool } from '@deepseek-ai/dsh-core';
import { getStore } from '@zoveli/memory-store';

export const memoryTools: Tool[] = [
  {
    name: 'memory_create_note',
    description: 'Create a note in the knowledge store (SQLite; mirrored to Markdown vault)',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Note title' },
        content: { type: 'string', description: 'Note content in Markdown' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Tags for organization' },
        links: { type: 'array', items: { type: 'string' }, description: 'Wiki-style links to other notes' }
      },
      required: ['title', 'content']
    },
    async execute({ title, content, tags = [], links = [] }: { title: string; content: string; tags?: string[]; links?: string[] }) {
      return getStore().createNote({ title, content, tags, links });
    }
  },
  {
    name: 'memory_search',
    description: 'Search the knowledge store (FTS5 ranked + tag filtering)',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Filter by tags' }
      },
      required: ['query']
    },
    async execute({ query, tags = [] }: { query: string; tags?: string[] }) {
      const { results } = getStore().searchNotes({ query, tags, limit: 10 });
      return { results: results.map((r) => ({ file: r.title, content: r.content })) };
    }
  },
  {
    name: 'memory_read_note',
    description: 'Read a specific note from the knowledge store',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Note title or filename' }
      },
      required: ['title']
    },
    async execute({ title }: { title: string }) {
      const n = getStore().readNote(title);
      return { content: `# ${n.title}\n\n${n.body}` };
    }
  },
  {
    name: 'memory_list_tags',
    description: 'List all tags used in the knowledge store',
    parameters: { type: 'object', properties: {} },
    async execute() {
      return getStore().listTags();
    }
  },
  {
    name: 'memory_update_note',
    description: 'Update a note (content/tags/links, optional rename via newTitle)',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        newTitle: { type: 'string' },
        content: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } },
        links: { type: 'array', items: { type: 'string' } }
      },
      required: ['title']
    },
    async execute(args: { title: string; newTitle?: string; content?: string; tags?: string[]; links?: string[] }) {
      return getStore().updateNote(args);
    }
  },
  {
    name: 'memory_delete_note',
    description: 'Delete a note from the knowledge store',
    parameters: {
      type: 'object',
      properties: { title: { type: 'string' } },
      required: ['title']
    },
    async execute({ title }: { title: string }) {
      return getStore().deleteNote(title);
    }
  }
];

