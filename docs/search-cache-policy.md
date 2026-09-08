# Search cache policy

Search pages are cached in-process by source, trimmed query, and page number.

- **TTL:** successful and provider-forbidden entries expire after 10 minutes. Reads remove expired entries.
- **Bound:** the cache holds at most 1,000 pages. When a write exceeds the bound, expired pages are removed first; remaining pages with the earliest expiry are evicted.
- **Failures and cancellation:** empty responses are not negative-cached. Caller cancellation rejects the caller and does not write a timeout entry; an in-flight request may still complete for other callers.
- **API privacy:** authenticated `/api/search` responses use `Cache-Control: private, no-store`; they must not be shared by browser or intermediary caches. The compatibility `/api/search/one` endpoint currently uses public cache headers and should only be used where that policy is intentional.
