import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

import { GetBangumiCalendarData } from '@/lib/bangumi.client';
import { getDoubanCategories } from '@/lib/douban.client';
import { getRecommendedShortDramas } from '@/lib/shortdrama.client';

import { useHomePageQueries } from './useHomePageQueries';

jest.mock('@/lib/douban.client', () => ({
  getDoubanCategories: jest.fn(),
}));
jest.mock('@/lib/shortdrama.client', () => ({
  getRecommendedShortDramas: jest.fn(),
}));
jest.mock('@/lib/bangumi.client', () => ({
  GetBangumiCalendarData: jest.fn(),
}));

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
}

const douban = getDoubanCategories as jest.Mock;
const shortDramas = getRecommendedShortDramas as jest.Mock;
const bangumi = GetBangumiCalendarData as jest.Mock;

beforeEach(() => {
  jest.resetAllMocks();
  douban.mockResolvedValue({ code: 200, list: [{ id: '1', title: 'Movie' }] });
  shortDramas.mockResolvedValue([{ id: 's1', name: 'Drama' }]);
  bangumi.mockResolvedValue([]);
});

test('does not fetch homepage modules until the home tab is active', async () => {
  const { result } = renderHook(
    () => useHomePageQueries({ loadPrimaryModules: false }),
    { wrapper: createWrapper() },
  );
  await waitFor(() => {
    expect(result.current.sectionPending.hotMovies).toBe(true);
  });
  expect(douban).not.toHaveBeenCalled();
  expect(shortDramas).not.toHaveBeenCalled();
  expect(bangumi).not.toHaveBeenCalled();
});

test('keeps bangumi and short dramas idle until nearby modules are enabled', async () => {
  const { result } = renderHook(
    () =>
      useHomePageQueries({
        loadPrimaryModules: true,
        loadNearbyModules: false,
      }),
    { wrapper: createWrapper() },
  );

  await waitFor(() =>
    expect(result.current.sectionPending.hotMovies).toBe(false),
  );
  expect(douban).toHaveBeenCalled();
  expect(shortDramas).not.toHaveBeenCalled();
  expect(bangumi).not.toHaveBeenCalled();
  expect(result.current.sectionPending.hotShortDramas).toBe(true);
  expect(result.current.sectionPending.bangumiCalendar).toBe(true);
});

test('fetches nearby modules once enabled and clears their pending flags', async () => {
  const { rerender, result } = renderHook(
    ({ nearby }: { nearby: boolean }) =>
      useHomePageQueries({
        loadPrimaryModules: true,
        loadNearbyModules: nearby,
      }),
    { wrapper: createWrapper(), initialProps: { nearby: false } },
  );

  await waitFor(() =>
    expect(result.current.sectionPending.hotMovies).toBe(false),
  );
  expect(shortDramas).not.toHaveBeenCalled();

  rerender({ nearby: true });
  await waitFor(() => {
    expect(shortDramas).toHaveBeenCalled();
    expect(bangumi).toHaveBeenCalled();
    expect(result.current.sectionPending.hotShortDramas).toBe(false);
    expect(result.current.sectionPending.bangumiCalendar).toBe(false);
  });
});
