import { NodeSDK } from '@opentelemetry/sdk-node';
import { resourceFromAttributes, defaultResource } from '@opentelemetry/resources';
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
  ATTR_DEPLOYMENT_ENVIRONMENT_NAME,
} from '@opentelemetry/semantic-conventions';
import { PeriodicExportingMetricReader, type IMetricReader } from '@opentelemetry/sdk-metrics';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { GraphQLInstrumentation } from '@opentelemetry/instrumentation-graphql';
import { PinoInstrumentation } from '@opentelemetry/instrumentation-pino';
import * as os from 'os';

/**
 * Build a NodeSDK against the exact APIs of the installed OTel packages
 * (resources 2.x factory functions, sdk-node readers[]/spanProcessors[],
 * PrometheusExporter as its own MetricReader). Verified against
 * node_modules type declarations, not documentation.
 */
export function createTelemetrySDK(config: {
  serviceName: string;
  environment: string;
  prometheusPort?: number;
  otlpEndpoint?: string;
  logLevel?: string;
}) {
  const port = config.prometheusPort || 9464;
  const resource = defaultResource().merge(
    resourceFromAttributes({
      [ATTR_SERVICE_NAME]: config.serviceName,
      [ATTR_SERVICE_VERSION]: process.env.npm_package_version || '0.1.0',
      [ATTR_DEPLOYMENT_ENVIRONMENT_NAME]: config.environment,
      'host.hostname': os.hostname(),
    })
  );

  // PrometheusExporter IS a MetricReader (not a push exporter), so it goes
  // directly into metricReaders — wrapping it in PeriodicExportingMetricReader
  // is a type error (TS2741).
  const prometheusExporter = new PrometheusExporter({ port }, () =>
    console.log(`Prometheus metrics available at http://localhost:${port}/metrics`)
  );

  const metricReaders: IMetricReader[] = [prometheusExporter];
  if (config.otlpEndpoint) {
    metricReaders.push(
      new PeriodicExportingMetricReader({
        exporter: new OTLPMetricExporter({ url: `${config.otlpEndpoint}/v1/metrics` }),
        exportIntervalMillis: 10000,
      })
    );
  }

  const sdk = new NodeSDK({
    resource,
    metricReaders,
    ...(config.otlpEndpoint
      ? {
          spanProcessors: [
            new BatchSpanProcessor(
              new OTLPTraceExporter({ url: `${config.otlpEndpoint}/v1/traces` })
            ),
          ],
        }
      : {}),
    instrumentations: [
      new HttpInstrumentation(),
      new ExpressInstrumentation(),
      new GraphQLInstrumentation(),
      new PinoInstrumentation(),
    ],
  });

  return sdk;
}

export function createCustomMetrics(meter: any) {
  return {
    turnsTotal: meter.createCounter('zoveli_turns_total', {
      description: 'Total number of turns',
    }),
    toolsCalled: meter.createCounter('zoveli_tools_called', {
      description: 'Total number of tools called',
    }),
    mathVerified: meter.createCounter('zoveli_math_verified', {
      description: 'Total number of math computations verified',
    }),
    memoryOperations: meter.createCounter('zoveli_memory_operations', {
      description: 'Total number of memory operations',
    }),
    sessionDuration: meter.createHistogram('zoveli_session_duration', {
      description: 'Session duration in seconds',
      unit: 's',
    }),
    capabilityAvailable: meter.createUpDownCounter('zoveli_capabilities_available', {
      description: 'Number of available capabilities',
    }),
    capabilityDegraded: meter.createUpDownCounter('zoveli_capabilities_degraded', {
      description: 'Number of degraded capabilities',
    }),
    toolLatency: meter.createHistogram('zoveli_tool_latency', {
      description: 'Tool execution latency',
      unit: 'ms',
    }),
    llmTokensUsed: meter.createCounter('zoveli_llm_tokens_used', {
      description: 'Total LLM tokens used',
    }),
    errorsTotal: meter.createCounter('zoveli_errors_total', {
      description: 'Total number of errors',
    }),
  };
}

