/**
 * Soft TMDB title/year matching.
 * Prefer correct year + title/alt-title agreement without hard-rejecting common titles.
 */

export type TMDBMediaType = 'movie' | 'tv';

export interface TMDBSearchCandidate {
  id: number;
  title?: string | null;
  name?: string | null;
  original_title?: string | null;
  original_name?: string | null;
  release_date?: string | null;
  first_air_date?: string | null;
  popularity?: number | null;
  vote_count?: number | null;
  vote_average?: number | null;
  backdrop_path?: string | null;
  poster_path?: string | null;
  overview?: string | null;
  /** Optional alternative titles (from /alternative_titles) */
  alternativeTitles?: string[];
}

export interface TMDBMatchQuery {
  /** Primary search string (cleaned title / original_title) */
  query: string;
  /** Secondary display title (e.g. Douban Chinese title) */
  secondaryQuery?: string | null;
  year?: string | null;
  mediaType: TMDBMediaType;
}

export interface ScoredCandidate {
  candidate: TMDBSearchCandidate;
  score: number;
  breakdown: {
    year: number;
    title: number;
    altTitle: number;
    popularity: number;
  };
}

/** Modest floor — below this we still fall back to best available when results exist. */
export const TMDB_MATCH_MODEST_THRESHOLD = 28;

const CJK_RE = /[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff]/;

export function normalizeTitle(input: string | null | undefined): string {
  if (!input) return '';
  return (
    input
      .normalize('NFKC')
      .toLowerCase()
      // strip common season / year suffixes that sometimes leak into titles
      .replace(/\s*第[一二三四五六七八九十\d]+季.*$/u, '')
      .replace(/\s*season\s*\d+.*/i, '')
      .replace(/["""''`´]/g, '')
      .replace(/[：:·・／/\\|_|—–\-]+/g, ' ')
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

function hasCjk(s: string): boolean {
  return CJK_RE.test(s);
}

/** Dice coefficient on character bigrams — works for CJK and Latin. */
function diceCoefficient(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) {
    return a.includes(b) || b.includes(a) ? 0.7 : 0;
  }
  const bigrams = (s: string): Map<string, number> => {
    const m = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) {
      const bg = s.slice(i, i + 2);
      m.set(bg, (m.get(bg) || 0) + 1);
    }
    return m;
  };
  const A = bigrams(a);
  const B = bigrams(b);
  let overlap = 0;
  for (const [bg, count] of A) {
    const other = B.get(bg);
    if (other) overlap += Math.min(count, other);
  }
  return (2 * overlap) / (a.length - 1 + (b.length - 1));
}

/**
 * Soft title similarity in [0, 1].
 * Exact / contains get strong credit; otherwise bigram Dice.
 */
export function titleSimilarity(
  queryRaw: string,
  candidateRaw: string,
): number {
  const q = normalizeTitle(queryRaw);
  const c = normalizeTitle(candidateRaw);
  if (!q || !c) return 0;
  if (q === c) return 1;

  // CJK: exact is perfect; substring gets length-scaled credit (soft — avoid
  // over-crediting false friends like 哭声 ⊂ 夜半哭声 vs exact alt 哭声).
  if (hasCjk(q) || hasCjk(c)) {
    if (q.includes(c) || c.includes(q)) {
      const shorter = Math.min(q.length, c.length);
      const longer = Math.max(q.length, c.length);
      const ratio = shorter / longer;
      // equal-ish contains (~0.85); half-length substring ~0.55
      return 0.25 + 0.6 * ratio;
    }
    return diceCoefficient(q.replace(/\s+/g, ''), c.replace(/\s+/g, ''));
  }

  if (q.includes(c) || c.includes(q)) {
    const shorter = Math.min(q.length, c.length);
    const longer = Math.max(q.length, c.length);
    return 0.6 + 0.4 * (shorter / longer);
  }

  // token overlap for multi-word English titles
  const qTokens = new Set(q.split(' ').filter(Boolean));
  const cTokens = new Set(c.split(' ').filter(Boolean));
  if (qTokens.size && cTokens.size) {
    let inter = 0;
    for (const t of qTokens) if (cTokens.has(t)) inter++;
    const union = qTokens.size + cTokens.size - inter;
    const jaccard = union ? inter / union : 0;
    const dice = diceCoefficient(q, c);
    return Math.max(jaccard, dice);
  }

  return diceCoefficient(q, c);
}

export function extractCandidateYear(
  candidate: TMDBSearchCandidate,
  mediaType: TMDBMediaType,
): number | null {
  const date =
    mediaType === 'movie'
      ? candidate.release_date
      : candidate.first_air_date || candidate.release_date;
  if (!date || date.length < 4) return null;
  const y = parseInt(date.slice(0, 4), 10);
  return Number.isFinite(y) ? y : null;
}

export function candidateDisplayTitles(
  candidate: TMDBSearchCandidate,
  mediaType: TMDBMediaType,
): string[] {
  const primary =
    mediaType === 'movie'
      ? [candidate.title, candidate.original_title]
      : [candidate.name, candidate.original_name];
  const alts = candidate.alternativeTitles || [];
  return [...primary, ...alts].filter(
    (t): t is string => !!t && t.trim().length > 0,
  );
}

function bestTitleScore(queries: string[], titles: string[]): number {
  let best = 0;
  for (const q of queries) {
    if (!q) continue;
    for (const t of titles) {
      best = Math.max(best, titleSimilarity(q, t));
    }
  }
  return best;
}

/**
 * Year component: exact strong bonus; ±1 smaller; far-off strong penalty.
 * Missing year on either side is soft (small bonus / no penalty).
 */
export function scoreYear(
  queryYear: string | null | undefined,
  candidateYear: number | null,
): number {
  if (!queryYear) return 2; // no year provided — slight neutral
  const qy = parseInt(String(queryYear).slice(0, 4), 10);
  if (!Number.isFinite(qy)) return 2;
  if (candidateYear == null) return 4; // candidate missing year — don't ban
  const diff = Math.abs(qy - candidateYear);
  if (diff === 0) return 42;
  if (diff === 1) return 18;
  if (diff === 2) return 0;
  // Far off: strong penalty, but not absolute ban if title is near-perfect
  return -Math.min(55, 18 + (diff - 2) * 6);
}

function scorePopularity(candidate: TMDBSearchCandidate): number {
  const pop = candidate.popularity || 0;
  const votes = candidate.vote_count || 0;
  // Very weak tie-breaker (cap ~5)
  const popPart = Math.min(3, Math.log10(pop + 1));
  const votePart = Math.min(2, Math.log10(votes + 1) * 0.6);
  return popPart + votePart;
}

/**
 * Score a single TMDB search hit against the query.
 * Primary titles contribute to `title`; alternativeTitles to `altTitle`.
 */
export function scoreTMDBCandidate(
  candidate: TMDBSearchCandidate,
  matchQuery: TMDBMatchQuery,
): ScoredCandidate {
  const queries = [matchQuery.query, matchQuery.secondaryQuery || ''].filter(
    (q) => normalizeTitle(q).length > 0,
  );

  const mediaType = matchQuery.mediaType;
  const primaryTitles =
    mediaType === 'movie'
      ? [candidate.title, candidate.original_title]
      : [candidate.name, candidate.original_name];
  const primary = primaryTitles.filter((t): t is string => !!t && !!t.trim());
  const alts = (candidate.alternativeTitles || []).filter((t) => t && t.trim());

  const primarySim = bestTitleScore(queries, primary);
  const altSim = alts.length ? bestTitleScore(queries, alts) : 0;

  // Title points: map similarity → score. Near-perfect primary gets up to 55.
  const titleScore = primarySim * 55;
  // Alt titles: strong boost when Douban/Chinese title only appears in alts
  // (e.g. 哭声 → The Wailing). Cap so alts don't override everything alone.
  let altTitleScore = 0;
  // Exact/near-exact alt (Douban/Chinese) should beat weak primary substring matches
  if (altSim >= 0.95) altTitleScore = 50;
  else if (altSim >= 0.75) altTitleScore = 34;
  else if (altSim >= 0.55) altTitleScore = 18;
  else if (altSim > 0) altTitleScore = altSim * 12;

  // If primary is weak but alt is strong, still credit some "title agreement"
  // via alt — already in altTitleScore.

  const yearScore = scoreYear(
    matchQuery.year,
    extractCandidateYear(candidate, mediaType),
  );
  const popularityScore = scorePopularity(candidate);

  const score = titleScore + altTitleScore + yearScore + popularityScore;

  return {
    candidate,
    score,
    breakdown: {
      year: yearScore,
      title: titleScore,
      altTitle: altTitleScore,
      popularity: popularityScore,
    },
  };
}

export function rankTMDBCandidates(
  candidates: TMDBSearchCandidate[],
  matchQuery: TMDBMatchQuery,
): ScoredCandidate[] {
  return candidates
    .map((c) => scoreTMDBCandidate(c, matchQuery))
    .sort(
      (a, b) =>
        b.score - a.score ||
        (b.candidate.popularity || 0) - (a.candidate.popularity || 0),
    );
}

export interface PickBestOptions {
  /** Soft threshold; if best is below, still return best when allowFallback. Default modest. */
  threshold?: number;
  /** When true (default), return highest score even below threshold if any candidates. */
  allowFallback?: boolean;
}

/**
 * Pick the best candidate. Soft: prefers high score, never returns null
 * when candidates exist and allowFallback is true (default).
 */
export function pickBestTMDBCandidate(
  candidates: TMDBSearchCandidate[],
  matchQuery: TMDBMatchQuery,
  options: PickBestOptions = {},
): ScoredCandidate | null {
  if (!candidates.length) return null;
  const ranked = rankTMDBCandidates(candidates, matchQuery);
  const best = ranked[0];
  const threshold = options.threshold ?? TMDB_MATCH_MODEST_THRESHOLD;
  const allowFallback = options.allowFallback !== false;
  if (best.score >= threshold || allowFallback) return best;
  return null;
}

/** How many top ambiguous hits to enrich with alternative_titles. */
export const TMDB_ALT_TITLE_TOP_N = 3;

/**
 * True when top scores are close and primary title agreement is weak —
 * worth fetching alternative titles for disambiguation.
 */
export function shouldFetchAlternativeTitles(
  ranked: ScoredCandidate[],
): boolean {
  if (ranked.length < 2) {
    // Single result with weak primary title vs query → still try alts
    return ranked.length === 1 && ranked[0].breakdown.title < 35;
  }
  const [a, b] = ranked;
  const close = a.score - b.score < 18;
  const weakPrimary = a.breakdown.title < 40;
  const noAltYet = !a.candidate.alternativeTitles?.length;
  return noAltYet && (close || weakPrimary);
}

/**
 * Merge search result pages by id (first wins for base fields).
 */
export function mergeCandidatesById(
  ...lists: TMDBSearchCandidate[][]
): TMDBSearchCandidate[] {
  const map = new Map<number, TMDBSearchCandidate>();
  for (const list of lists) {
    for (const c of list) {
      if (!c?.id) continue;
      const existing = map.get(c.id);
      if (!existing) {
        map.set(c.id, { ...c });
      } else if (
        c.alternativeTitles?.length &&
        !existing.alternativeTitles?.length
      ) {
        map.set(c.id, {
          ...existing,
          alternativeTitles: c.alternativeTitles,
        });
      }
    }
  }
  return Array.from(map.values());
}
