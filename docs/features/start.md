# Start a task

Begin from an issue, a workflow or a question. Everything starts as one draft, and it becomes a session only when you press Start, so empty sessions do not pile up.

### How do you want to start?

The **New session** draft has one compact selector with four choices: **Pick up a task**, **Run a workflow**, **Run an orchestrator** and **Start an agent**, and a line under it that says what the selected one does. **Start blank** sits in the page header, and **Discard** sits next to the start button at the end of every form, once you wrote something. Run a workflow, Run an orchestrator and Start an agent are the same forms as in the **New** menu of a session, at page width, and a limit that is switched on needs an amount with a preset too. Every option is a labelled select in the row that ends the form, and the goal field starts the work with ⌘↵ in every form, while ↵ adds a line. Esc closes the page and takes you back to where you were. If you wrote something, Esc asks whether to keep the draft or discard it, and keeping it leaves **New session** ready with your text. **Discard** throws it away.

**Folders** is optional. Search it by name, even with 50 folders in the workspace, and the folders you pick show as chips you can remove. The list opens on Suggested (the issue's folder, the ones you used last, then starred ones, five at most) and then All folders by name. The picker reads **Add folder** whether you picked one or not. A project the picked issue points to comes first and is already picked, with one line that says why, such as _In payments-api, from GitHub repo harborline/payments-api._

### Pick up a task, with a drafted brief

Turn an issue into a session with a brief in one pick. Pick an issue such as HBL-412 and Goodboy drafts a title, a goal and **Done when** criteria from it, ready to edit. **Runs as** in the options row chooses how to work on it: **Run an orchestrator**, **Run a workflow** or **Start an agent**. **Start from HBL-412** links the issue, creates the session and starts the work.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/start-pick-task-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/start-pick-task-light.webp" alt="The New session page on Pick up a task: the task HBL-412 Retried webhooks post a second credit with Add another issue, a Brief block with its title ready to edit and Use the issue text, the brief with its Done when criteria in a Write and Preview editor, Projects, the Orchestrator row on Auto, Runs as Run an orchestrator, Autonomy, Starts and Limit, and the Start from HBL-412 button">
</picture>

<sub>Screenshot from Goodboy 0.27.1</sub>

### Start one session from several issues

Pick up to five issues for one session. The brief is written from the whole set, the first issue names the branch, and every issue is linked to the session. Under the button, Goodboy lists the issues the session will close when merged.

### Review a pull request

A pull request waiting on you in Tasks shows **Review pull request** in place of Start. It opens a session with a read-only PR reviewer and the pull request checked out, on the Branch page where **Write review** waits. Pasting a GitHub pull request link in **Pick up a task** does the same.

### Run a workflow

Write the goal, pick a preset and read the **Plan** you will run, with a model on every step. **Run an orchestrator** is its own choice: the orchestrator picks each next step until the goal is done, with its model and your guidance. Set when the run asks you and a **Limit**, then **Run a workflow** creates the session and starts the run in one step. The total estimate sits beside **Start run**, and each step shows its own estimate in its tooltip. A changed option carries a small dot, and its menu offers **Reset to your rule**. An edited preset reads **edited** on the Preset select, with **Reset to the preset** in its menu. One click starts it, and the button stays where it is while the estimate loads. If the run cannot start, the page keeps everything you wrote and shows the reason under **Start run**; press it again to retry.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/start-run-workflow-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/start-run-workflow-light.webp" alt="New session with the Run a workflow tab selected: a goal in the Write and Preview editor, the Preset Scout, plan, build with its steps Scout the retry path, Plan the guard and Build the guard, a model on each step, Autonomy, Starts and Limit controls, and the estimate beside Run a workflow">
</picture>

<sub>Screenshot from Goodboy 0.27.1</sub>

### Start an agent

Map an unfamiliar repo before you plan. **Scout** is the default role and only reads, so it changes nothing: type an area, a file or a question and press **Start Scout**. **Role** and **Model** sit beside **Start Scout**, and the first project you picked is the one the agent works in. On a broad question it can split the search and merge the findings into one report.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/start-ask-agent-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/start-ask-agent-light.webp" alt="New session with the Start an agent tab selected: a question field reading Find out why webhook redeliveries post a second credit in payments-api and propose a fix, the project ledger-core, the Role Scout and Model Haiku 4.5 choosers, the note Scout only reads. It changes nothing., and the Start Scout button">
</picture>

<sub>Screenshot from Goodboy 0.27.1</sub>

### Start more work in a session

**New** in a session opens a menu: **Run a workflow**, **Run an orchestrator**, **Start an agent**, **Start an auto**, **Write a report** and **Draw a wireframe**. Each opens its own form in the drawer. Run a workflow and Run an orchestrator end with Autonomy (**Ask me**, **Balanced** or **Autopilot**), Starts and Limit. Start an agent takes a goal, a **Role** and a **Model** and starts that role; with no goal you write its first message in its chat; Start an auto starts Auto, which picks the roles itself. Report and Wireframe draft one from the session. The button is filled when nothing is running, blocked or waiting on a question, and neutral otherwise. A run you like can be kept from its page with **Save as preset**. The tools you reach from anywhere in the session sit as icons in a thin column at the right of the page, before any open panel, and stay put while the rail steps into a branch: **Ask** (⌘L), **Terminal** (⌘⌥T), **Explore** (⌘⌥X), **Context** (⌘⌥C), **Agents** (⌘⌥L) and **Scripts** (⌘⌥S). Hover one to read its name and key; the one whose panel is open shows pressed. **Agents** lists what a run or Auto started as a tree that follows the run or Auto you have open, or every launch of the session when nothing is open; click an agent, or press Enter on it, to read its conversation in the panel, then **Back to agents**. On a narrow window the panel lies over the page, and Esc closes it. While a run lives, **Pause run** (then **Resume run** in its place) and **Stop run** sit as buttons in its header.

Each session page that holds work says what it runs in two lines under its title, whether it is empty or full, so the four ways to run work read apart: **Runs** runs a workflow you or Goodboy saved, the same steps every time, and stops for you where the workflow says; **Orchestrated** takes a goal and lets the orchestrator plan the whole run, picking each next step and its agent and asking you when it is unsure; **Agents** runs one agent in the role you pick and says that Auto now picks the role for you; **Auto agents** reads your request and starts the right agent, or answers itself, under a limit. The lines live in one map, `SESSION_PAGE_INTRO` (`apps/desktop/src/features/session/sessionPageIntro.ts`), drawn by `SessionPageIntro` in the page header, and agree with the **Experimental** marker in the rail. An empty page keeps only its title and its start button, such as **No runs yet** with **Run a workflow**.

### Start blank

Start from the goal instead. **Start blank** opens the session straight on its Overview, where you add the goal, projects and work. The Overview is as wide as Runs, Agents, Artifacts and the branch pages, so nothing shifts as you move between them. Once you link an issue, **Write** drafts a title and goal from it for you to review.

### Named by Goodboy

Get a short title without writing one. A new session is named for you and marked **Named by Goodboy** until you rename it.

### Star an issue from Link work

**Link work** links a task to the session only. To keep a tracker issue for the whole workspace, press **Star it** under the issue and find it later in Tasks, under Starred.

### Undo an unlink

Unlinking a task from a session acts at once, with a 10-second **Undo** toast, and **Cmd+Z** works too. The unlink stays in the log with **Re-link**.

### Move an issue between the session and a branch

Choose where an issue belongs with **Move to** in its chip menu: the session or one of the open branches of its project. You can also drag the chip onto a branch row, and hold Alt to copy it instead. Every move has one Undo.
