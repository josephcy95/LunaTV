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
      episodeIndex: opts.episodeIndex1Based,
    });
    await reload();
  }, [key, mediaType, opts, reload]);

  const toggle = useCallback(async () => {
    if (watched) await unmark();
    else await mark();
  }, [watched, mark, unmark]);

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
        });
        // Fire-and-forget Trakt live scrobble stop
        if (opts.tmdbId) {
          fetch('/api/trakt/scrobble', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'stop',
              tmdbId: opts.tmdbId,
              mediaType,
              progress: Math.min(
                100,
                Math.round((playTime / Math.max(totalTime, 1)) * 100),
              ),
              episode: opts.episodeIndex1Based,
            }),
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
    mark,
    unmark,
    toggle,
    reportProgress,
  };
}
