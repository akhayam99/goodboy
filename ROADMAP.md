# kAY.am — Roadmap

Local-first AI workspace orchestrator. This roadmap tracks the path from bootstrap to v1.0. Each version is a GitHub milestone; issues are created only as they approach implementation.

> **Status**: v0.7 complete. pre-1.0 UX polish complete. **per-agent chat model live** (workspace > session > agent (n), shared context). Sidebar-first IA shipped (no header/footer chrome). v1.0 next.

## Architectural decisions (locked)

These are the non-negotiable choices that frame the product. Numbers preserved for cross-references in old issues.

1. **Provider integration via headless CLI spawn** — `claude -p "<prompt>" --output-format stream-json --working-dir <worktree>`. The user's existing subscription (Claude Max, Cursor Pro, ChatGPT Pro) is consumed via the official provider CLI. Anthropic / OpenAI / Cursor SDKs are explicitly NOT used — they require per-token billing and would defeat the "spend less" mission.
2. **kAY.am owns the conversation** — history lives in our SQLite, not in `~/.claude/projects/`. Every turn is reconstructed from the synthetic context plus the new user message; we never rely on `--resume`. This is what makes context portable across providers.
3. **Synthetic context = hybrid structured slots** — fixed slots (`goal`, `files_touched`, `decisions`, `open_questions`, `last_output_summary`), editable by hand at any time, auto-updated post-turn by a cheap summarizer (active provider's cheap-tier model via CLI — no separate API key required, runs against the user's existing subscription).
4. **Isolation = git worktree per session** — branch prefix configurable per workspace (default `kay`). Worktree is the sandbox in which agents operate.
5. **Provider scope, phased** — v0.1 ships with Claude only behind a stable adapter interface; v0.2 adds Cursor + Codex together to stress-test the contract on two new adapters at once.
6. **Permission proxy** — landed in v0.6 for Claude (intercept tool-calls → UI approve/deny). Cursor + Codex coverage tracked in later milestones.
7. **Stack (already scaffolded)** — Tauri 2 + React 19 + TypeScript 5 strict + Vite 6 + Tailwind v4 + Zustand + SQLite. Monorepo via pnpm workspaces + Turborepo. See [CLAUDE.md](./CLAUDE.md) and [CONVENTIONS.md](./CONVENTIONS.md).
8. **Domain model = workspace > session > agent (n)** _(introduced post-v0.7)_ — sessions own a goal, a worktree, and a shared context panel. Agents are independent chat threads inside a session, spawned at will from the sidebar; they share the session's context but each owns its own message history. Workflows became an optional preset that pre-spawns N named agents at session creation, not a load-bearing concept. DB tables `tasks` (session) and `sessions` (agent) keep their legacy names; types still expose `Task` / `Session` to avoid a cascading rename.

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

### v0.7 — Multi-agent parallel (experimental) ✓

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

## v0.3 issue index

Budget rules, routing engine, threshold alerts, and integration into the live turn flow.

### Foundation

- [#99 — feat(types): budget & routing domain types](https://github.com/akhayam99/kay-am/issues/99)
- [#100 — feat(db): budget tables migration](https://github.com/akhayam99/kay-am/issues/100) — depends on #99

### Core layer

- [#101 — feat(core): budget checker](https://github.com/akhayam99/kay-am/issues/101) — depends on #100
- [#102 — feat(core): routing engine](https://github.com/akhayam99/kay-am/issues/102) — depends on #101
- [#103 — feat(core): threshold alert emitter](https://github.com/akhayam99/kay-am/issues/103) — depends on #100

### Tauri commands

- [#104 — feat(desktop): budget CRUD tauri commands](https://github.com/akhayam99/kay-am/issues/104) — depends on #100
- [#105 — feat(desktop): routing tauri command](https://github.com/akhayam99/kay-am/issues/105) — depends on #102

### UI

- [#106 — feat(desktop): budget rules panel in settings](https://github.com/akhayam99/kay-am/issues/106) — depends on #104
- [#107 — feat(desktop): session soft cap in new-session dialog](https://github.com/akhayam99/kay-am/issues/107) — depends on #104
- [#108 — feat(desktop): routing indicator on chat input](https://github.com/akhayam99/kay-am/issues/108) — depends on #105
- [#109 — feat(desktop): budget alert toasts](https://github.com/akhayam99/kay-am/issues/109) — depends on #103
- [#110 — feat(desktop): provider spend breakdown in telemetry pill](https://github.com/akhayam99/kay-am/issues/110)

### Integration

- [#111 — feat(desktop): wire routing engine into sendTurn](https://github.com/akhayam99/kay-am/issues/111) — depends on #102, #105, #108
- [#112 — test(core): budget & routing tests](https://github.com/akhayam99/kay-am/issues/112)

### Critical path

```
#99 → #100 → #101 → #102 → #105 → #111  →  routing live
              ↘ #103 → #109
       ↘ #104 → #106
              ↘ #107
#102 → #105 → #108 → #111
```

---

## v0.4 issue index

Multi-agent sequential: declared phases inside a session, each phase spawns its own agent, synthetic context flows between phases.

### Foundation

- [#150 — feat(types): phase domain types](https://github.com/akhayam99/kay-am/issues/150)
- [#151 — feat(db): m007 phase tables migration](https://github.com/akhayam99/kay-am/issues/151) — depends on #150

### Core layer

- [#152 — feat(core): phase sequencer (nextPhase, buildPhasePrompt, isPhaseSequenceComplete)](https://github.com/akhayam99/kay-am/issues/152) — depends on #150
- [#153 — feat(core): phase context propagator](https://github.com/akhayam99/kay-am/issues/153) — depends on #150
- [#154 — feat(core): phase registry (node-only)](https://github.com/akhayam99/kay-am/issues/154) — depends on #151

### Tauri commands

- [#155 — feat(desktop): phase template tauri commands](https://github.com/akhayam99/kay-am/issues/155) — depends on #154
- [#156 — feat(desktop): phase run tauri commands](https://github.com/akhayam99/kay-am/issues/156) — depends on #151

### UI

- [#157 — feat(desktop): phases panel in settings](https://github.com/akhayam99/kay-am/issues/157) — depends on #155
- [#158 — feat(desktop): phase template picker in new-session dialog](https://github.com/akhayam99/kay-am/issues/158) — depends on #155
- [#159 — feat(desktop): phase progress pill in chat header](https://github.com/akhayam99/kay-am/issues/159) — depends on #156
- [#160 — feat(desktop): phase_transition turn event + transcript card](https://github.com/akhayam99/kay-am/issues/160) — depends on #150

### Integration

- [#161 — feat(desktop): wire phase sequencer into sendTurn](https://github.com/akhayam99/kay-am/issues/161) — depends on #152, #153, #156, #160
- [#162 — test(core): phase orchestration tests + barrel sanity](https://github.com/akhayam99/kay-am/issues/162) — depends on #152, #153

### Critical path

```
#150 → #151 → #154 → #155 → #157 → #161
              ↘ #156 → #159 → #161
       ↘ #152 → #161
       ↘ #153 → #161
       ↘ #160 → #161
```

---

## v0.5 issue index

Skills: local registry of markdown + scripts, invocable via slash commands, executable across providers.

### Foundation

- [#126 — feat(types): skill domain types](https://github.com/akhayam99/kay-am/issues/126)
- [#127 — feat(db): m006 skills table migration](https://github.com/akhayam99/kay-am/issues/127) — depends on #126

### Core layer

- [#128 — feat(core): slash-command parser](https://github.com/akhayam99/kay-am/issues/128) — depends on #126
- [#129 — feat(core): skill markdown parser](https://github.com/akhayam99/kay-am/issues/129) — depends on #126
- [#130 — feat(core): skill executor](https://github.com/akhayam99/kay-am/issues/130) — depends on #129
- [#131 — feat(core): skill registry](https://github.com/akhayam99/kay-am/issues/131) — depends on #129, #127

### Tauri commands

- [#132 — feat(desktop): skill CRUD tauri commands](https://github.com/akhayam99/kay-am/issues/132) — depends on #131
- [#133 — feat(desktop): skill invoke tauri command](https://github.com/akhayam99/kay-am/issues/133) — depends on #130

### UI

- [#134 — feat(desktop): slash command autocomplete in chat input](https://github.com/akhayam99/kay-am/issues/134) — depends on #132, #128
- [#135 — feat(desktop): skill invocation card in transcript](https://github.com/akhayam99/kay-am/issues/135) — depends on #126
- [#136 — feat(desktop): skill manager in settings](https://github.com/akhayam99/kay-am/issues/136) — depends on #132

### Integration

- [#137 — feat(desktop): wire skill invoke into sendTurn](https://github.com/akhayam99/kay-am/issues/137) — depends on #133, #135, #128
- [#138 — test(core): skill parser + executor tests](https://github.com/akhayam99/kay-am/issues/138) — depends on #129, #130, #128

### Critical path

```
#126 → #129 → #131 → #132 → #136
              ↘ #130 → #133 → #137
#126 → #128 → #134 → #137
#126 → #127 → #131
#126 → #135 → #137
```

---

## v0.6 issue index

Permission proxy: tool-call interception via static rules + audit, removing `--dangerously-skip-permissions` for claude.

### Foundation (parallelizable)

- [#170 — feat(types): permission domain types](https://github.com/akhayam99/kay-am/issues/170)
- [#171 — feat(db): m008 permissions migration](https://github.com/akhayam99/kay-am/issues/171) — depends on #170

### Core layer

- [#172 — feat(core): permission engine](https://github.com/akhayam99/kay-am/issues/172) — depends on #170
- [#173 — feat(core): tool matcher patterns](https://github.com/akhayam99/kay-am/issues/173) — depends on #170
- [#174 — feat(core): permission audit recorder](https://github.com/akhayam99/kay-am/issues/174) — depends on #171
- [#175 — feat(core): permission rules → claude CLI flags](https://github.com/akhayam99/kay-am/issues/175) — depends on #173

### Tauri commands

- [#176 — feat(desktop): permission rule CRUD tauri commands](https://github.com/akhayam99/kay-am/issues/176) — depends on #171
- [#177 — feat(desktop): permission audit log tauri commands](https://github.com/akhayam99/kay-am/issues/177) — depends on #174

### UI

- [#179 — feat(ui): permissions settings panel](https://github.com/akhayam99/kay-am/issues/179) — depends on #176
- [#180 — feat(ui): permission audit log viewer](https://github.com/akhayam99/kay-am/issues/180) — depends on #177
- [#181 — feat(ui): pre-flight permission summary in chat input](https://github.com/akhayam99/kay-am/issues/181) — depends on #175
- [#182 — feat(ui): provider support indicator (cursor/codex limitation)](https://github.com/akhayam99/kay-am/issues/182) — depends on #176

### Integration

- [#178 — feat(desktop): wire permission flags into turn_spawn (rust)](https://github.com/akhayam99/kay-am/issues/178) — depends on #175
- [#183 — feat(desktop): wire permission engine into sendTurn](https://github.com/akhayam99/kay-am/issues/183) — depends on #172, #175, #178
- [#184 — feat(desktop): persist tool-call → audit on stream events](https://github.com/akhayam99/kay-am/issues/184) — depends on #174, #183
- [#186 — test(core): permission engine + matcher contract tests](https://github.com/akhayam99/kay-am/issues/186) — depends on #172, #173, #175
- [#187 — test(desktop): permission proxy integration smoke](https://github.com/akhayam99/kay-am/issues/187) — depends on #183
- [#188 — feat(desktop): roadmap + docs update + integration glue](https://github.com/akhayam99/kay-am/issues/188) — depends on #183, #184, #186, #187

### Stretch (deferred)

- [#185 — feat(types/core): permission_request + permission_decision TurnEvent (MCP path)](https://github.com/akhayam99/kay-am/issues/185) → slipped to v0.7

### Critical path

```
#170 → #171 → #176 → #179 → #183 → #188
       #172 → #183
       #173 → #175 → #178 → #183
                  ↘ #181
       #174 → #177 → #180
                  ↘ #184 → #188
       #186 + #187 → #188
```

---

## v0.7 issue index

Consolidation (parte A — hardening + carryover from v0.6):

- [#194 — fix(desktop): cleanup session-scoped state on workspace switch](https://github.com/akhayam99/kay-am/issues/194)
- [#195 — feat(db,core,desktop): persist session worktrees in m009 table](https://github.com/akhayam99/kay-am/issues/195)
- [#196 — feat(db,core,desktop): permission audit retry queue (m010)](https://github.com/akhayam99/kay-am/issues/196)
- [#197 — refactor(core): cost truth cursor + codex via stream usage + settings override](https://github.com/akhayam99/kay-am/issues/197)
- [#198 — refactor(core): parametrize claude TS adapter permission flags](https://github.com/akhayam99/kay-am/issues/198) — closes #185 part 2
- [#199 — test(core): phase sequencer edge cases](https://github.com/akhayam99/kay-am/issues/199)
- [#200 — test(core): summarizer client gated integration test](https://github.com/akhayam99/kay-am/issues/200)

Multi-agent parallel (parte B — experimental):

- [#201 — feat(types): parallel phase domain types](https://github.com/akhayam99/kay-am/issues/201)
- [#202 — feat(db): m011 parallel_phases migration](https://github.com/akhayam99/kay-am/issues/202)
- [#203 — feat(core): parallel scheduler (fan-out/fan-in)](https://github.com/akhayam99/kay-am/issues/203)
- [#204 — feat(core): parallel conflict detection + merge strategy](https://github.com/akhayam99/kay-am/issues/204)
- [#205 — feat(core): throwaway worktree helper for parallel runs](https://github.com/akhayam99/kay-am/issues/205)
- [#206 — test(core): parallel scheduler + conflict integration tests](https://github.com/akhayam99/kay-am/issues/206)
- [#207 — feat(desktop): parallel phase group CRUD tauri commands](https://github.com/akhayam99/kay-am/issues/207)
- [#208 — feat(desktop): parallel phase run spawn batch tauri command](https://github.com/akhayam99/kay-am/issues/208)
- [#209 — feat(desktop,ui): split-view transcript + experimental flag toggle](https://github.com/akhayam99/kay-am/issues/209)
- [#210 — feat(desktop): multi-progress indicator for parallel runs](https://github.com/akhayam99/kay-am/issues/210)
- [#211 — feat(desktop,ui): merge dialog conflict resolution UI](https://github.com/akhayam99/kay-am/issues/211)
- [#212 — feat(desktop): wire parallel scheduler into sendTurn](https://github.com/akhayam99/kay-am/issues/212)
- [#213 — feat(types,core): permission_request + permission_decision TurnEvent](https://github.com/akhayam99/kay-am/issues/213) — closes #185 part 1
- [#214 — test(desktop,repo): e2e parallel fan-out/fan-in + ROADMAP/README v0.7](https://github.com/akhayam99/kay-am/issues/214)

### Critical path

```
H1.0 → H1.1 → F1+F2 → C1+C2+C3 → C4 → T1+T2 → U1+U2+U3 → I1 → I3
H2.* parallelizable with H1+F (independent file scope).
```

---

## pre-1.0 issue index

UX polish & IA rework milestone. Bridges v0.7 → v1.0.

Design tokens & motion (T):

- [#241 — feat(ui): design tokens — oklch palette + text scale + motion vars](https://github.com/akhayam99/kay-am/issues/241)
- [#292 — feat(ui): typography scale propagation (replace text-[10/11px])](https://github.com/akhayam99/kay-am/issues/292)
- [#288 — feat(ui): motion language + reduced-motion gate](https://github.com/akhayam99/kay-am/issues/288)

Bugs & stability (B):

- [#242 — fix(desktop,ui): appshell max-width/height caps for ultrawide displays](https://github.com/akhayam99/kay-am/issues/242)
- [#243 — fix(desktop,ui): stabilize zustand selectors](https://github.com/akhayam99/kay-am/issues/243)
- [#318 — fix(desktop,ui): context panel rail + reopen on collapse](https://github.com/akhayam99/kay-am/issues/318)

Polish & primitives (P):

- [#244 — refactor(ui,core): pre-1.0 polish bundle (tooltip, copybutton, pricing, a11y)](https://github.com/akhayam99/kay-am/issues/244)
- [#293 — feat(desktop,ui): empty/loading/error states pass with CTAs + Skeleton](https://github.com/akhayam99/kay-am/issues/293)

Information architecture (I):

- [#245 — refactor(repo,desktop,ui): terminology audit + glossary](https://github.com/akhayam99/kay-am/issues/245)
- [#246 — feat(desktop,ui): session header + ide dropdown + worktree rename](https://github.com/akhayam99/kay-am/issues/246)
- [#247 — refactor(ui): split settings — global vs per-workspace gear](https://github.com/akhayam99/kay-am/issues/247)
- [#249 — refactor(ui): settings dialog sidebar+content layout](https://github.com/akhayam99/kay-am/issues/249)

Accessibility (A):

- [#248 — feat(desktop,ui): a11y bundle — shortcut layer + aria + boot recovery](https://github.com/akhayam99/kay-am/issues/248)

Features (F):

- [#250 — feat(desktop,ui): context panel collapse toggle + rail variant](https://github.com/akhayam99/kay-am/issues/250)
- [#251 — feat(desktop,ui): sidebar mega — nested sessions + search/filter + rename/delete](https://github.com/akhayam99/kay-am/issues/251)
- [#267 — feat(ui): one-click parallel opt-in + provider order](https://github.com/akhayam99/kay-am/issues/267)
- [#297 — feat(desktop): command palette (cmd+K)](https://github.com/akhayam99/kay-am/issues/297)

Data & config (D):

- [#252 — feat(desktop,db): config export/import JSON roundtrip](https://github.com/akhayam99/kay-am/issues/252)
- [#253 — feat(core): settings inheritance resolver (global → workspace → session)](https://github.com/akhayam99/kay-am/issues/253)

Docs & integration (IN):

- [#254 — docs(repo): walkthroughs + parallel agents + phase templates](https://github.com/akhayam99/kay-am/issues/254)
- [#305 — feat(desktop,repo): pre-1.0 ROADMAP + README integration glue](https://github.com/akhayam99/kay-am/issues/305)

Deferred to v1.0:

- [#270 — feat(desktop,core): GitHub account integration — branch/PR state sync](https://github.com/akhayam99/kay-am/issues/270)
- [#271 — feat(ui): session context panel surfaces branch, PR, linked issue](https://github.com/akhayam99/kay-am/issues/271)
- [#272 — refactor(core): audit MCP usage and prefer CLI/scripts where token-cheaper](https://github.com/akhayam99/kay-am/issues/272)

### Critical path

```
T1(design tokens) → P1(polish bundle) → A1(a11y) → B2(sidebar mega) → F3(settings IA)
                                       → I1(terminology) → I3(sidebar mega)
                  → B1(ultrawide fix)  → B3(rail fix) → F2(context panel rail)
D1(config export) → D2(settings resolver) → F4(parallel opt-in)
F5(command palette) ← A1(shortcut layer)
IN2(finale) depends on all above.
```

---

## How to read this roadmap

- One issue ≈ 1–4 hours of focused implementation work.
- Each issue has its own dependencies declared in the body. The chains above are the headline view.
- Where two chains are independent, they run in parallel — different branches, different worktrees.
- New issues created during implementation are appended to the v0.1 milestone if they belong to the MVP, otherwise they target the appropriate later milestone.

See [CONVENTIONS.md](./CONVENTIONS.md) for branch / commit / PR conventions and [CLAUDE.md](./CLAUDE.md) for code rules.
