/** @jest-environment node */
import { NextRequest } from 'next/server';

import {
  lookupTrustedNetworkFromApi,
  resetTrustedNetworkLookup,
} from '@/lib/trusted-network-lookup';

function request(version?: string) {
  return new NextRequest('http://localhost/home', {
    headers: version ? { cookie: `tn-version=${version}` } : undefined,
  });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const originalFetch = global.fetch;

beforeEach(() => {
  resetTrustedNetworkLookup();
  global.fetch = originalFetch;
});

afterEach(() => {
  global.fetch = originalFetch;
});

test('coalesces concurrent trusted-network lookups onto one fetch', async () => {
  const pending = deferred<Response>();
  global.fetch = jest.fn().mockReturnValue(pending.promise);
  const first = lookupTrustedNetworkFromApi(request());
  const second = lookupTrustedNetworkFromApi(request());
  expect(global.fetch).toHaveBeenCalledTimes(1);
  pending.resolve(
    new Response(
      JSON.stringify({
        TrustedNetworkConfig: {
          enabled: true,
          trustedIPs: ['127.0.0.1'],
          blockAdminAccess: false,
        },
      }),
      { status: 200 },
    ),
  );
  await expect(Promise.all([first, second])).resolves.toEqual([
    {
      enabled: true,
      trustedIPs: ['127.0.0.1'],
      blockAdminAccess: false,
    },
    {
      enabled: true,
      trustedIPs: ['127.0.0.1'],
      blockAdminAccess: false,
    },
  ]);
  expect(global.fetch).toHaveBeenCalledTimes(1);
});

test('reuses a successful lookup without another fetch', async () => {
  global.fetch = jest.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        TrustedNetworkConfig: {
          enabled: true,
          trustedIPs: ['10.0.0.1'],
          blockAdminAccess: true,
        },
      }),
      { status: 200 },
    ),
  );
  await lookupTrustedNetworkFromApi(request());
  await lookupTrustedNetworkFromApi(request());
  expect(global.fetch).toHaveBeenCalledTimes(1);
});

test('does not treat a fetch failure as a 24h disabled config', async () => {
  global.fetch = jest
    .fn()
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          TrustedNetworkConfig: {
            enabled: true,
            trustedIPs: ['10.0.0.2'],
            blockAdminAccess: false,
          },
        }),
        { status: 200 },
      ),
    );
  await expect(lookupTrustedNetworkFromApi(request())).resolves.toBeNull();
  await expect(lookupTrustedNetworkFromApi(request())).resolves.toBeNull();
  expect(global.fetch).toHaveBeenCalledTimes(1);
  await expect(
    lookupTrustedNetworkFromApi(request('v2')),
  ).resolves.toMatchObject({
    enabled: true,
    trustedIPs: ['10.0.0.2'],
  });
  expect(global.fetch).toHaveBeenCalledTimes(2);
});
