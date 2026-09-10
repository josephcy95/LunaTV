/* eslint-disable no-console */
import { dbManager } from '@/lib/db';
import { simklFetchWatched } from '@/lib/simkl';
import {
  applyEpisodeWatched,
  applyMovieWatched,
  applyUserRating,
  type UserSimklTokens,
  type UserWatchData,
} from '@/lib/watchStatus';

/**
 * Best-effort phase-1 pull after connect. Local wins on conflict.
 */
export async function importSimklWatched(
  username: string,
  clientId: string,
  tokens: UserSimklTokens,
) {
  try {
    const { items: imported, lastSync } = await simklFetchWatched(
      tokens,
      clientId,
    );
    const raw = await dbManager.getUserWatchData(username);
    const data: UserWatchData =
      raw && typeof raw === 'object' && raw.items ? raw : { items: {} };
    let changed = 0;
    for (const row of imported) {
      const key = `${row.mediaType}:${row.tmdbId}`;
      const existing = data.items[key];
      if (existing) {
        // Local wins on conflict — only fill simkl attribution gaps
        let touched = false;
        if (!existing.simkl_id && row.simklId) {
          existing.simkl_id = row.simklId;
          touched = true;
        }
        if (!existing.simkl_slug && row.slug) {
          existing.simkl_slug = row.slug;
          touched = true;
        }
        if (existing.rating == null && row.rating) {
          existing.rating = row.rating;
          existing.rating_updated_at = Date.now();
          touched = true;
        }
        if (touched) {
          existing.updated_at = Date.now();
          data.items[key] = existing;
          changed += 1;
        }
        continue;
      }
      if (row.mediaType === 'movie') {
        let item = applyMovieWatched(undefined, {
          key,
          tmdb_id: row.tmdbId,
          media_type: 'movie',
          title: row.title,
          year: row.year,
          watched_at: row.watchedAt || Date.now(),
        });
        if (row.simklId) item.simkl_id = row.simklId;
        if (row.slug) item.simkl_slug = row.slug;
        if (row.rating) {
          item = applyUserRating(item, {
            key,
            tmdb_id: row.tmdbId,
            media_type: 'movie',
            title: row.title,
            year: row.year,
            rating: row.rating,
          });
        }
        data.items[key] = item;
      } else {
        const epCount = Math.max(1, row.episodeCount || 1);
        let item = applyEpisodeWatched(undefined, {
          key,
          tmdb_id: row.tmdbId,
          media_type: 'tv',
          title: row.title,
          year: row.year,
          episodeIndex1Based: 1,
          knownEpisodeCount: row.knownEpisodeCount || epCount,
        });
        for (let i = 2; i <= epCount; i++) {
          item = applyEpisodeWatched(item, {
            key,
            tmdb_id: row.tmdbId,
            media_type: 'tv',
            title: row.title,
            year: row.year,
            episodeIndex1Based: i,
            knownEpisodeCount: row.knownEpisodeCount || epCount,
          });
        }
        if (row.simklId) item.simkl_id = row.simklId;
        if (row.slug) item.simkl_slug = row.slug;
        if (row.rating) {
          item = applyUserRating(item, {
            key,
            tmdb_id: row.tmdbId,
            media_type: 'tv',
            title: row.title,
            year: row.year,
            rating: row.rating,
            status: item.status,
          });
        }
        data.items[key] = item;
      }
      changed += 1;
    }
    if (changed > 0) {
      await dbManager.saveUserWatchData(username, data);
    }
    if (lastSync) {
      await dbManager.saveUserSimklTokens(username, {
        ...tokens,
        last_sync: lastSync,
      });
    }
    console.log(`Simkl import: ${changed} items touched for ${username}`);
  } catch (e) {
    console.warn('Simkl watched pull failed — connect still succeeds', e);
  }
}
