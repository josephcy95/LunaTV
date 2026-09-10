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
import { processImageUrl } from '@/lib/utils';
import { buildRatingChips, RatingChips } from '@/components/play/RatingChips';
import {
  DetailsTab,
  RecommendationsTab,
} from '@/components/play/PlayInfoDetails';
import WatchToggleButton from '@/components/play/WatchToggleButton';
import UserRatingControl from '@/components/play/UserRatingControl';

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
  watched?: boolean;
  watchShowStatus?: string;
  onToggleWatched?: () => void;
  userRating?: number | null;
  onUserRatingChange?: (rating: number | null) => void | Promise<void>;
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

/** Shared size/padding for ALL top-row chips so borders/tints don't change perceived size. */
const CHIP_BASE =
  'inline-flex h-5 max-w-none items-center gap-1 rounded-md border px-1.5 text-[10px] font-medium leading-none sm:h-[22px] sm:px-2 sm:text-[11px]';

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
    watched,
    watchShowStatus,
    onToggleWatched,
    userRating,
    onUserRatingChange,
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
            {/* Header chips: source / episode / year / genres / ratings */}
            <div className='flex flex-wrap items-center gap-1'>
              {sourceName && (
                <span
                  className={`${CHIP_BASE} max-w-[42vw] truncate border-gray-300/60 bg-gray-100/90 text-gray-700 dark:border-gray-600 dark:bg-gray-800/80 dark:text-gray-200 sm:max-w-none`}
                >
                  {sourceName}
                </span>
              )}
              {episodeText && (
                <span
                  className={`${CHIP_BASE} border-green-500/25 bg-green-50 text-green-700 dark:border-green-500/30 dark:bg-green-500/15 dark:text-green-300`}
                >
                  {episodeText}
                </span>
              )}
              {(detail?.year || year) && (
                <span
                  className={`${CHIP_BASE} border-gray-300/50 bg-violet-50/80 text-gray-600 dark:border-gray-600/80 dark:bg-violet-500/10 dark:text-gray-300`}
                >
                  {detail?.year || year}
                </span>
              )}
              {genres.slice(0, 4).map((g) => (
                <span
                  key={g}
                  className={`${CHIP_BASE} max-w-[28vw] truncate border-gray-300/50 bg-violet-50/80 text-gray-600 dark:border-gray-600/80 dark:bg-violet-500/10 dark:text-gray-300 sm:max-w-none`}
                >
                  {g}
                </span>
              ))}
              {tmdbNumberOfSeasons && tmdbNumberOfSeasons > 1 && (
                <span
                  className={`${CHIP_BASE} border-gray-300/50 bg-violet-50/80 text-gray-600 dark:border-gray-600/80 dark:bg-violet-500/10 dark:text-gray-300`}
                >
                  共 {tmdbNumberOfSeasons} 季
                </span>
              )}
              <RatingChips
                chips={buildRatingChips({
                  movieDetails,
                  bangumiDetails,
                  tmdbRating,
                  mdblistRatings,
                })}
              />
            </div>

            <h2 className='truncate text-base font-semibold leading-tight text-gray-950 dark:text-gray-50 sm:text-xl'>
              {title}
            </h2>
          </div>

          <div className='flex shrink-0 flex-wrap items-center gap-1.5 sm:gap-2'>
            {onToggleWatched && (
              <WatchToggleButton
                watched={Boolean(watched)}
                showStatus={watchShowStatus}
                onToggle={onToggleWatched}
              />
            )}
            {onUserRatingChange && (
              <UserRatingControl
                rating={userRating}
                onChange={onUserRatingChange}
              />
            )}
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
