# Conventions: @goodboy/core

> **Read this when** you're writing code inside `@goodboy/core` and need its boundaries and architecture rules. **Not for** repo-wide process rules (`CONVENTIONS.md`) or TypeScript style (`docs/typescript/`).

Pure TypeScript business logic. **No React. No Tauri APIs. No DOM.** Must run in Node, browsers, and tests without changes.

## Boundaries

Here: provider adapters, routing and balance logic, session orchestration, skill registry, validation and type guards, pure utilities. Not here: React components (`@goodboy/ui`), SQLite queries (`@goodboy/db`), Tauri bindings (`apps/desktop`), any side effect bound to a runtime.

## Architecture rules

- Adapters are stateless. Configuration is injected. Adapters never read environment variables or files; the host provides credentials.
- Errors are typed (`Result<T, E>` pattern), no thrown exceptions for expected failures.
- Routing is a pure function over priority order, usage vs threshold, and task-type mapping.
- Sessions and tasks are immutable data: transitions return new objects, no mutating instance methods.

## Code rules

- Pure functions wherever possible. Side effects pushed to the boundary.
- No singletons. Pass dependencies explicitly.
- No `console.*` in production code paths. Use a logger interface injected by the host.
- No `Date.now()` or `Math.random()` in business logic. Inject clock and RNG.
- Async fallible operations return `Promise<Result<T, E>>`.
- No null returns for "not found". Use discriminated unions or `Option<T>`-style wrappers.

## Testing

Rules in [docs/testing.md](../../docs/testing.md). Package-specific: no mocking of internal modules, mock only at the boundary (provider adapters, fetch); test data via factories, not fixtures.
