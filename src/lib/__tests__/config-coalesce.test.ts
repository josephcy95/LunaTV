/** @jest-environment node */

jest.mock('next/cache', () => ({
  unstable_noStore: jest.fn(),
}));
jest.mock('@/lib/db', () => ({
  db: {
    getAdminConfig: jest.fn(),
    getAllUsers: jest.fn(),
    getUserInfoV2: jest.fn(),
  },
}));

import { clearConfigCache, getConfig } from '@/lib/config';
import { db } from '@/lib/db';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

beforeEach(() => {
  clearConfigCache();
  jest.resetAllMocks();
  (db.getAllUsers as jest.Mock).mockResolvedValue([]);
});

test('concurrent getConfig callers share one database read', async () => {
  const pending = deferred<Record<string, unknown>>();
  (db.getAdminConfig as jest.Mock).mockReturnValue(pending.promise);

  const first = getConfig();
  const second = getConfig();
  expect(db.getAdminConfig).toHaveBeenCalledTimes(1);

  pending.resolve({
    SiteConfig: { SiteName: 'Test' },
    UserConfig: { Users: [] },
    SourceConfig: [],
    CustomCategories: [],
    LiveConfig: [],
  });

  const [a, b] = await Promise.all([first, second]);
  expect(a).toBe(b);
  expect(a.SiteConfig.SiteName).toBe('Test');
  expect(db.getAdminConfig).toHaveBeenCalledTimes(1);
});
