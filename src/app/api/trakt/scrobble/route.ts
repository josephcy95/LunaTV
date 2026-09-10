/* eslint-disable no-console */
import { NextRequest, NextResponse } from 'next/server';
import { getAuthInfoFromCookie } from '@/lib/auth';
import { dbManager } from '@/lib/db';
import { getTraktAppCredentials, traktScrobble } from '@/lib/trakt';
import type { WatchMediaType } from '@/lib/watchStatus';

export const runtime = 'nodejs';

/** Optional live scrobble: start | pause | stop. Local watch still independent. */
export async function POST(request: NextRequest) {
  const auth = getAuthInfoFromCookie(request);
  if (!auth?.username) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  if (!body?.action || !body?.tmdbId) {
    return NextResponse.json(
      { error: 'action + tmdbId required' },
      { status: 400 },
    );
  }
  const creds = await getTraktAppCredentials();
  const tokens = await dbManager.getUserTraktTokens(auth.username);
  if (!creds || !tokens?.access_token) {
    return NextResponse.json({ skipped: true, reason: 'not_connected' });
  }
  const result = await traktScrobble(
    body.action as 'start' | 'pause' | 'stop',
    tokens,
    creds.clientId,
    {
      mediaType: (body.mediaType as WatchMediaType) || 'movie',
      tmdbId: Number(body.tmdbId),
      progress: Number(body.progress) || 0,
      season: body.season ? Number(body.season) : undefined,
      episode: body.episode ? Number(body.episode) : undefined,
    },
  );
  return NextResponse.json(result);
}
