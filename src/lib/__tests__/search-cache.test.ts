/** @jest-environment node */
import { getCachedSearchPage, setCachedSearchPage } from '@/lib/search-cache';

describe('search cache policy', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  test('expires entries at the ten-minute TTL boundary', () => {
    jest.useFakeTimers({ now: new Date('2025-01-01T00:00:00Z') });
    setCachedSearchPage('ttl', 'query', 1, 'ok', []);
    expect(getCachedSearchPage('ttl', 'query', 1)?.status).toBe('ok');
    jest.advanceTimersByTime(10 * 60 * 1000);
    expect(getCachedSearchPage('ttl', 'query', 1)).toBeNull();
  });

  test('does not retain expired entries during a subsequent write', () => {
    jest.useFakeTimers({ now: new Date('2025-01-01T00:00:00Z') });
    setCachedSearchPage('expired', 'old', 1, 'ok', []);
    jest.advanceTimersByTime(10 * 60 * 1000);
    setCachedSearchPage('expired', 'new', 1, 'ok', []);
    expect(getCachedSearchPage('expired', 'old', 1)).toBeNull();
    expect(getCachedSearchPage('expired', 'new', 1)).not.toBeNull();
  });
});

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
