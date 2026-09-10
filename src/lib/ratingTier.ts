/**
 * Play-chip rating tiers as % of each source's full scale.
 *
 * NOTE: NOCTURNE remaps Tailwind `green-*` / `emerald-*` to Moonglow gold, so
 * tier chrome must NOT use those utilities — see `.rating-tier-*` in globals.css.
 */

export type RatingTier = 'great' | 'good' | 'meh' | 'bad';

/** Scale hint for the raw score as shown / stored by the source. */
export type RatingScale = '/10' | '%';

/**
 * Normalize a raw score to 0–100 percent of that source's full scale.
 * - `/10` (Douban / Bangumi / TMDB 0–10): percent = score / 10 * 100
 * - `%` (RT / already 0–100): percent = score
 *
 * If a `/10` value is clearly already on 0–100 (e.g. MDBList TMDB scaled up
 * and the chip displays "87%"), treat it as percent so color uses 87 not 8.7.
 */
export function scoreToPercent(score: number, scale: RatingScale): number {
  if (!Number.isFinite(score)) return 0;
  if (scale === '%') return score;
  // Defensive: some payloads hand us 0–100 while claiming /10
  if (score > 10) return score;
  return (score / 10) * 100;
}

/** Map a 0–100 percent onto the agreed visual tier. */
export function ratingTierFromPercent(percent: number): RatingTier {
  if (percent >= 85) return 'great';
  if (percent >= 70) return 'good';
  if (percent >= 50) return 'meh';
  return 'bad';
}

/**
 * Convenience for assertions / call sites:
 * getTier(8.6,'/10') → great, getTier(95,'%') → great, getTier(53,'%') → meh, …
 */
export function getTier(score: number, scale: RatingScale): RatingTier {
  return ratingTierFromPercent(scoreToPercent(score, scale));
}

/** Static class pairs — full literals so they survive any tooling; colors live in CSS. */
export const RATING_TIER_CLASS: Record<
  RatingTier,
  { chip: string; score: string }
> = {
  great: {
    chip: 'rating-tier-great',
    score: 'rating-tier-great-score font-semibold tabular-nums',
  },
  good: {
    chip: 'rating-tier-good',
    score: 'rating-tier-good-score font-semibold tabular-nums',
  },
  meh: {
    chip: 'rating-tier-meh',
    score: 'rating-tier-meh-score font-semibold tabular-nums',
  },
  bad: {
    chip: 'rating-tier-bad',
    score: 'rating-tier-bad-score font-semibold tabular-nums',
  },
};
