import { definePlugin } from '@deepseek-ai/dsh-core';

export const assistantTerminal = definePlugin({
  name: 'assistant-terminal',
  description: 'Persistent terminal sessions and PTY management',

  setup(ctx) {
    ctx.register('terminal-config', {
      shell: process.platform === 'win32' ? 'powershell.exe' : '/bin/bash',
      args: process.platform === 'win32' ? ['-NoProfile'] : [],
      env: { ...process.env, TERM: 'xterm-256color', COLORTERM: 'truecolor' },
      cwd: process.cwd(),
      cols: 120,
      rows: 40,
      cursorBlink: true,
      scrollback: 10000
    });

    ctx.register('terminal-sessions', {
      maxSessions: 10,
      persistOnClose: false,
      restoreOnStart: true,
      sessionTimeout: 3600000,
      namingPattern: 'terminal-{{index}}'
    });

    ctx.register('terminal-tools', [
      {
        name: 'terminal_create',
        description: 'Create a new terminal session',
        parameters: {
          type: 'object',
          properties: { name: { type: 'string' }, cwd: { type: 'string' }, env: { type: 'object' } }
        }
      },
      {
        name: 'terminal_write',
        description: 'Write to terminal',
        parameters: {
          type: 'object',
          properties: { sessionId: { type: 'string' }, data: { type: 'string' } },
          required: ['sessionId', 'data']
        }
      },
      {
        name: 'terminal_read',
        description: 'Read terminal output',
        parameters: {
          type: 'object',
          properties: { sessionId: { type: 'string' }, lines: { type: 'number', default: 100 } },
          required: ['sessionId']
        }
      },
      {
        name: 'terminal_resize',
        description: 'Resize terminal',
        parameters: {
          type: 'object',
          properties: { sessionId: { type: 'string' }, cols: { type: 'number' }, rows: { type: 'number' } },
          required: ['sessionId', 'cols', 'rows']
        }
      },
      {
        name: 'terminal_kill',
        description: 'Kill terminal session',
        parameters: {
          type: 'object',
          properties: { sessionId: { type: 'string' } },
          required: ['sessionId']
        }
      },
      {
        name: 'terminal_list',
        description: 'List terminal sessions',
        parameters: { type: 'object', properties: {} }
      }
    ]);
  }
});

export default assistantTerminal;