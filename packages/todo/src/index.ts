import { definePlugin } from '@deepseek-ai/dsh-core';

export const zoveliTodo = definePlugin({
  name: 'zoveli-todo',
  description: 'Todo list management for agents',

  setup(ctx) {
    ctx.register('todo-config', {
      persistence: 'session',
      vaultSync: true,
      vaultPath: 'todos/',
      categories: ['personal', 'work', 'learning', 'project', 'errand'],
      priorities: ['low', 'medium', 'high', 'urgent'],
      defaultPriority: 'medium'
    });

    ctx.register('todo-tools', [
      {
        name: 'todo_add',
        description: 'Add a todo item',
        parameters: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            description: { type: 'string' },
            category: { type: 'string' },
            priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
            dueDate: { type: 'string' },
            tags: { type: 'array', items: { type: 'string' } }
          },
          required: ['title']
        }
      },
      {
        name: 'todo_update',
        description: 'Update a todo item',
        parameters: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            title: { type: 'string' },
            status: { type: 'string', enum: ['pending', 'in_progress', 'completed', 'cancelled'] },
            priority: { type: 'string' }
          },
          required: ['id']
        }
      },
      {
        name: 'todo_list',
        description: 'List todo items',
        parameters: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            category: { type: 'string' },
            priority: { type: 'string' }
          }
        }
      },
      {
        name: 'todo_delete',
        description: 'Delete a todo item',
        parameters: {
          type: 'object',
          properties: { id: { type: 'string' } },
          required: ['id']
        }
      }
    ]);
  }
});

export default zoveliTodo;

