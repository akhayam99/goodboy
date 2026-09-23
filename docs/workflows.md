# Workflows

> **Read this when** you want to know how workflows, the orchestrator and
> hands-free runs behave, or you are touching workflow tables, run advance
> logic or the post-step summarizer. **Not for** workflow chrome or
> breadcrumbs ([navigation.md](navigation.md)).

A workflow splits a task into steps and runs each step as its own agent. This
page covers how you pick or build one, what the orchestrator does and how a
run moves from step to step, with the implementation detail at the end.

Product concepts live in [concepts.md](concepts.md), chrome in
[navigation.md](navigation.md).

## What a workflow is

A workflow is a reusable sequence of steps, for example scout, plan,
implement, test. Each step starts a new agent with a short brief, and that
agent hands a summary to the next one.

- A workflow can carry a goal, which you can override per run
- Attaching a workflow to a session starts a **run**
- The same workflow can run any number of times in one session, each run independent
- A session needs no workflow: you can always add free agents next to a run

## Picking or building one

Open the workflow builder in a session and choose one of three modes.

1. **Preset**: pick a ready workflow. Goodboy ships **Refactor (example)**, a scout, plan, implement and test sequence you can clone and tune.
2. **Custom**: write the steps yourself, or describe what you want and Goodboy drafts the steps for you to edit.
3. **Orchestrated**: give a goal and let the orchestrator choose each step as the work goes.

Every workflow gets a name in the **Workflow name** field, which shows a
default until you type over it. Renaming a preset inside the builder starts a
workflow of its own, and the shared preset keeps its name.

A workflow you are still building survives switching sessions, and is cleared
once you create or discard it. **Workflow Studio** is where you keep presets
and the step library, and it can import a custom workflow from another
workspace.

### When a run starts

- **Immediately** on attach, the default
- **Manually**, when you press start
- **After another run** completes, then it goes on by itself

## What a step carries

Each step is one agent with its own brief and its own model.

- **Name** and **role**: scout, investigator, planner, implementer, reviewer, tester, resolver, docs, report, wireframe or custom
- **Prompt**: the instruction the agent starts from
- **Expected output**: what the next step was promised, pulled to the top of the handoff
- **Provider**, **model** and **effort**: scout on a cheap model, plan on a strong one

When you leave the model on auto, Goodboy picks it by role, tier and cost. An
explicit pin on the step overrides that choice.

Steps run one after another. Parallelism lives inside a step: a scout step can
fan out into several agents.

## The orchestrator

In an **Orchestrated** run there is no fixed list of steps. After each step
finishes, the orchestrator reads the goal, your process notes and what the
steps so far produced, then decides one thing: the next step, done, or
blocked.

- It never does the work itself: it has no tools and no repository access
- A run usually starts with discovery, then a plan, then the work
- It picks the provider, model and effort for each step, with a short reason
- It keeps a running recap of what is done and what is left
- It ends the run when the goal is met, or blocks when a decision needs you

You choose the model the orchestrator itself runs on in the launch form.

### Hints

Hints steer the orchestrator while it runs. Every hint stays in its context
for the rest of the run, marked new or with the step it was first read at.

- **Queue** waits for the next decision
- **Read now** restarts a decision in flight, or stops the running step, keeps what it wrote, and decides again
- A queued hint can be removed before it is read

A preference for a provider or model on a step is a hint too.

### Spend limit

Each run can have a spending limit in dollars. You set it on the run, in the
orchestrator panel or in the creation form, and choose whether reaching it
notifies you or pauses the run. The limit starts at unlimited, and the
orchestrator sizes its own number of steps from the goal.

## How a run advances

When a step finishes, its transcript is condensed into a handoff, and the next
step reads that handoff instead of the previous chat. A run then either moves
on or waits for you.

A run waits when:

- An agent asked a question that is still open
- A step failed
- The summarizer is still writing the handoff
- An agent is still running

When a run waits for more than one reason, Goodboy shows the one you have to
act on first. An open question comes before a failed step.

### Skipping a failed step

Moving past a block is never one click. A failed step takes two: you confirm
the skip, then the next agent starts. The failed step is marked **skipped**,
not left as failed.

### Hands-free runs

**Autorun** makes a run hands-free: each next step starts without your click.
Turn it on per run, or on the session, and a run without its own setting
follows the session.

- The session's autorun also covers agents running outside a workflow
- A workflow attached to a session with autorun on starts with autorun on
- **Stop** ends a hands-free run, and a stopped run can resume

A hands-free run still stops for you when:

- An agent has an open question
- A step failed, and you get one **workflow blocked** notification naming it
- The run's budget alert is up and not dismissed
- It waits for another run to complete

A hands-free step that stops without saying it is done gets one nudge. If it
stops again, the step fails and waits for you.

## For contributors

Everything below is the implementation behind the sections above.

### Where it lives

- `packages/db/src/migrations/`: the workflow schema
- `apps/desktop/src-tauri/src/workflows.rs`: `workflow_upsert`, `step_def_upsert`, `agent_insert_batch`
- `apps/desktop/src/features/workflows/advanceGate.ts`: `resolveWorkflowAdvance`
- `apps/desktop/src/store/slices/workflows/maybeAutoAdvanceWorkflow.ts`: autorun advance
- `apps/desktop/src/store/slices/workflows/handsFree.ts`: `isHandsFree`, run then session
- `apps/desktop/src/store/slices/workflows/preSpawnWorkflowAgents.ts`: agents spawned on attach
- `apps/desktop/src/store/slices/workflows/notifyWorkflowGateBlock.ts`: the blocked notification
- `apps/desktop/src/store/slices/workflows/orchestrateNextStep.ts`: one orchestrator decision
- `apps/desktop/src/store/slices/workflows/summarizeWorkflowAgentOutput.ts`: the post-step summarizer
- `packages/core/src/summarizer/step-output.ts`: the handoff contract
- `packages/core/src/orchestrator/prompt.ts`: `ORCHESTRATOR_SYSTEM_PROMPT`
- `packages/core/src/workflows/library.ts`: `WORKFLOW_LIBRARY`, the shipped presets
- `packages/core/src/roles.ts`: `ROLE_REGISTRY`, the roles a step can take

### `phaseTemplate*` means workflow

There is no phase-template concept and no `phase_templates` table. It, plus
`phase_definitions`, `session_phase_runs` and `parallel_phase_groups`, was
dropped in `packages/db/src/migrations/m014-rename-domain.ts`.

Every surviving `phase*` identifier in the store, the workflow slices and
`workflows.rs` is an unrenamed alias for a workflow. Do not hunt for a second
system.

### The tables

The schema is in `packages/db/src/migrations/`. What it does not tell you:

- A run is keyed by `workflow_run_id`, not by workflow, which lets one workflow attach to a session N times
- Every per-run flag lives on `session_workflows`, and the agents of a run carry the same id
- A run's plan and open questions belong to the run, not the session, so two runs on one session never read each other's state
- `is_preset = 0` marks a one-off run, kept out of the preset picker
- A `step_library` row with a `NULL` `workspace_id` is a global seed

Attaching pre-spawns every agent `pending` in one go. Each step's overrides
are resolved per agent, with the role recommendation as the fallback, so a
run's shape is fixed at attach time rather than discovered step by step.

Every authoring surface writes through the same upsert command. A second write
path would let a workflow exist that the picker cannot see.

### Advance states

`resolveWorkflowAdvance` is the only gate. It returns exactly one state, and
the order it tests them in is the contract.

| Order | Result                   | When                            |
| ----- | ------------------------ | ------------------------------- |
| 1     | `complete`               | every step is done              |
| 2     | `blocked` `questions`    | an open question exists         |
| 3     | `blocked` `summarizer`   | summarizer busy, not `auto_run` |
| 4     | `blocked` `failed-step`  | a step failed                   |
| 5     | `automatic`              | `auto_run` is on                |
| 6     | `blocked` `turn-running` | a turn or agent is running      |
| 7     | `ready`                  | the user can advance            |

The reason returned is the one the user has to act on first, so a run with
both an open question and a failed step reads `questions`. Reordering the
tests changes what every surface tells the user to do.

A blocked result carries the failed step whichever reason won. Surfaces that
name the failed step keep naming it while a transient gate is up.

Every surface reads that one resolver through one exhaustive view of the
union. A surface does not narrow the union itself. The chat CTA is the single
deliberate exception, because it renders nothing under `automatic`.

### Autorun logic

`automatic` is what `auto_run` collapses the summarizer and turn-running cases
into: manual controls do not render, because automation is about to make that
click.

An open question and a failed step both survive autorun, because automation
bails on both. `maybeAutoAdvanceWorkflow` skips a run with open questions, and
it only activates the next agent when every agent is `completed` or `skipped`,
which a `failed` one never is.

Hands-free (`auto_run`, per run, falling back to the session) waits on a busy
summarizer through a bounded gate, polling every 100ms for up to 60 seconds,
then advances regardless of whether it finished. It still bails on any
undismissed budget-exceeded alert, and a run can also be held until another
named run completes.

Bailing on a failed step raises a `workflow blocked` warning notification
naming the step, **once per stop, not once per pass**. The announcement is
keyed by the failed step and the agent that failed on it:

- A live sibling run does not re-announce an unchanged stop
- A retry is a new agent row, so it does announce

Surfaces outside the lens name the block and offer the skip, and they
deliberately do not claim autorun. Out there the resolver cannot see the
budget stop or a deferred trigger, so it would call a run automatic that will
never take another step, and the manual control would go missing.

### The post-step summarizer

A step finishes when its agent emits a `<<step-done ...>>` marker or captures
a plan. The transcript is then condensed into the handoff the next step reads,
so step N+1 never re-reads step N's scrollback.

The summary is a contract, not free text:

- A one-line outcome first
- A bounded whole
- Facts in priority order: file paths, decisions, actions, problems, blockers
- The step's expected output pulled out ahead of everything else, so the handoff leads with what the next step was promised

**Summarization never decides whether the step succeeded.** On model failure,
timeout or a contract violation it falls back to a deterministic head-and-tail
truncation with no model involved.

The step still completes, the result is flagged `degraded`, and a notification
offers the retry. Either way the summary becomes the next step's carry-forward
context.

### Step sequencing

Steps run in sequence. Parallelism lives inside a step: the `parallel_agents`
override gates scout fan-out.

A hands-free step that stops without a `step-done` marker gets one nudge. If
it stops again, the step fails and waits for the user.
