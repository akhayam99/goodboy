# Workflows

> **Read this when** you want to know how workflows, the orchestrator and
> hands-free runs work, or you are changing the workflow tables, the code that
> moves a run to its next step, or the summarizer that runs after each step.
> **Not for** the workflow header and back row ([navigation/session-rail.md](navigation/session-rail.md)).

A workflow is a reusable list of steps, such as scout, plan, implement and
test, with a few lines that say when to use it and when to stop. The detail
lives in [workflows/](workflows/), what a reader of the app sees in
[features/workflows.md](features/workflows.md), and how the Lead follows a
workflow in [auto.md](auto.md#following-a-workflow). Each object in Goodboy is
explained in [concepts.md](concepts.md).

## What a workflow is

A workflow holds its steps and its guide fields: **Use it when**, **First,
check**, **Stop and ask when**, **Then suggest** and **Keep steps in order**.
It reaches a session in one of two ways:

- Picked in **Start a run** (the **Workflow** pill, or `~` and its name), it
  starts a Lead that follows it.
- Picked with `~` in a chat composer, from the **Set up** action of a workflow
  suggestion, or from the phone, it is attached as a preset run
  (`attachWorkflowToSession`): every step agent is created at once and the run
  walks the steps. The phone attaches it queued, with a manual start.

The same workflow can run many times in one session, and each run is separate.
A session does not need a workflow: you can always add free agents next to a
run.

## What a step carries

Each step is one agent with its own brief and model:

- **Name** and **role**: scout, investigator, planner, implementer, reviewer,
  tester, docs, report, wireframe or custom. Resolve is not a workflow role
  ([workflows/code-map.md](workflows/code-map.md#resolve-inside-a-workflow)).
- **Prompt**: the instruction the agent starts from.
- **Expected output**: what this step promised the next one, at the top of the
  handoff.
- **Provider**, **model** and **effort**. A step that follows its role starts
  on the best candidate for it
  ([Provider priority for steps](#provider-priority-for-steps)); a model you
  pin wins.

Steps run one after another. Parallel work happens inside a step, where a scout
step can split into several agents.

## How a run moves

A run copies the workspace rules when it is attached, so a later change never
reaches it. A **preset run** has a fixed list: every step agent is created
`pending` with its model already picked. An **orchestrated run** has no list:
the orchestrator decides each next step. Only older runs use it.

1. A step runs until its agent writes its done marker or saves a plan.
2. The post-step summarizer turns the step's chat into a handoff, the only
   thing the next step reads from it.
3. `resolveWorkflowAdvance` decides whether the run can move on. It is the one
   place that decides, and every screen reads it.
4. The run waits for your go or, when hands-free, starts the next step (or asks
   the orchestrator for one) by itself.

A run also waits on an open question, a failed step, its limit, a pause or a
plan held for approval
([workflows/advancing.md](workflows/advancing.md)).

## Workflow rules

Rules are the workspace defaults every new run copies, on the **Every run** tab
of the Workflows studio: when a run stops for your OK, the limit, guidance,
roles and parallel agents ([workflows/rules.md](workflows/rules.md)).

### Provider priority for steps

Steps start on the same candidates as the Lead's helpers. The run's copy of the
rules picks **By order** (the default) or **By load**
([workflows/rules.md](workflows/rules.md#provider-priority-for-steps)).

## The orchestrator

The orchestrator plans an orchestrated run one decision at a time: the next
step, done, or blocked. It never does the work itself
([workflows/orchestrator.md](workflows/orchestrator.md)).

### The orchestrated document

An orchestrated run, like a preset run, opens as one document: a header with
one primary, the goal and settings line, the step checklist, the tail, the
result and the hint composer ([workflows/run-pages.md](workflows/run-pages.md)).

## After each step

### The post-step summarizer

A finished step's chat becomes the handoff the next step reads, by fixed rules,
with the expected output first. The summarizer never decides if the step
succeeded
([workflows/step-end.md](workflows/step-end.md#the-post-step-summarizer)).

### Step sequencing

**Parallel agents** on Every run decides whether a scout step can split. The
orchestrator plans the fewest steps that finish the goal
([workflows/orchestrator.md](workflows/orchestrator.md#step-sequencing)).

### When a step stops without its done marker

A turn that ends without its marker is held for your answer when it asked
something, else re-kicked once on a hands-free run, then skipped or blocked
([workflows/step-end.md](workflows/step-end.md#when-a-step-stops-without-its-done-marker)).

## Pages in this folder

- [studio.md](workflows/studio.md): the workflow list, the workflow page, the
  step editor, saved steps, run titles and when a run starts.
- [rules.md](workflows/rules.md): the Every run tab, limits, guidance and
  provider priority.
- [runs-list.md](workflows/runs-list.md): the Runs page, its grouping, routed
  starts and the run kind chip.
- [run-pages.md](workflows/run-pages.md): the page of a run, its header, tail,
  composer and menu.
- [run-tree.md](workflows/run-tree.md): the run tree, activity rows, the time
  column and the Next action strip.
- [advancing.md](workflows/advancing.md): what lets a run move on, and how it
  waits, skips, pauses, stops, closes, finishes or runs hands-free.
- [plans.md](workflows/plans.md): the plan hold, Approve, the plan primary, the
  plan drawer and plan edits.
- [orchestrator.md](workflows/orchestrator.md): decisions, models, hints, plans
  from a preset and the idle run watchdog.
- [step-end.md](workflows/step-end.md): the scope line, marker parsing, steps
  that end without a marker, and the post-step summarizer.
- [code-map.md](workflows/code-map.md): the files, the tables, and why Resolve
  is not a step role.
