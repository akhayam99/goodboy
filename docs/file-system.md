# File system layout

> **Read this when** deciding where UI or shared code belongs between
> `apps/desktop/src/` and `packages/ui`. **Not for** runtime systems around
> the app like subprocess env or DB migrations, nor the on-disk data the app
> writes under `~/.goodboy` (see `docs/architecture.md` → On-disk data
> layout).

Owns the file and folder layout of `apps/desktop/src/` and the boundary between
desktop reuse and `packages/ui`. Naming: [AGENTS.md](../AGENTS.md) → Naming.
Test content: [testing.md](testing.md). Repo-level package architecture:
[architecture.md](architecture.md).

## Reuse boundary

Reusable presentational UI with no product-domain knowledge belongs in
`packages/ui`. Cross-feature code that knows the desktop app, its domains,
state, routing, or runtime stays in `apps/desktop/src/shared/`. Number of
consumers does not override this boundary.

## Top-level (`apps/desktop/src/`)

`app/` is shell components only, `features/` one directory per product domain,
`shared/` cross-feature desktop code with no domain owner, `store/` the Zustand
store and its slice packages, `assets/` app-level images, `__tests__/`
cross-feature integration and regression suites. `App.tsx`, `main.tsx`,
`styles.css` sit at root.

Nothing else at `src/` root. No `src/types/`, `src/constants/`, `src/models/`, no new root folder: each becomes a magnet for undisciplined global state. Domain code lives in its feature; cross-feature code earns its way into `shared/`.

## Feature modules (`features/<domain>/`)

A feature is self-contained:

- `<domain>.ts`: core domain logic (types, constants, pure functions). No React, no Zustand imports.
- `utils/`: private to the feature. Promote to `shared/utils/` only once a second feature needs it.
- `components/<Name>/`: see Components below.
- Assets (JSON, SVG) live next to the feature that owns them, never in `public/` or a global `src/data/`.

## App shell (`app/`)

Only shell components that are global by definition, all under `app/components/<Name>/`. `App.tsx`, `main.tsx`, and `styles.css` sit at `src/` root, not here; `AppShell` is a layout primitive in `@goodboy/ui`. A component rendered in a single feature's view belongs in that feature, not here. Breadcrumb IA and `AppTopBar` control layout: [navigation.md](navigation.md).

## Components (`features/**/components/`, `shared/components/`)

Rule: **1 file = 1 export = 1 definition**.

- Small component, no test → flat file: `parent/Name.tsx`
- Small component WITH test → folder: `parent/Name/index.tsx` + `parent/Name/index.test.tsx`
- Large component (>~250 lines) OR split into sub-pieces → folder: `parent/Name/index.tsx` + sub-files (imported only by `index.tsx`) + optional `index.test.tsx`
- **Never** a folder containing only `index.tsx` and nothing else. If only the index exists, flatten to `parent/Name.tsx`.

## Hooks

- Cross-domain reusable hook → `shared/hooks/<useFoo>/index.ts`
- Domain-local hook → `features/<domain>/hooks/<useFoo>/index.ts`
- Folder convention same as components: folder with `index.ts` + `index.test.ts` when a test exists, flat `useFoo.ts` otherwise.
- Hooks tightly coupled to a single parent component can stay as sibling files in the component folder.

## Store slices (`store/slices/<name>/`)

Each slice is a **package folder**: `index.ts` compositor assembling state, actions and selectors; `index.test.ts` the slice's public contract test; `state.ts` initial state and type, when non-trivial; one file per action; one `select<Thing>.ts` per selector; `types.ts` for slice-local types, re-exporting `SetFn`/`GetFn` from `../../slice-types`.

- `store/store.ts` is composition only, no domain logic.
- Shared `SetFn`/`GetFn` live in `store/slice-types.ts` (typed against `AppStore`).
- Slice-internal cross-file utilities export through the slice's `index.ts` only when consumers outside the slice need them. Otherwise import directly from the source file.

## Test file placement

- Co-located with source: `index.ts(x)` + `index.test.ts(x)` in the same folder.
- Never flat pairs `Name.tsx` + `Name.test.tsx` in the parent: folder them up.

## Shared types

- Cross-file shared types → `shared/types/<name>.ts`
- Cross-package types → `packages/types/src/`
- Single-file local types stay where they are used.

## Shared utilities

- Reusable utilities → `shared/utils/<name>.ts`
- A file enters `shared/` only when imported by 2+ distinct features. When in doubt, keep it in the feature; do not pre-share.
- Before creating a new shared util, grep `shared/utils/` for an existing one to reuse.
