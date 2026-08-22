# Workflows

> **Read this when** touching workflow tables, run advance logic, or the
> post-step summarizer. **Not for** workflow chrome or breadcrumbs
> (`docs/navigation.md`).

Owns the workflow tables, how a run advances, and the post-step summarizer.
Product concepts live in [concepts.md](concepts.md), chrome in
[navigation.md](navigation.md).

## `phaseTemplate*` means workflow

There is no phase-template concept and no `phase_templates` table. It, plus
`phase_definitions`, `session_phase_runs` and `parallel_phase_groups`, was
dropped in `packages/db/src/migrations/m014-rename-domain.ts`. Every surviving
`phase*` identifier in the store, the workflow slices and `workflows.rs` is an
unrenamed alias for a workflow. Do not hunt for a second system.

## The tables

Schema is in `packages/db/src/migrations/`. What the schema does not tell you:

- A run is keyed by `workflow_run_id`, not by workflow, which is what lets one
  workflow attach to a session N times. Every per-run flag lives on
  `session_workflows`, and the agents of a run carry the same id.
- A run's plan and open questions belong to the run, not the session. Two runs
  on one session never read each other's state.
- `is_preset = 0` marks a one-off run, kept out of the preset picker.
- A `step_library` row with a `NULL workspace_id` is a global seed.

Attaching pre-spawns every agent `pending` in one go, resolving each step's
overrides per agent with the role recommendation as the fallback, so a run's
shape is fixed at attach time rather than discovered step by step. Every
authoring surface writes through the same upsert command; a second write path
would let a workflow exist that the picker cannot see.

## How a run advances

`resolveWorkflowAdvance` is the only gate. It returns exactly one blocking
reason, and the order it tests them in is the contract: the reason returned is
the one the user has to act on first, so a run with both an open question and a
failed step reads `questions`. Reordering the tests changes what every surface
tells the user to do. A blocked result carries the failed step whichever reason
won, so surfaces that name the failed step keep naming it while a transient
gate is up.

Every surface reads that one resolver through one exhaustive view of the union.
A surface does not narrow the union itself; the chat CTA is the single
deliberate exception, because it renders nothing under `automatic`.

`automatic` is what `auto_run` collapses the summarizer and turn-running cases
into: manual controls do not render, because automation is about to make that
click. An open question and a failed step both survive autorun, because
automation bails on both: `maybeAutoAdvanceWorkflow` skips a run with open
questions, and it only activates the next agent when every agent is `completed`
or `skipped`, which a `failed` one never is.

Forcing past a block is never one click, and a failed step takes two: the skip
is confirmed before the next agent starts, and the skipped step is stamped
`skipped` rather than left failed.

Hands-free (`auto_run`, per run, falling back to the session) also bails on a
busy summarizer and any undismissed budget-exceeded alert. Bailing on a failed
step raises a `workflow blocked` warning notification naming the step, **once
per stop, not once per pass**: the announcement is keyed by the failed step and
the agent that failed on it, so a live sibling run does not re-announce an
unchanged stop, while a retry, being a new agent row, does. A run can also be
held until another named run completes.

Surfaces outside the lens name the block and offer the skip, and they
deliberately do not claim autorun: out there the resolver cannot see the budget
stop or a deferred trigger, so it would call a run automatic that will never
take another step and the manual control would go missing.

## The post-step summarizer

A step finishes when its agent emits a `<<step-done ...>>` marker or captures a
plan. The transcript is then condensed into the handoff the next step reads, so
step N+1 never re-reads step N's scrollback.

The summary is a contract, not free text: a one-line outcome first, a bounded
whole, facts in priority order (file paths, decisions, actions, problems,
blockers). A step's expected output is pulled out ahead of everything else, so
the handoff leads with what the next step was promised.

**Summarization never decides whether the step succeeded.** On model failure,
timeout or a contract violation it falls back to a deterministic head-and-tail
truncation with no model involved. The step still completes, the result is
flagged `degraded`, and a notification offers the retry. Either way the summary
becomes the next step's carry-forward context.

## Parallel step execution does not exist

There is no parallel step execution. The 0.1.x plumbing that hinted at one
(the `parallel_groups` table and its runtime) was unreachable from any
authoring surface and was dropped in migration m122. The `parallel_agents`
override that survives is a different feature: it gates scout fan-out, not
step parallelism. Do not design against the dropped shape; a future parallel
feature starts from a decision, not from that residue.

## Known limits

- **Expected output is null on most existing data.** The backfill migration
  covered only the seeded example steps.
- **The step library has no expected output.** The field exists on a
  workflow's own steps, not on library entries.
- **One automatic continue, then failure.** A hands-free step that stops
  without a `step-done` marker gets exactly one nudge, then fails. It is
  deliberately not a retry loop: a step that cannot end itself twice is a
  prompt problem, and looping on it spends tokens without converging.
