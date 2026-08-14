# Conventions: @goodboy/desktop

> **Read this when** you're writing code inside `apps/desktop` and need its Tauri/state/routing boundaries. **Not for** repo-wide process rules (`CONVENTIONS.md`), folder layout (`docs/file-system.md`), or TypeScript style (`docs/typescript/`).

Tauri desktop app. Consumes all internal packages.

## Scope

This app is the **only** layer that calls Tauri commands (`invoke`), imports `@tauri-apps/*`, owns global state (Zustand), and owns routing, layouts, and the app shell. Business logic stays in `@goodboy/core`, presentational components in `@goodboy/ui`, SQL in `@goodboy/db`, types in `@goodboy/types`.

## Folder structure

[docs/file-system.md](../../docs/file-system.md) owns the layout and the decision of where new code goes. Cross-feature reuse moves to `shared/`. No deep imports across features.

## Tauri command patterns

- One thin wrapper per command, in the feature's `features/<domain>/<domain>.ts` (or `shared/lib/` when no feature owns it). Components never call `invoke` directly.
- A command returns Rust `Result<T, E>`. Tauri resolves `Ok(T)` and **rejects** on `Err(E)`, serializing `E` as the rejection value. There is no tagged `{ ok, value }` envelope on the wire, so the wrapper catches, maps the rejection to a typed domain error, and rethrows.
- Errors are domain types from `@goodboy/types`. Never expose raw Tauri error strings to the UI.
- Validate command output at the boundary if the Rust side is not the single source of truth.

## Capabilities & security

- `tauri.conf.json` capabilities: minimal, allowlist-style. No wildcard `**`. `capabilities/default.json` is the list, and it grants no shell permission at all: the frontend cannot spawn anything.
- API keys: **never** in `tauri.conf.json`, the SQL DB, the store plugin, env files, or `localStorage`. Use the OS keyring via the keyring plugin.
- No `dangerousDisableAssetCspModification`. Strict CSP.
- **Spawning lives in Rust, behind a `#[tauri::command]`.** There is no `plugin-shell` and no binary allowlist to lean on, so the boundary is what the caller is allowed to pass. Where a command does take a binary or a shell string (`turn_spawn`'s `binary`, `provider_lifecycle_run`'s `command`), the value comes from a constant table (the provider registry, `PROVIDER_LIFECYCLE_COMMANDS` in `@goodboy/types`), never composed from user or model text. A new spawn command reads its binary and flags from a table, or builds argv in Rust.
- **Agent turns never go through a shell.** `turn.rs` builds argv with `build_provider_cli_args` and invokes the binary directly, as do the aux calls (`summarize.rs`, `planner.rs`), so nothing a model emits is word-split by a shell. Where a shell does run, the body is the user's own text or a table constant: `scripts.rs` (`bash -c` on a workspace script they authored), `terminal.rs` (their login shell), `provider_lifecycle.rs` (install and login), `skills.rs` (a skill script file, path-guarded under `<workspace>/.kay/skills`).
- **Every spawn replays the login environment.** Mechanism and the reasoning (why a Dock-launched app needs it) are owned by [docs/architecture.md](../../docs/architecture.md) → Subprocess environment. It is deliberate and it is broad: the resolved env is the user's own shell, not a sandbox.
- Nested-session env vars (`CLAUDECODE`, `CLAUDE_CODE_ENTRYPOINT`, `CLAUDE_AGENT_SDK_VERSION`) are scrubbed on every provider spawn (`aux_spawn::scrub_nested_session_env`). Leaving them in makes the CLI refuse or fall through to broken auth.

## State (Zustand)

- One store, composed from one slice package per domain under `store/slices/<domain>/` ([docs/file-system.md](../../docs/file-system.md)). A feature does not own a store.
- No `useEffect` to sync props into store state: derive at read time, or pass explicitly.
- Selector rules in [AGENTS.md](../../AGENTS.md) → Store selectors and memoization.
- Async actions live in the store; components dispatch and react to derived state.
- Persistence via `zustand/middleware/persist` only for UI prefs. Domain data lives in SQLite.
- No singletons constructed at module top-level: create stores in a factory if test isolation matters.

## React patterns

[docs/typescript/components.md](../../docs/typescript/components.md) owns them. Desktop additions: `useTransition` for non-urgent updates and async UX; `use()` for unwrapping promises only at suspense boundaries you own.

## Styling

Mechanics live in [docs/styling.md](../../docs/styling.md). Theme invariants
live in [DESIGN.md](../../DESIGN.md).

## Naming

General rules in [AGENTS.md](../../AGENTS.md) → Naming. Desktop-specific: `store/store.ts` exports `useAppStore`, re-exported from `store/index.ts`; slices are folders, not `<feature>-store.ts` files. Tauri wrappers match command names in camelCase, in the owning feature's `<domain>.ts`.

## Testing

Rules in [docs/testing.md](../../docs/testing.md). Package-specific: mock the Tauri boundary (`invoke`) in component tests, never internal modules; store tests instantiate a fresh store, call actions, assert state.

## Code rules

Owned by [AGENTS.md](../../AGENTS.md) and [docs/typescript/](../../docs/typescript/). Desktop addition: discriminated unions cover command results, not only state machines.
