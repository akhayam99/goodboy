# Conventions — @goodboy/types

Pure TypeScript types. **Zero runtime code.** This package exists only to be imported via `import type`.

## Rules

- No runtime exports. No functions, no constants, no classes. Types and interfaces only.
- No `any`. Ever.
- Always export with `export type` syntax (consumers must use `import type`).
- No external runtime dependencies. Only `typescript` as devDependency.
- Single public entry point: `src/index.ts` re-exports from sub-modules.

## Folder structure

```
src/
├── index.ts          # public API (re-exports only)
├── workspace.ts      # workspace, task, turn-state, context-slot
├── workflow.ts       # workflow, step, session, parallel-group
├── provider.ts       # provider, adapter, balance types
└── ids.ts            # branded ID types
```

One file per domain. Don't mix unrelated types.

## Type patterns

- **Branded IDs**: every entity ID uses a branded type to prevent mixing.
  ```ts
  export type WorkspaceId = string & { readonly __brand: 'WorkspaceId' };
  export type TaskId = string & { readonly __brand: 'TaskId' };
  ```
- **Discriminated unions** for state machines.
  ```ts
  export type TaskStatus =
    | { kind: 'todo' }
    | { kind: 'in_progress'; startedAt: Date }
    | { kind: 'done'; finishedAt: Date }
    | { kind: 'blocked'; reason: string };
  ```
- **Readonly by default**: use `readonly` arrays and `Readonly<T>` for immutable shapes.
- **No optional chaining as defaults**: prefer explicit `T | null` over `T | undefined` for fields that semantically can be empty.

## Naming

- Types/interfaces: PascalCase. No `I` prefix, no `Type` suffix.
- Branded ID types: `<Entity>Id`.
- Discriminated union variants: lowercase strings in `kind` field.

## What does NOT belong here

- Validation schemas (zod, valibot) — those go in `@goodboy/core`.
- Constants and enums — those go in their owning package.
- Type guards / refinement functions — those go in `@goodboy/core`.
