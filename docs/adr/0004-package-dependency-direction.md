# ADR-0004: Package dependency direction

**Status**: Accepted
**Date**: 2026-05-19
**Deciders**: Amin

---

## Context

The monorepo has four library packages and one app:

```
apps/desktop ────────────────┐
                             ▼
                    @kay-am/core ──┐
                                   ▼
                          @kay-am/db ──┐
                                       ▼
                              @kay-am/types

@kay-am/ui  (no deps on the others; sibling to types)
```

Imports should only ever flow downward (`apps → core → db → types`). The audit caught a handful of drifts:

- `@kay-am/types` had two runtime exports (`DEFAULT_SESSION_PROVIDER_PREFERENCE`, `CONFIG_BUNDLE_SCHEMA_VERSION`), violating its types-only charter.
- `@kay-am/db` queries defined first-class domain types (`Notification`, `WorkspaceInitScript`, `SessionWorktree`) that callers had to deep-import from db internals.
- Brand types (`PlanId`, `PlanConsumptionId`) lived in `plan.ts` instead of `ids.ts`, breaking the "all brands in one file" pattern.

## Decision

### 1. Direction is one-way

`@kay-am/types` imports nothing except other files inside itself.
`@kay-am/db` imports from `@kay-am/types` only.
`@kay-am/core` imports from `@kay-am/types` only (it has no need for `@kay-am/db`; storage stays in the app shell).
`@kay-am/ui` imports nothing from the others.
`apps/desktop` imports from all four packages.

Test fixtures that need a downstream value must inline a literal rather than reach upward.

### 2. `@kay-am/types` is runtime-free

No `export const`, no `export function`, no enum. Every export uses `export type`. The Rust side mirrors the runtime values it cares about; the TS side describes their shapes.

Where a type previously relied on `typeof CONST`, use a literal type instead (`ConfigBundleSchemaVersion = 1`).

### 3. Domain types live in `@kay-am/types`

If two packages need to refer to a value of type `Notification`, that type goes in `@kay-am/types/src/notification.ts`. The db query module imports it back and uses it as the public domain shape; it does NOT define its own and re-export.

The db queries can still own their `*Row` interfaces (the raw SQLite snake_case shape). They must map those to the domain type at the query boundary; rows do not escape.

### 4. Branded IDs live in `@kay-am/types/src/ids.ts`

Every `<Entity>Id` brand declaration lives in `ids.ts`. Domain types in other files `import type` from there. No domain file declares its own brand.

### 5. The package barrel is the public API

`src/index.ts` re-exports every public symbol. Outside the package, consumers import from the package name (`@kay-am/core`), never from a deep path (`@kay-am/core/src/...`).

Inside the package, direct imports between files are preferred — barrels inside subfolders are forbidden ([ADR-0001](./0001-feature-first-code-placement.md)).

### 6. Dead exports are not free

A barrel re-export is a contract. An export with zero external consumers is dead surface that misleads readers and stops grep from telling them where the symbol is used. Anything in `src/index.ts` that no other package imports must be either removed or moved to package-internal scope.

## Consequences

**Positive**

- `@kay-am/types` regains its "drop-in, ship-only-types" property: a consumer that wants the type surface pays zero runtime cost.
- A reader looking for the shape of `Notification` finds it at the obvious path (`@kay-am/types/src/notification.ts`), not buried in a query file.
- The dep graph is acyclic and trivially auditable by grep.

**Negative / trade-offs**

- Db query files now contain a `export type { Notification } from '@kay-am/types'` re-export to keep legacy `import { Notification } from '@kay-am/db'` working during the transition. These re-exports are scheduled for removal once consumers are updated.
- Test files in `@kay-am/db` must inline fixture values rather than import them from `@kay-am/core`. Accepted; test data is intentionally local.

## Enforcement

- `pnpm install --frozen-lockfile` + workspace declarations make accidental cross-package imports fail at install time when the package isn't listed as a dependency.
- A CI lint (knip + a custom dep-direction check) would close the loop; tracked as a follow-up.
