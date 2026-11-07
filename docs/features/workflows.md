# Workflows

A workflow runs several agents in one session, each step with its own role, model and effort. Use it to split a job into steps such as scout, plan, implement and review, and to steer the run while it goes. You choose how much it asks you and how much it may spend.

### Start a workflow

A workflow run starts from the New session page: pick **Orchestrated** or **Preset**, and press **Start workflow**. From **Start a run** Auto picks a workflow when the ask has steps, or type `~` and a preset name to follow that preset. A preset's steps, roles and models are edited in the Workflows studio.

### Orchestrated

Give a goal and a model picks each next step, with its role, model, effort and a reason. It stops when done or blocked.

### A preset as the plan a run starts from

A run started from a preset in **Start a run** follows that preset as a plan, and the line under its title says "Workflow · Preset Fix a layout · Adapt as it goes · 1 change". **Adapt as it goes** may add a step when a finding asks for it, skip one whose work is done, or move one that has not started; each change is tagged **Added**, **Skipped** or **Moved** in the checklist with its reason as the step's Why. **Follow it** never changes a step on its own: when one does not fit, the run stops and asks, with **Add it**, **Skip** and **Switch to adapt**. A pinned step runs as written and is never skipped or moved. Your goal, guidance and hints always rank above the preset.

### Preset and Custom

A preset is a ready sequence of steps, each with its role and model, kept in the Workflows studio. A run started from it follows it as a plan, as above; a run you like can be saved as a preset from its page with **Save as preset**.

### Built-in workflows

Start from **Refactor**, **Plan and ship** or **Fix a bug**. A built-in you delete stays deleted until you press **Restore built-in workflows**, which keeps your existing workflows as they are.

### Runs of a workflow

The Workflows list is one grid: name, **Built in** or **Edited** in gray, the roles of its steps in gray ("Scout, Implementer +1"), the step count, when it last ran, and a link with its run count ("3 runs", "No runs"). The row opens the workflow. A workflow with no runs offers **Start from this preset**, which opens the New session page on the Preset form with that preset picked. The run count link opens the runs of that workflow beside the list, newest first, each a state dot, its session, its spend and its age; a row opens that run in its session. **Import workflows…** and **Restore built-in workflows…** sit in the page menu. Past ten runs, **All**, **Running** and **Failed** narrow the list. If the runs cannot load, the pane says so with **Retry**.

A run that stopped on a failure, paused at its limit or finished a step and waits for you to continue puts its session in **Needs you** on the board, in the sidebar and for the next-session key, with the same words as the run's row.

### Saved steps

Reuse steps across workflows. The built-in steps are read-only, and **Save a copy** makes your own.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workflow-studio-steps-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workflow-studio-steps-light.webp" alt="The Workflows studio on the Saved steps tab: the 7 built-in steps Scout, Investigate, Plan, Implement, Test, Review and Update docs, each with its role, a short description and the model setting Auto, and an empty This workspace list with a New step button">
</picture>

<sub>Screenshot from Goodboy 0.27.1</sub>

### Model per step

Put a light model on a scout and a strong one on the planner. A step follows its role by default, and **Pin a model** gives it its own provider, model and effort, with the same compact provider row as the model picker. Goodboy records what actually ran.

### Asks you

Choose how often a run stops for you: **Every step**, **After the plan** to approve once and then run on, or **Never**. The old names (Autonomy, Ask me, Balanced, Autopilot) still find it in search. A guard stops an unattended agent after 4 turns in an hour, and anything you write to it resets the count.

### Pause, resume and skip

**Pause** lets the step in flight finish and starts nothing new, even after a restart, and **Continue** picks up from there.

**Stop step** waits until the step has really ended: the run reads **Stopping**, then **Stopped**, and the step reads **Not finished**. **Continue** picks that same step up, and the run keeps its stop until the step has started again. When the run went on its own before you stopped it, Continue turns that back on, also after a reload. If the step does not stop, the run stays running and says so.

**Skip** passes a step that has not finished and keeps what it already wrote. If a step says nothing for 15 minutes, the run offers **Continue**. When an agent stops without saying it is done and without asking you anything, the step page and the agent page read "This step ended without a result". They offer **Continue** and **Mark step done**. The run page reads only **Not finished**, with **Retry step** and the answer field. Goodboy also moves a step to that state within a few seconds if it is still running after its turn ended with nothing to continue it. That adds one line to the app log.

### Steps that cannot finish

A step that cannot finish ends as **Not finished**, and the level you picked decides if the run goes on.

An agent that cannot finish a step says so. Goodboy also decides it for an agent that forgot to: a step that stops twice without saying it is done is not finished. With **Never** or **After the plan** the step ends as **Not finished** in amber, the run goes on, and the next steps are told what is missing. The rows after it say "without step 2", and a part that depends on it does not start. The run ends as "Finished, 1 step not finished", never plain Done, with a link to the step. **Keep working** on the row sends the same agent back to the step. **Skipped** stays the word for a step you skipped yourself.

With **Every step** the step stops as blocked and **Skip step** sits on its row. The input at the bottom, whose button reads **Keep working**, is the only place to type. Two steps in a row that do not finish stop the run at any level, and it asks. The reason shows only on the agent's own page, never on the run page or in a notification.

### Run defaults

Set what every new run starts with on the **Run defaults** page in Settings. It uses the same chips a run page shows: how it asks, the limit, the models and shared **Guidance** for the agents that write code. A change reaches new runs only. The limit here applies to a run started from a chat prefix or a suggestion, and the run page names it **default**. Every kind starts from this one limit; a limit saved earlier as the Auto limit is folded into it. A new run starts from them, and a **From your rules** line shows where one run differs, with a **Reset** on that control. Provider order lives in **Open Providers**.

### Limit

Cap what a run or a session can spend, and choose **Pause workflows** or **Warn only**. Amounts take cents, such as `2.50`, and Enter applies them. A paused run offers **Raise limit**.

### Workflow run

Follow a run step by step, with its sub-agents under their agent and one button that moves it on. A preset run and an orchestrated run draw one page: the goal, one status line, the steps top down, and on a preset run **Add step** under them. **Agents** beside the page holds the same steps with their sub-agents. Pick a step and it opens as its page, with **Back** to the run. A sub-agent that carries a part of a plan names its wave, such as **Runs first** or **Then, in parallel**. The line at the end says what the run waits for. Every step stays on the branch the run started on, even when you switch branch. Closing or removing a branch that a run still uses asks first: **Stop run first** or **Detach anyway**. A branch whose row is already closed cannot be forgotten until the run stops. A step whose branch was detached shows as blocked and names that branch. Its line offers **Reattach**, **Use** the branch you write to, or **Pick a branch**, and your choice starts the step. With no other branch to write to, it offers **Add a project**. Pick one and **Add** it, and the step starts on it. A failed add keeps the line and shows the error. A new hint waits in the queue until you choose. The **Writes to** chip on the run names the branch of the step that is current. The run header holds the one button that moves it on, such as **Start step 3**, **Review plan**, **Answer** or **Raise limit**, or **Pause run** while nothing waits on you (once paused, **Continue** takes its place). Everything else sits in the run's **⋯** in one order: see, steer, settings, copy, then **Stop run** (it asks first), **Archive run** and **Delete run**. An orchestrated run opens from **Runs** in the session and reads as one document: the goal with one chip each for when it asks you, its limit and its models (each opens only its own setting, applied as you pick it), one checklist of the steps it decided, the hints it read and what is left, the line that says what the orchestrator does now with the reason for its last choice, the result once done, and the hint box at the bottom. The checklist sits under a **Steps** label. The step that works now is bold, and finished and queued steps are gray. A step opens beside it. The time on a step row and on the line at the end counts only the time the agents worked, never the time a step waited for you. After a restart, **Continue all** restarts every stopped agent.

A run that stopped, whether at its limit, by you, on a failure or for an approval, still shows the questions its steps asked. They sit above the line that says why it stopped when they block the run, and below it otherwise. Answer them from the run page as anywhere else.

While the session's workflows load, the run page draws its goal, its facts and three step rows as a skeleton, after 120 ms and never as a blank page.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workflow-run-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workflow-run-light.webp" alt="The Runs page of the session in the app, with the run Duplicate credit fix on GPT-6.1 Sol, pinned at High, writing to payments-api on hl/fix-duplicate-credit, with Steps 5 all done: three scouts under step 1, a planner, two implementers and a tester, the two hints read at step 1 and step 2, the orchestrator summary and the Create report and Create wireframe buttons">
</picture>

<sub>Screenshot from Goodboy 0.31.10</sub>

Runs opens on your runs. A quiet **Start a run** row opens the field in place, and **Esc** closes it. With no run yet the field is the page.

The groups are **Needs you**, **Running**, **Idle**, **Finished** and **Archived**. An agent you stopped reads **Stopped**. A preset that has not started reads **Ready**. The row always offers the real **Continue** or **Start**, and **Connect** when the provider is signed out. A row names the branch its run works on, and the rest as `+N`.

With two or more branches a switch groups the page **By branch** or **By state**, one choice per session. **By branch** has a group per branch or pull request series, and **No branch** comes last. Groups that need you come first, finished runs fold, and archived runs fold apart, last. The choice stays after a reload. A run on several branches stands in each, with **Also on feat/retry-budget**. With one branch the page is the same list.

A row's branch chip opens the Branch page, **Also on** shows the same run in its other group, and a title click opens the run at once. Right click a row and pick **Rename** to edit its title. The Branch page says **On this branch** with a link per kind, such as **3 runs** and **2 questions**. Each opens that page, **By branch**, with the group of the branch open. Back returns to the branch.

### Hints to the orchestrator

Every hint is a round node on the run's line, like a step, and the line runs through it without a break. It runs on through several hints that come after the last step. Queued hints sit on that line under the steps, under the heading **Queued, read at the next decision**. A queued hint has a dashed node. Its text sits on one line. A hint that is cut, or has a second line, has **Show more** to read the rest and **Show less** to fold it. Its images are small thumbnails at the end of the same line, and a click opens them in the viewer.

The box under the page holds only the input and, while hints wait, one line such as **3 hints queued** with **Show**, which scrolls to them. That line never moves the input. The queue stays on the line when a run is blocked and the input swaps to **Continue**. When the orchestrator reads a queued hint, it moves to the steps. An image you attach to a hint shows once, on its hint, and not again under the goal. Focus stays on your thumbnail. Esc in an open viewer returns to it.

A read hint says **Read at step 3** before that step. Once the step is on the list, the words are a link that moves to the step, or opens it when it is out of view. Until then they are plain text. A hint keeps its open text and its open image when the orchestrator reads it. The words you are typing stay in the box when a step ends or the page changes under it, and go only when the hint is saved.

Steer a run while it goes with a markdown hint, images included. A run that only reads, and has no worktree yet, still takes the images. **Queue** keeps it for the next decision; on a finished run, **Read 2 queued** reads them all in one new turn. **Send now** stops the step in flight, keeps what it wrote and decides again. A complete orchestrated run keeps a field at its end, **Continue with a hint**: send one and the run reopens and the orchestrator picks the next step from the goal and your hint. The orchestrator picks the steps, so an orchestrated run has no **Add step**. When the project has more than one mount, it sees each one and sends a step to the mount whose repository the step changes. It also says how hard each step is, and Goodboy picks the model for that role and difficulty on your preferred provider; **Models in workflows** in Models lets the orchestrator name the model itself.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workflow-hints-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workflow-hints-light.webp" alt="The orchestrator hint box of a run: two queued hints, each with Remove, above the Hint the orchestrator box with its model GPT-5.6 Sol, High and pinned">
</picture>

<sub>Screenshot from Goodboy 0.27.1</sub>

### Why each step, and the run recap

See why each step was picked. A short **Recap** says what is done and what is left, and it is rewritten after each decision.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workflow-recap-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workflow-recap-light.webp" alt="The page of a finished orchestrated run: its goal with Can use Claude, Codex, Limit $3.00 and $1.21 spent, four steps with the hint read at step 3 and step 4, the closing summary and a Recap with Done and Left lists, then Create report and Create wireframe above a Continue with a hint box">
</picture>

<sub>Screenshot from Goodboy 0.27.1</sub>

### Step handoff summary

Each step starts from a short brief instead of the whole previous chat. When a step runs on a model that does not keep the conversation (Cursor, Codex, Gemini), its history comes as at most 8,000 estimated tokens with the original request always included, and the step's transcript says what was carried over and what was left out. If the summary fails, Goodboy tries the other models you allow, and only then keeps the start and end of the chat and marks the brief as degraded, with **Retry**.

### Open questions

Each question arrives as one card with whether it is **Blocking**, and numbered answers with the recommended one tagged and already picked. Press **Enter** to send it, pick another with a number key, or write your own. **Let an agent decide**, **Send as message** and **Dismiss question** sit in the **More** menu of the card, so **Answer** is the one filled button. A blocking question holds its step until you answer or choose **Send as message**. The step is not nudged to carry on while it waits. When an agent asks again in a later turn, only its newest blocking question stays open. A run page shows the same card. Several questions from one agent page as "1 of 3" with the number left, and the last **Answer** sends them together. The session's **Questions** page lists them under **Needs you** and **Answered**, with the answer in gray; a row opens its card in the drawer, and answering moves to the next one. With two or more branches among the questions the same **By branch** and **By state** switch applies, with the same choice for the session. A branch with a waiting question comes first. Its answered questions fold into **2 answered**. A question with no agent, or whose branch was detached, sits in **No branch**. A question of an agent on two branches is drawn in both groups with **Also on feat/retry-budget**. Answering, handing off or dismissing it in one group moves it in both. Every way to a question lands on that page with the question open, and a reload brings it back. **Close** goes back to where you came from, even after the last answer. The role in the drawer title ("Implementer asks") opens the agent that asked, or its run step when it asked inside a run, and **Open the agent** in a row's right click menu does the same; an agent that was deleted keeps its role with no link.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workflow-questions-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workflow-questions-light.webp" alt="The Questions page of a session: Needs you 3 and Answered 4 as rows with the agent and the age, and the question Which queue should the delivery retries run on? open in the drawer with its file and the answers Dedicated retry queue (Recommended), Shared jobs queue, Retry in process and Something else, plus Let an agent decide, Skip, Send as message and Answer">
</picture>

<sub>Screenshot from Goodboy 0.27.1</sub>

### Let an agent decide

Hand a question to another agent with a hint and a model from **Let an agent decide**, then press **Send to agent**. Its answer counts as yours, and **Answer it yourself** takes it back.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workflow-question-agent-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workflow-question-agent-light.webp" alt="The Questions page of a session with Which queue should the delivery retries run on? open in the drawer on Let an agent decide: An agent decides with GPT-5.6 Terra Medium, a hints box, Cancel, Skip and Hand off">
</picture>

<sub>Screenshot from Goodboy 0.27.1</sub>

### Import workflows

Bring custom workflows over from your other workspaces with **Import** in the Workflows studio. Edits are reversible with the **Undo** toast or **⌘Z** outside text fields.

## Under the hood

- Run transcript doors: `workflowRun.stepTranscript` and `OrchestratedTailVerb` navigate to the step agent page and close the drawer, keeping one composer (`workflowRun.subagent.test.ts`, `run-pages.test.tsx`, `failure-links.test.tsx`).

This part is for contributors and agents who change the feature.

- Stopped run questions: `runQuestionsPlacementOf` decides if `OrchestratedTail` and `RunTail` draw the run's open questions, and where. It reads the phase and the run stop. The questions show in the paused, limit, failed, stopped, needs-approval and plan-approval phases. They also show on any stop other than `questions`, whatever the phase. In `plan-question` and `plan-revising` the planner's tail and the header Answer own the questions, so the cluster stays hidden. They sit before the state line when one question `isBlocking`, else after it. A finished run and the in-flight phases with no stop hide them.
- Stopped run questions are the same cards as in Needs you. `answerOpenQuestions`, `sendQuestionAsMessage` and `spawnQuestionDelegates` take no stop into account, so an answer reaches the asking agent as it does from the drawer.
- Stopped run tail of a preset run: `RunTail` draws the cluster from the run stop, whatever the tail verb. A step still running or an agent stopped by a restart does not hide it. `stoppedQuestionTailOf` gives each non-question stop kind its own phrase, so no stop reads "Waiting for your answer".
- Run page checklist: `RunTreeChecklistCells` sets a step that runs, waits or failed in `text-row-strong`.
- Every other step is `text-ui`, gray until hover.
- `OrchestratedChecklist` draws the **Steps** label with `SectionLabel` and counts the top-level agents once.
- Hint node: `OrchestratedHintRow` draws a queued, reading or read hint with `WorkNode` in the `OrchestratedPlanSlot` column. `OrchestratedChecklist` draws all three states: read ones before their step or in `trailing`, queued and reading ones through `OrchestratedQueue` in `trailing`, after the read ones. `OrchestratedComposer` holds only the input and the `data-hint-queue-line` with **Show**, which scrolls `[data-hint-queue]` into view.
- Hint thumbnails: the row gives `AttachmentStrip` `size="compact"` (24px, from `stripLayout`) in a fixed `w-14` slot, so text truncates evenly. `GoalAttachmentsStrip` leaves out ids in any `hint.attachmentIds` of the run (`useRunHintAttachmentIds`).
- Hint draft: `OrchestratedComposer` keeps the unsent text in `orchestratorHintDrafts` (slice `store/slices/orchestratorHintDrafts`), keyed by run id and evicted with the run, and hands it to `OrchestratorHintComposer` as `draft`. `OrchestratedContinue`, the box on a done or blocked run, shares that entry. Text typed before the swap carries over. It empties the entry only after a successful send. The composer empties it on send. If the save fails, it calls `restoreOrchestratorHintDraft`. That writes the text only while the entry for the submitted run is empty. A newer draft is never overwritten. Staged files stay in `usePromptFiles` local state and do not survive a remount.
- Hint state: `HintRowStateProvider` in `OrchestratedRunPage` keeps its expansion and open image by run and hint id. `useHintRowState` moves focus to the same control when the row moves.
- Hint line: `RunTreeRows` hands each hint the ink of the segment above it (`railInkAbove`), and `OrchestratedHintRow` draws it through the row with `railThroughOf` and `TimelineRail`, at the height `useRowHeight` measures. The last hint gets no line below.
- Hint text: `useIsClipped` measures the line. `hintIsLong` adds the newline rule to decide when **Show more** shows.
- Hint list: `orchestratedChecklistOf` gives one read hint per row. It sends a hint read with no recorded step to the trailing hints.
- Hint images: `useHintImageItems` asks `loadGoalAttachments` once per run. A failed load is reported on the session and shows **Retry**.
- Hint figure: the `workflow-hints` figure in `docs/figures.json` still shows the old queued chip with its line count.
- Carried history: `PRIOR_TURNS_BUDGET_TOKENS` sets the 8,000 token budget.
- Run step mount: a step agent is created with `mountId` from `selectRunStepMountId`. It is the mount the orchestrator names in `step.mountId`. Else it is the mount of the run's latest step agent that has one. An id that is not a writable mount of the session is ignored, so a made-up id never starts a step elsewhere.
- Orchestrator mounts: `orchestrateNextStep` puts the writable mounts of the session in `OrchestratorInput.mounts` (id, project name, branch), for preset runs too. With two or more, `buildOrchestratorUserPrompt` lists them and `orchestratorSystemPromptFor` adds the rule that teaches the `mountId` step field. With one mount the prompts do not change.
- `prepareTurn` aims a run step at its own pin, else at that latest pin, and uses the active mount only when the run has none yet. `resolvePhaseAgent` then writes the mount the turn ran in to `agents.mount_id`, so the first step pins it.
- Not finished is `skipped` with a non-empty `outputSummary`: `notFinishedKindOf` (`@goodboy/core/workflows`) reads it, and a user skip writes no summary. A part that did not start carries the `Did not start: ` prefix and is never counted as stuck. `continueOrPause` returns `stuck` for a hands-free agent (autoRun on) that sent `<<step-stuck>>` or `<<cluster-stuck>>`, or stopped after the retry, and `finalizeWorkflowStep` or `advanceClusterImplementation` then ends it through `skipStuckStepAndAdvance` with `agentId` and `reason`. A silent stop stores `SILENT_STUCK_REASON`. `isAfterStuckAgent` blocks the second one in a row. `keepWorkingOnStep` reopens a not finished step, `composeMissingStepsSection` lists what is missing in the next kickoff, and `RunNotFinishedLinks` draws the links of the end line.
- A pinned mount that is gone blocks the step: `blockRunStepOnGoneMount` marks it `blocked` and throws `RunStepMountBlockedError`, which `orchestrateNextStep` swallows. An explicit mount on the turn overrides the pin and replaces it.
- `selectMountBlockedStep` derives the block from the store state it is given: the first root step that is `blocked` and whose pin (`pinnedMountIdOf`) is not a writable mount. It carries the branch, whether the row and the folder still allow a reattach, the active mount as the suggestion and the other writable mounts. `OrchestratedMountBlock` draws it in the run tail, with `StepProjectAdd` (it shares `ProjectPickList` with `AutoProjectAsk`) when there is no reattach and no other writable mount: it calls `ensureProjectMounted` for the session, then `resolveMountBlockedStep` with `use` on the new mount, and shows a failure inline, `orchestratedTailOf` keeps only **Retry step** beside it, and `AgentStepRow` drops the estimate of a blocked step that never started.
- `resolveMountBlockedStep` runs the three choices. It re-checks the block, attaches the mount for **Reattach**, writes `pending` and the chosen `mountId` with `invokeAgentUpdateStatus`, then calls `activateWorkflowAgent`. A failed start writes `blocked` back and rethrows.
- While a block exists, `orchestrateNextStep` returns before it decides and `addWorkflowOrchestratorHint` queues the hint, so the run never makes a second step on the same pin. `recoverStuckStep` returns for the blocked step: the block stays the one ask.
- `selectCurrentStepPin` gives the run header chip (`RunWriteDestination`): the pin of the first unsettled root step, else the last one. It replaces the session's active mount only when they differ or the pin is gone.
- The detach guard reuses the `forgetMount` check: `pinnedRunsOf` lists the open runs with a step on the mount. `mount.close` (`pinnedRunIds`, `pinnedRunLabel` on `MountFacts`) and `DetachConfirm` show **Stop run first** and **Detach anyway**; `forgetMount` still refuses.
- Auto children already launch on the mount of their delegation.
- Re-asked questions: `autoPopulateContext` calls `supersedeEarlierBlockingQuestions`. It closes the agent's open blocking questions from earlier turns of the run. They become answered with `[resolved by agent]`, already delivered. No schema change. A question of the same turn stays.
- `holdForUserQuestion` holds a step whose agent has an open blocking question in `sessionOpenQuestions`. `continueOrPause` then never sends the continue prompt.
