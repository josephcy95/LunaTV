import {
  mergeCandidatesById,
  normalizeTitle,
  pickBestTMDBCandidate,
  rankTMDBCandidates,
  scoreTMDBCandidate,
  shouldFetchAlternativeTitles,
  titleSimilarity,
  type TMDBSearchCandidate,
} from './tmdb-match';

describe('normalizeTitle', () => {
  it('strips punctuation and lowercases', () => {
    expect(normalizeTitle('  The Wailing: 哭声 ')).toBe('the wailing 哭声');
  });
});

describe('titleSimilarity', () => {
  it('exact CJK match', () => {
    expect(titleSimilarity('哭声', '哭声')).toBe(1);
  });
  it('CJK contains (partial)', () => {
    expect(titleSimilarity('哭声', '夜半哭声')).toBeGreaterThan(0.5);
    expect(titleSimilarity('哭声', '夜半哭声')).toBeLessThan(1);
  });
  it('latin exact / contains', () => {
    expect(titleSimilarity('Obsession', 'Obsession')).toBe(1);
    expect(titleSimilarity('Obsession', 'The Obsession')).toBeGreaterThan(0.6);
  });
});

/**
 * Case 1: Douban/Chinese "哭声" (2016) must pick The Wailing (293670)
 * over 夜半哭声 Who is Crying at Midnight (443845).
 * Correct hit has alt title 哭声; wrong hit has primary 夜半哭声.
 */
describe('Korean 2016 哭声 → The Wailing (293670)', () => {
  const wrong: TMDBSearchCandidate = {
    id: 443845,
    title: '夜半哭声',
    original_title: '夜半哭声',
    release_date: '2016-09-02',
    popularity: 2.1,
    vote_count: 5,
  };
  const correct: TMDBSearchCandidate = {
    id: 293670,
    title: '哭声',
    original_title: '곡성',
    release_date: '2016-05-12',
    popularity: 28.4,
    vote_count: 1800,
    // Without alts, localized title may already be 哭声 in zh-CN;
    // also cover English-localized search where primary is "The Wailing"
  };
  const correctEn: TMDBSearchCandidate = {
    id: 293670,
    title: 'The Wailing',
    original_title: '곡성',
    release_date: '2016-05-12',
    popularity: 28.4,
    vote_count: 1800,
    alternativeTitles: ['哭声', '哭聲', 'Gokseong'],
  };

  it('prefers zh-CN primary title 哭声 over 夜半哭声', () => {
    const best = pickBestTMDBCandidate([wrong, correct], {
      query: '哭声',
      year: '2016',
      mediaType: 'movie',
    });
    expect(best?.candidate.id).toBe(293670);
  });

  it('prefers The Wailing when Douban title only in alternative_titles', () => {
    const ranked = rankTMDBCandidates([wrong, correctEn], {
      query: '哭声',
      year: '2016',
      mediaType: 'movie',
    });
    // Without alts applied yet, wrong may lead on contains(哭声)
    // After alts on correct:
    const withAlts = rankTMDBCandidates([wrong, correctEn], {
      query: '哭声',
      secondaryQuery: '哭声',
      year: '2016',
      mediaType: 'movie',
    });
    expect(withAlts[0].candidate.id).toBe(293670);
    expect(withAlts[0].score).toBeGreaterThan(withAlts[1].score);
  });

  it('signals alt-title fetch when primary titles are ambiguous', () => {
    const enNoAlt: TMDBSearchCandidate = {
      ...correctEn,
      alternativeTitles: undefined,
    };
    const ranked = rankTMDBCandidates([wrong, enNoAlt], {
      query: '哭声',
      year: '2016',
      mediaType: 'movie',
    });
    expect(shouldFetchAlternativeTitles(ranked)).toBe(true);
  });
});

/**
 * Case 2: Douban "痴迷" (2026) must pick Obsession (1339713)
 * over 我為妳痴迷 I Am Crazy About You (590570, 1971).
 */
describe('2026 痴迷 → Obsession (1339713)', () => {
  const wrong: TMDBSearchCandidate = {
    id: 590570,
    title: '我為妳痴迷',
    original_title: '我為妳痴迷',
    release_date: '1971-11-05',
    popularity: 0.6,
    vote_count: 0,
  };
  const correct: TMDBSearchCandidate = {
    id: 1339713,
    title: '痴迷',
    original_title: 'Obsession',
    release_date: '2026-05-15',
    popularity: 45,
    vote_count: 1200,
  };
  const correctEn: TMDBSearchCandidate = {
    id: 1339713,
    title: 'Obsession',
    original_title: 'Obsession',
    release_date: '2026-05-15',
    popularity: 45,
    vote_count: 1200,
    alternativeTitles: ['痴迷', '爱你致死不渝', '痴爱成魔'],
  };

  it('year + title beat old Chinese title that merely contains query', () => {
    // API order often puts 590570 first when searching 痴迷 without year
    const best = pickBestTMDBCandidate([wrong, correct], {
      query: '痴迷',
      year: '2026',
      mediaType: 'movie',
    });
    expect(best?.candidate.id).toBe(1339713);
    const wrongScore = scoreTMDBCandidate(wrong, {
      query: '痴迷',
      year: '2026',
      mediaType: 'movie',
    });
    expect(wrongScore.breakdown.year).toBeLessThan(0);
  });

  it('still picks Obsession via alt titles when localized title is English', () => {
    const best = pickBestTMDBCandidate([wrong, correctEn], {
      query: '痴迷',
      secondaryQuery: 'Obsession',
      year: '2026',
      mediaType: 'movie',
    });
    expect(best?.candidate.id).toBe(1339713);
  });

  it('falls back to best available rather than null when only weak hits exist', () => {
    const onlyOld = pickBestTMDBCandidate([wrong], {
      query: '痴迷',
      year: '2026',
      mediaType: 'movie',
    });
    expect(onlyOld?.candidate.id).toBe(590570);
  });
});

describe('mergeCandidatesById', () => {
  it('dedupes and keeps first base fields', () => {
    const a = mergeCandidatesById(
      [{ id: 1, title: 'A', popularity: 1 }],
      [
        { id: 1, title: 'B', alternativeTitles: ['X'] },
        { id: 2, title: 'C' },
      ],
    );
    expect(a).toHaveLength(2);
    expect(a.find((c) => c.id === 1)?.title).toBe('A');
    expect(a.find((c) => c.id === 1)?.alternativeTitles).toEqual(['X']);
  });
});
