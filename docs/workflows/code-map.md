# Workflow code map

> **Read this when** you need to find the code behind workflows, change the
> workflow tables, or wonder why a step role or a `phase*` name looks the way
> it does. **Not for** how a run moves ([advancing.md](advancing.md)) or the
> database migration recipe ([../recipes/migration.md](../recipes/migration.md)).

## Where it lives

### Data

- `packages/db/src/migrations/`: the workflow schema.
- `packages/db/src/queries/workflow.ts`: `saveWorkflow` and `removeWorkflow`
  write workflows and steps for edits. The seeder
  (`packages/core/src/workflows/seeder.ts`) writes the shipped presets through
  `upsertWorkflow` and `restoreSeededWorkflow` in the same file. Rust does not
  write them, except the backup import.
- `packages/db/src/queries/agent-write.ts`: `insertAgent`, `insertAgentBatch`,
  `recordAgentStatus` (the one status writer) and the other writes of
  `agents`.
- `apps/desktop/src-tauri/src/workflows.rs`: the reads of workflows and the
  step library (`step_def_upsert` writes `step_library`).

### Run logic

All in `apps/desktop/src/store/slices/workflows/` unless named otherwise:

- `apps/desktop/src/features/workflows/advanceGate.ts`:
  `resolveWorkflowAdvance`, which decides if a run can move on.
- `maybeAutoAdvanceWorkflow.ts`: moves a hands-free run to its next step.
  `handsFree.ts` (`isHandsFree`) checks the run first, then the session.
- `nextRunMove.ts`: the one rule for what a run owes next (start a pending
  step, decide, or nothing), read by the auto advance and the watchdog.
- `preSpawnWorkflowAgents.ts`: creates the run's agents when a workflow is
  added.
- `orchestrateNextStep.ts`: asks the orchestrator for one decision.
- `findIdleRuns.ts` and `sweepIdleRuns.ts`: the watchdog, driven from `App` by
  `apps/desktop/src/features/workflows/hooks/useRunWatchdog/`.
- `summarizerGate.ts`: `waitForSessionSummarizer`, the 60s wait.
- `summarizeWorkflowAgentOutput.ts`: the summarizer after each step.
- `notifyWorkflowGateBlock.ts`: the blocked notification.
- `apps/desktop/src/features/workflows/runProviderPool.ts`: the provider pool
  of an agent's run, which wins. Outside a run, or for a run with none, a
  caller may pass the workspace pool (`features/auto/workspaceProviderPool.ts`).
  Only Auto trees pass it, through `autoChildPool`, which keeps only the
  providers `autoChildProviders` allows for the child's role.

### Studio

- `apps/desktop/src/features/workflows/components/WorkflowsPanel/`: the
  Studio. `useWorkflowEditor` owns the open workflow, autosave and Draft steps.
  The Studio leaves the time and cost columns empty: a preset has no run to
  estimate from.
- `apps/desktop/src/features/workflows/components/WorkflowStudio/WorkflowEditor/`:
  the editor, drawn on the shared step tree. `presetEdits.ts` marks steps
  edited from their preset and `providerPool.ts` toggles a run's provider pool,
  both in `features/workflows/`.
- `apps/desktop/src/features/workflows/components/StepTree/`: the step tree.
  Polish and the estimate note are optional, so a host without a session leaves
  them out.
- `apps/desktop/src/features/workflows/savedSteps.ts`: one shape for built-in
  and workspace steps, read through `useSavedSteps`.

### Core

- `packages/core/src/summarizer/step-output.ts`: the rules every handoff
  follows.
- `packages/core/src/orchestrator/prompt.ts`: `ORCHESTRATOR_SYSTEM_PROMPT`.
- `packages/core/src/workflows/library.ts`: `WORKFLOW_LIBRARY`, the presets
  that come with the app.
- `packages/core/src/workflows/builtinSteps.ts`: `BUILTIN_STEPS`, the built-in
  saved steps. They live in code, not in `step_library`.
- `packages/core/src/roles.ts`: `ROLE_REGISTRY`, the roles a step can take.

## `phaseTemplate*` means workflow

Any `phase*` name in the store, the workflow slices and `workflows.rs`
(`phaseTemplates`, `savePhaseTemplate`, `sessionPhaseRuns`) names a workflow or
its run. There is no `phase_templates` table and no second system to look for:
`packages/db/src/migrations/m014-rename-domain.ts` dropped it.

## The tables

The schema is in `packages/db/src/migrations/`. A few things it does not tell
you:

- A run is keyed by `workflow_run_id`, not by workflow. That is how one
  workflow can be added to a session many times.
- Every per-run flag lives on `session_workflows`. The agents of a run carry
  the same id.
- A run's plan and open questions belong to the run, not the session. Two runs
  on one session never read each other's state. A question blocks a run when it
  carries that run's id, or, for old rows with no run id, that run's workflow
  id (`workflowRunHasOpenQuestions`). A question with neither blocks only the
  agent that asked it.
- `is_preset = 0` marks a one-off run. It does not show in the preset picker.
- Expected output belongs to a workflow's own steps and to saved steps
  (`step_library.expected_output`). A row can have none: only the seeded
  example steps were backfilled.

### Built-in rows

- `step_library` holds only workspace steps. The rows with a `NULL`
  `workspace_id` are soft-deleted anchors (`m180`) that keep the `seed_*` ids
  `steps.library_step_id` points at valid. `step_def_list` never returns them,
  and `step_def_upsert` and `step_def_delete` refuse them. A new built-in step
  needs an anchor row in a migration, or a workflow step that links to it
  fails the foreign key.
- A built-in workflow has the id `wf_seed_<slug>_<workspace id>`, so a restore
  only reaches its own workspace. The slug stays when the name changes
  (`Refactor` keeps `refactor-example`).
- The Studio compares each seeded row with its `WORKFLOW_LIBRARY` entry
  (`restorableBuiltins`). A restore goes through `restoreSeededWorkflow`, which
  also clears `deleted_at` and soft-deletes the steps the user added.
- Every launch runs `seedMissingBuiltinWorkflows` after the migrations. It
  inserts a built-in only where its `wf_seed_*` id has no row at all and the
  name is free among the live presets.
- Deleting a built-in keeps its row with `deleted_at` set. That is how the
  Studio tells "deleted" (`listRemovedSeededWorkflowIds`) from "never had", and
  why a launch never brings a deleted one back.

### How a run is created

Adding a workflow creates every agent of the run at once, each one `pending`.
Each step's settings are worked out per agent; when a step sets nothing, the
role's recommended model fills in. So the shape of a run is fixed the moment
you add it.

Every screen that creates or edits a workflow saves it through the same upsert
command. A second way of saving could create a workflow the picker cannot see.

## Resolve inside a workflow

The Resolve agent answers review threads with a `comment-resolved` or
`comment-wontfix` marker per thread id. A step has no thread ids and waits for
the step-done marker, so a workflow never runs it.

- `ROLE_REGISTRY.resolver.workflowEligible` is `false`, so no planner,
  orchestrator or formatter offers the role. `normalizeWorkflowRole` turns a
  `resolver` role they still emit into `implementer`, and the role picker
  (`visibleWorkflowRoles`) lists workflow roles only.
- There is no built-in Resolve comments step. A saved workflow keeps its
  `resolver` rows on disk: `rowToStep` and `rowToStepDef` read them as
  `implementer`, and the next save writes the new role.
- `classifyStep` maps a step to the Implement kind when its role or name says
  resolve. `classifyAgent` does the same for an agent row with both a
  `workflowRunId` and a `stepId`. So a stored `resolver` step takes the
  Implement prompt, model and step-done boundary on its next turn.
- `withoutWorkflowStepAttempts` keeps the failed attempts of such rows out of
  the review facts, so the run tree shows the step state.
- Branch, Comments and the resolve lane still run the Resolve agent, one fix
  run per review thread.
