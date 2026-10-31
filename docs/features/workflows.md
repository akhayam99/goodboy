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

A preset is not a skill. A skill is a markdown file next to your code that you call by name with `/skill-name`, for a way of working you repeat; a preset is a run you want again, with its steps in order. Where skills live, and the older `.kay` folder Goodboy still reads, is in [concepts.md](../concepts.md#skills).

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

**Pause** lets the step in flight finish and starts nothing new, even after a restart, and **Resume** picks up from there. **Skip** passes a step that has not finished and keeps what it already wrote. If a step says nothing for 15 minutes, the run offers **Ask it to continue**. When an agent stops without saying it is done and without asking you anything, the run page and the agent page read "This step ended without a result". They offer **Continue** and **Mark step done**. Goodboy also moves a step to that state within a few seconds if it is still running after its turn ended with nothing to continue it. That adds one line to the app log.

### Run defaults

Set what every new run starts with in the **Run defaults** tab. It uses the same chips a run page shows: how it asks, the limit, the models, the **Auto limit** and shared **Guidance** for the agents that write code. A change reaches new runs only. The limit here applies to a run started from a chat prefix or a suggestion, and the run page names it **default**. Orchestrated and Preset start from this limit, Auto from the **Auto limit**. A new run starts from them, and a **From your rules** line shows where one run differs, with a **Reset** on that control. Provider order lives in **Open Providers and models**.

### Limit

Cap what a run or a session can spend, and choose **Pause workflows** or **Warn only**. Amounts take cents, such as `2.50`, and Enter applies them. A paused run offers **Raise limit**.

### Workflow run

Follow a run step by step, with its sub-agents under their agent and one button that moves it on. Open a preset run and the session rail steps into it. The rail shows **Overview**, every step in order with its sub-agents, **Add step** at the end, and the run's limit and spend at the foot. The center shows the step you pick as its conversation. A sub-agent that carries a part of a plan names its wave, such as **Runs first** or **Then, in parallel**. The line at the end says what the run waits for. Every step stays on the branch the run started on, even when you switch branch. Closing or removing a branch that a run still uses asks first: **Stop run first** or **Detach anyway**. A branch whose row is already closed cannot be forgotten until the run stops. A step whose branch was detached shows as blocked and names that branch. Its line offers **Reattach**, **Use** the branch you write to, or **Pick a branch**, and your choice starts the step. A new hint waits in the queue until you choose. The **Writes to** chip on the run names the branch of the step that is current. The run header holds the one button that moves it on, such as **Start step 3**, **Review plan**, **Answer** or **Raise limit**, or **Pause run** while nothing waits on you (once paused, **Resume run** takes its place). Everything else sits in the run's **⋯** in one order: see, steer, settings, copy, then **Stop run** (it asks first), **Archive run** and **Delete run**. An orchestrated run opens from **Runs** in the session and reads as one document: the goal with one chip each for when it asks you, its limit and its models (each opens only its own setting, applied as you pick it), one checklist of the steps it decided, the hints it read and what is left, the line that says what the orchestrator does now with the reason for its last choice, the result once done, and the hint box at the bottom. The checklist sits under a **Steps** label. The step that works now is bold, and finished and queued steps are gray. A step opens beside it. The time on a step row and on the line at the end counts only the time the agents worked, never the time a step waited for you. After a restart, **Resume all** restarts every stopped agent.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workflow-run-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workflow-run-light.webp" alt="The run Fix flaky tests in the ledger: the rail with Overview and three steps, step 2 Fix the batching selected, the step conversation with its answer, the line Step 2 done, ready to continue with Start step 3, Stop run in the header and the limit and spend at the foot">
</picture>

<sub>Screenshot from Goodboy 0.27.1</sub>

### Hints to the orchestrator

Every hint is a round node on the run's line, like a step. Its text sits on one line, and a long hint has **Show more** to read the rest and **Show less** to fold it. Its images are thumbnails below it, and a click opens them in the viewer. A queued hint has a dashed node. A read hint says **Read at step 3**, and that link moves to the step and focuses it.

Steer a run while it goes with a markdown hint, images included. **Queue** keeps it for the next decision; on a finished run, **Read 2 queued** reads them all in one new turn. **Send now** stops the step in flight, keeps what it wrote and decides again. A complete orchestrated run keeps a field at its end, **Continue with a hint**: send one and the run reopens and the orchestrator picks the next step from the goal and your hint. The orchestrator picks the steps, so an orchestrated run has no **Add step**. It also says how hard each step is, and Goodboy picks the model for that role and difficulty on your preferred provider; **Models in workflows** in Models lets the orchestrator name the model itself.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workflow-hints-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workflow-hints-light.webp" alt="The orchestrator hint box of a run: two queued hints, Replay the event from the Sentry trace before the tester signs off and a second hint with 3 more lines, each with Remove, above the Hint the orchestrator box with its model GPT-5.6 Sol, High and pinned">
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

Each question arrives as one card with who asks, whether it is **Blocking**, and numbered answers with the recommended one tagged. Pick with a number key and press **Enter**, or write your own. A blocking question holds its step until you answer or choose **Send as message**. The step is not nudged to carry on while it waits. When an agent asks again in a later turn, only its newest blocking question stays open. A run page shows the same card. Several questions from one agent page as "1 of 3" with the number left, and the last **Answer** sends them together. The session's **Questions** page lists them under **Needs you** and **Answered**, with the answer in gray; a row opens its card in the drawer, and answering moves to the next one. The role in the drawer title opens the agent that asked, or its run step when it asked inside a run, and **Open the agent** in a row's right click menu does the same; an agent that was deleted keeps its role with no link.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workflow-questions-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workflow-questions-light.webp" alt="The Questions page of a session: Needs you 3 and Answered 4 as rows with the agent and the age, and the question Which queue should the delivery retries run on? open in the drawer with its file and the answers Dedicated retry queue (Recommended), Shared jobs queue, Retry in process and Something else, plus Let an agent decide, Skip, Send as message and Answer">
</picture>

<sub>Screenshot from Goodboy 0.27.1</sub>

### Let an agent decide

Hand a question to another agent with a hint and a model from **Let an agent decide**, then press **Hand off**. Its answer counts as yours, and **Answer it yourself** takes it back.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workflow-question-agent-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workflow-question-agent-light.webp" alt="The Questions page of a session with Which queue should the delivery retries run on? open in the drawer on Let an agent decide: An agent decides with GPT-5.6 Terra Medium, a hints box, Cancel, Skip and Hand off">
</picture>

<sub>Screenshot from Goodboy 0.27.1</sub>

### Import workflows

Bring custom workflows over from your other workspaces with **Import** in the Workflows studio. Edits are reversible with the **Undo** toast or **⌘Z** outside text fields.

## Under the hood

This part is for contributors and agents who change the feature.

- Run page checklist: `RunTreeChecklistCells` sets a step that runs, waits or failed in `text-row-strong`.
- Every other step is `text-ui`, gray until hover.
- `OrchestratedChecklist` draws the **Steps** label with `SectionLabel` and counts the top-level agents once.
- Hint node: `OrchestratedHintRow` draws a queued, reading or read hint with `WorkNode` in the `OrchestratedPlanSlot` column. The checklist and `OrchestratedComposer` both use it. `hintIsLong` decides when **Show more** shows, and `orchestratedChecklistOf` gives one read hint per row.
- Carried history: `PRIOR_TURNS_BUDGET_TOKENS` sets the 8,000 token budget.
- Run step mount: a step agent is created with `mountId` from `selectRunStepMountId`. It is the mount the orchestrator names in `step.mountId`. Else it is the mount of the run's latest step agent that has one.
- `prepareTurn` aims a run step at its own pin, else at that latest pin, and uses the active mount only when the run has none yet. `resolvePhaseAgent` then writes the mount the turn ran in to `agents.mount_id`, so the first step pins it.
- A pinned mount that is gone blocks the step: `blockRunStepOnGoneMount` marks it `blocked` and throws `RunStepMountBlockedError`, which `orchestrateNextStep` swallows. An explicit mount on the turn overrides the pin and replaces it.
- `selectMountBlockedStep` derives the block from the store state it is given: the first root step that is `blocked` and whose pin (`pinnedMountIdOf`) is not a writable mount. It carries the branch, whether the row and the folder still allow a reattach, the active mount as the suggestion and the other writable mounts. `OrchestratedMountBlock` draws it in the run tail, `orchestratedTailOf` keeps only **Restart step** beside it, and `AgentStepRow` drops the estimate of a blocked step that never started.
- `resolveMountBlockedStep` runs the three choices. It re-checks the block, attaches the mount for **Reattach**, writes `pending` and the chosen `mountId` with `invokeAgentUpdateStatus`, then calls `activateWorkflowAgent`. A failed start writes `blocked` back and rethrows.
- While a block exists, `orchestrateNextStep` returns before it decides and `addWorkflowOrchestratorHint` queues the hint, so the run never makes a second step on the same pin. `recoverStuckStep` returns for the blocked step: the block stays the one ask.
- `selectCurrentStepPin` gives the run header chip (`RunWriteDestination`): the pin of the first unsettled root step, else the last one. It replaces the session's active mount only when they differ or the pin is gone.
- The detach guard reuses the `forgetMount` check: `pinnedRunsOf` lists the open runs with a step on the mount. `mount.close` (`pinnedRunIds`, `pinnedRunLabel` on `MountFacts`) and `DetachConfirm` show **Stop run first** and **Detach anyway**; `forgetMount` still refuses.
- Auto children already launch on the mount of their delegation.
- Re-asked questions: `autoPopulateContext` calls `supersedeEarlierBlockingQuestions`. It closes the agent's open blocking questions from earlier turns of the run. They become answered with `[resolved by agent]`, already delivered. No schema change. A question of the same turn stays.
- `holdForUserQuestion` holds a step whose agent has an open blocking question in `sessionOpenQuestions`. `continueOrPause` then never sends the continue prompt.
