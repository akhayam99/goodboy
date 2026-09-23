# Conventions: @goodboy/desktop

> **Read this when** you're writing code inside `apps/desktop` and need to know where Tauri, state and routing code may go. **Not for** process rules for the whole repo (`CONVENTIONS.md`), folder layout (`docs/file-system.md`), or TypeScript style (`docs/typescript/`).

The Tauri desktop app. It uses every internal package.

## Scope

This app is the **only** layer that calls Tauri commands (`invoke`) and imports `@tauri-apps/*`. It also owns global state (Zustand), routing, layouts, and the app shell. Business logic stays in `@goodboy/core`, presentational components in `@goodboy/ui`, SQL in `@goodboy/db`, types in `@goodboy/types`.

## Folder structure

[docs/file-system.md](../../docs/file-system.md) owns the layout and decides where new code goes. Code reused across features moves to `shared/`. No deep imports from one feature into another.

## Tauri command patterns

- Each command gets one thin wrapper, in the feature's `features/<domain>/<domain>.ts` (or `shared/lib/` when no feature owns it). Components never call `invoke` directly.
- A command returns a Rust `Result<T, E>`. Tauri resolves with `T` on `Ok(T)` and **rejects** on `Err(E)`, with `E` serialized as the rejection value. No tagged `{ ok, value }` envelope travels over the wire. So the wrapper catches the rejection, maps it to a typed domain error, and throws that again.
- Errors are domain types from `@goodboy/types`. Never show raw Tauri error strings in the UI.
- Validate what a command returns at the boundary if the Rust side is not the single source of truth.

## Capabilities & security

- `tauri.conf.json` capabilities: as few as possible, allowlist style. No wildcard `**`. `capabilities/default.json` is the list. It grants no shell permission at all, so the frontend cannot start any process.
- API keys: **never** in `tauri.conf.json`, the SQL DB, the store plugin, env files, or `localStorage`. Use the OS keyring through the keyring plugin.
- No `dangerousDisableAssetCspModification`. Strict CSP.
- **Starting processes happens in Rust, behind a `#[tauri::command]`.** There is no `plugin-shell` and no binary allowlist to rely on. So the safety line is what the caller is allowed to pass. Some commands do take a binary or a shell string (`turn_spawn`'s `binary`, `provider_lifecycle_run`'s `command`). That value comes from a constant table (the provider registry, `PROVIDER_LIFECYCLE_COMMANDS` in `@goodboy/types`), never built from user or model text. A new command that starts a process reads its binary and flags from a table, or builds argv in Rust.
- **Agent turns never go through a shell.** `turn.rs` builds argv with `build_provider_cli_args` and calls the binary directly. The side calls (`summarize.rs`, `planner.rs`) do the same. So a shell never splits anything a model writes into words. Where a shell does run, its body is the user's own text or a table constant:
  - `scripts.rs`: `bash -c` on a workspace script the user wrote.
  - `terminal.rs`: the user's login shell.
  - `provider_lifecycle.rs`: install and login.
  - `skills.rs`: a skill script file, with its path guarded under `<workspace>/.kay/skills`.
- **Every process Goodboy starts replays the login environment.** [docs/architecture.md](../../docs/architecture.md) → Subprocess environment owns how it works and why (a Dock-launched app needs it). This is on purpose and it is broad. The resolved env is the user's own shell, not a sandbox.
- Every provider process start removes the env vars of a nested session (`CLAUDECODE`, `CLAUDE_CODE_ENTRYPOINT`, `CLAUDE_AGENT_SDK_VERSION`), through `aux_spawn::scrub_nested_session_env`. If they stay, the CLI refuses to run or falls back to broken auth.

## State (Zustand)

- One store, built from one slice package per domain under `store/slices/<domain>/` ([docs/file-system.md](../../docs/file-system.md)). A feature does not own a store.
- No `useEffect` to copy props into store state. Derive the value when you read it, or pass it explicitly.
- Selector rules live in [AGENTS.md](../../AGENTS.md) → Store selectors and memoization.
- Async actions live in the store. Components dispatch them and react to derived state.
- Use `zustand/middleware/persist` only for UI preferences. Domain data lives in SQLite.
- Never build a singleton at the top level of a module. Create stores in a factory if tests need to stay isolated.

## React patterns

[docs/typescript/components.md](../../docs/typescript/components.md) owns them. Two additions for desktop: `useTransition` for updates that are not urgent and for async UX. `use()` to unwrap promises, only at suspense boundaries you own.

## Styling

Mechanics live in [docs/styling.md](../../docs/styling.md). Theme rules that
never change live in [DESIGN.md](../../DESIGN.md).

## Naming

General rules live in [AGENTS.md](../../AGENTS.md) → Naming. For desktop only: `store/store.ts` exports `useAppStore`, and `store/index.ts` re-exports it. Slices are folders, not `<feature>-store.ts` files. Tauri wrappers use the command name in camelCase, in the owning feature's `<domain>.ts`.

## Testing

Rules live in [docs/testing.md](../../docs/testing.md). For this package: in component tests, mock the Tauri boundary (`invoke`), never internal modules. Store tests create a fresh store, call actions, and check the state.

## Code rules

Owned by [AGENTS.md](../../AGENTS.md) and [docs/typescript/](../../docs/typescript/). One addition for desktop: discriminated unions cover command results too, not only state machines.
