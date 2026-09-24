# Goodboy (Claude-specific notes)

> **Read this when** Claude is working in this repository and needs guidance
> that only applies to Claude. **Not for** shared code or process rules (see
> `AGENTS.md` and `CONVENTIONS.md`).

For codebase conventions (file layout, naming, tests, git workflow, dependency policy, forbidden patterns), see [AGENTS.md](./AGENTS.md). This file holds only guidance for Claude.

## Claude-specific notes

- When you edit the store, prefer the slice package convention (see [docs/file-system.md](./docs/file-system.md) → Store slices). A new domain gets a new slice folder. Never extend the monolith.
- When you extract a hook, use the folder convention by default (`useFoo/index.ts`). Add an `index.test.ts` if the behavior is non-trivial.
- Worktrees (`.claude/worktrees/`) and personal skill files under `.claude/` stay local. Never commit them.
- Planning docs at the repo root (`*_PLAN.md`, `*_PROMPT.md`) are gitignored. Keep them out of commits.
- Before you finish, apply [AGENTS.md](./AGENTS.md) → Docs move with the code. Auto-memory does not replace the doc that owns the fact.
- Background Bash commands can be killed when a turn ends. Poll CI and release builds with a foreground until-loop, never `run_in_background`.
- Product direction and the autonomous delivery organization live in the private `goodboy-atlas` repository, not here. Do not rebuild either one from this repo. Ask the owner.
