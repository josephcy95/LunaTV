/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import {
  getTier,
  scoreToPercent,
  RATING_TIER_CLASS,
  type RatingScale,
} from '@/lib/ratingTier';


export interface MdbListRatingsClient {
  rtTomatoes: number | null;
  rtAudience: number | null;
  tmdb: number | null;
}

/** Shared size/padding for rating chips (matches PlayInfoPanel meta chips). */
const CHIP_BASE =
  'inline-flex h-5 max-w-none items-center gap-1 rounded-md border px-1.5 text-[10px] font-medium leading-none sm:h-[22px] sm:px-2 sm:text-[11px]';

// ─── Compact chips (shared base + rating tiers) ───────────────────────────────
// Tier colors live in rating-tiers.css (.rating-tier-*) — green/emerald Tailwind
// tokens are remapped to Moonglow gold in NOCTURNE and cannot signal "go".

type RatingChip = {
  key: string;
  icon?: string;
  alt: string;
  value: string;
  title: string;
  /** Normalized 0–100 score for color tiering */
  percent: number;
};

export function buildRatingChips({
  movieDetails,
  bangumiDetails,
  tmdbRating,
  mdblistRatings,
}: {
  movieDetails?: any;
  bangumiDetails?: any;
  tmdbRating?: number | null;
  mdblistRatings?: MdbListRatingsClient | null;
}): RatingChip[] {
  const items: RatingChip[] = [];

  const douban =
    movieDetails?.rate && parseFloat(movieDetails.rate) > 0
      ? parseFloat(movieDetails.rate)
      : null;
  if (douban != null) {
    items.push({
      key: 'douban',
      icon: '/icons/ratings/douban.svg',
      alt: '豆瓣',
      value: douban.toFixed(1),
      title: `豆瓣 ${douban.toFixed(1)}/10`,
      percent: scoreToPercent(douban, '/10'),
    });
  }

  const bangumi =
    bangumiDetails?.rating?.score && parseFloat(bangumiDetails.rating.score) > 0
      ? parseFloat(bangumiDetails.rating.score)
      : null;
  if (bangumi != null && douban == null) {
    items.push({
      key: 'bangumi',
      alt: 'Bangumi',
      value: bangumi.toFixed(1),
      title: `Bangumi ${bangumi.toFixed(1)}/10`,
      percent: scoreToPercent(bangumi, '/10'),
    });
  }

  const hasRt =
    (mdblistRatings?.rtTomatoes != null && mdblistRatings.rtTomatoes > 0) ||
    (mdblistRatings?.rtAudience != null && mdblistRatings.rtAudience > 0);

  if (hasRt) {
    if (mdblistRatings?.rtTomatoes != null && mdblistRatings.rtTomatoes > 0) {
      const v = Math.round(mdblistRatings.rtTomatoes);
      items.push({
        key: 'rt-critic',
        icon: '/icons/ratings/certified-fresh.svg',
        alt: 'RT 新鲜度',
        value: `${v}%`,
        title: `Rotten Tomatoes 新鲜度 ${v}%`,
        percent: scoreToPercent(v, '%'),
      });
    }
    if (mdblistRatings?.rtAudience != null && mdblistRatings.rtAudience > 0) {
      const v = Math.round(mdblistRatings.rtAudience);
      items.push({
        key: 'rt-audience',
        icon: '/icons/ratings/popcorn-hot.svg',
        alt: 'RT 观众',
        value: `${v}%`,
        title: `Rotten Tomatoes 观众 ${v}%`,
        percent: scoreToPercent(v, '%'),
      });
    }
  } else {
    const tmdbScore =
      mdblistRatings?.tmdb != null && mdblistRatings.tmdb > 0
        ? mdblistRatings.tmdb
        : tmdbRating != null && tmdbRating > 0
          ? tmdbRating
          : null;
    if (tmdbScore != null) {
      // MDBList/TMDB may arrive as 0–10 or already 0–100; color from displayed %.
      const scale: RatingScale = tmdbScore > 10 ? '%' : '/10';
      const percent = scoreToPercent(tmdbScore, scale);
      const value =
        scale === '%' ? `${Math.round(tmdbScore)}%` : tmdbScore.toFixed(1);
      const title =
        scale === '%'
          ? `TMDB ${Math.round(tmdbScore)}%`
          : `TMDB ${tmdbScore.toFixed(1)}/10`;
      items.push({
        key: 'tmdb',
        icon: '/icons/ratings/tmdb.svg',
        alt: 'TMDB',
        value,
        title,
        percent,
      });
    }
  }

  return items;
}

export function RatingChips({ chips }: { chips: RatingChip[] }) {
  if (!chips.length) return null;
  return (
    <>
      {chips.map((item) => {
        const tier = RATING_TIER_CLASS[getTier(item.percent, '%')];
        return (
          <span
            key={item.key}
            title={item.title}
            className={`${CHIP_BASE} ${tier.chip}`}
          >
            {item.icon ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.icon}
                alt={item.alt}
                className='h-3 w-3 shrink-0 object-contain sm:h-3.5 sm:w-3.5'
                loading='lazy'
              />
            ) : (
              <span className='text-[9px] font-medium text-gray-500 dark:text-gray-400'>
                {item.alt}
              </span>
            )}
            <span className={tier.score}>{item.value}</span>
          </span>
        );
      })}
    </>
  );
}
