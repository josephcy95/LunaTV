# Testing

## External Redis-compatible stores

Jest runs with `NODE_ENV=test`. Redis/Kvrocks storage clients are still constructed when application modules are imported, but their automatic connection/retry loop is disabled in tests. This keeps the suite deterministic and prevents missing local Kvrocks services from leaving sockets or retry timers open.

Tests that exercise Redis/Kvrocks integration must provide a mock client or explicitly connect to a disposable service and close it in teardown. Do not add `--forceExit`: Jest should exit naturally so genuine leaked handles remain visible.

For local integration checks, set the relevant storage URL and run the targeted test against a running Redis-compatible service rather than changing production connection behavior.
