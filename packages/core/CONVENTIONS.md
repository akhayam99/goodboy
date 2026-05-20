# Conventions — @goodboy/core

Pure TypeScript business logic. **No React. No Tauri APIs. No DOM.** This package must be runnable in Node, browsers, and tests without changes.

## Scope

- Provider adapters (Anthropic, OpenAI, Cursor, etc.).
- Routing & balance logic (priority, threshold, fallback).
- Session orchestration (macro session lifecycle, task state transitions).
- Skill registry & execution.
- Validation schemas, type guards, refinement functions.
- Pure utilities (parsing, formatting, calculations).

## What does NOT belong here

- React components → `@goodboy/ui`.
- SQLite queries → `@goodboy/db`.
- Tauri command bindings → `apps/desktop`.
- Side effects bound to a runtime (file system, processes, native APIs).

## Architecture

### Provider adapter pattern

Every AI provider implements a common interface:

```ts
export interface ProviderAdapter {
  readonly id: ProviderId;
  readonly name: string;
  readonly capabilities: ProviderCapabilities;
  send(request: ProviderRequest): Promise<ProviderResponse>;
  estimateCost(request: ProviderRequest): number;
  getUsage(): Promise<ProviderUsage>;
}
```

- Adapters are stateless. Configuration is injected.
- Adapters never read environment variables or files. The host provides credentials.
- Errors are typed (`Result<T, ProviderError>` pattern) — no thrown exceptions for expected failures.

### Routing

The `Router` selects the active provider based on:

1. User-defined priority order.
2. Current usage vs. configured threshold.
3. Task-type to model mapping.

Pure function: `route(request, providers, config) → ProviderId`.

### Sessions

Macro sessions and tasks are immutable data structures with state transition functions. No instance methods that mutate. All transitions return new objects.

## Code rules

- Pure functions wherever possible. Side effects pushed to the boundary.
- No singletons. Pass dependencies explicitly.
- No `console.*` for production code paths. Use a logger interface injected by the host.
- No `Date.now()` or `Math.random()` in business logic — inject clock and RNG.
- Async functions return `Promise<Result<T, E>>` for fallible operations.
- No null returns for "not found" — use discriminated unions or `Option<T>`-style wrappers.

## Testing

- Vitest. Every public function has tests.
- No mocking of internal modules. Mock only at the boundary (provider adapters, fetch).
- Test data via factories, not fixtures.
- Naming: `<module>.test.ts` colocated with source.

## Folder structure

```
src/
├── index.ts              # public API (re-exports only)
├── providers/
│   ├── adapter.ts        # ProviderAdapter interface
│   ├── anthropic.ts
│   ├── openai.ts
│   └── registry.ts
├── routing/
│   ├── router.ts
│   └── balance.ts
├── sessions/
│   ├── workspace.ts
│   └── task.ts
├── skills/
│   └── registry.ts
└── shared/
    ├── result.ts         # Result<T, E> helpers
    └── id.ts             # ID generation
```
