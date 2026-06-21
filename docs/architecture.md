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

Never skip hooks (`git push --no-verify`) to dodge a missing-env failure; replay the environment instead. Windows has no login-shell probe; this is macOS/Linux scoped.

## Provider system

- Adapter pattern: each AI provider implements a common interface.
- Priority-based routing with usage thresholds.
- Provider config stored in SQLite, never in code.
- API keys stored securely via Tauri's credential store.

## VS Code integration

- Workspaces open in VS Code via `code /path/to/worktree`.
- Goodboy is the orchestrator, VS Code is the editor.
