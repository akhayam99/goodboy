# Goodboy

**AI workspace orchestrator. Local-first. Provider-agnostic.**

Goodboy sits between you and your AI coding agents — it doesn't replace your
editor or terminal, it commands them. Run agents against your repos, keep them
aware of the work through a context they all share, route them across Claude,
Cursor, and Codex, and watch the cost as it accrues.

<img width="4036" height="2270" alt="CleanShot 2026-05-25 at 14 09 18@2x" src="https://github.com/user-attachments/assets/f669511b-c09d-472b-9f30-3dcc88b7ceae" />

## What it does

You hand Goodboy a repo and a goal. It runs AI coding agents inside a git
worktree, keeps a structured picture of the work in a context panel they all
read, and lets you drive the whole thing — providers, plans, pull requests,
repeatable scripts — from one window. The conversation and that context live
in a local SQLite database, never on a server: your machine, your keys, your
data.

## Main features

### Shared context

Every session carries a context panel — **Goal**, **Decisions**, **Last output
summary**, **Open questions** — that a summarizer refreshes after each turn and
that you can edit by hand at any time. It's the single source of truth for the
work, kept separate from any one chat transcript.

### One agent, aware on any provider

Goodboy owns the conversation: every turn is rebuilt from the shared context,
not resumed from a provider's session. So you can switch provider or model
mid-task — Claude, Cursor, Codex; Haiku, Sonnet, Opus — and the agent still has
the full picture. No re-explaining where things stand.

### First-class plans

Planner agents emit structured plans. They land in the context panel's
**Plans** tab as artifacts with a status — listed and ordered, ready to hand to
the agent that implements them — instead of being lost in a transcript.

### GitHub integration

The context panel's **GitHub** tab shows the session's pull request right where
you work: state, CI checks, and unresolved review comments, one click from the
full detail.

### Linear integration

Connect a Linear workspace to pull issues assigned to you straight into the
new-session dialog. Pick an issue, the goal autofills from its title and
description, and the session header carries a chip that opens the issue back
in Linear.

Integration scope is **per workspace** (not global): each workspace holds its
own Linear account, so a single repo can be wired to its own Linear org without
leaking issues across repos. The personal access token is verified against
Linear's `/viewer` endpoint and stored in the OS keychain
(`goodboy.workspace.<id>.linear`). It never leaves your machine.

To enable:

1. Generate a Linear PAT at
   [linear.app/settings/account/security](https://linear.app/settings/account/security)
   (read-only scope is enough).
2. Open **Workspace settings → Integrations → Linear**, paste the token, click
   **Connect**.
3. New sessions in that workspace now show a Linear issue picker above the
   goal field.

Disconnect from the same panel: removes both the keychain entry and the DB
row. Sessions already linked keep their chip — history is preserved.

### Workflows

Run a whole multi-step flow as a single session. Each step is a role-typed
agent — scout, plan, implement, verify — that runs in order and carries the
shared context forward. Start from a saved preset or build a custom workflow
that matches how your repo actually works.

### One-click scripts

Register the shell commands you keep running by hand — install deps, copy an
env file, build — as workspace scripts, then run them in one click with the
output inline. No agent, no tokens spent.

## Providers

Goodboy drives locally installed provider CLIs — each on your existing
**subscription**, not metered API tokens.

| Provider               | CLI                                  | Subscription     |
| ---------------------- | ------------------------------------ | ---------------- |
| **Anthropic (Claude)** | `npm i -g @anthropic-ai/claude-code` | Claude Max / Pro |
| **Cursor**             | Cursor desktop app                   | Cursor Pro       |
| **OpenAI (Codex)**     | `npm i -g @openai/codex`             | ChatGPT Pro      |

At least one connected CLI is required. Full guide: [docs/providers.md](./docs/providers.md).

## Quickstart

```bash
pnpm install
pnpm tauri:dev          # launch the desktop app in dev
```

Needs **Node ≥ 20**, **pnpm ≥ 10**, and the **Rust** toolchain (Tauri shells out
to `cargo`). Platform prerequisites: <https://v2.tauri.app/start/prerequisites/>.

## Stack

**Tauri 2 · React 19 · TypeScript · Tailwind v4 · Zustand · SQLite**, in a
pnpm + Turborepo monorepo — `apps/desktop` plus `packages/{ui,core,db,types}`.

## More

- [VISION.md](./VISION.md) — what Goodboy is and why
- [DESIGN.md](./DESIGN.md) — how it looks and behaves
- [ROADMAP.md](./ROADMAP.md) — milestones and what shipped
- [CONVENTIONS.md](./CONVENTIONS.md) · [CLAUDE.md](./CLAUDE.md) — contributor rules

## License

[MIT](./LICENSE) © Amin Khayam
