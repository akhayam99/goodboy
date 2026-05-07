# kAY.am

**AI workspace orchestrator. Local-first. Provider-agnostic.**

kAY.am sits between you and your AI agents. It doesn't replace your editor or your terminal — it commands them.

Manage macro sessions. Route work across providers (Anthropic, OpenAI, Cursor, ...) based on priority and budget. Get real-time visibility on tokens and cost. Automate the repeatable with skills.

> **Status**: v0.7 complete. Experimental parallel multi-agent mode available (enable via `experimental.enable_parallel_agents` in settings). v1.0 next.

## Why

- AI sessions today are monolithic threads. Context bloats, costs blur, work blends together.
- Switching providers means switching tools. No layer compares them, balances them, or routes work intelligently.
- Local skills and workflows are locked into vendor ecosystems.

kAY.am is the missing orchestration layer.

## Principles

- **Local-first, local-only.** No backend. No telemetry. No data collection. Your machine, your keys, your data.
- **Provider-agnostic.** No lock-in.
- **Context is expensive.** Never send more than needed.
- **Sessions are goals, not threads.** Structure work by intent.
- **Automate the repeatable.**

See [VISION.md](./VISION.md) for the full product vision.

## Stack

- **Tauri 2** + **React 19** + **TypeScript 5** + **Vite 6**
- **Tailwind CSS v4** for styling
- **Zustand** for state
- **SQLite** for local persistence (config only — no conversation data)
- Monorepo: **pnpm workspaces** + **Turborepo**

## Project structure

```
kay-am/
├── apps/desktop/     # Tauri 2 desktop app
├── packages/
│   ├── ui/           # Shared React components
│   ├── core/         # Business logic
│   ├── db/           # SQLite schema + queries
│   └── types/        # Shared TypeScript types
└── scripts/
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
- At least one **provider CLI** on `PATH` — see [Supported providers](#supported-providers) above
- An **Anthropic API key** if you want to exercise the summarizer (configurable from in-app settings, stored in the OS keychain)

### Quickstart

```bash
pnpm install
pnpm tauri:dev      # launches the desktop app in dev mode (root alias for the desktop workspace)
```

Useful commands:

```bash
pnpm typecheck      # tsc --noEmit across the monorepo (turbo)
pnpm test           # vitest across packages
pnpm build          # vite build (frontend only)
pnpm lint           # placeholder; lint runs in CI
```

### Smoke test a session end-to-end

1. Run `pnpm tauri:dev` and wait for the boot splash to reach _ready_.
2. Open **settings** (top-right) → paste your **Anthropic API key**, set the **default editor binary** (e.g. `code`), save.
3. From the workspace dropdown choose **add workspace…** and pick a local git repository (an existing one is fine — sessions run inside isolated git worktrees).
4. From the left sidebar, click **+ new session**, give it a goal, accept the branch prefix.
5. Type a message in the chat input → enter. You should see streamed assistant text, the cost meter ticking, and the `worktree-{slug}` directory created next to the repo.
6. Use **end session** to close the worktree (the branch is preserved for manual merge).

If the **claude cli missing** banner shows in the header, install the Claude CLI and reopen the app. If **api key missing** shows, click it to jump back into settings.

## Roadmap & contributing

- [ROADMAP.md](./ROADMAP.md) — milestones and the active issue list
- [CONVENTIONS.md](./CONVENTIONS.md) — monorepo conventions
- [CLAUDE.md](./CLAUDE.md) — project rules (also enforced via `lefthook` + `commitlint` on commit)

- Conventional commits (`type(scope): subject`), all-lowercase subjects.
- Branch protection on `main`. PR-only.

## License

[MIT](./LICENSE) © Amin Khayam
