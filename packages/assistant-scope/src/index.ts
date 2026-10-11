import { definePlugin } from '@deepseek-ai/dsh-core';

export const assistantScope = definePlugin({
  name: 'assistant-scope',
  description: 'Per-agent scoped registration primitive',

  setup(ctx) {
    ctx.register('scope-config', {
      isolation: 'strict',
      inheritParent: true,
      maxDepth: 10,
      cleanupOnUnload: true
    });

    // Scope is a library - provides utilities for other plugins
    ctx.provide('scope', {
      createScope: (parent: any, name: any) => ({
        parent,
        name,
        registrations: new Map(),
        register: (key: any, value: any) => { /* scope registration */ },
        unregister: (key: any) => { /* scope unregistration */ },
        get: (key: any) => { /* scope get */ },
        has: (key: any) => { /* scope has */ }
      }),
      getCurrentScope: () => { /* get current scope */ },
      runInScope: (scope: any, fn: any) => { /* run function in scope */ }
    });
  }
});

export default assistantScope;