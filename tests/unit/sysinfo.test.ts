import { describe, it, expect } from 'vitest';
import { zoveliSysinfo } from '../../packages/sysinfo/src/index';
import {
  collectOs, collectCpu, collectMemory, collectDisk,
  collectGpu, collectBattery, collectNetwork, collectProcess,
  collectSnapshot,
} from '../../packages/sysinfo/src/collectors';
import { createMockContext } from '../setup';

describe('zoveli sysinfo plugin', () => {
  it('registers sysinfo tools', () => {
    const ctx = createMockContext();
    zoveliSysinfo.setup(ctx);
    const call = ctx.register.mock.calls.find((c: any[]) => c[0] === 'sysinfo-tools');
    expect(call).toBeDefined();
    const names = call[1].map((t: any) => t.name);
    expect(names).toContain('sysinfo_snapshot');
    expect(names).toContain('sysinfo_check');
    expect(names).toContain('sysinfo_gpu');
    expect(names).toContain('sysinfo_battery');
  });

  it('provides sysinfo api', () => {
    const ctx = createMockContext();
    zoveliSysinfo.setup(ctx);
    expect(ctx.provide).toHaveBeenCalledWith('sysinfo', expect.any(Object));
  });
});

describe('collectors (local-only, never throw)', () => {
  it('collects OS facts', () => {
    const os = collectOs();
    expect(os.platform).toBeTruthy();
    expect(os.arch).toBeTruthy();
    expect(os.uptimeSec).toBeGreaterThanOrEqual(0);
  });

  it('collects CPU facts', () => {
    const cpu = collectCpu();
    expect(cpu.cores).toBeGreaterThan(0);
    expect(Array.isArray(cpu.loadAvg)).toBe(true);
  });

  it('collects memory facts with consistent math', () => {
    const mem = collectMemory();
    expect(mem.totalBytes).toBeGreaterThan(0);
    expect(mem.usedBytes).toBe(mem.totalBytes - mem.freeBytes);
    expect(mem.usedPercent).toBeGreaterThanOrEqual(0);
  });

  it('collects disk facts without throwing', () => {
    const disk = collectDisk(process.cwd());
    expect(typeof disk.available).toBe('boolean');
    if (disk.available) {
      expect(disk.totalBytes).toBeGreaterThan(0);
    }
  });

  it('collects GPU facts without throwing', async () => {
    const gpu = await collectGpu();
    expect(typeof gpu.available).toBe('boolean');
    expect(Array.isArray(gpu.devices)).toBe(true);
  });

  it('collects battery facts without throwing', async () => {
    const batt = await collectBattery();
    expect(typeof batt.available).toBe('boolean');
    if (batt.available) {
      expect(batt.percent).toBeGreaterThanOrEqual(0);
    }
  });

  it('collects network interfaces without external probes', () => {
    const net = collectNetwork();
    expect(net.externalProbe).toBe(false);
    expect(Array.isArray(net.interfaces)).toBe(true);
  });

  it('collects process facts', () => {
    const proc = collectProcess();
    expect(proc.pid).toBeGreaterThan(0);
    expect(proc.nodeVersion).toMatch(/^v/);
  });

  it('builds a full snapshot', async () => {
    const snap = await collectSnapshot();
    expect(snap.os).toBeDefined();
    expect(snap.cpu).toBeDefined();
    expect(snap.memory).toBeDefined();
    expect(snap.disk).toBeDefined();
    expect(snap.process).toBeDefined();
    expect(snap.collectedAt instanceof Date).toBe(true);
  });
});


