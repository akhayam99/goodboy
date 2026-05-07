# kAY.am — Roadmap

Local-first AI workspace orchestrator. This roadmap tracks the path from bootstrap to v1.0. Each version is a GitHub milestone; issues are created only as they approach implementation.

> **Status**: v0.1 in planning. Foundation, scaffold, and conventions in place.

## Architectural decisions (locked)

These are the non-negotiable choices that frame all of v0.1 and constrain later versions.

1. **Provider integration via headless CLI spawn** — `claude -p "<prompt>" --output-format stream-json --working-dir <worktree> --dangerously-skip-permissions`. The user's existing subscription (Claude Max, Cursor Pro, ChatGPT Pro) is consumed via the official provider CLI. Anthropic / OpenAI / Cursor SDKs are explicitly NOT used in v0.1 — they require per-token billing and would defeat the "spend less" mission.
2. **kAY.am owns the conversation** — history lives in our SQLite, not in `~/.claude/projects/`. Every turn is reconstructed from the synthetic context plus the new user message; we never rely on `--resume`. This is what makes context portable across providers.
3. **Synthetic context = hybrid structured slots** — fixed slots (`goal`, `files_touched`, `decisions`, `open_questions`, `last_output_summary`), editable by hand at any time, auto-updated post-turn by a cheap summarizer (active provider's cheap-tier model via CLI — no separate API key required, runs against the user's existing subscription).
4. **Isolation = git worktree per session** — branch prefix configurable per workspace (default `kay`). Worktree is the sandbox that makes `--dangerously-skip-permissions` acceptable in v0.1.
5. **Provider scope, phased** — v0.1 ships with Claude only behind a stable adapter interface; v0.2 adds Cursor + Codex together to stress-test the contract on two new adapters at once.
6. **Permission model v0.1** — `--dangerously-skip-permissions` ON, contained by the worktree sandbox. Permission proxy (intercept tool-calls → UI approve/deny) lands in v0.6 once we know what real usage demands.
7. **Stack (already scaffolded)** — Tauri 2 + React 19 + TypeScript 5 strict + Vite 6 + Tailwind v4 + Zustand + SQLite. Monorepo via pnpm workspaces + Turborepo. See [CLAUDE.md](./CLAUDE.md) and [CONVENTIONS.md](./CONVENTIONS.md).

Full design spec: see the conversation that produced this roadmap. Architectural decisions are restated here so the doc stands alone.

---

## Milestones

### v0.1 — MVP: single-provider session in a worktree, with synthetic context skeleton and live telemetry

**Goal**: end-to-end usable Claude session inside a kAY.am-managed worktree, with editable synthetic context and visible token/cost spend.

**In scope**

- Workspace registration (multiple repos, persisted in SQLite)
- Session lifecycle (draft → starting → idle ↔ running → ended; error recoverable)
- Auto worktree creation on session start, cleanup on end (branch preserved)
- Provider CLI detection at boot
- Chat UI with stream-rendered TurnEvents (assistant text, tool-use cards, file edit cards, usage)
- Synthetic context engine + cheap-tier summarizer via active provider CLI (auto slot update post-turn)
- Telemetry: per-turn / per-session / per-workspace token + USD cost
- Persistence of workspaces, sessions, messages, slots, telemetry, settings
- Open-in-VS-Code button on session
- Resume across app restart
- CI: lint + typecheck + test + build + audit
- ROADMAP + README updates

**Out of scope (deferred)**

- Cursor / Codex adapters (v0.2)
- Multi-agent of any kind (v0.4 sequential, v0.7 parallel)
- Budget rules and auto-routing (v0.3)
- Skills (v0.5)
- Permission proxy (v0.6)
- Rich diff preview, file-specific editor open, alternative editors
- Cross-workspace search
- Signed binary distribution (v1.0)

**Estimated effort**: 1–2 weeks of guided sessions (code written by Claude under user direction, parallelized across worktrees on independent branches).

[v0.1 milestone on GitHub](https://github.com/akhayam99/kay-am/milestone/1)

### v0.2 — Multi-provider

Cursor + Codex adapters delivered together, capability matrix per provider, provider preferences per session (default + per-turn override).

[v0.2 milestone](https://github.com/akhayam99/kay-am/milestone/2)

### v0.3 — Budget & routing

Per-provider monthly cap, per-session soft cap, automatic fallback when soft cap hit, threshold alerts. Foundations for the "balance" half of the orchestrator.

[v0.3 milestone](https://github.com/akhayam99/kay-am/milestone/3)

### v0.4 — Multi-agent sequential

Declared phases inside a session (e.g. planner → coder → reviewer). Each phase spawns its own agent, synthetic context flows between phases.

[v0.4 milestone](https://github.com/akhayam99/kay-am/milestone/4)

### v0.5 — Skills

Local registry of skills (markdown + scripts), invocable from chat via slash commands, executable across providers.

[v0.5 milestone](https://github.com/akhayam99/kay-am/milestone/5)

### v0.6 — Permission proxy

Intercept tool-call requests from the agent, surface them in the kAY.am UI for explicit approval, return the decision to the agent. Removes `--dangerously-skip-permissions`.

[v0.6 milestone](https://github.com/akhayam99/kay-am/milestone/6)

### v0.7 — Multi-agent parallel (experimental)

Multiple agents inside a single session, each on its own worktree, coordinating via shared synthetic context.

[v0.7 milestone](https://github.com/akhayam99/kay-am/milestone/7)

### v1.0 — Stable release

Signed binary distribution (macOS, Windows, Linux), full user docs, demo video.

[v1.0 milestone](https://github.com/akhayam99/kay-am/milestone/8)

---

## v0.1 issue index

Issues grouped by layer. Critical path runs left-to-right inside each chain.

### Foundation (parallelizable)

- [#1 — feat(types): define core domain types](https://github.com/akhayam99/kay-am/issues/1)
- [#2 — feat(types): define provider adapter contract](https://github.com/akhayam99/kay-am/issues/2) — depends on #1
- [#3 — feat(db): sqlite schema + migration runner](https://github.com/akhayam99/kay-am/issues/3) — depends on #1
- [#4 — chore(repo): setup ci pipeline](https://github.com/akhayam99/kay-am/issues/4)

### Core layer

- [#5 — feat(core): worktree manager](https://github.com/akhayam99/kay-am/issues/5) — depends on #1
- [#6 — feat(core): claude provider adapter](https://github.com/akhayam99/kay-am/issues/6) — depends on #2, #5
- [#7 — feat(core): synthetic context engine](https://github.com/akhayam99/kay-am/issues/7) — depends on #1, #3
- [#8 — feat(core): summarizer client (anthropic haiku)](https://github.com/akhayam99/kay-am/issues/8) — depends on #7
- [#9 — feat(core): session lifecycle reducer](https://github.com/akhayam99/kay-am/issues/9) — depends on #1, #2
- [#10 — feat(core): telemetry recorder](https://github.com/akhayam99/kay-am/issues/10) — depends on #3

### Tauri commands

- [#11 — feat(desktop): tauri db commands](https://github.com/akhayam99/kay-am/issues/11) — depends on #3
- [#12 — feat(desktop): tauri worktree commands](https://github.com/akhayam99/kay-am/issues/12) — depends on #5
- [#13 — feat(desktop): tauri spawn command + event stream](https://github.com/akhayam99/kay-am/issues/13) — depends on #6
- [#14 — feat(desktop): secret store via keyring](https://github.com/akhayam99/kay-am/issues/14)
- [#15 — feat(desktop): provider cli detection on startup](https://github.com/akhayam99/kay-am/issues/15) — depends on #6
- [#16 — feat(desktop): open in vscode command](https://github.com/akhayam99/kay-am/issues/16)

### UI

- [#17 — feat(ui): design system primitives + light theme](https://github.com/akhayam99/kay-am/issues/17)
- [#18 — feat(desktop): zustand store + state wiring](https://github.com/akhayam99/kay-am/issues/18) — depends on #11
- [#19 — feat(desktop): workspace selector + picker](https://github.com/akhayam99/kay-am/issues/19) — depends on #17, #18
- [#20 — feat(desktop): sessions sidebar + new session dialog](https://github.com/akhayam99/kay-am/issues/20) — depends on #17, #18, #12
- [#21 — feat(desktop): chat view with stream renderer](https://github.com/akhayam99/kay-am/issues/21) — depends on #17, #13, #18
- [#22 — feat(desktop): chat input + send turn](https://github.com/akhayam99/kay-am/issues/22) — depends on #21, #9
- [#23 — feat(desktop): context panel with editable slots](https://github.com/akhayam99/kay-am/issues/23) — depends on #17, #7, #18
- [#24 — feat(desktop): telemetry pill + breakdown](https://github.com/akhayam99/kay-am/issues/24) — depends on #17, #10, #18
- [#25 — feat(desktop): settings panel](https://github.com/akhayam99/kay-am/issues/25) — depends on #14, #17

### Integration & polish

- [#26 — feat(desktop): end-session flow + worktree cleanup](https://github.com/akhayam99/kay-am/issues/26) — depends on #12, #20
- [#27 — feat(desktop): app startup boot sequence](https://github.com/akhayam99/kay-am/issues/27) — depends on #11, #14, #15
- [#28 — feat(desktop): "open in vscode" button on session](https://github.com/akhayam99/kay-am/issues/28) — depends on #16, #20
- [#29 — test(core): integration tests claude adapter contract](https://github.com/akhayam99/kay-am/issues/29) — depends on #6
- [#30 — test(core): synthetic context engine round-trip](https://github.com/akhayam99/kay-am/issues/30) — depends on #7, #8
- [#31 — docs(repo): create ROADMAP.md](https://github.com/akhayam99/kay-am/issues/31)
- [#32 — docs(repo): update README with development quickstart](https://github.com/akhayam99/kay-am/issues/32)

### Demoable internal milestone

After #1, #2, #3, #5, #6, #11, #12, #13, #17, #18, #20, #21, #22 (≈ 40% of v0.1) we can: open a session, send a message to Claude inside a worktree, see the response. No synthetic context, no telemetry — but enough to dogfood and validate the spawn pipeline.

### Critical path

```
#1 → #2 → #6 → #13 → #21 → #22  →  demo turn ok
            ↘ #5 → #12 → #20 ↗
#1 → #3 → #11 → #18 → general ui
       ↘ #7 → #8 → #23
            ↘ #10 → #24
```

---

## v0.2 issue index

Cursor + Codex adapters, summarizer refactor (drop API-key path → use active-provider CLI), provider connection UX.

### Foundation (parallelizable)

- [#66 — feat(types): provider registry + capability matrix types](https://github.com/akhayam99/kay-am/issues/66)
- [#67 — feat(types): session provider preference types](https://github.com/akhayam99/kay-am/issues/67) — depends on #66

### Core layer

- [#68 — feat(core): cursor adapter (CLI spawn + stream parse)](https://github.com/akhayam99/kay-am/issues/68) — depends on #66
- [#69 — feat(core): codex adapter (CLI spawn + stream parse)](https://github.com/akhayam99/kay-am/issues/69) — depends on #66
- [#70 — feat(core): provider registry (unified factory)](https://github.com/akhayam99/kay-am/issues/70) — depends on #66, #68, #69
- [#71 — refactor(core): summarizer uses active-provider CLI (drop ANTHROPIC_API_KEY)](https://github.com/akhayam99/kay-am/issues/71) — depends on #70

### Tauri commands

- [#72 — feat(desktop): detect cursor + codex binaries (rust)](https://github.com/akhayam99/kay-am/issues/72)
- [#73 — feat(desktop): provider auth state check (rust)](https://github.com/akhayam99/kay-am/issues/73) — depends on #72
- [#74 — feat(desktop): provider connect (open external terminal with login command)](https://github.com/akhayam99/kay-am/issues/74) — depends on #72

### UI

- [#75 — feat(desktop): provider panel in Settings (detect/install/connect/logout)](https://github.com/akhayam99/kay-am/issues/75) — depends on #72, #73, #74
- [#76 — feat(desktop): per-session provider preference picker](https://github.com/akhayam99/kay-am/issues/76) — depends on #67, #70, #75
- [#77 — feat(desktop): per-turn provider override](https://github.com/akhayam99/kay-am/issues/77) — depends on #76
- [#79 — feat(desktop): pre-flight auth check + guided error on turn](https://github.com/akhayam99/kay-am/issues/79) — depends on #73, #75
- [#80 — feat(desktop): UX/UI restyle (layout reorg + design tokens + polish)](https://github.com/akhayam99/kay-am/issues/80)

### Docs

- [#78 — docs(repo): provider integration guide](https://github.com/akhayam99/kay-am/issues/78) — depends on #74, #75

### Critical path

```
#66 → #68 → #70 → #71  →  summarizer migrated, anthropic-key gone
       ↘ #69 ↗
#66 → #67 → #76 → #77  →  per-session + per-turn provider choice
#72 → #73 → #75
        ↘ #74 ↗
```

---

## How to read this roadmap

- One issue ≈ 1–4 hours of focused implementation work.
- Each issue has its own dependencies declared in the body. The chains above are the headline view.
- Where two chains are independent, they run in parallel — different branches, different worktrees.
- New issues created during implementation are appended to the v0.1 milestone if they belong to the MVP, otherwise they target the appropriate later milestone.

See [CONVENTIONS.md](./CONVENTIONS.md) for branch / commit / PR conventions and [CLAUDE.md](./CLAUDE.md) for code rules.
