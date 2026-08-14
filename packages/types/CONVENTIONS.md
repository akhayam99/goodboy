# Conventions: @goodboy/types

> **Read this when** you're adding or changing types in `@goodboy/types` and need its zero-runtime rules. **Not for** repo-wide process rules (`CONVENTIONS.md`) or TypeScript style (`docs/typescript/`).

Pure TypeScript types. **Zero runtime code.** This package exists only to be imported via `import type`.

## Rules

- No runtime exports. No functions, no constants, no classes.
- Always export with `export type` syntax (consumers must use `import type`).
- No external runtime dependencies. Only `typescript` as devDependency.
- Single public entry point: `src/index.ts` re-exports from sub-modules. One file per domain; don't mix unrelated types.
- Readonly by default: `readonly` arrays and `Readonly<T>` for immutable shapes.
- Prefer explicit `T | null` over `T | undefined` for fields that semantically can be empty.
- Branded IDs (`<Entity>Id`) and discriminated unions per [docs/typescript/data.md](../../docs/typescript/data.md). Union variants: lowercase strings in the tag field.

## What does NOT belong here

- Validation schemas, type guards, refinement functions → `@goodboy/core`.
- Constants and enums → their owning package.
