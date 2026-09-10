/* eslint-disable no-console */
import { NextRequest, NextResponse } from 'next/server';
import { getAuthInfoFromCookie } from '@/lib/auth';
import { dbManager } from '@/lib/db';
import {
  exchangeTraktCode,
  fetchTraktUsername,
  getTraktAppCredentials,
  traktFetchWatched,
} from '@/lib/trakt';
import {
  applyEpisodeWatched,
  applyMovieWatched,
  type UserWatchData,
} from '@/lib/watchStatus';
import { createHash } from 'crypto';

export const runtime = 'nodejs';

async function importTraktWatched(
  username: string,
  clientId: string,
  tokens: any,
) {
  try {
    const imported = await traktFetchWatched(tokens, clientId);
    const raw = await dbManager.getUserWatchData(username);
    const data: UserWatchData =
      raw && typeof raw === 'object' && raw.items ? raw : { items: {} };
    let changed = 0;
    for (const row of imported) {
      const key = `${row.mediaType}:${row.tmdbId}`;
      const existing = data.items[key];
      if (existing) {
        // Keep local as source of truth; only fill gaps
        if (!existing.cover && row.title) {
          /* no-op for cover */
        }
        continue;
      }
      if (row.mediaType === 'movie') {
        data.items[key] = applyMovieWatched(undefined, {
          key,
          tmdb_id: row.tmdbId,
          media_type: 'movie',
          title: row.title,
          year: row.year,
          watched_at: row.watchedAt || Date.now(),
        });
      } else {
        const epCount = Math.max(1, row.episodeCount || 1);
        let item = applyEpisodeWatched(undefined, {
          key,
          tmdb_id: row.tmdbId,
          media_type: 'tv',
          title: row.title,
          year: row.year,
          episodeIndex1Based: 1,
          knownEpisodeCount: row.knownEpisodeCount || epCount,
        });
        // Mark remaining episodes as watched without rewriting timestamps carefully
        for (let i = 2; i <= epCount; i++) {
          item = applyEpisodeWatched(item, {
            key,
            tmdb_id: row.tmdbId,
            media_type: 'tv',
            title: row.title,
            year: row.year,
            episodeIndex1Based: i,
            knownEpisodeCount: row.knownEpisodeCount || epCount,
          });
        }
        data.items[key] = item;
      }
      changed += 1;
    }
    if (changed > 0) {
      await dbManager.saveUserWatchData(username, data);
    }
    console.log(`Trakt import: ${changed} new items for ${username}`);
  } catch (e) {
    console.warn('Trakt watched pull failed — connect still succeeds', e);
  }
}

export async function GET(request: NextRequest) {
  const auth = getAuthInfoFromCookie(request);
  if (!auth?.username) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');
  const err = request.nextUrl.searchParams.get('error');
  if (err || !code || !state) {
    return NextResponse.redirect(new URL('/watched?trakt=error', request.url));
  }

  const expected = request.cookies.get('trakt_oauth_state')?.value;
  const actual = createHash('sha256').update(state).digest('hex');
  if (!expected || expected !== actual) {
    return NextResponse.redirect(new URL('/watched?trakt=state', request.url));
  }

  let parsed: { u?: string };
  try {
    parsed = JSON.parse(Buffer.from(state, 'base64url').toString('utf8'));
  } catch {
    return NextResponse.redirect(new URL('/watched?trakt=state', request.url));
  }
  if (parsed.u !== auth.username) {
    return NextResponse.redirect(new URL('/watched?trakt=user', request.url));
  }

  const creds = await getTraktAppCredentials();
  if (!creds) {
    return NextResponse.redirect(new URL('/watched?trakt=config', request.url));
  }

  try {
    const redirectUri = `${request.nextUrl.origin}/api/trakt/callback`;
    const tokens = await exchangeTraktCode({
      code,
      redirectUri,
      clientId: creds.clientId,
      clientSecret: creds.clientSecret,
    });
    const username = await fetchTraktUsername(
      creds.clientId,
      tokens.access_token,
    );
    const saved = {
      ...tokens,
      trakt_username: username,
    };
    await dbManager.saveUserTraktTokens(auth.username, saved);
    // Best-effort pull of watched history into local DB (local wins on conflict)
    await importTraktWatched(auth.username, creds.clientId, saved);
  } catch {
    return NextResponse.redirect(
      new URL('/watched?trakt=exchange', request.url),
    );
  }

  const res = NextResponse.redirect(
    new URL('/watched?trakt=connected', request.url),
  );
  res.cookies.set('trakt_oauth_state', '', { path: '/', maxAge: 0 });
  return res;
}
