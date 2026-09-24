# Conventions: @goodboy/types

> **Read this when** you're adding or changing types in `@goodboy/types` and need its runtime rule. **Not for** process rules for the whole repo (`CONVENTIONS.md`) or TypeScript style (`docs/typescript/`).

TypeScript types, plus the smallest runtime a union needs. **No logic and no configuration data.**

## Rules

- The only runtime allowed is an `as const` literal table (or literal constant) that exists to derive a type, plus the one-line guard for that union (`PROVIDER_IDS`, `WORKFLOW_ORIGINS` + `isWorkflowOrigin`, `CONFIG_BUNDLE_SCHEMA_VERSION`). A table that configures behavior (commands, tiers, env names, defaults, task lists) lives in `@goodboy/core`, even when it is keyed by a union from here.
- Types export with the `export type` syntax. Consumers use `import type` for them.
- No external runtime dependencies. The only devDependency is `typescript`.
- One public entry point: `src/index.ts` re-exports from the sub-modules. One file per domain. Don't mix unrelated types.
- Readonly by default: `readonly` arrays and `Readonly<T>` for shapes that never change.
- Prefer an explicit `T | null` over `T | undefined` for fields that can mean "empty".
- Branded IDs (`<Entity>Id`) and discriminated unions follow [docs/typescript/data.md](../../docs/typescript/data.md). Union variants use lowercase strings in the tag field.

## What does NOT belong here

- Validation schemas, refinement functions, and any guard beyond the one-line union check → `@goodboy/core`.
- Configuration tables and defaults → `@goodboy/core` (`packages/core/src/providers/`, `packages/core/src/settings/`).
