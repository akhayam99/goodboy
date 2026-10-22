# Start a task

Begin from an issue, a workflow or a question. Everything starts as one draft, and it becomes a session only when you press Start, so empty sessions do not pile up.

### Start a run

Write what you want done and press Start; Goodboy picks how to run it. The **Start a run** field sits at the top of a session's Runs page and of the **New session** page, with the Limit and Start under it. ↵ starts, ⇧↵ adds a line. The pick is a rule table in the app, with no model call, read top to bottom until a row holds:

1. You said it: `~Fix a layout` follows that preset, `@Scout` starts that role at once; or a default you set, for this session from a run's **Change** menu or for the workspace in Settings (**New runs start as**). A session default wins over the workspace one.
2. The ask names a preset of the workspace, or shares at least two words of its description and step titles (a name match ranks first, then the one last used in the session): a plan from that preset that adapts as it goes.
3. A task is linked, or the ask is a list or names many places ("every page"): a plan with steps.
4. The session's open pull request fails its checks or has changes requested, and the ask is about it: one agent.
5. A question, a check or one file: one agent that starts what it needs.
6. Nothing above: one agent first.

A plan starts an orchestrated run; a preset seeds that run with its steps, in order; one agent starts Auto (or the role you named). The reason is kept with the run. If the start fails, the field keeps your text and Start becomes **Retry**. Moving to another session while a start is on its way drops the late answer, so its text or error never lands on the other session. **Start a run** in the New menu and in ⌘K opens the field, and ⌘K offers **Start a run from** each preset, which opens it with `~` and the preset name.

### What Auto chose, and Change

Every run started from the field shows one quiet line under its title: what was chosen, how many steps Auto changed in the preset, why, and **Change**. Change offers **Run it as** (A plan with steps, One agent that starts what it needs), **Start from** (a preset or No preset), **With the preset** (Follow the preset, Adapt as it goes) and **Start every run in this session like this**.

- Follow and Adapt switch in place at any time.
- Before the first step starts, a new shape or preset applies to the same run, so nothing is spent twice. A plan with no step yet that becomes one agent is replaced by that agent.
- Once work started, Change starts a second run with the same ask and what the first found, then stops the first and marks it **Changed to a plan** or **Changed to one agent**. Both stay in the list. If the second run fails to start, the first is left as it was.
- Setting a default shows a toast with **Undo**. Undo changes nothing when another window changed the default since. Undo of a session's first default lets the session follow the workspace default again.

### The New session page

The **New session** draft is **Folders** above the **Start a run** field, with no other choice to make first. **Start blank** sits in the page header, and **Discard** sits next to Start once you wrote something. Esc closes the page and takes you back to where you were. If you wrote something, Esc asks whether to keep the draft or discard it, and keeping it leaves **New session** ready with your text.

**Folders** is optional. Search it by name, even with 50 folders in the workspace, and the folders you pick show as chips you can remove. The list opens on Suggested (the folders you used last, then starred ones, five at most) and then All folders by name. The picker reads **Add folder** whether you picked one or not.

### Start on a task

**Start** on an issue in Tasks opens the New session page with the issue attached above the field (remove it with its ×) and its goal written in. Edit the ask and press Start: the session is created with the issue linked, and the ask is routed like any other, as a plan with steps unless you name a role or a preset. If the start fails, the page keeps the issue and your text and Start becomes **Retry**.

### Review a pull request

A pull request waiting on you in Tasks shows **Review pull request** in place of Start. It opens a session with a read-only PR reviewer and the pull request checked out, on the Branch page where **Write review** waits.

### Start more work in a session

**New** in a session opens a menu: **Start a run**, **Write a report** and **Draw a wireframe**. Start a run opens Runs with the field focused; Report and Wireframe draft one from the session in the drawer. There is no separate start for an agent, an orchestrator or Auto: write the ask, or type `@Scout` or `~Fix a layout` in the field. ⌘K offers the same **Start a run** and **Start a run from** each preset. A run you like can be kept from its page with **Save as preset**. The tools you reach from anywhere in the session sit as icons in a thin column at the right of the page, before any open panel, and stay put while the rail steps into a branch: **Ask** (⌘L), **Terminal** (⌘⌥T), **Explore** (⌘⌥X), **Context** (⌘⌥C), **Agents** (⌘⌥L) and **Scripts** (⌘⌥S). Hover one to read its name and key; the one whose panel is open shows pressed. **Agents** lists what a run or Auto started as a tree that follows the run or Auto you have open, or every launch of the session when nothing is open; click an agent, or press Enter on it, to read its conversation in the panel, then **Back to agents**. On a narrow window the panel lies over the page, and Esc closes it. While a run lives, **Pause run** (then **Resume run** in its place) and **Stop run** sit as buttons in its header.

All the work of a session lives in one rail entry, **Runs**: preset runs, orchestrated runs, Auto conversations and the agents you started, one row per request, newest first, each saying what it was ("Was a preset run · Fix a layout", "Was an orchestrated run", "Was an Auto conversation", "Was an agent · Scout"). An old Orchestrated, Agents or Auto agents link opens Runs. The page says what it holds in two lines under its title, whether it is empty or full; the lines live in `SESSION_PAGE_INTRO` (`apps/desktop/src/features/session/sessionPageIntro.ts`), drawn by `SessionPageIntro` in the page header. An empty Runs page is the Start a run field alone.

### Start blank

Start from the goal instead. **Start blank** opens the session straight on its Overview, where you add the goal, projects and work. The Overview is as wide as Runs, Artifacts and the branch pages, so nothing shifts as you move between them. Once you link an issue, **Write** drafts a title and goal from it for you to review.

### Named by Goodboy

Get a short title without writing one. A new session is named for you and marked **Named by Goodboy** until you rename it.

### Star an issue from Link work

**Link work** links a task to the session only. To keep a tracker issue for the whole workspace, press **Star it** under the issue and find it later in Tasks, under Starred.

### Undo an unlink

Unlinking a task from a session acts at once, with a 10-second **Undo** toast, and **Cmd+Z** works too. The unlink stays in the log with **Re-link**. Unlinking the issue you have open takes you back to its list; the breadcrumb above the issue does the same. If you moved elsewhere before the unlink finished, you stay where you went.

### Move an issue between the session and a branch

Choose where an issue belongs with **Move to** in its chip menu: the session or one of the open branches of its project. You can also drag the chip onto a branch row, and hold Alt to copy it instead. Every move has one Undo.
