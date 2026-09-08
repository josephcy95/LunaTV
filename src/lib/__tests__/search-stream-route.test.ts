/** @jest-environment node */
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/search/ws/route';
import { getAvailableApiSites, getConfig } from '@/lib/config';
import { searchFromApi } from '@/lib/downstream';

jest.mock('@/lib/auth', () => ({
  getAuthInfoFromCookie: () => ({ username: 'test' }),
}));
jest.mock('@/lib/config', () => ({
  getAvailableApiSites: jest.fn(),
  getConfig: jest.fn(),
}));
// Unit tests must not initialize database adapters through the metrics collector.
jest.mock('@/lib/performance-monitor', () => ({ recordRequest: jest.fn() }));
jest.mock('@/lib/downstream', () => ({
  searchFromApi: jest.fn(),
  generateSearchVariants: () => ['test'],
}));

beforeEach(() => {
  jest.resetAllMocks();
  (getConfig as jest.Mock).mockResolvedValue({
    SiteConfig: { DisableYellowFilter: true },
  });
});

test('an empty provider set emits completion and closes', async () => {
  (getAvailableApiSites as jest.Mock).mockResolvedValue([]);
  const response = await GET(
    new NextRequest('http://localhost/api/search/ws?q=test'),
  );
  const text = await response.text();
  expect(text).toContain('"type":"complete"');
  expect(text).toContain('"completedSources":0');
});

test('first page is emitted before provider completion and disconnect aborts upstream', async () => {
  (getAvailableApiSites as jest.Mock).mockResolvedValue([
    { key: 'fast', name: 'Fast' },
  ]);
  let upstreamSignal: AbortSignal | undefined;
  (searchFromApi as jest.Mock).mockImplementation(
    async (_site, _q, _variants, options) => {
      upstreamSignal = options.signal;
      options.onResults([{ id: '1', source: 'fast', title: 'First page' }]);
      await new Promise<void>((resolve) =>
        options.signal.addEventListener('abort', () => resolve(), {
          once: true,
        }),
      );
      return [];
    },
  );
  const response = await GET(
    new NextRequest('http://localhost/api/search/ws?q=test'),
  );
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  expect(decoder.decode((await reader.read()).value)).toContain(
    '"type":"start"',
  );
  expect(decoder.decode((await reader.read()).value)).toContain('First page');
  await reader.cancel();
  expect(upstreamSignal?.aborted).toBe(true);
});

test('starts every provider immediately so a fast source is not queued', async () => {
  const sites = Array.from({ length: 6 }, (_, i) => ({
    key: `p${i}`,
    name: `P${i}`,
  }));
  (getAvailableApiSites as jest.Mock).mockResolvedValue(sites);
  let started = 0;
  const release = new Promise<void>((resolve) => {
    const check = () => {
      if (started === sites.length) resolve();
      else setTimeout(check, 0);
    };
    check();
  });
  (searchFromApi as jest.Mock).mockImplementation(
    async (site, _q, _v, options) => {
      started++;
      options.onResults([{ id: site.key, source: site.key, title: site.name }]);
      await release;
    },
  );
  const response = await GET(
    new NextRequest('http://localhost/api/search/ws?q=test'),
  );
  const textPromise = response.text();
  await release;
  const text = await textPromise;
  expect(started).toBe(6);
  for (const site of sites)
    expect(text).toContain(`\"source\":\"${site.key}\"`);
  expect(text).toContain('"completedSources":6');
});

test('keeps a source successful when it emitted results before timeout or extra-page failure', async () => {
  (getAvailableApiSites as jest.Mock).mockResolvedValue([
    { key: 'partial', name: 'Partial' },
  ]);
  (searchFromApi as jest.Mock).mockImplementation(
    async (_site, _q, _v, options) => {
      options.onResults([{ id: '1', source: 'partial', title: 'Kept result' }]);
      const error = new Error('later page failed');
      (error as Error & { name: string }).name = 'AbortError';
      throw error;
    },
  );
  const response = await GET(
    new NextRequest('http://localhost/api/search/ws?q=test'),
  );
  const text = await response.text();
  expect(text).toContain('Kept result');
  expect(text).toContain('"type":"source_done"');
  expect(text).not.toContain('"type":"source_error"');
  expect(text).toContain('"failedSources":0');
});
