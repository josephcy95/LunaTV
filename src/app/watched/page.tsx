/* eslint-disable @next/next/no-img-element */
'use client';

import {
  CheckCircle2,
  Clapperboard,
  Eye,
  Filter,
  Play,
  Search,
  Star,
  Trash2,
} from 'lucide-react';
import { Suspense, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import CapsuleSwitch from '@/components/CapsuleSwitch';
import PageLayout from '@/components/PageLayout';
import UserRatingControl from '@/components/play/UserRatingControl';
import { useWatchStatusList } from '@/hooks/useWatchStatus';
import { postWatchStatus } from '@/lib/watchStatus.client';
import { processImageUrl } from '@/lib/utils';
import type { WatchShowStatus, WatchStatus } from '@/lib/watchStatus';
import { progressLabel } from '@/lib/watchStatus';

type FilterTab = 'all' | 'watching' | 'completed' | 'dropped';

const FILTERS: { label: string; value: FilterTab }[] = [
  { label: '全部', value: 'all' },
  { label: '在看', value: 'watching' },
  { label: '已完成', value: 'completed' },
  { label: '弃番', value: 'dropped' },
];

function statusBadge(status: WatchShowStatus) {
  switch (status) {
    case 'watching':
      return {
        text: '在看',
        className:
          'bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300',
      };
    case 'completed':
    case 'watched':
      return {
        text: status === 'watched' ? '已看' : '已看完',
        className:
          'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
      };
    case 'dropped':
      return {
        text: '弃番',
        className:
          'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300',
      };
    default:
      return {
        text: status,
        className:
          'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
      };
  }
}

function playHref(item: WatchStatus) {
  if (item.source && item.id) {
    return `/play?source=${encodeURIComponent(item.source)}&id=${encodeURIComponent(item.id)}&title=${encodeURIComponent(item.title)}`;
  }
  if (item.douban_id) {
    return `/play?title=${encodeURIComponent(item.title)}&douban_id=${item.douban_id}&prefer=true`;
  }
  return `/play?title=${encodeURIComponent(item.title)}&prefer=true`;
}

function matchesFilter(item: WatchStatus, filter: FilterTab) {
  if (filter === 'all') return true;
  if (filter === 'watching') return item.status === 'watching';
  if (filter === 'dropped') return item.status === 'dropped';
  // completed tab includes movie "watched" and tv "completed"
  return item.status === 'completed' || item.status === 'watched';
}

function WatchedPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const traktFlash = searchParams.get('trakt');
  const { list, loading, reload } = useWatchStatusList(true);
  const [filter, setFilter] = useState<FilterTab>('all');
  const [q, setQ] = useState('');
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return list.filter((item) => {
      if (!matchesFilter(item, filter)) return false;
      if (!needle) return true;
      return (
        item.title.toLowerCase().includes(needle) ||
        (item.year || '').includes(needle)
      );
    });
  }, [list, filter, q]);

  const counts = useMemo(() => {
    const c = { all: list.length, watching: 0, completed: 0, dropped: 0 };
    for (const item of list) {
      if (item.status === 'watching') c.watching += 1;
      else if (item.status === 'dropped') c.dropped += 1;
      else if (item.status === 'completed' || item.status === 'watched')
        c.completed += 1;
    }
    return c;
  }, [list]);

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusyKey(key);
    try {
      await fn();
      await reload();
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <PageLayout activePath='/watched'>
      <div className='mx-auto w-full max-w-6xl px-4 pb-24 pt-6 sm:px-6 sm:pt-8'>
        <div className='mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between'>
          <div>
            <h1 className='flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl'>
              <CheckCircle2 className='size-7 text-emerald-500' />
              我的观看
            </h1>
            <p className='mt-1 text-sm text-gray-500 dark:text-gray-400'>
              本地记录为权威来源 · 播放约 80% 自动标记 · 可选同步 Trakt
            </p>
            {traktFlash === 'connected' && (
              <p className='mt-2 text-xs text-emerald-600 dark:text-emerald-400'>
                Trakt 已连接，并已尝试拉取观看历史（本地已有记录优先保留）。
              </p>
            )}
            {traktFlash && traktFlash !== 'connected' && (
              <p className='mt-2 text-xs text-rose-600 dark:text-rose-400'>
                Trakt 连接失败（{traktFlash}）。可在设置中重试。
              </p>
            )}
          </div>
          <div className='flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400'>
            <span className='rounded-full bg-gray-100 px-2.5 py-1 dark:bg-gray-800'>
              全部 {counts.all}
            </span>
            <span className='rounded-full bg-sky-50 px-2.5 py-1 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300'>
              在看 {counts.watching}
            </span>
            <span className='rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'>
              完成 {counts.completed}
            </span>
            <span className='rounded-full bg-rose-50 px-2.5 py-1 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300'>
              弃番 {counts.dropped}
            </span>
          </div>
        </div>

        <div className='mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
          <CapsuleSwitch
            options={FILTERS}
            active={filter}
            onChange={(v) => setFilter(v as FilterTab)}
          />
          <div className='relative w-full sm:max-w-xs'>
            <Search className='pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400' />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder='搜索标题 / 年份'
              className='w-full rounded-full border border-gray-200 bg-white/80 py-2 pl-9 pr-3 text-sm text-gray-900 outline-none ring-emerald-500/40 placeholder:text-gray-400 focus:ring-2 dark:border-gray-700 dark:bg-gray-900/70 dark:text-gray-100'
            />
          </div>
        </div>

        {loading && list.length === 0 ? (
          <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3'>
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className='h-36 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800/60'
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className='flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 px-6 py-16 text-center dark:border-gray-700'>
            <Eye className='mb-3 size-14 text-gray-300 dark:text-gray-600' />
            <p className='text-base font-medium text-gray-700 dark:text-gray-200'>
              {q ? '没有匹配的记录' : '暂无观看记录'}
            </p>
            <p className='mt-1 max-w-sm text-sm text-gray-500 dark:text-gray-400'>
              播放至约 80% 会自动标记；也可在播放页手动标记 / 评分。
            </p>
            <button
              type='button'
              onClick={() => router.push('/search')}
              className='mt-4 inline-flex items-center gap-1.5 rounded-full bg-emerald-500 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600'
            >
              <Search className='size-4' />
              去搜索内容
            </button>
          </div>
        ) : (
          <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3'>
            {filtered.map((item) => {
              const badge = statusBadge(item.status);
              const busy = busyKey === item.key;
              const progress = progressLabel(item);
              return (
                <article
                  key={item.key}
                  className='group flex gap-3 rounded-2xl border border-gray-200/80 bg-white/80 p-3 shadow-sm backdrop-blur transition hover:border-emerald-300/60 hover:shadow-md dark:border-gray-700/80 dark:bg-gray-900/60 dark:hover:border-emerald-500/40'
                >
                  <a
                    href={playHref(item)}
                    className='relative h-[7.5rem] w-[5.25rem] shrink-0 overflow-hidden rounded-xl bg-gray-100 dark:bg-gray-800'
                  >
                    {item.cover ? (
                      <img
                        src={processImageUrl(item.cover)}
                        alt=''
                        className='h-full w-full object-cover transition duration-300 group-hover:scale-105'
                      />
                    ) : (
                      <div className='flex h-full w-full items-center justify-center'>
                        <Clapperboard className='size-8 text-gray-300 dark:text-gray-600' />
                      </div>
                    )}
                    <span className='absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-black/55 py-1 text-[10px] font-medium text-white opacity-0 transition group-hover:opacity-100'>
                      <Play className='size-3' /> 播放
                    </span>
                  </a>

                  <div className='flex min-w-0 flex-1 flex-col'>
                    <div className='flex items-start justify-between gap-2'>
                      <a href={playHref(item)} className='min-w-0'>
                        <h2 className='truncate text-sm font-semibold text-gray-900 dark:text-gray-50'>
                          {item.title}
                        </h2>
                        <p className='mt-0.5 text-xs text-gray-500 dark:text-gray-400'>
                          {item.year || '年份未知'}
                          {item.media_type === 'tv' ? ' · 剧集' : ' · 电影'}
                          {progress ? ` · ${progress}` : ''}
                        </p>
                      </a>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${badge.className}`}
                      >
                        {badge.text}
                      </span>
                    </div>

                    <div className='mt-2'>
                      <UserRatingControl
                        compact
                        rating={item.rating}
                        disabled={busy}
                        onChange={(rating) =>
                          run(item.key, async () => {
                            await postWatchStatus({
                              action: 'rate',
                              tmdbId: item.tmdb_id,
                              mediaType: item.media_type,
                              doubanId: item.douban_id,
                              source: item.source,
                              id: item.id,
                              title: item.title,
                              year: item.year,
                              cover: item.cover,
                              rating,
                            });
                          })
                        }
                      />
                    </div>

                    <div className='mt-auto flex flex-wrap gap-1.5 pt-2'>
                      {item.status !== 'watching' &&
                        item.media_type === 'tv' && (
                          <button
                            type='button'
                            disabled={busy}
                            onClick={() =>
                              run(item.key, async () => {
                                await postWatchStatus({
                                  action: 'setStatus',
                                  tmdbId: item.tmdb_id,
                                  mediaType: item.media_type,
                                  doubanId: item.douban_id,
                                  source: item.source,
                                  id: item.id,
                                  title: item.title,
                                  status: 'watching',
                                });
                              })
                            }
                            className='rounded-full border border-gray-200 px-2 py-0.5 text-[10px] text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800'
                          >
                            标为在看
                          </button>
                        )}
                      {item.status !== 'completed' &&
                        item.status !== 'watched' && (
                          <button
                            type='button'
                            disabled={busy}
                            onClick={() =>
                              run(item.key, async () => {
                                await postWatchStatus({
                                  action: 'setStatus',
                                  tmdbId: item.tmdb_id,
                                  mediaType: item.media_type,
                                  doubanId: item.douban_id,
                                  source: item.source,
                                  id: item.id,
                                  title: item.title,
                                  status:
                                    item.media_type === 'tv'
                                      ? 'completed'
                                      : 'watched',
                                });
                              })
                            }
                            className='rounded-full border border-gray-200 px-2 py-0.5 text-[10px] text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800'
                          >
                            标为完成
                          </button>
                        )}
                      {item.status !== 'dropped' && (
                        <button
                          type='button'
                          disabled={busy}
                          onClick={() =>
                            run(item.key, async () => {
                              await postWatchStatus({
                                action: 'setStatus',
                                tmdbId: item.tmdb_id,
                                mediaType: item.media_type,
                                doubanId: item.douban_id,
                                source: item.source,
                                id: item.id,
                                title: item.title,
                                status: 'dropped',
                              });
                            })
                          }
                          className='rounded-full border border-gray-200 px-2 py-0.5 text-[10px] text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800'
                        >
                          弃番
                        </button>
                      )}
                      <button
                        type='button'
                        disabled={busy}
                        onClick={() =>
                          run(item.key, async () => {
                            await postWatchStatus({
                              action: 'unmark',
                              tmdbId: item.tmdb_id,
                              mediaType: item.media_type,
                              doubanId: item.douban_id,
                              source: item.source,
                              id: item.id,
                              title: item.title,
                            });
                          })
                        }
                        className='inline-flex items-center gap-0.5 rounded-full border border-rose-200 px-2 py-0.5 text-[10px] text-rose-600 hover:bg-rose-50 dark:border-rose-500/40 dark:text-rose-300 dark:hover:bg-rose-500/10'
                      >
                        <Trash2 className='size-3' />
                        移除
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <p className='mt-8 flex items-center justify-center gap-1.5 text-xs text-gray-400 dark:text-gray-500'>
          <Filter className='size-3.5' />
          在「设置」中可连接 / 断开 Trakt；评分会在连接后推送到 Trakt。
          <Star className='size-3.5 text-amber-400' />
        </p>
      </div>
    </PageLayout>
  );
}

export default function WatchedPage() {
  return (
    <Suspense
      fallback={
        <PageLayout activePath='/watched'>
          <div className='mx-auto max-w-6xl px-4 py-10 text-sm text-gray-500'>
            加载中…
          </div>
        </PageLayout>
      }
    >
      <WatchedPageInner />
    </Suspense>
  );
}
