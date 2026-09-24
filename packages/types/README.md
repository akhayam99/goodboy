# @goodboy/types

> **Read this when** you need the shared types. **Not for** the detailed rules (see `CONVENTIONS.md`) or what a turn event means (see `docs/turns.md`).

Shared TypeScript types for the Goodboy monorepo. The only runtime is the literal tables that derive a union and their one-line guards (see `CONVENTIONS.md`). `src/index.ts` is the catalogue. Read it to see every type.

Branded IDs (`WorkspaceId`, `SessionId`, ...): cast a `string` with `as` once, at the boundary. After that the brand stops IDs of different kinds from being mixed.

The turn event contract (`TurnEvent`, `ProviderUsage`) lives here so the `@goodboy/core` parsers and `apps/desktop` can share it without depending on each other. What each variant means is described in [docs/turns.md](../../docs/turns.md#turn-events).

## Conventions

See [CONVENTIONS.md](./CONVENTIONS.md).
