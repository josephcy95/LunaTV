import type { SearchResult } from '@/lib/types';
import type { SSEChunk } from '@/lib/search-stream';

export type StreamedSearchState = {
  results: SearchResult[];
  totalSources: number;
  completedSources: number;
  failedSources: number;
  totalResults?: number;
};

export const STREAMED_SEARCH_INITIAL: StreamedSearchState = {
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
    case 'source_done':
      return { ...acc, completedSources: acc.completedSources + 1 };
    case 'source_error':
      return {
        ...acc,
        completedSources: acc.completedSources + 1,
        failedSources: acc.failedSources + 1,
      };
    case 'complete':
      return {
        ...acc,
        completedSources: chunk.completedSources,
        failedSources: chunk.failedSources,
        totalResults: chunk.totalResults ?? acc.results.length,
      };
  }
}
