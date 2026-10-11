# System & Hardware Awareness (`system.hardware`)

**Plugin:** `@qeek/qeek-sysinfo` · **Status:** beta · **Priority:** high

## What it does
Local-only host insight: OS, CPU, memory, disk, GPU, battery, network
interfaces, and process facts — plus budget checks before heavy work.

## Privacy
Every collector reads OS APIs, `/sys`, or on-device command output with
short timeouts. **No network requests, no DNS, no external probes** — safe
for air-gapped and regulated environments. `sysinfo_network` lists local
interfaces only (`externalProbe: false` by construction).

## Tools
| Tool | Purpose |
|------|---------|
| `sysinfo_snapshot` | Full snapshot (`diskPath?`, `fresh?`, 30s cache) |
| `sysinfo_cpu` / `sysinfo_memory` / `sysinfo_disk` | Focused readings |
| `sysinfo_gpu` | nvidia-smi → wmic → system_profiler (best effort) |
| `sysinfo_battery` | wmic → pmset → sysfs (desktops report unavailable) |
| `sysinfo_network` | Local interfaces only |
| `sysinfo_check` | Budget gate: `minFreeMemBytes?`, `minFreeDiskBytes?`, `maxCpuPercent?` |

## Semantics
- `available: false` means **unknown**, not zero (e.g. no GPU, desktop with
  no battery, disk stat unsupported).
- First `usagePercent` reading is `null` (needs two samples); callers
  should snapshot twice or accept the second reading.
- `sysinfo_check` without a prior snapshot reports `ok: false` with a
  reason telling the agent to snapshot first.

## Verification
```bash
pnpm vitest run tests/unit/sysinfo.test.ts
```
