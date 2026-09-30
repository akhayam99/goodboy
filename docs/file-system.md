# File system layout

> **Read this when** deciding where UI or shared code belongs between
> `apps/desktop/src/` and `packages/ui`. **Not for** runtime systems around
> the app like subprocess env or DB migrations, nor the on-disk data the app
> writes under `~/.goodboy` (see `docs/architecture.md` → On-disk data
> layout).

This page covers how files and folders are laid out in `apps/desktop/src/`, and
where desktop code ends and `packages/ui` begins. Naming:
[AGENTS.md](../AGENTS.md) → Naming. What goes in tests: [testing.md](testing.md).
How the repo's packages fit together: [architecture.md](architecture.md).

## Reuse boundary

Reusable UI that only draws things and knows nothing about the product belongs
in `packages/ui`. Code shared across features that knows the desktop app (its
domains, state, routing or runtime) stays in `apps/desktop/src/shared/`. How
many places use the code does not change this boundary.

`PaneShell`, `FacetRail`, `StarToggle` and `DogMascot` are in `packages/ui`: they
import no store, no feature and no Tauri API, and `DogMascot` carries its own
mask image in `packages/ui/src/assets/`. The work tree shows the split. `WorkNode` in `packages/ui/src/components/WorkTree/`
only draws a node from a state, a mark, a label and an optional progress.
What a row is doing (`RowState`), how long it has worked and usually takes
(`workTime`), the rail geometry and the row rhythm know agents and runs, so
they live in `apps/desktop/src/features/workTreeModel/`, which the activity
feed, the workflow run tree and the project rows all read. The folder is not
called `features/workTree`: `features/worktree` (git worktrees) already exists,
and the macOS file system folds case, so the two would share one folder on
disk and split in two on Linux.

## Top-level (`apps/desktop/src/`)

- `app/`: shell components only.
- `features/`: one directory per product domain.
- `shared/`: desktop code used across features that no single domain owns.
- `store/`: the Zustand store and its slice packages.
- `assets/`: app-level images.
- `__tests__/`: integration and regression suites that span features.

`App.tsx`, `main.tsx` and `styles.css` sit at the root.

Nothing else goes at the `src/` root. No `src/types/`, no `src/constants/`, no `src/models/`, no new root folder. Each of these turns into a magnet for loose global state. Domain code lives in its feature. Code shared across features has to earn its place in `shared/`.

## Feature modules (`features/<domain>/`)

A feature is self-contained:

- `<domain>.ts`: core domain logic (types, constants, pure functions). No React, no Zustand imports.
- `utils/`: private to the feature. Move it to `shared/utils/` only once a second feature needs it.
- `components/<Name>/`: see Components below.
- Assets (JSON, SVG) live next to the feature that owns them, never in `public/` or a global `src/data/`.

## App shell (`app/`)

Only shell code that is global by nature goes here. `App.tsx`, `main.tsx` and `styles.css` sit at the `src/` root, not here. `AppShell` is a layout primitive in `@goodboy/ui`. A component drawn in only one feature's view belongs in that feature, not here. For breadcrumb IA and the layout of `AppTopBar` controls, see [navigation.md](navigation.md). Three folders, no others:

- `app/components/<Name>/`: shell components.
- `app/hooks/`: hooks that wire the shell (shortcuts, overlays, session navigation, native menu policy). Same hook rule as below.
- `app/shellArrangement/`: the pure function that decides which shell slots show.

## The folder rule

One rule decides whether something gets a folder: **a folder exists only when it holds more than its entry file**. The entry (`index.tsx` or `index.ts`) plus a test, stories or sub-files makes a folder. A lone entry is a flat file. Hooks are the one exception (below). Never create a folder for a single file and its test unless it is a component or a hook.

| Kind                                   | Shape                                                                                            |
| -------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Component with no test, no sub-files   | flat `parent/Name.tsx`                                                                           |
| Component with a test, stories or subs | folder `parent/Name/index.tsx` + `index.test.tsx` + `*.stories.tsx` + sub-files                  |
| Hook                                   | always a folder `useFoo/index.ts`, even when it is alone, + `index.test.ts` when non-trivial     |
| Module (any other `.ts`)               | flat pair `name.ts` + `name.test.ts`; a folder only for a package (index + sub-files), see below |

Case: components and their folders are `PascalCase`. Hook folders start with `use`. Modules are `camelCase` files named after their main export. A new file is never kebab-case.

## Components (`features/**/components/`, `shared/components/`)

Rule: **1 file = 1 export = 1 definition**.

- A component past ~250 lines, or split into sub-pieces, is a folder: `index.tsx` is the component, sub-files are imported only by it (see [typescript/components.md](typescript/components.md)).
- **Never** a folder that holds only `index.tsx`. If only the index exists, it is `parent/Name.tsx`.

## Hooks

- Hook reused across domains → `shared/hooks/useFoo/index.ts`
- Hook used inside one domain → `features/<domain>/hooks/useFoo/index.ts`
- A hook folder holding only `index.ts` is correct and stays. `index.test.ts` when the behavior is non-trivial.
- A hook tied closely to one parent component can stay as a sibling file in that component's folder (`Name/use<Name>.ts`).

## Modules

A module is any `.ts` file that is neither a component nor a hook. It is a flat file `name.ts` with `name.test.ts` beside it. A package folder (`name/index.ts` + sub-files) only when the module splits into several files. Store slices are the model (Store slices, below).

## Legacy shapes

Some files predate the folder rule. New code never adds one. A mechanical move flattens the component folders that hold only `index.tsx`. The rest changes only when you edit the file for another reason:

- A flat component pair `Name.tsx` + `Name.test.tsx` folds into `Name/index.tsx` + `Name/index.test.tsx`.
- A flat hook `useFoo.ts` outside a component folder becomes `useFoo/index.ts`.
- A module folder holding only `index.ts` and its test becomes a flat pair.
- `shared/layout/` (a lone test) and `shared/pullRequestPresentation.ts` at the `shared/` root move into the folders above. `shared/lib/` files that are pure functions move to `shared/utils/`.

## Store slices (`store/slices/<name>/`)

Each slice is a **package folder**:

- `index.ts`: puts the state, actions and selectors together.
- `index.test.ts`: the test for the slice's public contract.
- `state.ts`: the state keys the slice owns, their type and their initial value, both named after the slice.
- One file per action.
- One `select<Thing>.ts` per pure selector.
- `selectors.ts`: the slice's React selector hooks (`use*`), each reading the keys the slice owns in `state.ts`. A hook that reads several slices sits in the slice that owns its primary key. A slice whose `selectors.ts` already holds pure selectors that action files import keeps its hooks in `use<Thing>.ts` files instead (`project-mounts`), so the actions never import the store. Callers get the hooks through `store/index.ts`, which re-exports each one from its source file.
- `types.ts`: types used only inside the slice. It re-exports `SetFn`/`GetFn` from `../../slice-types` when its files use them.
- Domain helpers only the slice's actions use sit in the slice as one file each, next to their test (`turn/turnHelpers.ts`, `turn/kickoff.ts`, `project-mounts/scopeGuard.ts`, `workflows/summarizeAgentOutput.ts`). The store root keeps `store.ts`, `types.ts`, `slice-types.ts`, `index.ts`, `sessionEviction.ts`, `sessionReplySettings.ts`, `mock-data.ts`, `storyHarness.ts` and the cross-slice `store.*.test.ts` files.

Rules around slices:

- `store/store.ts` only composes slices. No domain logic.
- The shared `SetFn`/`GetFn` and `SliceDeps` (`{ set, get }`) live in `store/slice-types.ts` (typed against `AppStore`).
- Every slice factory takes one `SliceDeps` object: `createXSlice = ({ set, get }: SliceDeps) => ...`. A slice that reads no state destructures only `set`. `store.ts` calls each as `createXSlice({ set, get })`.
- A slice's actions are typed by its factory: `AppStore` intersects `ReturnType<typeof createXSlice>`, so the slice is the single source and `store.ts` holds no hand-written action signatures. Do not pass `AppState`-typed `set`/`get` params between slice files: they make the factory type circular. Take `SetFn`/`GetFn`.
- A slice's state is owned the same way: `AppState` (`store/types.ts`) intersects each slice's state type and `store.ts` spreads each slice's initial state. A new state key goes into its slice's `state.ts`, never inline in `types.ts` or `store.ts`.
- A helper shared between files inside a slice is exported through the slice's `index.ts` only when code outside the slice needs it. Otherwise, import it straight from its source file.
- Runtime memory keyed by session, agent or workflow run lives in `AppState` and is registered in `SESSION_EVICTION` (`store/sessionEviction.ts`). The type guard there fails until every state key says how it is torn down. Slices read these counters through `get()`, never through a component selector. A module-level collection is allowed only in three cases: in-flight promise dedup that deletes itself in `finally`, a tombstone that must outlive its agent (`purgedAgentIds`), or a per-key queue that drops its key once drained (`shared/utils/keyedQueue.ts`).

## Test file placement

- Tests sit next to their source, with the name the folder rule gives: `index.test.tsx` in a component folder, `index.test.ts` in a hook folder, `name.test.ts` beside a flat module.
- A component test is never a flat `Name.test.tsx` beside a flat `Name.tsx`. Put both in a folder.
- Suites that span features live in `src/__tests__/`, not next to any one source.

## Shared types

- Types shared across files → `shared/types/<name>.ts`
- Types shared across packages → `packages/types/src/`
- Types used in one file stay in that file.

## Shared code (`shared/`)

`shared/` has these folders and nothing loose at its root:

- `components/`, `hooks/`, `types/`: shared components, hooks and types, by the rules above.
- `utils/`: pure functions and constants. No `invoke`, no store, no React, no browser storage.
- `lib/`: code that touches the runtime boundary: Tauri wrappers (`invokeCommand`, `db`, `dbBoot`, `editor`, `reveal`), browser storage (`storage-keys`, `zoom`), theme and the feature flags. A pure function does not belong here: put it in `utils/`.
- `keyboard/`: the shortcut registry, its dispatcher and `useShortcut`.
- `platform/`: operating system detection.
- `detail-fields/`: the field builders the record detail panes render, one file per tracker.

No other `shared/` subfolder without adding it here. A folder that holds only a test file is not a folder: the test goes next to the code it covers.

## Shared utilities

- Reusable utilities → `shared/utils/<name>.ts`, each with its `<name>.test.ts` beside it.
- A file enters `shared/` only when 2+ different features import it. When in doubt, keep it in the feature. Do not share ahead of time.
- Before you create a new shared util, grep `shared/utils/` for one you can reuse.
- Dates, times, durations and ages live in `shared/utils/time/`, one file per formatter: `formatClock` (14:30, 24 hour), `formatDayMonth` (Sep 29), `formatDate` (Sep 29, 2026), `formatDateTime`, `formatWeekday`, `formatDuration` (1h 5m), `formatSpan` (5m), `formatAge` (5m ago) and `formatAdaptiveAge`. `formatIntl.ts` holds the only `Intl.DateTimeFormat` call: it pins `en-US` and a 24 hour clock, so the output never depends on the machine locale. A relative label takes `now` from `useNow` (`shared/hooks/useNow`) so it keeps counting; `RelativeTime` does that for a bare label. Never call `toLocaleTimeString`, `toLocaleDateString` or `Intl.DateTimeFormat` in a feature.
