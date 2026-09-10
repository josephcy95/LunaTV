/* eslint-disable no-console */

import { useQuery, useQueryClient, queryOptions } from '@tanstack/react-query';
import type { PlayStatsResult } from '@/lib/types';
import { useWatchingUpdatesQuery as useWatchingUpdates } from './useWatchingUpdates';

/**
 * Query options for admin play stats
 */
const adminStatsOptions = () =>
  queryOptions<PlayStatsResult>({
    queryKey: ['playStats', 'admin'],
    queryFn: async () => {
      console.log('开始获取管理员统计数据...');
      const response = await fetch('/api/admin/play-stats');

      if (response.status === 401) {
        throw new Error('UNAUTHORIZED');
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      console.log('管理员统计数据获取成功');
      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000,
    retry: 1,
  });

/**
 * Fetch admin play stats
 * Based on TanStack Query useQuery with enabled option
 */
export function useAdminStatsQuery(enabled: boolean) {
  return useQuery({
    ...adminStatsOptions(),
    enabled,
  });
}

/**
 * Query options for user personal stats
 */
const userStatsOptions = () =>
  queryOptions({
    queryKey: ['playStats', 'user'],
    queryFn: async () => {
      console.log('开始获取用户个人统计数据...');
      const response = await fetch('/api/user/my-stats');

      if (response.status === 401) {
        throw new Error('UNAUTHORIZED');
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      console.log('用户个人统计数据获取成功');
      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000,
    retry: 1,
  });

/**
 * Fetch user personal stats
 * Based on TanStack Query useQuery with enabled option
 */
export function useUserStatsQuery(enabled: boolean) {
  return useQuery({
    ...userStatsOptions(),
    enabled,
  });
}

/**
 * Fetch watching updates for play-stats page
 * Uses the new TanStack Query implementation
 */
export function usePlayStatsWatchingUpdatesQuery(enabled: boolean) {
  return useWatchingUpdates({
    enabled,
  });
}

/**
 * Invalidate all play-stats queries for refresh
 */
export function useInvalidatePlayStats() {
  const queryClient = useQueryClient();

  return async () => {
    // Clear localStorage cache
    // Invalidate all play-stats related queries
    await queryClient.invalidateQueries({ queryKey: ['playStats'] });
    await queryClient.invalidateQueries({ queryKey: ['watchingUpdates'] });
    await queryClient.invalidateQueries({ queryKey: ['playRecords'] });
  };
}
