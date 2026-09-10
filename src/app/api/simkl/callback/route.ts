/* eslint-disable no-console */
import { NextRequest, NextResponse } from 'next/server';
import { getAuthInfoFromCookie } from '@/lib/auth';
import { dbManager } from '@/lib/db';
import {
  exchangeSimklCode,
  fetchSimklUsername,
  getSimklAppCredentials,
  simklFetchWatched,
} from '@/lib/simkl';
import {
  applyEpisodeWatched,
  applyMovieWatched,
  applyUserRating,
  type UserWatchData,
} from '@/lib/watchStatus';
import { createHash } from 'crypto';

export const runtime = 'nodejs';

async function importSimklWatched(
  username: string,
  clientId: string,
  tokens: any,
) {
  try {
    const { items: imported, lastSync } = await simklFetchWatched(
      tokens,
      clientId,
    );
    const raw = await dbManager.getUserWatchData(username);
    const data: UserWatchData =
      raw && typeof raw === 'object' && raw.items ? raw : { items: {} };
    let changed = 0;
    for (const row of imported) {
      const key = `${row.mediaType}:${row.tmdbId}`;
      const existing = data.items[key];
      if (existing) {
        // Local wins on conflict — only fill simkl attribution gaps
        let touched = false;
        if (!existing.simkl_id && row.simklId) {
          existing.simkl_id = row.simklId;
          touched = true;
        }
        if (!existing.simkl_slug && row.slug) {
          existing.simkl_slug = row.slug;
          touched = true;
        }
        if (existing.rating == null && row.rating) {
          existing.rating = row.rating;
          existing.rating_updated_at = Date.now();
          touched = true;
        }
        if (touched) {
          existing.updated_at = Date.now();
          data.items[key] = existing;
          changed += 1;
        }
        continue;
      }
      if (row.mediaType === 'movie') {
        let item = applyMovieWatched(undefined, {
          key,
          tmdb_id: row.tmdbId,
          media_type: 'movie',
          title: row.title,
          year: row.year,
          watched_at: row.watchedAt || Date.now(),
        });
        if (row.simklId) item.simkl_id = row.simklId;
        if (row.slug) item.simkl_slug = row.slug;
        if (row.rating) {
          item = applyUserRating(item, {
            key,
            tmdb_id: row.tmdbId,
            media_type: 'movie',
            title: row.title,
            year: row.year,
            rating: row.rating,
          });
        }
        data.items[key] = item;
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
        if (row.simklId) item.simkl_id = row.simklId;
        if (row.slug) item.simkl_slug = row.slug;
        if (row.rating) {
          item = applyUserRating(item, {
            key,
            tmdb_id: row.tmdbId,
            media_type: 'tv',
            title: row.title,
            year: row.year,
            rating: row.rating,
            status: item.status,
          });
        }
        data.items[key] = item;
      }
      changed += 1;
    }
    if (changed > 0) {
      await dbManager.saveUserWatchData(username, data);
    }
    if (lastSync) {
      await dbManager.saveUserSimklTokens(username, {
        ...tokens,
        last_sync: lastSync,
      });
    }
    console.log(`Simkl import: ${changed} items touched for ${username}`);
  } catch (e) {
    console.warn('Simkl watched pull failed — connect still succeeds', e);
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
    return NextResponse.redirect(new URL('/watched?simkl=error', request.url));
  }

  const expected = request.cookies.get('simkl_oauth_state')?.value;
  const actual = createHash('sha256').update(state).digest('hex');
  if (!expected || expected !== actual) {
    return NextResponse.redirect(new URL('/watched?simkl=state', request.url));
  }

  let parsed: { u?: string };
  try {
    parsed = JSON.parse(Buffer.from(state, 'base64url').toString('utf8'));
  } catch {
    return NextResponse.redirect(new URL('/watched?simkl=state', request.url));
  }
  if (parsed.u !== auth.username) {
    return NextResponse.redirect(new URL('/watched?simkl=user', request.url));
  }

  const creds = await getSimklAppCredentials();
  if (!creds) {
    return NextResponse.redirect(new URL('/watched?simkl=config', request.url));
  }

  try {
    const redirectUri = `${request.nextUrl.origin}/api/simkl/callback`;
    const tokens = await exchangeSimklCode({
      code,
      redirectUri,
      clientId: creds.clientId,
      clientSecret: creds.clientSecret,
    });
    const username = await fetchSimklUsername(
      creds.clientId,
      tokens.access_token,
    );
    const saved = {
      ...tokens,
      simkl_username: username,
    };
    await dbManager.saveUserSimklTokens(auth.username, saved);
    // Best-effort pull (local wins on conflict)
    await importSimklWatched(auth.username, creds.clientId, saved);
  } catch {
    return NextResponse.redirect(
      new URL('/watched?simkl=exchange', request.url),
    );
  }

  const res = NextResponse.redirect(
    new URL('/watched?simkl=connected', request.url),
  );
  res.cookies.set('simkl_oauth_state', '', { path: '/', maxAge: 0 });
  return res;
}
