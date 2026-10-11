import { definePlugin } from '@deepseek-ai/dsh-core';

export const assistantSandbox = definePlugin({
  name: 'assistant-sandbox',
  description: 'Process sandboxing and isolation',

  setup(ctx) {
    ctx.register('sandbox-backends', {
      none: { name: 'No sandbox', isolate: false },
      local: { name: 'Local process isolation', isolate: true, type: 'local' },
      docker: { name: 'Docker container', isolate: true, type: 'docker', image: 'assistant-sandbox:latest' },
      firecracker: { name: 'Firecracker microVM', isolate: true, type: 'firecracker' },
      gvisor: { name: 'gVisor', isolate: true, type: 'gvisor' }
    });

    ctx.register('sandbox-policy', {
      defaultBackend: 'local',
      networkAccess: false,
      filesystemAccess: 'workspace-only',
      maxMemory: '2g',
      maxCpu: '2',
      maxProcesses: 100,
      timeout: 300000,
      allowNested: false
    });

    ctx.register('sandbox-profiles', {
      default: { backend: 'local', network: false, fs: 'workspace' },
      trusted: { backend: 'local', network: true, fs: 'full' },
      untrusted: { backend: 'docker', network: false, fs: 'none' },
      coding: { backend: 'docker', network: true, fs: 'workspace', image: 'assistant-coding:latest' }
    });
  }
});

export default assistantSandbox;