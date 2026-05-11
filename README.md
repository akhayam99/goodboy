# kAY.am

**AI workspace orchestrator. Local-first. Provider-agnostic.**

kAY.am sits between you and your AI agents. It doesn't replace your editor or your terminal — it commands them.

Manage workspaces. Open sessions per goal. Spawn N agents per session, each with its own chat, sharing the session's context. Route work across providers (Anthropic, OpenAI, Cursor, ...) based on priority and budget. See cost in real time. Automate the repeatable with skills.

> **Status**: per-agent chat model live. Sidebar-first IA (no header / footer chrome). v1.0 next — see [ROADMAP.md](./ROADMAP.md).

## Why

- AI sessions today are monolithic threads. Context bloats, costs blur, work blends together.
- Switching providers means switching tools. No layer compares them, balances them, or routes work intelligently.
- Local skills and workflows are locked into vendor ecosystems.

kAY.am is the missing orchestration layer.

## Mental model

```
Workspace               registered git repo
└── Session             a goal, its own worktree + branch + shared context
    ├── ContextPanel    auto-populated by the LLM after every turn
    └── Agent (n)       independent chat, own provider/model, spawned at will
```

- **Workspace** = a local git repository you registered. Sessions are scoped to it.
- **Session** = one goal. Owns the git worktree, the branch, the context panel slots, the budget. Auto-spawns one default agent on creation.
- **Agent** = an independent chat thread inside a session. Spawn as many as you want, switch between them by clicking in the sidebar. Every agent reads the same shared session context; the summarizer keeps it fresh after each turn.
- **Workflow** _(optional, beta)_ = a preset that pre-spawns N named agents (e.g. scout → planner → implementer → reviewer) at session creation. Free-form spawn always available.

## Principles

- **Local-first, local-only.** No backend. No telemetry. No data collection. Your machine, your keys, your data.
- **Provider-agnostic.** No lock-in.
- **Context is expensive.** Never send more than needed.
- **Sessions are goals, not threads.** Structure work by intent.
- **Each agent owns its chat.** Sessions only share context, not conversation history.
- **Automate the repeatable.**

See [VISION.md](./VISION.md) for the full product vision.

## Stack

- **Tauri 2** + **React 19** + **TypeScript 5** + **Vite 6**
- **Tailwind CSS v4** for styling
- **Zustand** for state
- **SQLite** for local persistence (config + transcripts only — never sent anywhere)
- Monorepo: **pnpm workspaces** + **Turborepo**

## Project structure

```
kay-am/
├── apps/desktop/     # Tauri 2 desktop app
└── packages/
    ├── ui/           # Shared React components (AppShell, Dialog, Markdown, …)
    ├── core/         # Business logic (workflows, providers, budget, context)
    ├── db/           # SQLite schema + queries
    └── types/        # Shared TypeScript types
```

## Development

### Supported providers

kAY.am orchestrates sessions through locally installed CLI tools. All three require an active subscription — kAY.am uses the subscription cap, not API tokens.

| Provider               | CLI install                                      | Required subscription   |
| ---------------------- | ------------------------------------------------ | ----------------------- |
| **Anthropic (Claude)** | `npm install -g @anthropic-ai/claude-code`       | Claude Max / Claude Pro |
| **Cursor**             | [cursor.com](https://www.cursor.com) desktop app | Cursor Pro              |
| **OpenAI (Codex)**     | `npm install -g @openai/codex`                   | ChatGPT Pro             |

Connect a provider: `<cli> /login` (Claude / Cursor) or `<cli> login` (Codex). See [docs/providers.md](./docs/providers.md) for full install, connect/disconnect, multi-account, and troubleshooting guidance.

### Prerequisites

- **Node.js** ≥ 20 and **pnpm** ≥ 9
- **Rust** toolchain (`rustup`) — required by Tauri 2; install from <https://rustup.rs>. After installing, make sure `cargo` is on your shell `PATH` — `rustup` writes the env to `$HOME/.cargo/env`, which most shells don't auto-source. Either add `source "$HOME/.cargo/env"` to your `~/.zshrc` / `~/.bashrc`, or restart your terminal after install. Verify with `cargo --version` (Tauri shells out to `cargo metadata` and will fail with `os error 2` if it's missing).
- Platform Tauri prereqs — see <https://v2.tauri.app/start/prerequisites/>
- At least one **provider CLI** on `PATH` — see [Supported providers](#supported-providers) above. The summarizer reuses the active provider's cheap-tier model via its CLI — no separate API token required.

### Quickstart

```bash
pnpm install
pnpm tauri:dev      # launches the desktop app in dev mode
```

Useful commands:

```bash
pnpm typecheck      # tsc --noEmit across the monorepo (turbo)
pnpm test           # vitest across packages
pnpm build          # vite build (frontend only)
pnpm lint           # placeholder; lint runs in CI
```

## Layout at a glance

The shell is two columns: a **floating sidebar** on the left, the **chat + context panel** on the right. There is no separate top header or bottom footer — both rolled into the sidebar.

```
┌─ floating sidebar ──┐  ┌──────────────────────────────────────┐
│ kAY.am   🔔  ⚙       │  │  ChatHeader (goal · branch · open in code) │
│ ─                    │  │                                      │
│ Workspaces           │  │                                      │
│   • app-web          │  │   Agent's chat                       │
│ ─                    │  │                                      │
│ Sessions  app-web ⇅  │  │                                      │
│   • refactor auth    │  │                                      │
│ Agents    2 agents   │  │                                      │
│   ▣ agent 1 (sel)    │  │                                      │
│   ▢ agent 2          │  │                                      │
│   + spawn agent      │  │   ┌──────────────────────┐           │
│ ─                    │  │   │ Message Claude…   ▶  │           │
│ ⓟ providers (3/3)    │  │   └──────────────────────┘           │
│ $0.20 · $1.40 total  │  │   [Claude] [Opus 4.7] [Medium]       │
└──────────────────────┘  └──────────────────────────────────────┘
                                                    ContextPanel ▸
```

- **Sidebar top**: brand, alerts bell, settings (⌘,).
- **Sidebar middle**: workspaces → sessions → agents, separated by dividers.
- **Sidebar footer**: providers connection chip, then the cost telemetry pill.
- **Right rail**: shared context panel for the current session (collapsible).

## Getting started

### 1. Boot splash → ready

Launch `pnpm tauri:dev`. Wait for the splash screen to reach _ready_.

### 2. Connect a provider

Sidebar top-right: **settings (⌘,)** → **Providers** → connect at least one of Anthropic / Cursor / Codex (see [Supported providers](#supported-providers)).

### 3. Add your first workspace

Sidebar **Workspaces** section → **add workspace…** → pick a local git repo. kAY.am runs every session inside an isolated worktree alongside the repo.

### 4. Create your first session

Sidebar **Sessions** section → **add session** → set a goal (e.g. "Refactor auth domain"), tweak the branch prefix, optionally pick a **workflow** (beta) to pre-spawn role-named agents.

A default **agent 1** is auto-spawned when the session is created — the chat is immediately ready.

### 5. First turn

The chat is the central pane. Type a message → enter. You'll see streamed assistant text in agent 1's transcript, the cost meter ticking in the sidebar footer, and a `worktree-{slug}` directory created next to your repo root.

### 6. Spawn another agent

Sidebar **Agents** block → **+ spawn agent** → either pick `+ free agent` (no role) or one of the workflow steps if a workflow is attached.

The new agent gets its own empty chat. Click any agent in the sidebar to switch the chat view to that agent's history. The right-side context panel stays the same — it's shared across all agents in the session and auto-populated by the LLM after each turn.

Hover an agent row and click the **pencil** icon to rename it inline.

### 7. Open the worktree in your editor

`Open in code` button in the chat header opens the active worktree in your default editor. If you have multiple editors detected, pick from the dropdown.

### 8. Monitor cost + alerts

Sidebar footer shows the providers chip (one dot per provider, color-coded) and the telemetry pill (`$session · $workspace`). Click the pill for a per-model breakdown.

The **bell icon** in the sidebar top opens the notification center for budget thresholds and other warnings.

### 9. Archive or end the session

Sidebar kebab menu → **archive** moves a session out of the active list (still inspectable under "archived"). **⌘.** ends the active session and cleans up the worktree while preserving the branch.

## Settings

Two scopes:

- **Global** (sidebar top → ⚙) — App / Providers / Budget / Agent / Github / Advanced / Initialization. Beta chips mark sections whose behaviour is not yet validated. **Initialization → Wipe local database** drops every workspace / session / agent / message in `~/.kay-am/data.db` and re-runs migrations on next boot. API keys in the OS keychain are not touched.
- **Per-workspace** (workspace row → ⚙ icon on hover) — General (branch prefix), Skills, Workflows (beta). Per-workspace settings stay scoped — the global dialog never shows them.

## Roadmap & contributing

- [ROADMAP.md](./ROADMAP.md) — milestones and the active issue list
- [CONVENTIONS.md](./CONVENTIONS.md) — monorepo conventions
- [CLAUDE.md](./CLAUDE.md) — project rules (also enforced via `lefthook` + `commitlint` on commit)

- Conventional commits (`type(scope): subject`), all-lowercase subjects.
- Branch protection on `main`. PR-only.

## License

[MIT](./LICENSE) © Amin Khayam
