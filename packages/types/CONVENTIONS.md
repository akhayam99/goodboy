# Conventions — @kay-am/types

Pure TypeScript types. **Zero runtime code.** This package exists only to be imported via `import type`.

See [ADR-0004](../../docs/adr/0004-package-dependency-direction.md).

## Rules

- **No runtime exports.** No `export const`, no `export function`, no enum, no class. Types and interfaces only.
- No `any`. Ever.
- Always export with `export type` syntax so consumers must use `import type` and pay zero runtime cost.
- No external runtime dependencies. Only `typescript` as a devDependency.
- Single public entry point: `src/index.ts` re-exports from sub-modules.

## Folder structure

```
src/
├── index.ts                    # public API (re-exports only)
├── ids.ts                      # every branded ID type
├── adapter.ts                  # provider adapter contract
├── budget.ts
├── config-bundle.ts
├── diff-comment.ts
├── github.ts
├── message.ts
├── notification.ts
├── permission.ts
├── plan.ts
├── provider-preference.ts
├── provider-registry.ts
├── provider.ts
├── settings.ts
├── skill.ts
├── telemetry-period.ts
├── telemetry.ts
├── workflow.ts
├── workspace.ts
├── workspace-init-script.ts
└── worktree.ts
```

One file per domain. Don't mix unrelated types.

## Type patterns

- **Branded IDs** all live in `ids.ts`:

  ```ts
  export type WorkspaceId = string & { readonly __brand: 'WorkspaceId' };
  ```

  Domain files `import type { WorkspaceId } from './ids'`. Never declare a new brand outside `ids.ts`.

- **Discriminated unions** for state machines:

  ```ts
  export type TaskStatus =
    | { kind: 'todo' }
    | { kind: 'in_progress'; startedAt: IsoDateTime }
    | { kind: 'done'; finishedAt: IsoDateTime };
  ```

- **Readonly by default.** Use `readonly` arrays and `Readonly<T>` for immutable shapes.
- **`T | null` over `T | undefined`** for fields that semantically can be empty.

## What does NOT belong here

- Validation schemas (zod, valibot) → `@kay-am/core`.
- Runtime constants and default values → `@kay-am/core` (e.g. `DEFAULT_SESSION_PROVIDER_PREFERENCE`).
- Type guards / refinement functions → `@kay-am/core`.
- Schema versions whose value the Rust side owns → use a literal type (`ConfigBundleSchemaVersion = 1`), not `typeof CONST`.
