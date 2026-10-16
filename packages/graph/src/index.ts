import { definePlugin } from '@deepseek-ai/dsh-core';
import { getStore, resolveVaultPath } from '@zoveli/memory-store';

export const zoveliGraph = definePlugin({
  name: 'zoveli-graph',
  description: 'Build knowledge graph from store wiki-links',

  setup(ctx) {
    ctx.provide('graph', {
      build: async ({ vaultPath }: { vaultPath?: string } = {}) =>
        getStore(undefined, vaultPath ?? resolveVaultPath()).buildGraph(),
      toDot: (g: Parameters<ReturnType<typeof getStore>['toDot']>[0], vaultPath?: string) =>
        getStore(undefined, vaultPath ?? resolveVaultPath()).toDot(g),
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
        async execute({ format, vaultPath }: { vaultPath?: string; format?: 'json' | 'dot' } = {}) {
          const targetVault = vaultPath ?? resolveVaultPath();
          const store = getStore(undefined, targetVault);
          const g = store.buildGraph();
          if (format === 'dot') return { dot: store.toDot(g) };
          return g;
        },
      },
    ]);
  },
});

export default zoveliGraph;
