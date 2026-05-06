# Conventions — @kay-am/desktop

Tauri 2 desktop app. React 19 + Vite + Tailwind v4 + Zustand. Consumes all internal packages.

> The Rust side under `src-tauri/` is not yet scaffolded. Run `pnpm tauri init` from this directory once Tauri CLI is installed. Until then, only the web app is wired up.

## Stack

- **Shell**: Tauri 2 (Rust). Capabilities are minimal and explicit.
- **Frontend**: React 19, Vite 6, TypeScript strict.
- **Styling**: Tailwind CSS v4 via `@tailwindcss/vite`. Light mode only.
- **State**: Zustand. Slices by domain.
- **Data**: SQLite via `@tauri-apps/plugin-sql`, queried through `@kay-am/db`.
- **Subprocess**: `@tauri-apps/plugin-shell` with strict scope. No arbitrary command execution.

## Scope

This app is the **only** layer that:

- Calls Tauri commands (`invoke`).
- Owns global state (Zustand stores).
- Imports `@tauri-apps/*`.
- Wires features end-to-end (UI ↔ store ↔ Tauri ↔ DB).
- Owns routing, layouts, and the app shell.

Business logic stays in `@kay-am/core`. Presentational components stay in `@kay-am/ui`. SQL stays in `@kay-am/db`. Types stay in `@kay-am/types`.

## Folder structure

```
src/
├── main.tsx
├── App.tsx
├── styles.css
├── app/                  # shell, routing, layouts, providers
├── features/             # vertical slices, one folder per domain
│   ├── workspace/
│   │   ├── components/
│   │   ├── store.ts
│   │   ├── tauri.ts      # invoke wrappers for this feature
│   │   └── index.ts
│   ├── providers/
│   ├── tasks/
│   └── balance/
└── shared/               # cross-feature hooks, utils, ui adapters
    ├── hooks/
    ├── tauri/            # generic invoke helper, error mapping
    └── store/            # store creator, devtools, persistence config
```

- A feature owns its components, store slice, and Tauri bindings.
- Cross-feature reuse moves to `shared/`. No deep imports across features.

## Tauri command patterns

- One thin wrapper per command in `features/<x>/tauri.ts`. Components never call `invoke` directly.
- Commands return `Result<T, E>`-shaped payloads — Rust serializes both arms. The wrapper unwraps and throws a typed domain error, or returns `T`.
  ```ts
  type CommandResult<T, E> = { ok: true; value: T } | { ok: false; error: E };
  ```
- Errors are domain types from `@kay-am/types`. Never expose raw Tauri error strings to the UI.
- Validate command output at the boundary if the Rust side is not the single source of truth.

## Capabilities & security

- `tauri.conf.json` capabilities: minimal, allowlist-style. No wildcard `**`.
- `plugin-shell` scope: explicit binary list (`code`, `git`). No `sh -c`.
- `plugin-sql`: scoped to the app DB file under the platform app-data dir.
- API keys: **never** in `tauri.conf.json`, the SQL DB, the store plugin, env files, or `localStorage`. Use the OS keyring via the keyring plugin.
- No `dangerousDisableAssetCspModification`. Strict CSP.
- Process spawning: only via `plugin-shell` with strict scope. No `Command::new` from arbitrary user input.

## State (Zustand)

- One store per feature slice. Compose at the app root if needed.
- No `useEffect` to sync props into store state — derive at read time, or pass explicitly.
- Selectors with `useStore(state => state.x)`. No object-identity selectors that re-render on every change.
- Async actions live in the store; components dispatch and react to derived state.
- Persistence via `zustand/middleware/persist` only for UI prefs. Domain data lives in SQLite.
- No singletons constructed at module top-level — create stores in a factory if test isolation matters.

## React 19 patterns

- No `React.FC`. Function components with explicit prop types.
- `ref` is a regular prop. No `forwardRef`.
- `useTransition` for non-urgent updates and async UX (loading states without blocking input).
- `use()` for unwrapping promises only at suspense boundaries you own.
- Server Components are not used (this is a desktop app).
- `key` strategy: stable IDs from domain types, never array index.

## Styling

- Tailwind utility-first. No `@apply`. No CSS modules.
- Tokens defined in `styles.css` `@theme` block (OKLCH). Reference via utility classes.
- Light mode only. No `dark:` variants until dark mode is a feature.
- Conditional classes via `cn()` from `@kay-am/ui`.

## Naming

- Components: PascalCase, one per file (`WorkspaceList.tsx`).
- Hooks: `use<Name>` camelCase, file `use-name.ts`.
- Utilities/folders: kebab-case.
- Stores: `<feature>-store.ts` exporting `use<Feature>Store`.
- Tauri wrappers: `<feature>/tauri.ts` exporting named functions matching command names in camelCase.

## Testing

- Vitest + `@testing-library/react` + `happy-dom`.
- Mock the Tauri boundary (`invoke`) in component tests. Never mock internal modules.
- Store tests: instantiate a fresh store, call actions, assert state.
- Naming: `<File>.test.tsx` colocated.

## Code rules

- No `any`. `unknown` + type guards.
- No default exports. Named only.
- No prop spreading without explicit type.
- Discriminated unions for state machines and command results.
- `satisfies` over `as` for const validation.
- No comments unless explaining WHY.
