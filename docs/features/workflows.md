# Workflows

A workflow runs several agents in one session, each step with its own role, model and effort.

### Workflow builder

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workflow-builder-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workflow-builder-light.webp" alt="The workflow builder for Duplicate credit fix: a goal, the Orchestrated, Custom and Preset modes, the plan preview with the Orchestrator row on GPT-5.6 Sol, guidance, Starts Now, Autorun, Spend cap and Start workflow">
</picture>

Shape a run before it starts: a name, a goal and a mode, with the plan previewed as a recipe, step 1 on top, in the same nodes the run will show. **Starts**, **Autorun** and **Spend cap** sit under the plan.

### Orchestrated

Give a goal and let a model pick each next step, with its role, provider, model, effort and a reason, until it says done or blocked. The **Orchestrator** row holds its own model and an optional **Guidance** box.

### Preset and Custom

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workflow-builder-custom-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workflow-builder-custom-light.webp" alt="The workflow builder in Custom mode: Describe the steps, Auto and Generate plan, the Draft with planner button, an Add step row and the Save as preset switch next to Start workflow">
</picture>

Write the steps yourself with **Add step**, describe them and press **Generate plan**, or press **Draft with planner**. **Save as preset** keeps what you changed.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workflow-builder-preset-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workflow-builder-preset-light.webp" alt="The workflow builder in Preset mode with the Pick a preset list open: Trace and fix, Harden an endpoint and Migrate a contract, each with a description and its step dots">
</picture>

In **Preset** mode, pick a saved sequence from the list and edit any step before starting.

### Built-in workflows

Start from **Refactor**, **Plan and ship** or **Fix a bug**. A built-in you delete stays deleted until you press **Restore built-in workflows**. Restore keeps the existing workflow and step identities. If its name is held by another workflow, or one of its runs is still active, the confirmation stays open and says what must change first.

### Saved steps

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workflow-studio-steps-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workflow-studio-steps-light.webp" alt="The Workflows studio on the Saved steps tab: the 8 built-in steps Scout, Investigate, Plan, Implement, Test, Review, Resolve comments and Update docs, and an empty This workspace list with a New step button">
</picture>

Reuse steps across workflows. The 8 built-in steps are read-only, and **Save a copy** makes your own.

### Model per step

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workflow-model-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workflow-model-light.webp" alt="The model picker open on the Orchestrator row of the workflow builder, with the provider icons and the Model, Version, Variant and Effort rows set to GPT, 5.6, Sol and High">
</picture>

Put a light model on a scout and a strong one on the planner. Each step has its own provider, then **Model**, **Version**, **Variant** and **Effort**, and Goodboy records what actually ran.

### Autorun

Choose when a run asks: **Ask before each step**, or **Run on its own** to move to the next step without you, per run or for the whole session. A guard stops an agent after 4 unattended turns in an hour, and anything you write to it resets the count.

**Pause** lets the step in flight finish and starts nothing new, even after a restart; **Resume** picks up where the run was. **Skip** passes any step that has not finished, live or stuck, after one inline confirmation, and keeps what it already wrote. When a running step says nothing for 15 minutes, the run says so and offers **Ask it to continue** or **Skip**.

### Spend limit

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workflow-spend-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workflow-spend-light.webp" alt="The Spend cap popover in the workflow builder, switched on at $12, with Pause workflows and Only warn me, and the Spend cap chip reading $12.00 · Pause">
</picture>

Cap what a run or a session can spend, and choose **Pause workflows** or **Only warn me**. A paused run offers **Raise limit**.

### Chained starts

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workflow-starts-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workflow-starts-light.webp" alt="The Starts menu of the workflow builder open with Now, Manually and After Harden an endpoint">
</picture>

Line work up behind work. **Starts** takes **Now**, **Manually** to keep the run queued until you start it, or **After** followed by a workflow name, which starts once that workflow completes.

### Workflow run

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workflow-run-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workflow-run-light.webp" alt="The Duplicate credit fix run on HBL-412: three scouts working in parallel under step 1, then a planner, two implementers and a tester, each on its own model, with Waiting on step 1 above the tree and $0.13 spent of the $12.00 spend limit">
</picture>

Follow a run as a tree with one pinned next action, and add steps to a live or finished run. Parallel scouts appear as branches under their step. After a restart, one **Resume all** above the steps starts every stopped agent in that run. Deleting a run deletes its agents and their open questions with it.

### Hints to the orchestrator

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workflow-hints-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workflow-hints-light.webp" alt="The orchestrator strip on step 4 with the Tell the orchestrator something box, Queue and Read now, a queued hint reading Replay the event from the Sentry trace before the tester signs off, and Show read (2)">
</picture>

Steer a run while it goes. Write a hint on as many lines as you need, in markdown, with images the next agent gets. **Queue** waits for the next decision, and **Read now** stops the step in flight, keeps what it wrote and decides again. A queued hint shows **Waits for the next decision**, and read ones show the step they were read at.

### Why each step, and the run recap

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workflow-recap-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workflow-recap-light.webp" alt="The Recap of the Duplicate credit fix run, its Goal, and the Why each step list with 5 decisions, from Replay one event three times back to Trace where a retried webhook posts">
</picture>

See why each step was picked, with a short **Recap** of what is done and what is left, rewritten after each decision.

### Step handoff summary

Start each step from a short brief instead of the whole previous chat. If the summary fails, Goodboy keeps the start and end of the chat and marks the brief as degraded.

### Open questions

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workflow-questions-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workflow-questions-light.webp" alt="The Questions lens: 3 waiting and 1 blocking in a Waiting on you list, and the question Which queue should the delivery retries run on? from the Add the stuck-delivery banner agent, with the file src/deliveries/retry.ts and the answers Dedicated retry queue (Recommended), Shared jobs queue, Retry in process and Something else, plus Let an agent decide, Skip and Answer">
</picture>

Get each question as one card: who asks, whether it is **Blocking**, the question, and its answers as numbered tiles with the recommended one tagged. Pick with a number key, answer with **Enter**, or write something else in line. The Questions lens lists what waits on you next to the question you are answering, and **j** and **k** move through the list. The same card sits at the end of the transcript and at the top of the agent's Brief. The answers to one agent go out together once you answered its last question, and until then each one keeps an Undo. A blocking question holds its step until you answer. Each question shows once in the session activity, on the row of the agent that asked, and **Answer** on a workflow row opens that agent right at its question.

### Let an agent decide

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workflow-question-agent-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workflow-question-agent-light.webp" alt="The Brief of the agent Reuse the token footer in the brief: a header with the title, the Brief and Transcript tabs and a delete icon, one line with Implementer, Running and Opus 5, and its blocking question open on Let an agent decide: An agent decides with Sonnet 5 · Medium, a hints box, Cancel and Hand off">
</picture>

Hand a question to another agent with a hint and a model from **Let an agent decide**, then press **Hand off**. Its answer counts as yours, and **Answer it yourself** takes it back.

### Import workflows

Bring custom workflows over from your other workspaces with **Import** in the Workflows studio.
