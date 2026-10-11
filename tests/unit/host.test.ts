import { describe, it, expect } from 'vitest';
import { QeekHost } from '../../packages/qeek-host/src/host';
import { chatConfigFromEnv } from '../../packages/qeek-host/src/chat';

function fakePlugin(name: string, tools: any[] = []) {
  return {
    name,
    description: `fake ${name}`,
    setup(ctx: any) {
      ctx.register(`${name}-tools`, tools);
    },
  };
}

describe('QeekHost', () => {
  it('mounts plugins and collects their tools', () => {
    const host = new QeekHost();
    host.mount([
      fakePlugin('a', [
        { name: 'alpha', description: 'a', execute: async () => 'A' },
      ]),
      fakePlugin('b', [
        { name: 'beta', description: 'b', execute: async (args: any) => `B:${args.x}` },
      ]),
    ]);
    const names = host.tools().map((t) => t.name);
    expect(names).toContain('alpha');
    expect(names).toContain('beta');
  });

  it('dedupes tools by name (first wins)', () => {
    const host = new QeekHost();
    host.mount([
      fakePlugin('a', [{ name: 'dup', description: 'first', execute: async () => 1 }]),
      fakePlugin('b', [{ name: 'dup', description: 'second', execute: async () => 2 }]),
    ]);
    expect(host.tools().filter((t) => t.name === 'dup')).toHaveLength(1);
  });

  it('dispatches tool calls with args', async () => {
    const host = new QeekHost();
    host.mount([
      fakePlugin('a', [{ name: 'echo', description: 'e', execute: async (args: any) => args.msg }]),
    ]);
    await expect(host.runTool('echo', { msg: 'hi' })).resolves.toBe('hi');
  });

  it('rejects unknown tools with a clear error', async () => {
    const host = new QeekHost();
    host.mount([]);
    await expect(host.runTool('nope', {})).rejects.toThrow('unknown tool: nope');
  });

  it('fires agent/created handlers with an injectable agent', () => {
    const host = new QeekHost();
    const seen: string[] = [];
    host.mount([
      {
        name: 'injector',
        setup(ctx: any) {
          ctx.on('agent/created', (agent: any) => {
            agent.inject({ type: 'system', content: 'hello-agent' });
            seen.push('fired');
          });
        },
      },
    ]);
    expect(seen).toEqual(['fired']);
  });
});

describe('chatConfigFromEnv', () => {
  it('returns null without a key and config with one', () => {
    const prev = process.env.DEEPSEEK_API_KEY;
    delete process.env.DEEPSEEK_API_KEY;
    expect(chatConfigFromEnv()).toBeNull();
    process.env.DEEPSEEK_API_KEY = 'test-key';
    const cfg = chatConfigFromEnv();
    expect(cfg?.model).toBe('deepseek-chat');
    expect(cfg?.baseUrl).toBe('https://api.deepseek.com');
    if (prev === undefined) delete process.env.DEEPSEEK_API_KEY;
    else process.env.DEEPSEEK_API_KEY = prev;
  });
});
