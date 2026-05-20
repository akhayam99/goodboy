# Goodboy

**AI workspace orchestrator. Local-first. Provider-agnostic.**

Goodboy sits between you and your AI agents. It doesn't replace your editor or your terminal — it commands them. One workspace per repo. One session per goal. N agents per session, each with its own chat, provider, and kind. Routing across Anthropic, Cursor, and Codex based on priority and budget. Plans as first-class artifacts. GitHub PR/CI integration. Real-time cost. Skills for the repeatable.

> **Status**: open beta. Sidebar redesigned around workspace cards + per-session activity bar + detail panel. Soft-disconnect for workspaces, branch-vs-main files counter with line totals, per-kind agent icons, polished context panel + boot splash. **v1.0 next** — see [ROADMAP.md](./ROADMAP.md).

---

## Why

| Problem                                                         | Goodboy                                 |
| --------------------------------------------------------------- | --------------------------------------- |
| AI sessions are monolithic threads. Context bloats, costs blur. | One session = one goal, scoped context. |
| Switching providers means switching tools. No layer compares.   | Provider-agnostic routing + budget.     |
| Local skills and workflows are locked into vendor ecosystems.   | Skills live with the workspace.         |
| Plans live buried in chat transcripts.                          | Plans as first-class session artifacts. |

## Principles

- **Local-first, local-only.** No backend. No telemetry. Your machine, your keys, your data.
- **Provider-agnostic.** No lock-in.
- **Context is expensive.** Never send more than needed.
- **Sessions are goals, not threads.**
- **Each agent owns its chat.** Sessions share context, not history.
- **Automate the repeatable.**
- **Plans over chat.** Structure intent as artifacts.

Full product vision in [VISION.md](./VISION.md).

## Mental model

```
Workspace                  a registered git repo
└── Session                one goal · own worktree · own branch · shared context · status
    ├── ContextPanel       auto-populated after every turn (collapsible slots)
    ├── Plan (×N)          first-class artifact from planner agents
    └── Agent (×N)         independent chat · own provider/model/effort/kind
```

- **Workspace** — a local git repo you registered. Sessions are scoped to it.
- **Session** — one goal. Owns the worktree, the branch, the context panel, the budget. Has a lifecycle status (wip / waiting / blocked / done). Auto-spawns `agent 1` on creation.
- **Agent** — an independent chat thread inside a session. Spawn as many as you want. Switch via sidebar. Each agent has a kind (scout, planner, implementer, debugger, tester, reviewer, docs, generic) that shapes its defaults. All agents read the same shared context; the summarizer refreshes it after each turn.
- **Plan** — a structured artifact captured from a planner agent's output. Session-scoped. Other agents consume plans and act on them.
- **Workflow** _(beta)_ — a preset that pre-spawns N role-named agents at session creation (e.g. scout → planner → implementer → reviewer). Free-form spawn always available.

---

## Stack

**Tauri 2** · **React 19** · **TypeScript 5** · **Vite 6** · **Tailwind v4** · **Zustand 5** · **SQLite** (local, never sent anywhere) · **pnpm 10 workspaces** + **Turborepo**.

```
goodboy/
├── apps/desktop/        Tauri 2 desktop app
└── packages/
    ├── ui/              shared React components
    ├── core/            workflows · providers · budget · context · plans · summarizer
    ├── db/              SQLite schema + queries + migrations
    └── types/           shared TypeScript types
```

## Layout

Two columns. Fixed sidebar left, chat + context panel right. No top header, no bottom footer — both fold into the sidebar.

- **Sidebar — workspaces row** — workspace cards (gear opens per-workspace settings, X soft-disconnects). Up to 3 active workspaces during beta. `N/3` counter at the top right.
- **Sidebar — activity bar** — vertical session strip with status dot per session, unread ping, `+ new` at the bottom.
- **Sidebar — detail panel** — selected session: goal, branch chip, session cost chip, GitHub PR (with refresh + details dialog), agents list (kind icons + unread), files-touched footer (branch-vs-main with `+N −N` line totals).
- **Sidebar footer** — brand · spend / pricing · light-dark toggle · notifications bell · guide · settings (⌘,).
- **Right rail** — shared context panel for the current session (slot cards, sticky open questions, plans, markdown rendered).

---

## Providers

Goodboy orchestrates through locally installed CLIs. Each uses the **subscription cap**, not API tokens.

| Provider               | CLI install                                      | Subscription            |
| ---------------------- | ------------------------------------------------ | ----------------------- |
| **Anthropic (Claude)** | `npm i -g @anthropic-ai/claude-code`             | Claude Max / Claude Pro |
| **Cursor**             | [cursor.com](https://www.cursor.com) desktop app | Cursor Pro              |
| **OpenAI (Codex)**     | `npm i -g @openai/codex`                         | ChatGPT Pro             |

Connect: `<cli> /login` (Claude / Cursor) or `<cli> login` (Codex). Full guide: [docs/providers.md](./docs/providers.md).

## Prerequisites

- **Node** ≥ 20 · **pnpm** ≥ 10
- **Rust** toolchain — install from <https://rustup.rs>, then ensure `cargo` is on `PATH` (`source "$HOME/.cargo/env"` in your shell rc, or restart the terminal). Tauri shells out to `cargo metadata` and fails with `os error 2` if it's missing.
- Platform Tauri prereqs — <https://v2.tauri.app/start/prerequisites/>
- At least one **provider CLI** on `PATH`. The summarizer reuses the active provider's cheap-tier model — no separate API token.

## Quickstart

```bash
pnpm install
pnpm tauri:dev          # launches the desktop app in dev
```

| Command            | What it does                        |
| ------------------ | ----------------------------------- |
| `pnpm typecheck`   | `tsc --noEmit` across the monorepo  |
| `pnpm test`        | vitest across packages              |
| `pnpm build`       | vite build (frontend)               |
| `pnpm tauri:build` | package the desktop app             |
| `pnpm format`      | prettier across `ts/tsx/js/json/md` |

---

## First run

1. **Boot** — `pnpm tauri:dev`, wait for the splash to reach _ready_ (mascot + smooth progress).
2. **Connect a provider** — ⌘, → **Providers** → connect at least one of Claude / Cursor / Codex.
3. **Configure GitHub** _(optional)_ — ⌘, → **Integrations** → connect via `gh` CLI or personal access token.
4. **Add a workspace** — sidebar **Workspaces** row → **+** → pick a local git repo. Up to 3 active workspaces during beta — the **X** on a card soft-disconnects (sessions, transcripts, worktrees stay safe; re-adding the same path brings everything back).
5. **Create a session** — activity bar **+ new** → set a goal, optionally pick a workflow (beta).
6. **Talk to agent 1** — auto-spawned on session creation. Type → enter. Watch the transcript stream, the session cost chip tick, and a `worktree-{slug}` directory appear next to your repo.
7. **Spawn more agents** — **Agents** block → **+ spawn agent**. Click any row to switch. Agents auto-name from their first message. Hover + pencil to rename. Kind is inferred or set manually; the icon and accent color follow the kind (scout/planner/implementer/debugger/tester/reviewer/docs/generic).
8. **Use next-action chips** — after each turn, the summarizer suggests next steps (scout / plan / implement). Click to spawn a pre-configured agent.
9. **Track files touched** — footer chip on the detail panel shows `N files touched +A −D` versus `main` (stable across pushes). Click to open the diff viewer (defaults to **branch vs main**).
10. **Watch cost + alerts** — session cost chip in the detail panel, spend dialog in the sidebar footer (dollar icon). Bell icon opens the notification center for budget thresholds.
11. **Set session status** — click the status icon on a session in the activity bar to mark it wip / waiting / blocked / done.
12. **Archive / end** — session settings → **archive** (keeps it inspectable) or end the session (cleans the worktree, keeps the branch).

---

## Settings

- **Global** (⌘, footer of sidebar) — App / Providers / Budget / Integrations / Initialization / Advanced. **Initialization → Wipe local database** drops every workspace/session/agent/message in `~/.goodboy/data.db` and re-runs migrations on next boot. OS-keychain API keys are untouched.
- **Per-workspace** (gear icon on each workspace card) — General (branch prefix), Skills, Init script, Workflows (beta), Disconnect. Scoped — never bleeds into the global dialog.

## Roadmap & contributing

- [ROADMAP.md](./ROADMAP.md) — milestones and what shipped.
- [CONVENTIONS.md](./CONVENTIONS.md) — monorepo conventions.
- [CLAUDE.md](./CLAUDE.md) — project rules (enforced via `lefthook` + `commitlint`).

Conventional commits, lowercase subjects. `main` is protected — PR only.

## License

[MIT](./LICENSE) © Amin Khayam
