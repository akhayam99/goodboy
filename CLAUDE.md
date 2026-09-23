# Goodboy (Claude-specific notes)

> **Read this when** Claude is working in this repository and needs guidance
> that only applies to Claude. **Not for** shared code or process rules (see
> `AGENTS.md` and `CONVENTIONS.md`).

For codebase conventions (file layout, naming, tests, git workflow, dependency policy, forbidden patterns), see [AGENTS.md](./AGENTS.md). This file holds only guidance for Claude.

Goodboy is an AI workspace orchestrator. It manages macro sessions (one session covers a whole task), routes agents across providers, and balances usage between them on its own.

## Stack quick-reference

- **Shell**: Tauri 2 (Rust backend)
- **Frontend**: React + Vite + TypeScript
- **State**: Zustand
- **Persistence**: SQLite (via Tauri)
- **Styling**: Tailwind CSS + Shadcn/ui
- **Theme**: Dark mode (default)

## Claude-specific notes

- When you edit the store, prefer the slice package convention (see [docs/file-system.md](./docs/file-system.md) → Store slices). A new domain gets a new slice folder. Never extend the monolith.
- When you extract a hook, use the folder convention by default (`useFoo/index.ts`). Add an `index.test.ts` if the behavior is non-trivial.
- Worktrees (`.claude/worktrees/`) and personal skill files under `.claude/` stay local. Never commit them.
- `REFACTOR_PLAN.md` and similar planning docs at the repo root are gitignored. Keep them out of commits.
- Before you finish, apply [AGENTS.md](./AGENTS.md) → Docs move with the code. Auto-memory does not replace the doc that owns the fact.
- Product direction and the autonomous delivery organization live in the private `goodboy-atlas` repository, not here. Do not rebuild either one from this repo. Ask the owner.
