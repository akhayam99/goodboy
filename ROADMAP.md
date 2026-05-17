# kAY.am — Roadmap

Local-first AI workspace orchestrator. This roadmap tracks the path from bootstrap to v1.0. Each version is a GitHub milestone; issues live there.

> **Status**: post-v0.7 sprint complete (PRs #501–#569). Domain rename shipped. GitHub panel, plans, agent kinds, next-actions, diff viewer, notifications, session status all live. **v1.0 next.**

## Architectural decisions (locked)

Non-negotiable choices that frame the product. Numbers preserved for cross-references.

1. **Provider integration via headless CLI spawn** — `claude -p "<prompt>" --output-format stream-json --working-dir <worktree>`. The user's existing subscription (Claude Max, Cursor Pro, ChatGPT Pro) is consumed via the official provider CLI. Anthropic / OpenAI / Cursor SDKs are explicitly NOT used — they require per-token billing and would defeat the "spend less" mission.
2. **kAY.am owns the conversation** — history lives in our SQLite, not in `~/.claude/projects/`. Every turn is reconstructed from the synthetic context plus the new user message; we never rely on `--resume`. This is what makes context portable across providers.
3. **Synthetic context = hybrid structured slots** — fixed slots (`goal`, `files_touched`, `decisions`, `open_questions`, `last_output_summary`), editable by hand at any time, auto-updated post-turn by a cheap summarizer (active provider's cheap-tier model via CLI — no separate API key required, runs against the user's existing subscription).
4. **Isolation = git worktree per session** — branch prefix configurable per workspace (default `kay`). Worktree is the sandbox in which agents operate.
5. **Provider scope, phased** — v0.1 shipped with Claude only behind a stable adapter interface; v0.2 added Cursor + Codex together to stress-test the contract on two new adapters at once.
6. **Permission proxy** — landed in v0.6 for Claude (intercept tool-calls → UI approve/deny). Cursor + Codex coverage tracked for v1.0.
7. **Stack** — Tauri 2 + React 19 + TypeScript 5 strict + Vite 6 + Tailwind v4 + Zustand 5 + SQLite. Monorepo via pnpm 10 workspaces + Turborepo. See [CLAUDE.md](./CLAUDE.md) and [CONVENTIONS.md](./CONVENTIONS.md).
8. **Domain model = workspace > session > agent (n)** — sessions own a goal, a worktree, and a shared context panel. Agents are independent chat threads inside a session, spawned at will from the sidebar; they share the session's context but each owns its own message history. DB tables match the domain: `sessions`, `agents`. Types: `Session`/`SessionId`, `Agent`/`AgentId`. Full rename completed in m031 (PR #564).

---

## Completed milestones

### v0.1 — MVP

Single-provider session with synthetic context and live telemetry. End-to-end Claude session inside a kAY.am-managed worktree.

[v0.1 milestone](https://github.com/akhayam99/kay-am/milestone/1)

### v0.2 — Multi-provider

Cursor + Codex adapters, capability matrix, provider connection UX, summarizer migrated to active-provider CLI.

[v0.2 milestone](https://github.com/akhayam99/kay-am/milestone/2)

### v0.3 — Budget & routing

Per-provider monthly cap, per-session soft cap, automatic fallback when cap hit, threshold alerts, routing engine wired into turn flow.

[v0.3 milestone](https://github.com/akhayam99/kay-am/milestone/3)

### v0.4 — Multi-agent sequential

Declared phases inside a session. Each phase spawns its own agent; synthetic context flows between phases.

[v0.4 milestone](https://github.com/akhayam99/kay-am/milestone/4)

### v0.5 — Skills

Local skill registry (markdown + scripts), slash-command invocation from chat, executable across providers.

[v0.5 milestone](https://github.com/akhayam99/kay-am/milestone/5)

### v0.6 — Permission proxy

Tool-call interception via static rules + audit for Claude. `--dangerously-skip-permissions` removed.

[v0.6 milestone](https://github.com/akhayam99/kay-am/milestone/6)

### v0.7 — Multi-agent parallel

Multiple agents inside a single session on throwaway worktrees, coordinating via shared context. Fan-out / fan-in with merge conflict UI.

[v0.7 milestone](https://github.com/akhayam99/kay-am/milestone/7)

### pre-1.0 — UX polish

Design tokens, typography scale, motion language, empty/loading/error states, sidebar mega, settings IA split, a11y baseline, config export/import, settings inheritance resolver.

---

## Post-v0.7 sprint (PRs #501–#569)

Major sprint bridging v0.7 → v1.0. Shipped in ~2 weeks.

### Domain & DB

- Full domain rename: `tasks` → `sessions`, `sessions` → `agents` in DB tables, columns, types, queries (m031, PR #564)
- Soft-delete + archive (`deletedAt`, `archivedAt`) across sessions and agents
- Per-agent persisted state: model, provider, effort, verbosity, kind (PR #548)
- Session user-status: wip / waiting / blocked / done (m032, PR #565)

### GitHub integration

- GitHub panel with PR state, CI checks, comments, review decisions, linked issues (PR #539, #562)
- Auto-refresh GitHub card when agent creates a PR (PR #547)
- Diff comment tracking consumed by reviewer agent (PR #557)
- Git-aware diff view selector in files-touched modal (PR #556)

### Plans

- Session plans as first-class artifact via `<<plan>>` markers (PR #535)
- Plan consumption history with modal management (PR #561)
- Plan panel tree rendering + files-touched default view (PR #569)

### Agent intelligence

- 8 agent kinds with default model/effort/system-prompt: scout, planner, implementer, debugger, tester, reviewer, docs, generic
- Auto-label agent chips from first user turn (PR #536)
- Auto-name agent on first command (PR #544)
- Next-actions trio: scout / plan / implement (PR #540)
- Suggest lighter model on light first turn (PR #538)
- Per-agent input draft isolation (PR #546)

### UX & stability

- Always-visible session row status icons (PR #553)
- Unread agent indicator across sidebar hierarchy (PR #560)
- Collapsible context panel slots (PR #563)
- Context slots rendered as markdown (PR #531)
- Notification system: toasts + persistent feed (PR #475)
- Error boundary (PR #510)
- Instant session switch with per-block skeletons (PR #555)
- Pulse halo on running agent indicator (PR #549)
- Sidebar agent row redesign (PR #554)

### Codebase health

- Feature-toggle map replacing stub flows (PR #551)
- Dead-code sweep via knip (PR #497, #503)
- a11y baseline: icon-button labels, img alt, focus (PR #512)
- Copy polish: CTA casing, typos, tone alignment (PR #514)
- Domain feature structure refactor (ADR 0004 + 0006, PR #568)

---

## v1.0 — Stable release

Signed binary distribution and everything needed for a public launch.

**Distribution**:

- Signed macOS (.dmg), Windows (.msi), Linux (.AppImage) binaries
- Auto-update mechanism
- App Store / notarization where applicable

**Documentation**:

- Full user documentation (getting started, concepts, workflows)
- Demo video / product walkthrough

**Features (remaining)**:

- Historical telemetry view: spend over time, broken down by provider/model/session
- Provider efficiency comparison: cost-per-task across providers
- Cross-workspace search
- Cursor + Codex permission proxy parity (currently Claude-only)
- Command palette (⌘K) polish

[v1.0 milestone](https://github.com/akhayam99/kay-am/milestone/8)

---

## How to read this roadmap

- One issue ≈ 1–4 hours of focused implementation work.
- Where two chains are independent, they run in parallel — different branches, different worktrees.
- Issues live on the GitHub milestone, not in this file. This doc tracks the big picture.

See [CONVENTIONS.md](./CONVENTIONS.md) for branch / commit / PR conventions and [CLAUDE.md](./CLAUDE.md) for code rules.
