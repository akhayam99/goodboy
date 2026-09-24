# Conventions: @goodboy/core

> **Read this when** you're writing code inside `@goodboy/core` and need to know what belongs here and how it is built. **Not for** process rules for the whole repo (`CONVENTIONS.md`) or TypeScript style (`docs/typescript/`).

Pure TypeScript logic that the desktop webview imports directly. **No React. No Tauri APIs. No DOM.** The main entry (`src/index.ts`) must run in the webview, in Node, and in tests without changes. Only `@goodboy/core/node` (`src/node.ts`, the git worktree helpers) may import `node:` modules.

## Boundaries

What goes here: stream-json parsers for each provider CLI, model catalogs, prices and routing, budget and permission decisions, building and parsing orchestrator and planner prompts, type guards, pure utilities. What does not: starting agent CLIs (turns run in Rust, in `apps/desktop/src-tauri/src/turn.rs`, and core only parses their output), React components (`@goodboy/ui`), SQLite queries (`@goodboy/db`), Tauri bindings (`apps/desktop`), and any side effect tied to one runtime.

## Architecture rules

- Parsers are pure per line. They take a line and a `ParseContext` and return `TurnEvent`s. Putting split lines back together is the job of `createJsonLineAssembler`, not of the parser.
- Anything that runs a process gets it passed in (`GhRunner` for `gh`), so tests can pass a fake.
- Routing is a pure function of three inputs: priority order, usage against the threshold, and the task-type mapping.
- Sessions and tasks are immutable data. A transition returns a new object. No instance methods that mutate.

## Code rules

- Pure functions wherever possible. Side effects move out to the boundary.
- No singletons that keep state longer than one call. The only exception is a memo cache keyed by immutable input (compiled permission matchers).
- No `console.*` in production code paths. Use `devWarn` from `src/dev-log.ts`.
- No `Date.now()` or `Math.random()` in business logic. Pass in a clock and an RNG.
- An expected failure at a boundary throws a typed error class (`GhCliError`, `GhJsonParseError`, `OrchestratorProviderError`). Callers match it with `instanceof`.
- `null` means "not found" or "unknown" (`getProviderModelPrice`, `getModelDescriptor`). Never return `0` or an empty string for an unknown value.

## Testing

Rules live in [docs/testing.md](../../docs/testing.md). For this package: never mock internal modules. Mock only at the boundary (`GhRunner`, fetch, the clock). Build test data with factories, not fixtures.
