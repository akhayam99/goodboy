# Repo architecture

Owns the repo-level layout and the runtime systems that surround the React app:
subprocess environment, provider routing, and VS Code integration. For the
in-app `src/` file layout see [file-system.md](file-system.md). For the monorepo
package and tooling layout see [CONVENTIONS.md](../CONVENTIONS.md).

## Layout

```
goodboy/
├── apps/
│   └── desktop/        # Tauri shell + React UI
│       ├── src-tauri/  # Rust backend (Tauri commands, SQLite, process spawn)
│       └── src/
│           ├── app/       # App shell, routing, layouts
│           ├── features/  # Feature modules (workspace, providers, chat, ...)
│           ├── shared/    # Cross-feature components, hooks, utils, types
│           └── store/     # Zustand store + slice packages
├── packages/
│   ├── core/           # Provider-agnostic domain logic
│   ├── db/             # SQLite schema + queries
│   ├── types/          # Cross-package shared types
│   └── ui/             # Shadcn-based shared UI components
└── website/            # Marketing site (standalone, not in pnpm workspace)
```

## Subprocess environment

macOS/Linux GUI apps launched from Finder/Dock inherit a minimal environment, not the user's terminal one. The Rust shell resolves the real environment from the login shell and replays it onto spawned processes (`apps/desktop/src-tauri/src/path_env.rs`):

- `command(binary)`: PATH only. The default. Use for internal git plumbing (`rev-parse`, worktree management) and any subprocess that runs no user hooks.
- `command_with_login_env(binary)`: full login-shell env, resolved once via `zsh -ilc env` and cached. Use for subprocesses that can trigger user-authored git hooks or tooling, so they behave as they would in a terminal. `run_git_push` uses it: a repo's `pre-push` hook can read variables exported in `~/.zshrc` (registry tokens, tool config).
- `resolved_env()`: the same cached env as a key/value slice, for spawners that never build a `Command`. `scripts.rs` (workspace scripts) and `provider_lifecycle.rs` (install and connect commands) both run `bash -c <body>` in a pty and replay it onto a `CommandBuilder`.
- `login_shell()`: the user's shell, `$SHELL` when it exists on disk, else the first platform candidate, else `/bin/sh`. `terminal.rs` calls it so the embedded terminal and the env probe agree on one shell.

The rule that follows: anything running a user-authored script body replays the login environment. `PATH` and `TERM` are applied after the replay, so they win over whatever the profile exported.

Never skip hooks (`git push --no-verify`) to dodge a missing-env failure; replay the environment instead. Windows has no login-shell probe; this is macOS/Linux scoped.

## Provider system

- Adapter pattern: each AI provider implements a common interface.
- Priority-based routing with usage thresholds.
- The model registry is compiled, not stored: ids, family, cost tier, effort ladder, context window and routing weight live in `packages/core/src/providers/capabilities.ts`. Prices are compiled too, in a separate table (`providers/claude/cost.ts`, `providers/cursor/cost.ts`, and the shipped `apps/desktop/src/features/providers/pricing.json` for codex and gemini).
- SQLite holds only the overrides on top of that registry: `workspaces.default_provider_id`, `workspaces.provider_bindings`, `workspaces.task_models`, `workspaces.role_models`, plus `sessions.default_provider_id` and `sessions.provider_bindings`.
- A stored pin is validated against the registry at read time (`resolveTaskModel`, `resolveRoleRouting`). A provider or model id the registry no longer carries falls back to the compiled default instead of reaching a spawn.
- API keys stored securely via Tauri's credential store.

## Database migrations

One migration per file, `mNNN-kebab-name.ts` under `packages/db/src/migrations/`, exporting a single `mNNNName` sql string. Register it in `index.ts` at the version in its filename.

The runner (`runner.ts`) keeps a **set** of applied versions, not a high-water mark: a version already present in `schema_version` is skipped. So if two branches both add version N, whichever merges second finds N already applied on every machine that ran the first, and its migration never runs. No error, no warning, permanently. Renumber before merging. Two migrations that touch different tables need no ordering between them once renumbered.

Each migration is split into segments at `PRAGMA foreign_keys` boundaries. Every segment commits on its own and writes a checkpoint row in `schema_migration_segment`, so an interrupted migration resumes at the next segment instead of half-applying. Only the final segment stamps `schema_version` and clears the checkpoints.

A statement that fails with "already exists" or "duplicate column name" is treated as already applied: warned, not fatal.

`registry.test.ts` is the guard. It fails CI on a duplicate version, a gap in the range, or a filename that disagrees with its registered version, and it asserts that upgrading from every intermediate version reaches the exact schema of a fresh install.

## VS Code integration

- Workspaces open in VS Code via `code /path/to/worktree`.
- Goodboy is the orchestrator, VS Code is the editor.
