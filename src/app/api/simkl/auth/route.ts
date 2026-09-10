import { NextRequest, NextResponse } from 'next/server';
import { getAuthInfoFromCookie } from '@/lib/auth';
import {
  buildSimklAuthorizeUrl,
  canUseSimklRedirectOAuth,
  getSimklAppCredentials,
} from '@/lib/simkl';
import { createHash, randomBytes } from 'crypto';

export const runtime = 'nodejs';

/**
 * Optional redirect OAuth fallback — only when origin is public https
 * and Client Secret is configured. Primary UX is PIN via /api/simkl/pin.
 */
export async function GET(request: NextRequest) {
  const auth = getAuthInfoFromCookie(request);
  if (!auth?.username) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const creds = await getSimklAppCredentials();
  if (!creds) {
    return NextResponse.json(
      { error: '管理员尚未配置 Simkl Client ID' },
      { status: 400 },
    );
  }

  const origin = request.nextUrl.origin;
  if (!canUseSimklRedirectOAuth(origin, creds.clientSecret)) {
    return NextResponse.json(
      {
        error:
          'Redirect OAuth 仅适用于公网 https。本地/局域网请使用 PIN 连接（Redirect URI = urn:ietf:wg:oauth:2.0:oob）。',
        usePin: true,
      },
      { status: 400 },
    );
  }

  const redirectUri = `${origin}/api/simkl/callback`;
  const nonce = randomBytes(16).toString('hex');
  const state = Buffer.from(
    JSON.stringify({ u: auth.username, n: nonce }),
  ).toString('base64url');

  const url = buildSimklAuthorizeUrl(creds.clientId, redirectUri, state);
  const res = NextResponse.redirect(url);
  res.cookies.set(
    'simkl_oauth_state',
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
