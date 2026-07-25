# @goodboy/desktop

Tauri 2 desktop app for Goodboy. React 19 + Vite + Tailwind v4 + Zustand.

The orchestrator UI: workspaces, providers, tasks, balance. Local-only, with no servers and no telemetry.

## Dev

```sh
pnpm --filter @goodboy/desktop dev          # Vite dev server only
pnpm --filter @goodboy/desktop tauri:dev    # Vite + Tauri shell
pnpm --filter @goodboy/desktop tauri:build  # Production bundle
pnpm --filter @goodboy/desktop typecheck
pnpm --filter @goodboy/desktop test
```

## Conventions

See [CONVENTIONS.md](./CONVENTIONS.md).
