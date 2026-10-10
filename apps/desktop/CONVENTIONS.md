# Conventions: @goodboy/desktop

> **Read this when** you're writing code inside `apps/desktop` and need to know where Tauri, state and routing code may go. **Not for** process rules for the whole repo (`CONVENTIONS.md`), folder layout (`docs/file-system.md`), or TypeScript style (`docs/typescript/`).

The Tauri desktop app. It uses every internal package.

## Scope

This app is the **only** layer that calls Tauri commands (`invoke`) and imports `@tauri-apps/*`. It also owns global state (Zustand), routing, layouts, and the app shell. Business logic stays in `@goodboy/core`, presentational components in `@goodboy/ui`, SQL in `@goodboy/db`, types in `@goodboy/types`.

## Folder structure

[docs/file-system.md](../../docs/file-system.md) owns the layout and decides where new code goes. Code reused across features moves to `shared/`. No deep imports from one feature into another: a ratchet test counts them and the count only falls (file-system.md, Boundaries between layers).

The folder rule, stated once in [docs/file-system.md](../../docs/file-system.md) → The folder rule: a folder exists only when it holds more than its entry file. Components with a test or sub-files are `Name/index.tsx` folders, hooks are always `useFoo/index.ts` folders, and other modules are flat `name.ts` + `name.test.ts` pairs. `shared/utils/` holds pure functions and `shared/lib/` the runtime boundary (Tauri wrappers, storage, flags). Do not restate the rule in another doc.

## Tauri command patterns

- Each command gets one thin wrapper, in the feature's `features/<domain>/<domain>.ts` (or `shared/lib/` when no feature owns it). Store actions and feature wrapper modules may call `invoke`. Components and hooks never import it. They pass a wrapper instead, including where a `@goodboy/core` helper takes an `invokeFn`.
- A command returns a Rust `Result<T, E>`. Tauri resolves with `T` on `Ok(T)` and **rejects** on `Err(E)`. No tagged `{ ok, value }` envelope travels over the wire.
- Every `E` serializes to an object with `kind` and `message`: an error enum calls `impl_error_serialize!` from `util/mod.rs` and gives each variant a `kind()`; a command with no enum of its own returns `util::MessageError` (`refused` or `failed`). An enum whose variants carry data the UI reads (`BranchCleanupError`) serializes the same two fields by hand and adds that data as extra fields. Never a bare string, and every message reads as a sentence to a user.
- A wire struct puts `#[serde(rename_all = "camelCase")]` on the struct, never a `rename` on each field. Only a key that is not the camelCase of its field keeps its own `rename`. `workflows::wire_shape_tests` and `config_export::wire_shape_tests` pin the json of the workflow and config structs.
- Shared Rust helpers live in `src-tauri/src/util/`: `time.rs` (`now_ms`, `now_secs`, `iso_now`, `ms_to_iso`, `iso_to_ms` and the one calendar), `ids.rs` (`uuid_v4`) and `encoding.rs` (`percent_encode`). A module never defines its own copy.
- `db_select`, `db_execute` and `db_transaction` compile through `prepare_cached` (cache of 128 statements, set in `open_connection`). A compiled statement outlives a migration, so column names are read from the row after the first step, never before it. New SQL in `db.rs` uses `prepare_cached`.
- On the TS side, wrappers call `invokeCommand` from `shared/lib/invokeCommand.ts`, never `invoke`. It turns any rejection into a `CommandError` with `kind` and `message`, and keeps the raw rejection as `cause` so extra fields stay reachable (`asBranchCleanupError` reads them from there). Callers branch on `kind` and never on message text; `unknown` means the wrapper could not tell.
- Show an error with `formatError` from `@goodboy/ui`. Never `String(error)` and never `error instanceof Error ? error.message : String(error)`: on a rejection that is not an `Error` those print `[object Object]`.
- Errors are domain types from `@goodboy/types`. Never show raw Tauri error strings in the UI.
- Validate what a command returns at the boundary if the Rust side is not the single source of truth.

## Capabilities & security

- `tauri.conf.json` capabilities: as few as possible, allowlist style. No wildcard `**`. `capabilities/default.json` is the list. It grants no shell permission at all, so the frontend cannot start any process.
- API keys: **never** in `tauri.conf.json`, the SQL DB, env files, or `localStorage`. Use the OS keychain through the `keyring` crate behind `secrets.rs`. There is no store plugin.
- No `dangerousDisableAssetCspModification`. Strict CSP.
- **Starting processes happens in Rust, behind a `#[tauri::command]`.** There is no `plugin-shell` and no binary allowlist to rely on. So the safety line is what the caller is allowed to pass. Some commands do take a binary or a shell string (`turn_spawn`'s `binary`, `provider_lifecycle_run`'s `command`). That value comes from a constant table (the provider registry, `PROVIDER_LIFECYCLE_COMMANDS` in `@goodboy/core`), never built from user or model text. A new command that starts a process reads its binary and flags from a table, or builds argv in Rust.
- **Agent turns never go through a shell.** `turn.rs` builds argv with `cli_args::turn_args` and calls the binary directly. The side calls (`summarize.rs`, `planner.rs`) build theirs with `cli_args::side_job_args`, which rejects any write or permission-bypass flag. So a shell never splits anything a model writes into words. Where a shell does run, its body is the user's own text or a table constant:
  - `scripts.rs`: `bash -c` on a workspace script the user wrote.
  - `terminal.rs`: the user's login shell.
  - `provider_lifecycle.rs`: install, update and login.
  - `skills.rs`: a skill script file, with its path guarded under `<project-root>/.kay/skills`.
- **Which processes replay the login environment** is owned by [docs/architecture.md](../../docs/architecture.md) → Subprocess environment. A script body the user wrote gets it. Everything else gets only PATH. Where it is replayed it is broad: the resolved env is the user's own shell, not a sandbox.
- Every provider process start removes the env vars of a nested session (`CLAUDECODE`, `CLAUDE_CODE_ENTRYPOINT`, `CLAUDE_AGENT_SDK_VERSION`), through `aux_spawn::scrub_nested_session_env`. If they stay, the CLI refuses to run or falls back to broken auth.

## State (Zustand)

- One store, built from one slice package per domain under `store/slices/<domain>/` ([docs/file-system.md](../../docs/file-system.md)). A feature does not own a store.
- No `useEffect` to copy props into store state. Derive the value when you read it, or pass it explicitly.
- Selector rules live in [AGENTS.md](../../AGENTS.md) → Store selectors and memoization.
- Async actions live in the store. Components dispatch them and react to derived state.
- Use `zustand/middleware/persist` only for UI preferences. Domain data lives in SQLite.
- Never build a singleton at the top level of a module. Create stores in a factory if tests need to stay isolated.

## React patterns

[docs/typescript/components.md](../../docs/typescript/components.md) owns them. One addition for desktop: `use()` to unwrap promises, only at suspense boundaries you own.

## Styling

Mechanics live in [docs/styling.md](../../docs/styling.md). Theme rules that
never change live in [DESIGN.md](../../DESIGN.md).

## Naming

General rules live in [AGENTS.md](../../AGENTS.md) → Naming. For desktop only: `store/store.ts` exports `useAppStore`, and `store/index.ts` re-exports it. Slices are folders, not `<feature>-store.ts` files. Tauri wrappers use the command name in camelCase, in the owning feature's `<domain>.ts`.

## Testing

Rules live in [docs/testing.md](../../docs/testing.md). For this package: in component tests, mock the Tauri boundary (`invoke`). Module mocks of our own packages (`@goodboy/db` and the like) come only from the `storyHarness` factories, never from a private `vi.mock` body. Store tests create a fresh store, call actions, and check the state.

## Code rules

Owned by [AGENTS.md](../../AGENTS.md) and [docs/typescript/](../../docs/typescript/). One addition for desktop: discriminated unions cover command results too, not only state machines.
