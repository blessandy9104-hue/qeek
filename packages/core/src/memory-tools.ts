import type { Tool } from '@deepseek-ai/dsh-core';
import * as fs from 'fs/promises';
import * as path from 'path';

const VAULT_PATH = process.env.ZOVELI_VAULT_PATH || path.join(process.cwd(), 'knowledge-vault');

export const memoryTools: Tool[] = [
  {
    name: 'memory_create_note',
    description: 'Create a note in the knowledge vault (Obsidian-compatible)',
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
      const filename = sanitizeFilename(title) + '.md';
      const filepath = path.join(VAULT_PATH, filename);
      
      const frontmatter = [
        '---',
        `title: "${title}"`,
        `created: ${new Date().toISOString()}`,
        `tags: [${tags.map(t => `"${t}"`).join(', ')}]`,
        '---',
        ''
      ].join('\n');

      const linkSection = links.length > 0 
        ? '\n## Links\n' + links.map(l => `- [[${l}]]`).join('\n') 
        : '';

      const fullContent = frontmatter + content + linkSection;
      await fs.writeFile(filepath, fullContent, 'utf-8');
      return { success: true, path: filepath, title };
    }
  },
  {
    name: 'memory_search',
    description: 'Search the knowledge vault for notes',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Filter by tags' }
      },
      required: ['query']
    },
    async execute({ query, tags = [] }: { query: string; tags?: string[] }) {
      const files = await fs.readdir(VAULT_PATH);
      const results = [];

      for (const file of files) {
        if (!file.endsWith('.md')) continue;
        const filepath = path.join(VAULT_PATH, file);
        const content = await fs.readFile(filepath, 'utf-8');
        
        if (content.toLowerCase().includes(query.toLowerCase())) {
          if (tags.length === 0 || tags.some(t => content.includes(`"${t}"`))) {
            results.push({ file, content: content.substring(0, 500) });
          }
        }
      }
      return { results: results.slice(0, 10) };
    }
  },
  {
    name: 'memory_read_note',
    description: 'Read a specific note from the knowledge vault',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Note title or filename' }
      },
      required: ['title']
    },
    async execute({ title }: { title: string }) {
      const filename = title.endsWith('.md') ? title : sanitizeFilename(title) + '.md';
      const filepath = path.join(VAULT_PATH, filename);
      const content = await fs.readFile(filepath, 'utf-8');
      return { content };
    }
  },
  {
    name: 'memory_list_tags',
    description: 'List all tags used in the knowledge vault',
    parameters: { type: 'object', properties: {} },
    async execute() {
      const files = await fs.readdir(VAULT_PATH);
      const tagSet = new Set<string>();

      for (const file of files) {
        if (!file.endsWith('.md')) continue;
        const content = await fs.readFile(path.join(VAULT_PATH, file), 'utf-8');
        const matches = content.match(/tags:\s*\[([^\]]+)\]/);
        if (matches) {
          matches[1].split(',').forEach(t => tagSet.add(t.trim().replace(/"/g, '')));
        }
      }
      return { tags: Array.from(tagSet).sort() };
    }
  }
];

function sanitizeFilename(str: string): string {
  return str.replace(/[<>:"/\\|?*]/g, '_').trim();
}
