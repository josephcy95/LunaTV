/** @jest-environment node */
import { getCachedSearchPage, setCachedSearchPage } from '@/lib/search-cache';

test('enforces the 1000-page bound immediately, not at the hourly cleanup', () => {
  for (let page = 1; page <= 1001; page++) {
    setCachedSearchPage('bounded', 'test', page, 'ok', []);
  }
  expect(getCachedSearchPage('bounded', 'test', 1)).toBeNull();
  expect(getCachedSearchPage('bounded', 'test', 1001)).not.toBeNull();
});

test('keeps delimiter-containing source and query keys separate', () => {
  setCachedSearchPage('source::query', 'tail', 1, 'ok', [], 7);
  setCachedSearchPage('source', 'query::tail', 1, 'ok', [], 9);
  expect(getCachedSearchPage('source::query', 'tail', 1)?.pageCount).toBe(7);
  expect(getCachedSearchPage('source', 'query::tail', 1)?.pageCount).toBe(9);
});
