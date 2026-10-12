import { definePlugin } from '@deepseek-ai/dsh-core';
import * as fs from 'fs/promises';
import * as path from 'path';

const VAULT_PATH = process.env.ZOVELI_VAULT_PATH || './knowledge-vault';

export const zoveliMemory = definePlugin({
  name: 'zoveli-memory',
  description: 'Persistent memory via Obsidian-compatible vault',

  setup(ctx) {
    ctx.register('memory-vault-path', VAULT_PATH);

    ctx.provide('memory', {
      async createNote(title: string, content: string, tags: string[] = [], links: string[] = []) {
        const fs = await import('fs/promises');
        const path = await import('path');
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

        await fs.writeFile(filepath, frontmatter + content + linkSection, 'utf-8');
        return { success: true, path: filepath };
      },

      async searchNotes(query: string, tags: string[] = []) {
        const fs = await import('fs/promises');
        const files = await fs.readdir(VAULT_PATH);
        const results = [];

        for (const file of files) {
          if (!file.endsWith('.md')) continue;
          const content = await fs.readFile(path.join(VAULT_PATH, file), 'utf-8');
          if (content.toLowerCase().includes(query.toLowerCase())) {
            if (tags.length === 0 || tags.some(t => content.includes(`"${t}"`))) {
              results.push({ file, preview: content.substring(0, 500) });
            }
          }
        }
        return { results: results.slice(0, 10) };
      },

      async readNote(title: string) {
        const fs = await import('fs/promises');
        const path = await import('path');
        const filename = title.endsWith('.md') ? title : sanitizeFilename(title) + '.md';
        const content = await fs.readFile(path.join(VAULT_PATH, filename), 'utf-8');
        return { content };
      },

      async listTags() {
        const fs = await import('fs/promises');
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
    });
  }
});

function sanitizeFilename(str: string): string {
  return str.replace(/[<>:"/\\|?*]/g, '_').trim();
}

export default zoveliMemory;


