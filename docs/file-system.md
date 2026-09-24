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

Only shell components that are global by nature go here, all under `app/components/<Name>/`. `App.tsx`, `main.tsx` and `styles.css` sit at the `src/` root, not here. `AppShell` is a layout primitive in `@goodboy/ui`. A component drawn in only one feature's view belongs in that feature, not here. For breadcrumb IA and the layout of `AppTopBar` controls, see [navigation.md](navigation.md).

## Components (`features/**/components/`, `shared/components/`)

Rule: **1 file = 1 export = 1 definition**.

- Small component, no test → flat file: `parent/Name.tsx`
- Small component WITH test → folder: `parent/Name/index.tsx` + `parent/Name/index.test.tsx`
- Large component (>~250 lines) OR split into sub-pieces → folder: `parent/Name/index.tsx` + sub-files (imported only by `index.tsx`) + optional `index.test.tsx`
- **Never** a folder that holds only `index.tsx` and nothing else. If only the index exists, flatten it to `parent/Name.tsx`.

## Hooks

- Hook reused across domains → `shared/hooks/<useFoo>/index.ts`
- Hook used inside one domain → `features/<domain>/hooks/<useFoo>/index.ts`
- Same folder rule as components: a folder with `index.ts` + `index.test.ts` when a test exists, a flat `useFoo.ts` otherwise.
- A hook tied closely to one parent component can stay as a sibling file in that component's folder.

## Store slices (`store/slices/<name>/`)

Each slice is a **package folder**:

- `index.ts`: puts the state, actions and selectors together.
- `index.test.ts`: the test for the slice's public contract.
- `state.ts`: the initial state and its type, when it is not trivial.
- One file per action.
- One `select<Thing>.ts` per selector.
- `types.ts`: types used only inside the slice. It re-exports `SetFn`/`GetFn` from `../../slice-types`.

Rules around slices:

- `store/store.ts` only composes slices. No domain logic.
- The shared `SetFn`/`GetFn` live in `store/slice-types.ts` (typed against `AppStore`).
- A helper shared between files inside a slice is exported through the slice's `index.ts` only when code outside the slice needs it. Otherwise, import it straight from its source file.
- Runtime memory keyed by session, agent or workflow run lives in `AppState` and is registered in `SESSION_EVICTION` (`store/sessionEviction.ts`). The type guard there fails until every state key says how it is torn down. Slices read these counters through `get()`, never through a component selector. A module-level collection is allowed only in three cases: in-flight promise dedup that deletes itself in `finally`, a tombstone that must outlive its agent (`purgedAgentIds`), or a per-key queue that drops its key once drained (`shared/utils/keyedQueue.ts`).

## Test file placement

- Tests sit next to their source: `index.ts(x)` + `index.test.ts(x)` in the same folder.
- Never flat pairs `Name.tsx` + `Name.test.tsx` in the parent. Put them in a folder.

## Shared types

- Types shared across files → `shared/types/<name>.ts`
- Types shared across packages → `packages/types/src/`
- Types used in one file stay in that file.

## Shared utilities

- Reusable utilities → `shared/utils/<name>.ts`
- A file enters `shared/` only when 2+ different features import it. When in doubt, keep it in the feature. Do not share ahead of time.
- Before you create a new shared util, grep `shared/utils/` for one you can reuse.
