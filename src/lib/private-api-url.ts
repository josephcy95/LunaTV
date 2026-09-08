import ipaddr from 'ipaddr.js';

const LOCAL_HOST_SUFFIXES = [
  '.local',
  '.lan',
  '.home',
  '.internal',
  '.localhost',
  '.ts.net',
  '.docker.internal',
];

function hostnameOf(apiUrl: string): string | null {
  try {
    return new URL(apiUrl).hostname.replace(/^\[|\]$/g, '').toLowerCase();
  } catch {
    return null;
  }
}

/** True when Cloudflare Workers cannot reach this API (LAN, Tailscale, loopback, docker). */
export function isPrivateOrLocalApiUrl(apiUrl: string): boolean {
  const host = hostnameOf(apiUrl);
  if (!host) return true;
  if (host === 'localhost' || host === 'host.docker.internal') return true;
  if (LOCAL_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))) return true;
  if (!ipaddr.isValid(host)) return false;
  const range = ipaddr.parse(host).range();
  return (
    range === 'private' ||
    range === 'loopback' ||
    range === 'linkLocal' ||
    range === 'carrierGradeNat' ||
    range === 'uniqueLocal' ||
    range === 'reserved'
  );
}
