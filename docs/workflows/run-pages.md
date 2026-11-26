# Run pages

> **Read this when** you change the page of a run (orchestrated or preset),
> its header, its settings line, its step list, its tail, its composer or its
> menu. **Not for** the list of runs ([runs-list.md](runs-list.md)), the plan
> drawer ([plans.md](plans.md)) or the workflow header and back row
> ([../navigation/session-rail.md](../navigation/session-rail.md)).

A run's steps are progress you watch, not places you go. The session rail
stays on the session level and the center is one document
(`OrchestratedRunPage`, in `features/session/components/OrchestratedRun`). A
preset run draws the same page: one head (`RunPageHead`), the goal
(`OrchestratedGoal`), the step list (`OrchestratedChecklist`), then what only
that kind has. A step opens one way for every kind, as its page
(`presetRunFocusOf`, `RunStepPage`).

## The header

The header holds the run title and one primary (`runHeaderPrimaryOf`), picked
in this order:

1. An open question: **Answer** (it opens the drawer).
2. A run paused at the limit: **Raise limit**.
3. The `runPrimaryOf` verb, such as **Review plan**, **Approve and continue**,
   **Decide next step**, **Start step 2**, **Retry** or **Restore**. Every verb
   goes through `RunPrimaryAction`, so the gates and confirms are the same.
4. Else **Pause run**, or **Continue** once paused (`workflowRun.resume`), as a
   quiet word (`RunLiveVerbs`). The tail then says Paused by you with no verb.

- A run the orchestrator stopped on a human call has no header button: its
  action is the docked field **Add a hint and continue**.
- A halted step (failed, or blocked on a question or an ended turn) makes the
  primary **Open step 3** (`runPrimaryOf` kind `open-step`, the number from
  `OrchestratorState.haltedStepNumber`, or `haltedStepOf` on a preset run).
- While the plan pane is open, **Review plan** goes quiet.
- An archived run shows **Restore**, reads dimmed and has no composer.

The right click on the title lists the run `⋯` items.

## The goal and the settings line

`OrchestratedGoal` shows the goal, then one glance line (`RunGlanceLine`): the
state word, one sentence from `runGlanceOf`, the spend of the limit and the run
settings. Every run kind uses it.

While the run lives, each setting is one word (`RunSettingsLine`) that opens
its own popover (`AnchoredPopover`): the control, one line of help, and where
the value comes from (`runSettingsOf`).

- The limit word reads the limit that comes first, never the spend, so a number
  shows once.
- There is no Save: a choice applies on click, the limit on Enter or on close.
  A failed write keeps the old value and shows the error, in the log when the
  popover already closed.
- **Models** switches each provider the run may use
  (`setWorkflowRunProviderPool`, latest answer wins, Undo puts the old
  providers back). A change applies from the next step.

**Show guidance** holds the one text the orchestrator reads
(`orchestratorProcessText`). The write destination shows while 2 or more
worktrees can be written (`RunWriteDestination`).

## Plan and progress

`OrchestratedChecklist` lists the decided steps in execution order on the run
step tree (`RunTree` with density `checklist`). The glyph slot is fixed at two
levels (`RUN_TREE_SLOT_WIDTH`), so nesting shows only on the tracks and in the
"3.1" label. A row opens the step's page with the orchestrator's reason at the
top (`stepReasonOf`).

- While no step runs and the orchestrator chooses (`isBetweenStepsPhase`), one
  row after the last step shows the running node (`OrchestratedNowRow`). The
  tail then draws no line of its own.
- The recap's **Left** items that name a role follow as dashed rows, so plan
  and progress are one list (`orchestratedChecklistOf`). A role comes from
  `leftRoles`; an unknown role is dropped.
- A Left entry with no role is not a step. It sits in a folded **Left open**
  list (`OrchestratedNotes`).
- An entry that repeats a step already listed shows once (`isSameIntent`: same
  text apart from case, spacing and punctuation). A reworded entry is never
  hidden.

Each read hint is one row (`OrchestratedHintRow`) before the step whose
decision read it, with "read at step 4" linking to that step. While that step
has no row, or the hint has no recorded step, the hint sits after the steps.

## The tail

The tail (`OrchestratedTail`, phrases in `orchestratedTailOf`) speaks the phase
of `resolveOrchestratorState` once, at the end. The move each phase waits for
is the header primary, never a second button on the tail.

- A running step reads as working; "Waiting" is kept for a run that waits on
  you. The one Stop is in the dock.
- A failed decision shows the stop message, or "no reason was recorded."
  (`decisionFailureOf`), with model ids as display names (`modelNamesIn`) and
  **Open transcript**.
- A run the orchestrator stopped on a human call shows its reason inline, with
  **Open transcript** to the last step's page, which carries it as its "Why:"
  line.
- Queued hints on a finished run add **Read 2 queued**, or **Continue and read
  2 queued** after a stop.
- A finished or archived run has no tail.

A step's reason reads on the step's page, never on the run page.

### A halted step

A halted step reads **Needs you** once on the run page (the glance; the tail
stays out, `phase` `step-failed`) with **Open step 3** in the header, and no
reason, field or step verb.

The step page keeps the question once, in the transcript, and one state line in
the conversation dock (`ConversationDock/DockStepLine`, the word from
`runStateFromKind` `halted-blocked`) with **Retry** and **Continue**
([step-end.md](step-end.md#the-dock-of-a-blocked-step)). The restart prompt
asks the agent to repeat a question it had asked.

### An open question

A real open question (phase `needs-answer`, a preset run's tail too) shows the
transcript's card (`RunOpenQuestion` renders `OpenQuestionCluster`).

- Several open questions from one agent page in creation order
  (`askingAgentBatch`, `questionsLeft`). **Answer** keeps each pick, and the
  last **Answer** sends every pick in one call, so the agent resumes once.
  Another agent's questions wait for the next batch.
- A question an agent is already answering for you shows as waiting and never
  counts toward the send (`partitionDelegatedQuestions`).
- A send that fails before the answers are saved keeps every pick and reports
  "Couldn't send your answers"; **Answer** sends the same batch again
  (`useAnswerQuestion`).
- A send that fails after they are saved keeps the batch in the store
  (`pendingOpenQuestionDeliveries`), and the tail shows **Retry**
  (`RunPendingDelivery`) until the agent gets them. Retry only sends again and
  never saves twice.

A step that stops while one of its blocking questions is open is never nudged
to continue. A step that asks again in a later turn replaces its earlier
blocking questions of that run: they close as "Resolved by the agent" and are
never sent (`holdForUserQuestion`, `supersedeEarlierBlockingQuestions`).

## The result

`OrchestratedResult` shows on a finished run of any kind: the closing reason
and the recap, or the last finished step's summary on a preset run
(`runOutcomeTextOf`), then the report, wireframe and branch actions. A finished run hides Settings.

An orchestrated run never offers **Add step**: the orchestrator picks the
steps. **Add step** stays on preset runs, finished ones too.

## Continue with a hint

`OrchestratedContinue` docks in place of the composer once the run is
complete, or as **Add a hint and continue** once the orchestrator stopped on a
human call.

1. `continueWithHint` (store `workflows`) saves the hint as a queued hint.
2. `clearOrchestrationOutcome` reopens the run and clears the block (the same
   reopen `continueWorkflowRun` and Add step use).
3. The orchestrator decides the next step from the goal, the decisions and the
   hint.

A failed reopen removes the hint again, keeps the text and says "Couldn't
continue the run" with **Retry**; the run stays complete. When another window
reopened the run first, the hint is only queued. A hint is marked read only
once a step started with it, so a blocked decision, a step that was not created
and a next step the routing refused all leave the hints unread.

## The composer

`OrchestratedComposer` docks while the run lives. Enter queues, **Send now**
(⌘Enter) reads it now (`readNowCopy` tooltips).

- Queued hints sit under the steps, each with **Remove**, disabled while a
  decision reads it.
- While the queue is out of view (`useIsQueueOutOfView`) one line counts it
  (`hintQueueOf`, a hint being read left out).
- The orchestrator's model pill sits only in the composer's footer
  (`OrchestratorRoutingRow`).

What a hint does to the run is in [orchestrator.md](orchestrator.md#hints).

## The run menu

The run `⋯` is the `workflowRun` registry minus the verbs the tail and header
carry, five rows at most (`RunPageActions`).

- While a run lives: **Skip step N**, Rename, Step routing
  (`OrchestratedRouting`), Stop run, Archive run.
- Once it ended: Rename, Open in Changes, Save as preset, Archive run, Delete
  run.
- The rest stays on the right click of the title, which takes focus, so ⇧F10
  opens it.
- An ended run never offers Stop run, also when its steps are done but a helper
  failed. Asks you is left out: its chip holds it.

What Stop run, Archive run and Delete run do is in
[advancing.md](advancing.md#closing-a-run).

## Only on a preset run

- **Overview** (`RunOverviewPage`): the head, the goal, the step list with
  **Add step**, the result, then the run tail.
- **A step** (`RunStepPage`): the step's conversation, embedded
  (`AgentDetailPane` with a `runStep` frame), for every run kind. The step `⋯`
  (`RunStepActions`) holds Open transcript and Skip step N; on a helper's page
  Skip skips the step the helper belongs to. The thinking line ends in **Stop
  step 2** (`stepStopLabelOf`, through `RunStepFrame.stopLabel`).
- On a step page the run's next move reads on the quiet line at the end. There
  is no next action card and no Start chip.

`RunTail` (phrases in `runTailOf`) speaks for a preset run once, at the end,
and says nothing while the step on screen runs. On the overview the header holds the primary (with `StartStepPrimary` and its
Start anyway confirm, and `WorkflowRunStartButton`). On a step page the same
verb sits on the tail as a secondary button.

The moves of an orchestrated run stay on its run page. On one of its step pages
the tail reads one word, **Stopped**, **Failed**, **Needs you** or **Ready**,
with **Open run** (`runTailOf`, `openRun`).
