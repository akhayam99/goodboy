# @goodboy/core

> **Read this when** you need an overview of `@goodboy/core`, and what belongs in it, before you add business logic. **Not for** the detailed rules. See `CONVENTIONS.md`.

The business logic of Goodboy: stream-json parsers for each provider CLI, model catalogs and prices, routing, budget and permission decisions, orchestrator and planner prompts.

It is pure TypeScript, with no React, no Tauri, and no DOM. Agent turns are started in Rust, and core parses their output.

## Public API

One subpath per domain, for example `@goodboy/core/providers` or `@goodboy/core/auto`. The list is the `exports` field of `package.json`. There is no root entry.

## Conventions

See [CONVENTIONS.md](./CONVENTIONS.md).
