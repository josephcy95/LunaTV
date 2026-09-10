/* eslint-disable no-console */
import { getConfig } from '@/lib/config';
import type { UserTraktTokens, WatchMediaType } from '@/lib/watchStatus';

const TRAKT_API = 'https://api.trakt.tv';
const TRAKT_AUTH = 'https://trakt.tv/oauth';

export async function getTraktAppCredentials(): Promise<{
  clientId: string;
  clientSecret: string;
} | null> {
  const config = await getConfig();
  const clientId = (config.SiteConfig as any).TraktClientId?.trim?.() || '';
  const clientSecret =
    (config.SiteConfig as any).TraktClientSecret?.trim?.() || '';
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export function buildTraktAuthorizeUrl(
  clientId: string,
  redirectUri: string,
  state: string,
): string {
  const u = new URL(`${TRAKT_AUTH}/authorize`);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('client_id', clientId);
  u.searchParams.set('redirect_uri', redirectUri);
  u.searchParams.set('state', state);
  return u.toString();
}

export async function exchangeTraktCode(opts: {
  code: string;
  redirectUri: string;
  clientId: string;
  clientSecret: string;
}): Promise<UserTraktTokens> {
  const res = await fetch(`${TRAKT_AUTH}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
    throw new Error(`Trakt token exchange failed: ${res.status} ${text}`);
  }
  const data = await res.json();
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    created_at: data.created_at || Math.floor(Date.now() / 1000),
    expires_in: data.expires_in || 7776000,
    token_type: data.token_type,
    scope: data.scope,
  };
}

function traktHeaders(clientId: string, accessToken?: string): HeadersInit {
  const h: Record<string, string> = {
    'Content-Type': 'application/json',
    'trakt-api-version': '2',
    'trakt-api-key': clientId,
  };
  if (accessToken) h.Authorization = `Bearer ${accessToken}`;
  return h;
}

export async function fetchTraktUsername(
  clientId: string,
  accessToken: string,
): Promise<string | undefined> {
  try {
    const res = await fetch(`${TRAKT_API}/users/settings`, {
      headers: traktHeaders(clientId, accessToken),
    });
    if (!res.ok) return undefined;
    const data = await res.json();
    return data?.user?.username;
  } catch {
    return undefined;
  }
}

function buildScrobbleBody(opts: {
  mediaType: WatchMediaType;
  tmdbId: number;
  progress: number;
  season?: number;
  episode?: number;
}) {
  const progress = Math.max(0, Math.min(100, Math.round(opts.progress)));
  if (opts.mediaType === 'movie') {
    return { movie: { ids: { tmdb: opts.tmdbId } }, progress };
  }
  return {
    show: { ids: { tmdb: opts.tmdbId } },
    episode: {
      season: opts.season ?? 1,
      number: opts.episode || 1,
    },
    progress,
  };
}

export async function traktScrobble(
  action: 'start' | 'pause' | 'stop',
  tokens: UserTraktTokens,
  clientId: string,
  body: {
    mediaType: WatchMediaType;
    tmdbId: number;
    progress: number;
    season?: number;
    episode?: number;
  },
): Promise<{ ok: boolean; status: number; error?: string }> {
  try {
    const res = await fetch(`${TRAKT_API}/scrobble/${action}`, {
      method: 'POST',
      headers: traktHeaders(clientId, tokens.access_token),
      body: JSON.stringify(buildScrobbleBody(body)),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { ok: false, status: res.status, error: text.slice(0, 200) };
    }
    return { ok: true, status: res.status };
  } catch (e: any) {
    return { ok: false, status: 0, error: e?.message || 'network' };
  }
}

export async function traktAddHistory(
  tokens: UserTraktTokens,
  clientId: string,
  opts: {
    mediaType: WatchMediaType;
    tmdbId: number;
    season?: number;
    episode?: number;
  },
): Promise<{ ok: boolean; status: number; error?: string }> {
  try {
    const watched_at = new Date().toISOString();
    const payload =
      opts.mediaType === 'movie'
        ? { movies: [{ ids: { tmdb: opts.tmdbId }, watched_at }] }
        : {
            shows: [
              {
                ids: { tmdb: opts.tmdbId },
                seasons: [
                  {
                    number: opts.season ?? 1,
                    episodes: [{ number: opts.episode || 1, watched_at }],
                  },
                ],
              },
            ],
          };
    const res = await fetch(`${TRAKT_API}/sync/history`, {
      method: 'POST',
      headers: traktHeaders(clientId, tokens.access_token),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { ok: false, status: res.status, error: text.slice(0, 200) };
    }
    return { ok: true, status: res.status };
  } catch (e: any) {
    return { ok: false, status: 0, error: e?.message || 'network' };
  }
}

export async function traktRemoveHistory(
  tokens: UserTraktTokens,
  clientId: string,
  opts: {
    mediaType: WatchMediaType;
    tmdbId: number;
    season?: number;
    episode?: number;
  },
): Promise<{ ok: boolean; status: number; error?: string }> {
  try {
    const payload =
      opts.mediaType === 'movie'
        ? { movies: [{ ids: { tmdb: opts.tmdbId } }] }
        : {
            shows: [
              {
                ids: { tmdb: opts.tmdbId },
                seasons: [
                  {
                    number: opts.season ?? 1,
                    episodes: [{ number: opts.episode || 1 }],
                  },
                ],
              },
            ],
          };
    const res = await fetch(`${TRAKT_API}/sync/history`, {
      method: 'DELETE',
      headers: traktHeaders(clientId, tokens.access_token),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { ok: false, status: res.status, error: text.slice(0, 200) };
    }
    return { ok: true, status: res.status };
  } catch (e: any) {
    return { ok: false, status: 0, error: e?.message || 'network' };
  }
}
