# kAY.am

**AI workspace orchestrator. Local-first. Provider-agnostic.**

kAY.am sits between you and your AI agents. It doesn't replace your editor or your terminal — it commands them. One workspace per repo. One session per goal. N agents per session, each with its own chat and provider, sharing the same context. Routing across Anthropic, OpenAI, and Cursor based on priority and budget. Real-time cost. Skills for the repeatable.

> **Status**: per-agent chat model live · sidebar-first IA (no header / footer chrome) · v1.0 next — see [ROADMAP.md](./ROADMAP.md).

---

## Why

| Problem                                                         | kAY.am                                  |
| --------------------------------------------------------------- | --------------------------------------- |
| AI sessions are monolithic threads. Context bloats, costs blur. | One session = one goal, scoped context. |
| Switching providers means switching tools. No layer compares.   | Provider-agnostic routing + budget.     |
| Local skills and workflows are locked into vendor ecosystems.   | Skills live with the workspace.         |

## Principles

- **Local-first, local-only.** No backend. No telemetry. Your machine, your keys, your data.
- **Provider-agnostic.** No lock-in.
- **Context is expensive.** Never send more than needed.
- **Sessions are goals, not threads.**
- **Each agent owns its chat.** Sessions share context, not history.
- **Automate the repeatable.**

Full product vision in [VISION.md](./VISION.md).

## Mental model

```
Workspace                a registered git repo
└── Session              one goal · own worktree · own branch · shared context
    ├── ContextPanel     auto-populated by the LLM after every turn
    └── Agent (×N)       independent chat · own provider/model
```

- **Workspace** — a local git repo you registered. Sessions are scoped to it.
- **Session** — one goal. Owns the worktree, the branch, the context panel, the budget. Auto-spawns `agent 1` on creation.
- **Agent** — an independent chat thread inside a session. Spawn as many as you want. Switch via sidebar. All agents read the same shared context; the summarizer refreshes it after each turn.
- **Workflow** _(beta)_ — a preset that pre-spawns N role-named agents at session creation (e.g. scout → planner → implementer → reviewer). Free-form spawn always available.

---

## Stack

**Tauri 2** · **React 19** · **TypeScript 5** · **Vite 6** · **Tailwind v4** · **Zustand** · **SQLite** (local, never sent anywhere) · **pnpm workspaces** + **Turborepo**.

```
kay-am/
├── apps/desktop/        Tauri 2 desktop app
└── packages/
    ├── ui/              shared React components
    ├── core/            workflows · providers · budget · context
    ├── db/              SQLite schema + queries
    └── types/           shared TypeScript types
```

## Layout

Two columns. Floating sidebar left, chat + context panel right. No top header, no bottom footer — both fold into the sidebar.

```
┌─────────────────────────┬───────────────────────────────┬──────────────┐
│ kAY.am          🔔  ⚙   │ goal · branch · open in code  │              │
│                         │                               │              │
│ WORKSPACES              │                               │              │
│  • app-web              │                               │  Context     │
│                         │                               │  Panel       │
│ SESSIONS    (app-web)   │       Agent's chat            │              │
│  • refactor auth        │       (streaming)             │  shared      │
│                         │                               │  across      │
│ AGENTS      2 agents    │                               │  agents      │
│  ▣ agent 1  ← selected  │                               │              │
│  ▢ agent 2              │                               │  (collap-    │
│  + spawn agent          │                               │   sible)     │
│                         │ ┌───────────────────────────┐ │              │
│                         │ │ Message Claude…        ▶  │ │              │
│                         │ └───────────────────────────┘ │              │
│ ⓟ providers   3 / 3     │  [Claude] [Opus 4.7] [Med]   │              │
│ $0.20 session · $1.40   │                               │              │
└─────────────────────────┴───────────────────────────────┴──────────────┘
   sidebar (floating)            chat (central)              context
```

- **Sidebar top** — brand · alerts bell · settings (⌘,).
- **Sidebar middle** — workspaces → sessions → agents.
- **Sidebar footer** — providers chip · cost telemetry pill (click for per-model breakdown).
- **Right rail** — shared context panel for the current session, collapsible.

---

## Providers

kAY.am orchestrates through locally installed CLIs. Each uses the **subscription cap**, not API tokens.

| Provider               | CLI install                                      | Subscription            |
| ---------------------- | ------------------------------------------------ | ----------------------- |
| **Anthropic (Claude)** | `npm i -g @anthropic-ai/claude-code`             | Claude Max / Claude Pro |
| **Cursor**             | [cursor.com](https://www.cursor.com) desktop app | Cursor Pro              |
| **OpenAI (Codex)**     | `npm i -g @openai/codex`                         | ChatGPT Pro             |

Connect: `<cli> /login` (Claude / Cursor) or `<cli> login` (Codex). Full guide: [docs/providers.md](./docs/providers.md).

## Prerequisites

- **Node** ≥ 20 · **pnpm** ≥ 9
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

1. **Boot** — `pnpm tauri:dev`, wait for the splash to reach _ready_.
2. **Connect a provider** — ⚙ (⌘,) → **Providers** → connect ≥1 of Claude / Cursor / Codex.
3. **Add a workspace** — sidebar **Workspaces** → **add workspace…** → pick a local git repo.
4. **Create a session** — sidebar **Sessions** → **add session** → set a goal, optionally pick a **workflow** (beta).
5. **Talk to agent 1** — auto-spawned on session creation. Type → enter. Watch the transcript stream, the cost pill tick, and a `worktree-{slug}` directory appear next to your repo.
6. **Spawn more agents** — **Agents** block → **+ spawn agent**. Click any row to switch. Hover + pencil to rename.
7. **Open in editor** — **Open in code** button in the chat header opens the worktree in your default editor (or pick from a dropdown if you have multiple detected).
8. **Watch cost + alerts** — providers chip + telemetry pill in the sidebar footer. 🔔 in the top bar opens the notification center for budget thresholds.
9. **Archive / end** — sidebar kebab → **archive** (keeps it inspectable) or **⌘.** to end the active session (cleans the worktree, keeps the branch).

---

## Settings

- **Global** (⚙ top of sidebar) — App / Providers / Budget / Agent / Github / Advanced / Initialization. Beta chips mark unvalidated sections. **Initialization → Wipe local database** drops every workspace/session/agent/message in `~/.kay-am/data.db` and re-runs migrations on next boot. OS-keychain API keys are untouched.
- **Per-workspace** (workspace row → ⚙ on hover) — General (branch prefix), Skills, Workflows (beta). Scoped — never bleeds into the global dialog.

## Roadmap & contributing

- [ROADMAP.md](./ROADMAP.md) — milestones and active issues.
- [CONVENTIONS.md](./CONVENTIONS.md) — monorepo conventions.
- [CLAUDE.md](./CLAUDE.md) — project rules (enforced via `lefthook` + `commitlint`).

Conventional commits, lowercase subjects. `main` is protected — PR only.

## License

[MIT](./LICENSE) © Amin Khayam
