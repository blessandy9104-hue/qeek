import { definePlugin } from '@deepseek-ai/dsh-core';

export const zoveliComputerUse = definePlugin({
  name: 'zoveli-computer-use',
  description: 'Computer use automation (screen, keyboard, mouse)',

  setup(ctx) {
    ctx.register('computer-use-config', {
      backend: 'playwright',
      display: ':0',
      resolution: { width: 1920, height: 1080 },
      scale: 1.0,
      refreshRate: 60
    });

    ctx.register('computer-use-tools', [
      {
        name: 'computer_screenshot',
        description: 'Take a screenshot',
        parameters: {
          type: 'object',
          properties: {
            region: { type: 'object', properties: { x: { type: 'number' }, y: { type: 'number' }, width: { type: 'number' }, height: { type: 'number' } } },
            format: { type: 'string', enum: ['png', 'jpeg'], default: 'png' }
          }
        }
      },
      {
        name: 'computer_click',
        description: 'Click at coordinates',
        parameters: {
          type: 'object',
          properties: { x: { type: 'number' }, y: { type: 'number' }, button: { type: 'string', enum: ['left', 'right', 'middle'], default: 'left' }, clicks: { type: 'number', default: 1 } },
          required: ['x', 'y']
        }
      },
      {
        name: 'computer_type',
        description: 'Type text',
        parameters: {
          type: 'object',
          properties: { text: { type: 'string' }, delay: { type: 'number', default: 0 } },
          required: ['text']
        }
      },
      {
        name: 'computer_key',
        description: 'Press key combination',
        parameters: {
          type: 'object',
          properties: { keys: { type: 'array', items: { type: 'string' } } },
          required: ['keys']
        }
      },
      {
        name: 'computer_scroll',
        description: 'Scroll at coordinates',
        parameters: {
          type: 'object',
          properties: { x: { type: 'number' }, y: { type: 'number' }, deltaX: { type: 'number' }, deltaY: { type: 'number' } },
          required: ['x', 'y', 'deltaY']
        }
      },
      {
        name: 'computer_drag',
        description: 'Drag from one point to another',
        parameters: {
          type: 'object',
          properties: { startX: { type: 'number' }, startY: { type: 'number' }, endX: { type: 'number' }, endY: { type: 'number' } },
          required: ['startX', 'startY', 'endX', 'endY']
        }
      }
    ]);

    ctx.register('computer-use-policy', {
      requireConfirmation: true,
      allowedApplications: ['*'],
      blockedApplications: [],
      maxActionsPerTurn: 20,
      sensitiveRegions: []
    });
  }
});

export default zoveliComputerUse;

