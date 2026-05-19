# Conventions — @kay-am/desktop

Tauri 2 desktop app. React 19 + Vite 6 + Tailwind v4 + Zustand. Consumes `@kay-am/ui`, `@kay-am/core`, `@kay-am/db`, `@kay-am/types`.

## Stack

- **Shell**: Tauri 2 (Rust). Capabilities are minimal and explicit.
- **Frontend**: React 19, Vite 6, TypeScript strict.
- **Styling**: Tailwind CSS v4 via `@tailwindcss/vite`. Light mode only.
- **State**: Zustand. Slices by domain.
- **Data**: SQLite via `@tauri-apps/plugin-sql`, queried through `@kay-am/db`.
- **Process spawning**: direct from Rust commands (not via `plugin-shell`). All command surfaces are allowlisted ([ADR-0003](../../docs/adr/0003-tauri-command-boundary.md)).

## Scope

This app is the **only** layer that:

- Calls Tauri commands (`invoke`).
- Owns global state (Zustand stores).
- Imports `@tauri-apps/*`.
- Wires features end-to-end (UI ↔ store ↔ Tauri ↔ DB).
- Owns routing, layouts, and the app shell.

Business logic stays in `@kay-am/core`. Presentational components stay in `@kay-am/ui`. SQL stays in `@kay-am/db`. Types stay in `@kay-am/types`.

## Folder structure

See [ADR-0001](../../docs/adr/0001-feature-first-code-placement.md).

```
src/
├── main.tsx
├── App.tsx
├── styles.css
├── app/                  # shell, routing, layouts, providers, toast
├── features/             # vertical slices, one folder per domain
│   ├── workspace/
│   │   ├── workspace.ts        # pure domain logic (no React, no Zustand)
│   │   ├── workspace.test.ts
│   │   ├── tauri.ts            # invoke wrappers for this feature
│   │   ├── components/
│   │   │   └── WorkspaceList/
│   │   │       ├── index.tsx           # parent component
│   │   │       ├── WorkspaceRow.tsx    # private child (no parent prefix)
│   │   │       └── EmptyState.tsx
│   │   └── utils/                # feature-local helpers
│   ├── providers/
│   ├── chat/
│   └── ...
├── shared/               # cross-feature hooks, utils, ui adapters
│   ├── hooks/
│   ├── lib/                    # thin wrappers over browser / Tauri APIs
│   ├── components/             # primitives composed by ≥2 features
│   └── utils/
└── store/                # Zustand store and slices
    ├── store.ts
    ├── selectors.ts            # cross-slice reads
    └── slices/
        └── <domain>.slice.ts
```

- Nothing else at `src/` root.
- `shared/` admission criterion: a file enters only when imported by 2+ features.
- No barrel files inside subfolders.

## Component organisation

See [ADR-0002](../../docs/adr/0002-component-co-location.md).

- Components in PascalCase folders with `index.tsx`. Private children are sibling files **without parent prefix** (`Header.tsx`, not `WorkspacesSidebarHeader.tsx`).
- One component per file. File name matches the export.
- A component over ~400 lines is a sign to extract sub-components and/or split off hooks. A component over ~800 lines is a bug.

## Tauri command patterns

- One wrapper per command in `features/<x>/tauri.ts`. **Components and stores never call `invoke` directly.**
- Commands return `Result<T, E>`-shaped payloads. The wrapper unwraps and throws a typed domain error, or returns `T`. Errors are `{kind, message}` — never raw strings.
- `shared/lib/db.ts`, `shared/lib/editor.ts` and similar generic boundary modules are an exception only because their target commands are workspace-wide infrastructure, not a specific feature.

## Capabilities & security

- `tauri.conf.json` capabilities: minimal allowlist. No wildcard `**`.
- Strict CSP (`default-src 'self'`).
- API keys: never in `tauri.conf.json`, the DB, env files, or `localStorage`. OS keyring via `keyring` crate.
- Process spawning: only via the typed command surface; arguments allowlisted per [ADR-0003](../../docs/adr/0003-tauri-command-boundary.md).

## State (Zustand)

- One slice per domain. A slice owns its state shape and actions and **must not** import from another slice. Cross-domain reads go through `selectors.ts`.
- Slice files live in `store/slices/<domain>.slice.ts`. Tests in `store/store.<scenario>.test.ts` colocated.
- No `useEffect` to sync props into store state — derive at read time, or pass explicitly.
- Selectors with `useStore(state => state.x)`. No object-identity selectors that re-render on every change.
- Async actions live in the store; components dispatch and react to derived state.
- Persistence via `zustand/middleware/persist` only for UI prefs. Domain data lives in SQLite.
- No singletons constructed at module top-level — create stores in a factory if test isolation matters.

## React 19 patterns

- No `React.FC`. Function components with explicit prop types.
- `ref` is a regular prop. No `forwardRef`.
- `useTransition` for non-urgent updates and async UX.
- `use()` for unwrapping promises only at suspense boundaries you own.
- `key`: stable IDs from domain types, never array index.
- Props typed as `interface` or `type`, never inline.

## Styling

- Tailwind utility-first. No `@apply`. No CSS modules.
- Tokens defined in `styles.css` `@theme` block (OKLCH). Reference via utility classes.
- Light mode only — no `dark:` variants until dark mode is an actual feature.
- Conditional classes via `cn()` from `@kay-am/ui`.
- Always merge a `className` prop last in component primitives — callers can override.

## Naming

- Components: PascalCase, one per file (`WorkspaceList.tsx` or `WorkspaceList/index.tsx`).
- Hooks: `use<Name>` camelCase, file `use-name.ts`.
- Utilities / folders: kebab-case.
- Slices: `<domain>.slice.ts` exporting `create<Domain>Slice`.
- Tauri wrappers: `<feature>/tauri.ts` exporting named functions in camelCase.

## Testing

See [ADR-0005](../../docs/adr/0005-test-layout.md).

- Vitest + `@testing-library/react` + `happy-dom`.
- Colocated tests, `.test.ts` / `.test.tsx` next to source.
- Store scenarios: `store.<scenario>.test.ts`.
- Mock `@tauri-apps/api/core`'s `invoke` at the test boundary; never mock internal modules.

## Code rules

- No `any`. `unknown` + type guards.
- No default exports. Named only.
- No prop spreading without explicit type.
- Discriminated unions for state machines and command results.
- `satisfies` over `as` for const validation.
- No comments unless explaining **why**. The code says **what**.
