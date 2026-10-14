import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync, mkdirSync, statSync, existsSync } from 'node:fs';
import { MemoryStore, resetStoreForTests } from '../../packages/memory-store/src/store';
import { zoveliMemoryStore } from '../../packages/memory-store/src/index';
import { zoveliMemory } from '../../packages/memory/src/index';
import { zoveliSearch } from '../../packages/search/src/index';
import { zoveliGraph } from '../../packages/graph/src/index';
import { memoryTools } from '../../packages/core/src/memory-tools';
import { createMockContext } from '../setup';

let dirCounter = 0;
function freshDb(): { db: string; vault: string } {
  dirCounter += 1;
  const base = join(tmpdir(), `zoveli-memstore-${process.pid}-${dirCounter}`);
  mkdirSync(base, { recursive: true });
  return { db: join(base, 'memory.db'), vault: join(base, 'vault') };
}

describe('memory-store (SQLite FTS5)', () => {
  let paths: { db: string; vault: string };
  let store: MemoryStore;
  let prevDb: string | undefined;
  let prevVault: string | undefined;
  let prevExport: string | undefined;

  beforeEach(() => {
    prevDb = process.env.ZOVELI_MEMORY_DB;
    prevVault = process.env.ZOVELI_VAULT_PATH;
    prevExport = process.env.ZOVELI_MEMORY_EXPORT;
    paths = freshDb();
    process.env.ZOVELI_MEMORY_DB = paths.db;
    process.env.ZOVELI_VAULT_PATH = paths.vault;
    process.env.ZOVELI_MEMORY_EXPORT = '0';
    resetStoreForTests();
    store = new MemoryStore(paths.db, paths.vault);
  });

  afterEach(() => {
    try { store.close(); } catch {}
    resetStoreForTests();
    if (prevDb === undefined) delete process.env.ZOVELI_MEMORY_DB;
    else process.env.ZOVELI_MEMORY_DB = prevDb;
    if (prevVault === undefined) delete process.env.ZOVELI_VAULT_PATH;
    else process.env.ZOVELI_VAULT_PATH = prevVault;
    if (prevExport === undefined) delete process.env.ZOVELI_MEMORY_EXPORT;
    else process.env.ZOVELI_MEMORY_EXPORT = prevExport;
    try { rmSync(paths.db, { force: true }); } catch {}
    try { rmSync(paths.vault, { recursive: true, force: true }); } catch {}
  });

  it('creates, reads, updates, deletes (new update/delete vs old vault)', () => {
    store.createNote({ title: 'Alpha', content: 'hello world', tags: ['fact'], links: [] });
    const n = store.readNote('Alpha');
    expect(n.body).toContain('hello world');
    expect(n.tags).toContain('fact');

    store.updateNote({ title: 'Alpha', content: 'hello updated world' });
    expect(store.readNote('Alpha').body).toContain('updated');

    store.deleteNote('Alpha');
    expect(() => store.readNote('Alpha')).toThrow();
  });

  it('searches ranked with tag filter + pagination', () => {
    store.createNote({ title: 'N1', content: 'the quick brown fox jumps', tags: ['project'] });
    store.createNote({ title: 'N2', content: 'completely unrelated thermodynamics', tags: ['reference'] });
    const { results } = store.searchNotes({ query: 'quick brown fox', limit: 10 });
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].title).toBe('N1');

    const filtered = store.searchNotes({ query: 'thermodynamics', tags: ['reference'] });
    expect(filtered.results.map((r) => r.title)).toContain('N2');
    const excluded = store.searchNotes({ query: 'thermodynamics', tags: ['project'] });
    expect(excluded.results.map((r) => r.title)).not.toContain('N2');
  });

  it('builds graph with orphans/hubs/dot', () => {
    store.createNote({ title: 'A', content: 'see [[B]]', tags: [] });
    store.createNote({ title: 'B', content: 'hub', tags: [] });
    store.createNote({ title: 'Lonely', content: 'nothing', tags: [] });
    const g = store.buildGraph();
    expect(g.edges).toContainEqual({ from: 'A', to: 'B' });
    expect(g.orphans).toContain('Lonely');
    expect(g.hubs[0].id).toBeDefined();
    expect(store.toDot(g)).toContain('digraph vault');
  });

  it('lists tags sorted', () => {
    store.createNote({ title: 'T1', content: 'x', tags: ['zebra', 'apple'] });
    expect(store.listTags().tags).toEqual(['apple', 'zebra']);
  });

  it('locks the DB file down to the owner', () => {
    expect(existsSync(paths.db)).toBe(true);
    // chmod is best-effort on Windows ACLs; POSIX must be owner-only.
    if (process.platform !== 'win32') {
      expect(statSync(paths.db).mode & 0o777).toBe(0o600);
    }
  });
});

describe('memory-store plugin contract (tool names preserved)', () => {
  it('registers memory_* + vault_* tools', () => {
    const ctx = createMockContext();
    zoveliMemoryStore.setup(ctx);
    const tools = ctx.register.mock.calls.find((c) => c[0] === 'memory-store-tools')?.[1] as any[];
    expect(tools).toBeDefined();
    for (const name of ['memory_create_note', 'memory_search', 'memory_read_note', 'memory_list_tags', 'memory_update_note', 'memory_delete_note', 'vault_search', 'vault_graph']) {
      expect(tools.some((t) => t.name === name)).toBe(true);
    }
  });

  it('delegates: memory/search/graph + core tools use the store', async () => {
    process.env.ZOVELI_MEMORY_DB = ':memory:';
    process.env.ZOVELI_MEMORY_EXPORT = '0';
    resetStoreForTests();
    const ctx = createMockContext();
    zoveliMemory.setup(ctx);
    zoveliSearch.setup(ctx as any);
    zoveliGraph.setup(ctx);
    // provide() shape preserved
    expect(ctx.provide).toHaveBeenCalledWith('memory', expect.any(Object));
    expect(ctx.provide).toHaveBeenCalledWith('search', expect.any(Object));
    expect(ctx.provide).toHaveBeenCalledWith('graph', expect.any(Object));
    // core tool names preserved
    expect(memoryTools.some((t) => t.name === 'memory_create_note')).toBe(true);
    expect(memoryTools.some((t) => t.name === 'memory_update_note')).toBe(true);
    expect(memoryTools.some((t) => t.name === 'memory_delete_note')).toBe(true);
    resetStoreForTests();
    delete process.env.ZOVELI_MEMORY_DB;
  });
});
