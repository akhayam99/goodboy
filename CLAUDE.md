# kAY.am

AI workspace orchestrator. Manage macro sessions, route agents across providers, balance usage automatically.

## Stack

- **Shell**: Tauri 2 (Rust backend)
- **Frontend**: React + Vite + TypeScript
- **State**: Zustand
- **Persistence**: SQLite (via Tauri)
- **Styling**: Tailwind CSS + Shadcn/ui
- **Theme**: Light mode (default)

## Git rules

- **Branch protection**: main is protected. All changes via PR, no direct push.
- **Conventional commits**: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`, `ci:`, `style:`
- **Language**: English only (code, commits, issues, docs, comments).
- **Task management**: GitHub Issues with labels. Reference issues in commits (`feat: add provider adapter #12`).
- **Branch naming**: `feat/short-description`, `fix/short-description`, `chore/short-description`.

test

## Code rules

- TypeScript strict mode.
- No `any` types. Use `unknown` + type guards when type is uncertain.
- No default exports. Named exports only.
- No comments unless explaining WHY, not WHAT.
- No dead code. Remove, don't comment out.
- Rust: only for Tauri commands. Keep minimal — business logic stays in TS.

## Dependency policy

Every dependency is a liability. Add the minimum, vet each one, audit regularly.

**Before adding any dependency**, verify:

1. **Is it necessary?** — Can we use the standard library, a Web API, or 20 lines of code instead?
2. **Maintenance** — Last release within 6 months. Active issues/PRs. Multiple maintainers if possible.
3. **Adoption** — At least 100k weekly downloads on npm, OR strong reputation (e.g., maintained by a known org/individual).
4. **Size** — Bundle impact known. No hidden 5MB transitive trees.
5. **License** — MIT, Apache 2.0, BSD, or ISC only. No copyleft, no custom licenses.
6. **Security** — `pnpm audit` clean. No known unpatched CVEs.
7. **Transitive deps** — Check `pnpm why <pkg>` after install. If it pulls in 50 packages, reconsider.

**Rules of thumb**:

- Prefer Web APIs, Node built-ins, and Tauri APIs over npm packages.
- Prefer one well-maintained package over multiple small ones doing similar things.
- No utility libraries (lodash, ramda, etc.) — write the function or use native methods.
- No CSS-in-JS runtimes — Tailwind only.
- No date libraries unless absolutely needed — use `Intl` and native `Date`.
- No HTTP clients — use `fetch`.
- Approved core deps: `react`, `react-dom`, `typescript`, `vite`, `tailwindcss`, `@tauri-apps/*`, `zustand`.
- Anything else requires justification in the PR description.

**Audit cadence**: `pnpm audit` runs on CI. Manual review of `pnpm-lock.yaml` diff on every PR.

## Architecture

```
kay-am/
├── src-tauri/        # Rust backend (Tauri commands, SQLite, process spawn)
├── src/
│   ├── app/          # App shell, routing, layouts
│   ├── features/     # Feature modules (workspace, providers, tasks, balance)
│   ├── shared/       # Shared components, hooks, utils, types
│   └── main.tsx
├── public/
└── package.json
```

## Provider system

- Adapter pattern: each AI provider implements a common interface.
- Priority-based routing with usage thresholds.
- Provider config stored in SQLite, never in code.
- API keys stored securely via Tauri's credential store.

## VS Code integration

- Workspaces open in VS Code via `code /path/to/worktree`.
- kay-am is the orchestrator, VS Code is the editor.
