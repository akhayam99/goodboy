# Task as shared memory — design spec

**date**: 2026-05-09
**status**: approved (n-bro)
**replaces**: prior workflow auto-advance model

## Problem

The pre-1.0 workflow model treats a Task as an automatic chain of single-turn steps. The orchestrator advances on every user message: 1 message → 1 assistant turn → step marked complete → next message routed to next step. The user reported (verbatim, 2026-05-09):

- "ogni input crea nuovo agent" — cannot iterate within a step
- "step 4 chat fresca, contesto perso" — only `outputSummary` (≤2000 char) of the immediately previous step propagates
- "il peggior orchestratore di sempre" — the system loses what makes the project valuable: persistent context across agent invocations

Root diagnosis: the unit of orchestration is wrong. A Task is not a chain of steps; it is a goal with shared memory and multiple agents that read and write that memory at the user's discretion.

## Model

```
Task (goal container)
│
├── ContextPanel (shared memory, persists across agents in this Task)
│   ├── files_touched         (auto-extracted from tool calls)
│   ├── decisions             (agent-emitted via marker)
│   ├── open_questions        (agent-emitted)
│   ├── output_summaries[]    (per-agent, generated on next-agent spawn)
│   └── custom slots          (user manual, as today)
│
└── Agents[]                  (long-lived, multi-turn, user-spawned, user-labeled)
    ├── Agent #1 [chip: scout, claude-haiku, low]
    │   └── multi-turn chat; iterable indefinitely until user moves on
    ├── Agent #2 [chip: planner, claude-opus, high]
    │   └── reads ContextPanel as part of system prompt — no re-explaining
    ├── Agent #3 [chip: implementer, claude-sonnet, medium]
    │   └── "implementa" suffices because context is already loaded
    └── Agent #4 [chip: review, ...]
```

**Core principle**: the user orchestrates. The system never auto-advances. Switching agents within a Task means switching active chat thread; the ContextPanel travels with the Task, not with the agent.

## Mapping onto existing schema

| existing entity     | new role                                                                                                                                                                |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Task`              | unchanged — goal container                                                                                                                                              |
| `Session` (atomic)  | becomes **Agent** — long-lived multi-turn chat tied to a Task. Renamed in UI as "agent".                                                                                |
| `Workflow` + `Step` | demoted to **preset**. Selecting a preset pre-spawns N agents with role chips and routing defaults; the user is free to ignore order, re-spawn, or skip. No auto-chain. |
| `ContextSlot`       | extended: existing manual slots remain; new auto-populated slots (`files_touched`, `decisions`, `open_questions`, `output_summaries`) added.                            |

## ContextPanel auto-populate strategy: hybrid (γ)

| slot                          | source                                                                               | cost                         |
| ----------------------------- | ------------------------------------------------------------------------------------ | ---------------------------- |
| `files_touched`               | post-process each turn's tool calls (Edit/Write/MultiEdit/Bash file ops)             | free                         |
| `output_summaries[]`          | cheap-tier call when user spawns next agent (one call per agent, not per turn)       | ~$0.0001                     |
| `decisions`, `open_questions` | agent-emitted markers in reply: `<<ctx-decision>>...<<>>`, `<<ctx-question>>...<<>>` | free; ≤99% prompt compliance |
| custom slots                  | user manual textareas, as today                                                      | free                         |

Fallback: every auto slot is also user-editable. If the agent forgets to emit a marker, the user can edit the slot manually.

## Per-role defaults

| chip        | default provider | default model | default effort |
| ----------- | ---------------- | ------------- | -------------- |
| scout       | anthropic        | claude-haiku  | low            |
| planner     | anthropic        | claude-opus   | high           |
| implementer | anthropic        | claude-sonnet | medium         |
| reviewer    | anthropic        | claude-sonnet | medium         |
| custom      | anthropic        | claude-sonnet | medium         |

User can override per-agent on spawn.

## Resolved complaints

| user complaint                    | resolved by                                                     |
| --------------------------------- | --------------------------------------------------------------- |
| ogni input crea nuovo agent       | agent multi-turn — 1 agent = N turns, user-spawned only         |
| step 4 chat fresca                | step concept dissolved; agents share ContextPanel               |
| contesto perso                    | ContextPanel persists across agents, written/read automatically |
| no stop action                    | already exists (cancel button); add per-agent visibility        |
| no badge workflow in sidebar      | per-agent chip + optional preset tag on Task                    |
| context panel solo goal           | core: agents auto-write, next agent auto-reads                  |
| no auto model/effort per ruolo    | per-chip defaults applied on spawn                              |
| agent senza tokens/model/provider | agent row in sidebar shows chip + model + tokens + cost         |
| no preview workflow               | preset preview chip shows the N agents that would spawn         |
| new session / add workspace UX    | settings-style sidebar dialogs                                  |

## PR plan

Ordered by foundation-first:

1. **PR1** — agent multi-turn semantics. Kill `nextStep()` auto-advance in `sendTurn`. Agent stays alive across turns until user explicitly spawns next. Most foundational.
2. **PR2** — ContextPanel as shared memory. Schema for new slots; agent system prompt reads panel; marker parser writes panel; tool-call extraction for files; on-demand summary on agent spawn.
3. **PR3** — agent row telemetry. Sidebar agent rows render chip + model + provider + tokens + cost.
4. **PR4** — per-role chip system + defaults. Spawn-agent dialog lets user pick chip → defaults applied → optional override.
5. **PR5** — workflow preset = spawn-batch. Selecting "refactor" pre-spawns 4 chip-labeled agents (does NOT chain them).
6. **PR6** — workflow preview chip. Hover/click chip → reveals the N agents it would spawn.
7. **PR7** — new-session dialog redesign. Settings-style sidebar (goal / branch / budget / preset / provider sections).
8. **PR8** — add-workspace dialog redesign. Similar sidebar + read-only preview of existing skills + workflow templates discovered in repo.

Each PR: green CI required before merge. No squashed mega-PR.

## Out of scope (deferred)

- Cross-Task ContextPanel inheritance (e.g. seeding new Task from previous Task's panel). Future v1.x.
- Multi-agent parallel execution within one Task. Existing parallel mode unchanged for now.
- Agent handoff protocols beyond ContextPanel reads (e.g. structured tool-call passing). Out of scope.
- LLM-driven role inference (auto-detecting "this prompt feels like planning"). Always user-explicit chip.

## Open risks

- **Marker compliance** — agent-emitted decision/question markers depend on prompt adherence. Mitigation: user can edit slots manually; markers are additive, not authoritative.
- **Summary cost** — one cheap-tier call per agent spawn. Mitigation: cap to ~$0.001/Task with budget warning if exceeded.
- **Migration** — existing tasks with auto-advanced steps must keep rendering. Mitigation: PR1 leaves `Workflow`/`Step` records intact; preset becomes additive UI, doesn't break old data.
