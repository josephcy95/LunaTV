# Global virtualization removal plan

## Status and objective

Implementation status: source/dependency/documentation cleanup completed; automated checks passed (typecheck, Jest, diff check). Chrome/Firefox and admin/settings browser matrix remains to be run before release.

**Implementation completed in working tree; browser acceptance remains a manual release gate.**
Audited baseline: `3fd38d57` (`fix(virtual-grid): remount rows by item identity`).

Remove application-owned list/grid virtualization everywhere, including dormant
implementations, settings, dependencies, and obsolete current-use documentation.
Preserve ordinary responsive grids, horizontal browsing, incremental loading,
search discovery, and core media features. Deliver the eventual implementation
as one reviewable commit with a detailed impact description.

User-observed issue: Chrome, including Guest mode, temporarily shows upper-row
posters/titles in lower rows during virtual scrolling; Firefox reportedly does
not. Commits `fda62146` and `3fd38d57` did not resolve it. The underlying cause
has **not** been reproduced and established by the agent. Removal retires the
suspect rendering path; it is not proof that all possible card/image bugs vanish.

## Expected benefits and honest tradeoffs

- Remove duplicate render paths, row measurement, recycled-row positioning,
  virtual scroll snapshots, controls, and associated maintenance work.
- Keep loaded cards mounted during ordinary scrolling instead of removing them
  solely because they leave the viewport.
- Reduce application code and remove unused dependency branches where verified.
- Do **not** promise lower runtime memory or universally faster scrolling:
  long sessions can accumulate more mounted cards without virtualization.
- Preserve lazy poster loading, reserved poster aspect ratios, existing search
  render batches, and server pagination as the existing performance safeguards.
- Search results can still reorder as providers deliver data and ranking updates.
  This cleanup must not claim to fix that separate behavior.

## 1. Audited scope

| Area                                  | Finding                                                                                                              | Planned change                                                                                                   |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `src/app/douban/page.tsx`             | Toggle, stored preference, two render branches, virtual end callback and normal sentinel                             | Keep the normal grid; retain and verify sentinel pagination for every Douban route/filter                        |
| `src/app/search/page.tsx`             | Toggle, stored preference, virtual card branches, normal card/list render batches                                    | Keep both presentation choices and aggregate/source modes; remove virtualization only                            |
| `src/app/emby/page.tsx`               | Toggle, preference, two browse branches, conditionally enabled observer                                              | Keep browse grid and separate search behavior; guard browse pagination during search                             |
| `src/app/shortdrama/page.tsx`         | Toggle, preference, two branches, last-card observer                                                                 | Keep normal grid and category/search pagination; verify observer lifecycle                                       |
| `src/components/VirtualGrid.tsx`      | Shared virtualizer, hidden column probe, transforms, measurements, session snapshots                                 | Delete after removing all consumers; this also removes both unsuccessful fixes                                   |
| `src/components/VirtualGrid.test.tsx` | Mock-based virtualizer wiring test                                                                                   | Delete; replace with tests of retained behavior rather than merely reducing coverage                             |
| `src/components/ScrollableRow.tsx`    | Optional `enableVirtualization`, visible-range state, child slicing                                                  | Remove this dormant path; retain horizontal scrolling, dragging, arrows, animation choice, sizing and edge bleed |
| Homepage / continue watching          | `HomeClient.tsx` and `ContinueWatching.tsx` use `ScrollableRow`; no caller currently enables its virtualization prop | Verify their behavior survives shared-component cleanup                                                          |
| Admin / settings / configuration      | No list virtualization control or implementation found in the audited admin/settings source                          | Recheck all consumers, config/types and rendered screens; do not remove unrelated settings                       |
| Package manifest / lockfile           | Direct TanStack Virtual dependency; Headless UI also pulls it in transitively                                        | Resolve the entire dependency chain, not just the direct manifest line                                           |
| Docs / tests                          | Active guides, README links, roadmap claims, batch reset test label                                                  | Update or remove obsolete current-use material and feature-specific tests                                        |

### Important scope boundaries

- Do not remove normal `scrollTo`/`scrollBy`, CSS smooth scroll, horizontal
  carousels, scroll-to-top controls, drag gestures, or live EPG scrolling.
- Do not remove `IntersectionObserver`/`ResizeObserver` indiscriminately: other
  features need them, and infinite pagination still needs a working observer.
- Do not remove `@tanstack/react-query`, query caching, API pagination, image
  caching/proxies, lazy loading, or search result batching.
- Keep responsive columns, gaps, card content/actions, skeletons, empty/error
  states, sorting, filters, playback, favorites, history, downloads, and auth.
- References to virtual media sources and Jest's `{ virtual: true }` mock option
  are unrelated. A broad search-and-delete would break or obscure other features.
- No speculative Chrome CSS workarounds, new scroll engine, or unrelated redesign.

## 2. Establish baseline before editing

- [ ] Recheck worktree/HEAD and preserve all unrelated local work, including
      `.playwright-cli/`. Do not restore whole files over someone else's edits.
- [ ] Capture screenshots and behavior of the existing normal mode in Chrome
      and Firefox at desktop and mobile widths.
- [ ] Record normal-mode card dimensions, column counts, pagination behavior,
      search batch controls, and navigation/back behavior.
- [ ] Run typecheck, tests, lint and build on baseline; record existing failures
      separately from new failures. Do not disable checks to obtain a green run.
- [ ] Search all tracked source, scripts, configuration, settings/admin schemas,
      manifests, lockfiles, tests and docs for additional consumers or aliases.

## 3. Replace each page's dual rendering path

Make small page-by-page edits, inspecting the resulting JSX. Do not repeat the
previous unsafe text-based transformation of nested JSX ternaries.

### Douban

- [ ] Retain the existing ordinary grid and existing card components, including
      loading/empty/error/end-of-list states and relevant image priority props.
- [ ] Remove the toggle, state initializer, storage writes, virtual branch,
      restore keys, imports, and virtualization-only comments/handlers.
- [ ] Keep the load-more action required by the sentinel; remove only its unused
      virtualizer-specific wiring, not the shared fetch logic.
- [ ] Ensure observer attach/detach works on loading transitions, filter changes,
      appended results and unmount. Guard pending fetches and exhausted pages.
- [ ] Verify movie, TV, variety, anime/schedule and custom-category variants.

### Search

- [ ] Remove virtual rendering, toggle/state/storage, `isVirtualizedView`, and
      virtualization entries in the render-batch reset key.
- [ ] Keep aggregated and individual-source results, card and list modes,
      provider streaming, sorting/filtering and exact-search behavior.
- [ ] Keep the existing `useSearchResultBatch` mechanism: 60-result batches,
      counts and accessible Load more control. All matching results must remain
      reachable; 60 is not a discovery limit or server pagination limit.
- [ ] Continue filtering/grouping/ranking the full set before slicing for display.
      Do not introduce a new search auto-loading policy in this cleanup.
- [ ] Update `src/hooks/useSearchResultBatch.test.ts` to drop the removed toggle
      scenario while retaining reset, incremental-arrival and expansion coverage.

### Emby

- [ ] Keep the ordinary library grid, separate search results, view/source/sort
      controls, links and card actions.
- [ ] Remove virtualization state/control/branch/import/snapshot keys.
- [ ] Make the browse sentinel operate only in browse mode, with further pages
      available and no next-page request in flight. Do not fetch browse pages
      in the background merely because the search screen reaches its bottom.
- [ ] Test first-load completion, source/view changes, search entry/exit and
      cleanup so observer setup cannot miss a newly mounted target.

### Short drama

- [ ] Keep ordinary category and search grids, category fallback behavior,
      loading indicators and playback navigation.
- [ ] Remove virtualization-specific state/control/branch/import/snapshot keys.
- [ ] Verify the last-card observer or bottom sentinel disconnects cleanly,
      reattaches after appends, handles a null target, and respects loading and
      end-of-list guards. Avoid stale callbacks fetching an old category.

## 4. Remove shared and dormant code

- [ ] Delete `VirtualGrid.tsx` and its obsolete wiring test after every caller is gone.
- [ ] In `ScrollableRow.tsx`, remove `enableVirtualization`, `visibleRange`, range
      calculation, overscan and sliced `visibleChildren`; render all provided
      children through the retained normal/animated paths.
- [ ] Remove only hooks/imports made unused. Child count, resize observation and
      scrolling handlers also support arrow visibility and must be assessed
      rather than deleted wholesale.
- [ ] Re-audit homepage, continue watching, live EPG, admin and settings for
      remaining virtualization paths or dead props.
- [ ] Preserve row/list keys and card identity sensibly; account for duplicate
      source results. Do not introduce deduplication or reorder fetched data as
      an unrelated part of removal.

## 5. Preferences and navigation: explicit cleanup policy

Remove application reads/writes for these local-storage keys:

- `useVirtualization`
- `useDoubanVirtualization`
- `useEmbyVirtualization`
- `useShortDramaVirtualization`

Delete the `lt:vgrid:` snapshot writer/reader with `VirtualGrid`. Existing
session snapshots do not disappear from already-open browsers just because
source code was removed. Local-storage preferences persist until removed.

**Proposed no-runtime-residue policy for this small private deployment:** include
a narrowly scoped, one-off browser-console cleanup procedure in the removal
record and run it in each affected browser profile/origin after deployment.
It removes only the four preference keys and session keys starting `lt:vgrid:`.
Never clear all site data: that could remove login, history and other settings.
No permanent startup compatibility hook or replacement feature flag is added.
If automatic cleanup for every user is desired instead, that requires an explicit
migration and means retaining a small cleanup routine; report that tradeoff
rather than pretending browser data can be erased remotely without code.

**Navigation impact:** removing the component also removes its custom
30-minute session-based scroll restoration. Test browser Back and route return
with the retained normal grids; do not claim identical restoration is automatic.
Compare against today's virtualization-off behavior. If normal navigation loses
material browsing state beyond that baseline, resolve it before shipping or
explicitly agree the changed behavior; do not silently add a new cache system.

## 6. Dependency cleanup

- [ ] Remove direct `@tanstack/react-virtual` with pnpm and regenerate the lockfile.
- [ ] Verify `@headlessui/react` is truly unused, including dynamic imports,
      scripts and configuration. The initial audit finds only its manifest
      declaration outside the lockfile, but it pulls in TanStack Virtual.
- [ ] If that audit holds, remove unused `@headlessui/react` in the same cleanup
      to eliminate the remaining transitive virtualizer branch.
- [ ] Inspect `pnpm why @tanstack/react-virtual` and
      `pnpm why @tanstack/virtual-core` and the regenerated lockfile. Both should
      be absent if no other legitimate consumer remains.
- [ ] If another necessary dependency retains either package, investigate and
      report it; do not hand-delete required lock entries or apply broken overrides.
- [ ] Verify a frozen-lockfile install and production build. Avoid unrelated
      dependency upgrades and do not treat old global pnpm cache contents as
      shipped feature residue.

## 7. Documentation and history

- [ ] Delete `docs/features/VIRTUAL_SCROLL_GUIDE.md`.
- [ ] Update `README.md`, `README_EN.md` and `docs/README.md`: remove dead links,
      feature claims and the removed library credit; describe actual browsing.
- [ ] Update current guidance in `docs/PERFORMANCE_ROADMAP.md`, clearly marking
      earlier implementation notes as superseded where necessary.
- [ ] Update this plan with actual results and the final commit identifier/status.
- [ ] Preserve historical `CHANGELOG` and `src/lib/changelog.ts` entries. They
      explain earlier releases, including the failed fixes. Add a removal entry
      following the repository's release convention rather than rewriting history.
- [ ] No active guide should advertise the toggle or import a deleted component.
      Historical records and this removal record are intentional audit history,
      not functional residue.

## 8. Tests and release acceptance gates

Add focused regression tests for retained pagination/observer behavior and search
batching. Cover guarded next-page fetching, append/rebind, cleanup, exhausted
pages, filter reset and Emby search-mode isolation. Test `ScrollableRow` with
more than 20 children to ensure the entire row stays reachable after removal.
Use page integration or browser tests where hook-only mocks cannot exercise
conditional mounting; do not rely solely on static reference checks.

### Browser acceptance matrix

Run on a production build where possible, in Chrome (including a clean profile)
and Firefox, with desktop and narrow/mobile viewports:

| Surface                      | Required checks                                                                                                                                       |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Douban movie and TV          | Load at least three pages; scroll down/up repeatedly; previously loaded IDs remain mounted; no upper-row content substitutions                        |
| Other Douban variants        | Change relevant filters; empty/exhausted/loading states; results match selection                                                                      |
| Search                       | More than 60 and 120 matches reachable; aggregate/source and card/list modes; filters and sorting; new provider arrivals do not reset batch expansion |
| Emby                         | More than two browse pages; source/view/sort changes; search entry/exit; no unwanted browse pagination during search                                  |
| Short drama                  | Multiple category/search pages; category switching; observer cleanup; open an item                                                                    |
| Homepage / continue watching | Long horizontal rows; arrows, touch/pointer dragging, card clicks, edge bleed and responsive layout                                                   |
| Admin / settings             | Load screens, open controls, keyboard navigation, preserve settings and permissions; no leftover virtualization controls                              |
| Core flows                   | Login, open detail/playback, favorite/unfavorite, history, back navigation, live EPG and download controls remain usable                              |

Use deterministic fixtures for repeatable pagination/order tests, and a live
smoke check where services/credentials are available. Record any unavailable
integration explicitly rather than reporting it as passed. For long lists,
compare responsiveness, DOM count and memory with normal-mode baseline; report
observations, not unsupported claims of universally improved performance.

### Automated checks

```bash
pnpm typecheck
pnpm test -- --runInBand
pnpm lint:strict
pnpm build
pnpm install --frozen-lockfile
```

Also run formatting on touched files and `git diff --check`. Review generated
manifest/lockfile changes; exclude unrelated generated/local state. Existing
failures must be documented with baseline evidence; new failures block release.

### Final residue audit

Search all tracked files for `VirtualGrid`, virtualization preference names,
`enableVirtualization`, `lt:vgrid:`, TanStack Virtual packages, old windowing
libraries, `虚拟滑动`, and `虚拟滚动`. Inspect every hit semantically.

Completion requires no active application-owned virtualization, dormant path,
feature control, dead import, obsolete feature test, or live documentation link.
Document historical references and the exact dependency graph result. Do not
remove unrelated virtual media sources or Jest mocks to force a zero-text-hit
search result. Browser-profile cleanup completion must be reported separately.

## 9. Commit, push and rollback

For the eventual implementation, stage only reviewed task files and produce one
commit, proposed subject:

```text
refactor(ui): remove application-wide list virtualization
```

The body must record:

- All affected routes and shared horizontal-row code, not just four page names.
- Removal of controls, preference handling, snapshots, dependencies and docs.
- Preservation of responsive layouts, normal pagination and search batches.
- Runtime tradeoff: more mounted cards in long browsing sessions.
- Loss of virtualization-specific scroll snapshot restoration and tested Back behavior.
- User-visible search Load more behavior replacing the former virtual card path.
- Actual verification results, any limitations, and manual storage-cleanup steps.

Keep `fda62146` and `3fd38d57` in Git history; deleting the shared component makes
their changes obsolete without rewriting shared history. Review the full staged
diff and commit hooks, then push the single implementation commit to the agreed
branch and report its hash. A push is not proof of successful deployment; verify
the deployed build separately. A normal revert of this cleanup is the rollback,
with the known warning that it restores the problematic virtualization feature.

## Implementation record

Implemented in the working tree on September 9, 2026:

- Removed the application-owned vertical virtual grid from Douban, search,
  Emby, and short drama.
- Removed the dormant horizontal-row virtualization option from `ScrollableRow`.
- Removed the virtualizer component/test, direct and unused transitive dependency,
  obsolete guide links, and active feature claims.
- Preserved normal responsive grids, observers, infinite pagination, search
  batching, card/list modes, horizontal controls, and core routes.
- Historical changelog entries remain intentionally; they describe prior releases.
- Automated evidence: TypeScript, 60 Jest tests, production build, formatting on
  touched source files, targeted ESLint (0 errors), and `git diff --check` passed.
- Full Chrome/Firefox and admin/settings browser acceptance remains a manual
  deployment gate and was not performed in this environment.
