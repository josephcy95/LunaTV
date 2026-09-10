/* eslint-disable no-console */
import { NextRequest, NextResponse } from 'next/server';
import { getAuthInfoFromCookie } from '@/lib/auth';
import { dbManager } from '@/lib/db';
import { importSimklWatched } from '@/lib/simklImport';
import {
  fetchSimklUsername,
  getSimklAppCredentials,
  pollSimklPin,
  requestSimklPin,
} from '@/lib/simkl';

export const runtime = 'nodejs';

/** Start PIN flow — Client ID only (no secret). */
export async function POST(request: NextRequest) {
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
  try {
    const pin = await requestSimklPin(creds.clientId);
    return NextResponse.json({
      user_code: pin.user_code,
      verification_uri: pin.verification_uri,
      expires_in: pin.expires_in,
      interval: pin.interval,
    });
  } catch (e: any) {
    console.warn('Simkl PIN start failed', e?.message || e);
    return NextResponse.json(
      { error: e?.message || 'PIN request failed' },
      { status: 502 },
    );
  }
}

/**
 * Poll PIN until authorized / pending / expired.
 * On success: store tokens + pull watched (local wins), same as callback.
 */
export async function GET(request: NextRequest) {
  const auth = getAuthInfoFromCookie(request);
  if (!auth?.username) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userCode = request.nextUrl.searchParams.get('code')?.trim();
  if (!userCode) {
    return NextResponse.json({ error: 'code required' }, { status: 400 });
  }
  const creds = await getSimklAppCredentials();
  if (!creds) {
    return NextResponse.json(
      { error: '管理员尚未配置 Simkl Client ID' },
      { status: 400 },
    );
  }
  try {
    const result = await pollSimklPin(creds.clientId, userCode);
    if (result.status === 'pending') {
      return NextResponse.json({ status: 'pending' });
    }
    if (result.status === 'expired') {
      return NextResponse.json({ status: 'expired' });
    }
    const username = await fetchSimklUsername(
      creds.clientId,
      result.tokens.access_token,
    );
    const saved = {
      ...result.tokens,
      simkl_username: username,
    };
    await dbManager.saveUserSimklTokens(auth.username, saved);
    await importSimklWatched(auth.username, creds.clientId, saved);
    return NextResponse.json({
      status: 'authorized',
      simklUsername: username || null,
    });
  } catch (e: any) {
    console.warn('Simkl PIN poll failed', e?.message || e);
    return NextResponse.json(
      { error: e?.message || 'PIN poll failed' },
      { status: 502 },
    );
  }
}
