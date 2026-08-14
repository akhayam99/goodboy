# Goodboy (Claude-specific notes)

> **Read this when** Claude is operating in this repository and needs
> tool-specific guidance. **Not for** shared code or process rules (see
> `AGENTS.md` and `CONVENTIONS.md`).

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
- Worktrees (`.claude/worktrees/`) and personal skill files under `.claude/` are local-only: never commit them.
- `REFACTOR_PLAN.md` and similar planning docs at repo root are gitignored. Keep them out of commits.
- Product direction and the autonomous delivery organization live in the private `goodboy-atlas` repository, not here. Do not reconstruct either from this repo; ask the owner.
