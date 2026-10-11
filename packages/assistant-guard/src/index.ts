import { definePlugin } from '@deepseek-ai/dsh-core';

export const assistantGuard = definePlugin({
  name: 'assistant-guard',
  description: 'Approval policies and guardrails',

  setup(ctx) {
    ctx.register('guard-policies', {
      default: 'balanced',
      policies: {
        strict: {
          tools: { fs_write: true, shell_exec: true, browser_navigate: true, computer_click: true },
          mcp: { all: true },
          subagents: { spawn: true },
          network: { all: true },
          files: { outsideWorkspace: true }
        },
        balanced: {
          tools: { fs_write: false, shell_exec: true, browser_navigate: false, computer_click: true },
          mcp: { all: false },
          subagents: { spawn: false },
          network: { all: false },
          files: { outsideWorkspace: false }
        },
        permissive: {
          tools: { fs_write: false, shell_exec: false, browser_navigate: false, computer_click: false },
          mcp: { all: false },
          subagents: { spawn: false },
          network: { all: false },
          files: { outsideWorkspace: false }
        }
      }
    });

    ctx.register('guard-rules', [
      { id: 'no-destructive', pattern: 'rm -rf|format|fdisk|dd if=', action: 'deny', reason: 'Destructive command' },
      { id: 'no-secrets', pattern: 'password|secret|token|key', action: 'warn', reason: 'Potential secret exposure' },
      { id: 'confirm-external', pattern: 'https?://', action: 'confirm', reason: 'External network access' },
      { id: 'limit-shell', pattern: 'shell_exec', action: 'confirm', maxPerTurn: 5, reason: 'Shell command limit' }
    ]);

    ctx.register('guard-tools', [
      {
        name: 'guard_set_policy',
        description: 'Set approval policy',
        parameters: {
          type: 'object',
          properties: { policy: { type: 'string', enum: ['strict', 'balanced', 'permissive'] } },
          required: ['policy']
        }
      }
    ]);
  }
});

export default assistantGuard;