import { recordRequest } from './performance-monitor';

/** Privacy-safe lifecycle recorder for streaming API requests. Never stores query text. */
export type StreamingMetricContext = {
  requestId: string;
  startedAt?: number;
  setupMs?: number;
  firstResultMs?: number;
  completedAt?: number;
  providerFailures?: number;
  resultCount?: number;
  statusCode?: number;
  path: string;
};

export function recordStreamingMetrics(context: StreamingMetricContext): void {
  const startedAt = context.startedAt ?? performance.now();
  const completedAt = context.completedAt ?? performance.now();
  const duration = Math.max(0, completedAt - startedAt);
  recordRequest({
    timestamp: Date.now(),
    method: 'GET',
    path: context.path,
    statusCode: context.statusCode ?? (context.providerFailures ? 502 : 200),
    duration,
    memoryUsed: 0,
    dbQueries: 0,
    requestSize: 0,
    responseSize: 0,
    requestId: context.requestId,
    phases: {
      ...(context.setupMs === undefined ? {} : { setup: context.setupMs }),
      ...(context.firstResultMs === undefined
        ? {}
        : { firstResult: context.firstResultMs }),
      completion: duration,
      providerFailures: context.providerFailures ?? 0,
      resultCount: context.resultCount ?? 0,
    },
  });
}
