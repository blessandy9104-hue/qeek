export interface OsInfo {
  platform: NodeJS.Platform;
  arch: string;
  release: string;
  hostname: string;
  uptimeSec: number;
  user: string;
  shell: string;
}

export interface CpuInfo {
  model: string;
  cores: number;
  threads: number;
  speedMhz: number;
  /** 1-minute normalized load (0..N cpus) + per-core times when available. */
  loadAvg: number[];
  usagePercent: number | null;
}

export interface MemoryInfo {
  totalBytes: number;
  freeBytes: number;
  usedBytes: number;
  usedPercent: number;
  processRssBytes: number;
  processHeapUsedBytes: number;
}

export interface DiskInfo {
  path: string;
  totalBytes: number | null;
  freeBytes: number | null;
  usedPercent: number | null;
  available: boolean;
}

export interface GpuInfo {
  available: boolean;
  devices: { name: string; memoryTotalMb: number | null; driver: string | null }[];
  source: 'nvidia-smi' | 'wmic' | 'system-profiler' | 'none';
}

export interface BatteryInfo {
  available: boolean;
  charging: boolean | null;
  percent: number | null;
  source: 'wmic' | 'pmset' | 'sysfs' | 'none';
}

export interface NetworkInterfaceInfo {
  name: string;
  addresses: { address: string; family: string; internal: boolean }[];
}

export interface NetworkInfo {
  interfaces: NetworkInterfaceInfo[];
  /** Local-only: never performs external requests or DNS lookups. */
  externalProbe: false;
}

export interface ProcessInfo {
  pid: number;
  ppid: number;
  nodeVersion: string;
  execPath: string;
  argv: string[];
  cwd: string;
  uptimeSec: number;
  envKeys: string[];
}

export interface SystemSnapshot {
  collectedAt: Date;
  os: OsInfo;
  cpu: CpuInfo;
  memory: MemoryInfo;
  disk: DiskInfo;
  gpu: GpuInfo;
  battery: BatteryInfo;
  network: NetworkInfo;
  process: ProcessInfo;
}

export interface BudgetCheck {
  ok: boolean;
  reasons: string[];
  snapshot: Pick<SystemSnapshot, 'memory' | 'cpu' | 'disk'>;
}
