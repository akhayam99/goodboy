# Workflows

A workflow runs several agents in one session, each step with its own role, model and effort. Use it to split a job into steps such as scout, plan, implement and review, and to steer the run while it goes. You choose how much it asks you and how much it may spend.

### Run a preset

To run a preset, open **Start a run** and pick **Preset** under **How**, or type `~` and its name. The run gets a Lead with the preset as its plan, and its row reads "Lead · plan Fix a layout". A preset's steps, roles and models are edited in the Workflows studio.

### Older runs

A run started before every run had a Lead stays as it was.

- On an orchestrated run a model picks each next step, with its role, model, effort and a reason. It keeps its row, its page and its line, "Workflow · Orchestrated" with a gray "older run". **Continue** and **Start** finish it on the orchestrator.
- A preset run started before keeps its line, such as "Workflow · Preset Fix a layout", and its steps.
- New runs never start the orchestrator. A draft left on **Orchestrated** opens on **Lead**.
- The orchestrator stays while such a run can still be open, then goes. The rows stay readable after that.

### A preset as the plan a run starts from

A preset you pick in **Start a run**, or one your ask matches, starts a Lead with that preset as its plan. The run's line reads "Lead · plan Fix a layout". The Lead reads your ask first, then the preset's steps.

**With the preset** sets how close the Lead keeps to the steps:

- **Keep steps** runs the saved steps in their order. The Lead asks before it adds, skips or moves one. A preset you name with `~` starts this way.
- **May change steps** lets the Lead add, skip or move a step, and it says why. A preset your ask matches starts this way.

A run started before 0.38 keeps its own line, such as "Workflow · Preset Fix a layout · Keep steps", and runs on as an older run.

### Preset and Custom

A preset is a ready sequence of steps, each with its role and model, kept in the Workflows studio. A run started from it follows it as a plan, as above. A run you like can be saved as a preset from its page with **Save as preset**.

### Built-in workflows

Start from **Refactor**, **Plan and ship** or **Fix a bug**. A built-in you delete stays deleted until you press **Restore built-in workflows**, which keeps your existing workflows as they are.

### Runs of a workflow

The Workflows list is one grid. Each row shows:

- the name, with **Built in** or **Edited** in gray;
- the roles of its steps in gray ("Scout, Implementer +1");
- the step count and when it last ran;
- a link with its run count ("3 runs", "No runs").

The row opens the workflow. A workflow with no runs offers **Start from this preset**, which opens the New session page on the Preset form with that preset picked.

The run count link opens the runs of that workflow beside the list, newest first. Each shows a state dot, its session, its spend and its age, and a row opens that run in its session. A run where the Lead followed the workflow counts too, and its row opens the Lead. Past ten runs, **All**, **Running** and **Failed** narrow the list. If the runs cannot load, the pane says so with **Retry**.

**Import workflows…** and **Restore built-in workflows…** sit in the page menu.

A run puts its session in **Needs you** on the board and in Sessions when it stopped on a failure or paused at its limit. It does the same when it finished a step and waits to continue. It uses the same words as the run's row.

### Create and edit a workflow

**New workflow** and **Duplicate workflow** open the same page, "Workflows / New workflow". It starts from **Every run**: stops, limit, edits, reply length and every role's model read "Same as Every run" until you change them.

The page asks, in order:

- **Name**.
- **Use it when**, and **First, check**: what the Lead confirms before it starts.
- **Stop and ask when**, and **Then suggest**: another workflow to offer when this one stops.
- **Usual steps**. **Draft steps** writes them from **Use it when** and **First, check**.
- **Keep steps in order**: **The Lead may adapt** or **Keep this order**.
- **Models**, one line, "Same as Every run", with **Change**.

Nothing is written until **Create workflow**. The button says why it is off: "Name it first", "Add one step or draft them", "Steps are being drafted". A name another workflow holds shows "A workflow named Fix a bug exists" under the field. If the write fails, the error shows under the form with every field kept, and **Retry** writes again. **Discard** goes back to the list and a toast offers **Undo**, which brings the draft back. A draft you leave stays open when you come back.

**Duplicate workflow** sits in the menu of a workflow page and as a button on each list row. It fills the same page with a copy, "Fix a bug copy", and writes nothing until **Create workflow**.

After **Create workflow** the page is that workflow's page, and it saves as you type. On it, **Models** shows each role in use: muted when it follows Every run, in full with **Reset** when this workflow pins a model. A row in the list says when to use that workflow.

### Saved steps

Reuse steps across workflows. The built-in steps are read-only, and **Save a copy** makes your own.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workflow-studio-steps-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workflow-studio-steps-light.webp" alt="The Workflows studio on the Saved steps tab: the 7 built-in steps Scout, Investigate, Plan, Implement, Test, Review and Update docs, each with its role, a short description and the model setting Auto, and an empty This workspace list with a New step button">
</picture>

<sub>Screenshot from Goodboy 0.40.1</sub>

### Model per step

Put a light model on a scout and a strong one on the planner. A step follows its role by default, and **Pin a model** gives it its own provider, model and effort, with the same compact provider row as the model picker. Goodboy records what actually ran.

### Asks you

Choose how often a run stops for you:

- **Every step** stops at each step.
- **After the plan** asks you to approve once, then runs on.
- **Never** goes on until the run is done or reaches its limit.

That limit is on the run, the session, or a monthly limit on every provider the run can use.

With no limit, an agent that ran 4 times in an hour without you reads **Needs you**. A notice says "Ran 4 times in an hour with no limit set." Its page says the same. Anything you write to it resets the count.

### Pause, resume and skip

#### Pause and continue

**Pause** lets the step in flight finish and starts nothing new, even after a restart. **Continue** picks up from there.

#### Stop

**Stop** in the dock waits until the step has really ended. The run reads **Stopping**, then **Stopped**, and the step reads **Not finished**. **Continue** picks that same step up. If the step does not stop, the run stays running and says so.

#### Skip a step

**Skip** passes a step that has not finished and keeps what it already wrote.

- If a step says nothing for 15 minutes, the run offers **Continue**.
- When an agent stops without saying it is done and without asking you anything, the agent page reads "This step ended without a result". It offers **Mark step done**.
- The run page shows its state, here **Needs you**, once, as a chip under the title, with **Open step 3**.
- On the step page the dock holds one state line, **Not finished**, with **Retry** and **Continue**. The composer reads "Answer the step".

### Steps that cannot finish

A step that cannot finish ends as **Not finished**, and the level you picked decides if the run goes on.

An agent that cannot finish a step says so. Goodboy also decides it for an agent that forgot to: a step that stops twice without saying it is done is not finished.

#### With Never or After the plan

- The step ends as **Not finished** in amber, the run goes on, and the next steps are told what is missing.
- The rows after it say "without step 2", and a part that depends on it does not start.
- The run ends as "Finished, 1 step not finished", never plain Done, with a link to the step.
- **Keep working** on the row sends the same agent back to the step.
- **Skipped** stays the word for a step you skipped yourself.

#### With Every step

- The step stops as blocked and **Skip step** sits on its row.
- The field on the step page, whose button reads **Continue**, is the only place to type.

Two steps in a row that do not finish stop the run at any level, and it asks. The reason shows only on the agent's own page, never on the run page or in a notification.

### Every run

Set what every new run starts with on the **Every run** tab of Workflows, between **Workflows** and **Saved steps**. It is the one home of these rows: Settings has no Runs page, and its last row, **Run defaults are in Workflows**, opens this tab.

- **Edits** sets the mode new sessions start in.
- **Agents** holds the models and **Reply length**. **Runs** holds the Lead, and **Roles** holds each role.
- **Older plan runs** holds the Orchestrator and **Models in older plan runs**, while the workspace has a plan run that is not discarded.
- **When a run stops for you** holds **Stops for your OK**, one level for workflows and the Lead.
- **Spending** holds the **Limit** with **Pause** or **Warn only**.
- **Guidance** is one field for the agents that write code, with **Polish**.
- **Advanced** stays closed and holds **Parallel agents**. It says so while they are on.

Providers and their priority stay on the **Models** page. A change reaches new runs only. Searching Runs, Run defaults or Start as in Settings finds the link here.

The limit here applies to a run started from a chat prefix or a suggestion, and the run page names it **default**. Every kind starts from this one limit. A new run starts from these rules, and a **From your rules** line shows where one run differs, with a **Reset** on that control.

### Limit

Cap what a run or a session can spend, and choose **Pause workflows** or **Warn only**. Amounts take cents, such as `2.50`, and Enter applies them. A paused run offers **Raise limit**.

### Workflow run

Follow a run step by step, with its sub-agents under their agent and one button that moves it on.

#### The run page

A preset run and an orchestrated run draw one page: the goal, one status line, the steps top down, and on a preset run **Add step** under them.

- **Agents** beside the page holds the same steps with their sub-agents.
- Pick a step and it opens as its page, with **Back** to the run.
- A sub-agent that carries a part of a plan names its wave, such as **Runs first** or **Then, in parallel**.
- The line at the end says what the run waits for.
- After a restart, **Continue all** restarts every stopped agent.

A run that stopped, whether at its limit, by you, on a failure or for an approval, still shows the questions its steps asked. Answer them from the run page as anywhere else.

#### Buttons on the run

The run header holds the one button that moves it on, such as **Start step 3**, **Review plan**, **Answer** or **Raise limit**. While nothing waits on you it holds **Pause run**, and once paused **Continue** takes its place.

Everything else sits in the run's **⋯**:

- **Stop run** acts at once, and the toast offers **Continue**.
- **Archive run** acts at once, and the toast offers **Undo**.
- **Delete run** comes last.

#### The branch of a run

Every step stays on the branch the run started on, even when you switch branch. The **Writes to** chip on the run names the branch of the step that is current.

- Closing or removing a branch that a run still uses asks first: **Stop run first** or **Unmount anyway**.
- A step whose branch was detached shows as blocked and names that branch. Its line offers **Reattach**, **Use** the branch you write to, or **Pick a branch**, and your choice starts the step.
- With no other branch to write to, it offers **Add a project**. Pick one and **Add** it, and the step starts on it. A failed add keeps the line and shows the error.

#### An orchestrated run

An orchestrated run opens from **Runs** in the session and reads as one document:

- the goal, with one chip each for when it asks you, its limit and its models, each opening only its own setting;
- one checklist of the steps it decided, the hints it read and what is left;
- the line that says what the orchestrator does now, with the reason for its last choice;
- the result once done, and the hint box at the bottom.

The checklist sits under a **Steps** label and reads top down. Each step is one quiet line: **Step 3**, the role icon, the task, the state and the time.

- The step that works now says **Running**, and a queued step says **Queued**.
- Only a step that needs you or failed takes a colored node and a thin bar at its edge.
- Rest on the role icon to see the role card.
- A set of finished sub-agents folds to one line, such as **3 scouts**, with a check. A step opens beside it.
- The time on a step row and on the line at the end counts only the time the agents worked, never the time a step waited for you.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workflow-run-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workflow-run-light.webp" alt="The Runs page of a finished run, Duplicate credit fix, writing to payments-api on hl/fix-duplicate-credit, Done with 5 steps done, three scouts under step 1, a planner, two implementers and a tester, the hints read at step 1 and step 2, two hints queued for the next decision, the summary and the Create report and Create wireframe buttons">
</picture>

<sub>Screenshot from Goodboy 0.40.1</sub>

#### The Runs page

Runs opens on your runs. **New** in the head starts the next one, and **Start a run** from ⌘K opens the field above the list, where **Esc** closes it. With no run yet the field is the page.

The groups are **Needs you**, **Running**, **Idle**, **Finished** and **Archived**. Inside them, a row reads **Stopped** for an agent you stopped and **Ready** for a preset that has not started.

The row always offers the real **Continue** or **Start**, and **Connect** when the provider is signed out. A row names the branch its run works on, and the rest as `+N`.

With two or more branches a switch groups the page **By branch** or **By state**, one choice per session. The choice stays after a reload.

- **By branch** has a group per branch or pull request series, and **No branch** comes last.
- Groups that need you come first, finished runs fold, and archived runs fold apart, last.
- A run on several branches stands in each, with **Also on feat/retry-budget**.
- With one branch the page is the same list.

A row's branch chip opens the Branch page, and a title click opens the run at once. Right click a row and pick **Rename** to edit its title.

The Branch page has a **Runs** tab with the runs, questions and artifacts of that branch, the same rows as these pages. **All runs** opens this page with the group of the branch open, in the grouping you chose. **Open branch** on a group opens that Work tab, and Back from a run returns to it.

When something listens on a port on this branch, the line under the branch name shows up to two ports with a live dot and their name, then **+1 more**. A click on a port opens it. **Ports** opens Monitoring on this branch.

### Hints to the orchestrator

Steer a run while it goes with a markdown hint, images included. A run that only reads, and has no worktree yet, still takes the images.

- **Queue** keeps the hint for the next decision. On a finished run, **Read 2 queued** reads them all in one new turn.
- **Send now** stops the step in flight, keeps what it wrote and decides again.
- A complete orchestrated run keeps a field at its end, **Continue with a hint**. Send one and the run reopens, and the orchestrator picks the next step from the goal and your hint.

The orchestrator picks the steps, so an orchestrated run has no **Add step**. When the project has more than one mount, it sees each one and sends a step to the mount whose repository the step changes. It also says how hard each step is, and Goodboy picks the model for that role and difficulty on your preferred provider. **Models in older plan runs** in Models, shown while such a run exists, lets the orchestrator name the model itself.

#### How a hint reads

Every hint is your message on the run's line, not a step. Its text sits in a bubble, with **You · read at step 3** at the end.

- Queued hints sit under the steps, under **Queued, read at the next decision**. A queued hint has an outlined bubble and says **You · not read yet**.
- A hint's text sits on one line. A hint that is cut, or has a second line, has **Show more** to read the rest and **Show less** to fold it.
- Its images are small thumbnails at the end of the same line, and a click opens them in the viewer. Esc in an open viewer returns to the thumbnail.
- A read hint sits before the step that read it. Once the step is on the list, **read at step 3** is a link that moves to the step, or opens it when it is out of view.

#### The hint box

The box under the page holds only the input and, while hints wait, one line such as **3 hints queued** with **Show**, which scrolls to them.

When the orchestrator reads a queued hint, it moves to the steps. An image you attach to a hint shows once, on its hint, and not again under the goal. The words you are typing stay in the box when a step ends or the page changes under it, and go only when the hint is saved.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workflow-hints-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workflow-hints-light.webp" alt="The foot of a run: step 5 Tester, one hint queued for the next decision with Remove, above the Hint the orchestrator box with its model GPT-5.6 Sol, High and pinned">
</picture>

<sub>Screenshot from Goodboy 0.40.1</sub>

### Why each step, and the run recap

See why each step was picked. A short **Recap** says what is done and what is left, and it is rewritten after each decision.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workflow-recap-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workflow-recap-light.webp" alt="The page of a finished orchestrated run: its goal with Done, 4 steps done and $1.21 spent, four steps with the hint read at step 3 and step 4, the closing summary and a Recap with Done and Left lists, then Create report and Create wireframe above a Continue with a hint box">
</picture>

<sub>Screenshot from Goodboy 0.40.1</sub>

### Step handoff summary

Each step starts from a short brief instead of the whole previous chat.

- A step on a model that does not keep the conversation (Cursor, Codex, Gemini) gets its history as at most 8,000 estimated tokens. The original request is always included.
- The step's transcript says what was carried over and what was left out.
- If the summary fails, Goodboy tries the other models you allow. Only then does it keep the start and end of the chat and mark the brief as degraded, with **Retry**.

### Open questions

Questions from agents arrive as cards, and the session's **Questions** page lists them.

#### The question card

- Each question arrives as one card with whether it is **Blocking**, and numbered answers with the recommended one tagged and already picked.
- Press **Enter** to send it, pick another with a number key, or write your own.
- **Let an agent decide**, **Send as message** and **Dismiss question** sit in the **More** menu of the card, so **Answer** is the one filled button.
- A blocking question holds its step until you answer or choose **Send as message**.
- When an agent asks again in a later turn, only its newest blocking question stays open.
- A run page shows the same card.
- Several questions from one agent page as "1 of 3" with the number left, and the last **Answer** sends them together.

#### The Questions page

The session's **Questions** page lists them under **Needs you** and **Answered**, with the answer in gray. A row opens its card in the drawer, and answering moves to the next one.

- With two or more branches among the questions the same **By branch** and **By state** switch applies, with the same choice for the session.
- A branch with a waiting question comes first. Its answered questions fold into **2 answered**.
- A question with no agent, or whose branch was detached, sits in **No branch**.
- A question of an agent on two branches is drawn in both groups with **Also on feat/retry-budget**. Answering, handing off or dismissing it in one group moves it in both.
- Every way to a question lands on that page with the question open. **Close** goes back to where you came from, even after the last answer.
- The role in the drawer title ("Implementer asks") opens the agent that asked, or its run step when it asked inside a run. **Open agent** in a row's right click menu does the same.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workflow-questions-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workflow-questions-light.webp" alt="The Questions page of a session: Needs you 3 and Answered 4 as rows with the agent and the age, and the question Which queue should the delivery retries run on? open in the drawer with its file and the answers Dedicated retry queue (Recommended), Shared jobs queue, Retry in process and Something else, plus Skip and the filled Answer button">
</picture>

<sub>Screenshot from Goodboy 0.40.1</sub>

### Let an agent decide

Hand a question to another agent with a hint and a model from **Let an agent decide**, then press **Send to agent**. Its answer counts as yours, and **Answer it yourself** takes it back.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workflow-question-agent-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workflow-question-agent-light.webp" alt="The Questions page of a session with Which queue should the delivery retries run on? open in the drawer on Let an agent decide: An agent decides with GPT-5.6 Sol, a hints box, Cancel, Skip and Send to agent">
</picture>

<sub>Screenshot from Goodboy 0.40.1</sub>

### Import workflows

Bring custom workflows over from your other workspaces with **Import** in the Workflows studio. Edits are reversible with the **Undo** toast or **⌘Z** outside text fields.

## Under the hood

- Provider routing: `workflowRoutingCodec.ts` reads provider ids and effort levels from the shared registry. `orchestratedRun.sqlite.test.tsx` covers a Copilot step starting and Retry after its agent write failed. Stored rows need no repair.
- Older runs: the rows stay in `session_workflows` with their `execution_mode` (`packages/db/src/migrations/m091-workflow-execution-mode.ts`), and no migration touches them. `sessionRunsOf` keeps the `orchestrated` and `preset` kinds, `runKindLineOf` words their line, and `RunsGridRow` adds the gray `NAMES.runKind.olderRun` tag. The orchestrator engine is removed no earlier than two minor releases after 0.38.0, the first release where new runs never start it ([versioning.md](../versioning.md)).
- Preset as a plan: `runRouteOf` sends a named preset to `presetRouteOf` with `follow` and a matched one with `adapt`. `startRoutedRun` spawns the Lead with `leadPlanBriefOf`, which puts the ask first, then the steps, then the closeness line. The chip words are `START_KIND_COPY.closeness` and the route words `RUN_ROUTE_COPY.closeness` (`startRoutedRun.test.ts`).
- Run transcript doors: `workflowRun.stepTranscript` and `OrchestratedTailVerb` navigate to the step agent page and close the drawer, keeping one composer (`workflowRun.subagent.test.ts`, `run-pages.test.tsx`, `failure-links.test.tsx`).
- Create and edit: `useWorkflowEditor` holds the draft; `create` is the only write of a new workflow, and `useWorkflowAutosave` runs only for a saved one. `createBlockOf` words the reason under **Create workflow**, and `startWorkflowGeneration` with `isDraftOnly` drafts steps without a write (`createWorkflow.test.tsx`, `createFlow.test.ts`, `startWorkflowGeneration.draft.test.ts`). **Models** pins steps through `pinRoleSteps` and reads them with `rolePinOf`, so a pin reaches step routing as a step pin (`stepRouting.test.tsx`). Scenes: `u52-workflow-create-*`.
- Older runs: an orchestrated run stopped halfway keeps its "Workflow · Orchestrated" row in Runs, and **Continue** finishes it on the Orchestrator with no Lead tree (`olderRunsResume.sqlite.test.tsx`).

This part is for contributors and agents who change the feature.

- Stopped run questions: `runQuestionsPlacementOf` decides if `OrchestratedTail` and `RunTail` draw the run's open questions, and where. It reads the phase and the run stop. The questions show in the paused, limit, failed, stopped, needs-approval and plan-approval phases. They also show on any stop other than `questions`, whatever the phase. In `plan-question` and `plan-revising` the planner's tail and the header Answer own the questions, so the cluster stays hidden. They sit before the state line when one question `isBlocking`, else after it. A finished run and the in-flight phases with no stop hide them.
- Stopped run questions are the same cards as in Needs you. `answerOpenQuestions`, `sendQuestionAsMessage` and `spawnQuestionDelegates` take no stop into account, so an answer reaches the asking agent as it does from the drawer.
- Stopped run tail of a preset run: `RunTail` draws the cluster from the run stop, whatever the tail verb. A step still running or an agent stopped by a restart does not hide it. `stoppedQuestionTailOf` gives each non-question stop kind its own word, so no stop reads "Waiting for your answer".
- Run tail words: `runTailOf` says one word of `NAMES` (Running, Needs you, Needs approval, Stopped, Paused, Failed, Not finished, Ready, Queued) and at most one verb. The sentence of a stop sits at the head of the agent page (`NextActionStrip`, `QuietStepStrip`), never on the tail (`runTailOf.test.ts`).
- Turn breaker: every workflow turn passes `admitWorkflowTurn`. `readAgentRunLimit` reads the session budget and the monthly rules fresh, and a failed read is reported and leaves the breaker on. A limit is a run or session limit in pause mode, or a monthly rule on every provider the agent can route to. With one, `admitRunBudget` refuses a turn past it and saves the run stop. With none, the turn claims `claimWorkflowTurn`. `haltRunawayWorkflowAgent` writes `blocked` with `stoppedBy: 'breaker'` and posts "Ran 4 times in an hour with no limit set." `resolveNextAction` reads `breaker` back as that sentence on the agent page (`resolveNextAction.test.ts`). A failed write is reported and the turn is still not sent (`store.workflow-turn-breaker.test.ts`).
- Run page checklist: `RunTreeRow` draws every step on `ActivityRow` `density="feed"`, with the step label in the `wide` ordinal slot. `runStepTone` picks the tone, so the bar shows only on attention and failed. No title is bold (`RunTree/index.test.tsx`).
- Step state: `RunTreeChecklistCells` puts `RunTreeStepState` in the `ActivityMeta` state column, then the stuck action and the time. The column says `NAMES.running`, `NAMES.queued`, or the word of a step that did not finish. A step that waits or failed shows it by node and bar only, so **Needs you** stays once on the page.
- Fold row: `RunTreeFoldRow` draws the quiet done `WorkNode` and shows the summary without its trailing **done**, which stays in the button's name (`index.folds.test.tsx`).
- Planned steps: `OrchestratedPlanRow` keeps the step columns (`w-12` ordinal, the role glyph), so its label lines up with the task of a step.
- `OrchestratedChecklist` draws the **Steps** label with `SectionLabel` and counts the top-level agents once.
- Hint node: `OrchestratedHintRow` draws a queued, reading or read hint as `ActivityMessage` `density="feed"`. The quiet message `WorkNode` sits in the `OrchestratedPlanSlot` column, and `OrchestratedHintByline` writes the byline (`hintRows.test.tsx`). `OrchestratedChecklist` draws all three states: read ones before their step or in `trailing`, queued and reading ones through `OrchestratedQueue` in `trailing`, after the read ones. `OrchestratedComposer` holds only the input and the `data-hint-queue-line` with **Show**, which scrolls `[data-hint-queue]` into view. The line floats over the input in `AnchoredLayer`.
- Hint thumbnails: the row gives `AttachmentStrip` `size="compact"` (24px, from `stripLayout`) right after the bubble. `GoalAttachmentsStrip` leaves out ids in any `hint.attachmentIds` of the run (`useRunHintAttachmentIds`).
- Hint draft: `OrchestratedComposer` keeps the unsent text in `orchestratorHintDrafts` (slice `store/slices/orchestratorHintDrafts`), keyed by run id and evicted with the run, and hands it to `OrchestratorHintComposer` as `draft`. `OrchestratedContinue`, the box on a done or blocked run, shares that entry. Text typed before the swap carries over. It empties the entry only after a successful send. The composer empties it on send. If the save fails, it calls `restoreOrchestratorHintDraft`. That writes the text only while the entry for the submitted run is empty. A newer draft is never overwritten. Staged files stay in `usePromptFiles` local state and do not survive a remount.
- Hint state: `HintRowStateProvider` in `OrchestratedRunPage` keeps its expansion and open image by run and hint id. `useHintRowState` moves focus to the same control when the row moves.
- Hint line: `RunTreeRows` hands each hint the ink of the segment above it (`railInkAbove`), and `OrchestratedHintRow` draws it through the row with `railThroughOf` and `TimelineRail`, at the height `useMeasuredNode` measures. The last hint gets no line below.
- Hint text: `useMeasuredNode` measures the bubble. Open, the body shows the lines after the first, or the whole text of a one line hint. `hintIsLong` adds the newline rule to decide when **Show more** shows.
- Hint list: `orchestratedChecklistOf` gives one read hint per row. It sends a hint read with no recorded step to the trailing hints.
- Hint images: `useHintImageItems` asks `loadGoalAttachments` once per run. A failed load is reported on the session and shows **Retry**.
- Hint figure: the `workflow-hints` figure in `docs/figures.json` still shows the old queued chip with its line count.
- Carried history: `PRIOR_TURNS_BUDGET_TOKENS` sets the 8,000 token budget.
- Run step mount: a step agent is created with `mountId` from `selectRunStepMountId`. It is the mount the orchestrator names in `step.mountId`. Else it is the mount of the run's latest step agent that has one. An id that is not a writable mount of the session is ignored, so a made-up id never starts a step elsewhere.
- Orchestrator mounts: `orchestrateNextStep` puts the writable mounts of the session in `OrchestratorInput.mounts` (id, project name, branch), for preset runs too. With two or more, `buildOrchestratorUserPrompt` lists them and `orchestratorSystemPromptFor` adds the rule that teaches the `mountId` step field. With one mount the prompts do not change.
- `prepareTurn` aims a run step at its own pin, else at that latest pin, and uses the active mount only when the run has none yet. `resolvePhaseAgent` then writes the mount the turn ran in to `agents.mount_id`, so the first step pins it.
- Not finished is `skipped` with a non-empty `outputSummary`: `notFinishedKindOf` (`@goodboy/core/workflows`) reads it, and a user skip writes no summary. A part that did not start carries the `Did not start: ` prefix and is never counted as stuck. `continueOrPause` returns `stuck` for a hands-free agent (autoRun on) that sent `<<step-stuck>>` or `<<cluster-stuck>>`, or stopped after the retry, and `finalizeWorkflowStep` or `advanceClusterImplementation` then ends it through `skipStuckStepAndAdvance` with `agentId` and `reason`. A silent stop stores `SILENT_STUCK_REASON`. `isAfterStuckAgent` blocks the second one in a row. `keepWorkingOnStep` reopens a not finished step, `composeMissingStepsSection` lists what is missing in the next kickoff, and `RunNotFinishedLinks` draws the links of the end line.
- A pinned mount that is gone blocks the step: `blockRunStepOnGoneMount` marks it `blocked` and throws `RunStepMountBlockedError`, which `orchestrateNextStep` swallows. An explicit mount on the turn overrides the pin and replaces it.
- `selectMountBlockedStep` derives the block from the store state it is given: the first root step that is `blocked` and whose pin (`pinnedMountIdOf`) is not a writable mount. It carries the branch, whether the row and the folder still allow a reattach, the active mount as the suggestion and the other writable mounts. `OrchestratedMountBlock` draws it in the run tail, with `StepProjectAdd` (it shares `ProjectPickList` with `AutoProjectAsk`) when there is no reattach and no other writable mount: it calls `ensureProjectMounted` for the session, then `resolveMountBlockedStep` with `use` on the new mount, and shows a failure inline, `orchestratedTailOf` keeps nothing beside it, and `AgentStepRow` drops the estimate of a blocked step that never started.
- `resolveMountBlockedStep` runs the three choices. It re-checks the block, attaches the mount for **Reattach**, writes `pending` and the chosen `mountId` with `invokeAgentUpdateStatus`, then calls `activateWorkflowAgent`. A failed start writes `blocked` back and rethrows.
- While a block exists, `orchestrateNextStep` returns before it decides and `addWorkflowOrchestratorHint` queues the hint, so the run never makes a second step on the same pin. `recoverStuckStep` returns for the blocked step: the block stays the one ask.
- `selectCurrentStepPin` gives the run header chip (`RunWriteDestination`): the pin of the first unsettled root step, else the last one. It replaces the session's active mount only when they differ or the pin is gone.
- The detach guard reuses the `forgetMount` check: `pinnedRunsOf` lists the open runs with a step on the mount. `mount.close` (`pinnedRunIds`, `pinnedRunLabel` on `MountFacts`) and `DetachConfirm` show **Stop run first** and **Unmount anyway**; `forgetMount` still refuses.
- Auto children already launch on the mount of their delegation.
- Re-asked questions: `autoPopulateContext` calls `supersedeEarlierBlockingQuestions`. It closes the agent's open blocking questions from earlier turns of the run. They become answered with `[resolved by agent]`, already delivered. No schema change. A question of the same turn stays.
- `holdForUserQuestion` holds a step whose agent has an open blocking question in `sessionOpenQuestions`. `continueOrPause` then never sends the continue prompt.
