/** @jest-environment node */
import { getConfig } from '@/lib/config';
import { searchFromApi } from '@/lib/downstream';
import { getCachedSearchPage, setCachedSearchPage } from '@/lib/search-cache';
import { SearchResult } from '@/lib/types';

jest.mock('@/lib/config', () => ({
  API_CONFIG: {
    search: {
      path: '?ac=detail&wd=',
      pagePath: '?ac=detail&wd={query}&pg={page}',
      headers: { Accept: 'application/json' },
    },
  },
  getConfig: jest.fn(),
}));
jest.mock('@/lib/search-cache', () => ({
  getCachedSearchPage: jest.fn(),
  setCachedSearchPage: jest.fn(),
}));
jest.mock(
  'switch-chinese',
  () => ({
    __esModule: true,
    default: () => ({
      detect: () => 'simplified',
      simplized: (s: string) => s,
    }),
    ChineseType: { SIMPLIFIED: 'simplified' },
  }),
  { virtual: true },
);

const site = {
  key: 'test-provider',
  name: 'Test Provider',
  api: 'https://provider.invalid/api',
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function payload(ids: string[], pagecount = 1) {
  return {
    pagecount,
    list: ids.map((id) => ({
      vod_id: id,
      vod_name: `Video ${id}`,
      vod_pic: `https://media.invalid/${id}.jpg`,
      vod_play_url: `Episode 1$https://media.invalid/${id}.m3u8`,
    })),
  };
}

function response(ids: string[], pagecount = 1) {
  return new Response(JSON.stringify(payload(ids, pagecount)), {
    headers: { 'Content-Type': 'application/json' },
  });
}

function ids(results: SearchResult[]) {
  return results.map((result) => result.id);
}

let fetchMock: jest.SpyInstance;

beforeEach(() => {
  jest.resetAllMocks();
  (getConfig as jest.Mock).mockResolvedValue({
    SiteConfig: { SearchDownstreamMaxPage: 3 },
  });
  (getCachedSearchPage as jest.Mock).mockReturnValue(null);
  fetchMock = jest
    .spyOn(globalThis, 'fetch')
    .mockRejectedValue(
      new Error(
        'Unexpected fetch: every request must be configured by the test',
      ),
    );
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('real downstream searchFromApi', () => {
  test('shares concurrent identical cache misses while allowing one waiter to abort', async () => {
    const upstream = deferred<Response>();
    fetchMock.mockImplementation(() => upstream.promise);
    const cancelled = new AbortController();
    const first = searchFromApi(site, 'same', ['same']);
    const second = searchFromApi(site, 'same', ['same'], {
      signal: cancelled.signal,
    });
    cancelled.abort();
    await expect(second).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    upstream.resolve(response(['shared']));
    expect(ids(await first)).toEqual(['shared']);
    expect(setCachedSearchPage).toHaveBeenCalledTimes(1);
  });

  test('emits the first available page while another variant is still pending', async () => {
    const slow = deferred<Response>();
    const firstEmission = deferred<SearchResult[]>();
    const onResults = jest.fn((batch: SearchResult[]) => {
      firstEmission.resolve(batch);
    });
    // The higher-priority variant deliberately finishes last.
    fetchMock
      .mockImplementationOnce(() => slow.promise)
      .mockResolvedValueOnce(response(['fast']));
    let settled = false;
    const search = searchFromApi(site, 'original', ['original', 'alternate'], {
      onResults,
    });
    void search.then(
      () => {
        settled = true;
      },
      () => {
        settled = true;
      },
    );

    try {
      expect(ids(await firstEmission.promise)).toEqual(['fast']);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(settled).toBe(false);
      expect(onResults).toHaveBeenCalledTimes(1);
    } finally {
      slow.resolve(response(['slow']));
      await search;
    }
    expect(ids(await search)).toEqual(['slow', 'fast']);
    expect(onResults.mock.calls.map(([batch]) => ids(batch))).toEqual([
      ['fast'],
      ['slow'],
    ]);
  });

  test('deduplicates source/id across variants and pagination in callbacks and final data', async () => {
    const onResults = jest.fn();
    fetchMock.mockImplementation((input: string) => {
      const url = new URL(input);
      const query = url.searchParams.get('wd');
      const page = url.searchParams.get('pg') || '1';
      if (query === 'alternate') return Promise.resolve(response(['2', '3']));
      if (page === '1') return Promise.resolve(response(['1', '2'], 4));
      if (page === '2') return Promise.resolve(response(['2', '3', '4']));
      if (page === '3') return Promise.resolve(response(['1', '4', '5']));
      throw new Error(`Unexpected page ${page}`);
    });

    const results = await searchFromApi(
      site,
      'original',
      ['original', 'alternate'],
      {
        onResults,
      },
    );
    expect(ids(results)).toEqual(['1', '2', '3', '4', '5']);
    const emitted = onResults.mock.calls.flatMap(
      ([batch]) => batch as SearchResult[],
    );
    expect(ids(emitted).sort()).toEqual(['1', '2', '3', '4', '5']);
    expect(emitted.every((item) => item.source === site.key)).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
      `${site.api}?ac=detail&wd=original`,
      `${site.api}?ac=detail&wd=alternate`,
      `${site.api}?ac=detail&wd=original&pg=2`,
      `${site.api}?ac=detail&wd=original&pg=3`,
    ]);
  });

  test.each(['fetch', 'response body'] as const)(
    'caller cancellation during %s rejects without negative-caching and permits retry',
    async (stage) => {
      const controller = new AbortController();
      const started = deferred<void>();
      const onResults = jest.fn();
      let upstreamSignal: AbortSignal | undefined;
      fetchMock.mockImplementationOnce((_url: string, init: RequestInit) => {
        upstreamSignal = init.signal as AbortSignal;
        const pending = () =>
          new Promise<never>((_resolve, reject) => {
            upstreamSignal!.addEventListener(
              'abort',
              () => reject(upstreamSignal!.reason),
              {
                once: true,
              },
            );
            started.resolve();
          });
        return stage === 'fetch'
          ? pending()
          : Promise.resolve({ ok: true, json: pending } as unknown as Response);
      });
      const search = searchFromApi(site, 'original', ['original'], {
        signal: controller.signal,
        onResults,
      });
      // Attach the rejection assertion before firing abort, avoiding unhandled rejection races.
      const rejected = expect(search).rejects.toMatchObject({
        name: 'AbortError',
      });
      await started.promise;
      controller.abort();
      await rejected;
      expect(upstreamSignal?.aborted).toBe(true);
      expect(onResults).not.toHaveBeenCalled();
      expect(setCachedSearchPage).not.toHaveBeenCalled();

      fetchMock.mockResolvedValueOnce(response(['retry']));
      expect(ids(await searchFromApi(site, 'original', ['original']))).toEqual([
        'retry',
      ]);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(setCachedSearchPage).toHaveBeenCalledTimes(1);
      expect(setCachedSearchPage).toHaveBeenCalledTimes(1);
      expect(
        (setCachedSearchPage as jest.Mock).mock.calls[0].slice(0, 4),
      ).toEqual([site.key, 'original', 1, 'ok']);
    },
  );

  test.each(['variant', 'pagination'] as const)(
    'streaming rejects on a partial %s failure but retains previously emitted data',
    async (failureAt) => {
      const failure = deferred<Response>();
      const firstEmission = deferred<void>();
      const retained: SearchResult[] = [];
      const onResults = jest.fn((batch: SearchResult[]) => {
        retained.push(...batch);
        firstEmission.resolve();
      });
      fetchMock
        .mockResolvedValueOnce(
          response(['available'], failureAt === 'pagination' ? 2 : 1),
        )
        .mockImplementationOnce(() => failure.promise);
      const search = searchFromApi(
        site,
        'original',
        failureAt === 'variant' ? ['original', 'alternate'] : ['original'],
        { onResults },
      );
      const rejected = expect(search).rejects.toThrow('Provider HTTP 503');
      try {
        await firstEmission.promise;
        expect(ids(retained)).toEqual(['available']);
      } finally {
        failure.resolve(new Response(null, { status: 503 }));
        await rejected;
      }
      expect(ids(retained)).toEqual(['available']);
      expect(onResults).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    },
  );

  test.each(['variant', 'pagination'] as const)(
    'traditional non-streaming search returns available data after a partial %s failure',
    async (failureAt) => {
      fetchMock
        .mockResolvedValueOnce(
          response(['available'], failureAt === 'pagination' ? 2 : 1),
        )
        .mockResolvedValueOnce(new Response(null, { status: 503 }));
      const results = await searchFromApi(
        site,
        'original',
        failureAt === 'variant' ? ['original', 'alternate'] : ['original'],
      );
      expect(ids(results)).toEqual(['available']);
      expect(results[0].episodes).toEqual([
        'https://media.invalid/available.m3u8',
      ]);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    },
  );
});
