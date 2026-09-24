# Workflows

> **Read this when** you want to know how workflows, the orchestrator and
> hands-free runs work, or you are changing the workflow tables, the code that
> moves a run to its next step, or the summarizer that runs after each step.
> **Not for** the workflow header and breadcrumbs ([navigation.md](navigation.md)).

A workflow splits a task into steps and runs each step as its own agent. This
page covers how you pick or build one, what the orchestrator does and how a
run moves from step to step. The code details come at the end.

Each object in Goodboy is explained in [concepts.md](concepts.md). The
header and breadcrumbs are covered in [navigation.md](navigation.md).

## What a workflow is

A workflow is a list of steps you can use again and again, for example scout,
plan, implement, test. Each step starts a new agent with a short brief. When
that agent is done, it hands a summary to the next one.

- A workflow can have a goal, and you can change it for each run
- Adding a workflow to a session starts a **run**
- The same workflow can run as many times as you like in one session, and each run is separate
- A session does not need a workflow. You can always add free agents next to a run

## Picking or building one

Open the workflow builder in a session and choose one of three modes.

1. **Preset**: pick a ready workflow. Goodboy comes with **Refactor (example)**, a scout, plan, implement and test sequence you can copy and adjust.
2. **Custom**: write the steps yourself, or describe what you want and Goodboy drafts the steps for you to edit.
3. **Orchestrated**: give a goal and let the orchestrator choose each step as the work goes.

Every workflow has a name in the **Workflow name** field. It shows a default
name until you type your own. If you rename a preset inside the builder, you
get a new workflow of your own, and the shared preset keeps its name.

A workflow you are still building stays there when you switch sessions. It
goes away once you create it or discard it. **Workflow Studio** is where you
keep presets and the step library. It can also import a custom workflow from
another workspace.

### When a run starts

- **Immediately** when you add it. This is the default
- **Manually**, when you press start
- **After another run** finishes, and then it carries on by itself

## What a step carries

Each step is one agent with its own brief and its own model.

- **Name** and **role**: scout, investigator, planner, implementer, reviewer, tester, resolver, docs, report, wireframe or custom
- **Prompt**: the instruction the agent starts from
- **Expected output**: what this step promised the next one. It goes at the top of the handoff
- **Provider**, **model** and **effort**: for example scout on a cheap model, plan on a strong one

If you leave the model on auto, Goodboy picks one based on the role, the model
tier and the cost. A model you set on the step wins over that choice.

Steps run one after another. Parallel work happens inside a step, where a
scout step can split into several agents.

## The orchestrator

The orchestrator is an agent that plans the run for you. In an
**Orchestrated** run there is no fixed list of steps. After each step
finishes, the orchestrator reads the goal, your process notes and what the
steps so far produced. Then it decides one thing: the next step, done, or
blocked.

- It never does the work itself. It has no tools and cannot open your repository
- A run usually starts with discovery, then a plan, then the work
- It picks the provider, model and effort for each step, and gives a short reason
- It keeps a running recap of what is done and what is left
- It ends the run when the goal is met, or stops and asks you when a decision needs you

You choose the model the orchestrator runs on in the launch form.

### Hints

A hint is a note you send the orchestrator while the run is going. Every hint
stays with the orchestrator for the rest of the run. It is marked as new, or
with the step where the orchestrator first read it.

- **Queue** waits until the next decision
- **Read now** restarts a decision that is in progress. If a step is running, it stops that step, keeps what it wrote, and decides again
- The field stays open while the orchestrator decides, and it empties as soon as you send. If the hint can't be saved, your text comes back
- Each hint says where it stands: **Waits for the next decision**, **Reading now** while a decision has it, or **Read at step N**. Read hints sit behind a count
- You can remove a hint, except while a decision is reading it

Asking for a certain provider or model on a step is a hint too.

### Spend limit

Each run can have a spending limit in dollars. You set it on the run, in the
orchestrator panel or in the creation form. You also choose what happens when
the run reaches it: Goodboy notifies you, or pauses the run. The limit starts
at unlimited. The orchestrator decides how many steps to plan based on the goal.

## How a run advances

When a step finishes, Goodboy turns its chat into a short summary called a
handoff. The next step reads that handoff instead of the whole previous chat.
Then the run either moves on or waits for you.

A run waits when:

- An agent asked a question you have not answered yet
- A step failed
- The summarizer is still writing the handoff
- An agent is still running

When a run waits for more than one reason, Goodboy shows the one you need to
deal with first. An open question comes before a failed step.

### Skipping a failed step

Getting past a blocked run always takes more than one click. A failed step
takes two. First you confirm the skip, then the next agent starts. The failed
step is marked **skipped**, not left as failed.

### Hands-free runs

**Autorun** makes a run hands-free. Each next step starts without you
clicking. You can turn it on for one run or for the whole session. A run
without its own setting follows the session.

- The session's autorun also covers agents running outside a workflow
- A workflow you add to a session with autorun on starts with autorun on
- **Stop now** ends a hands-free run. Goodboy asks you to confirm first. The step that is running is cancelled and marked skipped, and everything it already wrote is kept
- **Resume the run** starts a stopped run again. It turns autorun back on and asks for the next step

A hands-free run still stops and waits for you when:

- An agent has a question for you
- A step failed. You get one **workflow blocked** notification that names it
- The run's budget alert is showing and you have not dismissed it
- It is waiting for another run to finish

If a hands-free step stops without saying it is done, Goodboy nudges it once.
If it stops again, the step fails and waits for you.

## For contributors

Everything below is the code behind the sections above.

### Where it lives

- `packages/db/src/migrations/`: the workflow schema
- `apps/desktop/src-tauri/src/workflows.rs`: `workflow_upsert`, `step_def_upsert`, `agent_insert_batch`
- `apps/desktop/src/features/workflows/advanceGate.ts`: `resolveWorkflowAdvance`, which decides if a run can move on
- `apps/desktop/src/store/slices/workflows/maybeAutoAdvanceWorkflow.ts`: moves a hands-free run to its next step
- `apps/desktop/src/store/slices/workflows/handsFree.ts`: `isHandsFree`, which checks the run first, then the session
- `apps/desktop/src/store/slices/workflows/preSpawnWorkflowAgents.ts`: creates the run's agents when a workflow is added
- `apps/desktop/src/store/slices/workflows/notifyWorkflowGateBlock.ts`: sends the blocked notification
- `apps/desktop/src/store/slices/workflows/orchestrateNextStep.ts`: asks the orchestrator for one decision
- `apps/desktop/src/store/slices/workflows/summarizeWorkflowAgentOutput.ts`: the summarizer that runs after each step
- `packages/core/src/summarizer/step-output.ts`: the rules every handoff follows
- `packages/core/src/orchestrator/prompt.ts`: `ORCHESTRATOR_SYSTEM_PROMPT`
- `packages/core/src/workflows/library.ts`: `WORKFLOW_LIBRARY`, the presets that come with the app
- `packages/core/src/roles.ts`: `ROLE_REGISTRY`, the roles a step can take

### `phaseTemplate*` means workflow

There is no phase template anymore, and no `phase_templates` table. That
table was removed in `packages/db/src/migrations/m014-rename-domain.ts`,
together with `phase_definitions`, `session_phase_runs` and
`parallel_phase_groups`.

Any `phase*` name still in the store, the workflow slices and `workflows.rs`
is an old name for a workflow. There is no second system to look for.

### The tables

The schema is in `packages/db/src/migrations/`. A few things it does not tell you:

- A run is keyed by `workflow_run_id`, not by workflow. That is how one workflow can be added to a session many times
- Every per-run flag lives on `session_workflows`. The agents of a run carry the same id
- A run's plan and open questions belong to the run, not the session. Two runs on one session never read each other's state. A question blocks a run when it carries that run's id, or, for old rows with no run id, that run's workflow id (`workflowRunHasOpenQuestions`). A question with neither blocks only the agent that asked it, never a run
- `is_preset = 0` marks a one-off run. It does not show up in the preset picker
- A `step_library` row with a `NULL` `workspace_id` is a built-in step for every workspace

Adding a workflow creates every agent of the run at once, each one `pending`.
Each step's settings are worked out per agent. When a step sets nothing, the
role's recommended model fills in. So the shape of a run is fixed the moment
you add it. It is not worked out step by step.

Every screen that creates or edits a workflow saves it through the same
upsert command. A second way of saving could create a workflow the picker
cannot see.

### Advance states

`resolveWorkflowAdvance` is the only place that decides if a run can move on.
It returns exactly one state. The order it checks them in is part of the
contract.

| Order | Result                   | When                            |
| ----- | ------------------------ | ------------------------------- |
| 1     | `complete`               | every step is done              |
| 2     | `blocked` `questions`    | an open question exists         |
| 3     | `blocked` `summarizer`   | summarizer busy, not `auto_run` |
| 4     | `blocked` `failed-step`  | a step failed                   |
| 5     | `automatic`              | `auto_run` is on                |
| 6     | `blocked` `turn-running` | a turn or agent is running      |
| 7     | `ready`                  | the user can advance            |

The reason it returns is the one the user has to deal with first. A run with
both an open question and a failed step returns `questions`. If you change the
order, you change what every screen tells the user to do.

A blocked result always carries the failed step, whichever reason came first.
So screens that name the failed step keep naming it while a short-lived block
is showing.

Every screen reads this one resolver through one view that handles every case
of the union. No screen narrows the union on its own. The one exception on
purpose is the chat button, because it shows nothing under `automatic`.

### Autorun logic

With `auto_run` on, the summarizer case and the turn-running case both become
`automatic`. The manual buttons do not show, because autorun is about to make
that click.

An open question and a failed step both still show with autorun on, because
autorun stops on both. `maybeAutoAdvanceWorkflow` skips a run with open
questions. It only starts the next agent when every agent is `completed` or
`skipped`, and a `failed` agent is never either.

One check decides when a run is finished: `isWorkflowRunComplete`. The chain
trigger, attach and the builder all use it. A run is not finished while any
agent with a parent is still neither `completed` nor `skipped`. This is checked
first, so a dynamic run marked `done` still waits for a running child. After
that, a dynamic run finishes on its `done` outcome. A static run needs its
template, at least one step, and every step agent settled.

A hands-free run (`auto_run`, set on the run or taken from the session) waits
for a busy summarizer. It checks every 100ms for up to 60 seconds, then moves
on whether the summarizer finished or not. It still stops on any budget alert
you have not dismissed. A run can also be held until another named run
finishes.

When autorun stops on a failed step, Goodboy sends a `workflow blocked`
warning that names the step, **once per stop, not once per check**. The
warning is keyed by the failed step and the agent that failed on it.

- Another run on the same session that is still going does not repeat the warning for the same stop
- A retry creates a new agent row, so it does send a new warning

Screens outside the lens name the block and offer the skip. They do not say
the run is on autorun. Outside the lens the resolver cannot see the budget
stop or a run waiting on another run. It would call a run automatic even
though that run will never take another step, and the manual button would
disappear.

### Orchestrated runs

A run whose `execution_mode` is `dynamic` has no list of steps to walk.
Between steps, `orchestrateNextStep` asks the orchestrator model for one
decision: the next step (name, role, prompt, expected output and a proposed
model), `done`, or `blocked`. A `next` decision adds the step and starts its
agent. `done` and `blocked` are saved as the run's outcome with the reason,
and `blocked` sends a notification. Every decision lands in the transcript as
an `orchestrator_decision` event, and its spend is recorded against the run.

- **One decision at a time.** A request that comes in while the run is
  deciding waits in a queue and runs once the current decision settles.
- **Stops are saved, with a kind.** Before the call, the orchestrator checks
  for a budget-blocked session, the run's spend limit in pause mode, and open
  questions that block the run. Each one saves a `budget` or `questions` stop.
  A failed or unreadable call saves `failure`. **Stop now** saves `operator`,
  turns autorun off and skips the running steps, keeping what they wrote.
  Nothing decides again until you continue. Continuing or retrying clears the
  outcome and the stop, and a retry after an operator stop turns autorun back
  on.
- **Its model.** The orchestrator runs on the run's own routing when one is
  set and the catalog still has it. Otherwise it runs on the workflow
  orchestrator task model. A saved model the catalog dropped is ignored, never
  started. Steps take their role models from the resolved settings. A run has
  no per-role model overrides of its own.
- **Hints.** Hints are saved in the run's hint log (`orchestrator_hint_log` on
  `session_workflows`) and survive a restart. **Read now** on a live
  orchestrated run marks a decision in flight for restart: its answer is
  thrown away when it returns (its spend still counts) and a fresh decision
  reads the hint. Running steps are cancelled and marked skipped before a new
  decision is asked for. When a decision lands, the hints it read are marked
  used, with the step they informed. A hint added while it was deciding stays
  pending for the next one. `orchestratorReadingHints` holds, per run, the
  unread hints a decision in flight took in, plus a hint sent with **Read now**
  until the decision it asked for starts. A decision that ends with no restart
  queued behind it clears the entry, so a hint nothing picked up goes back to
  queued.

The restart marks, the hints being read, the set of runs that are deciding and
the queued requests live in memory, keyed by run and removed with it. Everything a restart needs
(outcome, stop, summary, hints) is on the run's row.

Expected output belongs to a workflow's own steps. Step library entries do not
carry it. Rows written before the field existed have none, except the seeded
example steps that the backfill filled in.

### The post-step summarizer

A step finishes when its agent writes a `<<step-done ...>>` marker or saves a
plan. Goodboy then turns the chat into the handoff the next step reads. So
step N+1 never reads step N's full chat.

The summary follows fixed rules. It is not free text.

- It starts with a one-line outcome
- It has a maximum length
- Facts come in order of importance: file paths, decisions, actions, problems, blockers
- The step's expected output comes before everything else, so the handoff starts with what the next step was promised

**The summarizer never decides if the step succeeded.** If the model fails,
times out or breaks the rules, Goodboy falls back to cutting the chat down to
its start and end. No model is involved in that fallback.

The step still completes, the result is marked `degraded`, and a notification
offers to retry. Either way, the summary is what the next step starts from.

### Step sequencing

Steps run one after another. Parallel work happens inside a step. The
`parallel_agents` setting decides whether a scout step can split into several agents.

If a hands-free step stops without a `step-done` marker, Goodboy nudges it
once. If it stops again, the step fails and waits for the user.
