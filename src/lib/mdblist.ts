/* eslint-disable @typescript-eslint/no-explicit-any, no-console */
import { getConfig } from '@/lib/config';
import { db } from '@/lib/db';

export type MdbMediaType = 'movie' | 'show';

export interface MdbListRatings {
  tmdbId: number;
  mediaType: MdbMediaType;
  /** Rotten Tomatoes critic score (tomatoes), 0–100 */
  rtTomatoes: number | null;
  /** Rotten Tomatoes audience score (popcorn), 0–100 */
  rtAudience: number | null;
  /** TMDB score from MDBList payload when present, 0–10 */
  tmdb: number | null;
  title?: string | null;
  year?: number | null;
}

const CACHE_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days — ratings change slowly
const NEGATIVE_CACHE_TTL_SECONDS = 6 * 60 * 60; // 6h when not found / transient error

function cacheKey(tmdbId: number, mediaType: MdbMediaType): string {
  return `mdblist-ratings-${mediaType}-${tmdbId}`;
}

function pickRating(
  ratings: any[] | undefined,
  sources: string[],
): number | null {
  if (!Array.isArray(ratings)) return null;
  for (const source of sources) {
    const hit = ratings.find(
      (r) => String(r?.source || '').toLowerCase() === source,
    );
    if (!hit) continue;
    // Prefer score (often 0–100 for RT); fall back to value
    const raw =
      hit.score != null
        ? Number(hit.score)
        : hit.value != null
          ? Number(hit.value)
          : NaN;
    if (!Number.isFinite(raw) || raw <= 0) continue;
    return raw;
  }
  return null;
}

/**
 * Normalize RT-like scores to integer percentage when needed.
 * tomatoes/audience are typically 0–100 already; if we only get 0–10, scale up.
 */
function asPercent(n: number | null): number | null {
  if (n == null) return null;
  if (n > 0 && n <= 10) return Math.round(n * 10);
  return Math.round(n);
}

export async function getMDBListApiKey(): Promise<string> {
  const config = await getConfig();
  return (
    config.SiteConfig?.MDBListApiKey?.trim() ||
    process.env.MDBLIST_API_KEY?.trim() ||
    ''
  );
}

/**
 * Server-only MDBList lookup by TMDb id. Returns null when no key / miss / error.
 * Results (including empty API misses) are cached aggressively to respect free-tier limits.
 * IMPORTANT: never negative-cache the "no API key" case on the per-tmdb key — otherwise
 * after the user saves a key, getCache still returns __empty and we never call MDBList.
 */
export async function fetchMDBListRatings(
  tmdbId: number,
  mediaType: MdbMediaType = 'movie',
): Promise<MdbListRatings | null> {
  if (!tmdbId || tmdbId <= 0) return null;

  const apiKey = await getMDBListApiKey();
  const key = cacheKey(tmdbId, mediaType);

  try {
    const cached = await db.getCache(key);
    if (cached) {
      if (cached.__empty) {
        const reason = cached.reason as string | undefined;
        // Bust no-key / legacy (unreasoned) sentinels once a key exists.
        // Keep typed misses (not-found / error) so we do not re-hammer the API.
        if (apiKey && (reason === 'no-key' || reason == null)) {
          // fall through to live fetch
        } else {
          return null;
        }
      } else {
        return cached as MdbListRatings;
      }
    }
  } catch {
    /* ignore cache read errors */
  }

  if (!apiKey) {
    // Do NOT write __empty onto the per-tmdb ratings key when there is no key.
    // That poisoned cache after users later saved a key (dashboard stayed at 0 requests).
    return null;
  }

  const url = `https://api.mdblist.com/tmdb/${mediaType}/${tmdbId}?apikey=${encodeURIComponent(apiKey)}`;

  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: { Accept: 'application/json' },
    });

    if (res.status === 404) {
      await db.setCache(
        key,
        { __empty: true, reason: 'not-found' },
        CACHE_TTL_SECONDS,
      );
      return null;
    }

    if (!res.ok) {
      console.warn(
        `[MDBList] HTTP ${res.status} for tmdb/${mediaType}/${tmdbId}`,
      );
      // Short negative cache on rate-limit / errors to avoid hammering
      await db.setCache(
        key,
        { __empty: true, reason: 'error' },
        NEGATIVE_CACHE_TTL_SECONDS,
      );
      return null;
    }

    const data = await res.json();
    const ratings: any[] = Array.isArray(data?.ratings) ? data.ratings : [];

    const result: MdbListRatings = {
      tmdbId,
      mediaType,
      rtTomatoes: asPercent(
        pickRating(ratings, ['tomatoes', 'rottentomatoes', 'rtomatoes']),
      ),
      rtAudience: asPercent(
        // MDBList uses source "popcorn" for RT audience
        pickRating(ratings, ['popcorn', 'audience', 'rtaudience']),
      ),
      tmdb: (() => {
        const v = pickRating(ratings, ['tmdb', 'tmdbscore']);
        if (v == null) return null;
        // TMDB is usually 0–10; if 0–100, scale down
        return v > 10
          ? Math.round((v / 10) * 10) / 10
          : Math.round(v * 10) / 10;
      })(),
      title: data?.title || null,
      year: data?.year || null,
    };

    const hasAny =
      result.rtTomatoes != null ||
      result.rtAudience != null ||
      result.tmdb != null;

    await db.setCache(
      key,
      hasAny ? result : { __empty: true, reason: 'not-found' },
      CACHE_TTL_SECONDS,
    );

    return hasAny ? result : null;
  } catch (err) {
    console.warn('[MDBList] fetch failed:', err);
    try {
      await db.setCache(
        key,
        { __empty: true, reason: 'error' },
        NEGATIVE_CACHE_TTL_SECONDS,
      );
    } catch {
      /* ignore */
    }
    return null;
  }
}
