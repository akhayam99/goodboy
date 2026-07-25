# Conventions: @goodboy/desktop

Tauri 2 desktop app. React 19 + Vite + Tailwind v4 + Zustand. Consumes all internal packages.

## Stack

- **Shell**: Tauri 2 (Rust). Capabilities are minimal and explicit.
- **Frontend**: React 19, Vite 6, TypeScript strict.
- **Styling**: Tailwind CSS v4 via `@tailwindcss/vite`. Dark by default, light via `html[data-theme='light']`.
- **State**: Zustand. Slices by domain.
- **Data**: SQLite via `rusqlite` in Rust, reached through the `db_exec` / `db_execute` / `db_select` commands and queried through `@goodboy/db`.
- **Subprocess**: Rust `std::process::Command` and `portable_pty`, both through `path_env`. See Capabilities & security below.

## Scope

This app is the **only** layer that:

- Calls Tauri commands (`invoke`).
- Owns global state (Zustand stores).
- Imports `@tauri-apps/*`.
- Wires features end-to-end (UI ↔ store ↔ Tauri ↔ DB).
- Owns routing, layouts, and the app shell.

Business logic stays in `@goodboy/core`. Presentational components stay in `@goodboy/ui`. SQL stays in `@goodboy/db`. Types stay in `@goodboy/types`.

## Folder structure

- [docs/file-system.md](../../docs/file-system.md) owns the layout (`app/`, `features/<domain>/`, `shared/`, `store/slices/<domain>/`) and the decision of where new code goes. It is the single source; the tree is not copied here.
- Cross-feature reuse moves to `shared/`. No deep imports across features.

## Tauri command patterns

- One thin wrapper per command, in the feature's `features/<domain>/<domain>.ts` (or `shared/lib/` when no feature owns it). Components never call `invoke` directly.
- A command returns Rust `Result<T, E>`. Tauri resolves `Ok(T)` and **rejects** on `Err(E)`, serializing `E` as the rejection value. There is no tagged `{ ok, value }` envelope on the wire, so the wrapper catches, maps the rejection to a typed domain error, and rethrows.
  ```ts
  export const ghStatus = async (workspaceId?: string): Promise<GhTokenStatus> => {
    try {
      return toStatus(await invoke<RawGhStatus>('gh_status', { workspaceId }));
    } catch (err) {
      throw new Error(`gh status check failed: ${formatError(err)}`, { cause: err });
    }
  };
  ```
- Errors are domain types from `@goodboy/types`. Never expose raw Tauri error strings to the UI.
- Validate command output at the boundary if the Rust side is not the single source of truth.

## Capabilities & security

- `tauri.conf.json` capabilities: minimal, allowlist-style. No wildcard `**`. `capabilities/default.json` is the list, and it grants no shell permission at all: the frontend cannot spawn anything.
- API keys: **never** in `tauri.conf.json`, the SQL DB, the store plugin, env files, or `localStorage`. Use the OS keyring via the keyring plugin.
- No `dangerousDisableAssetCspModification`. Strict CSP.
- **Spawning lives in Rust, behind a `#[tauri::command]`.** There is no `plugin-shell` and no binary allowlist to lean on, so the boundary is what the caller is allowed to pass. Where a command does take a binary or a shell string (`turn_spawn`'s `binary`, `provider_lifecycle_run`'s `command`), the value comes from a constant table (the provider registry, `PROVIDER_LIFECYCLE_COMMANDS` in `@goodboy/types`), never composed from user or model text. A new spawn command reads its binary and flags from a table, or builds argv in Rust.
- **Agent turns never go through a shell.** `turn.rs` builds argv with `build_provider_cli_args` and invokes the binary directly, as do the aux calls (`summarize.rs`, `planner.rs`), so nothing a model emits is word-split by a shell. Where a shell does run, the body is the user's own text or a table constant: `scripts.rs` (`bash -c` on a workspace script they authored), `terminal.rs` (their login shell), `provider_lifecycle.rs` (install and login), `skills.rs` (a skill script file, path-guarded under `<workspace>/.kay/skills`).
- **Every spawn replays the login environment.** `path_env::command` sets a `PATH` probed from the login shell; `command_with_login_env` replays the whole login env. Without it a macOS app launched from the Dock inherits the minimal posix `PATH` and cannot find `claude`, `codex`, `gh`, or a brew `git`. It is deliberate and it is broad: the resolved env is the user's own shell, not a sandbox.
- Nested-session env vars (`CLAUDECODE`, `CLAUDE_CODE_ENTRYPOINT`, `CLAUDE_AGENT_SDK_VERSION`) are scrubbed on every provider spawn (`aux_spawn::scrub_nested_session_env`). Leaving them in makes the CLI refuse or fall through to broken auth.

## State (Zustand)

- One store, composed from one slice package per domain under `store/slices/<domain>/`. Layout and slice file rules in [docs/file-system.md](../../docs/file-system.md). A feature does not own a store.
- No `useEffect` to sync props into store state: derive at read time, or pass explicitly.
- Selectors with `useStore(state => state.x)`. No object-identity selectors that re-render on every change.
- Async actions live in the store; components dispatch and react to derived state.
- Persistence via `zustand/middleware/persist` only for UI prefs. Domain data lives in SQLite.
- No singletons constructed at module top-level: create stores in a factory if test isolation matters.

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
- Dark is the default, light ships behind the top-bar toggle (`shared/lib/theme.ts` sets `html[data-theme='light']`). Still no `dark:` variants: the light palette overrides the same tokens, so styling against tokens themes both.
- Conditional classes via `cn()` from `@goodboy/ui`.

## Naming

- Components: PascalCase, one per file (`WorkspaceList.tsx`).
- Hooks: `use<Name>` camelCase, file / folder named `useName` (see root [AGENTS.md](../../AGENTS.md)).
- Utilities: camelCase modules. Folders: lowercase for boundaries.
- Store: `store/store.ts` exporting `useAppStore`, re-exported from `store/index.ts`. Slices are folders, not `<feature>-store.ts` files.
- Tauri wrappers: named functions matching command names in camelCase, in the owning feature's `<domain>.ts`.

## Testing

- Vitest + `@testing-library/react` + `happy-dom`.
- Mock the Tauri boundary (`invoke`) in component tests. Never mock internal modules.
- Store tests: instantiate a fresh store, call actions, assert state.
- Naming: `<File>.test.tsx` colocated.

## Code rules

The full code rules live in the hub [AGENTS.md](../../AGENTS.md) and the
[docs/typescript/](../../docs/typescript/) cluster (index at
[docs/typescript.md](../../docs/typescript.md)). Do not copy them here.

Desktop-specific addition:

- Discriminated unions cover command results, not only state machines.
