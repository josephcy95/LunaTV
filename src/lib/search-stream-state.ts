import type { SearchResult } from '@/lib/types';
import type { SSEChunk } from '@/lib/search-stream';

export type StreamedSearchState = {
  results: SearchResult[];
  totalSources: number;
  completedSources: number;
  failedSources: number;
  totalResults?: number;
  /** Terminal provider events already applied; protects against duplicate worker events. */
  sourceStatus: Record<string, 'done' | 'error'>;
};

export const STREAMED_SEARCH_INITIAL: StreamedSearchState = {
  sourceStatus: {},
  results: [],
  totalSources: 0,
  completedSources: 0,
  failedSources: 0,
  totalResults: 0,
};

/** Applies one stream event; callers scope this reducer to the active query key. */
export function reduceSearchStream(
  acc: StreamedSearchState,
  chunk: SSEChunk,
): StreamedSearchState {
  switch (chunk.type) {
    case 'start':
      return { ...STREAMED_SEARCH_INITIAL, totalSources: chunk.totalSources };
    case 'source_result': {
      const seen = new Set(
        acc.results.map((item) => `${item.source}:${item.id}`),
      );
      const fresh = chunk.results.filter((item) => {
        const key = `${item.source}:${item.id}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      return { ...acc, results: acc.results.concat(fresh) };
    }
    case 'source_done': {
      if (acc.sourceStatus[chunk.source]) return acc;
      return {
        ...acc,
        completedSources: acc.completedSources + 1,
        sourceStatus: { ...acc.sourceStatus, [chunk.source]: 'done' },
      };
    }
    case 'source_error': {
      if (acc.sourceStatus[chunk.source]) return acc;
      return {
        ...acc,
        completedSources: acc.completedSources + 1,
        failedSources: acc.failedSources + 1,
        sourceStatus: { ...acc.sourceStatus, [chunk.source]: 'error' },
      };
    }
    case 'complete':
      return {
        ...acc,
        completedSources: chunk.completedSources,
        failedSources: chunk.failedSources,
        totalResults: chunk.totalResults ?? acc.results.length,
      };
  }
}
