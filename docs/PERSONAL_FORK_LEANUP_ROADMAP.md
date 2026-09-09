# Personal Fork Lean-up Roadmap

## Purpose

This document is the running plan for turning the fork into a smaller, more
focused personal application. It tracks bloat removal, maintainability work,
and performance decisions without changing features merely for the sake of
change.

**Created:** September 9, 2026  
**Status:** Active performance/maintainability work; feature removal is deferred.

The guiding principle is:

> Remove complexity that provides little value, preserve features that are
> actually used, and verify every change before moving to the next one.

This is a personal fork used by a small group. We are optimizing for predictable
UX, maintainability, reasonable performance, and a small feature surface—not for
supporting every upstream deployment or every possible integration.

## How to use this file

For every task:

1. Read the scope and acceptance criteria before editing.
2. Record the baseline and any known failures.
3. Make one focused change or one tightly related cleanup.
4. Run the relevant checks.
5. Mark the item `[x]` only when it is actually verified.
6. Commit the work with an informative message.
7. Record the commit hash, impact, and any follow-up.

If we skip an item, **do not delete it**. Change it to `[~]` and add a reason
under **Skipped or deferred work**. This preserves the decision trail.

Status markers:

- `[ ]` Not started.
- `[>]` In progress.
- `[x]` Completed and verified.
- `[~]` Deliberately skipped, deferred, or rejected, with a reason recorded.
- `[!]` Blocked by an external dependency or missing decision.

## Current baseline

- [x] Removed application-wide list virtualization in commit `aed24217`.
- [x] Preserved normal responsive grids, infinite pagination, search batching,
      lazy posters, and horizontal scrolling.
- [x] Ran TypeScript, Jest, production build, targeted ESLint, formatting, and
      diff checks for the virtualization removal.
- [x] Establish a fresh baseline after the virtualization removal before the
      next cleanup.
- [x] Record current production bundle/chunk sizes.
- [x] Record current install size and lockfile package count.
- [x] Record the actual deployment/storage configuration.
- [~] Record which application routes and integrations are used at least once
  per month.
- [~] Record which admin settings and provider integrations are never used.

## Feature-removal inventory — deferred

- [~] Personal usage inventory and unused-feature decisions.

Reason: Feature removal is intentionally postponed. Current work preserves all
routes, integrations, settings and APIs while focusing on code quality, bundle
composition and runtime performance. Revisit when the owner decides which
features to retire.

## Performance and maintainability audit

- [x] Audit current dependency usage and remove six confirmed-unused direct
      dependencies (commit `da5a6a4e`).
- [x] Establish a production build baseline after virtualization/dependency
      cleanup.
- [x] Inspect client entry points and dynamic imports for obvious heavy modules.
- [x] Measure current static/server route artifacts and inspect client entry
      references before changing client boundaries.
- [x] Audit and defer-load `VersionPanel`'s full changelog fallback until the panel opens.
- [>] Audit `VideoCard` imports and per-card queries/effects for render cost.
- [ ] Audit `HomeClient` for unnecessary client-only work and repeated queries.
- [ ] Audit oversized admin/play/live/search modules after measurements.
- [ ] Review decorative animation and blur/shadow cost after functional audits.
- [ ] Make one focused, measured improvement at a time; record before/after data.

### Measurement results — September 9, 2026

- The production build completed successfully after dependency cleanup.
- Largest current `.next/static/chunks/*.js` files were approximately 813 KB,
  700 KB, 244 KB, 229 KB and 225 KB before compression. These are emitted
  chunk sizes, not per-route transfer sizes.
- Route client-reference manifests were approximately 29–32 KB each, but these
  manifests are metadata and not reliable bundle-size measurements.
- `VersionPanel` is imported by `UserMenu` and imports the full generated
  `src/lib/changelog.ts` as a local fallback. This is the strongest currently
  evidenced candidate for a focused client-boundary improvement.
- `HomeClient` and `VideoCard` are large client modules, but no change was made
  without profiling their render and route costs.
- A bundle analyzer is not currently installed. Adding one is deferred until
  the first focused candidate is measured with a minimal, reviewable method.

### VideoCard audit — September 9, 2026

- `VideoCard` is approximately 68 KB and is rendered across major catalog and
  history/favorites surfaces. It dynamically imports the AI modal, which is good
  for initial loading.
- Each card invokes favorite/reminder query hooks, mutation hooks, several local
  states, and two data-update subscriptions. The query hooks use `enabled` guards,
  so disabled network work may be avoided, but hook construction and subscription
  overhead still need runtime measurement.
- The card contains compatibility and multi-surface behavior for search, Douban,
  favorites, history, reminders, aggregate results, live content, AI, and mobile
  actions. No safe deletion was identified from static inspection alone.
- The next safe action is profiling card mount/update counts and query/subscription
  behavior on a real catalog page before changing this shared component.

### Current evidence and first performance target

- `VersionPanel` imports the full generated `src/lib/changelog.ts` into a client
  component while also fetching the remote changelog. This is a plausible bundle
  cost, but removing the fallback or changing its loading strategy could affect
  offline/version-panel behavior, so it requires measurement first.
- `VideoCard` is approximately 68 KB and appears throughout catalog pages. It
  already dynamically imports the AI modal, but its queries/effects need profiling
  before optimization.
- `HomeClient` is approximately 81 KB and is a client-heavy entry point with many
  queries and card sections; it is a high-value later target, not a reason for a
  speculative rewrite.
- The next implementation step is a route-level bundle measurement for the
  changelog/VersionPanel and main home/search routes.

## First step: establish the personal-fork inventory

### Recommendation

**The first implementation step should be an evidence-only inventory, not a
refactor.** Before removing another feature, identify what this deployment
actually uses and which packages/features are reachable. This gives us a safe
removal boundary and prevents deleting something that appears disabled but is
needed by a fallback, admin operation, or deployment mode.

### Inventory checklist

- [ ] Confirm the exact deployed branch, commit, environment, and deployment
      target.
- [ ] List routes used by the owner and friends:
      home, search, Douban, Emby, short drama, live, TVBox, playback, admin,
      downloads, statistics, authentication, and other routes as applicable.
- [ ] List integrations actually used: video providers, search providers,
      storage backend, authentication provider, AI, Telegram, live sources,
      TVBox, downloads, and external media services.
- [ ] Record features that are intentionally unused.
- [ ] Search source, scripts, generated files, dynamic imports, and configuration
      for each unused feature before classifying it as removable.
- [ ] Capture a production build report and identify client-loaded versus
      server-only code.
- [ ] Run `pnpm why` for candidate dependencies before removing any package.
- [ ] Add the findings to this file under **Feature decisions** and
      **Dependency decisions**.

### Inventory results — September 9, 2026

- Repository: branch `main`, commit `aed24217`; remotes are the personal fork
  (`origin`) and upstream (`upstream`).
- Deployment evidence: `.env` defines `NEXT_PUBLIC_STORAGE_TYPE=kvrocks` and
  `KVROCKS_URL`; `USERNAME`/`PASSWORD` authentication variables are present.
  Secret values were not recorded here.
- Routes present: home, admin, crash logs, Douban, Emby, global stats, live,
  login/register/OIDC registration, playback, play stats, release calendar,
  search, short drama, source browser/test, TVBox, and warning. Presence does
  not prove personal usage; usage decisions remain open.
- Current package counts: 49 runtime dependencies and 36 development
  dependencies. `node_modules` is approximately 1.1 GB and `.next` is
  approximately 1.2 GB locally; these include caches and are not shipped sizes.
- Repository working content excluding `.git`, `node_modules`, and `.next` is
  approximately 29 MB.
- Largest client static chunk observed in the current production build is
  approximately 813 KB before compression; this is a rough file-size baseline,
  not a complete bundle analysis.
- No source imports were found for `@vidstack/react`, `vidstack`,
  `media-icons`, `react-icons`, `swiper`, or `zod`. `next.config.js` mentions
  `react-icons` in optimization configuration, so that reference must be
  removed or validated together with the dependency.
- No active virtualization controls were found in admin/settings during the
  audit.

### Inventory decision

The first implementation target is **Phase 1A: verify and remove confirmed-unused
dependencies**, beginning with the six candidates above. This is safer than
removing a whole feature before the personal usage inventory is complete.

### Inventory deliverable

Create a table like this before beginning Phase 1:

| Feature or package | Used?                  | Where reachable          | Client cost | Server/build cost  | Decision  |
| ------------------ | ---------------------- | ------------------------ | ----------- | ------------------ | --------- |
| AI recommendations | Unknown                | Navigation, cards, admin | To measure  | To measure         | Pending   |
| Live TV / EPG      | Unknown                | `/live`                  | To measure  | To measure         | Pending   |
| TVBox              | Unknown                | `/tvbox`, admin          | To measure  | To measure         | Pending   |
| OIDC               | Unknown                | Login/admin              | To measure  | To measure         | Pending   |
| Downloads          | Unknown                | Player/download panel    | To measure  | To measure         | Pending   |
| `@vidstack/react`  | No source import found | None found               | To verify   | Install/build only | Candidate |

Do not mark a feature “unused” based only on a default-off configuration. Confirm
that it is not reached through a dynamic import, admin workflow, fallback path,
or deployment setting.

## Phase 1 — Safe mechanical cleanup

These tasks should be completed before large feature removal. They are intended
to be low-risk and independently reviewable.

### 1A. Unused dependencies

The initial scan found no source references for these packages. They are
**candidates, not yet approved removals**:

- [x] `@vidstack/react` — no repository usage; removed.
- [x] `vidstack` — no repository usage; removed.
- [x] `media-icons` — no repository usage; removed.
- [x] `react-icons` — no repository usage; removed its Next optimization entry too.
- [x] `swiper` — no repository usage; removed.
- [x] `zod` — no repository usage; removed direct dependency. It remains transitively through ESLint tooling.

For each candidate:

- [ ] Search the entire tracked repository, not only `src`.
- [ ] Check `package.json` scripts and build configuration.
- [ ] Check dynamic `import()` calls and string-based references.
- [ ] Check whether another package requires it at runtime.
- [ ] Remove only after the previous checks are clear.
- [ ] Regenerate the lockfile with pnpm.
- [ ] Compare build output and run typecheck/tests/build.
- [ ] Record the result and commit hash in **Completed work**.

Do not remove these without a separate decision:

- `@emotion/react` and `@emotion/styled`: Material UI may require them.
- Playback libraries such as Artplayer, HLS, FLV, and Mux support.
- React Query, image proxy/cache code, authentication, or database adapters.
- Packages used only in server routes, unless their server feature is also
  deliberately removed.

### 1B. Dead imports, exports, and local state

- [ ] Run compiler/linter diagnostics and fix only cleanup-related findings.
- [ ] Search for exports with no consumers before deleting them.
- [ ] Remove unused state, handlers, types, and constants exposed after feature
      removal.
- [ ] Avoid broad auto-fixes that rewrite unrelated files.
- [ ] Add or improve a dead-code detection method if practical.

### 1C. Changelog and generated data

- [ ] Determine whether the full `src/lib/changelog.ts` is shipped to a client.
- [ ] If it is client-shipped, decide whether old entries can move to Markdown
      or be loaded separately.
- [ ] Preserve historical release records unless a deliberate history policy
      says otherwise.
- [ ] Do not manually rewrite generated changelog output without checking the
      generator workflow.

## Phase 2 — Remove unused complete features

Only start this phase after the personal-fork inventory is complete. Remove a
feature as a complete vertical slice: route/UI, client hooks, server/API code,
config types, admin controls, dependencies, docs, tests, and migrations where
applicable.

### Feature decision checklist

For every candidate feature:

- [ ] Confirm it is unused in this deployment.
- [ ] Identify all client routes and components.
- [ ] Identify all API routes and server modules.
- [ ] Identify configuration fields and admin controls.
- [ ] Identify dependencies used only by it.
- [ ] Identify data/storage keys and migration implications.
- [ ] Identify shared code that must remain.
- [ ] Add a rollback note.
- [ ] Remove it in one focused commit.
- [ ] Verify unrelated routes and core media flows.
- [ ] Record the reason if it is deferred or retained.

### Candidate feature areas

These are not approved removals yet:

- [ ] AI recommendations.
- [ ] Live TV and EPG.
- [ ] TVBox and spider/JAR support.
- [ ] Short drama.
- [ ] Netdisk search.
- [ ] YouTube/Bilibili/ACG search providers.
- [ ] OIDC authentication.
- [ ] Telegram integration.
- [ ] Downloads.
- [ ] Crash logs and usage/statistics pages.
- [ ] Release calendar.
- [ ] Source browser.
- [ ] Invite system.

For a personal fork, complete feature removal is preferable to leaving a
half-disabled feature scattered across UI, APIs, config, and dependencies.

## Phase 3 — Reduce spaghetti and oversized modules

Large files are maintainability warnings, not automatic deletion targets.
Refactor only after unused features have been removed from them.

Current largest source files include:

- `src/app/admin/page.tsx` — approximately 402 KB.
- `src/app/play/page.tsx` — approximately 203 KB.
- `src/app/live/page.tsx` — approximately 162 KB.
- `src/lib/changelog.ts` — approximately 139 KB.
- `src/app/search/page.tsx` — approximately 127 KB.
- `src/app/play-stats/page.tsx` — approximately 111 KB.
- `src/app/tvbox/page.tsx` — approximately 110 KB.
- `src/lib/db.client.ts` — approximately 82 KB.
- `src/app/HomeClient.tsx` — approximately 81 KB.
- `src/components/VideoCard.tsx` — approximately 68 KB.

### Admin page

- [ ] Remove unused admin feature sections first.
- [ ] Extract remaining sections into independently testable components.
- [ ] Keep permissions, save flows, validation, import/export, and error states.
- [ ] Lazy-load heavy admin-only sections where that improves initial admin
      loading without making the code harder to understand.
- [ ] Verify admin navigation, keyboard controls, and permission boundaries.

### Search page

- [ ] Keep provider discovery, filtering, sorting, aggregate/source modes, and
      card/list modes that the inventory says are used.
- [ ] Extract provider-specific result renderers.
- [ ] Keep filtering/grouping/ranking separate from rendering.
- [ ] Keep search batching and accessible Load More behavior.
- [ ] Avoid introducing another rendering abstraction unless it removes more
      complexity than it adds.

### Playback page

- [ ] Identify which player engines and integrations are actually used.
- [ ] Remove unused engines only with playback regression coverage.
- [ ] Preserve episode selection, subtitles/danmu, seeking, orientation,
      audio compatibility, downloads, and back navigation when used.
- [ ] Extract player concerns only after unused paths are known.

### General refactoring rules

- [ ] Prefer explicit data flow over generic “smart” components.
- [ ] Extract repeated behavior only when the behavior is genuinely identical.
- [ ] Avoid hooks that hide network requests, state changes, and side effects.
- [ ] Replace compatibility code only after confirming migration needs.
- [ ] Do not split a file into many files without reducing responsibility or
      improving testability.

## Phase 4 — Remove legacy compatibility that this fork does not need

The scan found multiple compatibility and fallback paths. They may be necessary
for upstream users but not for this deployment.

- [ ] Audit `src/lib/db.client.ts` methods explicitly marked “kept but no longer
      used.”
- [ ] Audit local-storage fallbacks and old cache formats.
- [ ] Audit old password/token/config formats and migration code.
- [ ] Audit multiple Redis-compatible backends against the actual deployment.
- [ ] Audit old provider/API fallbacks.
- [ ] Audit built-in spider/JAR fallback behavior before touching TVBox.
- [ ] Audit old storage keys and data migrations.

For every removed compatibility path:

- [ ] Confirm no existing personal data depends on it.
- [ ] Provide a migration or backup instruction if needed.
- [ ] Test fresh install and existing-data upgrade behavior.
- [ ] Record why upstream compatibility was intentionally dropped.

## Phase 5 — Reduce low-value UI complexity

This phase targets polish that costs paint/compositing work or code complexity
without materially improving understanding or feedback.

- [ ] Inventory `framer-motion` usage and classify each animation as functional,
      navigational, or decorative.
- [ ] Keep loading, focus, hover, open/close, and playback feedback animations.
- [ ] Remove or simplify decorative animated gradients and layered shadows where
      they do not communicate state.
- [ ] Reduce blur-heavy overlays on frequently updated content.
- [ ] Prefer CSS transitions for simple opacity/transform effects.
- [ ] Check `prefers-reduced-motion` for retained motion.
- [ ] Avoid redesigning stable pages during cleanup.
- [ ] Compare mobile scrolling and battery/GPU behavior before and after.

Do not assume CSS is free: large blur layers, continuous animations, and many
shadows can still affect paint and compositing. Measure before claiming a
performance improvement.

## Performance safeguards to keep

The following are not bloat merely because they are invisible or disabled in
some configurations:

- [ ] Lazy poster loading and fixed poster aspect-ratio containers.
- [ ] Incremental API pagination.
- [ ] Search result batching.
- [ ] Query caching where it prevents duplicate network work.
- [ ] Image proxy/cache logic used by active sources.
- [ ] Playback codecs and engines used by the deployment.
- [ ] Authentication and storage code required by the active deployment.

Before removing a safeguard, measure the affected experience and document the
tradeoff.

## Verification gates for every cleanup

### Before editing

- [ ] Confirm clean baseline and isolate unrelated worktree changes.
- [ ] Identify all direct and indirect consumers.
- [ ] Record current behavior and known failures.
- [ ] Define what must remain unchanged.

### After editing

- [ ] `git diff --check`.
- [ ] Prettier check for touched files.
- [ ] TypeScript typecheck.
- [ ] Relevant targeted tests.
- [ ] Full Jest suite.
- [ ] Lint with no new errors.
- [ ] Production build.
- [ ] Check generated manifest/lockfile changes.
- [ ] Re-search for dead imports, removed feature names, stale settings, and
      obsolete docs.
- [ ] Test the affected route in Chrome and Firefox when the change is UI-facing.

### Core regression matrix

- [ ] Home and horizontal rows.
- [ ] Search and result loading.
- [ ] Douban movie/TV and filters.
- [ ] Emby browse/search if retained.
- [ ] Short drama if retained.
- [ ] Detail page and playback.
- [ ] Login/authentication.
- [ ] Favorites/history.
- [ ] Downloads if retained.
- [ ] Live/EPG if retained.
- [ ] Admin/settings and permissions.
- [ ] Mobile/narrow viewport.
- [ ] Browser Back and route transitions.

## Dependency and bundle measurement record

Fill this in before Phase 1:

- Package count:
  - Runtime: 49 at initial audit.
  - Development: 36 at initial audit.
  - Current: \***\*\_\_\*\***
- Install size: \***\*\_\_\*\***
- Production build size: \***\*\_\_\*\***
- Largest client chunks: \***\*\_\_\*\***
- Largest server chunks: \***\*\_\_\*\***
- Active deployment storage backend: \***\*\_\_\*\***
- Active authentication mode: \***\*\_\_\*\***
- Active playback engines: \***\*\_\_\*\***

After each dependency or feature cleanup:

- Date: \***\*\_\_\*\***
- Commit: \***\*\_\_\*\***
- Before/after package count: \***\*\_\_\*\***
- Before/after bundle result: \***\*\_\_\*\***
- Runtime behavior observed: \***\*\_\_\*\***
- Memory/performance observation: \***\*\_\_\*\***

## Completed work

| 2026-09-09 | Pending commit | Deferred-load the local VersionPanel changelog instead of importing it at module initialization | Typecheck, 60 Jest tests, diff check passed | Keeps offline/local fallback behavior while moving the large changelog out of the initial module path; verify route chunks with analyzer later |

| 2026-09-09 | `8c8ca649` | Deferred feature removal and added measured performance/maintainability workstream | Roadmap committed and pushed | All features remain preserved; next work targets evidence-based client/bundle improvements |
| 2026-09-09 | Pending commit | Measured current build artifacts and identified VersionPanel/full changelog as first focused target | Production build passed; emitted chunk inventory recorded above | Measurement is a rough baseline; no runtime behavior changed |

| 2026-09-09 | Pending commit | Removed six confirmed-unused direct dependencies and the stale `react-icons` optimization entry | Typecheck, 60 Jest tests, production build, pnpm dependency resolution, diff check | Reduced dependency/install surface; no application source consumers found. `zod` remains transitively required by ESLint tooling. |

| Date       | Commit     | Work                                         | Verification                                                             | Impact / notes                                                                           |
| ---------- | ---------- | -------------------------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| 2026-09-09 | `aed24217` | Removed application-wide list virtualization | Typecheck, 60 Jest tests, build, targeted ESLint, formatting, diff check | Simpler DOM path; long lists keep more cards mounted; virtual scroll restoration removed |

## Skipped or deferred work

Record every deliberate skip here. Use a separate row for each decision.

| Date | Item | Decision             | Reason | Revisit when |
| ---- | ---- | -------------------- | ------ | ------------ |
| —    | —    | No items skipped yet | —      | —            |

## Open decisions

- [ ] Which routes and integrations are genuinely used by this personal deployment?
- [ ] Is admin needed in production, or only during setup?
- [ ] Which storage backend is active and required?
- [ ] Which authentication modes are required?
- [ ] Are live TV, TVBox, short drama, AI, downloads, statistics, and external
      search providers used?
- [ ] Should historical changelog data remain in the client bundle?
- [ ] How much memory growth is acceptable for ordinary non-virtualized lists?

## Final success criteria

This roadmap is complete only when:

- [ ] Every intentionally retained feature has a recorded reason.
- [ ] Every removed feature has a recorded scope, migration impact, and commit.
- [ ] Every skipped item has a written reason.
- [ ] No removed feature remains in active UI, APIs, config, dependencies, docs,
      tests, or storage migration paths unless the residue is explicitly marked
      historical or compatibility-related.
- [ ] Core retained routes pass automated and manual regression checks.
- [ ] Bundle/install/runtime measurements are recorded for meaningful changes.
- [ ] The fork is smaller and easier to reason about without unsupported claims
      that every change makes it faster.
