import { describe, it, expect, vi, beforeEach } from 'vitest';
import { assistantCore } from '../../packages/assistant-core/src/index';
import { assistantMath } from '../../packages/assistant-math/src/index';
import { assistantMemory } from '../../packages/assistant-memory/src/index';
import { assistantSkills } from '../../packages/assistant-skills/src/index';
import { createMockContext } from '../setup';

describe('qeek-core', () => {
  it('should register core plugins', () => {
    const ctx = createMockContext();
    assistantCore.setup(ctx);
    
    expect(ctx.register).toHaveBeenCalledWith('assistant-prompt', expect.any(Object));
    expect(ctx.register).toHaveBeenCalledWith('assistant-math-tools', expect.any(Array));
    expect(ctx.register).toHaveBeenCalledWith('assistant-memory-tools', expect.any(Array));
  });

  it('should have system prompt with math rules', () => {
    const ctx = createMockContext();
    assistantCore.setup(ctx);
    
    const promptCall = ctx.register.mock.calls.find(c => c[0] === 'assistant-prompt');
    expect(promptCall).toBeDefined();
    expect(promptCall[1].sections).toBeDefined();
    expect(promptCall[1].sections.some((s: any) => s.id === 'math-rules')).toBe(true);
  });

  it('should have math tools', () => {
    const ctx = createMockContext();
    assistantCore.setup(ctx);
    
    const toolsCall = ctx.register.mock.calls.find(c => c[0] === 'assistant-math-tools');
    expect(toolsCall).toBeDefined();
    expect(Array.isArray(toolsCall[1])).toBe(true);
    expect(toolsCall[1].some((t: any) => t.name === 'mathcore_compute')).toBe(true);
    expect(toolsCall[1].some((t: any) => t.name === 'mathcore_check_answer')).toBe(true);
  });

  it('should have memory tools', () => {
    const ctx = createMockContext();
    assistantCore.setup(ctx);
    
    const toolsCall = ctx.register.mock.calls.find(c => c[0] === 'assistant-memory-tools');
    expect(toolsCall).toBeDefined();
    expect(toolsCall[1].some((t: any) => t.name === 'memory_create_note')).toBe(true);
    expect(toolsCall[1].some((t: any) => t.name === 'memory_search')).toBe(true);
  });
});

describe('qeek-math', () => {
  it('should register mathcore MCP client', () => {
    const ctx = createMockContext();
    assistantMath.setup(ctx);
    
    const mcpCall = ctx.register.mock.calls.find(c => c[0] === 'mathcore-mcp-client');
    expect(mcpCall).toBeDefined();
    expect(mcpCall[1].config.command).toBe('mathcore-mcp');
  });

  it('should inject math rules on agent creation', () => {
    const ctx = createMockContext();
    assistantMath.setup(ctx);
    
    const agentCreatedHandler = ctx.on.mock.calls.find(c => c[0] === 'agent/created');
    expect(agentCreatedHandler).toBeDefined();
    
    const mockAgent = { inject: vi.fn() };
    agentCreatedHandler[1](mockAgent);
    
    expect(mockAgent.inject).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'system',
        content: expect.stringContaining('MATH RULES')
      })
    );
  });
});

describe('qeek-memory', () => {
  it('should provide memory service', () => {
    const ctx = createMockContext();
    assistantMemory.setup(ctx);
    
    expect(ctx.provide).toHaveBeenCalledWith('memory', expect.objectContaining({
      createNote: expect.any(Function),
      searchNotes: expect.any(Function),
      readNote: expect.any(Function),
      listTags: expect.any(Function)
    }));
  });

  it('should register vault path', () => {
    const ctx = createMockContext();
    assistantMemory.setup(ctx);
    
    const vaultCall = ctx.register.mock.calls.find(c => c[0] === 'memory-vault-path');
    expect(vaultCall).toBeDefined();
  });
});

describe('qeek-skills', () => {
  it('should register built-in skills', () => {
    const ctx = createMockContext();
    assistantSkills.setup(ctx);
    
    expect(ctx.register).toHaveBeenCalledWith('skill-daily-briefing', expect.any(Object));
    expect(ctx.register).toHaveBeenCalledWith('skill-research', expect.any(Object));
    expect(ctx.register).toHaveBeenCalledWith('skill-task-planning', expect.any(Object));
    expect(ctx.register).toHaveBeenCalledWith('skill-code-review', expect.any(Object));
  });

  it('should have daily briefing skill', () => {
    const ctx = createMockContext();
    assistantSkills.setup(ctx);
    
    const skillCall = ctx.register.mock.calls.find(c => c[0] === 'skill-daily-briefing');
    expect(skillCall).toBeDefined();
    expect(skillCall[1].name).toBe('daily-briefing');
    expect(skillCall[1].execute).toBeDefined();
  });
});