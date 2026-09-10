/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import {
  useState,
  useRef,
  useLayoutEffect,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { Heart } from 'lucide-react';
import VideoCard from '@/components/VideoCard';
import CommentSection from '@/components/play/CommentSection';
import { processImageUrl } from '@/lib/utils';

type Tab = 'details' | 'recommendations';

export interface MdbListRatingsClient {
  rtTomatoes: number | null;
  rtAudience: number | null;
  tmdb: number | null;
}

interface PlayInfoPanelProps {
  title: string;
  year?: string;
  cover?: string;
  sourceName?: string;
  totalEpisodes: number;
  currentEpisodeIndex: number;
  episodeName?: string;
  backdropUrl?: string | null;
  tmdbPoster?: string | null;
  tmdbOverview?: string | null;
  tmdbTitle?: string | null;
  tmdbRating?: number | null;
  tmdbLogo?: string | null;
  tmdbNumberOfSeasons?: number | null;
  mdblistRatings?: MdbListRatingsClient | null;
  favorited: boolean;
  onToggleFavorite: () => void;
  detail?: any;
  movieDetails?: any;
  bangumiDetails?: any;
  shortdramaDetails?: any;
  movieComments: any[];
  commentsError?: string | null;
  loadingMovieDetails: boolean;
  loadingBangumiDetails: boolean;
  loadingComments: boolean;
  loadingCelebrityWorks: boolean;
  selectedCelebrityName: string | null;
  celebrityWorks: any[];
  onCelebrityClick: (name: string) => void;
  onClearCelebrity: () => void;
  videoDoubanId: number;
  currentSource: string;
  rightActions?: ReactNode;
}

export default function PlayInfoPanel(props: PlayInfoPanelProps) {
  const {
    title,
    year,
    cover,
    sourceName,
    totalEpisodes,
    currentEpisodeIndex,
    episodeName,
    backdropUrl,
    tmdbTitle,
    tmdbRating,
    tmdbNumberOfSeasons,
    mdblistRatings,
    favorited,
    onToggleFavorite,
    detail,
    movieDetails,
    bangumiDetails,
    shortdramaDetails,
    movieComments,
    commentsError,
    loadingMovieDetails,
    loadingBangumiDetails,
    loadingComments,
    loadingCelebrityWorks,
    selectedCelebrityName,
    celebrityWorks,
    onCelebrityClick,
    onClearCelebrity,
    videoDoubanId,
    currentSource,
    rightActions,
  } = props;

  const [activeTab, setActiveTab] = useState<Tab>('details');
  const tabListRef = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState({ x: 0, width: 0, ready: false });

  const bgUrl = backdropUrl || (cover ? processImageUrl(cover) : null);
  const normalizedTitle = title.trim().toLowerCase();
  const normalizedTmdbTitle = tmdbTitle?.trim().toLowerCase();
  const tmdbAlias =
    tmdbTitle && normalizedTmdbTitle && normalizedTmdbTitle !== normalizedTitle
      ? tmdbTitle.trim()
      : null;

  const hasRecommendations = (movieDetails?.recommendations?.length ?? 0) > 0;
  const genres: string[] =
    (movieDetails?.genres as string[] | undefined)?.filter(Boolean) ||
    (bangumiDetails?.tags?.slice(0, 4).map((t: any) => t.name) as string[]) ||
    [];

  const tabs: Array<{ key: Tab; label: string; show: boolean }> = [
    { key: 'details', label: '详情', show: true },
    { key: 'recommendations', label: '推荐', show: hasRecommendations },
  ];
  const visibleTabs = tabs.filter((t) => t.show);

  const updateIndicator = useCallback(() => {
    const list = tabListRef.current;
    if (!list) return;
    const active = list.querySelector<HTMLButtonElement>(
      `button[data-tab="${activeTab}"]`,
    );
    if (!active) return;
    const listRect = list.getBoundingClientRect();
    const activeRect = active.getBoundingClientRect();
    setIndicator({
      x: activeRect.left - listRect.left,
      width: activeRect.width,
      ready: true,
    });
  }, [activeTab]);

  useLayoutEffect(() => {
    const id = requestAnimationFrame(updateIndicator);
    return () => cancelAnimationFrame(id);
  }, [updateIndicator, visibleTabs.length]);

  useEffect(() => {
    window.addEventListener('resize', updateIndicator);
    return () => window.removeEventListener('resize', updateIndicator);
  }, [updateIndicator]);

  // If recommendations disappear while on that tab, fall back
  useEffect(() => {
    if (activeTab === 'recommendations' && !hasRecommendations) {
      setActiveTab('details');
    }
  }, [activeTab, hasRecommendations]);

  const episodeText =
    totalEpisodes > 1
      ? episodeName || `第 ${currentEpisodeIndex + 1} 集`
      : null;

  return (
    <div className='overflow-hidden rounded-lg border border-gray-200/80 bg-white/70 shadow-sm backdrop-blur dark:border-gray-700/60 dark:bg-gray-900/50'>
      {/* ── 紧凑观看信息栏 ── */}
      <section className='relative overflow-hidden'>
        {bgUrl && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={bgUrl}
              alt=''
              aria-hidden='true'
              className='absolute inset-0 h-full w-full object-cover object-center opacity-20 blur-xl scale-105 dark:opacity-25'
            />
            <div className='absolute inset-0 bg-gradient-to-r from-white via-white/95 to-white/80 dark:from-gray-950 dark:via-gray-950/92 dark:to-gray-950/75' />
          </>
        )}

        <div className='relative flex flex-col gap-2 p-3 sm:gap-3 sm:p-5 lg:flex-row lg:items-center lg:justify-between'>
          <div className='min-w-0 flex-1 space-y-1.5 sm:space-y-2'>
            {/* Header chips: source / episode / year / genres — no score chip */}
            <div className='flex flex-wrap items-center gap-1'>
              {sourceName && (
                <span className='max-w-[42vw] truncate rounded-md border border-gray-300/70 bg-white/70 px-1.5 py-0.5 text-[10px] font-medium text-gray-700 dark:border-gray-600 dark:bg-gray-800/80 dark:text-gray-200 sm:max-w-none sm:px-2 sm:text-[11px]'>
                  {sourceName}
                </span>
              )}
              {episodeText && (
                <span className='rounded-md border border-green-500/30 bg-green-50 px-1.5 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-500/15 dark:text-green-300 sm:px-2 sm:text-[11px]'>
                  {episodeText}
                </span>
              )}
              {(detail?.year || year) && (
                <span className='rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300 sm:px-2 sm:text-[11px]'>
                  {detail?.year || year}
                </span>
              )}
              {genres.slice(0, 4).map((g) => (
                <span
                  key={g}
                  className='max-w-[28vw] truncate rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300 sm:max-w-none sm:px-2 sm:text-[11px]'
                >
                  {g}
                </span>
              ))}
              {tmdbNumberOfSeasons && tmdbNumberOfSeasons > 1 && (
                <span className='rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300 sm:px-2 sm:text-[11px]'>
                  共 {tmdbNumberOfSeasons} 季
                </span>
              )}
            </div>

            <h2 className='truncate text-base font-semibold leading-tight text-gray-950 dark:text-gray-50 sm:text-xl'>
              {title}
            </h2>
          </div>

          <div className='flex shrink-0 flex-wrap items-center gap-1.5 sm:gap-2'>
            <button
              onClick={onToggleFavorite}
              className={`inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors sm:h-10 sm:gap-2 sm:px-4 sm:text-sm ${
                favorited
                  ? 'border-rose-300 bg-rose-50 text-rose-600 hover:bg-rose-100 dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-300'
                  : 'border-gray-300 bg-white/85 text-gray-800 hover:border-green-400 hover:bg-green-50 hover:text-green-700 dark:border-gray-600 dark:bg-gray-800/85 dark:text-gray-100 dark:hover:border-green-500/60 dark:hover:bg-green-500/15 dark:hover:text-green-300'
              }`}
              aria-label={favorited ? '取消收藏' : '加入收藏'}
            >
              <Heart
                className={`size-3.5 transition-colors sm:size-4 ${favorited ? 'fill-rose-500 text-rose-500' : ''}`}
              />
              {favorited ? '已收藏' : '加入收藏'}
            </button>
            {rightActions}
          </div>
        </div>
      </section>

      {/* ── Tab 导航 ── */}
      {visibleTabs.length > 1 && (
        <div className='border-b border-gray-200 px-1 dark:border-gray-700 sm:px-2'>
          <div ref={tabListRef} className='relative flex'>
            {visibleTabs.map((tab) => (
              <button
                key={tab.key}
                data-tab={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors sm:px-4 sm:py-3 ${
                  activeTab === tab.key
                    ? 'text-gray-900 dark:text-white'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
            {indicator.ready && (
              <div
                className='absolute bottom-0 h-0.5 bg-green-500 rounded-full transition-all duration-300 ease-out'
                style={{ left: indicator.x, width: indicator.width }}
              />
            )}
          </div>
        </div>
      )}

      {/* ── Tab 内容 ── */}
      <div className='p-3 sm:p-6'>
        {activeTab === 'details' && (
          <DetailsTab
            detail={detail}
            year={year}
            movieDetails={movieDetails}
            tmdbAlias={tmdbAlias}
            tmdbRating={tmdbRating}
            mdblistRatings={mdblistRatings}
            bangumiDetails={bangumiDetails}
            shortdramaDetails={shortdramaDetails}
            loadingMovieDetails={loadingMovieDetails}
            loadingBangumiDetails={loadingBangumiDetails}
            currentSource={currentSource}
            videoDoubanId={videoDoubanId}
            movieComments={movieComments}
            commentsError={commentsError}
            loadingComments={loadingComments}
            loadingCelebrityWorks={loadingCelebrityWorks}
            selectedCelebrityName={selectedCelebrityName}
            celebrityWorks={celebrityWorks}
            onCelebrityClick={onCelebrityClick}
            onClearCelebrity={onClearCelebrity}
          />
        )}
        {activeTab === 'recommendations' && (
          <RecommendationsTab movieDetails={movieDetails} />
        )}
      </div>
    </div>
  );
}

// ─── Ratings row ──────────────────────────────────────────────────────────────

function RatingsRow({
  movieDetails,
  bangumiDetails,
  tmdbRating,
  mdblistRatings,
}: {
  movieDetails?: any;
  bangumiDetails?: any;
  tmdbRating?: number | null;
  mdblistRatings?: MdbListRatingsClient | null;
}) {
  const items: Array<{
    key: string;
    label: string;
    value: string;
    hint?: string;
  }> = [];

  const douban =
    movieDetails?.rate && parseFloat(movieDetails.rate) > 0
      ? parseFloat(movieDetails.rate)
      : null;
  if (douban != null) {
    items.push({
      key: 'douban',
      label: '豆瓣',
      value: douban.toFixed(1),
      hint: '/10',
    });
  }

  const bangumi =
    bangumiDetails?.rating?.score && parseFloat(bangumiDetails.rating.score) > 0
      ? parseFloat(bangumiDetails.rating.score)
      : null;
  if (bangumi != null && douban == null) {
    items.push({
      key: 'bangumi',
      label: 'Bangumi',
      value: bangumi.toFixed(1),
      hint: '/10',
    });
  }

  const hasRt =
    (mdblistRatings?.rtTomatoes != null && mdblistRatings.rtTomatoes > 0) ||
    (mdblistRatings?.rtAudience != null && mdblistRatings.rtAudience > 0);

  if (hasRt) {
    if (mdblistRatings?.rtTomatoes != null && mdblistRatings.rtTomatoes > 0) {
      items.push({
        key: 'rt-critic',
        label: 'RT 新鲜度',
        value: `${Math.round(mdblistRatings.rtTomatoes)}%`,
      });
    }
    if (mdblistRatings?.rtAudience != null && mdblistRatings.rtAudience > 0) {
      items.push({
        key: 'rt-audience',
        label: 'RT 观众',
        value: `${Math.round(mdblistRatings.rtAudience)}%`,
      });
    }
  } else if (tmdbRating != null && tmdbRating > 0) {
    items.push({
      key: 'tmdb',
      label: 'TMDB',
      value: tmdbRating.toFixed(1),
      hint: '/10',
    });
  }

  if (!items.length) return null;

  return (
    <div className='flex flex-wrap gap-2' aria-label='评分'>
      {items.map((item) => (
        <div
          key={item.key}
          className='inline-flex items-baseline gap-1.5 rounded-lg border border-gray-200/80 bg-gray-50/80 px-2.5 py-1.5 dark:border-gray-700/70 dark:bg-gray-800/60'
        >
          <span className='text-[11px] font-medium text-gray-500 dark:text-gray-400'>
            {item.label}
          </span>
          <span className='text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-50'>
            {item.value}
          </span>
          {item.hint && (
            <span className='text-[10px] text-gray-400 dark:text-gray-500'>
              {item.hint}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Details Tab (synopsis → ratings → credits → cast → 短评) ─────────────────

function DetailsTab({
  detail,
  year,
  movieDetails,
  tmdbAlias,
  tmdbRating,
  mdblistRatings,
  bangumiDetails,
  shortdramaDetails,
  loadingMovieDetails,
  loadingBangumiDetails,
  currentSource,
  videoDoubanId,
  movieComments,
  commentsError,
  loadingComments,
  loadingCelebrityWorks,
  selectedCelebrityName,
  celebrityWorks,
  onCelebrityClick,
  onClearCelebrity,
}: any) {
  const showDetails =
    currentSource !== 'shortdrama' &&
    videoDoubanId !== 0 &&
    detail &&
    detail.source !== 'shortdrama';

  const hasCast =
    (movieDetails?.celebrities?.length ?? 0) > 0 &&
    movieDetails.celebrities.some((c: any) => c.avatar);

  return (
    <div className='space-y-4 text-sm sm:space-y-5'>
      {/* 简介 */}
      {(shortdramaDetails?.desc ||
        bangumiDetails?.summary ||
        movieDetails?.plot_summary ||
        detail?.desc) && (
        <p className='text-sm leading-relaxed text-gray-700 dark:text-gray-300'>
          {movieDetails?.plot_summary ||
            bangumiDetails?.summary ||
            shortdramaDetails?.desc ||
            detail?.desc}
        </p>
      )}

      {/* 评分行 — 豆瓣优先；西方 RT（MDBList）否则 TMDB */}
      <RatingsRow
        movieDetails={movieDetails}
        bangumiDetails={bangumiDetails}
        tmdbRating={tmdbRating}
        mdblistRatings={mdblistRatings}
      />

      {tmdbAlias && (
        <div>
          <span className='font-semibold text-gray-700 dark:text-gray-300'>
            TMDB 别名:{' '}
          </span>
          <span className='text-gray-600 dark:text-gray-400'>{tmdbAlias}</span>
        </div>
      )}

      {/* 加载中 */}
      {showDetails &&
        (loadingMovieDetails || loadingBangumiDetails) &&
        !movieDetails &&
        !bangumiDetails && (
          <div className='animate-pulse space-y-2'>
            <div className='h-4 bg-gray-200 dark:bg-gray-700 rounded w-48' />
            <div className='h-4 bg-gray-200 dark:bg-gray-700 rounded w-32' />
          </div>
        )}

      {/* Bangumi 制作信息（评分已在 RatingsRow） */}
      {bangumiDetails && (
        <div className='space-y-2'>
          {bangumiDetails.infobox?.map((info: any, i: number) => {
            if ((info.key === '导演' || info.key === '制作') && info.value) {
              const v = Array.isArray(info.value)
                ? info.value.map((x: any) => x.v || x).join('、')
                : info.value;
              return (
                <div key={i}>
                  <span className='font-semibold text-gray-700 dark:text-gray-300'>
                    {info.key}:{' '}
                  </span>
                  <span className='text-gray-600 dark:text-gray-400'>{v}</span>
                </div>
              );
            }
            return null;
          })}
          {bangumiDetails.date && (
            <div>
              <span className='font-semibold text-gray-700 dark:text-gray-300'>
                播出日期:{' '}
              </span>
              <span className='text-gray-600 dark:text-gray-400'>
                {bangumiDetails.date}
              </span>
            </div>
          )}
          <div className='flex flex-wrap gap-2 pt-1'>
            {bangumiDetails.total_episodes && (
              <span className='bg-green-500/90 text-white px-3 py-1 rounded-full text-xs font-medium'>
                共{bangumiDetails.total_episodes}话
              </span>
            )}
          </div>
        </div>
      )}

      {/* 豆瓣 credits（评分/类型已上移，避免重复） */}
      {movieDetails && (
        <div className='space-y-2'>
          {movieDetails.directors?.length > 0 && (
            <div>
              <span className='font-semibold text-gray-700 dark:text-gray-300'>
                导演:{' '}
              </span>
              <span className='text-gray-600 dark:text-gray-400'>
                {movieDetails.directors.join('、')}
              </span>
            </div>
          )}
          {movieDetails.screenwriters?.length > 0 && (
            <div>
              <span className='font-semibold text-gray-700 dark:text-gray-300'>
                编剧:{' '}
              </span>
              <span className='text-gray-600 dark:text-gray-400'>
                {movieDetails.screenwriters.join('、')}
              </span>
            </div>
          )}
          {movieDetails.cast?.length > 0 && (
            <div>
              <span className='font-semibold text-gray-700 dark:text-gray-300'>
                主演:{' '}
              </span>
              <span className='text-gray-600 dark:text-gray-400'>
                {movieDetails.cast.slice(0, 5).join('、')}
              </span>
            </div>
          )}
          {movieDetails.first_aired && (
            <div>
              <span className='font-semibold text-gray-700 dark:text-gray-300'>
                {movieDetails.episodes ? '首播' : '上映'}:{' '}
              </span>
              <span className='text-gray-600 dark:text-gray-400'>
                {movieDetails.first_aired}
              </span>
            </div>
          )}
          <div className='flex flex-wrap gap-2 pt-1'>
            {movieDetails.countries?.slice(0, 2).map((c: string, i: number) => (
              <span
                key={i}
                className='bg-blue-500/90 text-white px-3 py-1 rounded-full text-xs font-medium'
              >
                {c}
              </span>
            ))}
            {movieDetails.languages?.slice(0, 2).map((l: string, i: number) => (
              <span
                key={i}
                className='bg-purple-500/90 text-white px-3 py-1 rounded-full text-xs font-medium'
              >
                {l}
              </span>
            ))}
            {movieDetails.episodes && (
              <span className='bg-green-500/90 text-white px-3 py-1 rounded-full text-xs font-medium'>
                共{movieDetails.episodes}集
              </span>
            )}
            {movieDetails.episode_length && (
              <span className='bg-orange-500/90 text-white px-3 py-1 rounded-full text-xs font-medium'>
                单集{movieDetails.episode_length}分钟
              </span>
            )}
            {movieDetails.movie_duration && (
              <span className='bg-red-500/90 text-white px-3 py-1 rounded-full text-xs font-medium'>
                {movieDetails.movie_duration}分钟
              </span>
            )}
          </div>
        </div>
      )}

      {/* 短剧 */}
      {(detail?.source === 'shortdrama' || shortdramaDetails) && (
        <div className='flex flex-wrap gap-2'>
          {(shortdramaDetails?.episodes || detail?.episodes)?.length && (
            <span className='bg-blue-500/90 text-white px-3 py-1 rounded-full text-xs font-medium'>
              共{(shortdramaDetails?.episodes || detail?.episodes)?.length}集
            </span>
          )}
          <span className='bg-green-500/90 text-white px-3 py-1 rounded-full text-xs font-medium'>
            短剧
          </span>
          {(shortdramaDetails?.year || detail?.year) && (
            <span className='bg-purple-500/90 text-white px-3 py-1 rounded-full text-xs font-medium'>
              {shortdramaDetails?.year || detail?.year}年
            </span>
          )}
        </div>
      )}

      {/* 演员阵容 */}
      {hasCast && (
        <CastBlock
          movieDetails={movieDetails}
          loadingCelebrityWorks={loadingCelebrityWorks}
          selectedCelebrityName={selectedCelebrityName}
          celebrityWorks={celebrityWorks}
          onCelebrityClick={onCelebrityClick}
          onClearCelebrity={onClearCelebrity}
        />
      )}

      {/* 短评 — YouTube-style list inside 详情 */}
      <CommentSection
        comments={movieComments}
        loading={loadingComments}
        error={commentsError ?? null}
        videoDoubanId={videoDoubanId}
      />
    </div>
  );
}

// ─── Cast block (inlined into 详情) ───────────────────────────────────────────

function CastBlock({
  movieDetails,
  loadingCelebrityWorks,
  selectedCelebrityName,
  celebrityWorks,
  onCelebrityClick,
  onClearCelebrity,
}: any) {
  const celebrities =
    movieDetails?.celebrities?.filter((c: any) => c.avatar) || [];

  return (
    <div className='space-y-4 border-t border-gray-200 dark:border-gray-700 pt-4'>
      <h3 className='text-base font-semibold text-gray-800 dark:text-gray-200'>
        演员阵容
      </h3>
      <div className='flex gap-4 overflow-x-auto pb-2 scrollbar-hide'>
        {celebrities.slice(0, 20).map((c: any) => (
          <div
            key={c.id}
            onClick={() => onCelebrityClick(c.name)}
            className='shrink-0 text-center group cursor-pointer'
          >
            <div className='w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700 mb-2 ring-2 ring-transparent group-hover:ring-green-500 transition-all duration-200 group-hover:scale-105'>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={processImageUrl(c.avatar)}
                alt={c.name}
                className='w-full h-full object-cover'
                loading='lazy'
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            </div>
            <p className='text-xs font-medium text-gray-700 dark:text-gray-300 w-16 sm:w-20 truncate group-hover:text-green-500 transition-colors'>
              {c.name}
            </p>
            {c.role && (
              <p className='text-[10px] text-gray-500 w-16 sm:w-20 truncate mt-0.5'>
                {c.role}
              </p>
            )}
          </div>
        ))}
      </div>

      {selectedCelebrityName && (
        <div>
          <div className='flex justify-between items-center mb-4'>
            <h3 className='text-base font-semibold text-gray-800 dark:text-gray-200'>
              {selectedCelebrityName} 的作品
            </h3>
            <button
              onClick={onClearCelebrity}
              className='text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            >
              收起 ✕
            </button>
          </div>
          {loadingCelebrityWorks ? (
            <div className='flex items-center justify-center py-12'>
              <div className='animate-spin rounded-full h-10 w-10 border-b-2 border-green-500' />
            </div>
          ) : celebrityWorks.length > 0 ? (
            <div className='grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3'>
              {celebrityWorks.map((work: any) => {
                const url =
                  work.source === 'tmdb'
                    ? `/play?title=${encodeURIComponent(work.title)}&prefer=true`
                    : `/play?title=${encodeURIComponent(work.title)}&douban_id=${work.id}&prefer=true`;
                return (
                  <a key={work.id} href={url}>
                    <VideoCard
                      id={work.id}
                      title={work.title}
                      poster={work.poster}
                      rate={work.rate}
                      year={work.year}
                      from='douban'
                      douban_id={parseInt(work.id)}
                    />
                  </a>
                );
              })}
            </div>
          ) : (
            <p className='text-center text-gray-500 dark:text-gray-400 py-8'>
              暂无相关作品
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Recommendations Tab ──────────────────────────────────────────────────────

function RecommendationsTab({ movieDetails }: any) {
  const items = movieDetails?.recommendations || [];
  if (!items.length)
    return (
      <p className='text-center text-gray-500 dark:text-gray-400 py-8'>
        暂无推荐
      </p>
    );

  return (
    <div className='grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3'>
      {items.map((item: any) => (
        <a
          key={item.id}
          href={`/play?title=${encodeURIComponent(item.title)}&douban_id=${item.id}&prefer=true`}
        >
          <VideoCard
            id={item.id}
            title={item.title}
            poster={item.poster}
            rate={item.rate}
            douban_id={parseInt(item.id)}
            from='douban'
            isAggregate
          />
        </a>
      ))}
    </div>
  );
}
