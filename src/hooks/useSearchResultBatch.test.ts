import { act, renderHook } from '@testing-library/react';

import { useSearchResultBatch } from './useSearchResultBatch';

describe('useSearchResultBatch', () => {
  it('starts at 60 and makes every result in a large supplied set reachable', () => {
    const discovered = Array.from({ length: 1003 }, (_, id) => ({ id }));
    const { result } = renderHook(() => useSearchResultBatch('query'));
    expect(result.current.limit).toBe(60);
    let visible = discovered.slice(0, result.current.limit);
    while (visible.length < discovered.length) {
      const previous = visible;
      act(() => result.current.loadMore());
      visible = discovered.slice(0, result.current.limit);
      expect(visible.slice(0, previous.length)).toEqual(previous);
    }
    expect(visible).toEqual(discovered);
    expect(discovered).toHaveLength(1003);
  });

  it.each(['query', 'filter', 'sort', 'view', 'display', 'exact'])(
    'resets when the %s scope changes and does not resurrect an old limit',
    (change) => {
      const { result, rerender } = renderHook(
        ({ scope }) => useSearchResultBatch(scope),
        { initialProps: { scope: 'original' } },
      );
      act(() => result.current.loadMore());
      expect(result.current.limit).toBe(120);
      rerender({ scope: change });
      expect(result.current.limit).toBe(60);
      rerender({ scope: 'original' });
      expect(result.current.limit).toBe(60);
    },
  );

  it('preserves the expanded limit across incremental arrivals and empty sets', () => {
    const { result, rerender } = renderHook(
      ({ items }) => {
        const batch = useSearchResultBatch('same-query');
        return { ...batch, visible: items.slice(0, batch.limit) };
      },
      { initialProps: { items: [] as number[] } },
    );
    expect(result.current.visible).toEqual([]);
    rerender({ items: Array.from({ length: 65 }, (_, id) => id) });
    act(() => result.current.loadMore());
    expect(result.current.visible).toHaveLength(65);
    rerender({ items: Array.from({ length: 181 }, (_, id) => id) });
    expect(result.current.limit).toBe(120);
    expect(result.current.visible).toHaveLength(120);
  });

  it('accepts a configurable batch size and batches rapid load actions', () => {
    const { result } = renderHook(() => useSearchResultBatch('query', 40));
    act(() => {
      result.current.loadMore();
      result.current.loadMore();
    });
    expect(result.current.limit).toBe(120);
  });
});
