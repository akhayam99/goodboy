# @kay-am/desktop

Tauri 2 desktop app for kAY.am. React 19 + Vite + Tailwind v4 + Zustand.

The orchestrator UI: workspaces, providers, tasks, balance. Local-only — no servers, no telemetry.

## Dev

```sh
pnpm --filter @kay-am/desktop dev          # Vite dev server only
pnpm --filter @kay-am/desktop tauri:dev    # Vite + Tauri shell
pnpm --filter @kay-am/desktop tauri:build  # Production bundle
pnpm --filter @kay-am/desktop typecheck
pnpm --filter @kay-am/desktop test
```

The Rust side (`src-tauri/`) is not yet scaffolded. Run `pnpm tauri init` from this directory once ready.

## Conventions

See [CONVENTIONS.md](./CONVENTIONS.md).
