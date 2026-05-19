# ADR-0006: DB schema hygiene

**Status**: Accepted
**Date**: 2026-05-19
**Deciders**: Amin

---

## Context

`packages/db` has 34 migrations and 27 query files. The schema works, but the audit caught five recurring hygiene gaps that, left unchecked, will compound:

1. **`status` columns without `CHECK` constraints.** `sessions.status`, `sessions.user_status`, `agents.permission_mode`, `session_phase_runs.status` accept any string at the DB level; only the TS layer constrains the values. A direct SQL write or a bad migration could insert garbage.
2. **Inconsistent timestamps.** Most tables use `created_at` / `updated_at` as `INTEGER` ms-since-epoch. Three tables drift: `phase_templates` (m007) uses `TEXT` ISO, `notifications` (m026) has only `ts TEXT` and no `updated_at`, `github_pr_cache` (m018) uses `fetched_at TEXT` and has neither `created_at` nor `updated_at`.
3. **Bare `CREATE TABLE` / `CREATE INDEX`.** A handful of migrations (m016, m017, m018, m020, m033) drop the `IF NOT EXISTS` clause, so a re-run after a partial failure would throw. The runner gates re-runs via `schema_version`, so this is latent rather than active, but the pattern should be uniform.
4. **Domain types defined in `queries/`** rather than in `@kay-am/types`. ([ADR-0004](./0004-package-dependency-direction.md) addresses this; this ADR enforces it at the query layer.)
5. **Raw `*Row` types leaking out** of query functions. `AuditRetryRow` (snake_case fields, raw SQLite shape) is `export interface` and `drainOldest` returns it directly.

## Decision

### 1. Every enum column gets a CHECK constraint

A column whose value set is bounded by the TS type system **must** also be bounded by SQLite. The CHECK list mirrors the discriminated-union arm names.

```sql
status TEXT NOT NULL CHECK (status IN ('todo', 'in_progress', 'done', 'cancelled')),
```

This is a forward rule. Retrofitting existing tables requires a table rebuild (SQLite lacks `ALTER TABLE … ADD CONSTRAINT CHECK`). A dedicated migration `m035-enum-checks` may land later; existing data is already constrained de facto via the TS query layer, so the work is queued, not urgent.

### 2. Every table has `created_at` and `updated_at`, both `INTEGER` (ms epoch)

No exceptions for "append-only" tables (the column carries cheap information that becomes useful as soon as anyone asks "when was the last write?"). No `TEXT` ISO timestamps in DB columns — store the integer, convert at the query/mapper boundary.

For tables that already shipped with the wrong shape (`notifications`, `github_pr_cache`, `phase_templates`), the fix is queued for a future migration. New tables must conform.

### 3. Migrations are idempotent

`CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, conditional column adds. The runner gates re-runs by `schema_version`, but the migrations themselves must remain re-runnable in isolation (for repair, test seeding, and worst-case data recovery).

Migration files are append-only. Once shipped, a migration is never edited. A bug fix lands as a new migration that compensates.

### 4. Row → domain mapping at the query boundary

Every public query function returns the domain type (`Notification`, `Workspace`, ...) from `@kay-am/types`. The raw row interface (`NotificationRow`, snake_case) stays private to the query file.

`AuditRetryRow` and any other raw-row leak must be wrapped in a domain type before crossing the function boundary.

### 5. Foreign keys are explicit and indexed

Every FK column declares its `ON DELETE` behaviour (`CASCADE` or `RESTRICT` — never default). Every FK column has an index. Every column that appears in a `WHERE` or `ORDER BY` clause in any query has an index, with the obvious "small table = cost of index outweighs benefit" exception (settings, schema_version).

### 6. No `BOOLEAN`

SQLite has no native boolean. Use `INTEGER NOT NULL DEFAULT 0` with a clear naming convention (`is_active`, `has_completed`, `read`). The mapper converts to `boolean` at the query boundary.

## Consequences

**Positive**

- Direct sqlite shell writes (and migration bugs) get caught at the DB layer, not in random places downstream.
- Time math has a single shape across the codebase: integer in DB, `Date` / ISO string at the boundary, branded `IsoDateTime` for transit.
- Query functions can be read at-a-glance without checking whether they leak a row shape.

**Negative / trade-offs**

- Retrofitting `notifications`, `github_pr_cache`, and `phase_templates` is a table-rebuild migration with non-trivial test surface. Tracked as a follow-up.
- CHECK constraints add a tiny insert-time cost. Worth it.

## Follow-ups (tracked, not blocking)

1. Migration `m035-enum-checks` — rebuild `agents` / `sessions` with CHECK constraints on `status`, `permission_mode`, `user_status`.
2. Migration `m036-uniform-timestamps` — rebuild `notifications`, `github_pr_cache`, `phase_templates` with `INTEGER` `created_at`/`updated_at`.
3. Add per-query smoke tests for the 20 query files currently untested.
4. Wrap `AuditRetryRow` in a public `AuditRetry` domain type owned by `@kay-am/types`.
