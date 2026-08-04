# Workflows

Owns the workflow tables, how a run advances, and the post-step summarizer. Term
definitions live in [glossary.md](glossary.md), chrome in [navigation.md](navigation.md).

## `phaseTemplate*` means workflow

There is no phase-template concept and no `phase_templates` table. It, plus
`phase_definitions`, `session_phase_runs` and `parallel_phase_groups`, was dropped in
`packages/db/src/migrations/m014-rename-domain.ts`. The word survives only as an
unrenamed identifier, so do not hunt for a second system:

- `apps/desktop/src/store/types.ts`: `phaseTemplates` holds `Workflow` rows keyed
  by workspace, `sessionPhaseRuns` holds `Agent` rows.
- `apps/desktop/src/store/slices/workflows/`: `loadPhaseTemplates.ts`,
  `savePhaseTemplate.ts`, `loadPhaseRunsForSession.ts`.
- `apps/desktop/src-tauri/src/workflows.rs`: `PhaseTemplateUpsertInput`,
  `PhaseError`, `PhaseRunInsertInput`, `PhaseRunUpdateInput`. Commands are already
  `workflow_*`/`agent_*`; `PhaseTemplateUpsertInput` writes `workflows`+`steps`.

## The tables

- **`workflows`** (`m014`; `is_preset` `m045`, `goal` `m058`, `process_text` `m078`).
  The template, scoped to a workspace, `UNIQUE(workspace_id, name)`. `is_preset = 0`
  is a one-off run, kept out of the preset picker.
- **`steps`** (rebuilt `m045`; `role` `m046`, `expected_output` `m077`). Ordered rows
  under one workflow: `prompt_prefix`, `expected_output`, `role`, `parallel_group`,
  per-step `provider_override`/`model_override`/`effort`/`verbosity`.
- **`step_library`** (`m045`). Reusable steps with provider/model/effort/verbosity
  defaults. `NULL workspace_id` is a global seed (`m045` seeds nine roles).
- **`session_workflows`** (`m041`, rebuilt `m054`). One row per run, keyed by
  `workflow_run_id`: what lets one workflow attach N times to a session. Holds
  `current_step_ordinal`, `auto_run`, `discarded_at`, `trigger_mode` (`m060`).
- **`agents.workflow_run_id`** (`m054`). One agent per step per run, all pre-spawned
  `pending` by `attachWorkflowToSession.ts`, which resolves each step's overrides per
  agent, falling back to `recommendedModelForRole`.
- **`session_plans.workflow_run_id`**, **`open_questions.workflow_run_id`** (`m054`).
  A run's plan and open questions belong to the run, not the session.

Authoring: `WorkflowStudio` and `WorkflowBuilderView`, both via `workflow_upsert`.

## How a run advances

Nothing advances until the gate passes. `resolveWorkflowAdvance` in
`apps/desktop/src/features/workflows/advanceGate.ts` returns `complete`, `automatic`,
`ready` or `blocked` with exactly one of four reasons, tested in this order:

1. `questions`: the run has unanswered open questions.
2. `summarizer`: the step summary is still being written.
3. `failed-step`: `classifyWorkflowChain` reports the current step failed.
4. `turn-running`: a step agent is still running.

`automatic` is what `auto_run` collapses the summarizer and turn-running cases into: the
manual advance controls do not render, because automation is about to make that click. An
open question and a failed step both survive autorun, because automation bails on both:
`maybeAutoAdvanceWorkflow` skips a run with open questions, and it only activates the next
agent when every agent is `completed` or `skipped`, which a `failed` one never is. Either
way the run needs a human, so the control stays on screen.

The control is `ChatWorkflowAdvance` under
`features/session/components/SessionWorkspace/parts/`, rendering `WorkflowNextStepCta`
below the composer. Forcing past a block is possible and never one click: blocked but not
failed, the CTA asks "Start the next agent anyway?"; on a failed step, "force next step"
asks "Skip the blocked step and start the next agent?" first, then
`skipStuckStepAndAdvance` marks it `skipped`.

Hands-free (`auto_run`, per run, falling back to the session) lets
`maybeAutoAdvanceWorkflow` activate the next pending agent with no click, still bailing
on open questions, a busy summarizer, and any undismissed budget-exceeded alert.
`trigger_mode = 'after_run'` holds a run until the one named by `chain_after_run_id`
completes.

## The post-step summarizer

A step finishes when its agent emits `<<step-done ...>>`
(`packages/core/src/context/marker-parsing.ts`) or captures a plan.
`finalizeWorkflowStep.ts` condenses the transcript through `summarizeStepOutput`
(`packages/core/src/summarizer/step-output.ts`), which enforces a contract on the reply:
first line is a one-line outcome of 120 characters or fewer, the whole reply 1200 or
fewer, facts in priority order (file paths, decisions, actions, problems, blockers). A
step's `expectedOutput` is appended as "The next step expects this step to hand over:
...", pulled out first, omitted when empty.

On failure, timeout (15s, `summarizeAgentOutput.ts`), or a contract violation the summary
falls back to `fallbackStepOutputSummary`: a deterministic truncation, first 1500
characters plus `\n...\n` plus last 400, no model involved. The step still completes, the
result is flagged `degraded`, and a `summarizer-degraded` notification carries a
`retry-step-summary` action. Either way the summary becomes the next step's carry-forward
context.

## Parallel execution is still effectively unreachable

Most plumbing exists, but normal authoring still cannot route into it. Treat it as unshipped. Wired today:
`steps.parallel_group`, the `parallel_groups` table (`merge_strategy` of `last_write_wins`,
`manual` or `synthesizer_driven`) with its queries, the commands in
`apps/desktop/src-tauri/src/parallel_groups.rs`, and `store/parallel-turn.ts`.

The runtime gate is now enabled (`AGENT_FEATURES.parallelAgents` in
`apps/desktop/src/shared/lib/features.ts`, with `maxParallelism` fixed at 4), but nothing
writes `parallelGroup`, so `detectParallelGroup` still returns `null`. A settings toggle still
does not wire this path: `parallelEnabled` resolves through
`packages/core/src/settings/resolver.ts` and persists as an override, but nothing reads it.

Caveats that are real in the code that exists: each branch runs on its own worktree, the
merge strategy is hardcoded to `last_write_wins` in `dispatchParallelTurn.ts`, conflicts
surface through `setSessionMergeConflicts` with no resolution UI, and the batch aborts when
projected spend (`lastTurnCost * N`) would cross the session soft cap.

## Known limits

- **Expected output is null on most existing data.** `m077` backfilled only the seeded
  `refactor-example` steps; anything authored earlier keeps `NULL`, so no handover target.
- **The step library has no expected output.** The field exists only on `steps`, so a
  workflow composed from library steps starts with it empty.
- **One automatic continue, then failure.** `MAX_CONTINUE` in `finalizeWorkflowStep.ts` is
  1. A hands-free step that stops without a `step-done` marker gets one nudge, then fails.
