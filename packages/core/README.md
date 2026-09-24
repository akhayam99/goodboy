# @goodboy/core

> **Read this when** you need an overview of `@goodboy/core`, and what belongs in it, before you add business logic. **Not for** the detailed rules. See `CONVENTIONS.md`.

The business logic of Goodboy: stream-json parsers for each provider CLI, model catalogs and prices, routing, budget and permission decisions, orchestrator and planner prompts, skills.

It is pure TypeScript, with no React, no Tauri, and no DOM. Agent turns are started in Rust, and core parses their output. `@goodboy/core/node` holds the only helpers tied to Node (git worktrees).

## Conventions

See [CONVENTIONS.md](./CONVENTIONS.md).
