import { definePlugin } from '@deepseek-ai/dsh-core';
import * as path from 'path';
import * as fs from 'fs/promises';
import { watch, type FSWatcher } from 'node:fs';

/**
 * zoveli-search: dependency-free full-text search for the knowledge vault.
 *
 * NOTE: an earlier revision depended on the `tantivy` npm package, but the
 * published `tantivy@0.1.0` neither satisfies the old `^0.20.0` range nor
 * exports the used API, so it could never install or typecheck. This
 * implementation keeps the same agent-facing contract (`vault_search`,
 * `search`/`reindex`/`indexNote`/`getStats`) with a small in-memory
 * term-frequency index over Markdown notes, refreshed via `node:fs` watcher
 * plus mtime checks and a periodic re-scan. A native engine (Tantivy via
 * WASM/FFI) remains a future upgrade path, not a hard dependency.
 */

interface SearchResult {
  id: string;
  title: string;
  path: string;
  content: string;
  tags: string[];
  links: string[];
  score: number;
  highlights: string[];
}

interface SearchOptions {
  query: string;
  tags?: string[];
  limit?: number;
  offset?: number;
  highlight?: boolean;
}

interface IndexedNote {
  id: string;
  title: string;
  body: string;
  tags: string[];
  links: string[];
  terms: Map<string, number>;
  mtimeMs: number;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9_#@+-]+/i)
    .map((t) => t.trim())
    .filter((t) => t.length > 1);
}

export const zoveliSearch = definePlugin({
  name: 'zoveli-search',
  description: 'Dependency-free full-text search for knowledge vault',

  async setup(ctx) {
    const vaultPath =
      process.env.ZOVELI_VAULT_PATH || path.join(process.cwd(), 'knowledge-vault');

    const notes = new Map<string, IndexedNote>();
    let isIndexing = false;
    let watcher: FSWatcher | null = null;

    function parseNote(content: string): { frontmatter: any; body: string } {
      const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
      if (!frontmatterMatch) return { frontmatter: {}, body: content };
      try {
        const frontmatter = parseYaml(frontmatterMatch[1]);
        const body = content.slice(frontmatterMatch[0].length).trim();
        return { frontmatter, body };
      } catch {
        return { frontmatter: {}, body: content };
      }
    }

    function parseYaml(yaml: string): any {
      const result: any = {};
      const lines = yaml.split('\n');
      let currentKey = '';
      let currentValue: string[] = [];
      let inArray = false;

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        if (trimmed.startsWith('- ')) {
          if (!inArray) {
            inArray = true;
            currentValue = [];
          }
          currentValue.push(trimmed.slice(2).trim());
        } else {
          if (inArray) {
            result[currentKey] = currentValue;
            inArray = false;
          }
          const colonIndex = trimmed.indexOf(':');
          if (colonIndex > 0) {
            currentKey = trimmed.slice(0, colonIndex).trim();
            const value = trimmed.slice(colonIndex + 1).trim();
            if (value.startsWith('[') && value.endsWith(']')) {
              result[currentKey] = value
                .slice(1, -1)
                .split(',')
                .map((v) => v.trim().replace(/"/g, ''));
            } else {
              result[currentKey] = value.replace(/"/g, '');
            }
          }
        }
      }
      if (inArray) result[currentKey] = currentValue;
      return result;
    }

    async function findMarkdownFiles(dir: string): Promise<string[]> {
      const files: string[] = [];
      async function walk(currentDir: string) {
        let entries;
        try {
          entries = await fs.readdir(currentDir, { withFileTypes: true });
        } catch {
          return;
        }
        for (const entry of entries) {
          const fullPath = path.join(currentDir, entry.name);
          if (entry.isDirectory() && !entry.name.startsWith('.')) {
            await walk(fullPath);
          } else if (entry.isFile() && entry.name.endsWith('.md')) {
            files.push(fullPath);
          }
        }
      }
      await walk(dir);
      return files;
    }

    async function indexNote(notePath: string): Promise<void> {
      try {
        const stat = await fs.stat(notePath);
        const cached = notes.get(notePath);
        if (cached && cached.mtimeMs === stat.mtimeMs) return;

        const content = await fs.readFile(notePath, 'utf-8');
        const { frontmatter, body } = parseNote(content);
        const title: string =
          frontmatter.title || path.basename(notePath, '.md');
        const tags: string[] = Array.isArray(frontmatter.tags)
          ? frontmatter.tags.map(String)
          : [];
        const links: string[] = Array.isArray(frontmatter.links)
          ? frontmatter.links.map(String)
          : [];

        const terms = new Map<string, number>();
        for (const t of tokenize(`${title} ${body} ${tags.join(' ')}`)) {
          terms.set(t, (terms.get(t) ?? 0) + 1);
        }
        // Title terms weigh 3x: store boosted counts for title tokens.
        for (const t of tokenize(title)) {
          terms.set(t, (terms.get(t) ?? 0) + 2);
        }

        notes.set(notePath, {
          id: notePath,
          title,
          body,
          tags,
          links,
          terms,
          mtimeMs: stat.mtimeMs,
        });
      } catch (error) {
        ctx.log?.error?.('[Search] Failed to index note:', notePath, error);
      }
    }

    async function reindexAll(): Promise<void> {
      if (isIndexing) return;
      isIndexing = true;
      try {
        const files = await findMarkdownFiles(vaultPath);
        const seen = new Set(files);
        for (const file of files) {
          await indexNote(file);
        }
        // Drop deleted notes (deleting during Map iteration is safe).
        for (const key of notes.keys()) {
          if (!seen.has(key)) notes.delete(key);
        }
      } finally {
        isIndexing = false;
      }
    }

    async function search(options: SearchOptions): Promise<SearchResult[]> {
      const { query, tags = [], limit = 10, offset = 0, highlight = true } = options;
      const terms = tokenize(query);
      if (terms.length === 0) return [];

      const scored: { note: IndexedNote; score: number }[] = [];
      for (const note of notes.values()) {
        if (tags.length > 0 && !tags.some((t) => note.tags.includes(t))) continue;
        let score = 0;
        for (const t of terms) {
          score += note.terms.get(t) ?? 0;
        }
        if (score > 0) scored.push({ note, score });
      }
      scored.sort((a, b) => b.score - a.score);

      return scored.slice(offset, offset + limit).map(({ note, score }) => {
        let highlights: string[] = [];
        if (highlight) {
          const sentences = note.body.split(/[.!?]+/);
          highlights = sentences
            .filter((s) => {
              const low = s.toLowerCase();
              return terms.some((t) => low.includes(t));
            })
            .slice(0, 3)
            .map((s) => s.trim())
            .filter(Boolean);
        }
        return {
          id: note.id,
          title: note.title,
          path: note.id,
          content: note.body.slice(0, 500),
          tags: note.tags,
          links: note.links,
          score,
          highlights,
        };
      });
    }

    function startWatcher(): void {
      try {
        watcher = watch(vaultPath, { recursive: true }, (_event, filename) => {
          if (!filename) {
            void reindexAll();
            return;
          }
          const full = path.join(vaultPath, filename.toString());
          if (full.endsWith('.md')) void indexNote(full);
        });
        // Never hold the process open for a background index watcher.
        try {
          (watcher as unknown as { unref?: () => void }).unref?.();
        } catch {
          // ignore
        }
        watcher.on('error', (err) => {
          ctx.log?.warn?.('[Search] watcher error, falling back to periodic scan:', err);
        });
      } catch (error) {
        ctx.log?.warn?.('[Search] watcher unavailable, using periodic scan:', error);
      }
      ctx.on('shutdown', () => {
        try {
          watcher?.close();
        } catch {
          // ignore
        }
      });
    }

    await reindexAll();
    startWatcher();

    const timer = setInterval(() => {
      void reindexAll();
    }, 5 * 60 * 1000); // Every 5 minutes
    if (typeof (timer as any)?.unref === 'function') (timer as any).unref();

    ctx.provide('search', {
      search,
      reindex: reindexAll,
      indexNote,
      getStats: () => ({
        indexedFiles: notes.size,
        backend: 'in-memory-tf',
        lastReindex: new Date(),
      }),
    });

    ctx.register('search-tools', [
      {
        name: 'vault_search',
        description: 'Full-text search the knowledge vault',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
            tags: { type: 'array', items: { type: 'string' }, description: 'Filter by tags' },
            limit: { type: 'number', default: 10 },
            offset: { type: 'number', default: 0 },
          },
          required: ['query'],
        },
        async execute({ query, tags, limit, offset }: any) {
          return search({ query, tags, limit, offset });
        },
      },
    ]);
  },
});

export default zoveliSearch;




