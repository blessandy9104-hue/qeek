import { definePlugin } from '@deepseek-ai/dsh-core';

export const zoveliShell = definePlugin({
  name: 'zoveli-shell',
  description: 'Shell execution with subprocess management',

  setup(ctx) {
    ctx.register('shell-config', {
      defaultShell: process.platform === 'win32' ? 'powershell.exe' : '/bin/bash',
      shellArgs: process.platform === 'win32' ? ['-NoProfile', '-Command'] : ['-c'],
      env: { ...process.env, TERM: 'xterm-256color' },
      cwd: process.cwd(),
      timeout: 120000,
      maxBuffer: 10 * 1024 * 1024,
      allowBackground: true
    });

    ctx.register('shell-policy', {
      allowCommands: ['*'],
      denyCommands: ['rm -rf /', 'format', 'fdisk', 'dd if=', 'shutdown', 'reboot'],
      requireConfirmation: ['sudo', 'su', 'chmod 777', 'chown -R', 'docker run --privileged'],
      logAllCommands: true,
      maxConcurrent: 5
    });

    // Terminal sessions
    ctx.register('terminal-sessions', {
      maxSessions: 10,
      sessionTimeout: 3600000,
      shell: process.platform === 'win32' ? 'powershell.exe' : '/bin/bash'
    });
  }
});

export default zoveliShell;

