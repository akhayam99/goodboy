# Conventions: @goodboy/types

> **Read this when** you're adding or changing types in `@goodboy/types` and need its runtime rule. **Not for** process rules for the whole repo (`CONVENTIONS.md`) or TypeScript style (`docs/typescript/`).

TypeScript types, plus the smallest runtime a union needs. **No logic and no configuration data.**

## Rules

- No function body except a union guard (`isFoo(value): value is Foo`), the `helpers/` entry and `brandId`. A parser, a default object, a threshold or a sentence shown to the user goes to the package that uses it. `__tests__/regressions/types-package-has-no-logic.test.ts` counts the function bodies left, per file, in `types-function-bodies.baseline.json`; the parsers of `workflow-rules.ts`, `run-preset.ts` and `provider-policy.ts` are the debt, and `@goodboy/db` reads them, so they cannot go to `@goodboy/core` (which depends on db) until the owner picks their new home.
- The only runtime allowed is an `as const` literal table (or literal constant) that exists to derive a type, plus the one-line guard for that union (`PROVIDER_IDS`, `WORKFLOW_ORIGINS` + `isWorkflowOrigin`, `CONFIG_BUNDLE_SCHEMA_VERSION`). A table that configures behavior (commands, tiers, env names, defaults, task lists) lives in `@goodboy/core`, even when it is keyed by a union from here.
- The shared guards and the one mint helper live in `src/helpers/`, one file each, exported through the `@goodboy/types/helpers` subpath and never through `src/index.ts`: `isRecord` (a plain object, not an array), `isProviderId` and `isoNow` (the branded `IsoDateTime` of this instant). A file that needs one imports it from there; a private copy fails `duplicate-helper.test.ts`.
- Types export with the `export type` syntax. Consumers use `import type` for them.
- No external runtime dependencies. The only devDependency is `typescript`.
- One public entry point: `src/index.ts` re-exports from the sub-modules. One file per domain. Don't mix unrelated types. The one other entry is the `@goodboy/types/testing` subpath (below).
- Readonly by default: `readonly` arrays and `Readonly<T>` for shapes that never change.
- Prefer an explicit `T | null` over `T | undefined` for fields that can mean "empty".
- Branded IDs (`<Entity>Id`) and discriminated unions follow [docs/typescript/data.md](../../docs/typescript/data.md). Union variants use lowercase strings in the tag field.

## Test data builders

`src/testing/` is the one place with runtime that is not a union table. It holds `aSession`, `anAgent`, `aProject`, `aWorkspace` and `aWorkflowRun`, exported through the `@goodboy/types/testing` subpath and never through `src/index.ts`. Only tests, `storyHarness.ts` and test helpers import it; `__tests__/regressions/test-casts.test.ts` fails when product code does. Each builder returns the full type with defaults in the mock vocabulary (Harborline, ledger-core) and a fresh id per call, so a new required field on a type is a one-line change here. A `Notification` builder is not here: its type lives in `@goodboy/db`, and a builder in this package would depend on it. [docs/testing.md](../../docs/testing.md) explains how tests use it.

## What does NOT belong here

- Validation schemas, refinement functions, and any guard beyond the one-line union check → `@goodboy/core`.
- Configuration tables and defaults → `@goodboy/core` (`packages/core/src/providers/`, `packages/core/src/settings/`).
