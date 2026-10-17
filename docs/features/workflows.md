# Workflows

A workflow runs several agents in one session, each step with its own role, model and effort. Use it to split a job into steps such as scout, plan, implement and review, and to steer the run while it goes. You choose how much it asks you and how much it may spend.

### Workflow builder

Set up a run before it starts: a name, a goal and a mode, with the plan previewed as a recipe, step 1 on top. **Starts** and **Limit** sit under the plan.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workflow-builder-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workflow-builder-light.webp" alt="The New session page on Orchestrate: the goal in a Write and Preview editor, Projects, the Orchestrator row on Auto, Add guidance, the Autonomy, Starts and Limit controls and the Start orchestration button">
</picture>

<sub>Screenshot from Goodboy 0.27.0</sub>

### Orchestrated

Give a goal and let a model pick each next step, with its role, model, effort and a reason, until it reports done or blocked. The **Orchestrator** row has its own model and an optional **Guidance** box.

### Preset and Custom

Write the steps yourself with **Add step** and **Generate plan**, or let **Draft with planner** propose them. In **Pick a workflow** mode, start from a saved sequence and edit any step before starting. Each preset in the **Preset** list shows the provider mark of every step in run order, the same routing the run rail reads (`resolveStepRouting`); a step whose provider the start still picks shows the Auto glyph, and the tooltip names each step and its model ("Step 1 Scout · Sonnet 5.5"). The step lane under the picked preset reads the same function through `draftStepRoutingOf`, so a lane step and its mark never name two providers; a provider you pin in the lane wins over the decided one. **Save as preset** keeps what you changed.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workflow-builder-custom-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workflow-builder-custom-light.webp" alt="The workflow builder in Custom mode: Describe the steps, Auto and Generate plan, the Draft with planner button, an Add step row and the Save as preset switch next to Start workflow">
</picture>

<sub>Screenshot from Goodboy 0.13.1</sub>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workflow-builder-preset-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workflow-builder-preset-light.webp" alt="The New session page on Run a workflow with the Pick a preset list open: Trace and fix, Harden an endpoint and Migrate a contract, each with a description and its step marks">
</picture>

<sub>Screenshot from Goodboy 0.27.0</sub>

### Built-in workflows

Start from **Refactor**, **Plan and ship** or **Fix a bug**. A built-in you delete stays deleted until you press **Restore built-in workflows**, which keeps your existing workflows as they are.

### Runs of a workflow

The Workflows list is one grid: name, **Built in** or **Edited** in gray, the roles of its steps in gray ("Scout, Implementer +1"), the step count, when it last ran, and a link with its run count ("3 runs", "No runs"). The row opens the workflow. The run count link opens the runs of that workflow beside the list, newest first, each a state dot, its session, its spend and its age; a row opens that run in its session. **Import workflows…** and **Restore built-in workflows…** sit in the page menu. A workflow that never ran offers **Run a workflow with this workflow**. Past ten runs, **All**, **Running** and **Failed** narrow the list. If the runs cannot load, the pane says so with **Retry**.

### Saved steps

Reuse steps across workflows. The built-in steps are read-only, and **Save a copy** makes your own.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workflow-studio-steps-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workflow-studio-steps-light.webp" alt="The Workflows studio on the Saved steps tab: the 7 built-in steps Scout, Investigate, Plan, Implement, Test, Review and Update docs, each with its role, a short description and the model setting Auto, and an empty This workspace list with a New step button">
</picture>

<sub>Screenshot from Goodboy 0.27.0</sub>

### Model per step

Put a light model on a scout and a strong one on the planner. A step follows its role by default, and **Pin a model** gives it its own provider, model and effort, with the same compact provider row as the model picker. Goodboy records what actually ran.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workflow-model-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workflow-model-light.webp" alt="The model popover of a workflow step in the Run a workflow form, opened on Opus 5.5 High with Follow role and Pin a model: it follows the Planner role and Auto picks Opus 5.5 High from the providers you can use now">
</picture>

<sub>Screenshot from Goodboy 0.27.0</sub>

### Autonomy

Choose how often a run stops for you: **Ask me**, **Balanced** to approve once and then run on, or **Autopilot**. A guard stops an unattended agent after 4 turns in an hour, and anything you write to it resets the count.

### Pause, resume and skip

**Pause** lets the step in flight finish and starts nothing new, even after a restart, and **Resume** picks up from there. **Skip** passes a step that has not finished and keeps what it already wrote. If a step says nothing for 15 minutes, the run offers **Ask it to continue**.

### Run defaults

Set what every new run starts with in the **Run defaults** tab: how it asks, the limit and shared **Guidance** for the agents that write code. The builder opens filled from them, and a **From your rules** line shows where one run differs, with a **Reset** on that control. Provider order lives in **Open Providers & models**.

### Limit

Cap what a run or a session can spend, and choose **Pause workflows** or **Warn only**. A paused run offers **Raise limit**.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workflow-spend-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workflow-spend-light.webp" alt="The Limit popover of the workflow form, switched on at $25 with Pause runs and Warn only, and the Limit chip reading $25.00 Pause">
</picture>

<sub>Screenshot from Goodboy 0.27.0</sub>

### Chained starts

Line work up behind work. **Starts** takes **Now**, **Manually** to keep the run queued until you start it, or **After** another workflow, which starts once that one completes.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workflow-starts-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workflow-starts-light.webp" alt="The Starts menu of the workflow form open with Now, Manually and After Harden an endpoint, each with its line of explanation">
</picture>

<sub>Screenshot from Goodboy 0.27.0</sub>

### Workflow run

Open a preset run and the session rail steps into it: **Overview**, every step in order with its sub-agents, **Add step** at the end, and the run's limit and spend at the foot. The center shows the step you pick as its conversation. The line at the end says what the run waits for, with the one button that moves it on: **Start step 3**, **Review plan**, **Raise limit**, **Continue step**. **Pause run** and **Stop run** sit as buttons in the run header while the run lives (once paused, **Resume run** takes the place of Pause run), and **Autonomy**, **Skip step** and the rest sit in the run's **⋯**. An orchestrated run lives under **Orchestrated** in the session and reads as one document: the goal with its autonomy, providers and limit, one checklist of the steps it decided, the hints it read and what is left, the line that says what the orchestrator does now with the reason for its last choice, the result once done, and the hint box at the bottom. A step opens beside it. The time on a step row and on the line at the end counts only the time the agents worked, never the time a step waited for you. After a restart, **Resume all** restarts every stopped agent.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workflow-run-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workflow-run-light.webp" alt="The run Fix flaky tests in the ledger: the rail with Overview and three steps, step 2 Fix the batching selected, the step conversation with its answer, the line Step 2 done, ready to continue with Start step 3, Stop run in the header and the limit and spend at the foot">
</picture>

<sub>Screenshot from Goodboy 0.27.0</sub>

### Hints to the orchestrator

Steer a run while it goes with a markdown hint, images included. **Queue** keeps it for the next decision; on a finished run, **Read 2 queued** reads them all in one new turn. **Send now** stops the step in flight, keeps what it wrote and decides again.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workflow-hints-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workflow-hints-light.webp" alt="The orchestrator hint box of a run: two queued hints, Replay the event from the Sentry trace before the tester signs off and a second hint with 3 more lines, each with Remove, above the Hint the orchestrator box with its model GPT-5.6 Sol, High and pinned">
</picture>

<sub>Screenshot from Goodboy 0.27.0</sub>

### Why each step, and the run recap

See why each step was picked. A short **Recap** says what is done and what is left, and it is rewritten after each decision.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workflow-recap-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workflow-recap-light.webp" alt="The Orchestrated page of a finished run: its goal with Can use Claude, Codex, Limit $3.00 and $1.21 spent, four steps with the hint read at step 3 and step 4, the closing summary and a Recap with Done and Left lists, then Create report, Create wireframe and Run complete">
</picture>

<sub>Screenshot from Goodboy 0.27.0</sub>

### Step handoff summary

Each step starts from a short brief instead of the whole previous chat. If the summary fails, Goodboy tries the other models you allow, and only then keeps the start and end of the chat and marks the brief as degraded, with **Retry**.

### Open questions

Each question arrives as one card with who asks, whether it is **Blocking**, and numbered answers with the recommended one tagged. Pick with a number key and press **Enter**, or write your own. A blocking question holds its step until you answer or choose **Send as message**. The session's **Questions** page lists them under **Needs you** and **Answered**, with the answer in gray; a row opens its card in the drawer, and answering moves to the next one.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workflow-questions-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workflow-questions-light.webp" alt="The Questions page of a session: Needs you 3 and Answered 4 as rows with the agent and the age, and the question Which queue should the delivery retries run on? open in the drawer with its file and the answers Dedicated retry queue (Recommended), Shared jobs queue, Retry in process and Something else, plus Let an agent decide, Skip, Send as message and Answer">
</picture>

<sub>Screenshot from Goodboy 0.27.0</sub>

### Let an agent decide

Hand a question to another agent with a hint and a model from **Let an agent decide**, then press **Hand off**. Its answer counts as yours, and **Answer it yourself** takes it back.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workflow-question-agent-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workflow-question-agent-light.webp" alt="The Questions page of a session with Which queue should the delivery retries run on? open in the drawer on Let an agent decide: An agent decides with GPT-5.6 Terra Medium, a hints box, Cancel, Skip and Hand off">
</picture>

<sub>Screenshot from Goodboy 0.27.0</sub>

### Import workflows

Bring custom workflows over from your other workspaces with **Import** in the Workflows studio. Edits are reversible with the **Undo** toast or Cmd+Z outside text fields.
