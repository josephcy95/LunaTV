import { NextRequest } from 'next/server';

export type TrustedNetworkSettings = {
  enabled: boolean;
  trustedIPs: string[];
  blockAdminAccess: boolean;
};

const CACHE_TTL_MS = 86_400_000;
const FETCH_TIMEOUT_MS = 2_000;
const ERROR_RETRY_MS = 3_000;

let cache: TrustedNetworkSettings | null = null;
let cacheTime = 0;
let fetched = false;
let version = '';
let inflight: Promise<TrustedNetworkSettings | null> | null = null;
let errorRetryAt = 0;

export function resetTrustedNetworkLookup() {
  cache = null;
  cacheTime = 0;
  fetched = false;
  version = '';
  inflight = null;
  errorRetryAt = 0;
}

function cachedResult(now: number): TrustedNetworkSettings | null | undefined {
  if (!fetched) return undefined;
  if (now - cacheTime >= CACHE_TTL_MS) return undefined;
  if (cache === null || !cache.enabled) return null;
  return cache;
}

async function fetchTrustedNetwork(
  request: NextRequest,
): Promise<TrustedNetworkSettings | null> {
  const now = Date.now();
  const url = new URL('/api/server-config', request.url);
  url.searchParams.set('key', 'TrustedNetworkConfig');
  const response = await fetch(url.toString(), {
    headers: { 'x-internal-request': 'true' },
    cache: 'no-store',
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  fetched = true;
  cacheTime = now;
  errorRetryAt = 0;

  if (response.ok) {
    const data = await response.json();
    if (data.TrustedNetworkConfig) {
      cache = {
        enabled: data.TrustedNetworkConfig.enabled ?? false,
        trustedIPs: data.TrustedNetworkConfig.trustedIPs || [],
        blockAdminAccess: data.TrustedNetworkConfig.blockAdminAccess === true,
      };
      return cache.enabled ? cache : null;
    }
  }

  cache = {
    enabled: false,
    trustedIPs: [],
    blockAdminAccess: false,
  };
  return null;
}

export async function lookupTrustedNetworkFromApi(
  request: NextRequest,
): Promise<TrustedNetworkSettings | null> {
  const cookieVersion = request.cookies.get('tn-version')?.value || '';
  if (cookieVersion && cookieVersion !== version) {
    cache = null;
    fetched = false;
    version = cookieVersion;
    errorRetryAt = 0;
  }

  const now = Date.now();
  const hit = cachedResult(now);
  if (hit !== undefined) return hit;
  if (errorRetryAt > now) return null;
  if (inflight) return inflight;

  const pending = fetchTrustedNetwork(request)
    .catch(() => {
      errorRetryAt = Date.now() + ERROR_RETRY_MS;
      return null;
    })
    .finally(() => {
      if (inflight === pending) inflight = null;
    });
  inflight = pending;
  return pending;
}
