/* eslint-disable no-console */
import { NextRequest, NextResponse } from 'next/server';
import { getAuthInfoFromCookie } from '@/lib/auth';
import { getConfig } from '@/lib/config';
import { dbManager } from '@/lib/db';
import {
  applyEpisodeWatched,
  applyMovieWatched,
  buildWatchKey,
  unmarkEpisode,
  type UserWatchData,
  type WatchMediaType,
  type WatchStatus,
} from '@/lib/watchStatus';
import {
  getTraktAppCredentials,
  traktAddHistory,
  traktRemoveHistory,
  traktScrobble,
} from '@/lib/trakt';

export const runtime = 'nodejs';

async function requireUser(request: NextRequest) {
  const authInfo = getAuthInfoFromCookie(request);
  if (!authInfo?.username) return null;
  const config = await getConfig();
  if (authInfo.username !== process.env.USERNAME) {
    const user = config.UserConfig.Users.find(
      (u) => u.username === authInfo.username,
    );
    if (!user || user.banned) return null;
  }
  return authInfo.username;
}

async function loadWatchData(username: string): Promise<UserWatchData> {
  const data = await dbManager.getUserWatchData(username);
  if (data && typeof data === 'object' && data.items)
    return data as UserWatchData;
  return { items: {} };
}

async function maybeSyncTraktMark(
  username: string,
  item: WatchStatus,
  episodeIndex1Based?: number,
) {
  try {
    if (!item.tmdb_id) return;
    const creds = await getTraktAppCredentials();
    const tokens = await dbManager.getUserTraktTokens(username);
    if (!creds || !tokens?.access_token) return;
    if (item.media_type === 'movie') {
      await traktScrobble('stop', tokens, creds.clientId, {
        mediaType: 'movie',
        tmdbId: item.tmdb_id,
        progress: 100,
      });
      await traktAddHistory(tokens, creds.clientId, {
        mediaType: 'movie',
        tmdbId: item.tmdb_id,
      });
    } else {
      const ep = episodeIndex1Based || 1;
      await traktScrobble('stop', tokens, creds.clientId, {
        mediaType: 'tv',
        tmdbId: item.tmdb_id,
        progress: 100,
        season: 1,
        episode: ep,
      });
      await traktAddHistory(tokens, creds.clientId, {
        mediaType: 'tv',
        tmdbId: item.tmdb_id,
        season: 1,
        episode: ep,
      });
    }
  } catch (e) {
    console.warn('Trakt sync (mark) failed — local still saved', e);
  }
}

async function maybeSyncTraktUnmark(
  username: string,
  item: WatchStatus,
  episodeIndex1Based?: number,
) {
  try {
    if (!item.tmdb_id) return;
    const creds = await getTraktAppCredentials();
    const tokens = await dbManager.getUserTraktTokens(username);
    if (!creds || !tokens?.access_token) return;
    if (item.media_type === 'movie') {
      await traktRemoveHistory(tokens, creds.clientId, {
        mediaType: 'movie',
        tmdbId: item.tmdb_id,
      });
    } else {
      await traktRemoveHistory(tokens, creds.clientId, {
        mediaType: 'tv',
        tmdbId: item.tmdb_id,
        season: 1,
        episode: episodeIndex1Based || 1,
      });
    }
  } catch (e) {
    console.warn('Trakt sync (unmark) failed — local still saved', e);
  }
}

export async function GET(request: NextRequest) {
  const username = await requireUser(request);
  if (!username) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const data = await loadWatchData(username);
  const key = request.nextUrl.searchParams.get('key');
  if (key) {
    return NextResponse.json({ item: data.items[key] || null });
  }
  return NextResponse.json({ items: data.items });
}

export async function POST(request: NextRequest) {
  const username = await requireUser(request);
  if (!username) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const action = body.action as string;
  const mediaType = (body.mediaType as WatchMediaType) || 'movie';
  const key =
    (body.key as string) ||
    buildWatchKey({
      tmdbId: body.tmdbId,
      mediaType,
      doubanId: body.doubanId,
      source: body.source,
      id: body.id,
    });

  if (!key) {
    return NextResponse.json(
      { error: 'Missing identity (tmdb/douban/source)' },
      { status: 400 },
    );
  }

  const data = await loadWatchData(username);
  const existing = data.items[key];
  const syncTrakt = body.syncTrakt !== false;

  if (action === 'progress') {
    const playTime = Number(body.playTime) || 0;
    const totalTime = Number(body.totalTime) || 0;
    const { shouldAutoMarkWatched } = await import('@/lib/watchStatus');
    if (!shouldAutoMarkWatched(playTime, totalTime)) {
      return NextResponse.json({ skipped: true, items: data.items });
    }
  }

  if (action === 'unmark') {
    const prev = existing;
    if (!prev) {
      return NextResponse.json({ items: data.items });
    }
    const episodeIndex = body.episodeIndex
      ? Number(body.episodeIndex)
      : undefined;
    if (prev.media_type === 'tv' && episodeIndex) {
      const next = unmarkEpisode(prev, episodeIndex);
      if (next) data.items[key] = next;
      else delete data.items[key];
      if (syncTrakt) await maybeSyncTraktUnmark(username, prev, episodeIndex);
    } else {
      delete data.items[key];
      if (syncTrakt) await maybeSyncTraktUnmark(username, prev);
    }
    await dbManager.saveUserWatchData(username, data);
    return NextResponse.json({
      items: data.items,
      item: data.items[key] || null,
    });
  }

  const title = (body.title as string) || existing?.title || '';
  if (!title) {
    return NextResponse.json({ error: 'title required' }, { status: 400 });
  }

  const base = {
    key,
    tmdb_id: body.tmdbId ? Number(body.tmdbId) : existing?.tmdb_id,
    media_type: mediaType,
    douban_id: body.doubanId ? Number(body.doubanId) : existing?.douban_id,
    title,
    year: body.year || existing?.year,
    cover: body.cover || existing?.cover,
    source: body.source || existing?.source,
    id: body.id || existing?.id,
    watched_at: Date.now(),
  };

  let item: WatchStatus;
  if (mediaType === 'tv') {
    const episodeIndex = Number(body.episodeIndex) || 1;
    item = applyEpisodeWatched(existing, {
      ...base,
      media_type: 'tv',
      episodeIndex1Based: episodeIndex,
      knownEpisodeCount: body.knownEpisodeCount
        ? Number(body.knownEpisodeCount)
        : existing?.known_episode_count,
    });
    data.items[key] = item;
    await dbManager.saveUserWatchData(username, data);
    if (syncTrakt) await maybeSyncTraktMark(username, item, episodeIndex);
  } else {
    item = applyMovieWatched(existing, base);
    data.items[key] = item;
    await dbManager.saveUserWatchData(username, data);
    if (syncTrakt) await maybeSyncTraktMark(username, item);
  }

  return NextResponse.json({ items: data.items, item });
}

export async function DELETE(request: NextRequest) {
  const username = await requireUser(request);
  if (!username) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const key = request.nextUrl.searchParams.get('key');
  if (!key) {
    return NextResponse.json({ error: 'key required' }, { status: 400 });
  }
  const data = await loadWatchData(username);
  const prev = data.items[key];
  delete data.items[key];
  await dbManager.saveUserWatchData(username, data);
  if (prev) await maybeSyncTraktUnmark(username, prev);
  return NextResponse.json({ success: true, items: data.items });
}
