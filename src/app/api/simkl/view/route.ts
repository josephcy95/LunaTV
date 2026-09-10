import { NextRequest, NextResponse } from 'next/server';
import { buildSimklViewUrl, getSimklAppCredentials } from '@/lib/simkl';
import type { WatchMediaType } from '@/lib/watchStatus';

export const runtime = 'nodejs';

/** Public attribution redirect → Simkl page (uses admin client_id). */
export async function GET(request: NextRequest) {
  const creds = await getSimklAppCredentials();
  if (!creds) {
    return NextResponse.json(
      { error: 'Simkl not configured' },
      { status: 400 },
    );
  }
  const sp = request.nextUrl.searchParams;
  const tmdbId = Number(sp.get('tmdb'));
  if (!tmdbId) {
    return NextResponse.json({ error: 'tmdb required' }, { status: 400 });
  }
  const mediaType = (sp.get('type') as WatchMediaType) || 'movie';
  const url = buildSimklViewUrl({
    clientId: creds.clientId,
    mediaType,
    tmdbId,
    title: sp.get('title') || undefined,
    year: sp.get('year') || undefined,
    simklId: sp.get('simkl') ? Number(sp.get('simkl')) : undefined,
    slug: sp.get('slug') || undefined,
  });
  return NextResponse.redirect(url, 302);
}
