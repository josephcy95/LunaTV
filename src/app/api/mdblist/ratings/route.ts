import { NextRequest, NextResponse } from 'next/server';
import { fetchMDBListRatings, type MdbMediaType } from '@/lib/mdblist';

export const runtime = 'nodejs';

/**
 * GET /api/mdblist/ratings?tmdb_id=603&type=movie
 * Server-side only — API key never exposed to the client.
 * Cached aggressively by tmdbId (see src/lib/mdblist.ts).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tmdbIdRaw = searchParams.get('tmdb_id') || searchParams.get('tm');
  const typeRaw = (searchParams.get('type') || searchParams.get('m') || 'movie')
    .toLowerCase()
    .trim();

  const tmdbId = tmdbIdRaw ? parseInt(tmdbIdRaw, 10) : NaN;
  if (!Number.isFinite(tmdbId) || tmdbId <= 0) {
    return NextResponse.json({ error: 'tmdb_id required' }, { status: 400 });
  }

  const mediaType: MdbMediaType =
    typeRaw === 'tv' || typeRaw === 'show' ? 'show' : 'movie';

  const data = await fetchMDBListRatings(tmdbId, mediaType);

  return NextResponse.json(
    { data },
    {
      headers: {
        'Cache-Control':
          'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
      },
    },
  );
}
