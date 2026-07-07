'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Activity,
  BarChart3,
  Clock,
  Lock,
  Play,
  RefreshCw,
  Shield,
  TrendingUp,
  Users,
} from 'lucide-react';

import PageLayout from '@/components/PageLayout';
import { getAuthInfoFromBrowserCookie } from '@/lib/auth';
import type { PlayStatsResult } from '@/lib/types';
import {
  useAdminStatsQuery,
  useInvalidatePlayStats,
} from '@/hooks/usePlayStatsQueries';

const formatTime = (seconds: number): string => {
  if (!seconds) return '00:00';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = Math.round(seconds % 60);

  if (hours === 0) {
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds
      .toString()
      .padStart(2, '0')}`;
  }

  return `${hours.toString().padStart(2, '0')}:${minutes
    .toString()
    .padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
};

const formatDate = (dateStr: string): string => {
  try {
    return new Date(dateStr).toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
};

const formatDateTime = (timestamp: number): string => {
  if (!timestamp) return '暂无';

  return new Date(timestamp).toLocaleString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

function StatCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className='rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800'>
      <div className='flex items-start justify-between gap-4'>
        <div>
          <p className='text-sm text-gray-500 dark:text-gray-400'>{label}</p>
          <p className='mt-2 text-2xl font-semibold text-gray-900 dark:text-white'>
            {value}
          </p>
          {hint && (
            <p className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
              {hint}
            </p>
          )}
        </div>
        <div className='rounded-lg bg-green-50 p-2 text-green-600 dark:bg-green-500/10 dark:text-green-400'>
          {icon}
        </div>
      </div>
    </div>
  );
}

function GlobalStatsContent({ stats }: { stats: PlayStatsResult }) {
  const topUsers = useMemo(
    () =>
      [...stats.userStats]
        .sort((a, b) => b.totalWatchTime - a.totalWatchTime)
        .slice(0, 12),
    [stats.userStats]
  );

  return (
    <div className='space-y-6'>
      <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-4'>
        <StatCard
          icon={<Users className='h-5 w-5' />}
          label='总用户数'
          value={stats.totalUsers}
          hint={`今日新增 ${stats.registrationStats.todayNewUsers}`}
        />
        <StatCard
          icon={<Clock className='h-5 w-5' />}
          label='全站观看时长'
          value={formatTime(stats.totalWatchTime)}
          hint={`人均 ${formatTime(stats.avgWatchTimePerUser)}`}
        />
        <StatCard
          icon={<Play className='h-5 w-5' />}
          label='全站播放次数'
          value={stats.totalPlays}
          hint={`人均 ${Math.round(stats.avgPlaysPerUser)} 次`}
        />
        <StatCard
          icon={<Activity className='h-5 w-5' />}
          label='活跃用户'
          value={stats.activeUsers.daily}
          hint={`周 ${stats.activeUsers.weekly} / 月 ${stats.activeUsers.monthly}`}
        />
      </div>

      <div className='grid gap-6 xl:grid-cols-[1.1fr_0.9fr]'>
        <section className='rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800'>
          <div className='mb-4 flex items-center gap-2'>
            <TrendingUp className='h-5 w-5 text-green-600' />
            <h2 className='text-lg font-semibold text-gray-900 dark:text-white'>
              近 7 天播放趋势
            </h2>
          </div>
          <div className='space-y-3'>
            {stats.dailyStats.map((stat) => {
              const maxPlays = Math.max(...stats.dailyStats.map((item) => item.plays), 1);
              const width = Math.max((stat.plays / maxPlays) * 100, stat.plays ? 8 : 0);
              return (
                <div key={stat.date} className='grid grid-cols-[4.5rem_1fr_5rem] items-center gap-3 text-sm'>
                  <span className='text-gray-500 dark:text-gray-400'>
                    {formatDate(stat.date)}
                  </span>
                  <div className='h-2 rounded-full bg-gray-100 dark:bg-gray-700'>
                    <div
                      className='h-full rounded-full bg-green-500'
                      style={{ width: `${width}%` }}
                    />
                  </div>
                  <span className='text-right text-gray-700 dark:text-gray-300'>
                    {stat.plays} 次
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        <section className='rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800'>
          <div className='mb-4 flex items-center gap-2'>
            <BarChart3 className='h-5 w-5 text-green-600' />
            <h2 className='text-lg font-semibold text-gray-900 dark:text-white'>
              热门来源
            </h2>
          </div>
          <div className='space-y-3'>
            {stats.topSources.length > 0 ? (
              stats.topSources.map((source, index) => (
                <div
                  key={source.source}
                  className='flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm dark:bg-gray-700/60'
                >
                  <span className='font-medium text-gray-900 dark:text-white'>
                    {index + 1}. {source.source}
                  </span>
                  <span className='text-gray-600 dark:text-gray-300'>
                    {source.count} 次
                  </span>
                </div>
              ))
            ) : (
              <p className='text-sm text-gray-500 dark:text-gray-400'>
                暂无来源数据
              </p>
            )}
          </div>
        </section>
      </div>

      <section className='rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800'>
        <div className='mb-4 flex items-center gap-2'>
          <Users className='h-5 w-5 text-green-600' />
          <h2 className='text-lg font-semibold text-gray-900 dark:text-white'>
            用户观看排行
          </h2>
        </div>
        <div className='overflow-x-auto'>
          <table className='min-w-full text-sm'>
            <thead>
              <tr className='border-b border-gray-200 text-left text-gray-500 dark:border-gray-700 dark:text-gray-400'>
                <th className='py-3 pr-4 font-medium'>用户</th>
                <th className='py-3 pr-4 font-medium'>观看时长</th>
                <th className='py-3 pr-4 font-medium'>播放次数</th>
                <th className='py-3 pr-4 font-medium'>常用来源</th>
                <th className='py-3 pr-4 font-medium'>最后播放</th>
                <th className='py-3 font-medium'>最后登录</th>
              </tr>
            </thead>
            <tbody>
              {topUsers.map((user) => (
                <tr
                  key={user.username}
                  className='border-b border-gray-100 text-gray-800 last:border-0 dark:border-gray-700/70 dark:text-gray-200'
                >
                  <td className='py-3 pr-4 font-medium'>{user.username}</td>
                  <td className='py-3 pr-4'>{formatTime(user.totalWatchTime)}</td>
                  <td className='py-3 pr-4'>{user.totalPlays}</td>
                  <td className='py-3 pr-4'>{user.mostWatchedSource || '暂无'}</td>
                  <td className='py-3 pr-4'>{formatDateTime(user.lastPlayTime)}</td>
                  <td className='py-3'>{formatDateTime(user.lastLoginTime)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default function GlobalStatsPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [password, setPassword] = useState('');
  const [reauthenticated, setReauthenticated] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const invalidatePlayStats = useInvalidatePlayStats();

  const {
    data: stats = null,
    error,
    isLoading,
    refetch,
  } = useAdminStatsQuery(isAdmin && reauthenticated);

  useEffect(() => {
    const auth = getAuthInfoFromBrowserCookie();
    if (!auth || !auth.username) {
      router.push('/login');
      return;
    }

    setIsAdmin(auth.role === 'admin' || auth.role === 'owner');
    setAuthChecked(true);
  }, [router]);

  const handleReauth = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthError(null);
    setAuthLoading(true);

    try {
      const response = await fetch('/api/admin/reauth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || '验证失败');
      }

      setReauthenticated(true);
      setPassword('');
    } catch (err) {
      setAuthError((err as Error).message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRefresh = async () => {
    await invalidatePlayStats();
    await refetch();
  };

  if (!authChecked) {
    return (
      <PageLayout activePath='/global-stats'>
        <div className='mx-auto max-w-6xl px-4 py-12 text-center text-gray-600 dark:text-gray-400'>
          正在检查权限...
        </div>
      </PageLayout>
    );
  }

  if (!isAdmin) {
    return (
      <PageLayout activePath='/global-stats'>
        <div className='mx-auto max-w-3xl px-4 py-12'>
          <div className='rounded-lg border border-red-200 bg-red-50 p-6 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300'>
            只有管理员可以访问全站统计。
          </div>
        </div>
      </PageLayout>
    );
  }

  if (!reauthenticated) {
    return (
      <PageLayout activePath='/global-stats'>
        <div className='mx-auto flex min-h-[60vh] max-w-md items-center px-4 py-12'>
          <form
            onSubmit={handleReauth}
            className='w-full rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800'
          >
            <div className='mb-5 flex items-center gap-3'>
              <div className='rounded-lg bg-green-50 p-2 text-green-600 dark:bg-green-500/10 dark:text-green-400'>
                <Lock className='h-5 w-5' />
              </div>
              <div>
                <h1 className='text-xl font-semibold text-gray-900 dark:text-white'>
                  全站统计验证
                </h1>
                <p className='mt-1 text-sm text-gray-500 dark:text-gray-400'>
                  请再次输入管理员密码。
                </p>
              </div>
            </div>

            <label className='mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300'>
              密码
            </label>
            <input
              type='password'
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete='current-password'
              className='w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20 dark:border-gray-600 dark:bg-gray-900 dark:text-white'
              autoFocus
            />

            {authError && (
              <p className='mt-3 text-sm text-red-600 dark:text-red-400'>
                {authError}
              </p>
            )}

            <button
              type='submit'
              disabled={authLoading || !password}
              className='mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2 font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60'
            >
              <Shield className='h-4 w-4' />
              {authLoading ? '验证中...' : '进入全站统计'}
            </button>
          </form>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout activePath='/global-stats'>
      <div className='mx-auto max-w-7xl px-4 py-8 pb-40 md:pb-safe-bottom'>
        <div className='mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-start'>
          <div>
            <h1 className='text-3xl font-bold text-gray-900 dark:text-white'>
              全站统计
            </h1>
            <p className='mt-2 text-gray-600 dark:text-gray-400'>
              管理员专用的全站播放、用户活跃和来源统计。
            </p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className='inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60'
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            刷新
          </button>
        </div>

        {isLoading && (
          <div className='rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-600 shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400'>
            正在加载全站统计...
          </div>
        )}

        {error && (
          <div className='rounded-lg border border-red-200 bg-red-50 p-6 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300'>
            {(error as Error).message}
          </div>
        )}

        {stats && <GlobalStatsContent stats={stats} />}
      </div>
    </PageLayout>
  );
}
