import { describe, it, expect } from 'vitest';
import { qeekCodeAnalysis } from '../../packages/qeek-code-analysis/src/index';
import { qeekDocgen } from '../../packages/qeek-docgen/src/index';
import { qeekHealth } from '../../packages/qeek-health/src/index';
import { qeekGraph } from '../../packages/qeek-graph/src/index';
import { qeekScheduler } from '../../packages/qeek-scheduler/src/index';
import { qeekSecscan } from '../../packages/qeek-secscan/src/index';
import { qeekTelemetry } from '../../packages/qeek-telemetry/src/index';
import { createMockContext } from '../setup';

function setup(plugin: any) {
  const ctx = createMockContext();
  plugin.setup(ctx);
  return ctx;
}

describe('qeek own capabilities register', () => {
  it('code-analysis registers code_review tool', () => {
    const ctx = setup(qeekCodeAnalysis);
    const call = ctx.register.mock.calls.find((c: any[]) => c[0] === 'code-analysis-tools');
    expect(call).toBeDefined();
    expect(call[1][0].name).toBe('code_review');
  });

  it('docgen registers docs_generate tool', () => {
    const ctx = setup(qeekDocgen);
    const call = ctx.register.mock.calls.find((c: any[]) => c[0] === 'docgen-tools');
    expect(call).toBeDefined();
  });

  it('health registers project_health tool', () => {
    const ctx = setup(qeekHealth);
    const call = ctx.register.mock.calls.find((c: any[]) => c[0] === 'health-tools');
    expect(call).toBeDefined();
  });

  it('graph registers vault_graph tool', () => {
    const ctx = setup(qeekGraph);
    const call = ctx.register.mock.calls.find((c: any[]) => c[0] === 'graph-tools');
    expect(call).toBeDefined();
  });

  it('scheduler registers tasks_schedule tool', () => {
    const ctx = setup(qeekScheduler);
    const call = ctx.register.mock.calls.find((c: any[]) => c[0] === 'scheduler-tools');
    expect(call).toBeDefined();
  });

  it('secscan registers security_scan tool', () => {
    const ctx = setup(qeekSecscan);
    const call = ctx.register.mock.calls.find((c: any[]) => c[0] === 'secscan-tools');
    expect(call).toBeDefined();
  });

  it('telemetry provides snapshot api', () => {
    const ctx = setup(qeekTelemetry);
    expect(ctx.provide).toHaveBeenCalledWith('telemetry', expect.any(Object));
    expect(ctx.register).toHaveBeenCalledWith('telemetry-config', expect.any(Object));
  });
});
