'use client';

import { useState } from 'react';

export const SEARCH_RESULT_BATCH_SIZE = 60;

/** Client rendering only: callers must filter/sort the full set before slicing. */
export function useSearchResultBatch(
  resetKey: string,
  batchSize = SEARCH_RESULT_BATCH_SIZE,
) {
  const [batch, setBatch] = useState({ key: resetKey, limit: batchSize });

  // Reset before committing children, rather than briefly rendering the old
  // expanded limit for a new query/filter. Arrivals do not change resetKey.
  const limit = batch.key === resetKey ? batch.limit : batchSize;
  if (batch.key !== resetKey) {
    setBatch({ key: resetKey, limit: batchSize });
  }

  const loadMore = () => {
    setBatch((current) => ({
      key: resetKey,
      limit: (current.key === resetKey ? current.limit : batchSize) + batchSize,
    }));
  };

  return { limit, loadMore };
}
