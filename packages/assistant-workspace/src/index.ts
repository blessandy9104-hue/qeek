import { definePlugin } from '@deepseek-ai/dsh-core';
import * as path from 'path';
import * as os from 'os';

export const assistantWorkspace = definePlugin({
  name: 'assistant-workspace',
  description: 'Workspace management and project context',

  setup(ctx) {
    ctx.register('workspace-config', {
      root: process.cwd(),
      projects: [
        { name: 'Personal', path: process.cwd(), type: 'personal' },
        { name: 'Work', path: path.join(os.homedir(), 'work'), type: 'work' },
        { name: 'Learning', path: path.join(os.homedir(), 'learning'), type: 'learning' }
      ],
      autoDetect: true,
      watchForChanges: true
    });

    ctx.register('workspace-tools', [
      {
        name: 'workspace_list',
        description: 'List workspace projects',
        parameters: { type: 'object', properties: {} }
      },
      {
        name: 'workspace_switch',
        description: 'Switch active project',
        parameters: {
          type: 'object',
          properties: { project: { type: 'string' } },
          required: ['project']
        }
      },
      {
        name: 'workspace_scan',
        description: 'Scan project for context',
        parameters: {
          type: 'object',
          properties: { project: { type: 'string' }, depth: { type: 'number', default: 3 } },
          required: ['project']
        }
      },
      {
        name: 'workspace_create',
        description: 'Create new project',
        parameters: {
          type: 'object',
          properties: { name: { type: 'string' }, path: { type: 'string' }, type: { type: 'string' }, template: { type: 'string' } },
          required: ['name', 'path']
        }
      }
    ]);
  }
});

export default assistantWorkspace;