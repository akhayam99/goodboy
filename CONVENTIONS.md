# Conventions: Root

Foundational rules for the Goodboy monorepo. Each workspace has its own `CONVENTIONS.md` for stack-specific rules.

## Monorepo structure

```
goodboy/
├── apps/
│   └── desktop/        # Tauri 2 desktop app
├── packages/
│   ├── ui/             # Shared React components
│   ├── core/           # Business logic (provider routing, sessions, balance)
│   ├── db/             # SQLite schema + queries
│   └── types/          # Shared TypeScript types
├── website/            # Landing page, standalone (outside the pnpm workspace)
├── packaging/          # Homebrew cask formula
├── .github/
│   └── workflows/      # CI pipelines
└── .claude/            # Claude Code config (settings, agents, skills)
```

- `apps/*` → consumer applications.
- `packages/*` → reusable libraries. No app code here.
- Internal deps via `workspace:*` protocol. Never via npm registry.

## pnpm

- `pnpm-workspace.yaml`: `packages: ['apps/*', 'packages/*']`.
- `pnpm install --frozen-lockfile` in CI. Never auto-update lockfile in CI.
- Every import must be declared in that package's `package.json`. No phantom deps.
- Use `pnpm --filter <pkg>` for scoped scripts. Use `pnpm --filter "...<pkg>"` to include dependents.
- `website/` is outside the workspace and keeps its own `website/pnpm-lock.yaml`. Any change to `website/package.json` must regenerate it with `pnpm install --ignore-workspace` from `website/`: a plain root `pnpm install` never touches that lockfile, and Vercel installs with `--frozen-lockfile`, so a stale lockfile fails every website build.

## TypeScript (project references)

- Every package has `composite: true`, `declaration: true`, `declarationMap: true`.
- Root `tsconfig.json` declares `references` to all packages.
- Build with `tsc -b` (incremental, cached). Never plain `tsc` in CI.
- `noEmit: true` in app packages, `emitDeclarationOnly: true` for libraries that ship types only.
- `skipLibCheck: true` everywhere. `strict: true` everywhere. `noUncheckedIndexedAccess: true`.
- `verbatimModuleSyntax: true`: explicit `import type` for type-only imports.
- Path aliases: per-package only. No global `@/` aliases that span workspaces (use package names).

## Turborepo

- Tasks defined in `turbo.json`: `build`, `dev`, `lint`, `typecheck`, `test`.
- `dependsOn: ["^build"]` for tasks that need built dependencies.
- `outputs` array must match real build artifacts (`dist/**`, `.turbo/**`).
- `cache: false` only for non-deterministic tasks (`dev`, watch modes).
- CI uses `turbo run <task> --affected` to skip unchanged packages.

## Git workflow

### Branches

- `main` is protected. No direct push. PR required.
- Branch naming: `<user>/<type>-<kebab-description>`, e.g. `ak/feat-integrations-lens`, `ak/fix-cursor-model-mapping`, `ak/chore-release-v0.1.31`. Never the worktree codename.
- One concern per branch. Split if mixed.

### Conventional commits

Format: `type(scope): subject`

- **types**: `feat`, `fix`, `refactor`, `docs`, `chore`, `test`, `ci`, `style`, `perf`.
- **scopes**: `desktop`, `ui`, `core`, `db`, `types`, `repo` (for root config), `ci`.
- Subject: imperative, lowercase, no period. Max 72 chars.
- Body: optional, explain WHY. Max 80 char wrap.
- Footer: reference issues, `Closes #12`, `Refs #34`.

Examples:

```
feat(core): add anthropic provider adapter
fix(desktop): handle workspace path with spaces
chore(repo): bump pnpm to 10.33.4
```

### PR rules

- Title follows conventional commits format.
- Description: what + why + test plan.
- Link issue: `Closes #N`.
- Require: typecheck, test, build all green. Lint is wired but unimplemented (see [CI pipeline](#ci-pipeline)).
- No squash-merge for multi-commit PRs unless commits are all chore-level. Prefer rebase or merge.
- Self-review before requesting review.

## Issues as task manager

Issues are the product's front door: the owner and contributors direct the
autonomous delivery loop through them, weighed by the trust model in
[docs/autonomy/safety.md](./docs/autonomy/safety.md) and answered every
release cycle per [docs/autonomy/issue-triage.md](./docs/autonomy/issue-triage.md).

Labels (set up at repo init):

- **type**: `feat`, `bug`, `chore`, `docs`, `refactor`, `perf`.
- **priority**: `p0`, `p1`, `p2`, `p3`.
- **status**: `todo`, `in-progress`, `blocked`, `review`, `done`.
- **scope**: `desktop`, `ui`, `core`, `db`, `types`.

Every PR closes at least one issue.

## Dependency policy

Single source of truth: [docs/dependencies.md](./docs/dependencies.md). Internal workspace deps are governed by [pnpm](#pnpm) above.

## Code rules

Code rules and the forbidden-patterns checklist live in the code hub [AGENTS.md](./AGENTS.md). Full TypeScript style with examples in the [docs/typescript/](./docs/typescript/) cluster (index at [docs/typescript.md](./docs/typescript.md)).

## Pre-commit hooks (Lefthook)

- `pre-commit`: `prettier --write` on staged files, then re-stage. No eslint step: the repo has no eslint config.
- `commit-msg`: `commitlint`.
- No tests in pre-commit (slow). Tests run in CI.

## CI pipeline

GitHub Actions on every PR + push to main:

1. Install: `pnpm install --frozen-lockfile` (cached by lockfile hash).
2. Lint: `turbo run lint --affected`. The task is declared in `turbo.json` but no package implements a `lint` script and the repo has no eslint config, so this step currently passes without checking anything.
3. Typecheck: `turbo run typecheck --affected`.
4. Test: `turbo run test --affected`.
5. Build: `turbo run build --affected`.
6. Audit: `pnpm audit --prod`.

All must pass. No green-on-warning.

## Naming conventions

Naming (files, folders, components, hooks, constants, types, booleans) is owned by the code hub [AGENTS.md](./AGENTS.md) → Naming.

## Workspace conventions

Each workspace MUST have:

- `package.json` with `"name": "@goodboy/<workspace>"`.
- `tsconfig.json` extending root `tsconfig.base.json`.
- `CONVENTIONS.md` covering stack-specific rules.
- `README.md` with purpose + public API surface.
- `src/index.ts` as the only public entry point (re-exports only).
