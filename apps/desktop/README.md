# @goodboy/desktop

Tauri 2 desktop app for Goodboy. React 19 + Vite + Tailwind v4 + Zustand.

The orchestrator UI: workspaces, providers, tasks, balance. Local-only - no servers, no telemetry.

## Dev

```sh
pnpm --filter @goodboy/desktop dev          # Vite dev server only
pnpm --filter @goodboy/desktop tauri:dev    # Vite + Tauri shell
pnpm --filter @goodboy/desktop tauri:build  # Production bundle
pnpm --filter @goodboy/desktop typecheck
pnpm --filter @goodboy/desktop test
```

The Rust side (`src-tauri/`) is not yet scaffolded. Run `pnpm tauri init` from this directory once ready.

## Conventions

See [CONVENTIONS.md](./CONVENTIONS.md).
