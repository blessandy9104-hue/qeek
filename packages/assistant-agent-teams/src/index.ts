import { definePlugin } from '@deepseek-ai/dsh-core';

export const assistantAgentTeams = definePlugin({
  name: 'assistant-agent-teams',
  description: 'Multi-agent coordination and teams',

  setup(ctx) {
    ctx.register('team-config', {
      maxTeams: 5,
      maxAgentsPerTeam: 10,
      coordination: 'centralized',
      communication: 'mailbox',
      persistence: 'session'
    });

    ctx.register('team-roles', {
      coordinator: { name: 'Coordinator', permissions: ['assign', 'monitor', 'aggregate'] },
      researcher: { name: 'Researcher', permissions: ['search', 'read', 'summarize'] },
      coder: { name: 'Coder', permissions: ['write', 'execute', 'debug'] },
      reviewer: { name: 'Reviewer', permissions: ['read', 'comment', 'approve'] },
      specialist: { name: 'Specialist', permissions: ['custom'] }
    });

    ctx.register('team-tools', [
      {
        name: 'team_create',
        description: 'Create an agent team',
        parameters: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            objective: { type: 'string' },
            roles: { type: 'array', items: { type: 'object', properties: { role: { type: 'string' }, count: { type: 'number' }, config: { type: 'object' } } } }
          },
          required: ['name', 'objective', 'roles']
        }
      },
      {
        name: 'team_assign',
        description: 'Assign task to team',
        parameters: {
          type: 'object',
          properties: { teamId: { type: 'string' }, task: { type: 'string' }, assignee: { type: 'string' } },
          required: ['teamId', 'task']
        }
      },
      {
        name: 'team_status',
        description: 'Get team status',
        parameters: { type: 'object', properties: { teamId: { type: 'string' } } }
      }
    ]);
  }
});

export default assistantAgentTeams;