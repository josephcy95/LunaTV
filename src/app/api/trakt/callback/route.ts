import { NextRequest, NextResponse } from 'next/server';
import { getAuthInfoFromCookie } from '@/lib/auth';
import { dbManager } from '@/lib/db';
import {
  exchangeTraktCode,
  fetchTraktUsername,
  getTraktAppCredentials,
} from '@/lib/trakt';
import { createHash } from 'crypto';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const auth = getAuthInfoFromCookie(request);
  if (!auth?.username) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');
  const err = request.nextUrl.searchParams.get('error');
  if (err || !code || !state) {
    return NextResponse.redirect(new URL('/?trakt=error', request.url));
  }

  const expected = request.cookies.get('trakt_oauth_state')?.value;
  const actual = createHash('sha256').update(state).digest('hex');
  if (!expected || expected !== actual) {
    return NextResponse.redirect(new URL('/?trakt=state', request.url));
  }

  let parsed: { u?: string };
  try {
    parsed = JSON.parse(Buffer.from(state, 'base64url').toString('utf8'));
  } catch {
    return NextResponse.redirect(new URL('/?trakt=state', request.url));
  }
  if (parsed.u !== auth.username) {
    return NextResponse.redirect(new URL('/?trakt=user', request.url));
  }

  const creds = await getTraktAppCredentials();
  if (!creds) {
    return NextResponse.redirect(new URL('/?trakt=config', request.url));
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
    await dbManager.saveUserTraktTokens(auth.username, {
      ...tokens,
      trakt_username: username,
    });
  } catch {
    return NextResponse.redirect(new URL('/?trakt=exchange', request.url));
  }

  const res = NextResponse.redirect(new URL('/?trakt=connected', request.url));
  res.cookies.set('trakt_oauth_state', '', { path: '/', maxAge: 0 });
  return res;
}
