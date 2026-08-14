# @goodboy/types

> **Read this when** you need the shared type surface or the provider-adapter contract's non-obvious semantics. **Not for** the specific rules. See `CONVENTIONS.md`.

Shared TypeScript types for the Goodboy monorepo. Zero runtime code: types only. `src/index.ts` is the catalogue; read it for the full surface.

Non-derivable semantics worth knowing before touching the adapter contract:

- Branded IDs (`WorkspaceId`, `SessionId`, ...): cast `string` via `as` once at the boundary; the brand prevents mixing elsewhere.
- The provider adapter contract lives here so `@goodboy/core` and `apps/desktop` can depend on it without depending on each other.
- `TurnEvent` arms with behavior beyond "render this":
  - `permission_request` puts the run into `TurnState` `blocked` until a decision lands.
  - `permission_decision` carries the chosen `PermissionScope`. That scope decides whether the UI offers a retry: an `allow` at `session` scope or wider does, `once` does not, because a one-use approval cannot carry into a new run.
  - `step_transition` reports a workflow run advancing, with the context it carried forward.
  - `unknown_payload` is the escape hatch for provider output we do not model yet. Kept in the transcript and counted per adapter and payload type, never dropped.

## Conventions

See [CONVENTIONS.md](./CONVENTIONS.md).
