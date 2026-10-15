import { definePlugin } from '@deepseek-ai/dsh-core';

export type GuardPolicyName = 'strict' | 'balanced' | 'permissive';
export type GuardAction = 'deny' | 'warn' | 'confirm';

export interface GuardRule {
  id: string;
  pattern: string;
  action: GuardAction;
  reason: string;
  maxPerTurn?: number;
}

export const GUARD_RULES: GuardRule[] = [
  { id: 'no-destructive', pattern: 'rm -rf|format|fdisk|dd if=', action: 'deny', reason: 'Destructive command' },
  { id: 'no-secrets', pattern: 'password|secret|token|key', action: 'warn', reason: 'Potential secret exposure' },
  { id: 'confirm-external', pattern: 'https?://', action: 'confirm', reason: 'External network access' },
  { id: 'limit-shell', pattern: 'shell_exec', action: 'confirm', maxPerTurn: 5, reason: 'Shell command limit' },
];

/** True when a shell command matches a deny rule (destructive patterns). */
export function isCommandDenied(command: string): GuardRule | null {
  const deny = GUARD_RULES.filter((r) => r.action === 'deny');
  for (const rule of deny) {
    if (new RegExp(rule.pattern).test(command)) return rule;
  }
  return null;
}

export interface GuardVerdict {
  allowed: boolean;
  rule?: GuardRule;
  message?: string;
}

/**
 * Evaluate a tool call against the guard policy. Pure: no I/O, no UX.
 * - `permissive` allows everything (explicit opt-out).
 * - `deny` rules on `shell_exec` match against the command string.
 * - `warn`/`confirm` never block here (confirm needs a human surface).
 */
export function checkToolCall(
  toolName: string,
  args: unknown,
  policy: GuardPolicyName = 'balanced'
): GuardVerdict {
  if (policy === 'permissive') return { allowed: true };
  if (toolName === 'shell_exec') {
    const command = typeof args === 'object' && args !== null
      ? String((args as Record<string, unknown>).command ?? '')
      : String(args ?? '');
    const hit = isCommandDenied(command);
    if (hit) {
      return { allowed: false, rule: hit, message: `blocked by guard (${hit.id}): ${hit.reason}` };
    }
  }
  return { allowed: true };
}

export function defaultPolicy(registered: unknown): GuardPolicyName {
  if (
    typeof registered === 'object' && registered !== null &&
    typeof (registered as Record<string, unknown>).default === 'string'
  ) {
    const name = (registered as Record<string, string>).default;
    if (name === 'strict' || name === 'balanced' || name === 'permissive') return name;
  }
  return 'balanced';
}

export const zoveliGuard = definePlugin({
  name: 'zoveli-guard',
  description: 'Approval policies and guardrails',

  setup(ctx) {
    const policies: { default: GuardPolicyName; policies: Record<string, unknown> } = {
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
    };
    ctx.register('guard-policies', policies);

    ctx.register('guard-rules', GUARD_RULES);

    ctx.register('guard-tools', [
      {
        name: 'guard_set_policy',
        description: 'Set approval policy (strict|balanced|permissive); takes effect immediately for later tool calls',
        parameters: {
          type: 'object',
          properties: { policy: { type: 'string', enum: ['strict', 'balanced', 'permissive'] } },
          required: ['policy']
        },
        async execute({ policy }: { policy: string }) {
          if (policy !== 'strict' && policy !== 'balanced' && policy !== 'permissive') {
            throw new Error(`unknown policy: ${policy}`);
          }
          policies.default = policy;
          return { ok: true, policy };
        },
      }
    ]);
  }
});

export default zoveliGuard;
