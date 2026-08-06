# Goodboy (Claude-specific notes)

For codebase conventions (file layout, naming, tests, git workflow, dependency policy, forbidden patterns), see [AGENTS.md](./AGENTS.md). This file holds only Claude-specific guidance.

AI workspace orchestrator. Manage macro sessions, route agents across providers, balance usage automatically.

## Stack quick-reference

- **Shell**: Tauri 2 (Rust backend)
- **Frontend**: React + Vite + TypeScript
- **State**: Zustand
- **Persistence**: SQLite (via Tauri)
- **Styling**: Tailwind CSS + Shadcn/ui
- **Theme**: Dark mode (default)

## Claude-specific notes

- When editing the store, prefer the slice package convention (see [docs/file-system.md](./docs/file-system.md) → Store slices). Adding a new domain → new slice folder, never extend the monolith.
- When extracting a hook, default to the folder convention (`useFoo/index.ts`); add an `index.test.ts` if behavior is non-trivial.
- Worktrees (`.claude/worktrees/`) are local-only: never commit them. Personal skill files are local-only too, with one committed exception: `.claude/skills/continuous-delivery/` belongs to the repo (see [AUTONOMY.md](./AUTONOMY.md)) and evolves via PR like any other file.
- Autonomous work (release chains, issue triage, the delivery loop) is bound by [docs/autonomy/safety.md](./docs/autonomy/safety.md). Read it before acting unattended.
- `REFACTOR_PLAN.md` and similar planning docs at repo root are gitignored. Keep them out of commits.
