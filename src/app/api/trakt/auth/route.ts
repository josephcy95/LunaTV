import { NextRequest, NextResponse } from 'next/server';
import { getAuthInfoFromCookie } from '@/lib/auth';
import { buildTraktAuthorizeUrl, getTraktAppCredentials } from '@/lib/trakt';
import { createHash, randomBytes } from 'crypto';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const auth = getAuthInfoFromCookie(request);
  if (!auth?.username) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const creds = await getTraktAppCredentials();
  if (!creds) {
    return NextResponse.json(
      { error: '管理员尚未配置 Trakt Client ID/Secret' },
      { status: 400 },
    );
  }

  const origin = request.nextUrl.origin;
  const redirectUri = `${origin}/api/trakt/callback`;
  const nonce = randomBytes(16).toString('hex');
  const state = Buffer.from(
    JSON.stringify({ u: auth.username, n: nonce }),
  ).toString('base64url');

  const url = buildTraktAuthorizeUrl(creds.clientId, redirectUri, state);
  const res = NextResponse.redirect(url);
  // short-lived cookie to validate callback
  res.cookies.set(
    'trakt_oauth_state',
    createHash('sha256').update(state).digest('hex'),
    {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 600,
    },
  );
  return res;
}
