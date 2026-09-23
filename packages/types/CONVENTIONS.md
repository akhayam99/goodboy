# Conventions: @goodboy/types

> **Read this when** you're adding or changing types in `@goodboy/types` and need its zero-runtime rules. **Not for** process rules for the whole repo (`CONVENTIONS.md`) or TypeScript style (`docs/typescript/`).

Pure TypeScript types. **Zero runtime code.** This package exists only to be imported with `import type`.

## Rules

- No runtime exports. No functions, no constants, no classes.
- Always export with the `export type` syntax (consumers must use `import type`).
- No external runtime dependencies. The only devDependency is `typescript`.
- One public entry point: `src/index.ts` re-exports from the sub-modules. One file per domain. Don't mix unrelated types.
- Readonly by default: `readonly` arrays and `Readonly<T>` for shapes that never change.
- Prefer an explicit `T | null` over `T | undefined` for fields that can mean "empty".
- Branded IDs (`<Entity>Id`) and discriminated unions follow [docs/typescript/data.md](../../docs/typescript/data.md). Union variants use lowercase strings in the tag field.

## What does NOT belong here

- Validation schemas, type guards, refinement functions → `@goodboy/core`.
- Constants and enums → the package that owns them.
