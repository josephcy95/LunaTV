/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import VideoCard from '@/components/VideoCard';
import CommentSection from '@/components/play/CommentSection';
import { processImageUrl } from '@/lib/utils';

// ─── Details Tab (synopsis → ratings → credits → cast → 短评) ─────────────────

export function DetailsTab({
  detail,
  year,
  movieDetails,
  tmdbAlias,
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

      {showDetails &&
        (loadingMovieDetails || loadingBangumiDetails) &&
        !movieDetails &&
        !bangumiDetails && (
          <div className='animate-pulse space-y-2'>
            <div className='h-4 bg-gray-200 dark:bg-gray-700 rounded w-48' />
            <div className='h-4 bg-gray-200 dark:bg-gray-700 rounded w-32' />
          </div>
        )}

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

      {movieDetails && (
        <div className='space-y-2'>
          {tmdbAlias && (
            <div>
              <span className='font-semibold text-gray-700 dark:text-gray-300'>
                TMDB 别名:{' '}
              </span>
              <span className='text-gray-600 dark:text-gray-400'>
                {tmdbAlias}
              </span>
            </div>
          )}
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

      {tmdbAlias && !movieDetails && (
        <div className='space-y-2'>
          <div>
            <span className='font-semibold text-gray-700 dark:text-gray-300'>
              TMDB 别名:{' '}
            </span>
            <span className='text-gray-600 dark:text-gray-400'>
              {tmdbAlias}
            </span>
          </div>
        </div>
      )}

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

      <CommentSection
        comments={movieComments}
        loading={loadingComments}
        error={commentsError ?? null}
        videoDoubanId={videoDoubanId}
      />
    </div>
  );
}

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

export function RecommendationsTab({ movieDetails }: any) {
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
