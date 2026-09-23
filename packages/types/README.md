# @goodboy/types

> **Read this when** you need the shared types, or the parts of the turn event contract that are easy to get wrong. **Not for** the detailed rules. See `CONVENTIONS.md`.

Shared TypeScript types for the Goodboy monorepo. The only runtime is the literal tables that derive a union and their one-line guards (see `CONVENTIONS.md`). `src/index.ts` is the catalogue. Read it to see every type.

What you cannot tell from the code, and should know before touching the turn event contract:

- Branded IDs (`WorkspaceId`, `SessionId`, ...): cast a `string` with `as` once, at the boundary. After that the brand stops IDs of different kinds from being mixed.
- `TurnEvent` and `ProviderUsage` live here so the `@goodboy/core` parsers and `apps/desktop` can share them without depending on each other.
- `TurnEvent` variants that do more than "render this":
  - `permission_request` puts the run into `TurnState` `blocked` until a decision comes in.
  - `permission_decision` carries the chosen `PermissionScope`. That scope decides whether the UI offers a retry. An `allow` at `session` scope or wider does. `once` does not, because a one-use approval cannot carry into a new run.
  - `step_transition` reports that a workflow run moved forward, with the context it carried along.
  - `unknown_payload` catches provider output we do not model yet. It is kept in the transcript and counted per provider and payload type, never dropped.

## Conventions

See [CONVENTIONS.md](./CONVENTIONS.md).
