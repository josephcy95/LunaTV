import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { getAvailableApiSites } from '@/lib/config';
import { searchApiPage } from '@/lib/downstream';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = getAuthInfoFromCookie(request);
  if (!auth?.username)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const q = params.get('q')?.trim() || '';
  const sourceKey = params.get('source')?.trim() || '';
  const page = Math.max(1, Number.parseInt(params.get('page') || '1', 10) || 1);
  if (!q || !sourceKey)
    return NextResponse.json(
      { error: 'q and source are required' },
      { status: 400 },
    );
  const sites = await getAvailableApiSites(auth.username);
  const site = sites.find((candidate) => candidate.key === sourceKey);
  if (!site) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const result = await searchApiPage(site, q, page, request.signal);
    const hasMore =
      result.pageCount !== undefined
        ? page < result.pageCount
        : result.results.length > 0;
    return NextResponse.json(
      { results: result.results, page, hasMore },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    if (request.signal.aborted) return new NextResponse(null, { status: 499 });
    console.error('search page failed', error);
    return NextResponse.json(
      { error: 'Search failed' },
      { status: 502, headers: { 'Cache-Control': 'private, no-store' } },
    );
  }
}
