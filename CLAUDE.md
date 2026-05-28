# Goodboy (Claude-specific notes)

For codebase conventions (file layout, naming, tests, git workflow, dependency policy, forbidden patterns), see [AGENTS.md](./AGENTS.md). This file holds only Claude-specific guidance.

AI workspace orchestrator. Manage macro sessions, route agents across providers, balance usage automatically.

## Stack quick-reference

- **Shell**: Tauri 2 (Rust backend)
- **Frontend**: React + Vite + TypeScript
- **State**: Zustand
- **Persistence**: SQLite (via Tauri)
- **Styling**: Tailwind CSS + Shadcn/ui
- **Theme**: Light mode (default)

## Claude-specific notes

- When editing the store, prefer the slice package convention (see AGENTS.md → "Store slices"). Adding a new domain → new slice folder, never extend the monolith.
- When extracting a hook, default to the folder convention (`useFoo/index.ts`); add an `index.test.ts` if behavior is non-trivial.
- Skill files (`.claude/skills/*.md`) and worktrees (`.claude/worktrees/`) are local-only: never commit them.
- `REFACTOR_PLAN.md` and similar planning docs at repo root are gitignored. Keep them out of commits.
