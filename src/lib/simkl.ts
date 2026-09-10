/* eslint-disable no-console */
/**
 * Simkl API client — follows https://api.simkl.org/
 * Required on every request: client_id, app-name, app-version query params + User-Agent.
 * Never search before mark/scrobble/rate — pass ids.tmdb (+ imdb) AND title + year.
 */
import { getConfig } from '@/lib/config';
import type { UserSimklTokens, WatchMediaType } from '@/lib/watchStatus';
import { readFileSync } from 'fs';
import { join } from 'path';

const SIMKL_API = 'https://api.simkl.com';
const SIMKL_AUTH = 'https://simkl.com/oauth/authorize';

const APP_NAME = 'lunatv';

function readAppVersion(): string {
  try {
    const v = readFileSync(join(process.cwd(), 'VERSION.txt'), 'utf8').trim();
    if (v) return v;
  } catch {
    /* ignore */
  }
  return '6.6.4';
}

export function getSimklAppMeta() {
  const version = readAppVersion();
  return {
    appName: APP_NAME,
    appVersion: version,
    userAgent: `${APP_NAME}/${version}`,
  };
}

export async function getSimklAppCredentials(): Promise<{
  clientId: string;
  clientSecret: string;
} | null> {
  const config = await getConfig();
  const clientId = (config.SiteConfig as any).SimklClientId?.trim?.() || '';
  const clientSecret =
    (config.SiteConfig as any).SimklClientSecret?.trim?.() || '';
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export function buildSimklAuthorizeUrl(
  clientId: string,
  redirectUri: string,
  state: string,
): string {
  const { appName, appVersion } = getSimklAppMeta();
  const u = new URL(SIMKL_AUTH);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('client_id', clientId);
  u.searchParams.set('redirect_uri', redirectUri);
  u.searchParams.set('state', state);
  u.searchParams.set('app-name', appName);
  u.searchParams.set('app-version', appVersion);
  return u.toString();
}

export async function exchangeSimklCode(opts: {
  code: string;
  redirectUri: string;
  clientId: string;
  clientSecret: string;
}): Promise<UserSimklTokens> {
  const { userAgent } = getSimklAppMeta();
  const res = await fetch(`${SIMKL_API}/oauth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': userAgent,
    },
    body: JSON.stringify({
      code: opts.code,
      client_id: opts.clientId,
      client_secret: opts.clientSecret,
      redirect_uri: opts.redirectUri,
      grant_type: 'authorization_code',
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Simkl token exchange failed: ${res.status} ${text}`);
  }
  const data = await res.json();
  return {
    access_token: data.access_token,
    created_at: Math.floor(Date.now() / 1000),
    expires_in: data.expires_in || 157680000,
    token_type: data.token_type || 'bearer',
    scope: data.scope,
  };
}

function simklUrl(
  path: string,
  clientId: string,
  extra?: Record<string, string>,
) {
  const { appName, appVersion } = getSimklAppMeta();
  const u = new URL(`${SIMKL_API}${path}`);
  u.searchParams.set('client_id', clientId);
  u.searchParams.set('app-name', appName);
  u.searchParams.set('app-version', appVersion);
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      if (v != null && v !== '') u.searchParams.set(k, v);
    }
  }
  return u.toString();
}

function simklHeaders(accessToken?: string): HeadersInit {
  const { userAgent } = getSimklAppMeta();
  const h: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': userAgent,
  };
  if (accessToken) h.Authorization = `Bearer ${accessToken}`;
  return h;
}

export type SimklMediaIds = {
  tmdbId: number;
  imdbId?: string;
  title?: string;
  year?: string | number;
  season?: number;
  episode?: number;
};

function buildIds(opts: SimklMediaIds) {
  const ids: Record<string, string | number> = { tmdb: String(opts.tmdbId) };
  if (opts.imdbId) ids.imdb = opts.imdbId;
  return ids;
}

function mediaIdentity(opts: SimklMediaIds) {
  const yearNum =
    opts.year != null && String(opts.year).trim()
      ? Number(String(opts.year).slice(0, 4))
      : undefined;
  const base: Record<string, unknown> = {
    ids: buildIds(opts),
  };
  if (opts.title) base.title = opts.title;
  if (yearNum && Number.isFinite(yearNum)) base.year = yearNum;
  return base;
}

export async function fetchSimklUsername(
  clientId: string,
  accessToken: string,
): Promise<string | undefined> {
  try {
    const res = await fetch(simklUrl('/users/settings', clientId), {
      method: 'POST',
      headers: simklHeaders(accessToken),
    });
    if (!res.ok) return undefined;
    const data = await res.json();
    return data?.user?.name || data?.account?.name || data?.user?.username;
  } catch {
    return undefined;
  }
}

/** Build View-on-Simkl redirect URL (no token needed). */
export function buildSimklViewUrl(opts: {
  clientId: string;
  mediaType: WatchMediaType;
  tmdbId: number;
  title?: string;
  year?: string;
  simklId?: number;
  slug?: string;
}): string {
  if (opts.simklId) {
    const kind = opts.mediaType === 'movie' ? 'movies' : 'tv';
    const slug = opts.slug ? `/${opts.slug}` : '';
    return `https://simkl.com/${kind}/${opts.simklId}${slug}`;
  }
  const { appName, appVersion } = getSimklAppMeta();
  const u = new URL(`${SIMKL_API}/redirect`);
  u.searchParams.set('to', 'simkl');
  u.searchParams.set('type', opts.mediaType === 'movie' ? 'movie' : 'tv');
  u.searchParams.set('tmdb', String(opts.tmdbId));
  if (opts.title) u.searchParams.set('title', opts.title);
  if (opts.year) u.searchParams.set('year', String(opts.year).slice(0, 4));
  u.searchParams.set('client_id', opts.clientId);
  u.searchParams.set('app-name', appName);
  u.searchParams.set('app-version', appVersion);
  return u.toString();
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function simklPost(
  path: string,
  clientId: string,
  accessToken: string,
  body: unknown,
): Promise<{ ok: boolean; status: number; data?: any; error?: string }> {
  try {
    const res = await fetch(simklUrl(path, clientId), {
      method: 'POST',
      headers: simklHeaders(accessToken),
      body: JSON.stringify(body),
    });
    const text = await res.text().catch(() => '');
    let data: any = undefined;
    try {
      data = text ? JSON.parse(text) : undefined;
    } catch {
      /* ignore */
    }
    // 409 already_watched on scrobble stop — treat as success
    if (res.status === 409) {
      return { ok: true, status: res.status, data };
    }
    if (!res.ok) {
      return { ok: false, status: res.status, error: text.slice(0, 300), data };
    }
    return { ok: true, status: res.status, data };
  } catch (e: any) {
    return { ok: false, status: 0, error: e?.message || 'network' };
  }
}

export async function simklAddHistory(
  tokens: UserSimklTokens,
  clientId: string,
  opts: SimklMediaIds & { mediaType: WatchMediaType },
): Promise<{ ok: boolean; status: number; error?: string; simklId?: number }> {
  const watched_at = new Date().toISOString();
  const identity = mediaIdentity(opts);
  const payload =
    opts.mediaType === 'movie'
      ? { movies: [{ ...identity, watched_at }] }
      : {
          shows: [
            {
              ...identity,
              seasons: [
                {
                  number: opts.season ?? 1,
                  episodes: [{ number: opts.episode || 1, watched_at }],
                },
              ],
            },
          ],
        };
  const result = await simklPost(
    '/sync/history',
    clientId,
    tokens.access_token,
    payload,
  );
  const simklId =
    result.data?.added?.movies?.[0]?.ids?.simkl ||
    result.data?.added?.shows?.[0]?.ids?.simkl ||
    result.data?.added?.statuses?.[0]?.response?.ids?.simkl;
  return { ...result, simklId: simklId ? Number(simklId) : undefined };
}

export async function simklRemoveHistory(
  tokens: UserSimklTokens,
  clientId: string,
  opts: SimklMediaIds & { mediaType: WatchMediaType },
): Promise<{ ok: boolean; status: number; error?: string }> {
  const identity = mediaIdentity(opts);
  const payload =
    opts.mediaType === 'movie'
      ? { movies: [identity] }
      : {
          shows: [
            {
              ...identity,
              seasons: [
                {
                  number: opts.season ?? 1,
                  episodes: [{ number: opts.episode || 1 }],
                },
              ],
            },
          ],
        };
  return simklPost(
    '/sync/history/remove',
    clientId,
    tokens.access_token,
    payload,
  );
}

export async function simklAddRating(
  tokens: UserSimklTokens,
  clientId: string,
  opts: SimklMediaIds & { mediaType: WatchMediaType; rating: number },
): Promise<{ ok: boolean; status: number; error?: string }> {
  const rating = Math.max(1, Math.min(10, Math.round(opts.rating)));
  const identity = mediaIdentity(opts);
  const payload =
    opts.mediaType === 'movie'
      ? { movies: [{ ...identity, rating }] }
      : { shows: [{ ...identity, rating }] };
  return simklPost('/sync/ratings', clientId, tokens.access_token, payload);
}

export async function simklRemoveRating(
  tokens: UserSimklTokens,
  clientId: string,
  opts: SimklMediaIds & { mediaType: WatchMediaType },
): Promise<{ ok: boolean; status: number; error?: string }> {
  const identity = mediaIdentity(opts);
  const payload =
    opts.mediaType === 'movie' ? { movies: [identity] } : { shows: [identity] };
  return simklPost(
    '/sync/ratings/remove',
    clientId,
    tokens.access_token,
    payload,
  );
}

function buildScrobbleBody(
  opts: SimklMediaIds & { mediaType: WatchMediaType; progress: number },
) {
  const progress = Math.max(0, Math.min(100, Number(opts.progress) || 0));
  const identity = mediaIdentity(opts);
  if (opts.mediaType === 'movie') {
    return { movie: identity, progress };
  }
  return {
    show: identity,
    episode: {
      season: opts.season ?? 1,
      number: opts.episode || 1,
    },
    progress,
  };
}

export async function simklScrobble(
  action: 'start' | 'pause' | 'stop',
  tokens: UserSimklTokens,
  clientId: string,
  opts: SimklMediaIds & { mediaType: WatchMediaType; progress: number },
): Promise<{ ok: boolean; status: number; error?: string }> {
  return simklPost(
    `/scrobble/${action}`,
    clientId,
    tokens.access_token,
    buildScrobbleBody(opts),
  );
}

export type SimklWatchedImport = {
  mediaType: WatchMediaType;
  tmdbId: number;
  title: string;
  year?: string;
  watchedAt?: number;
  episodeCount?: number;
  knownEpisodeCount?: number;
  rating?: number;
  simklId?: number;
  slug?: string;
};

/**
 * Phase-1 pull on connect: sequential /sync/all-items/{type}.
 * Then save activities.all as lastSync watermark on tokens.
 * Never poll full all-items on a timer — caller should use activities + date_from later.
 */
export async function simklFetchWatched(
  tokens: UserSimklTokens,
  clientId: string,
): Promise<{ items: SimklWatchedImport[]; lastSync?: string }> {
  const out: SimklWatchedImport[] = [];
  const headers = simklHeaders(tokens.access_token);

  // Sequential per Simkl sync guide — not parallel
  for (const type of ['movies', 'shows'] as const) {
    try {
      const res = await fetch(simklUrl(`/sync/all-items/${type}`, clientId), {
        headers,
      });
      if (!res.ok) {
        console.warn(`Simkl all-items/${type} failed:`, res.status);
        await sleep(1100);
        continue;
      }
      const data = await res.json();
      const rows = data?.[type] || [];
      for (const row of rows) {
        const show = row.show || row.movie || row;
        const tmdb = show?.ids?.tmdb;
        if (!tmdb) continue;
        const simklId = show?.ids?.simkl || show?.ids?.simkl_id;
        const status = (row.status || '').toLowerCase();
        const rating = row.user_rating || row.rating || undefined;
        // Only import completed/watched-ish items into local "watched"
        const isDone =
          status === 'completed' ||
          status === 'watched' ||
          (type === 'movies' &&
            status !== 'plantowatch' &&
            status !== 'dropped') ||
          (typeof row.watched_episodes_count === 'number' &&
            row.watched_episodes_count > 0);

        if (!isDone && status === 'plantowatch') continue;
        if (status === 'dropped' && !row.last_watched_at) continue;

        const watchedAt = row.last_watched_at
          ? Date.parse(row.last_watched_at)
          : Date.now();

        if (type === 'movies') {
          if (status === 'plantowatch') continue;
          out.push({
            mediaType: 'movie',
            tmdbId: Number(tmdb),
            title: show.title || `Movie ${tmdb}`,
            year: show.year ? String(show.year) : undefined,
            watchedAt,
            rating: rating ? Number(rating) : undefined,
            simklId: simklId ? Number(simklId) : undefined,
            slug: show.ids?.slug,
          });
        } else {
          const epCount = Math.max(
            1,
            Number(row.watched_episodes_count) ||
              Number(row.total_episodes_count) ||
              1,
          );
          if (
            status !== 'completed' &&
            status !== 'watching' &&
            !(Number(row.watched_episodes_count) > 0)
          ) {
            continue;
          }
          out.push({
            mediaType: 'tv',
            tmdbId: Number(tmdb),
            title: show.title || `Show ${tmdb}`,
            year: show.year ? String(show.year) : undefined,
            watchedAt,
            episodeCount: epCount,
            knownEpisodeCount:
              Number(row.total_episodes_count) || epCount || undefined,
            rating: rating ? Number(rating) : undefined,
            simklId: simklId ? Number(simklId) : undefined,
            slug: show.ids?.slug,
          });
        }
      }
      // ~10 GET/sec ok; stay polite between large pulls
      await sleep(200);
    } catch (e) {
      console.warn(`Simkl all-items/${type} error`, e);
    }
  }

  let lastSync: string | undefined;
  try {
    const actRes = await fetch(simklUrl('/sync/activities', clientId), {
      headers,
    });
    if (actRes.ok) {
      const act = await actRes.json();
      lastSync = act?.all;
    }
  } catch {
    /* ignore */
  }

  return { items: out, lastSync };
}

/**
 * Incremental pull: activities first, then all-items?date_from=…
 * Returns null items if nothing changed.
 */
export async function simklIncrementalSync(
  tokens: UserSimklTokens,
  clientId: string,
  lastSync?: string,
): Promise<{
  items: SimklWatchedImport[];
  lastSync?: string;
  skipped?: boolean;
}> {
  if (!lastSync) {
    return simklFetchWatched(tokens, clientId);
  }
  const headers = simklHeaders(tokens.access_token);
  const actRes = await fetch(simklUrl('/sync/activities', clientId), {
    headers,
  });
  if (!actRes.ok) {
    return { items: [], lastSync, skipped: true };
  }
  const act = await actRes.json();
  if (act?.all === lastSync) {
    return { items: [], lastSync, skipped: true };
  }
  const res = await fetch(
    simklUrl('/sync/all-items', clientId, {
      date_from: lastSync,
    }),
    { headers },
  );
  if (!res.ok) {
    return { items: [], lastSync: act?.all || lastSync };
  }
  const data = await res.json();
  const out: SimklWatchedImport[] = [];
  for (const type of ['movies', 'shows'] as const) {
    for (const row of data?.[type] || []) {
      const show = row.show || row.movie || row;
      const tmdb = show?.ids?.tmdb;
      if (!tmdb) continue;
      out.push({
        mediaType: type === 'movies' ? 'movie' : 'tv',
        tmdbId: Number(tmdb),
        title: show.title || `${type} ${tmdb}`,
        year: show.year ? String(show.year) : undefined,
        watchedAt: row.last_watched_at
          ? Date.parse(row.last_watched_at)
          : Date.now(),
        episodeCount: Number(row.watched_episodes_count) || undefined,
        knownEpisodeCount: Number(row.total_episodes_count) || undefined,
        rating: row.user_rating ? Number(row.user_rating) : undefined,
        simklId: show?.ids?.simkl ? Number(show.ids.simkl) : undefined,
        slug: show?.ids?.slug,
      });
    }
  }
  return { items: out, lastSync: act?.all };
}
