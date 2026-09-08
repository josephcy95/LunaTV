import {
  reduceSearchStream,
  STREAMED_SEARCH_INITIAL,
} from '@/lib/search-stream-state';

const item = (id: string) =>
  ({ source: 's', id, title: id, episodes: [] }) as any;

test('new start resets state so old query chunks cannot leak into replacement', () => {
  const old = reduceSearchStream(STREAMED_SEARCH_INITIAL, {
    type: 'start',
    totalSources: 1,
  });
  const withOld = reduceSearchStream(old, {
    type: 'source_result',
    results: [item('old')],
  });
  const next = reduceSearchStream(withOld, { type: 'start', totalSources: 2 });
  expect(next.results).toEqual([]);
  expect(next.totalSources).toBe(2);
});

test('late chunks are scoped by caller to active query state', () => {
  const current = reduceSearchStream(
    reduceSearchStream(STREAMED_SEARCH_INITIAL, {
      type: 'start',
      totalSources: 1,
    }),
    { type: 'source_result', results: [item('new')] },
  );
  expect(current.results.map((x) => x.id)).toEqual(['new']);
  expect(
    reduceSearchStream(current, {
      type: 'complete',
      completedSources: 1,
      failedSources: 0,
    }).results.map((x) => x.id),
  ).toEqual(['new']);
});
