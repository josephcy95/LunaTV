import {
  applyEpisodeWatched,
  applyMovieWatched,
  applyUserRating,
  buildWatchKey,
  clampUserRating,
  shouldAutoMarkWatched,
  unmarkEpisode,
  WATCHED_PROGRESS_THRESHOLD,
} from './watchStatus';

describe('buildWatchKey', () => {
  it('prefers tmdb + media type', () => {
    expect(buildWatchKey({ tmdbId: 42, mediaType: 'tv', doubanId: 1 })).toBe(
      'tv:42',
    );
  });
  it('falls back to douban then source', () => {
    expect(buildWatchKey({ doubanId: 9 })).toBe('douban:9');
    expect(buildWatchKey({ source: 'foo', id: 'bar' })).toBe('src:foo+bar');
  });
});

describe('shouldAutoMarkWatched', () => {
  it('marks at threshold', () => {
    expect(shouldAutoMarkWatched(80, 100)).toBe(true);
    expect(shouldAutoMarkWatched(50, 100)).toBe(false);
    expect(WATCHED_PROGRESS_THRESHOLD).toBe(0.8);
  });
  it('marks near end', () => {
    expect(shouldAutoMarkWatched(3500, 3600)).toBe(true);
  });
});

describe('applyEpisodeWatched / unmark', () => {
  it('auto-completes when all known episodes watched', () => {
    let s = applyEpisodeWatched(undefined, {
      key: 'tv:1',
      media_type: 'tv',
      title: 'Show',
      episodeIndex1Based: 1,
      knownEpisodeCount: 2,
    });
    expect(s.status).toBe('watching');
    s = applyEpisodeWatched(s, {
      key: 'tv:1',
      media_type: 'tv',
      title: 'Show',
      episodeIndex1Based: 2,
      knownEpisodeCount: 2,
    });
    expect(s.status).toBe('completed');
    const cleared = unmarkEpisode(s, 2);
    expect(cleared?.status).toBe('watching');
  });
});

describe('applyMovieWatched', () => {
  it('sets watched', () => {
    const s = applyMovieWatched(undefined, {
      key: 'movie:1',
      media_type: 'movie',
      title: 'Film',
      watched_at: 0,
    });
    expect(s.status).toBe('watched');
  });
});

describe('clampUserRating / applyUserRating', () => {
  it('clamps 1-10 and stores rating', () => {
    expect(clampUserRating(7.6)).toBe(8);
    expect(clampUserRating(0)).toBeUndefined();
    expect(clampUserRating(11)).toBeUndefined();
    const item = applyUserRating(undefined, {
      key: 'movie:1',
      media_type: 'movie',
      title: 'Film',
      rating: 9,
    });
    expect(item.rating).toBe(9);
    expect(item.status).toBe('watched');
  });
});
