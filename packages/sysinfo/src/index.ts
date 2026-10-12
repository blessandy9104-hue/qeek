import { definePlugin } from '@deepseek-ai/dsh-core';
import {
  collectSnapshot, collectCpu, collectMemory, collectDisk,
  collectGpu, collectBattery, collectNetwork, collectOs,
} from './collectors.js';
import type { SystemSnapshot, BudgetCheck } from './types.js';

/**
 * zoveli-sysinfo: system and hardware awareness.
 *
 * Strictly local: every collector reads OS APIs, /sys, or on-device
 * command output with short timeouts. No network requests, no DNS, no
 * external probes — safe for air-gapped and regulated environments.
 */
export const zoveliSysinfo = definePlugin({
  name: 'zoveli-sysinfo',
  description: 'Local system and hardware awareness (OS, CPU, memory, disk, GPU, battery, network, process)',

  setup(ctx) {
    let cached: { at: number; snapshot: SystemSnapshot } | null = null;
    const TTL_MS = 30_000;

    async function snapshot(diskPath?: string, fresh = false): Promise<SystemSnapshot> {
      const now = Date.now();
      if (!fresh && cached && now - cached.at < TTL_MS && !diskPath) {
        return cached.snapshot;
      }
      const snap = await collectSnapshot(diskPath);
      if (!diskPath) cached = { at: now, snapshot: snap };
      return snap;
    }

    function checkBudget(input: {
      minFreeMemBytes?: number;
      minFreeDiskBytes?: number;
      maxCpuPercent?: number;
      snapshot?: SystemSnapshot;
    }): BudgetCheck {
      const snap = input.snapshot ?? cached?.snapshot;
      const reasons: string[] = [];
      if (!snap) {
        return {
          ok: false,
          reasons: ['no snapshot available yet — call sysinfo_snapshot first'],
          snapshot: {
            memory: collectMemory(),
            cpu: collectCpu(),
            disk: collectDisk(),
          },
        };
      }
      if (
        input.minFreeMemBytes !== undefined &&
        snap.memory.freeBytes < input.minFreeMemBytes
      ) {
        reasons.push(
          `free memory ${snap.memory.freeBytes}B < required ${input.minFreeMemBytes}B`
        );
      }
      if (
        input.minFreeDiskBytes !== undefined &&
        (snap.disk.freeBytes === null || snap.disk.freeBytes < input.minFreeDiskBytes)
      ) {
        reasons.push(
          `free disk ${snap.disk.freeBytes ?? 'unknown'}B < required ${input.minFreeDiskBytes}B`
        );
      }
      if (
        input.maxCpuPercent !== undefined &&
        snap.cpu.usagePercent !== null &&
        snap.cpu.usagePercent > input.maxCpuPercent
      ) {
        reasons.push(
          `cpu usage ${snap.cpu.usagePercent}% > limit ${input.maxCpuPercent}%`
        );
      }
      return {
        ok: reasons.length === 0,
        reasons,
        snapshot: { memory: snap.memory, cpu: snap.cpu, disk: snap.disk },
      };
    }

    ctx.provide('sysinfo', { snapshot, checkBudget });

    ctx.register('sysinfo-tools', [
      {
        name: 'sysinfo_snapshot',
        description: 'Full local system snapshot (OS, CPU, memory, disk, GPU, battery, network, process)',
        parameters: {
          type: 'object',
          properties: {
            diskPath: { type: 'string', description: 'Path whose filesystem to measure' },
            fresh: { type: 'boolean', description: 'Bypass 30s cache', default: false },
          },
        },
        async execute({ diskPath, fresh }: any) {
          return snapshot(diskPath, fresh);
        },
      },
      {
        name: 'sysinfo_cpu',
        description: 'CPU model, cores, load average, and usage percent',
        parameters: { type: 'object', properties: {} },
        async execute() {
          return collectCpu();
        },
      },
      {
        name: 'sysinfo_memory',
        description: 'System and process memory usage',
        parameters: { type: 'object', properties: {} },
        async execute() {
          return collectMemory();
        },
      },
      {
        name: 'sysinfo_disk',
        description: 'Disk total/free for a path (defaults to working directory)',
        parameters: {
          type: 'object',
          properties: { path: { type: 'string' } },
        },
        async execute({ path: p }: any) {
          return collectDisk(p);
        },
      },
      {
        name: 'sysinfo_gpu',
        description: 'GPU devices via nvidia-smi / wmic / system_profiler (best effort)',
        parameters: { type: 'object', properties: {} },
        async execute() {
          return collectGpu();
        },
      },
      {
        name: 'sysinfo_battery',
        description: 'Battery charge and charging state (best effort; desktops report unavailable)',
        parameters: { type: 'object', properties: {} },
        async execute() {
          return collectBattery();
        },
      },
      {
        name: 'sysinfo_network',
        description: 'Local network interfaces only — never probes externally',
        parameters: { type: 'object', properties: {} },
        async execute() {
          return { ...collectNetwork(), os: collectOs().hostname };
        },
      },
      {
        name: 'sysinfo_check',
        description: 'Check resource budget before heavy work (memory/disk/CPU thresholds)',
        parameters: {
          type: 'object',
          properties: {
            minFreeMemBytes: { type: 'number' },
            minFreeDiskBytes: { type: 'number' },
            maxCpuPercent: { type: 'number' },
          },
        },
        async execute(args: any) {
          return checkBudget(args ?? {});
        },
      },
    ]);

    ctx.on('agent/created', (agent: any) => {
      agent.inject({
        type: 'system',
        content: `SYSTEM AWARENESS: Use sysinfo_snapshot for host facts (OS/arch/CPU/RAM/disk/GPU/battery). ` +
          `Use sysinfo_check with thresholds before heavy jobs (model downloads, builds, video renders). ` +
          `All collectors are local-only — no network calls. GPU/battery may report unavailable on machines without them; treat unavailable as unknown, not zero.`,
      });
    });
  },
});

export default zoveliSysinfo;
export type { SystemSnapshot, BudgetCheck } from './types.js';



