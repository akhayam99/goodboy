# Workflows, plans and confirming

> **Read this when** you change a Lead run that follows a workflow, the hold
> card, how a plan is approved and used, or the **Next step** card that
> confirms a child. **Not for** the plan line in the dock
> ([chat.md](chat.md#the-plan-line)), the permission rows that turn these
> gates on ([permissions.md](permissions.md)) or the workflows themselves
> ([workflows.md](../workflows.md)).

## Following a workflow

A Lead run started on a workflow keeps one record on its tree
(`auto_trees.guide`, the `GuideRecord` of `guideSpec.ts`): the workflow's name,
first check, stop rule, suggestion and steps, whether its order is kept, the
workflows the Lead may suggest, the check state (`pending`, `passed`, `held`,
`continued`), the hold reason and suggestion, and the deviations. A run with no
workflow has no record, and nothing here applies.

`ensureRunGuide` (`store/runtime/runGuide/`) writes it once, on the first turn or
admission, from the Lead's run route (`runs.routes.<session>`: its `workflowId`,
or the preset name of an older route) and the workflow row. It starts `passed`
when the workflow has no check and no stop rule, or when the tree already has
agents. Every write goes through `changeRunGuide`, a compare and swap that names
its tree; a block's write also names its turn (generation, run, not stopped,
still deciding) and is dropped once that turn is not current.

Each turn the prompt carries a **Workflow for this run** section from the record
(`guideSectionOf`, passed to `buildAutoSystemPrompt` as `guide`), read again by
`autoSystemPromptOf` each turn.

### The gate

The gate lives in `diagnoseAdmission` (`guideGateOf`). While the check is
`pending` a writer is refused `check_pending`, named per child, and readers
pass. While it is `held` every new child is refused `held`. The refusal reaches
the Lead at its next turn like any other, so it reports the check.

### The blocks

Handled by `applyGuideBlock` (`store/runtime/auto/guide/`); `applyAutoBlock`
runs a turn's earlier `follow` and `deviate` blocks first.

- `follow` turns `pending` into `passed` and keeps its note.
- `hold` turns any state into `held`, keeps the reason and resolves `suggest`
  against the stored list (a name outside it gives no suggestion).
- `deviate` adds one line to the record, once.
- On a run with no record they are refused `spec_invalid` with a sentence.

### A held run

A held run reads **Needs you**: `AutoTreeView.hold` carries the reason and
suggestion, `autoTreeWordOf` passes it to `leadStopOf` as `isHeld`, and a rested
Lead with a hold waits like any ask (`autoWaitRootsOf`, `auto-needs-you`). The
Lead's message above the block is the question. Any message to the Lead lifts the
hold into `continued`: `submitUserMessage` adds `liftRunHoldStatement` to the
transaction that queues it, so the answer and the release commit together.

A rested Lead with a hold shows **the hold card** in the dock (`AutoDockHold`,
`holdCardOf`): the reason, **Switch to <suggestion>**, **Continue with
<workflow>** and **Stop the run** (no Switch without a suggestion). It replaces
the dock's other rows and focuses its first button when nothing else has focus.
Each button is busy while it runs; a second click does nothing.

- **Switch** (`switchHeldRun`): `changeRunRoute` starts a second Lead on the
  suggestion with the first run's findings and guidance (`changeLeadRun`), then
  `endHeldRun` stops the held run. The new run takes no provider, model or effort
  from the first. A failed start changes nothing and offers Retry; a stop that
  fails after it keeps the new run and offers a Retry that only stops the old
  one (`OldRunLeftError`).
- **Continue** sends one message through the user turn port, lifting the hold.
  A lost run or missing port shows the error with Retry.
- **Stop the run** is the tree stop; a refusal shows its notice.

### Usual steps

`AutoTreeView.guide` carries the name, steps and deviations, and **Usual steps**
(`LeadSteps`) lists them under the Lead page header. The n-th step of a role
shows done or running by the n-th delegation of that role. A skipped step shows
its reason; an added or moved one an underlined word with the reason on hover
(an added step goes after the usual ones, since the record keeps no position). A
held check marks the first waiting step as needing you. The kind chip counts the
deviations.

## Plans

A Planner's plan opens in the right drawer. Its second row shows **Needs
approval**, **Approved** or **Revising to v2**, the version, **Ask for changes**
and **Approve and start Build**.

Approval is a compare and swap on the version the drawer shows, then Auto is told
once ("Approved plan v1."). A newer version, a revise in progress, a used or a
discarded plan refuse it with a sentence and the drawer stays open. A second
click or window on an approved version does not tell Auto again. **Ask for
changes** opens Auto's chat, where a change makes Auto rework the plan into the
next version. The dock shows the newest waiting plan, never a discarded one
(`planAwaitsYou` reads only `active` plans).

### The plan gate

A writer (Implementer, Tester, Docs, Scribe, CI fixer, Rewriter) taking a plan
needs its current revision approved while Approve the plan reads Ask
(`isAdmissionPlanGateOn`). **Never** and the global approval switch read Skip.
The rows read the stored `agents.autoPlanApproval` through
`isAutoPlanApprovalRequired`; only the exact value `false` turns it off, and no
screen sets it yet.

### A used plan

A writer admitted with a plan marks it used in the admission transaction; a
reader (Reviewer, Scout) leaves it ready. That SQL write does not reach the
store by itself, so:

1. `delegate` calls the `refreshSessionArtifacts` port after an accepted or
   replayed admission, and `landAttemptRevision` after a revise lands.
2. The port (`store/runtime/auto/makeRefreshSessionArtifacts.ts`) reloads that
   session's plans and artifacts and reports a failed read without undoing the
   admission.
3. It emits `goodboy:auto-artifacts-changed` on the Auto bridge bus; a detached
   window reloads through `followArtifactAnnouncements`.

Every loader of `sessionPlans` and `sessionArtifacts` claims a read from
`sessionReads` ([typescript/state-writes.md](../typescript/state-writes.md) →
Latest only), so a late session load cannot bring a used plan back and a late
refresh cannot undo a saved edit. Without this the Next box keeps offering
**Start implementer** on a used plan.

## Confirming

A child that waits for an OK shows one **Next step** card under its line
(`AutoNextAction`, from `nextActionOf`): the proposed child as the primary tile
("Start implementer", "Revise Retry-safe credit retries to v3"), the
alternatives as tiles 2 and 3, and an optional hint field. The button reads
**Continue** (**Retry** after a failure). Keys 1 to 3 pick a tile while focus is
in the card; Enter in the hint runs it. The card has the question colour
(`AUTO_STATE_TONE.waitingOnYou`) with an inner tone bar.

- **The primary** confirms through `registerDelegationDecisionPort` with the
  hint; no model turn runs.
- **An alternative** declines the primary, then sends the root one message:
  `Next step: <role>`, then the hint. If the decline lost, nothing is sent. If
  the message fails, the card reads "Declined. Couldn't send it to Lead." with
  **Resend answer**.
- **Decline** declines and tells nothing.
- A failed start keeps the pick and hint, shows the reason and reads **Retry**.
  A `lost` answer reads "No longer open". Without a port the card says so.

The hint uses the same port in every window.

### confirmDelegation

`confirmDelegation` saves the trimmed hint and adds it to the task and kickoff in
the transaction that accepts the child, so no extra Auto turn is needed and a
retry keeps it.

- A failed save leaves the request pending. A competing decision, stop, new
  generation or lost owner returns `lost` without saving.
- A decline stores a full result with reason `declined`, because the delivery
  reads every result in the batch; it ignores hints. `storedResultOf` guards each
  reader, so a bad entry reaches Auto as one line and never stops a delivery.
- Confirm and decline check the pending state inside their transaction, so a
  late decline cannot cancel a confirmed child.
- A row changed after the proposal never loosens it
  ([permissions.md](permissions.md#changes-before-the-launch-or-the-confirm)).
