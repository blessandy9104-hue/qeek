import { definePlugin } from '@deepseek-ai/dsh-core';
import { getStore } from '@zoveli/memory-store';

const VAULT_PATH = process.env.ZOVELI_VAULT_PATH || './knowledge-vault';

export const zoveliMemory = definePlugin({
  name: 'zoveli-memory',
  description: 'Persistent memory via SQLite store (Markdown vault is export mirror)',

  setup(ctx) {
    ctx.register('memory-vault-path', VAULT_PATH);

    ctx.provide('memory', {
      async createNote(title: string, content: string, tags: string[] = [], links: string[] = []) {
        return getStore().createNote({ title, content, tags, links });
      },

      async searchNotes(query: string, tags: string[] = []) {
        const { results } = getStore().searchNotes({ query, tags, limit: 10 });
        return { results: results.map((r) => ({ file: r.title, preview: r.content })) };
      },

      async readNote(title: string) {
        const n = getStore().readNote(title);
        return { content: `# ${n.title}\n\n${n.body}` };
      },

      async listTags() {
        return getStore().listTags();
      },

      async updateNote(title: string, content?: string, tags?: string[], links?: string[], newTitle?: string) {
        return getStore().updateNote({ title, content, tags, links, newTitle });
      },

      async deleteNote(title: string) {
        return getStore().deleteNote(title);
      },
    });
  }
});

export default zoveliMemory;

