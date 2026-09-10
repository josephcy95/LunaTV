import { NextRequest, NextResponse } from 'next/server';
import { getAuthInfoFromCookie } from '@/lib/auth';
import { dbManager } from '@/lib/db';
import { getTraktAppCredentials } from '@/lib/trakt';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const auth = getAuthInfoFromCookie(request);
  if (!auth?.username) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const creds = await getTraktAppCredentials();
  const tokens = await dbManager.getUserTraktTokens(auth.username);
  return NextResponse.json({
    appConfigured: Boolean(creds),
    connected: Boolean(tokens?.access_token),
    traktUsername: tokens?.trakt_username || null,
  });
}

export async function DELETE(request: NextRequest) {
  const auth = getAuthInfoFromCookie(request);
  if (!auth?.username) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  await dbManager.deleteUserTraktTokens(auth.username);
  return NextResponse.json({ success: true, connected: false });
}
