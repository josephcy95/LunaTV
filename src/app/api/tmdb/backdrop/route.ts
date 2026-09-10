import { NextRequest, NextResponse } from 'next/server';
import { getConfig } from '@/lib/config';
import { applyCorsProxy } from '@/lib/tmdb.client';
import { db } from '@/lib/db';
import {
  mergeCandidatesById,
  pickBestTMDBCandidate,
  rankTMDBCandidates,
  shouldFetchAlternativeTitles,
  TMDB_ALT_TITLE_TOP_N,
  type TMDBMediaType,
  type TMDBSearchCandidate,
} from '@/lib/tmdb-match';

export const runtime = 'nodejs';

const CACHE_TTL = 86400; // 24小时
const TOP_N = 8;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get('title')?.trim();
  const originalTitle = searchParams.get('original_title')?.trim();
  const year = searchParams.get('year')?.trim();
  const stype = searchParams.get('stype')?.trim(); // 'movie' | 'tv'

  if (!title && !originalTitle)
    return NextResponse.json({ data: null }, { status: 400 });

  const config = await getConfig();
  const apiKey = config.SiteConfig?.TMDBApiKey;
  if (!apiKey) return NextResponse.json({ data: null });

  // v2: soft scorer + year hint — bust poisoned first-result caches
  const cacheKey = `tmdb-backdrop-v2-${originalTitle || title}-${year || ''}-${stype || ''}`;

  // 服务端缓存 — ignore legacy entries missing tmdb id (needed for MDBList)
  const cached = await db.getCache(cacheKey);
  if (cached && cached.id) {
    return NextResponse.json(
      { data: cached },
      {
        headers: {
          'Cache-Control':
            'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800',
        },
      },
    );
  }

  const lang = config.SiteConfig?.TMDBLanguage || 'zh-CN';
  const base = 'https://api.themoviedb.org/3';

  const pickLogo = (logos: any[]) => {
    if (!logos?.length) return null;
    const sorted = logos
      .slice()
      .sort(
        (a, b) =>
          (b.vote_average || 0) - (a.vote_average || 0) ||
          (b.vote_count || 0) - (a.vote_count || 0),
      );
    const logo =
      sorted.find((l: any) => l.iso_639_1 === 'zh') ||
      sorted.find((l: any) => l.iso_639_1 === 'en') ||
      sorted[0];
    return logo?.file_path
      ? applyCorsProxy(
          `https://image.tmdb.org/t/p/w500${logo.file_path}`,
          config,
        )
      : null;
  };

  const fetchSearch = async (
    query: string,
    type: TMDBMediaType,
    withYear: boolean,
  ): Promise<TMDBSearchCandidate[]> => {
    const params = new URLSearchParams({
      api_key: apiKey,
      language: lang,
      query,
    });
    if (withYear && year) {
      if (type === 'movie') {
        // year is a soft-ish filter on TMDB search; primary_release_year is stricter
        params.set('year', year);
      } else {
        params.set('first_air_date_year', year);
      }
    }
    const res = await fetch(
      applyCorsProxy(`${base}/search/${type}?${params.toString()}`, config),
      { signal: AbortSignal.timeout(6000) },
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results || []).slice(0, TOP_N) as TMDBSearchCandidate[];
  };

  const fetchAltTitles = async (
    id: number,
    type: TMDBMediaType,
  ): Promise<string[]> => {
    try {
      const res = await fetch(
        applyCorsProxy(
          `${base}/${type}/${id}/alternative_titles?api_key=${apiKey}`,
          config,
        ),
        { signal: AbortSignal.timeout(5000) },
      );
      if (!res.ok) return [];
      const data = await res.json();
      const titles: string[] = [];
      // movie: { titles: [{ title, iso_3166_1 }] }
      // tv: { results: [{ title, iso_3166_1 }] }
      const list = data.titles || data.results || [];
      for (const row of list) {
        if (row?.title) titles.push(String(row.title));
      }
      return titles;
    } catch {
      return [];
    }
  };

  const enrichWithAltTitles = async (
    candidates: TMDBSearchCandidate[],
    type: TMDBMediaType,
    matchQuery: {
      query: string;
      secondaryQuery?: string | null;
      year?: string | null;
      mediaType: TMDBMediaType;
    },
  ): Promise<TMDBSearchCandidate[]> => {
    const ranked = rankTMDBCandidates(candidates, matchQuery);
    if (!shouldFetchAlternativeTitles(ranked)) return candidates;

    const top = ranked.slice(0, TMDB_ALT_TITLE_TOP_N);
    const enriched = await Promise.all(
      top.map(async (scored) => {
        const alts = await fetchAltTitles(scored.candidate.id, type);
        return {
          ...scored.candidate,
          alternativeTitles: alts,
        };
      }),
    );

    const byId = new Map(enriched.map((c) => [c.id, c]));
    return candidates.map((c) => byId.get(c.id) || c);
  };

  const buildPayload = async (
    hit: TMDBSearchCandidate,
    type: TMDBMediaType,
  ) => {
    const imagesRes = await fetch(
      applyCorsProxy(
        `${base}/${type}/${hit.id}/images?api_key=${apiKey}`,
        config,
      ),
      { signal: AbortSignal.timeout(6000) },
    );
    const images = imagesRes.ok ? await imagesRes.json() : null;
    const logoUrl = pickLogo(images?.logos || []);

    // TV 类型额外拿季数
    let numberOfSeasons: number | null = null;
    if (type === 'tv') {
      try {
        const detailRes = await fetch(
          applyCorsProxy(
            `${base}/tv/${hit.id}?api_key=${apiKey}&language=${lang}`,
            config,
          ),
          { signal: AbortSignal.timeout(6000) },
        );
        if (detailRes.ok) {
          const detail = await detailRes.json();
          numberOfSeasons = detail.number_of_seasons || null;
        }
      } catch {
        /* ignore */
      }
    }

    // English title for external sync (Simkl prefers English/TMDB title)
    let englishTitle: string | null = null;
    let imdbId: string | null = null;
    try {
      const enRes = await fetch(
        applyCorsProxy(
          `${base}/${type}/${hit.id}?api_key=${apiKey}&language=en&append_to_response=external_ids`,
          config,
        ),
        { signal: AbortSignal.timeout(6000) },
      );
      if (enRes.ok) {
        const en = await enRes.json();
        englishTitle =
          (type === 'movie' ? en.title : en.name) ||
          (type === 'movie' ? en.original_title : en.original_name) ||
          null;
        imdbId = en.external_ids?.imdb_id || en.imdb_id || null;
      }
    } catch {
      /* ignore */
    }
    if (!englishTitle) {
      englishTitle =
        (type === 'movie' ? hit.original_title : hit.original_name) ||
        (type === 'movie' ? hit.title : hit.name) ||
        null;
    }

    return {
      id: hit.id as number,
      mediaType: type as 'movie' | 'tv',
      backdrop: hit.backdrop_path
        ? applyCorsProxy(
            `https://image.tmdb.org/t/p/w1280${hit.backdrop_path}`,
            config,
          )
        : null,
      poster: hit.poster_path
        ? applyCorsProxy(
            `https://image.tmdb.org/t/p/w500${hit.poster_path}`,
            config,
          )
        : null,
      logo: logoUrl,
      title: (type === 'movie' ? hit.title : hit.name) || null,
      englishTitle,
      originalTitle:
        (type === 'movie' ? hit.original_title : hit.original_name) || null,
      imdbId,
      overview: hit.overview || null,
      rating: hit.vote_average
        ? parseFloat(Number(hit.vote_average).toFixed(1))
        : null,
      year:
        (type === 'movie' ? hit.release_date : hit.first_air_date)?.slice(
          0,
          4,
        ) || null,
      numberOfSeasons: numberOfSeasons,
    };
  };

  // 清理标题：去掉「第X季」「Season X」「S1」等后缀
  const cleanTitle = (t: string) =>
    t
      .replace(/\s*第[一二三四五六七八九十\d]+季.*$/u, '')
      .replace(/\s*Season\s*\d+.*/i, '')
      .replace(/\s*S\d{1,2}$/i, '')
      .replace(/\s*(19|20)\d{2}$/, '')
      .trim();

  const trySearch = async (query: string, type: TMDBMediaType) => {
    try {
      // Year as hint: search with year first, also merge unfiltered top results
      // so ±1 / missing-year titles stay in the pool for soft scoring.
      const withYear = year ? await fetchSearch(query, type, true) : [];
      const withoutYear = await fetchSearch(query, type, false);
      let candidates = mergeCandidatesById(withYear, withoutYear);
      if (!candidates.length) return null;

      const secondary =
        originalTitle && title && query === cleanTitle(originalTitle)
          ? title
          : originalTitle && title && query === cleanTitle(title)
            ? originalTitle
            : title && title !== query
              ? title
              : null;

      const matchQuery = {
        query,
        secondaryQuery: secondary ? cleanTitle(secondary) : null,
        year: year || null,
        mediaType: type,
      };

      candidates = await enrichWithAltTitles(candidates, type, matchQuery);

      const best = pickBestTMDBCandidate(candidates, matchQuery);
      if (!best) return null;

      return await buildPayload(best.candidate, type);
    } catch {
      return null;
    }
  };

  const searchQuery = cleanTitle(originalTitle || title!);
  const fallbackQuery = originalTitle && title ? cleanTitle(title) : null;

  // 根据 stype 决定搜索类型，没有 stype 则两种都搜
  const types: Array<'movie' | 'tv'> =
    stype === 'movie' ? ['movie'] : stype === 'tv' ? ['tv'] : ['movie', 'tv'];

  let data: any = null;
  for (const type of types) {
    data = await trySearch(searchQuery, type);
    if (data) break;
  }
  if (!data && fallbackQuery && fallbackQuery !== searchQuery) {
    for (const type of types) {
      data = await trySearch(fallbackQuery, type);
      if (data) break;
    }
  }

  // 写入服务端缓存
  if (data) await db.setCache(cacheKey, data, CACHE_TTL);

  return NextResponse.json(
    { data },
    {
      headers: {
        'Cache-Control':
          'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800',
      },
    },
  );
}
