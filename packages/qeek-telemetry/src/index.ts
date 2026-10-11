import { definePlugin } from '@deepseek-ai/dsh-core';

/**
 * qeek-telemetry: lightweight wiring around the OpenTelemetry helpers in
 * ./opentelemetry.ts. Heavy OTel SDK packages are optional peer deps so the
 * plugin loads even when observability backends are absent.
 */
export const qeekTelemetry = definePlugin({
  name: 'qeek-telemetry',
  description: 'Prometheus metrics, OTLP traces, and custom qeek meters',

  setup(ctx) {
    const enabled = process.env.TELEMETRY_ENABLED === 'true';
    const serviceName = 'qeek';
    const environment = process.env.NODE_ENV || 'development';

    ctx.register('telemetry-config', {
      enabled,
      serviceName,
      environment,
      prometheusPort: parseInt(process.env.PROM_PORT || '9464', 10),
      otlpEndpoint: process.env.OTLP_ENDPOINT || '',
    });

    // In-memory counters (work without OTel SDK installed)
    const counters = new Map<string, number>();
    const histograms = new Map<string, number[]>();
    const inc = (name: string, value = 1, attrs?: Record<string, string>) => {
      const key = attrs ? `${name}{${Object.entries(attrs).map(([k, v]) => `${k}=${v}`).join(',')}}` : name;
      counters.set(key, (counters.get(key) ?? 0) + value);
    };
    const observe = (name: string, value: number) => {
      const arr = histograms.get(name) ?? [];
      arr.push(value);
      histograms.set(name, arr);
    };

    ctx.provide('telemetry', {
      inc,
      observe,
      count: (name: string) => counters.get(name) ?? 0,
      snapshot: () => ({
        counters: Object.fromEntries(counters),
        histograms: Object.fromEntries([...histograms].map(([k, v]) => [k, {
          count: v.length,
          p50: quantile(v, 0.5), p95: quantile(v, 0.95), max: v.length ? Math.max(...v) : 0,
        }])),
      }),
    });

    // Standard qeek meters used by Grafana dashboard
    ctx.on('turn/start', () => inc('qeek_turns_total'));
    ctx.on('tools/post-execute', () => inc('qeek_tools_called'));
    ctx.on('math/verified', () => inc('qeek_math_verified'));
    ctx.on('memory/write', () => inc('qeek_memory_operations'));

    ctx.register('telemetry-tools', [
      {
        name: 'telemetry_snapshot',
        description: 'Get current in-memory telemetry counters',
        parameters: { type: 'object', properties: {} },
        async execute() {
          return ctx.provide('telemetry').snapshot();
        },
      },
    ]);

    // Lazy OTel SDK init (only when enabled AND SDK installed)
    if (enabled) {
      void import('./opentelemetry.js')
        .then((m) => {
          const sdk = m.createTelemetrySDK({
            serviceName, environment,
            prometheusPort: parseInt(process.env.PROM_PORT || '9464', 10),
            otlpEndpoint: process.env.OTLP_ENDPOINT || undefined,
          });
          sdk.start();
          ctx.on('shutdown', () => sdk.shutdown());
        })
        .catch(() => {
          ctx.log?.warn?.('[telemetry] OTel SDK not installed; using in-memory meters only');
        });
    }
  },
});

function quantile(values: number[], q: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
}

export default qeekTelemetry;
export { createTelemetrySDK, createCustomMetrics } from './opentelemetry.js';
