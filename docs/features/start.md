# Start a task

Begin from an issue, a workflow or a question. Everything starts as one draft, and it becomes a session only when you press Start, so empty sessions do not pile up.

### Start a run

Write what you want done and press Start; Goodboy picks how to run it. The **Start a run** field sits at the top of a session's Runs page, and on the **New session** page **Not sure? Describe it and Auto picks** routes the task you wrote the same way, with the Limit and Start under it. Its hint reads "Auto picks a workflow or an agent. Type ~preset or @role." ↵ starts, ⇧↵ adds a line. The pick is a rule table in the app, with no model call, read top to bottom until a row holds:

1. You said it: `~Fix a layout` follows that preset, `@Scout` starts that role at once; or a default you set in Settings (**New runs start as** for the workspace, **New runs in this session start as** for the open session). A session default wins over the workspace one.
2. The ask names a preset of the workspace, or shares at least two words of its description and step titles (a name match ranks first, then the one last used in the session): a Preset workflow that adapts as it goes.
3. A task is linked, or the ask is a list or names many places ("every page"): an Orchestrated workflow.
4. The session's open pull request fails its checks or has changes requested, and the ask is about it: an Auto agent.
5. A question, a check or one file: an Auto agent.
6. Nothing above: an Auto agent first.

A workflow starts an orchestrated run; a preset seeds that run with its steps, in order; an agent starts Auto (or the role you named). The reason is kept with the run. If the start fails, the field keeps your text and Start becomes **Retry**. Moving to another session while a start is on its way drops the late answer, so its text or error never lands on the other session. **Start a run** in a session's New menu and ⌘K opens the field, and ⌘K offers **Start from** each preset, which opens it with `~` and the preset name. Outside a session, ⌘K **Start a run** opens the New session page on Auto picks.

### The Kind chip

Every run started from the field or the New session page leads its settings line with a **Kind** chip that names what runs, in the names of the New session page ("Workflow · Orchestrated", "Workflow · Preset Fix a layout", "Agent · Auto agent", "Agent · Scout"). The words come from one function, `runKindLineOf`, which the Runs list reads too. The chip opens one popover: the kind and "set at start", one line on what that kind does, why it was picked ("you picked it" when you chose it on the page) with how many steps Auto changed in the preset, **With the preset** (Follow it, Adapt as it goes) on a preset run, and the other kinds a run can be (Workflow · Orchestrated, each preset, Agent · Auto agent). Its last line says what a pick does.

- Follow and Adapt switch in place at any time.
- Before the first step starts, the list reads **Change it to** and a pick applies to the same run, so nothing is spent twice. A plan with no step yet that becomes one agent is replaced by that agent.
- Once work started, the list reads **Start a new run as**: a pick "Starts a second run with the same goal. This one keeps going." The second run gets the same ask and what the first found; both stay in the list. If the second run fails to start, the popover stays open with the reason and the first is left as it was.
- The session default is not on the chip: set it in Settings, **New runs in this session start as**.

### The New session page

The **New session** page starts from the task. The first field is **Task** ("Describe a task, or pick one from Tasks"): write it, or press **Pick from Tasks** in its bottom row to pick an open issue, which fills the task when it is empty and links the issue to the session. Next to it, **Where** reads **Auto picks**: the session runs on the workspace, agents read every folder, and the folders the task needs are mounted on start: the workspace's only repo, the repo of a linked GitHub or GitLab issue, and the repos the task names by their exact name. Later an agent mounts the folder it must edit by itself. Both share one allowance (the active folder, a folder linked by the task and up to two more per session; more wait for your approval), see [mounts.md](../mounts.md#who-picks-the-folders). Open **Where** to pin folders yourself, and clear it to give the choice back. A picked issue whose repository Goodboy recognizes pins that repository in **Where**.

Under the task the page asks one question: **What kind of run?** Two cards, **Workflow** (steps you can see and steer, one agent on each) and **Agent** (one agent works on it in one conversation), each with one line and one example. Picking one folds both cards to a line and asks the second question under them: **Which workflow?** (**Orchestrated**, Auto plans each next step as it goes, or **Preset**, a saved list of steps) or **Which agent?** (**Agent**, one role on one model, or **Auto agent**, which starts helpers under your limit). A click on the other card switches; the task and **Where** stay.

Picking a kind shows only that kind's controls: a one-line hint on what you see while it runs, then the preset picker with its steps and **Follow it** or **Adapt as it goes** for a Preset, **Role** and **Model** for an Agent, and the **Limit** for the others. Both workflow kinds also show **Asks you** (Every step, After the plan, Never), the same chip and popover as the run's settings line (`AsksYouChip`); it opens on Every step, what a run started here got before, and the run starts with the pick. An agent has no step to stop at, so the agent kinds have no Asks you. The primary names what starts: **Start workflow**, **Start Scout** (the role you picked) or **Start Auto agent**. Start sends the route you picked, so the router does not guess, and the run's line says "you picked it". The task is required on every kind. If the start fails, the page keeps everything and Start becomes **Retry**; leaving the page while a start is on its way drops the late answer.

**Not sure? Describe it and Auto picks** sits under the two cards before you pick. It swaps the cards for the Limit and Start of **Start a run**, which routes the task you wrote, with **Pick it yourself** to go back. The page remembers the last kind you started in this workspace (the setting `newSession.lastStart.<workspaceId>`, written after a start succeeds) and opens on it folded next time; the first visit and **Pick it yourself** show the full cards. Each window keeps its own pick while it is open. ⌘K **New workflow session** and **New agent session** open the page on that card.

**Start blank** sits in the page header, and **Discard** sits next to Start once you wrote something. Esc closes the page and takes you back to where you were. If you wrote something, Esc asks whether to keep the draft or discard it, and keeping it leaves **New session** ready with your text.

**Where** is optional. Search it by name, even with 50 folders in the workspace. The list opens on Suggested (the folders you used last, then starred ones, five at most) and then All folders by name. It reads **Auto picks**, the folder you pinned, or how many you pinned. A pin always wins: with a folder pinned, nothing else is mounted on start. An Auto agent that has to write and finds no folder picks one the same way, inside the same allowance, and asks where it should work only when the task names no folder of the workspace or the allowance is spent.

### Start on a task

**Start** on an issue in Tasks opens the New session page with the issue above the task field (remove it with its ×), its goal written in, and the kind you started last. A task is never a kind: **Pick from Tasks** works the same on every kind. Press Start: the session is created with the issue linked, and the run starts as the kind you picked, or is routed like any other from Auto picks. If the start fails, the page keeps the issue and your text and Start becomes **Retry**.

### Review a pull request

A pull request waiting on you in Tasks shows **Review pull request** in place of Start. It opens a session with a read-only PR reviewer and the pull request checked out, on the Branch page where **Write review** waits.

### Start more work in a session

**New** in a session opens a menu: **Start a run**, **Write a report** and **Draw a wireframe**. Start a run opens Runs with the field focused; Report and Wireframe draft one from the session in the drawer. Inside a session the field keeps routing on its own: write the ask, or type `@Scout` or `~Fix a layout` in the field. ⌘K offers the same **Start a run** and **Start from** each preset. A run you like can be kept from its page with **Save as preset**. The tools you reach from anywhere in the session sit as icons in a thin column at the right of the page, before any open panel, and stay put while the rail steps into a branch: **Ask** (⌘L), **Terminal** (⌘⌥T), **Explore** (⌘⌥X), **Context** (⌘⌥C), **Agents** (⌘⌥L) and **Scripts** (⌘⌥S). Hover one to read its name and key; the one whose panel is open shows pressed. **Agents** lists what a run or Auto started as a tree that follows the run or Auto you have open, or every launch of the session when nothing is open; click an agent, or press Enter on it, to read its conversation in the panel, then **Back to agents**. On a narrow window the panel lies over the page, and Esc closes it. While a run lives, **Pause run** (then **Resume run** in its place) and **Stop run** sit as buttons in its header.

All the work of a session lives in one rail entry, **Runs**: preset runs, orchestrated runs, Auto conversations and the agents you started, one row per request, newest first, each saying what it was ("Workflow · Preset Fix a layout", "Workflow · Orchestrated", "Agent · Auto agent", "Agent · Scout"), the same words as the New session page. An old Orchestrated, Agents or Auto agents link opens Runs. The page says what it holds in two lines under its title, whether it is empty or full; the lines live in `SESSION_PAGE_INTRO` (`apps/desktop/src/features/session/sessionPageIntro.ts`), drawn by `SessionPageIntro` in the page header. An empty Runs page is the Start a run field alone.

### Start blank

Start from the goal instead. **Start blank** opens the session straight on its Overview, where you add the goal, projects and work. The Overview is as wide as Runs, Artifacts and the branch pages, so nothing shifts as you move between them. Once you link an issue, **Write title and goal** drafts both from it for you to review.

### Named by Goodboy

Get a short title without writing one. A new session is named for you and marked **Named by Goodboy** until you rename it.

### Star an issue from Link work

**Link work** links a task to the session only. To keep a tracker issue for the whole workspace, press **Star it** under the issue and find it later in Tasks, under Starred.

### Undo an unlink

Unlinking a task from a session acts at once, with a 10-second **Undo** toast, and **Cmd+Z** works too. The unlink stays in the log with **Re-link**. Unlinking the issue you have open takes you back to its list; the breadcrumb above the issue does the same. If you moved elsewhere before the unlink finished, you stay where you went.

### Move an issue between the session and a branch

Choose where an issue belongs with **Move to** in its chip menu: the session or one of the open branches of its project. You can also drag the chip onto a branch row, and hold Alt to copy it instead. Every move has one Undo.
