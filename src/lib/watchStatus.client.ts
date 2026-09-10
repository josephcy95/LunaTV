'use client';

import type { UserWatchData, WatchMediaType, WatchStatus } from './watchStatus';
import {
  applyEpisodeWatched,
  applyMovieWatched,
  buildWatchKey,
  shouldAutoMarkWatched,
  unmarkEpisode,
} from './watchStatus';

const LS_KEY = 'moontv_watch_status';

function storageType(): string {
  if (typeof window === 'undefined') return 'localstorage';
  return (
    (window as any).RUNTIME_CONFIG?.STORAGE_TYPE ||
    process.env.NEXT_PUBLIC_STORAGE_TYPE ||
    'localstorage'
  );
}

function readLocal(): UserWatchData {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return { items: {} };
    const parsed = JSON.parse(raw);
    return parsed?.items ? parsed : { items: {} };
  } catch {
    return { items: {} };
  }
}

function writeLocal(data: UserWatchData) {
  localStorage.setItem(LS_KEY, JSON.stringify(data));
  window.dispatchEvent(
    new CustomEvent('watchStatusUpdated', { detail: data.items }),
  );
}

export type WatchMarkPayload = {
  action: 'mark' | 'unmark' | 'progress';
  tmdbId?: number | null;
  mediaType?: WatchMediaType;
  doubanId?: number | null;
  source?: string;
  id?: string;
  title: string;
  year?: string;
  cover?: string;
  episodeIndex?: number;
  knownEpisodeCount?: number;
  playTime?: number;
  totalTime?: number;
  syncTrakt?: boolean;
};

export async function fetchWatchStatuses(): Promise<
  Record<string, WatchStatus>
> {
  if (storageType() === 'localstorage') {
    return readLocal().items;
  }
  const res = await fetch('/api/watch-status', { credentials: 'include' });
  if (!res.ok) return {};
  const json = await res.json();
  return json.items || {};
}

export async function postWatchStatus(
  payload: WatchMarkPayload,
): Promise<{ items: Record<string, WatchStatus>; item?: WatchStatus | null }> {
  if (storageType() === 'localstorage') {
    const data = readLocal();
    const mediaType = payload.mediaType || 'movie';
    const key = buildWatchKey({
      tmdbId: payload.tmdbId,
      mediaType,
      doubanId: payload.doubanId,
      source: payload.source,
      id: payload.id,
    });
    if (!key) return { items: data.items };

    if (payload.action === 'progress') {
      if (
        !shouldAutoMarkWatched(
          Number(payload.playTime) || 0,
          Number(payload.totalTime) || 0,
        )
      ) {
        return { items: data.items, item: data.items[key] || null };
      }
    }

    if (payload.action === 'unmark') {
      const prev = data.items[key];
      if (!prev) return { items: data.items, item: null };
      if (prev.media_type === 'tv' && payload.episodeIndex) {
        const next = unmarkEpisode(prev, payload.episodeIndex);
        if (next) data.items[key] = next;
        else delete data.items[key];
      } else {
        delete data.items[key];
      }
      writeLocal(data);
      return { items: data.items, item: data.items[key] || null };
    }

    const existing = data.items[key];
    const base = {
      key,
      tmdb_id: payload.tmdbId || existing?.tmdb_id,
      media_type: mediaType,
      douban_id: payload.doubanId || existing?.douban_id,
      title: payload.title,
      year: payload.year,
      cover: payload.cover,
      source: payload.source,
      id: payload.id,
      watched_at: Date.now(),
    };
    let item: WatchStatus;
    if (mediaType === 'tv') {
      item = applyEpisodeWatched(existing, {
        ...base,
        media_type: 'tv',
        episodeIndex1Based: payload.episodeIndex || 1,
        knownEpisodeCount:
          payload.knownEpisodeCount || existing?.known_episode_count,
      });
    } else {
      item = applyMovieWatched(existing, base);
    }
    data.items[key] = item;
    writeLocal(data);
    return { items: data.items, item };
  }

  const res = await fetch('/api/watch-status', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'watch-status failed');
  }
  const json = await res.json();
  window.dispatchEvent(
    new CustomEvent('watchStatusUpdated', { detail: json.items || {} }),
  );
  return json;
}

export { buildWatchKey };
