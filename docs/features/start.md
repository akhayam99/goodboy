# Start a task

Begin from an issue, a workflow or a question. Everything starts as one draft, and it becomes a session only when you press Start, so empty sessions do not pile up.

### How do you want to start?

The **New session** draft has one compact selector with four choices: **Pick up a task**, **Run a workflow**, **Orchestrate** and **Ask an agent**, and a line under it that says what the selected one does. **Start blank** sits in the page header, and **Discard** sits next to the start button at the end of every form, once you wrote something. Run a workflow, Orchestrate and Ask an agent are the same forms as in the **New** menu of a session, at page width, and a spend cap that is switched on needs an amount with a preset too. Esc closes the page and takes you back to where you were. If you wrote something, Esc asks whether to keep the draft or discard it, and keeping it leaves **New session** ready with your text. **Discard** throws it away.

**Projects** is optional. Search it by name, even with 50 projects in the workspace, and the projects you pick show as chips you can remove. A project the picked issue points to comes first and is already picked, with one line that says why, such as _In payments-api, from GitHub repo harborline/payments-api._

### Pick up a task, with a drafted brief

Turn an issue into a session with a brief in one pick. Pick an issue such as HBL-412 and Goodboy drafts a title, a goal and **Done when** criteria from it, ready to edit. **Start from HBL-412** links the issue, creates the session and starts the work.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/start-pick-task-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/start-pick-task-light.webp" alt="The New session page on Pick a task: the task HBL-412 Retried webhooks post a second credit with Dismiss, then one block titled Brief from HBL-412 with its title ready to edit, and under it the tabs Run a workflow and Ask an agent with the Orchestrated workflow and its brief in a Write and Preview editor">
</picture>

<sub>Screenshot from Goodboy 0.23.0</sub>

### Start one session from several issues

Pick up to five issues for one session. The brief is written from the whole set, the first issue names the branch, and every issue is linked to the session. Under the button, Goodboy lists the issues the session will close when merged.

### Review a pull request

A pull request waiting on you in Tasks shows **Review pull request** in place of Start. It opens a session with a read-only PR reviewer and the pull request checked out, on the Branch page where **Write review** waits. Pasting a GitHub pull request link in **Pick up a task** does the same.

### Run a workflow

Write the goal, pick a preset and read the **Plan** you will run, with a model on every step. **Orchestrate** is its own choice: the orchestrator picks each next step until the goal is done, with its model and your guidance. Set when the run asks you and a **Spend cap**, then **Start run** creates the session and starts the run in one step. One click starts it, and the button stays where it is while the estimate loads. If the run cannot start, the page keeps everything you wrote and shows the reason under **Start run**; press it again to retry.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/start-run-workflow-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/start-run-workflow-light.webp" alt="New session with the Run a workflow tab selected: an Orchestrated workflow with the goal Stop retried webhooks posting a second credit, the Orchestrated, Custom and Preset switch, the Plan with an Orchestrator row and example steps Scout, Planner and Implementer, and the Starts Now, Autorun and Spend cap None controls next to Start workflow">
</picture>

<sub>Screenshot from Goodboy 0.15.2</sub>

### Ask an agent

Map an unfamiliar repo before you plan. **Scout** is the default role and only reads, so it changes nothing: type an area, a file or a question and press **Start Scout**. With two or more projects picked, the project chip next to the model says which one the agent works in. On a broad question it can split the search and merge the findings into one report.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/start-ask-agent-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/start-ask-agent-light.webp" alt="New session with the Ask an agent tab selected: a question field reading How does a retried webhook reach the ledger?, the Scout, Auto and payments-api choosers, the note Scout only reads. It changes nothing., and the Start Scout button">
</picture>

<sub>Screenshot from Goodboy 0.13.1</sub>

### Start more work in a session

**New** in a session opens a menu: **Run a workflow**, **Orchestrate**, **Start agent**, **Start Auto** (with the Auto experiment on), **Report** and **Wireframe**. Each opens its own form in the drawer. Run a workflow and Orchestrate end with Autonomy (**Ask me**, **Balanced** or **Autopilot**), Starts and Spend cap. Start agent starts one role. Report and Wireframe draft one from the session. The button is filled when nothing is running, blocked or waiting on a question, and neutral otherwise. A run you like can be kept from its page with **Save as preset**.

### Start blank

Start from the goal instead. **Start blank** opens the session straight on its Overview, where you add the goal, projects and work. Once you link an issue, **Write** drafts a title and goal from it for you to review.

### Named by Goodboy

Get a short title without writing one. A new session is named for you and marked **Named by Goodboy** until you rename it.

### Star an issue from Link work

**Link work** links a task to the session only. To keep a tracker issue for the whole workspace, press **Star it** under the issue and find it later in Tasks, under Starred.

### Undo an unlink

Unlinking a task from a session acts at once, with a 10-second **Undo** toast, and **Cmd+Z** works too. The unlink stays in the log with **Re-link**.

### Move an issue between the session and a branch

Choose where an issue belongs with **Move to** in its chip menu: the session or one of the open branches of its project. You can also drag the chip onto a branch row, and hold Alt to copy it instead. Every move has one Undo.
