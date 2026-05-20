# Conventions — Root

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
├── scripts/            # Local automations
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

## TypeScript (project references)

- Every package has `composite: true`, `declaration: true`, `declarationMap: true`.
- Root `tsconfig.json` declares `references` to all packages.
- Build with `tsc -b` (incremental, cached). Never plain `tsc` in CI.
- `noEmit: true` in app packages, `emitDeclarationOnly: true` for libraries that ship types only.
- `skipLibCheck: true` everywhere. `strict: true` everywhere. `noUncheckedIndexedAccess: true`.
- `verbatimModuleSyntax: true` — explicit `import type` for type-only imports.
- Path aliases: per-package only. No global `@/` aliases that span workspaces — use package names.

## Turborepo

- Tasks defined in `turbo.json`: `build`, `dev`, `lint`, `typecheck`, `test`.
- `dependsOn: ["^build"]` for tasks that need built dependencies.
- `outputs` array must match real build artifacts (`dist/**`, `.turbo/**`).
- `cache: false` only for non-deterministic tasks (`dev`, watch modes).
- CI uses `turbo run <task> --affected` to skip unchanged packages.

## Git workflow

### Branches

- `main` is protected. No direct push. PR required.
- Branch naming: `feat/<short>`, `fix/<short>`, `chore/<short>`, `docs/<short>`, `refactor/<short>`.
- One concern per branch. Split if mixed.

### Conventional commits

Format: `type(scope): subject`

- **types**: `feat`, `fix`, `refactor`, `docs`, `chore`, `test`, `ci`, `style`, `perf`.
- **scopes**: `desktop`, `ui`, `core`, `db`, `types`, `repo` (for root config), `ci`.
- Subject: imperative, lowercase, no period. Max 72 chars.
- Body: optional, explain WHY. Max 80 char wrap.
- Footer: reference issues — `Closes #12`, `Refs #34`.

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
- Require: lint, typecheck, test, build all green.
- No squash-merge for multi-commit PRs unless commits are all chore-level. Prefer rebase or merge.
- Self-review before requesting review.

## Issues as task manager

Labels (set up at repo init):

- **type**: `feat`, `bug`, `chore`, `docs`, `refactor`, `perf`.
- **priority**: `p0`, `p1`, `p2`, `p3`.
- **status**: `todo`, `in-progress`, `blocked`, `review`, `done`.
- **scope**: `desktop`, `ui`, `core`, `db`, `types`.

Every PR closes at least one issue.

## Dependency policy

(Detailed in [CLAUDE.md](./CLAUDE.md). Summary below.)

- Min 100k weekly downloads OR known maintainer.
- License: MIT, Apache 2.0, BSD, ISC. Nothing else.
- `pnpm audit` clean. No unpatched CVEs.
- Manual review of `pnpm-lock.yaml` diff in every PR.
- Approved core deps: `react`, `react-dom`, `typescript`, `vite`, `tailwindcss`, `@tauri-apps/*`, `zustand`. Anything else needs justification.
- No utility libraries (lodash, ramda, date-fns, etc.). Use native APIs.
- No HTTP clients. Use `fetch`.
- No CSS-in-JS runtimes. Tailwind only.

## Code rules (apply to all packages)

- No `any`. Use `unknown` + type guards.
- No default exports. Named only.
- No comments unless explaining WHY, not WHAT.
- No dead code. Remove, don't comment out.
- No prop spreading without explicit type.
- Discriminated unions for state machines.
- Branded types for IDs (`type WorkspaceId = string & { __brand: 'WorkspaceId' }`).
- `satisfies` over `as` for const validation.
- Exhaustiveness with `never` in switch defaults.

## Pre-commit hooks (Lefthook)

- `pre-commit`: `eslint --fix` + `prettier --write` on staged files.
- `commit-msg`: `commitlint`.
- No tests in pre-commit (slow). Tests run in CI.

## CI pipeline

GitHub Actions on every PR + push to main:

1. Install: `pnpm install --frozen-lockfile` (cached by lockfile hash).
2. Lint: `turbo run lint --affected`.
3. Typecheck: `turbo run typecheck --affected`.
4. Test: `turbo run test --affected`.
5. Build: `turbo run build --affected`.
6. Audit: `pnpm audit --prod`.

All must pass. No green-on-warning.

## Naming conventions

- **Files**: kebab-case (`provider-adapter.ts`) for utilities, PascalCase (`ProviderAdapter.tsx`) for React components.
- **Folders**: kebab-case always.
- **Components**: PascalCase. One component per file. File name matches component.
- **Hooks**: `use<Name>` camelCase. File: `use-name.ts`.
- **Constants**: `SCREAMING_SNAKE_CASE`.
- **Types/interfaces**: PascalCase. No `I` prefix.
- **Booleans**: `is`, `has`, `can`, `should` prefixes.

## Workspace conventions

Each workspace MUST have:

- `package.json` with `"name": "@goodboy/<workspace>"`.
- `tsconfig.json` extending root `tsconfig.base.json`.
- `CONVENTIONS.md` covering stack-specific rules.
- `README.md` with purpose + public API surface.
- `src/index.ts` as the only public entry point (re-exports only).
