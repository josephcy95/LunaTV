/**
 * Local watch-tracking helpers.
 * Source of truth is the local DB (keyed primarily by TMDB id).
 * Bias: auto-mark watched at ~80% — easy to unmark.
 */

export type WatchMediaType = 'movie' | 'tv';

export type WatchShowStatus = 'watching' | 'completed' | 'watched';

export interface WatchStatus {
  /** Stable key: movie:{tmdb} | tv:{tmdb} | douban:{id} | src:{source}+{id} */
  key: string;
  tmdb_id?: number;
  media_type: WatchMediaType;
  douban_id?: number;
  title: string;
  year?: string;
  cover?: string;
  status: WatchShowStatus;
  /** TV: episode keys "ep:{n}" (1-based flat index) → watched_at ms */
  watched_episodes?: Record<string, number>;
  known_episode_count?: number;
  watched_at?: number;
  updated_at: number;
  /** Last play deep-link */
  source?: string;
  id?: string;
}

export interface UserWatchData {
  items: Record<string, WatchStatus>;
}

export interface UserTraktTokens {
  access_token: string;
  refresh_token?: string;
  created_at: number;
  expires_in: number;
  token_type?: string;
  scope?: string;
  trakt_username?: string;
}

/** Progress at or above this ratio auto-marks watched. */
export const WATCHED_PROGRESS_THRESHOLD = 0.8;

export function episodeKey(episodeIndex1Based: number): string {
  return `ep:${episodeIndex1Based}`;
}

export function buildWatchKey(opts: {
  tmdbId?: number | null;
  mediaType?: WatchMediaType | null;
  doubanId?: number | null;
  source?: string | null;
  id?: string | null;
}): string | null {
  const { tmdbId, mediaType, doubanId, source, id } = opts;
  if (tmdbId && mediaType) return `${mediaType}:${tmdbId}`;
  if (tmdbId) return `movie:${tmdbId}`;
  if (doubanId && doubanId > 0) return `douban:${doubanId}`;
  if (source && id) return `src:${source}+${id}`;
  return null;
}

export function shouldAutoMarkWatched(
  playTime: number,
  totalTime: number,
  threshold = WATCHED_PROGRESS_THRESHOLD,
): boolean {
  if (!totalTime || totalTime <= 0 || playTime < 0) return false;
  const ratio = playTime / totalTime;
  if (ratio >= threshold) return true;
  // Near end: last 2% always; or last 2 minutes once already past 90%
  const remaining = totalTime - playTime;
  if (remaining / totalTime <= 0.02) return true;
  if (remaining <= 120 && ratio >= 0.9) return true;
  return false;
}

export function applyEpisodeWatched(
  existing: WatchStatus | undefined,
  base: Omit<
    WatchStatus,
    'status' | 'watched_episodes' | 'updated_at' | 'watched_at'
  > & {
    episodeIndex1Based: number;
    knownEpisodeCount?: number;
  },
): WatchStatus {
  const now = Date.now();
  const ep = episodeKey(base.episodeIndex1Based);
  const watched_episodes = {
    ...(existing?.watched_episodes || {}),
    [ep]: now,
  };
  const known =
    base.knownEpisodeCount ?? existing?.known_episode_count ?? undefined;
  const watchedCount = Object.keys(watched_episodes).length;
  const completed =
    typeof known === 'number' && known > 0 && watchedCount >= known;

  return {
    key: base.key,
    tmdb_id: base.tmdb_id ?? existing?.tmdb_id,
    media_type: 'tv',
    douban_id: base.douban_id ?? existing?.douban_id,
    title: base.title || existing?.title || '',
    year: base.year ?? existing?.year,
    cover: base.cover ?? existing?.cover,
    status: completed ? 'completed' : 'watching',
    watched_episodes,
    known_episode_count: known,
    watched_at: now,
    updated_at: now,
    source: base.source ?? existing?.source,
    id: base.id ?? existing?.id,
  };
}

export function applyMovieWatched(
  existing: WatchStatus | undefined,
  base: Omit<WatchStatus, 'status' | 'watched_episodes' | 'updated_at'>,
): WatchStatus {
  const now = Date.now();
  return {
    ...existing,
    ...base,
    media_type: 'movie',
    status: 'watched',
    watched_episodes: undefined,
    watched_at: now,
    updated_at: now,
  };
}

export function unmarkEpisode(
  existing: WatchStatus,
  episodeIndex1Based: number,
): WatchStatus | null {
  const ep = episodeKey(episodeIndex1Based);
  const watched_episodes = { ...(existing.watched_episodes || {}) };
  delete watched_episodes[ep];
  const keys = Object.keys(watched_episodes);
  if (keys.length === 0) return null;
  const known = existing.known_episode_count;
  const completed =
    typeof known === 'number' && known > 0 && keys.length >= known;
  return {
    ...existing,
    watched_episodes,
    status: completed ? 'completed' : 'watching',
    updated_at: Date.now(),
  };
}

export function isItemWatched(item: WatchStatus | undefined): boolean {
  if (!item) return false;
  if (item.media_type === 'movie') return item.status === 'watched';
  return item.status === 'completed';
}

export function isEpisodeWatched(
  item: WatchStatus | undefined,
  episodeIndex1Based: number,
): boolean {
  if (!item) return false;
  return Boolean(item.watched_episodes?.[episodeKey(episodeIndex1Based)]);
}
