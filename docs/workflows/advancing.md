# How a run advances

> **Read this when** you change what decides whether a run can move on, how a
> run waits, pauses, stops, skips, closes or finishes, or how hands-free runs
> start their next step. **Not for** how the orchestrator picks a step
> ([orchestrator.md](orchestrator.md)), the plan hold
> ([plans.md](plans.md)) or how a step ends ([step-end.md](step-end.md)).

When a step finishes, Goodboy writes its handoff ([step-end.md](step-end.md)).
Then the run moves on or waits for you. It waits while an agent asked a
question you have not answered, a step failed or is blocked, the summarizer
still writes the handoff, or an agent still runs.

## What the run row says

When a run waits for more than one reason, its activity row says one thing
(`resolveRunRowState`), in this order:

1. a failed or blocked step
2. an open question
3. a step waiting for your click
4. the limit

A busy summarizer and a running agent are Goodboy at work, so the row shows
them as running, never as waiting on you.

An open question belongs to the agent that asked it. While the asking agent's
row or its question row is in the feed, the run row stays quiet (`stepAsking`);
it takes the question only when the filter hides both. A failed, blocked or
stopped step works the same way: the step's own row carries the verb, and the
run row keeps the Restart only when no row of the run shows the step.

## Advance states

`resolveWorkflowAdvance` (`features/workflows/advanceGate.ts`) is the only
place that decides if a run can move on. It returns exactly one state. The
order it checks them in is part of the contract.

| Order | Result                   | When                            |
| ----- | ------------------------ | ------------------------------- |
| 1     | `complete`               | every step is done              |
| 2     | `blocked` `questions`    | an open question exists         |
| 3     | `blocked` `summarizer`   | summarizer busy, not `auto_run` |
| 4     | `blocked` `failed-step`  | a step failed or is blocked     |
| 5     | `automatic`              | `auto_run` is on                |
| 6     | `blocked` `turn-running` | a turn or agent is running      |
| 7     | `ready`                  | the user can advance            |

- The reason it returns is the one the user deals with first. Changing the
  order changes what every screen tells the user to do.
- A blocked result always carries the failed step, whichever reason came
  first, so screens keep naming it during a short block.
- Every screen reads the resolver through a view that handles every case:
  `viewWorkflowAdvance` for the step rows and the advance button,
  `resolveNextAction` for the Next action strip. No screen narrows the union
  itself, except the chat button, which shows nothing under `automatic`.

With `auto_run` on, the summarizer and turn-running cases become `automatic`
and the manual buttons hide, because autorun is about to make that click. An
open question and a failed step still show, because autorun stops on both.

Screens outside the lens name the block and offer the skip, but never say the
run is on autorun. There the resolver
cannot see the budget stop or a run waiting on another run, so it would call a
stuck run automatic and hide the manual button.

## When a run is finished

`isWorkflowRunComplete` is the one check. The chain trigger, attach, the run
menu and the timeline all use it.

1. A run is not finished while any agent with a parent is neither `completed`
   nor `skipped`. This comes first, so a dynamic run marked `done` still waits
   for a running child.
2. A dynamic run then finishes on its `done` outcome.
3. A static run needs its template, at least one step, and every step agent
   settled.

"Settled" has one definition in `@goodboy/core`, with two readings:

- `isAgentStatusSettled`: `completed` or `skipped`. Every check that advances,
  chains or finishes a run uses it, so closing an agent by hand (`doneAt`)
  never moves a run.
- `isAgentSettled`: also counts an agent you closed. Only drawing uses it (the
  lane of an agent's children).

`isAgentStatusHalted` is `failed` or `blocked`. The workflow chain, the Next
action strip and the recovery prompt read it, so a blocked step holds the run
exactly like a failed one.

## Skipping a step

Every step that has not finished, live or stuck, has one verb: **Skip**. A step
has no Close; closing is for agents outside a workflow
([../concepts.md](../concepts.md#agents)).

1. Skip asks inline and says what follows: the turn is cancelled, the changes
   stay in the worktree, and which step comes next.
2. Confirming cancels only that step's turn and marks it **skipped**, never
   failed (`skipStuckStepAndAdvance` with `force` and `agentId`).
3. A run that goes on its own and is not paused starts the next step once,
   without waiting for the cancelled turn. A run that asks before each step
   waits for your go.

## Pausing

**Pause** lets the step in flight finish its turn and starts nothing new: no
next step, no orchestrator decision, no read-now hint, no step button, not even
turning autorun back on. **Continue** starts where the run left off and never
changes when to ask.

A pause is a saved stop, `orchestrationStop { kind: 'paused' }`, in the
`orchestration_stop_kind` and `orchestration_error` columns, so it survives a
restart with no migration.

- `isRunPaused` is the one admission check. `activateWorkflowAgent` throws a
  `WorkflowGateError` with reason `paused` before it starts, before it consumes
  a plan and again right before the turn, so a pause that lands mid activation
  starts nothing. It ignores `bypassGate`, which only skips the question gate.
- `orchestrateNextStep` returns at once on a paused run and drops a decision
  that comes back after the pause. `maybeAutoAdvanceWorkflow` leaves paused
  runs and runs with open questions out. A read-now hint stays queued, and a
  skip marks the step but starts nothing.
- `pauseWorkflowRun` and `resumeWorkflowRun` write and clear the stop. Resume
  calls `maybeAutoAdvanceWorkflow`, so the run moves only when it runs on its
  own, and `auto_run` is never touched.
- `continueWorkflowRun` starts the next agent only when every agent is
  `completed` or `skipped`.

The plan hold uses the same admission check ([plans.md](plans.md)).

## Stopping

**Stop** in the dock (**Stop all running agents** in the session menu) stops
the running step and holds the run.

1. The run reads **Stopping** until the step's process exits, then
   **Stopped**.
2. The cut step reads **Not finished**. **Continue** picks it up with
   everything it wrote, turns autorun back on and asks for the next step.
3. If the process does not exit, the run stays running, a warning says the step
   did not stop, and **Stop** is there again.

The operator stop of a run that went on its own is stored as the kind
`operator:auto-run` and reads back as `operator` with `wasAutoRun`, so
Continue turns autorun back on after a reload.

### Stopped agents

An agent you stop is `stopped` with `stopped_by = you`. An agent still running
when Goodboy quits comes back as `stopped` with `stopped_by = app`, and resumes
on its own when its workspace loads after a clean exit
([../turns.md](../turns.md#surviving-a-reload-or-a-restart)). One it cannot
resume reads "Stopped by restart" and offers Continue; the run shows one
**Continue all** for every agent a restart stopped.

A stopped agent is neither settled nor failed. Continue sends "Continue from
where you stopped." as a normal message. The run never passes a stopped step
(`stopped-step`), a stopped step does not count as needing you, and any later
status change clears the stop.

## Closing a run

**Stop run** holds a run that is still going. It is offered from the start
until the run ends; a queued run has nothing to stop, so archive it instead.

- It acts at once and asks nothing, since a stop can be taken back. The toast
  offers **Continue** for the steps that stopped, or for the run when it
  stopped between steps. A partial stop says "Some steps stopped".
- The step in flight stops; a failed step stays failed. Everything written is
  kept.
- The stop waits for the step's process to exit. If it does not, the run stays
  running and a warning asks you to press **Stop run** again
  (`stopRunWithResume` in `features/workflows`).

A run you closed through a route change reads **Closed by you**, never
complete, with no Next action and no autorun. A run chained after it switches
to a manual start, so closing never starts other work. Adding a step opens it
again.

### Archive and delete

**Archive run** acts at once and the toast's **Undo** restores the run. It asks
first while a step runs or another run is chained after it, since Undo restores
the run and not its steps or chain.

**Delete** removes the run and every agent it owns: its step agents, the
agents the orchestrator spawned, and their fan-out children at any depth. It is
a bulk delete with the single-agent method:

1. A running agent is stopped first (`stopAgentForDelete`).
2. Its worktree writer and attachment files are released
   (`releaseAgentFiles`).
3. Its store entries are cleared (`omitDeletedAgents`).
4. Its messages, turn events, open questions and summary go and the row is
   tombstoned (`agentPurgeStatements`, one transaction for the whole run).

There is no undo. What the agents spent stays in the session total. The launch
cleanup of agents a run left behind purges them the same way.

## Hands-free runs

A hands-free run starts each next step without you clicking. One run goes
hands-free with **Asks you** set to **Never**. The whole session does through
the registry verbs `session.asksNever` and `session.asksEveryStep`
(`features/actions/kinds/session.ts`, in the session `⋯`, the right click and
the palette). A run without its own setting follows the session (`isHandsFree`
checks the run first). The session's autorun also covers agents outside a
workflow, and a workflow added to it starts with autorun on.

A hands-free run still stops and waits for you when:

- an agent has a question for you
- a step failed; you get one **workflow blocked** notification
- the run's budget alert shows and you have not dismissed it
- it waits for another named run to finish

It waits for a busy summarizer: every 100ms for up to 60 seconds, then it moves
on either way. A step that stops without its done marker is nudged once, then
fails and waits ([step-end.md](step-end.md#when-a-step-stops-without-its-done-marker)).

`notifyWorkflowGateBlock` sends the `workflow blocked` warning once per stop,
not once per check, keyed by the failed step and the agent that failed on it.
Another run on the session does not repeat it; a retry creates a new agent row,
so it sends a new one.
