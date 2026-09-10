import { NextRequest, NextResponse } from 'next/server';
import { getAuthInfoFromCookie } from '@/lib/auth';
import { dbManager } from '@/lib/db';
import { getSimklAppCredentials } from '@/lib/simkl';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const auth = getAuthInfoFromCookie(request);
  if (!auth?.username) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const creds = await getSimklAppCredentials();
  const tokens = await dbManager.getUserSimklTokens(auth.username);
  return NextResponse.json({
    appConfigured: Boolean(creds),
    connected: Boolean(tokens?.access_token),
    simklUsername: tokens?.simkl_username || null,
  });
}

export async function DELETE(request: NextRequest) {
  const auth = getAuthInfoFromCookie(request);
  if (!auth?.username) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  await dbManager.deleteUserSimklTokens(auth.username);
  return NextResponse.json({ success: true, connected: false });
}
