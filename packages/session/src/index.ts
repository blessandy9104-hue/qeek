import { definePlugin } from '@deepseek-ai/dsh-core';
import * as path from 'path';
import * as os from 'os';

export const zoveliSession = definePlugin({
  name: 'zoveli-session',
  description: 'Session persistence with JSONL format and projections',

  setup(ctx) {
    const sessionDir = path.join(os.homedir(), '.personal-assistant', 'sessions');

    ctx.register('session-persistence-config', {
      provider: 'fs',
      directory: sessionDir,
      format: 'jsonl',
      compression: 'zstd',
      migration: true,
      maxGenerations: 10
    });

    // Session projections for UI
    ctx.register('session-projections', {
      turnBoundary: true,
      messageList: true,
      toolCallSummary: true,
      tokenUsage: true
    });

    // Event handlers
    ctx.on('session/event', (event) => {
      // Index events for search
    });

    ctx.on('session/created', (session) => {
      // Initialize session with vault context
    });
  }
});

export default zoveliSession;

