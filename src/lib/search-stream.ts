import type { SearchResult } from '@/lib/types';

export type SSEChunk =
  | {
      type: 'start';
      totalSources: number;
      setupMs?: number;
      requestId?: string;
    }
  | { type: 'source_result'; source?: string; results: SearchResult[] }
  | { type: 'source_done'; source: string }
  | { type: 'source_error'; source: string; sourceName: string; error: string }
  | {
      type: 'complete';
      completedSources: number;
      failedSources: number;
      totalResults?: number;
    };

function parseEvent(data: string): SSEChunk | null {
  const invalid = () => new Error('搜索连接返回了无效数据，请重试');
  let value: unknown;
  try {
    value = JSON.parse(data);
  } catch {
    throw invalid();
  }
  if (!value || typeof value !== 'object' || !('type' in value))
    throw invalid();
  const event = value as Record<string, unknown>;
  const count = (n: unknown) =>
    typeof n === 'number' && Number.isSafeInteger(n) && n >= 0;
  let valid = false;
  switch (event.type) {
    case 'start':
      valid = count(event.totalSources);
      break;
    case 'source_result':
      valid =
        Array.isArray(event.results) &&
        event.results.every(
          (item) =>
            item &&
            typeof item === 'object' &&
            typeof item.source === 'string' &&
            typeof item.id === 'string' &&
            typeof item.title === 'string' &&
            Array.isArray(item.episodes),
        );
      break;
    case 'source_done':
      valid = typeof event.source === 'string';
      break;
    case 'source_error':
      valid =
        typeof event.source === 'string' &&
        typeof event.sourceName === 'string' &&
        typeof event.error === 'string';
      break;
    case 'complete':
      valid =
        count(event.completedSources) &&
        count(event.failedSources) &&
        (event.failedSources as number) <= (event.completedSources as number) &&
        (event.totalResults === undefined || count(event.totalResults));
      break;
    default:
      return null; // Allow future event types without breaking old clients.
  }
  if (!valid) throw invalid();
  return value as SSEChunk;
}

/** Fetch rather than EventSource: HTTP failures and premature EOF are errors,
 * and the query's AbortSignal owns both the request and body consumption. */
const STREAM_BATCH_MAX = 8;

/** Fetch and coalesce bursts of source_result events without delaying the first result. */
export async function* searchStream(
  url: string,
  signal?: AbortSignal,
): AsyncGenerator<SSEChunk> {
  const response = await fetch(url, {
    signal,
    headers: { Accept: 'text/event-stream' },
  });
  if (!response.ok || !response.body)
    throw new Error(`搜索连接失败 (${response.status})`);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      signal?.throwIfAborted();
      const { done, value } = await reader.read();
      if (done)
        throw new Error('搜索连接中断，已显示部分结果，请重试获取剩余结果');
      // Normalize after appending: CR and LF may arrive in different chunks.
      buffer = (buffer + decoder.decode(value, { stream: true })).replace(
        /\r\n/g,
        '\n',
      );
      let boundary: number;
      while ((boundary = buffer.indexOf('\n\n')) !== -1) {
        const frame = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const data = frame
          .split('\n')
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).trimStart())
          .join('\n');
        if (!data) continue; // Heartbeats/comments.
        const event = parseEvent(data);
        if (!event) continue;
        // Coalesce consecutive result frames. Terminal events are always emitted
        // after the pending batch, so source status and completion ordering is stable.
        if (event.type === 'source_result') {
          const results = [...event.results];
          let next: SSEChunk | undefined;
          while (results.length < STREAM_BATCH_MAX) {
            const nextBoundary = buffer.indexOf('\n\n');
            if (nextBoundary < 0) break;
            const nextFrame = buffer.slice(0, nextBoundary);
            const nextData = nextFrame
              .split('\n')
              .filter((line) => line.startsWith('data:'))
              .map((line) => line.slice(5).trimStart())
              .join('\n');
            buffer = buffer.slice(nextBoundary + 2);
            if (!nextData) continue;
            next = parseEvent(nextData) ?? undefined;
            if (!next || next.type !== 'source_result') break;
            results.push(...next.results);
          }
          yield { ...event, results };
          if (next) {
            // Preserve the first non-result event for the normal ordering path.
            buffer = `data: ${JSON.stringify(next)}\n\n${buffer}`;
          }
        } else {
          yield event;
          if (event.type === 'complete') return;
        }
      }
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
