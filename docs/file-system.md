# File system layout

Owns the file and folder layout of the codebase and the decision of where new
code goes. For naming rules see [AGENTS.md](../AGENTS.md) → Naming. For test
content and rules see [testing.md](testing.md). For repo-level package
architecture see [architecture.md](architecture.md).

## Top-level (`apps/desktop/src/`)

```
app/        # App shell only: routing, layout, boot, global error handling
features/   # One directory per product domain
shared/     # Code used by 2+ features, no domain owner
store/      # Zustand store + slice packages
main.tsx
```

Nothing else at `src/` root. No `src/types/`, `src/constants/`, `src/models/`: each becomes a magnet for undisciplined global state. Domain code lives in its feature; cross-feature code earns its way into `shared/`.

## Feature modules (`features/<domain>/`)

A feature is self-contained:

- `<domain>.ts`: core domain logic (types, constants, pure functions). No React, no Zustand imports.
- `utils/`: private to the feature. Promote to `shared/utils/` only once a second feature needs it.
- `components/<Name>/`: see Components below.
- Assets (JSON, SVG) live next to the feature that owns them, never in `public/` or a global `src/data/`.

## App shell (`app/`)

Only code that is global by definition: `App.tsx`, `main.tsx`, `styles.css`, and shell components (boot splash, error boundary, status bar, toast, `AppTopBar`, `AppBreadcrumb`, `AppShell`). A component rendered in a single feature's view belongs in that feature, not here. For the breadcrumb IA and `AppTopBar` control layout see [navigation.md](navigation.md).

## Components (`apps/desktop/src/features/**/components/`, `apps/desktop/src/shared/components/`)

Rule: **1 file = 1 export = 1 definition**.

- Small component, no test → flat file: `parent/Name.tsx`
- Small component WITH test → folder: `parent/Name/index.tsx` + `parent/Name/index.test.tsx`
- Large component (>~250 lines) OR split into sub-pieces → folder: `parent/Name/index.tsx` + sub-files (imported only by `index.tsx`) + optional `index.test.tsx`
- **Never** a folder containing only `index.tsx` and nothing else (no test, no sub-files). If only the index exists, flatten to `parent/Name.tsx`.

## Hooks

- Cross-domain reusable hook → `apps/desktop/src/shared/hooks/<useFoo>/index.ts`
- Domain-local hook → `apps/desktop/src/features/<domain>/hooks/<useFoo>/index.ts`
- Folder convention is the same as components: folder with `index.ts` + `index.test.ts` when test exists, flat `useFoo.ts` if no test.
- Hooks tightly coupled to a single parent component (e.g. internal state binding) can stay as sibling files in the component folder.

## Store slices (`apps/desktop/src/store/slices/<name>/`)

Each slice is a **package folder**:

```
slices/<name>/
├── index.ts                  (slice compositor: assembles state + actions + selectors)
├── index.test.ts             (slice public contract test)
├── state.ts                  (initial state + type, when non-trivial)
├── <action1>.ts              (one file per action)
├── select<Thing>.ts          (one file per selector)
└── types.ts                  (slice-local types; re-exports SetFn/GetFn from `../../slice-types`)
```

- `apps/desktop/src/store/store.ts` is composition only, no domain logic.
- Shared `SetFn`/`GetFn` live in `apps/desktop/src/store/slice-types.ts` (typed against `AppStore`).
- Slice-internal cross-file utilities export through the slice's `index.ts` only when consumers outside the slice need them. Otherwise import directly from the source file.

## Test file placement

- Co-located with source: `index.ts(x)` + `index.test.ts(x)` in the same folder.
- Never flat pairs `Name.tsx` + `Name.test.tsx` in the parent: folder them up.

What to test and how lives in [testing.md](testing.md).

## Shared types

- Cross-file shared types → `apps/desktop/src/shared/types/<name>.ts`
- Cross-package types → `packages/types/src/`
- Single-file local types stay where they are used.

## Shared utilities

- Reusable utilities → `apps/desktop/src/shared/utils/<name>.ts`
- A file enters `shared/` only when imported by 2+ distinct features. When in doubt, keep it in the feature; do not pre-share.
- Before creating a new shared util, grep `apps/desktop/src/shared/utils/` for an existing one to reuse.

## Where new code goes

```
used only inside one feature?
  → React component  → features/<domain>/components/<Name>/index.tsx
  → utility/helper   → features/<domain>/utils/<name>.ts
  → otherwise        → features/<domain>/<domain>.ts
used by the app shell (routing, layout, boot)?
  → app/components/<Name>/index.tsx
used by 2+ features, no domain owner?
  → shared/{lib|hooks|utils}/<name>.ts
Zustand state?
  → store/slices/<domain>/
```
