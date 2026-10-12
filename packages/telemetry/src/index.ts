import { definePlugin } from '@deepseek-ai/dsh-core';

export const zoveliTelemetry = definePlugin({
  name: 'zoveli-telemetry',
  description: 'Telemetry and observability',

  setup(ctx) {
    ctx.register('telemetry-config', {
      enabled: process.env.TELEMETRY_ENABLED === 'true',
      sampleRate: 0.1,
      endpoints: {
        metrics: 'http://localhost:9090/metrics',
        traces: 'http://localhost:4318/v1/traces',
        logs: 'http://localhost:4318/v1/logs'
      },
      serviceName: 'personal-assistant',
      environment: process.env.NODE_ENV || 'development'
    });

    ctx.register('telemetry-instrumentation', {
      http: true,
      grpc: false,
      db: false,
      fs: true,
      shell: true,
      llm: true,
      tools: true,
      agent: true
    });

    ctx.register('telemetry-attributes', {
      'assistant.version': '0.1.0',
      'assistant.profile': process.env.ZOVELI_PROFILE || 'personal-assistant',
      'user.id': process.env.USER_ID || 'anonymous'
    });

    // Custom metrics
    ctx.register('custom-metrics', [
      { name: 'assistant.turns_total', type: 'counter', description: 'Total turns' },
      { name: 'assistant.tools_called', type: 'counter', description: 'Tools called' },
      { name: 'assistant.math_verified', type: 'counter', description: 'Math verified' },
      { name: 'assistant.memory_operations', type: 'counter', description: 'Memory ops' },
      { name: 'assistant.session_duration', type: 'histogram', description: 'Session duration' }
    ]);
  }
});

export default zoveliTelemetry;


