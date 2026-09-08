/** @jest-environment node */
import { NextRequest } from 'next/server';
import { GET } from './route';
import { getAvailableApiSites, getConfig } from '@/lib/config';
import { searchFromApi } from '@/lib/downstream';

jest.mock('@/lib/auth', () => ({
  getAuthInfoFromCookie: () => ({ username: 'user-1' }),
}));
jest.mock('@/lib/config', () => ({
  getAvailableApiSites: jest.fn(),
  getConfig: jest.fn(),
}));
jest.mock('@/lib/downstream', () => ({
  searchFromApi: jest.fn(),
  generateSearchVariants: () => ['query'],
}));
jest.mock('@/lib/performance-monitor', () => ({
  recordRequest: jest.fn(),
  getDbQueryCount: jest.fn(() => 0),
  resetDbQueryCount: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  (getConfig as jest.Mock).mockResolvedValue({
    SiteConfig: { DisableYellowFilter: true },
  });
  (getAvailableApiSites as jest.Mock).mockResolvedValue([]);
});

const expectPrivate = (response: Response) => {
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  expect(response.headers.get('cdn-cache-control')).toBeNull();
  expect(response.headers.get('vercel-cdn-cache-control')).toBeNull();
};

test.each([
  ['empty query', 'http://localhost/api/search'],
  ['empty results', 'http://localhost/api/search?q=query'],
])(
  'authenticated %s responses are never publicly cached',
  async (_name, url) => {
    const response = await GET(new NextRequest(url));
    expectPrivate(response);
    expect(await response.json()).toEqual({ results: [] });
  },
);

test('authenticated results propagate request cancellation to upstream', async () => {
  (getAvailableApiSites as jest.Mock).mockResolvedValue([
    { name: 'source', key: 'source' },
  ]);
  let signal!: AbortSignal;
  (searchFromApi as jest.Mock).mockImplementation(
    async (_site, _query, _variants, options) => {
      signal = options.signal;
      return [{ id: '1', title: 'result' }];
    },
  );
  const controller = new AbortController();
  const response = await GET(
    new NextRequest('http://localhost/api/search?q=query', {
      signal: controller.signal,
    }),
  );
  expectPrivate(response);
  expect(await response.json()).toEqual({
    results: [{ id: '1', title: 'result' }],
  });
  expect(signal).toBeDefined();
});
