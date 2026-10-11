import { definePlugin } from '@deepseek-ai/dsh-core';
import { randomUUID as uuidv4 } from 'node:crypto';

interface LoggedEvent {
  id: string;
  timestamp: Date;
  correlationId: string;
  event: string;
  plugin: string;
  phase: 'enter' | 'exit' | 'error';
  duration?: number;
  input?: any;
  output?: any;
  error?: any;
}

export const qeekEventLogger = definePlugin({
  name: 'qeek-event-logger',
  description: 'Captures all Cordis events for debugging and visualization',

  setup(ctx) {
    const events: LoggedEvent[] = [];
    const maxEvents = 10000;
    const correlationMap = new Map<string, string>();

    // Generate correlation ID for new requests
    function getCorrelationId(event: string, input: any): string {
      if (event.startsWith('turn/') || event.startsWith('agent/')) {
        return input?.correlationId || uuidv4();
      }
      return correlationMap.get(event) || uuidv4();
    }

    // Wrap event emission to capture enter/exit
    const baseEmit = ctx.emit;
    const originalEmit =
      typeof baseEmit === 'function' ? baseEmit.bind(ctx) : (_event: string, ..._args: any[]) => undefined;
    ctx.emit = function(event: string, ...args: any[]) {
      const correlationId = getCorrelationId(event, args[0]);
      correlationMap.set(event, correlationId);

      const eventId = uuidv4();
      const startTime = Date.now();

      // Log enter
      const enterLog: LoggedEvent = {
        id: eventId,
        timestamp: new Date(),
        correlationId,
        event,
        plugin: ctx.plugin?.name || 'unknown',
        phase: 'enter',
        input: args[0]
      };
      events.push(enterLog);
      if (events.length > maxEvents) events.shift();

      try {
        const result = originalEmit(event, ...args);
        
        // Log exit
        const exitLog: LoggedEvent = {
          id: uuidv4(),
          timestamp: new Date(),
          correlationId,
          event,
          plugin: ctx.plugin?.name || 'unknown',
          phase: 'exit',
          duration: Date.now() - startTime,
          output: result
        };
        events.push(exitLog);
        if (events.length > maxEvents) events.shift();

        return result;
      } catch (error) {
        // Log error
        const errorLog: LoggedEvent = {
          id: uuidv4(),
          timestamp: new Date(),
          correlationId,
          event,
          plugin: ctx.plugin?.name || 'unknown',
          phase: 'error',
          duration: Date.now() - startTime,
          error: error instanceof Error ? error.message : String(error)
        };
        events.push(errorLog);
        if (events.length > maxEvents) events.shift();
        throw error;
      }
    };

    // Query API
    ctx.provide('eventLogger', {
      getEvents: (filter?: {
        correlationId?: string;
        event?: string;
        plugin?: string;
        phase?: 'enter' | 'exit' | 'error';
        since?: Date;
        limit?: number;
      }) => {
        let filtered = events;
        if (filter) {
          if (filter.correlationId) filtered = filtered.filter(e => e.correlationId === filter.correlationId);
          if (filter.event) filtered = filtered.filter(e => e.event === filter.event);
          if (filter.plugin) filtered = filtered.filter(e => e.plugin === filter.plugin);
          if (filter.phase) filtered = filtered.filter(e => e.phase === filter.phase);
          if (filter.since) filtered = filtered.filter(e => e.timestamp >= filter.since!);
        }
        return filtered.slice(-(filter?.limit || 1000));
      },

      getCorrelationTrace: (correlationId: string) => {
        return events
          .filter(e => e.correlationId === correlationId)
          .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      },

      getStats: () => {
        const byEvent: Record<string, number> = {};
        const byPlugin: Record<string, number> = {};
        const byPhase: Record<string, number> = {};
        let totalDuration = 0;
        let errorCount = 0;

        for (const e of events) {
          byEvent[e.event] = (byEvent[e.event] || 0) + 1;
          byPlugin[e.plugin] = (byPlugin[e.plugin] || 0) + 1;
          byPhase[e.phase] = (byPhase[e.phase] || 0) + 1;
          if (e.duration) totalDuration += e.duration;
          if (e.phase === 'error') errorCount++;
        }

        return {
          totalEvents: events.length,
          byEvent,
          byPlugin,
          byPhase,
          avgDuration: events.filter(e => e.duration).length > 0 
            ? totalDuration / events.filter(e => e.duration).length 
            : 0,
          errorCount,
          errorRate: events.length > 0 ? errorCount / events.length : 0
        };
      },

      clear: () => {
        events.length = 0;
        correlationMap.clear();
      },

      export: (format: 'json' | 'csv' = 'json') => {
        if (format === 'json') return JSON.stringify(events, null, 2);
        // CSV export
        const headers = ['id', 'timestamp', 'correlationId', 'event', 'plugin', 'phase', 'duration', 'error'];
        const rows = events.map(e => [
          e.id, e.timestamp.toISOString(), e.correlationId, e.event, e.plugin, e.phase, 
          e.duration?.toString() || '', e.error?.message || ''
        ]);
        return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      }
    });

    // Web UI endpoint (if web profile)
    ctx.on('web/routes', (routes: any[]) => {
      routes.push(
        {
          method: 'GET',
          path: '/debug/events',
          handler: async (req: any, res: any) => {
            const filter = {
              correlationId: req.query.correlationId,
              event: req.query.event,
              plugin: req.query.plugin,
              phase: req.query.phase,
              since: req.query.since ? new Date(req.query.since) : undefined,
              limit: parseInt(req.query.limit || '1000')
            };
            res.json(ctx.provide('eventLogger').getEvents(filter));
          }
        },
        {
          method: 'GET',
          path: '/debug/events/stats',
          handler: async (req: any, res: any) => {
            res.json(ctx.provide('eventLogger').getStats());
          }
        },
        {
          method: 'GET',
          path: '/debug/events/trace/:correlationId',
          handler: async (req: any, res: any) => {
            res.json(ctx.provide('eventLogger').getCorrelationTrace(req.params.correlationId));
          }
        },
        {
          method: 'POST',
          path: '/debug/events/clear',
          handler: async (req: any, res: any) => {
            ctx.provide('eventLogger').clear();
            res.json({ success: true });
          }
        },
        {
          method: 'GET',
          path: '/debug/events/export',
          handler: async (req: any, res: any) => {
            const format = (req.query.format as 'json' | 'csv') || 'json';
            res.setHeader('Content-Type', format === 'json' ? 'application/json' : 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="events-${Date.now()}.${format}"`);
            res.send(ctx.provide('eventLogger').export(format));
          }
        }
      );
    });

    // Periodic stats logging
    setInterval(() => {
      const stats = ctx.provide('eventLogger').getStats();
      if (stats.totalEvents > 0) {
        ctx.log?.info?.('[EventLogger]', stats);
      }
    }, 60000);
  }
});

export default qeekEventLogger;