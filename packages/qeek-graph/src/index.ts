import { definePlugin } from '@deepseek-ai/dsh-core';
import * as fs from 'fs/promises';
import * as path from 'path';

interface GraphNode { id: string; title: string; tags: string[]; }
interface GraphEdge { from: string; to: string; }
interface VaultGraph { nodes: GraphNode[]; edges: GraphEdge[]; orphans: string[]; hubs: { id: string; degree: number }[]; }

export const qeekGraph = definePlugin({
  name: 'qeek-graph',
  description: 'Build vault knowledge graph from wiki-links',

  setup(ctx) {
    async function build(vaultPath: string): Promise<VaultGraph> {
      const root = vaultPath || process.env.ASSISTANT_VAULT_PATH || path.join(process.cwd(), 'knowledge-vault');
      const files = await findMarkdown(root);
      const nodes: GraphNode[] = [];
      const edges: GraphEdge[] = [];
      const linkRe = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;

      for (const f of files) {
        const id = path.basename(f, '.md');
        const content = await fs.readFile(f, 'utf-8');
        const tags = [...content.matchAll(/#([\w-]+)/g)].map((m) => m[1]).slice(0, 20);
        // title: first H1 or filename
        const h1 = content.match(/^#\s+(.+)$/m);
        nodes.push({ id, title: h1?.[1]?.trim() ?? id, tags });
        let m: RegExpExecArray | null;
        while ((m = linkRe.exec(content)) !== null) {
          const target = m[1].trim();
          if (target && target !== id) edges.push({ from: id, to: target });
        }
      }

      const degree = new Map<string, number>();
      for (const e of edges) {
        degree.set(e.from, (degree.get(e.from) ?? 0) + 1);
        degree.set(e.to, (degree.get(e.to) ?? 0) + 1);
      }
      const linked = new Set([...edges.map((e) => e.from), ...edges.map((e) => e.to)]);
      const orphans = nodes.map((n) => n.id).filter((id) => !linked.has(id));
      const hubs = [...degree.entries()]
        .map(([id, d]) => ({ id, degree: d }))
        .sort((a, b) => b.degree - a.degree)
        .slice(0, 10);

      return { nodes, edges, orphans, hubs };
    }

    async function findMarkdown(dir: string): Promise<string[]> {
      const out: string[] = [];
      async function walk(d: string) {
        let entries;
        try { entries = await fs.readdir(d, { withFileTypes: true }); } catch { return; }
        for (const e of entries) {
          if (e.name.startsWith('.')) continue;
          const full = path.join(d, e.name);
          if (e.isDirectory()) await walk(full);
          else if (e.name.endsWith('.md')) out.push(full);
        }
      }
      await walk(dir);
      return out;
    }

    function toDot(graph: VaultGraph): string {
      const lines = ['digraph vault {', '  rankdir=LR;', '  node [shape=box, style=rounded];'];
      for (const n of graph.nodes) lines.push(`  "${n.id}" [label="${n.title.replace(/"/g, "'")}"];`);
      for (const e of graph.edges) lines.push(`  "${e.from}" -> "${e.to}";`);
      lines.push('}');
      return lines.join('\n');
    }

    ctx.provide('graph', { build, toDot });

    ctx.register('graph-tools', [
      {
        name: 'vault_graph',
        description: 'Build knowledge graph of vault wiki-links (nodes, edges, orphans, hubs)',
        parameters: {
          type: 'object',
          properties: {
            vaultPath: { type: 'string' },
            format: { type: 'string', enum: ['json', 'dot'] },
          },
        },
        async execute({ vaultPath, format }: { vaultPath?: string; format?: 'json' | 'dot' }) {
          const g = await build(vaultPath || '');
          if (format === 'dot') return { dot: toDot(g) };
          return g;
        },
      },
    ]);
  },
});

export default qeekGraph;
