import * as os from 'node:os';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type {
  OsInfo, CpuInfo, MemoryInfo, DiskInfo, GpuInfo,
  BatteryInfo, NetworkInfo, ProcessInfo, SystemSnapshot,
} from './types.js';

const execFileAsync = promisify(execFile);

async function tryExec(
  cmd: string,
  args: string[],
  timeoutMs = 8000
): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync(cmd, args, { timeout: timeoutMs });
    return stdout;
  } catch {
    return null;
  }
}

export function collectOs(): OsInfo {
  let user = 'unknown';
  try {
    user = os.userInfo().username;
  } catch {
    // locked-down environments may deny user lookup
  }
  return {
    platform: os.platform(),
    arch: os.arch(),
    release: os.release(),
    hostname: os.hostname(),
    uptimeSec: Math.floor(os.uptime()),
    user,
    shell: process.env.SHELL || process.env.COMSPEC || 'unknown',
  };
}

let lastCpuSample: { idle: number; total: number; at: number } | null = null;

export function collectCpu(): CpuInfo {
  const cpus = os.cpus();
  const first = cpus[0];
  let idle = 0;
  let total = 0;
  for (const c of cpus) {
    idle += c.times.idle;
    total += c.times.user + c.times.nice + c.times.sys + c.times.idle + c.times.irq;
  }
  let usagePercent: number | null = null;
  const now = Date.now();
  if (lastCpuSample && now > lastCpuSample.at) {
    const idleDelta = idle - lastCpuSample.idle;
    const totalDelta = total - lastCpuSample.total;
    if (totalDelta > 0) {
      usagePercent = Math.round((1 - idleDelta / totalDelta) * 1000) / 10;
    }
  }
  lastCpuSample = { idle, total, at: now };
  return {
    model: (first?.model ?? 'unknown').trim(),
    cores: cpus.length,
    threads: cpus.length,
    speedMhz: first?.speed ?? 0,
    loadAvg: os.loadavg(),
    usagePercent,
  };
}

export function collectMemory(): MemoryInfo {
  const total = os.totalmem();
  const free = os.freemem();
  const used = total - free;
  const mem = process.memoryUsage();
  return {
    totalBytes: total,
    freeBytes: free,
    usedBytes: used,
    usedPercent: total > 0 ? Math.round((used / total) * 1000) / 10 : 0,
    processRssBytes: mem.rss,
    processHeapUsedBytes: mem.heapUsed,
  };
}

export function collectDisk(targetPath?: string): DiskInfo {
  const probePath = targetPath || process.cwd();
  try {
    // statfsSync is available on Node 19+ including Windows drive paths.
    const st = fs.statfsSync(probePath);
    const total = st.bsize * st.blocks;
    const free = st.bsize * st.bfree;
    return {
      path: path.resolve(probePath),
      totalBytes: total,
      freeBytes: free,
      usedPercent:
        total > 0 ? Math.round(((total - free) / total) * 1000) / 10 : null,
      available: true,
    };
  } catch {
    return {
      path: path.resolve(probePath),
      totalBytes: null,
      freeBytes: null,
      usedPercent: null,
      available: false,
    };
  }
}

export async function collectGpu(): Promise<GpuInfo> {
  // NVIDIA first (Windows + Linux).
  const nvidia = await tryExec('nvidia-smi', [
    '--query-gpu=name,memory.total,driver_version',
    '--format=csv,noheader',
  ]);
  if (nvidia?.trim()) {
    const devices = nvidia
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((line) => {
        const [name = 'unknown', mem = '', driver = ''] = line
          .split(',')
          .map((s) => s.trim());
        const memMb = /(\d+)\s*MiB/i.test(mem)
          ? parseInt(mem.match(/(\d+)\s*MiB/i)?.[1] ?? '', 10)
          : null;
        return {
          name,
          memoryTotalMb: Number.isNaN(memMb as number) ? null : (memMb as number | null),
          driver: driver || null,
        };
      });
    if (devices.length > 0) {
      return { available: true, devices, source: 'nvidia-smi' };
    }
  }

  if (os.platform() === 'win32') {
    const wmic = await tryExec('wmic', [
      'path',
      'win32_VideoController',
      'get',
      'name,AdapterRAM,DriverVersion',
      '/format:csv',
    ]);
    if (wmic?.trim()) {
      const devices = wmic
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l && !/^Node,/i.test(l))
        .map((line) => {
          const parts = line.split(',');
          const name = (parts[2] ?? parts[1] ?? 'unknown').trim() || 'unknown';
          return { name, memoryTotalMb: null, driver: null };
        });
      if (devices.length > 0) {
        return { available: true, devices, source: 'wmic' };
      }
    }
  }

  if (os.platform() === 'darwin') {
    const sp = await tryExec('system_profiler', ['SPDisplaysDataType']);
    if (sp) {
      const names = [...sp.matchAll(/Chipset Model:\s*(.+)/g)].map((m) =>
        m[1].trim()
      );
      if (names.length > 0) {
        return {
          available: true,
          devices: names.map((name) => ({
            name,
            memoryTotalMb: null,
            driver: null,
          })),
          source: 'system-profiler',
        };
      }
    }
  }

  return { available: false, devices: [], source: 'none' };
}

export async function collectBattery(): Promise<BatteryInfo> {
  const platform = os.platform();

  if (platform === 'win32') {
    const out = await tryExec('wmic', [
      'Path',
      'Win32_Battery',
      'Get',
      'EstimatedChargeRemaining,BatteryStatus',
      '/format:csv',
    ]);
    const row = out
      ?.split('\n')
      .map((l) => l.trim())
      .find((l) => l && !/^Node,/i.test(l));
    if (row) {
      const parts = row.split(',');
      const status = parseInt(parts[1] ?? '', 10);
      const percent = parseInt(parts[2] ?? '', 10);
      if (!Number.isNaN(percent)) {
        return {
          available: true,
          // Win32_Battery BatteryStatus 2 == charging (among others)
          charging: status === 2 ? true : status === 1 ? false : null,
          percent,
          source: 'wmic',
        };
      }
    }
    return { available: false, charging: null, percent: null, source: 'none' };
  }

  if (platform === 'darwin') {
    const out = await tryExec('pmset', ['-g', 'batt']);
    const m = out?.match(/(\d+)%.*(charging|discharging|charged)/i);
    if (m) {
      return {
        available: true,
        percent: parseInt(m[1], 10),
        charging: /charging/i.test(m[2]) && !/discharging/i.test(m[2]),
        source: 'pmset',
      };
    }
    return { available: false, charging: null, percent: null, source: 'none' };
  }

  // Linux sysfs.
  try {
    const base = '/sys/class/power_supply';
    const entries = fs.readdirSync(base).filter((e) => e.startsWith('BAT'));
    if (entries.length > 0) {
      const cap = fs
        .readFileSync(path.join(base, entries[0], 'capacity'), 'utf-8')
        .trim();
      const status = fs
        .readFileSync(path.join(base, entries[0], 'status'), 'utf-8')
        .trim()
        .toLowerCase();
      const percent = parseInt(cap, 10);
      if (!Number.isNaN(percent)) {
        return {
          available: true,
          percent,
          charging: status === 'charging',
          source: 'sysfs',
        };
      }
    }
  } catch {
    // no battery interface (desktop / container)
  }
  return { available: false, charging: null, percent: null, source: 'none' };
}

export function collectNetwork(): NetworkInfo {
  const raw = os.networkInterfaces();
  const interfaces = Object.entries(raw).map(([name, addrs]) => ({
    name,
    addresses: (addrs ?? [])
      .filter((a) => a.family === 'IPv4' || a.family === 'IPv6')
      .map((a) => ({
        address: a.address,
        family: String(a.family),
        internal: a.internal,
      })),
  }));
  return { interfaces, externalProbe: false as const };
}

export function collectProcess(): ProcessInfo {
  return {
    pid: process.pid,
    ppid: process.ppid ?? 0,
    nodeVersion: process.version,
    execPath: process.execPath,
    argv: process.argv.slice(0, 10),
    cwd: process.cwd(),
    uptimeSec: Math.floor(process.uptime()),
    envKeys: Object.keys(process.env).sort(),
  };
}

export async function collectSnapshot(diskPath?: string): Promise<SystemSnapshot> {
  const [gpu, battery] = await Promise.all([collectGpu(), collectBattery()]);
  return {
    collectedAt: new Date(),
    os: collectOs(),
    cpu: collectCpu(),
    memory: collectMemory(),
    disk: collectDisk(diskPath),
    gpu,
    battery,
    network: collectNetwork(),
    process: collectProcess(),
  };
}
