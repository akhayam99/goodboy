# @goodboy/types

Shared TypeScript types for the Goodboy monorepo. Zero runtime code — types only.

## Usage

```ts
import type { WorkspaceId, Session, ProviderAdapter } from '@goodboy/types';
```

## Public surface

### Branded IDs

`WorkspaceId`, `SessionId`, `MessageId`, `ProviderRunId`, `TelemetryRecordId`, `IsoDateTime`. Pass `string` through `as` once at the boundary; everywhere else the brand prevents accidental mixing.

### Domain entities

- `Workspace` — registered repo on disk.
- `Session` + `SessionState` — goal-scoped conversation. State is a discriminated union (`draft` / `starting` / `idle` / `running` / `error` / `ended`).
- `ContextSlot` — fixed key/value used by the synthetic context engine.
- `Message` + `MessageRole` — chat turn record.
- `ProviderRun` + `ProviderRunStatus` — one execution of a provider CLI inside a session.
- `TelemetryRecord` — per-run token + cost snapshot.

### Provider adapter contract

The shape every provider implementation must satisfy. Lives in this package so `@goodboy/core` and `apps/desktop` can depend on it without depending on each other.

- `ProviderAdapter` — `id`, `capabilities`, `detect()`, `spawn(request)`, `cost(usage, model)`.
- `TurnRequest` — input handed to `spawn`.
- `TurnEvent` — discriminated union the adapter yields:
  - `assistant_text` — incremental text delta
  - `tool_call_start` / `tool_call_end` — tool invocation lifecycle
  - `file_edit` — file mutation observed in the worktree
  - `usage` — token + cost snapshot
  - `error` — recoverable provider error
  - `done` — terminal event
- `ProviderCapabilities`, `ProviderUsage`, `DetectResult` — supporting shapes.

## Conventions

See [CONVENTIONS.md](./CONVENTIONS.md).
