import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { getAvailableApiSites, getConfig } from '@/lib/config';
import { generateSearchVariants, searchFromApi } from '@/lib/downstream';
import { yellowWords } from '@/lib/yellow';
import { recordStreamingMetrics } from '@/lib/streaming-metrics';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const authInfo = getAuthInfoFromCookie(request);
  if (!authInfo?.username) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const query = request.nextUrl.searchParams.get('q')?.trim();
  if (!query)
    return NextResponse.json({ error: '搜索关键词不能为空' }, { status: 400 });

  const startedAt = performance.now();
  const requestId = crypto.randomUUID();
  const config = await getConfig();
  const apiSites = await getAvailableApiSites(authInfo.username);
  const setupMs = performance.now() - startedAt;
  const variants = generateSearchVariants(query);
  const lifetime = new AbortController();
  const signal = AbortSignal.any([request.signal, lifetime.signal]);
  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      const close = () => {
        if (closed) return;
        closed = true;
        signal.removeEventListener('abort', close);
        controller.close();
      };
      const send = (event: Record<string, unknown>) => {
        if (closed || signal.aborted) return;
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(event)}\n\n`),
        );
      };
      signal.addEventListener('abort', close, { once: true });
      if (signal.aborted) {
        close();
        return;
      }
      send({
        type: 'start',
        totalSources: apiSites.length,
        setupMs,
        requestId,
      });
      let completedSources = 0;
      let failedSources = 0;
      // A provider may resolve/reject more than once through cancellation races;
      // count its terminal status exactly once.
      const terminalSources = new Set<string>();
      const finishSource = (
        site: (typeof apiSites)[number],
        failed: boolean,
        durationMs: number,
      ) => {
        if (terminalSources.has(site.key)) return false;
        terminalSources.add(site.key);
        completedSources++;
        if (failed) failedSources++;
        send(
          failed
            ? {
                type: 'source_error',
                source: site.key,
                sourceName: site.name,
                error: '该来源未完成，可重试获取更多结果',
                durationMs,
              }
            : { type: 'source_done', source: site.key, durationMs },
        );
        return true;
      };
      let totalResults = 0;
      let firstResultMs: number | undefined;
      // Do not return the task from start(): the response must remain cancellable
      // while providers are running, including during additional-page requests.
      // Bound fan-out so a large provider list cannot exhaust connections/resources.
      const providerConcurrency = Math.min(4, Math.max(1, apiSites.length));
      let nextProvider = 0;
      const runProvider = async () => {
        while (!signal.aborted) {
          const index = nextProvider++;
          const site = apiSites[index];
          if (!site) return;
          const providerStart = performance.now();
          const deadline = new AbortController();
          const timer = setTimeout(() => deadline.abort(), 20000);
          try {
            await searchFromApi(site, query, variants, {
              signal: AbortSignal.any([signal, deadline.signal]),
              onResults(batch) {
                const results = config.SiteConfig.DisableYellowFilter
                  ? batch
                  : batch.filter(
                      (item) =>
                        !yellowWords.some((word) =>
                          (item.type_name || '').includes(word),
                        ),
                    );
                totalResults += results.length;
                if (results.length && firstResultMs === undefined) {
                  firstResultMs = performance.now() - startedAt;
                }
                if (results.length)
                  send({
                    type: 'source_result',
                    source: site.key,
                    results,
                    partial: true,
                  });
              },
            });
            if (!signal.aborted)
              finishSource(
                site,
                deadline.signal.aborted,
                performance.now() - providerStart,
              );
          } catch {
            if (!signal.aborted) {
              finishSource(site, true, performance.now() - providerStart);
            }
          } finally {
            clearTimeout(timer);
          }
        }
      };
      void Promise.all(
        Array.from({ length: providerConcurrency }, () => runProvider()),
      ).then(() => {
        send({
          type: 'complete',
          completedSources,
          failedSources,
          totalResults,
          durationMs: performance.now() - startedAt,
        });
        recordStreamingMetrics({
          requestId,
          startedAt,
          setupMs,
          firstResultMs,
          completedAt: performance.now(),
          providerFailures: failedSources,
          resultCount: totalResults,
          path: '/api/search/ws',
        });
        close();
      });
    },
    cancel() {
      closed = true;
      lifetime.abort();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'private, no-store',
      'X-Accel-Buffering': 'no',
      'Server-Timing': `setup;dur=${setupMs.toFixed(1)}`,
    },
  });
}
