# Plans in a run

> **Read this when** you change how a run holds for its plan, how a plan is
> approved, which primary button a plan shows, the plan drawer, or how a plan is
> revised by the planner or edited by hand. **Not for** the plan artifact in
> general ([../features/workflows.md](../features/workflows.md)) or pausing a
> run ([advancing.md](advancing.md#pausing)).

## The hold after the plan

A run whose copy of the rules says `plan` (**After the plan**) holds once a
plan for that run exists (`active` or `consumed`). A plan step that writes no
plan never holds.

- The hold is a saved stop, `orchestrationStop { kind: 'plan-approval' }`, in
  the same columns as a pause, so it survives a restart.
- `admitWorkflowRun` is the admission check for both. It returns `paused`,
  `plan-approval` or nothing, writes the hold the first time it sees the plan,
  and runs inside `activateWorkflowAgent`, `orchestrateNextStep` and
  `maybeAutoAdvanceWorkflow`.
- `bypassGate` never skips it, so the step button, a skip, a read-now hint and
  a retry all stop at the hold.
- Switching the run to another autonomy drops the hold.
- While it holds, the status reads **Needs approval**, not a failure. **Review
  plan** (`openPlanDrawer`) is the header primary and **Start step** is hidden,
  so approving is the only way on.

While the planner revises a held plan, the run is not waiting for you. The
`plan-revising` phase reads "The planner is revising the plan" with no verb,
and the run row reads **Revising plan** as running (`planRevisingStartIn`).
`isRunRevisingPlan` is the one check: the Needs you count, the sidebar mark,
the bell place and `runPrimaryOf` (hold `revising`) all read it.

## Approve

The button says what it starts (`planApproveLabelOf`): **Approve and start
Implement** when the next step is known (`planNextStepNameOf`), else **Approve
and continue**. `planPrimaryOf` and `runPrimaryOf` both read that one function.

`approveWorkflowRunPlan(sessionId, runId)` approves the plan the run holds for
and moves the run on, whether or not it runs on its own:

1. It writes the copy's `planApproved`.
2. It clears the stop. If that fails, the snapshot is put back, so there is
   never a half approval.
3. It changes the in-store run, moves the run on and answers with what
   happened.

| Result                                           | When                                                                                                                                                 |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `approved`, `next: 'started'`, `agentId`         | the run does not go on its own: the consuming step started through `activateWorkflowAgent` (the door of **Run next step**), answered once it started |
| `approved`, `next: 'continues'`, `agentId: null` | the run goes on its own (`maybeAutoAdvanceWorkflow`), a dynamic run, or the next step was blocked by an open question (the notification says why)    |
| `noop`, `missing-run`                            | the run is not in the session                                                                                                                        |
| `noop`, `not-held`                               | the run is not held, or an Approve for it is in flight: a second Approve starts nothing                                                              |
| `failed`, `message`                              | a write failed, or the planner is revising the plan; the hold stays                                                                                  |

The drawer calls `markUserStart` for the run first; `useApproveRunPlan` marks
the run as a start of yours on `approved`. The button reads **Approving** and
stays off until the call resolves.

- `approved`: the drawer closes and one `useFollowToast` toast says **Plan
  approved**, keyed `follow:<run id>`, with **Follow the run** unless the run
  page is open and uncovered. `planApprovedFollowOf` owns the toast.
- `noop`: the drawer closes and nothing shows.
- `failed`: `reportError` files "Couldn't approve the plan" and the drawer
  stays.

Each surface reads the answer through one hook: `useApproveRunPlan` (the run
tail), `usePlanPrimaryAction` (the drawer and the plan row) or
`artifact.runPlan` (the Artifacts page, the palette, the object menu).

## One primary for a plan

`planPrimaryOf({ plan, run, drafts })` (`features/plans/planPrimaryOf.ts`) is
the one rule for a plan's primary button on every surface. `run` is the live
run that owns the plan (`planOwnerOf`), found by `plan.workflowRunId`, else the
run of the planner agent that wrote it.

| Plan and run                                      | Primary                                         | Label                                                 |
| ------------------------------------------------- | ----------------------------------------------- | ----------------------------------------------------- |
| the planner is revising it                        | `disabled`, "The planner is revising this plan" | `Approve` on a run plan, `Run plan` on a session plan |
| ran, replaced, deleted or running                 | `none`                                          | none                                                  |
| a run is held for it                              | `approve`                                       | `Approve`                                             |
| its run's next step consumes it                   | `approve`                                       | `Approve`                                             |
| its run took it already (`planApproved`, no hold) | `none`, even before the run has a next step     | none                                                  |
| its run was discarded                             | `run`                                           | `Run plan`                                            |
| a session plan                                    | `run`                                           | `Run plan`                                            |

- An open question the planner asked turns the primary off with "The planner
  asked a question. Answer it first." (`plannerQuestionCount`). The chip reads
  **Needs you**, never "Revising": a revising turn is a running turn, a question
  is an open one.
- With unsent comments the kind stays and `isSecondary` is true: the comment
  bar's **Send to planner** is the one filled button. Pressing the primary asks
  "Approve without your 3 comments?" first (`unsentCommentsConfirmOf`, shared
  with `artifact.runPlan` and the **Start implementer** next step).
- `artifact.runPlan` takes its label, reason and action from this rule. On a
  held run it calls `approveWorkflowRunPlan`; on a run that is not held it
  starts the step through `runPlan`.
- A plan a live run owns is never offered as **Run plan**, **Start
  implementer** or a chat nudge. The primary, the Overview Next card
  (`deriveNextSteps` gets `isOwnedByRun` from `planOwnerOf`) and the nudge
  (`useSuggestionCards`) all read the one owner function.
- **Run plan** on a session plan is `usePlanRun` with its own toast.

## The plan drawer

The drawer (`features/artifacts/components/ArtifactDocumentDrawer`) is where a
plan is read, commented, edited and approved. A plan of the session you are on
opens over the current page (`openArtifactAnywhere`); from another page it
opens on its Artifacts page.

The header primary (`PlanPrimaryButton`) is the only **Approve** on either
surface; the comment bar holds **Send to planner**. A line under the header
says one thing at a time: the inline question, why the primary or **Edit** is
off, or who wrote this version ("v3 · Revised by planner").

### Between Approve and the next step

`planHandoffOf` names two gaps:

- `approved-waiting`: the owning run has `planApproved` and the plan has no
  consumption. For an orchestrated run the next step does not exist until the
  orchestrator decides. The chip reads **Approved** with "The run is choosing
  the next step", with no primary. When the consuming step starts the chip
  reads **Running**.
- `auto-approved`: the plan's `auto_artifacts` row is `approved` and no step
  consumed it. The chip reads **Approved** with "The Lead works from this
  plan", the Artifacts list files it under Used, and there is no Run plan. A
  held plan still waiting on approval keeps its state.

### Comment and re-plan

1. Drafts gather in the bar. Send dims the body and the chip reads "Revising to
   v3".
2. A new version settles the comments. `unchanged` says the planner answered
   without changing the plan, with **Open the reply**, and leaves the comments
   open.
3. A question the planner asked shows at the top of the body, and the bar
   waits.

## Asking the planner for a change in the chat

`buildTurnPrompt` adds a `[current-plan id="..." revision="N"]` layer
(`renderCurrentPlan`, `activePlanOf`) to every turn of a planner with an active
plan, between the shared context and your message. The planner does not depend
on provider session memory or on a history that can cut the plan. A plan that
already ran is not active and gets no layer.

The planner prompt says to write the whole updated plan as one plan block,
never a patch. When your message is a change request (`isPlanChangeRequest`: a
change verb, not a question) and the turn ends with the same plan, the chat
shows "The planner answered without changing the plan" (`unchangedPlanNote`).
An ordinary question gets no note.

## Editing a plan by hand

A hand edit saves against the revision it started from (`updatePlanBody` over
`updatePlanBodyIfRevision`, with `expectedRevision`). If the planner wrote
meanwhile the answer is `conflict` and nothing is written. A save bumps the
revision as author `user` and refreshes the session's plans and artifacts.

`planEditBlockOf` gives the reason **Edit** is off: the planner is revising,
comments are unsent, or the plan runs as two or more parallel parts, because
the parts live in the plan's metadata and a hand edit keeps them. A body that
lists parts twice shows them once (`dropPartsSection`).

`PlanEditor` with `usePlanEditor` (`features/artifacts/components/PlanEditor`)
serves the drawer and the Artifacts page (`artifact.edit`). **Edit** swaps the
body for the markdown editor; the primary becomes **Save** with **Cancel**, and
**Approve** is hidden. **Save** sends the revision the edit started from, and
`saved` leaves edit mode.

- `conflict` keeps your text with **Copy your text** and **Discard**. **Save**
  stays off, because the same save would conflict again.
- A failed write keeps your text, says so inline and files the detail through
  `reportError`.
- **Esc** leaves edit mode and never closes the drawer: the editor registers
  its own escape layer above the drawer's. A changed edit asks "Discard your
  edit?" first.

## Tests

- `run-plan-label-comes-from-plan-primary.test.ts` fails when the plan label is
  written anywhere but `planPrimaryOf`.
