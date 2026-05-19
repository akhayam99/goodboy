# Conventions — Root

Foundational rules for the kAY.am monorepo. Each workspace has its own `CONVENTIONS.md` for stack-specific rules. Architectural decisions live in [`docs/adr/`](./docs/adr/).

This document codifies what the codebase **actually does** as of May 2026. If you find a violation, treat it as a bug — either fix the code or amend this doc (with reason).

## Monorepo structure

```
kay-am/
├── apps/
│   └── desktop/        # Tauri 2 desktop app (React 19 + Vite + Tailwind v4 + Zustand)
├── packages/
│   ├── ui/             # Presentational React components (no business logic, no Tauri)
│   ├── core/           # Pure TS business logic (providers, scheduler, summarizer)
│   ├── db/             # SQLite schema, migrations, typed queries
│   └── types/          # Pure type-only definitions (zero runtime code)
├── docs/
│   └── adr/            # Architectural decision records (numbered, append-only)
├── scripts/
├── .github/workflows/
└── .claude/
```

`apps/*` consume packages. `packages/*` are reusable libraries — no app code. Internal deps via `workspace:*`.

## Package dependency direction (one-way)

See [ADR-0004](./docs/adr/0004-package-dependency-direction.md).

```
apps/desktop ──▶ @kay-am/core ──▶ @kay-am/db ──▶ @kay-am/types
                                                 ▲
                                         @kay-am/ui (sibling, no deps on others)
```

- `@kay-am/types` is **runtime-free**: no `export const`, no `export function`, no enum. Pure `export type`.
- `@kay-am/db` depends only on `@kay-am/types`.
- `@kay-am/core` depends only on `@kay-am/types`.
- `@kay-am/ui` depends on nothing from this monorepo.
- `apps/desktop` consumes all four.

Test fixtures must inline rather than import upward.

## pnpm

- Workspace: `apps/*`, `packages/*`.
- `pnpm install --frozen-lockfile` in CI. Never auto-update the lockfile.
- Every import must be declared in the consuming `package.json`. No phantom deps.
- `pnpm --filter <pkg>` for scoped scripts.

## TypeScript

- `composite: true`, `declaration: true`, `declarationMap: true` everywhere.
- Build with `tsc -b` (incremental, cached). Never plain `tsc` in CI.
- `strict: true`, `noUncheckedIndexedAccess: true`, `verbatimModuleSyntax: true`.
- `import type` for type-only imports.
- Path aliases: per-package only. Cross-package imports use package names.
- No `any`. Use `unknown` + a type guard.
- No default exports. Named only.
- Discriminated unions for state machines. `never` exhaustiveness in switch defaults.
- Branded types for IDs — all defined in `@kay-am/types/src/ids.ts`.
- `satisfies` over `as` for const validation.

## Turborepo

- Tasks: `build`, `dev`, `lint`, `typecheck`, `test`. `dependsOn: ["^build"]` for tasks that need built deps.
- `outputs` matches real artifacts (`dist/**`, `.turbo/**`).
- CI: `turbo run <task> --affected`.

## Git workflow

### Branches

- `main` protected. PR required.
- Naming: `feat/<short>`, `fix/<short>`, `chore/<short>`, `docs/<short>`, `refactor/<short>`.
- One concern per branch.

### Conventional commits

Format: `type(scope): subject`.

- **types**: `feat`, `fix`, `refactor`, `docs`, `chore`, `test`, `ci`, `style`, `perf`.
- **scopes**: `desktop`, `ui`, `core`, `db`, `types`, `repo` (cross-cutting), `ci`.
- Subject: imperative, lowercase, no period, max 72 chars. Commitlint enforces lowercase subject.
- Body: optional, explains the **why**.
- Footer: `Closes #N`, `Refs #N`.

Multi-package PRs use the `repo` scope.

### PR rules

- Title follows conventional commits.
- Description: what + why + test plan. Link the issue.
- Lint, typecheck, test, build must be green.
- No squash-merge for multi-commit PRs unless all commits are chore-level. Prefer rebase or merge.
- Self-review first.

## Code placement

See [ADR-0001](./docs/adr/0001-feature-first-code-placement.md). In short:

- Apps use **feature-first**: `app/`, `features/<domain>/`, `shared/`, `store/`. Nothing else at `src/` root.
- A feature is a self-contained directory; cross-feature reuse moves to `shared/` only when the second consumer arrives.
- No barrel files inside subfolders. Each package has exactly one barrel: `src/index.ts`. Direct imports inside the package.
- Outside the package, consumers always import from the package name (`@kay-am/ui`), never from a deep path.

## Component co-location

See [ADR-0002](./docs/adr/0002-component-co-location.md).

A component with private children lives at `components/<Parent>/index.tsx`; each private child sits as a sibling file in the same directory, named for what it is — **no parent-name prefix**.

```
features/workspace/components/WorkspacesSidebar/
├── index.tsx          # exports WorkspacesSidebar
├── AgentRow.tsx       # not WorkspacesSidebarAgentRow.tsx
├── SpawnAgentControl.tsx
└── EmptyState.tsx
```

If a child is needed outside the parent, graduate it: move to its own `components/<Name>/` directory (when still feature-local) or to `shared/components/` (when 2+ features need it).

## Tauri command boundary

See [ADR-0003](./docs/adr/0003-tauri-command-boundary.md).

- Every subprocess / URL-opening / shell-bound command validates its argument against an allowlist at the Rust boundary.
- Every command returns a typed `Result<T, E>` with a `{kind, message}` envelope. No bare `Result<_, String>`, no infallible commands.
- Shared helpers (`uuid_v4`, `iso_now`, `days_in_month`, etc.) live in `apps/desktop/src-tauri/src/util.rs`. Re-implementing them in a new module is a review-fail.

## Testing

See [ADR-0005](./docs/adr/0005-test-layout.md).

- **Colocated.** `foo.ts` + `foo.test.ts` next to each other. No `__tests__/` subfolders for unit tests.
- Integration tests (when needed) live in `<package>/src/__tests__/integration/` and are env-gated.
- Factories, not fixtures. Mock only at the boundary (invoke, spawn, network).

## DB schema

See [ADR-0006](./docs/adr/0006-db-schema-hygiene.md).

- Every table: `id TEXT PRIMARY KEY`, `created_at INTEGER NOT NULL`, `updated_at INTEGER NOT NULL` (ms epoch).
- Every enum column: `CHECK (col IN (...))`.
- Every FK: explicit `ON DELETE` + an index.
- Every `WHERE` / `ORDER BY` column: an index (unless table is tiny).
- No `BOOLEAN` (SQLite has none). `INTEGER` 0/1, named `is_*` / `has_*` / similar.
- Idempotent migrations (`IF NOT EXISTS`, conditional column adds). Migrations are append-only — never edited after shipping.
- Query functions return domain types from `@kay-am/types`; raw `*Row` interfaces stay private.

## Dependency policy

Every dependency is a liability.

**Before adding any dependency**:

1. **Necessary?** — Web API or 20 lines of code instead?
2. **Maintenance** — released in last 6 months; active issues/PRs; multiple maintainers if possible.
3. **Adoption** — ≥100k weekly downloads, or known org/individual.
4. **Size** — bundle impact known. No hidden 5MB transitive trees.
5. **License** — MIT, Apache 2.0, BSD, or ISC only.
6. **Security** — `pnpm audit` clean.
7. **Transitive** — `pnpm why <pkg>` reasonable.

**Rules of thumb**:

- Prefer Web APIs, Node built-ins, Tauri APIs over npm packages.
- No utility libraries (lodash, ramda, etc.).
- No CSS-in-JS runtimes — Tailwind only.
- No date libraries — `Intl` + native `Date`.
- No HTTP clients — `fetch`.
- Approved core deps: `react`, `react-dom`, `typescript`, `vite`, `tailwindcss`, `@tauri-apps/*`, `zustand`. Anything else needs PR-description justification.

## Pre-commit hooks (Lefthook)

- `pre-commit`: `eslint --fix` + `prettier --write` on staged files.
- `commit-msg`: `commitlint` (enforces lowercase subject + scope).
- No tests in pre-commit (slow). Tests run in CI.

## CI pipeline

On every PR + push to main:

1. `pnpm install --frozen-lockfile` (cached).
2. `turbo run lint --affected`.
3. `turbo run typecheck --affected`.
4. `turbo run test --affected`.
5. `turbo run build --affected`.
6. `pnpm audit --prod`.

All must pass.

## Naming

- **Files**: kebab-case for utilities (`provider-adapter.ts`), PascalCase for React components (`ProviderAdapter.tsx`).
- **Folders**: kebab-case.
- **Components**: PascalCase. One per file. File name matches the export.
- **Hooks**: `use<Name>` camelCase in code. File: `use-name.ts`.
- **Constants**: `SCREAMING_SNAKE_CASE`.
- **Types/interfaces**: PascalCase. No `I` prefix.
- **Booleans**: `is`, `has`, `can`, `should` prefix.
- **DB**: snake_case for tables / columns. Mapped to camelCase domain types at the query boundary.

## Workspace boilerplate

Each workspace **must** have:

- `package.json` with `"name": "@kay-am/<workspace>"`.
- `tsconfig.json` extending `tsconfig.base.json`.
- `CONVENTIONS.md` covering stack-specific rules.
- `README.md` with purpose + public API surface.
- `src/index.ts` as the only public barrel (re-exports only).
