# Conventions: @goodboy/core

> **Read this when** you're writing code inside `@goodboy/core` and need to know what belongs here and how it is built. **Not for** process rules for the whole repo (`CONVENTIONS.md`) or TypeScript style (`docs/typescript/`).

Pure TypeScript business logic. **No React. No Tauri APIs. No DOM.** It must run in Node, in browsers, and in tests without changes.

## Boundaries

What goes here: provider adapters, routing and balance logic, session orchestration, the skill registry, validation and type guards, pure utilities. What does not: React components (`@goodboy/ui`), SQLite queries (`@goodboy/db`), Tauri bindings (`apps/desktop`), and any side effect tied to one runtime.

## Architecture rules

- Adapters keep no state. Their configuration is passed in. Adapters never read environment variables or files. The host provides credentials.
- Errors are typed (the `Result<T, E>` pattern). Expected failures never throw exceptions.
- Routing is a pure function of three inputs: priority order, usage against the threshold, and the task-type mapping.
- Sessions and tasks are immutable data. A transition returns a new object. No instance methods that mutate.

## Code rules

- Pure functions wherever possible. Side effects move out to the boundary.
- No singletons. Pass dependencies explicitly.
- No `console.*` in production code paths. Use a logger interface that the host passes in.
- No `Date.now()` or `Math.random()` in business logic. Pass in a clock and an RNG.
- Async operations that can fail return `Promise<Result<T, E>>`.
- Never return null for "not found". Use discriminated unions or `Option<T>`-style wrappers.

## Testing

Rules live in [docs/testing.md](../../docs/testing.md). For this package: never mock internal modules. Mock only at the boundary (provider adapters, fetch). Build test data with factories, not fixtures.
