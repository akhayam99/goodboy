# @goodboy/desktop

Tauri 2 desktop app for Goodboy. React 19 + Vite + Tailwind v4 + Zustand.

The orchestrator UI: workspaces, providers, tasks, balance. Local-only — no servers, no telemetry.

---

## Environment setup

first install corepack if you don't have it already:

```sh
npm install -g corepack
```

then run:

```sh
pnpm install
```

Install cargo if you don't have it already

```sh
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

> Note: you can proceed with the default installation option

---

## Start Development environment:

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
