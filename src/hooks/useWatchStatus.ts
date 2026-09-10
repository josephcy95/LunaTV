'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  buildWatchKey,
  fetchWatchStatuses,
  postWatchStatus,
} from '@/lib/watchStatus.client';
import type { WatchMediaType, WatchStatus } from '@/lib/watchStatus';
import {
  isEpisodeWatched,
  isItemWatched,
  shouldAutoMarkWatched,
} from '@/lib/watchStatus';

export function useWatchStatusList(enabled = true) {
  const [items, setItems] = useState<Record<string, WatchStatus>>({});
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const next = await fetchWatchStatuses();
      setItems(next);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    reload();
    const onUpdate = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && typeof detail === 'object') setItems(detail);
      else reload();
    };
    window.addEventListener('watchStatusUpdated', onUpdate);
    return () => window.removeEventListener('watchStatusUpdated', onUpdate);
  }, [enabled, reload]);

  const list = useMemo(
    () =>
      Object.values(items).sort(
        (a, b) => (b.updated_at || 0) - (a.updated_at || 0),
      ),
    [items],
  );

  return { items, list, loading, reload };
}

export function useCurrentWatchStatus(opts: {
  tmdbId?: number | null;
  mediaType?: WatchMediaType | null;
  doubanId?: number | null;
  source?: string;
  id?: string;
  title: string;
  year?: string;
  cover?: string;
  episodeIndex1Based?: number;
  knownEpisodeCount?: number;
  englishTitle?: string;
  imdbId?: string;
  enabled?: boolean;
}) {
  const { items, reload } = useWatchStatusList(opts.enabled !== false);
  const autoMarkedRef = useRef<string | null>(null);

  const key = useMemo(
    () =>
      buildWatchKey({
        tmdbId: opts.tmdbId,
        mediaType: opts.mediaType,
        doubanId: opts.doubanId,
        source: opts.source,
        id: opts.id,
      }),
    [opts.tmdbId, opts.mediaType, opts.doubanId, opts.source, opts.id],
  );

  const item = key ? items[key] : undefined;
  const mediaType: WatchMediaType =
    opts.mediaType ||
    (opts.knownEpisodeCount && opts.knownEpisodeCount > 1 ? 'tv' : 'movie');

  const watched =
    mediaType === 'tv' && opts.episodeIndex1Based
      ? isEpisodeWatched(item, opts.episodeIndex1Based)
      : isItemWatched(item);

  const showStatus = item?.status;

  const mark = useCallback(async () => {
    if (!key) return;
    await postWatchStatus({
      action: 'mark',
      tmdbId: opts.tmdbId,
      mediaType,
      doubanId: opts.doubanId,
      source: opts.source,
      id: opts.id,
      title: opts.title,
      year: opts.year,
      cover: opts.cover,
      episodeIndex: opts.episodeIndex1Based,
      knownEpisodeCount: opts.knownEpisodeCount,
      englishTitle: opts.englishTitle,
      imdbId: opts.imdbId,
    });
    await reload();
  }, [key, mediaType, opts, reload]);

  const unmark = useCallback(async () => {
    if (!key) return;
    await postWatchStatus({
      action: 'unmark',
      tmdbId: opts.tmdbId,
      mediaType,
      doubanId: opts.doubanId,
      source: opts.source,
      id: opts.id,
      title: opts.title,
      year: opts.year,
      episodeIndex: opts.episodeIndex1Based,
      englishTitle: opts.englishTitle,
      imdbId: opts.imdbId,
    });
    await reload();
  }, [key, mediaType, opts, reload]);

  const toggle = useCallback(async () => {
    if (watched) await unmark();
    else await mark();
  }, [watched, mark, unmark]);

  const setRating = useCallback(
    async (rating: number | null) => {
      if (!key || !opts.title) return;
      await postWatchStatus({
        action: 'rate',
        tmdbId: opts.tmdbId,
        mediaType,
        doubanId: opts.doubanId,
        source: opts.source,
        id: opts.id,
        title: opts.title,
        year: opts.year,
        cover: opts.cover,
        rating,
        englishTitle: opts.englishTitle,
        imdbId: opts.imdbId,
      });
      await reload();
    },
    [key, mediaType, opts, reload],
  );

  const setStatus = useCallback(
    async (status: import('@/lib/watchStatus').WatchShowStatus) => {
      if (!key || !opts.title) return;
      await postWatchStatus({
        action: 'setStatus',
        tmdbId: opts.tmdbId,
        mediaType,
        doubanId: opts.doubanId,
        source: opts.source,
        id: opts.id,
        title: opts.title,
        year: opts.year,
        cover: opts.cover,
        status,
      });
      await reload();
    },
    [key, mediaType, opts, reload],
  );

  /** Call from play-progress saver; auto-marks once per episode/key. */
  const reportProgress = useCallback(
    async (playTime: number, totalTime: number) => {
      if (!key || !opts.title) return;
      if (!shouldAutoMarkWatched(playTime, totalTime)) return;
      const markToken = `${key}:${opts.episodeIndex1Based || 0}`;
      if (autoMarkedRef.current === markToken) return;
      if (watched) {
        autoMarkedRef.current = markToken;
        return;
      }
      autoMarkedRef.current = markToken;
      try {
        await postWatchStatus({
          action: 'progress',
          tmdbId: opts.tmdbId,
          mediaType,
          doubanId: opts.doubanId,
          source: opts.source,
          id: opts.id,
          title: opts.title,
          year: opts.year,
          cover: opts.cover,
          episodeIndex: opts.episodeIndex1Based,
          knownEpisodeCount: opts.knownEpisodeCount,
          playTime,
          totalTime,
          englishTitle: opts.englishTitle,
          imdbId: opts.imdbId,
        });
        // Fire-and-forget live scrobble stop (Trakt + Simkl).
        // Simkl stop ≥80% marks watched; watch-status also POSTs /sync/history —
        // Simkl 409 already_watched is treated as success server-side.
        if (opts.tmdbId) {
          const progress = Math.min(
            100,
            Math.round((playTime / Math.max(totalTime, 1)) * 100),
          );
          const payload = {
            action: 'stop' as const,
            tmdbId: opts.tmdbId,
            mediaType,
            progress,
            episode: opts.episodeIndex1Based,
            title: opts.englishTitle || opts.title,
            year: opts.year,
            imdbId: opts.imdbId,
          };
          fetch('/api/trakt/scrobble', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          }).catch(() => {});
          fetch('/api/simkl/scrobble', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          }).catch(() => {});
        }
        await reload();
      } catch {
        autoMarkedRef.current = null;
      }
    },
    [key, mediaType, opts, reload, watched],
  );

  return {
    key,
    item,
    watched,
    showStatus,
    rating: item?.rating,
    mark,
    unmark,
    toggle,
    setRating,
    setStatus,
    reportProgress,
  };
}
