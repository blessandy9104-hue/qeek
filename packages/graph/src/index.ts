import { definePlugin } from '@deepseek-ai/dsh-core';
import { getStore } from '@zoveli/memory-store';

export const zoveliGraph = definePlugin({
  name: 'zoveli-graph',
  description: 'Build knowledge graph from store wiki-links',

  setup(ctx) {
    ctx.provide('graph', {
      build: async () => getStore().buildGraph(),
      toDot: (g: Parameters<ReturnType<typeof getStore>['toDot']>[0]) => getStore().toDot(g),
    });

    ctx.register('graph-tools', [
      {
        name: 'vault_graph',
        description: 'Build knowledge graph of store wiki-links (nodes, edges, orphans, hubs)',
        parameters: {
          type: 'object',
          properties: {
            vaultPath: { type: 'string' },
            format: { type: 'string', enum: ['json', 'dot'] },
          },
        },
        async execute({ format }: { vaultPath?: string; format?: 'json' | 'dot' }) {
          const g = getStore().buildGraph();
          if (format === 'dot') return { dot: getStore().toDot(g) };
          return g;
        },
      },
    ]);
  },
});

export default zoveliGraph;

