# Conventions — @kay-am/core

Pure TypeScript business logic. **No React. No Tauri APIs. No DOM.** Must run in Node, browsers, and tests without modification.

## Scope

- Provider adapters (Claude, Codex, Cursor) and the registry.
- Routing & balance logic (priority, threshold, fallback).
- Session orchestration (lifecycle, task state transitions).
- Skill registry & execution.
- Validation schemas, type guards, refinement functions.
- Planner, summarizer, scheduler, telemetry recording.
- Pure utilities (parsing, formatting, calculations).

## What does NOT belong here

- React components → `@kay-am/ui`.
- SQLite queries → `@kay-am/db`.
- Tauri command bindings → `apps/desktop`.
- Side effects bound to a specific runtime (file system, processes, native APIs).

## Provider adapter pattern

Every adapter implements `ProviderAdapter` from `@kay-am/types`:

```ts
interface ProviderAdapter {
  readonly id: ProviderId;
  readonly capabilities: ProviderCapabilities;
  detect(): Promise<DetectResult>;
  cost(usage: ProviderUsage, model: string): number;
  spawn(request: TurnRequest): AsyncIterable<TurnEvent>;
}
```

Adapters share their child-process bookkeeping via `providers/shared/spawn-stream.ts`:

- `detectBinary(binary, spawnFn)` — `--version` probe → `DetectResult`.
- `spawnLineStream(binary, args, spawnFn, { parseLine, parseCtx, onClose? })` — spawn + line-by-line parse + leak-free cleanup.

A new adapter implements its CLI flags + line parser; it does not re-implement the spawn loop. Re-implementing it is a review-fail.

## Pure-function discipline

- No singletons. Pass dependencies explicitly via a `Deps` object on the public function or constructor.
- No `Date.now()` / `Math.random()` / `crypto.randomUUID()` in business logic — inject a clock (`now: () => IsoDateTime`) and an RNG / id generator.
- No `console.*` for production code paths. Inject a logger interface.
- No reading from environment, files, or processes inside the package. The host provides credentials and IO.
- Pure functions return `Promise<Result<T, E>>` for fallible async operations _or_ throw typed exception classes. The codebase currently uses typed exceptions throughout (`PlannerParseError`, `WorktreeError`, `GhCliError`, etc.); when picking a new fallible API, follow the existing exception pattern unless there's a reason to prefer `Result`.
- No null returns for "not found" — use discriminated unions or `T | null` with the absence path obvious to the caller.

## Public API surface

`src/index.ts` re-exports the browser-safe public surface. Node-only modules (anything importing `node:child_process`, `node:fs`, etc.) are excluded from the barrel and must be imported from their full path — `packages/core/src/providers/registry`, `packages/core/src/summarizer/cli`, etc.

Any export in `src/index.ts` that has zero consumers outside the package is dead surface and must be removed.

## Folder structure

```
src/
├── index.ts                # browser-safe public barrel
├── budget/
├── context/
├── first-turn-classifier.ts
├── github/
├── permissions/
├── planner/
├── providers/
│   ├── capabilities.ts
│   ├── preferences.ts          # DEFAULT_SESSION_PROVIDER_PREFERENCE (runtime)
│   ├── registry.ts             # node-only, not in barrel
│   ├── turn-weight.ts
│   ├── claude/ codex/ cursor/  # adapters
│   └── shared/                 # spawn-stream + anthropic-envelope-parser
├── roles.ts
├── scheduler/
├── settings/
├── skills/
├── summarizer/
├── telemetry/
├── turn/
├── workflows/
└── worktree/
```

## Testing

See [ADR-0005](../../docs/adr/0005-test-layout.md).

- Vitest. Colocated `<module>.test.ts` next to source.
- Tests use factories from `<module>.test.ts` itself; no shared `__fixtures__/`.
- Mock only at the boundary (provider adapters via `spawnFn`, `gh` via `GhRunner`, etc.).
- Integration tests that actually shell out are env-gated (`process.env.RUN_INTEGRATION === '1'`).

## Code rules

- No `any`. `unknown` + type guards.
- No default exports. Named only.
- Discriminated unions for state machines and `kind`-tagged events.
- `satisfies` over `as` for const validation.
- No comments unless explaining **why**.
