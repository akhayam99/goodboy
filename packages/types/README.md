# @goodboy/types

> **Read this when** you need the shared types, or the parts of the provider-adapter contract that are easy to get wrong. **Not for** the detailed rules. See `CONVENTIONS.md`.

Shared TypeScript types for the Goodboy monorepo. Zero runtime code, types only. `src/index.ts` is the catalogue. Read it to see every type.

What you cannot tell from the code, and should know before touching the adapter contract:

- Branded IDs (`WorkspaceId`, `SessionId`, ...): cast a `string` with `as` once, at the boundary. After that the brand stops IDs of different kinds from being mixed.
- The provider adapter contract lives here so `@goodboy/core` and `apps/desktop` can depend on it without depending on each other.
- `TurnEvent` variants that do more than "render this":
  - `permission_request` puts the run into `TurnState` `blocked` until a decision comes in.
  - `permission_decision` carries the chosen `PermissionScope`. That scope decides whether the UI offers a retry. An `allow` at `session` scope or wider does. `once` does not, because a one-use approval cannot carry into a new run.
  - `step_transition` reports that a workflow run moved forward, with the context it carried along.
  - `unknown_payload` catches provider output we do not model yet. It is kept in the transcript and counted per adapter and payload type, never dropped.

## Conventions

See [CONVENTIONS.md](./CONVENTIONS.md).
