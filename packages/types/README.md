# @goodboy/types

Shared TypeScript types for the Goodboy monorepo. Zero runtime code: types only.

## Usage

```ts
import type { WorkspaceId, Session, ProviderAdapter } from '@goodboy/types';
```

## Public surface

### Branded IDs

`WorkspaceId`, `SessionId`, `MessageId`, `ProviderRunId`, `TelemetryRecordId`, `IsoDateTime`. Pass `string` through `as` once at the boundary; everywhere else the brand prevents accidental mixing.

### Domain entities

- `Workspace`: registered repo on disk.
- `Session` carries `state: TurnState`, a discriminated union of `draft`, `starting`, `idle`, `running`, `blocked`, `error`, `ended`. `blocked` is what a `permission_request` event puts the run into.
- `ContextSlot`: fixed key/value used by the synthetic context engine.
- `Message` + `MessageRole`: chat turn record.
- `ProviderRun` + `ProviderRunStatus`: one execution of a provider CLI inside a session.
- `TelemetryRecord`: per-run token + cost snapshot.

### Provider adapter contract

The shape every provider implementation must satisfy. Lives in this package so `@goodboy/core` and `apps/desktop` can depend on it without depending on each other.

- `ProviderAdapter`: `id`, `capabilities`, `detect()`, `spawn(request)`, `cost(usage, model)`.
- `TurnRequest`: input handed to `spawn`.
- `TurnEvent` is the discriminated union the adapter yields. `adapter.ts` is the list; the arms that carry behavior beyond "render this":
  - `permission_request` blocks the run (see `TurnState` above) until a decision lands.
  - `permission_decision` carries the chosen `PermissionScope`. That scope is what decides whether the UI offers a retry: an `allow` at `session` scope or wider does, `once` does not, because a one-use approval cannot carry into a new run.
  - `step_transition` reports a workflow run advancing, with the context it carried forward.
  - `unknown_payload` is the escape hatch for provider output we do not model yet. It is kept in the transcript and counted per adapter and payload type, never dropped.
- `ProviderCapabilities`, `ProviderUsage`, `DetectResult`: supporting shapes.

## Conventions

See [CONVENTIONS.md](./CONVENTIONS.md).
