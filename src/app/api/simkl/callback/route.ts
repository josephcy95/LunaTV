import { NextRequest, NextResponse } from 'next/server';
import { getAuthInfoFromCookie } from '@/lib/auth';
import { dbManager } from '@/lib/db';
import { importSimklWatched } from '@/lib/simklImport';
import {
  exchangeSimklCode,
  fetchSimklUsername,
  getSimklAppCredentials,
} from '@/lib/simkl';
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
  if (!creds?.clientSecret) {
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
