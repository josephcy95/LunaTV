# Performance, usability, and UX roadmap

**Created:** 2026-09-08
**Status:** Pass 1 in progress — search transport/security and optional bundle changes implemented locally; production measurements and broad regression validation pending
**Scope:** Navigation, search, homepage, shared application shell, client bundles, server requests, caching, and maintainability. Vercel Hobby is a primary deployment target; other supported deployments must continue working.

## Goal

Make the application feel responsive without removing the information or capabilities that make it useful. Show useful content early, keep controls responsive while more content arrives, and avoid making every page pay for features the user has not opened.

This is the working source of truth for implementation. Work through the priority queue below in small, testable changes, updating the evidence and delivery log as each change lands.

## Non-negotiable product decisions

- **Preserve features and usability.** Faster empty screens are not a success.
- **Progressive search, not all-or-nothing search.** Show results as providers finish, with honest progress and failure states.
- **No permanent result trimming.** Use “Load more” or provider pagination so users can explore deeper results. A rendering batch size is not a total result cap.
- **No premature provider cancellation just because enough results arrived.** Cancellation is appropriate for abandoned searches, explicit user actions, or actual deadlines. Slower providers must remain discoverable and retryable.
- **Keep the homepage rich.** Prioritize visible content and prepare nearby sections before scrolling reaches them; do not remove sections to improve metrics.
- **Keep background features working.** Active downloads and watch-room sessions must survive navigation. Do not move their state into disposable page components.
- **Prefer measured improvements over optimization folklore.** No broad rewrites, blanket memoization, or dependency removals without evidence.
- **Preserve security.** Never improve cache hit rates by sharing private/user-specific responses between users.

## Reading the previous audit correctly

The initial review found useful leads, but it was a static inspection, not a production performance trace. Its causal conclusions are hypotheses until measured.

| Observation                                                              | What we know                                             | What still needs verification                                                                                                    |
| ------------------------------------------------------------------------ | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Search already contains an SSE consumer                                  | Progressive search is partially implemented              | Which mode real users use, what blocks first results, and whether cancellation/completion work end to end                        |
| `/api/search` awaits all provider promises with a 20-second race timeout | The non-streaming path can wait for the slowest provider | Whether the affected navigation/search uses this path and whether underlying requests are actually aborted                       |
| Homepage uses parallel queries plus local enrichment state               | There are multiple loading and state-management layers   | Which requests/renders are on the critical path and whether a global loading condition hides ready sections                      |
| Root layout mounts many providers and shared components                  | Shared features deserve a lifecycle and import audit     | Actual bundle inclusion, effects, network work, and render cost; mounting alone does not prove a bottleneck                      |
| Route warmup lists several routes                                        | Custom prefetching exists                                | Production network behavior and whether it helps or competes with foreground work                                                |
| Existing build has large JS/CSS chunks                                   | There are candidates for bundle analysis                 | Build freshness, route ownership, compressed transfer sizes, and execution cost; total `.next` size is not browser download size |
| Many API routes use dynamic/no-store options                             | Cache policy is heterogeneous                            | Which choices are correct for authentication/freshness and which public upstream data can safely be shared                       |
| Typecheck passed during the initial review                               | A baseline check succeeded then                          | It must be rerun for each implementation batch; this is not a performance or functional test                                     |

Do not assume that Hobby means a specific cold-start penalty, region, runtime limit, or concurrency limit. Inspect the actual deployment settings and verify current official platform guidance before changing platform configuration. Do not assume a plan upgrade is required.

## How to use this roadmap

This is the **main tracking document** for the performance work: `docs/PERFORMANCE_ROADMAP.md`. You can refer to it in future requests with prompts such as:

- “Continue the performance roadmap.”
- “Do the next unchecked item.”
- “Finish the current autonomous pass.”
- “Update the roadmap with what was completed.”
- “Work on P1-02 progressive search next.”

The recommended execution model is **autonomous batches**, not approval for every individual edit. I should complete a coherent batch, run the relevant checks, update this file, and only stop for a genuinely risky product/security/deployment decision.

### Recommended autonomous passes

#### Pass 1 — high-value UX and performance improvements

This is the first major implementation pass. Complete these in order, with internal validation between them:

- [ ] **Pass 1A — Baseline and navigation feedback:** complete P0-01 and the relevant parts of P1-01.
- [ ] **Pass 1B — Progressive search:** complete P1-02.
- [ ] **Pass 1C — Deep search results:** complete P1-03.
- [ ] **Pass 1D — Progressive homepage loading:** complete P1-04.
- [ ] **Pass 1E — State/query consolidation:** complete P2-01.
- [ ] **Pass 1F — Prefetch and optional bundle loading:** complete P2-02.
- [ ] **Pass 1G — Shared shell and playback isolation:** complete the safe, measured parts of P2-03 and P2-04.
- [ ] **Pass 1H — Initial hot-path server/cache improvements:** complete the safe, measured parts of P2-05.
- [ ] **Pass 1I — First-pass regression validation:** run the full relevant validation matrix, production build, and update the scorecard.

**Pass 1 completion condition:** search is progressive and cancellable, deeper results remain accessible, homepage content is prioritized without losing features, optional code is not loaded unnecessarily, and the main existing workflows pass regression checks.

#### Live deployment sanity check

After Pass 1, deploy once and manually check navigation, search, homepage loading, playback, downloads, favorites/reminders, authentication, and watch rooms. Record the result in the delivery log. This is a sanity check, not a requirement to inspect every intermediate commit.

#### Pass 2 — deeper architectural cleanup

Only after Pass 1 and the live sanity check:

- [ ] Complete deeper P2-03/P2-04 cleanup if still justified by measurements.
- [ ] Complete P2-05 cache/server optimization that requires deployment evidence.
- [ ] Complete P3-01 admin decomposition.
- [ ] Complete P3-02 redundancy cleanup and regression budgets.

Pass 2 is optional where measurements show that the remaining work has low user-visible value.

## Priority queue

Effort is relative, not a time commitment. All items begin **not started**.

| Order | ID    | Work package                                                 | User-visible outcome                                           | Effort  | Depends on                   |
| ----- | ----- | ------------------------------------------------------------ | -------------------------------------------------------------- | ------- | ---------------------------- |
| 1     | P0-01 | Establish production-like measurements                       | We fix the actual causes rather than guessing                  | Medium  | —                            |
| 2     | P1-01 | Make navigation feedback immediate; investigate server gates | Clicking a section visibly responds right away                 | Medium  | P0-01                        |
| 3     | P1-02 | Finish and validate progressive search                       | Fast providers show results without waiting for slow ones      | Large   | P0-01                        |
| 4     | P1-03 | Add progressive result exploration                           | Responsive results with access to every available match        | Medium  | P1-02                        |
| 5     | P1-04 | Prioritize homepage content                                  | Useful homepage content appears earlier, without lost sections | Large   | P0-01                        |
| 6     | P2-01 | Consolidate homepage/query state                             | Less redundant work and more predictable updates               | Medium  | P1-04                        |
| 7     | P2-02 | Tune prefetching and split search feature bundles            | Faster first navigation with less competing work               | Medium  | P0-01, P1-01                 |
| 8     | P2-03 | Make shared features demand-loaded                           | Browse pages stop paying for unused feature UI                 | Large   | P0-01                        |
| 9     | P2-04 | Isolate playback dependencies                                | Player code loads when needed, without playback regressions    | Large   | P2-03                        |
| 10    | P2-05 | Optimize hot server paths and safe caching                   | Fewer repeated remote calls and steadier response times        | Large   | P0-01; security review first |
| 11    | P3-01 | Split the admin monolith incrementally                       | Admin sections load and respond independently                  | Large   | P0-01                        |
| 12    | P3-02 | Remove proven redundancy and add regression budgets          | Improvements survive future merges                             | Ongoing | Completed packages above     |

P2-05 can be pulled forward if measurements identify server/config/database work as the dominant cause. Any confirmed private-data cache exposure is an immediate security fix, not something to defer for this queue.

## P0-01 — Establish the baseline

- [ ] Inspect existing performance tooling and reuse it where reliable.
- [x] Produce a fresh production build; record commit, dependency versions, build command, and environment characteristics without exposing secrets. Build succeeded on 2026-09-08 using Next.js 16.1.0/Turbopack; build emitted repeated local Kvrocks `ECONNREFUSED 127.0.0.1:6666` warnings during page-data collection.
- [ ] Measure home → search, search → another section, return navigation, direct deep links, and browser back/forward.
- [ ] Separate cold browser assets, warm browser assets, cold function invocation, warm function invocation, and upstream cache hit/miss. Do not label them all “cold load.”
- [ ] Test a representative mobile viewport/network and desktop, using the production server rather than development compilation timings.
- [ ] Capture request waterfalls, transferred JS/CSS, long tasks, render/commit timings, and visible loading behavior.
- [ ] Add low-overhead phase timing to hot APIs: auth, config, database, cache lookup, upstream calls, filtering, serialization, total request time, and approximate payload size.
- [ ] For streaming, measure time to first useful result separately from stream completion. The SSE start frame now carries a request ID and setup timing; provider/completion timing is already emitted without query contents. Production aggregation remains pending.
- [ ] Check timing attribution under concurrent requests; process-global counters must not be treated as per-request measurements without isolation.
- [ ] Inspect the actual Vercel runtime, function/database regions, deployment traces, cache headers, and warm/cold behavior when deployment access is available.
- [ ] Record baseline measurements in the table below; unavailable measurements stay explicitly unmeasured. Browser waterfall and deployed Vercel measurements are still pending.

**Starting files:** `src/lib/performance-monitor.ts`, `src/lib/api-wrapper.ts`, `src/lib/config.ts`, `src/proxy.ts`, `src/app/layout.tsx`, `src/app/api/search/route.ts`, `src/app/api/search/ws/route.ts`, `next.config.js`, `vercel.json`.

**Done when:** There is a reproducible test procedure and evidence identifying where navigation/search time is spent. If production access is unavailable, local findings are labeled accordingly and production validation remains open.

## P1-01 — Immediate navigation feedback and server gates

- [ ] Trace navigation handlers, pending states, route loading boundaries, and Suspense fallbacks. Check whether blank fallbacks or minimum-duration loaders delay useful feedback.
- [ ] Keep navigation controls responsive and visibly acknowledge clicks while the destination loads; use destination-appropriate skeletons rather than artificial minimum waits.
- [ ] Trace the proxy's trusted-network config lookup and root layout/config reads. The proxy contains an internal `/api/server-config` fetch; measure whether this creates a serial dependency on cold requests.
- [ ] Where verified, remove redundant config round trips, coalesce concurrent reads, and bound latency without weakening trusted-network/authentication behavior.
- [ ] Verify direct entry, login redirects, disabled features, back/forward, and rapid repeated navigation.

**Done when:** Feedback is immediate, route-specific loading is visible, and unnecessary blocking dependencies are removed or documented. Existing auth and trusted-network semantics remain intact.

## P1-02 — Progressive search that really works

- [ ] Map all search modes and entry points, including normal providers, special providers, and non-browser API consumers. Do not break the non-streaming API contract used by integrations.
- [ ] Audit the existing SSE route/consumer before introducing another implementation; prefer one maintained streaming path for supported browser searches.
- [ ] Emit useful provider results as they arrive. Verify real delivery through the deployed platform, not only local stream writes.
- [x] Show states for connecting, searching, partial results, completed, partial failure, and interrupted stream. The search UI already exposes provider progress while streaming; the stream now also carries final result totals for honest completion reporting.
- [ ] Ensure progress represents completed providers, not the number of result batches; handle providers with zero results.
- [ ] Propagate cancellation from replaced queries/navigation through the client stream, server handler, and upstream fetches. Clean up timers/listeners and handle already-aborted signals.
- [ ] Prevent late responses from an older query overwriting the current query. Provider/user scope and query-replacement tests remain pending. TanStack Query scopes streamed state by query key and propagates abort signals; cross-chunk source/id duplicates are now removed in the reducer.
- [x] Replace non-cancelling timeout races where applicable. The traditional `/api/search` path now aborts each provider request when its 20-second deadline expires; deadline tuning remains measurement-dependent.
- [ ] Preserve access to slow-provider results via continued search or an explicit retry/load action. Explain timeouts clearly.
- [ ] Batch UI updates, avoid full expensive ranking/filtering work on every progress event, and keep input responsive.
- [ ] Define cache behavior for completed versus partial/aborted searches. Partial results must not be cached as a complete successful search.
- [x] Keep non-streaming aggregation deduplicated by source/id, matching the streamed client behavior.
- [ ] Add deterministic tests with fast, slow, empty, failing, malformed, interrupted, and hanging provider fixtures; test cancellation and query replacement. Route tests cover empty providers, partial delivery and disconnect cancellation. Consumer tests now cover byte-split CRLF/UTF-8, malformed JSON/payloads, premature EOF, HTTP failures, unknown events and reader cleanup. Broader provider fixtures and query replacement remain pending.

**Starting files:** `src/app/search/page.tsx`, `src/app/api/search/ws/route.ts`, `src/app/api/search/route.ts`, `src/lib/downstream.ts`, `src/lib/search-cache.ts`, `src/lib/search-ranking.ts`.

**Done when:** A fast provider's useful results render before a deliberately slow provider completes; slow/failing providers cannot freeze input; all normal search capabilities and integration contracts remain available.

## P1-03 — Load more without losing results

- [ ] Separate “results discovered” from “results currently rendered.” Start with a configurable display batch (for example 40–60), not a total search cap.
- [ ] Add an accessible Load more control with clear counts and loading/completion status; retain existing grid/list behavior.
- [ ] Keep all discovered results searchable/filterable. Do not filter only the visible slice or report a false total.
- [ ] Preserve stable result identity, useful source grouping, scroll position, keyboard focus, and playback actions as new batches arrive.
- [ ] Define ordering while streaming so incoming results do not repeatedly move the item the user is about to click.
- [ ] Use existing virtualization where it helps; verify row measurement and responsive grids rather than replacing it blindly.
- [ ] Distinguish client rendering batches from server/provider pagination. UI Load more alone does not reduce payload size or retained browser data.
- [ ] Where upstream providers support pagination, expose deeper pages through explicit requests with deduplication and honest “more available/unknown” states. Keep cursors scoped to query, filters, and authorized provider set.
- [ ] Avoid pagination designs that depend solely on an in-memory serverless instance retaining the previous request.
- [ ] Test large fixtures, duplicates, filter/sort changes, incremental arrivals, deep paging, mobile, and empty results. Verify every supplied result remains reachable.

**Done when:** Users can explore beyond the first batch without a hard trim, input stays responsive with large fixtures, and counts/filtering/order remain understandable.

## P1-04 — Homepage priority loading

- [ ] Map which requests support the first viewport, nearby sections, and optional enrichment; account for mobile and desktop layouts and enabled homepage modules.
- [ ] Render the shell immediately and let each section reveal its ready data independently. Audit aggregate loading flags that may hide ready content.
- [ ] Prioritize hero/first visible rows and locally cached continue-watching information; do not wait for unrelated sections.
- [ ] Load nearby sections ahead of entry using an intersection margin, with sensible fallbacks. Fast scrolling must not expose permanently empty sections.
- [ ] Defer below-fold requests and optional logos/detail enrichment until needed or idle. Reserve layout space to avoid jumps.
- [ ] Reuse cached data during refresh and return navigation. Avoid clearing good content while background refresh runs.
- [ ] Inspect per-card detail/logo requests for request fan-out; deduplicate, cache, or batch where supported.
- [ ] Preserve favorites, reminders, release calendar, disabled-module settings, refresh behavior, and error recovery.
- [ ] Test first visit, return visit, all modules enabled, slow/failing upstreams, favorites/reminders tabs, and rapid scrolling.

**Starting files:** `src/app/HomeClient.tsx`, `src/hooks/useHomePageQueries.ts`, `src/components/HeroBanner.tsx`, `src/hooks/useHeroBannerQueries.ts`, `src/hooks/useTMDBLogo.ts`, `src/hooks/useInView.ts`.

**Done when:** Ready above-the-fold content is not held behind unrelated requests; every enabled section still loads naturally; scrolling and refresh cause no disruptive jumps or lost content.

## P2-01 — One coherent data/cache model

- [ ] Inventory query keys and overlapping fetch paths for homepage content, sources, favorites, play records, and reminders.
- [ ] Separate server/query state from actual UI state. Preserve active tab, dialogs, user selections, and necessary optimistic edits.
- [ ] Remove duplicated content/reducer/ref layers only after documenting what each protects against.
- [ ] Replace repeated array `.find()` merges with indexed lookups where enrichment still requires merging, or update a canonical query cache safely.
- [ ] Standardize query options/keys and freshness by data type; include user identity and scope where necessary, and clear private state on logout/account switch.
- [ ] Audit duplicate invalidation/refetch subscriptions and unused legacy cache layers before deleting them.
- [ ] Test enrichment precedence, optimistic updates, background refresh, local-storage mode, account changes, and return navigation.

**Done when:** One documented owner exists for each data resource, no content disappears during refresh, and repeated equivalent requests/merges are reduced measurably.

## P2-02 — Prefetching and search bundle boundaries

- [ ] Attribute fresh-build chunks to actual route imports and measure compressed bytes plus execution cost.
- [ ] Measure `RouteWarmup` requests alongside normal link prefetching. Its route set is remembered, so do not assume it refetches all routes on every transition.
- [ ] Prefer selective intent/visibility prefetching over broad speculative work when measurements support it; keep keyboard/touch access fast and respect constrained connections.
- [ ] Audit idle callback scheduling/cleanup rather than assuming configured timeouts stagger all requests.
- [ ] Lazy-load optional search panels and players when opened/selected, with useful loading states: ACG, net-disk, YouTube, Bilibili, image viewer, and advanced filters as appropriate.
- [ ] Confirm the initial route no longer includes their heavy dependencies; a dynamic import without a real conditional boundary may not defer the work.
- [ ] Compare first navigation and repeated navigation, not just bundle size. Retain prefetching that demonstrably helps.

**Done when:** Initial search code and competing speculative work are reduced without making likely navigation or feature activation worse.

## P2-03 — Shared shell and background feature lifecycle

- [ ] Inventory global providers/components: imported modules, mount effects, queries, intervals, subscriptions, and context update frequency.
- [ ] Keep essential shell/query/theme/site state lightweight and persistent.
- [ ] Defer expensive feature UI until opened or relevant. Check hidden desktop/mobile component copies for duplicate work.
- [ ] Separate persistent download/watch-room controllers from their demand-loaded panels. Keep active sessions alive across routes.
- [ ] Start expensive feature resources only when needed, with an explicit activation/lifecycle model where appropriate.
- [ ] Consider route groups only where they meaningfully isolate code; verify layout transitions do not reset caches, downloads, rooms, or playback unexpectedly.
- [ ] Test auth pages, normal browsing, active downloads, room participation, logout, and cross-route navigation.

**Done when:** Ordinary browsing avoids unused feature work and background capabilities still survive navigation exactly as users expect.

## P2-04 — Playback isolation

- [ ] Trace player-related libraries through shared cards, utilities, providers, and previews; inspect the build before asserting leakage.
- [ ] Load playback engines/plugins at playback activation, selecting only the required engine/protocol where possible.
- [ ] Keep a useful player shell/metadata visible while engine code loads.
- [ ] Verify HLS/FLV paths, source switching, subtitles/danmu, downloads, fullscreen, mobile controls, watch-room sync, and optional enhancements.
- [ ] Remove duplicate or unused dependencies only after proving they are not required by supported paths.

**Done when:** Browse/search routes avoid unnecessary player code and supported playback features pass regression tests.

## P2-05 — Vercel/server efficiency and safe caching

- [ ] Trace expensive static imports, module initialization, config reads, database round trips, and upstream connection setup in hot functions.
- [ ] Verify actual function/database region alignment and platform configuration before changing either. Consult current official docs at implementation time.
- [ ] Cache/coalesce repeated safe config reads with a clear invalidation mechanism. Never make successful authentication depend on stale permissions.
- [ ] Treat process-memory caches as best-effort, instance-local accelerators, not durable/shared state. Prevent same-key request stampedes where feasible.
- [ ] Inventory HTTP cache headers, upstream data caches, query caches, and personalized filtering separately.
- [x] **Security gate:** `/api/search` selects authorized sources per username. All JSON branches now use `private, no-store`, without CDN cache overrides. Regression tests cover authenticated success, empty-query and empty-result responses. Raw query metric labels were removed; upstream cancellation includes the request signal.
- [ ] Keep account/admin/session data private. Share public upstream metadata only after separating it from authorization and personalized results.
- [ ] Define cache keys, TTLs, stale behavior, size limits, invalidation, and error/partial-result policy per endpoint. Do not blanket-remove `no-store` or force all routes static.
- [ ] Reduce hot-path DB round trips and batch operations where supported; do not load every storage adapter eagerly if analysis proves it costly.
- [ ] Measure image proxy traffic, upstream image sizes, and cache behavior. Consider appropriately sized assets without breaking proxy functionality or unexpectedly increasing hosting costs.
- [ ] Verify cache hits/misses, stale refresh, user isolation, revoked access, provider outages, warm/cold requests, and existing non-Vercel storage/deployment modes.

**Done when:** Measured repeated remote work decreases, cache behavior is explicit and secure, and Vercel improvements do not sacrifice deployment compatibility.

## P3-01 — Incremental admin decomposition

- [ ] Map admin sections, shared state, mutations, permissions, and unsaved-change behavior.
- [ ] Extract one section at a time behind lazy boundaries before deciding whether separate routes improve UX.
- [ ] Preserve permissions, deep linking/navigation, unsaved edits, forms, source ordering, and import/export functionality.
- [ ] Keep shared admin navigation lightweight; load each section's data only when needed.
- [ ] Measure section activation and bundle sizes; test every extracted section before proceeding.

**Done when:** Opening one admin section does not eagerly load/render the whole admin application, and all existing workflows remain available.

## P3-02 — Cleanup and regression prevention

- [ ] Remove superseded patches, dead imports, duplicate caches, and obsolete helpers only within tested ownership boundaries.
- [ ] Audit CSS output and icon/UI-library duplication using actual bundle attribution; avoid an unrelated whole-site redesign.
- [ ] Update scripts that prove incompatible with installed tooling, keeping lint/typecheck/test/build checks usable.
- [ ] Add focused tests for stream lifecycle, large-result exploration, query invalidation, cache isolation, and homepage loading.
- [ ] Establish route-specific JS budgets and request/render budgets from measured baselines.
- [ ] Document the loading/caching architecture and merge-review rules to prevent future upstream changes from reintroducing the same problems.

**Done when:** The repository has enforceable checks and clear conventions, not another parallel layer of optimization patches.

## Measurement scorecard

These are **proposed targets**, not measured results or promises. Adjust with baseline evidence and the target device/network. Never hide features or truncate results to meet them.

| Metric                                   | Baseline                                      | Initial success criterion                                                                       | After |
| ---------------------------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------- | ----- |
| Click → visible navigation feedback      | Unmeasured                                    | Usually within 100 ms on reference device                                                       | —     |
| Route shell/content visibility           | Unmeasured                                    | No avoidable blank waiting; record p50/p95 by route                                             | —     |
| Search first useful result               | Unmeasured                                    | Fast provider appears before slow provider completion; minimize measured server/client overhead | —     |
| Search completion                        | Unmeasured                                    | Tracked independently; incomplete providers are visible and retryable                           | —     |
| Input responsiveness during large search | Unmeasured                                    | No sustained blocking; target field INP ≤ 200 ms where field data exists                        | —     |
| Homepage useful first viewport           | Unmeasured                                    | Does not await unrelated below-fold calls                                                       | —     |
| Layout stability                         | Unmeasured                                    | Target CLS ≤ 0.1; no disruptive row/hero shifts                                                 | —     |
| Homepage LCP                             | Unmeasured                                    | Aim for ≤ 2.5 s on agreed reference setup; distinguish lab from field                           | —     |
| Initial JS/CSS per main route            | Existing artifacts only; not a fresh baseline | Meaningful reduction in transferred and executed optional code                                  | —     |
| Foreground/background request counts     | Unmeasured                                    | Reduce avoidable initial work without delaying visible content                                  | —     |
| API latency, cache hits, payload bytes   | Unmeasured                                    | Record warm/cold and p50/p95 separately                                                         | —     |
| Functional coverage                      | Not yet inventoried                           | No lost features or inaccessible deeper results                                                 | —     |

Record sample counts, test device/network, commit, and deployment for comparisons. A few local requests are not enough to claim a production p95 improvement.

## Delivery rules for every work package

1. Record the current behavior and a specific hypothesis.
2. Add a deterministic regression test or a reproducible measurement before the fix.
3. Implement one coherent change; avoid bundling unrelated cleanups.
4. Run relevant tests, typecheck, lint where supported, and a production build. Report pre-existing failures separately.
5. Verify the UX manually where automation does not cover it, including mobile and failure states.
6. Compare before/after evidence under the same conditions.
7. Update this file: mark completed checkboxes, record modified files/commit, tests, measurements, unresolved risks, and rollback instructions.
8. Mark a package complete only when its acceptance criteria are satisfied. “Code merged, production verification pending” is a valid intermediate state.

Use reversible changes/feature flags where behavior is risky, particularly search transport and persistent feature lifecycles. Do not silently fall back from streaming errors to a second full search that doubles upstream work.

## Validation matrix

At minimum, cover:

- Desktop and mobile; fast and constrained networks; direct entry and client navigation.
- Cold/warm assets and function requests; upstream success, slowness, timeout, and failure.
- Search mode/provider selection, filters, ordering, grid/list view, load more, query replacement, cancellation, back/forward, and playback from deep results.
- Homepage all modules enabled and selectively disabled; cached/uncached data; favorites/reminders/continue watching; fast scrolling.
- Guest/login states, ordinary/admin users, account switch, trusted networks, and cache isolation.
- Active downloads and watch rooms during navigation; representative playback formats and source switching.
- Vercel deployment and relevant supported self-hosted/storage paths touched by a change.

## Delivery log

| Date       | Package              | Status  | Evidence / notes                                                                                                                                                                              |
| ---------- | -------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-09-08 | Roadmap              | Created | Planning document only. No runtime changes. Initial static audit is not a production baseline.                                                                                                |
| 2026-09-08 | P1-02 / cancellation | Partial | Traditional search timeout now aborts provider fetches instead of leaving Promise.race work running. SSE route/consumer tests pass; production delivery and broader benchmark remain pending. |

### Resumed search milestone — local evidence

- `pnpm exec jest --runInBand`: 3 suites, 14 tests passed. Four consumer regressions were reproduced before fixing CRLF normalization across chunks and wiring runtime payload validation.
- `pnpm typecheck`: passed after stream, security and optional dynamic-import changes.
- Optional search panels/cards now use conditional dynamic imports with loading placeholders. Production chunk attribution and browser activation checks remain open; no bundle-size improvement is claimed yet.
- Earlier checked measurement/query-scope/test items were reopened where acceptance evidence was incomplete. Request IDs and setup timing are groundwork, not measured time-to-first-result.
- Rollback: revert the search milestone commit as a unit because the route and consumer event contracts changed together. Do not restore public caching for personalized search responses.

### Production build and bounded-cache milestone

- Production `pnpm build` passed for search milestone `7922e941` (Next.js 16.1.0/Turbopack; compilation 11.7 s). Local Kvrocks connection refusals remained during page-data collection; this does not establish runtime database-backed workflows or deployed performance.
- Search page cache now enforces its 1,000-entry bound on every write rather than waiting up to an hour. Structured tuple keys prevent delimiter collisions between source and query.
- Two deterministic regressions reproduced both cache defects before the fixes and pass afterwards (`pnpm exec jest --runInBand src/lib/__tests__/search-cache.test.ts`). This remains instance-local page caching, not shared personalized response caching or a byte-size bound.
- Rollback: revert the bounded-cache milestone independently; no persistent data migration is required.

### Homepage ready-content milestone (P1-04 partial)

- Confirmed five homepage rows used an aggregate loading flag that hid their ready arrays while another query remained pending. Each now shows skeletons only while loading **and its own rendered array is empty**, including the Bangumi `todayAnimes` array.
- Modules, favorites/reminders, enrichment and request scheduling are unchanged. This removes a rendering gate; viewport prioritization and independent empty/error states remain open.
- Typecheck passed and all 16 tests in 4 suites passed. These tests do not exercise homepage visual behavior; slow-provider browser validation remains pending.
- Rollback: revert the five loading predicates in `src/app/HomeClient.tsx` or the dedicated homepage milestone commit.

### Search rendering batches and homepage state follow-up

- `88eba649` adds 60-result rendering batches to nonvirtualized card/list views, after full-set aggregation/filtering/sorting. VirtualGrid retains all results. Accessible Load more keeps every discovered match reachable; this does not add server pagination or stabilize incoming ranking.
- Nine hook regressions cover 1,003 results, scope changes, incremental arrivals and rapid load actions. Combined validation: 25 tests in 5 suites and typecheck passed before the homepage state follow-up.
- Homepage commit hooks exposed existing render-time ref cache violations. Removed redundant `prevHot*Ref` caches: fixed-key TanStack Query retains data through refresh/errors, while successful empty responses must replace old data. Existing enrichment precedence remains. Targeted homepage lint now passes with existing warnings; browser checks remain pending.

## Next action

Start **P0-01**, then implement the first measured navigation/search improvements. Keep the user-facing progress updates short: what improved, how it was verified, what remains, and whether any production validation needs deployment access.
