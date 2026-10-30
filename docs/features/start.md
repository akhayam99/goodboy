# Start a task

Begin from an issue, a workflow or a question. Everything starts as one draft, and it becomes a session only when you press Start, so empty sessions do not pile up.

### Start a run

Write what you want done and press Start. Goodboy picks how to run it.

- The **Start a run** field sits at the top of a session's Runs page.
- On the **New session** page, the same form routes the goal you wrote the same way until you press a kind.
- Its hint reads "Auto picks how to run it. ~ lists presets, @ lists roles."
- Typing `~` or `@` in an empty field opens the same menu as the chat box. Pick a preset or a role and its kind is pressed under the field.
- A name typed in the text still wins over the kind.
- The kinds and the settings under the box are [one start form](#one-start-form).
- Under the box, a line reads "Starts as ..." with the reason and the model. It changes as you type, before you press Start. Once you press a kind, the line says what that kind does.
- The paperclip, paste and drop attach files and images. They go with the run to its first agent.
- ↵ starts, ⇧↵ adds a line.

The pick is a rule table in the app, with no model call. Goodboy reads it top to bottom until a row holds.

| Order | If                                                                                                       | Goodboy starts                                                                                                |
| ----- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| 1     | You said it: `~Fix a layout` or `@Scout`, or a default you set in Settings                               | That preset, or that role at once. A session default wins over the workspace one.                             |
| 2     | The ask names a preset of the workspace, or shares at least two words of its description and step titles | A Preset workflow that adapts as it goes. A name match ranks first, then the preset last used in the session. |
| 3     | A task is linked, or the ask is a list or names many places ("every page")                               | An Orchestrated workflow                                                                                      |
| 4     | The session's open pull request fails its checks or has changes requested, and the ask is about it       | An Auto agent                                                                                                 |
| 5     | A question, a check or one file                                                                          | An Auto agent                                                                                                 |
| 6     | Nothing above                                                                                            | An Auto agent first                                                                                           |

- **New runs start as** sets the default for the workspace. **New runs in this session start as** sets it for the open session. Both are in Settings.
- A workflow starts an orchestrated run. A preset seeds that run with its steps, in order. An agent starts Auto (or the role you named).
- The reason is kept with the run.
- If the start fails, the field keeps your text and Start becomes **Retry**.
- Moving to another session while a start is on its way drops the late answer, so its text or error never lands on the other session.
- **Start a run** in a session's New menu and ⌘K opens the field. ⌘K offers **Start from** each preset, which opens it with `~` and the preset name.
- Outside a session, ⌘K **Start a run** opens the New session page on Auto picks.
- Setup's last step draws this field too, pinned to Scout, so the first start teaches the second.

### One start form

Every door draws the same form: the New session page, a session's Runs page (and so the New menu's **Start a run**), ⌘K, and the setup Scout run.

- Four kinds sit in one row: **Auto**, **Agent**, **Orchestrated** and **Preset**. One line under them says what the pressed kind does.
- With none pressed, Auto picks by the table above. Press the pressed kind again to give the choice back.
- **Preset** is off until the workspace has a preset. A pressed Preset shows the picker with its steps and **Follow it** or **Adapt as it goes**.
- One row of quiet chips holds the settings. Each chip opens its own popover, anchored to it, so it stays inside the window.
- A kind shows only the settings it uses. **Where** shows on the New session page only, **Role** on Agent only. **Limit** and **Asks you** do not show on Agent: a plain agent has no limit to enforce and no step to stop at.
- **Model** names the orchestrator or the agent for this run, **Auto** until you pick one. A pick is for this run only.
- **Asks you** is Every step, After the plan or Never for a workflow, and the Auto level for an Auto agent.
- **Edits** is what agents may do in the session: **Read only**, **Ask first**, **Edits allowed** or **Full access**. It reads the workspace default until you pick, and a start never writes a mode you did not pick. A pick applies to the whole session, the same as the chat box's picker, and is set before the first agent starts.
- **Limit** reads "Limit $5.00", with a quiet "default" while the amount is the workspace default. Its popover lists $5, $10 and $25 beside the default and your typed amount, with an **Other amount** field and **No limit**.
- Under the amounts the popover names the limits that still apply: the session limit, then each provider's monthly limit. Each shows what is spent, as in "Session $0 of $20.00 · Claude $41.20 of $200.00 this month".
- The run gets exactly the amount the chip shows. **No limit** means no limit, even when the workspace has a default. A start never adds a limit you did not see.
- The run page shows the same amount with its source, **default** or **this run**.
- **Guidance** shows on every kind. It starts as the workspace guidance, with a quiet "from Harborline" tag. Once you edit it the tag reads "this run", and "None" when you clear it.
- The chip shows the start of the text, and a tooltip shows all of it. Its popover has the text, **Use workspace guidance** and **No guidance**.
- The popover says who reads it. The orchestrator reads it on Orchestrated and Preset, the agent on Agent, and the Auto agent with the helpers it starts on Auto.
- Switching kind keeps the guidance you wrote. A start that fails keeps it, and Retry sends it again.
- Switching kind keeps what you typed and the values that still apply.
- The primary names what starts: **Start workflow**, **Start Scout** (the role you picked), **Start Auto agent**, or **Start** while Auto picks.
- Setup's Scout run is pinned to Agent, so it draws neither kinds nor settings.

### The Kind chip

Every run started from the field or the New session page leads its settings line with a **Kind** chip that names what runs. The names are those of the New session page: "Workflow · Orchestrated", "Workflow · Preset Fix a layout", "Agent · Auto agent" and "Agent · Scout".

The chip opens one popover. It shows:

- the kind and "set at start";
- one line on what that kind does;
- why it was picked ("you picked it" when you chose it on the page), with how many steps Auto changed in the preset;
- **With the preset** (Follow it, Adapt as it goes) on a preset run;
- the other kinds a run can be (Workflow · Orchestrated, each preset, Agent · Auto agent).

Its last line says what a pick does.

- Before the first step starts, the list reads **Change it to** and a pick applies to the same run, so nothing is spent twice. A plan with no step yet that becomes one agent is replaced by that agent. Follow and Adapt switch in place.
- While the run is going, the popover is read-only: it says what the run is and why, and offers no other kind ("Fixed while the run is going. Stop it to restart as something else."). Two runs never work on the same branch at once. A run with no agent yet counts as going while its first decision is pending.
- When the run is stopped, failed or blocked, the list reads **Restart as**. A last line reads "Ends this run and starts a new one with what it did so far." The new run gets the same ask and what the first found. Then the first run closes. If the new run fails to start, the popover stays open with the reason and the first run is left as it was. If the first run cannot close, the popover says the new run started and the first did not end.
- Once the run is finished, the list reads **Start a new run as**. A last line reads "Starts a new run with the same goal." and the new run gets what the first found. The finished run stays in the list.
- The session default is not on the chip: set it with **New runs in this session start as** in Settings.

### The model of a run

The settings line of a run names the model that runs it, next to the **Kind** chip.

- An orchestrated run shows **Orchestrator** with its model, **Auto** while the run follows the default. A pick is for this run only, and **Auto** in the picker goes back to the default. The chip is fixed while the orchestrator decides and once the run is over. The hint box below holds the same control.
- An Auto agent shows **Auto agent** in front of the model pill of its box. A pick there applies from the next turn of that agent.
- The default of each is in **Settings › Models › Runs**.

### The New session page

Start a session from your goal: write it or pick an issue, then choose the kind of run.

- The first field is **Goal** ("Describe the goal, or pick one from Tasks"). Write it, or press **Pick from Tasks** in its bottom row to pick an open issue. The issue fills the goal when it is empty and links to the session.
- **Where** sits in the settings row and reads **Auto picks**. The session runs on the workspace, and agents read every folder.
- The folders the goal needs are mounted on start. They are the workspace's only repo, the repo of a linked GitHub or GitLab issue, and the repos the goal names by their exact name.
- Later an agent mounts the folder it must edit by itself.
- Both share one allowance: the active folder, a folder linked by the issue and up to two more per session. More wait for your approval. See [mounts.md](../mounts.md#who-picks-the-folders).
- Open **Where** to pin folders yourself. Clear it to give the choice back.
- A picked issue whose repository Goodboy recognizes pins that repository in **Where**.

Under the task sits [one start form](#one-start-form).

- The page remembers the last kind you started in this workspace (saved after a start succeeds). It opens on that kind next time. The first visit opens with none pressed, so Auto picks.
- Each window keeps its own pick while it is open.
- ⌘K **New workflow session** opens the page on Orchestrated, **New agent session** on Auto, and **Start a run** with none pressed.
- The goal is required on every kind. If the start fails, the page keeps everything and Start becomes **Retry**. Leaving the page while a start is on its way drops the late answer.
- Start sends the kind you pressed, so the router does not guess. The run's line says "you picked it".

**Start blank** sits in the page header, and **Discard** sits next to Start once you wrote something. Esc closes the page and takes you back to where you were. If you wrote something, Esc asks whether to keep the draft or discard it, and keeping it leaves **New session** ready with your text.

**Where** is optional. Search it by name, even with 50 folders in the workspace.

- The list opens on Suggested (the folders you used last, then starred ones, five at most) and then All folders by name.
- It reads **Auto picks**, the folder you pinned, or how many you pinned.
- A pin always wins. With a folder pinned, nothing else is mounted on start.
- An Auto agent that has to write and finds no folder picks one the same way, inside the same allowance. It asks where it should work only when the task names no folder of the workspace or the allowance is spent.

### Start on a task

Start a session from an issue in Tasks, with the issue linked and its goal written in. **Start session** on an issue (or **Start from HBL-412** in its menu) opens the New session page. The issue sits above the goal field, and you can remove it with its ×. The goal is written in, and the kind is the one you started last.

A task is never a kind: **Pick from Tasks** works the same on every kind. Press Start. The session is created with the issue linked. The run starts as the kind you picked, or is routed like any other from Auto picks. If the start fails, the page keeps the issue and your text and Start becomes **Retry**.

### Review a pull request

A pull request waiting on you in Tasks shows **Review pull request** in place of Start. It opens a session with a read-only PR reviewer and the pull request checked out, on the Branch page where **Write review** waits.

### Start more work in a session

**New** in a session opens a menu: **Start a run**, **Write a report** and **Draw a wireframe**.

- **Start a run** opens Runs with the field focused.
- Report and Wireframe draft one from the session in the drawer.
- Inside a session the field keeps routing on its own. Write the ask, or type `@Scout` or `~Fix a layout` in the field.
- ⌘K offers the same **Start a run** and **Start from** each preset.
- A run you like can be kept from its page with **Save as preset**.
- While a run lives, **Pause run** (then **Resume run** in its place) and **Stop run** sit as buttons in its header.

**Tools beside the page**

The tools you reach from anywhere in the session sit as icons in a thin column at the right of the page, before any open panel. They stay put while the rail steps into a branch.

| Tool         | Key |
| ------------ | --- |
| **Ask**      | ⌘L  |
| **Terminal** | ⌘⌥T |
| **Explore**  | ⌘⌥X |
| **Context**  | ⌘⌥C |
| **Agents**   | ⌘⌥L |
| **Scripts**  | ⌘⌥S |

- Hover one to read its name and key. The one whose panel is open shows pressed.
- **Agents** lists every agent of the session as a tree, the same set as the Runs page. Runs and Auto sit with their agents under them, and an agent you started yourself is a launch of one row with its state word.
- The tree follows the run or Auto you have open, or shows every launch of the session when nothing is open.
- Click an agent, or press Enter on it, to read it in the page beside the tree. The tree stays open with that agent selected.
- **j** and **k** with focus on a row open the next and the previous agent.
- A session without agents says "No agents in this session yet".
- On a narrow window the panel lies over the page, and Esc closes it.

**Runs**

All the work of a session lives in one rail entry, **Runs**: preset runs, orchestrated runs, Auto conversations and the agents you started. One row per request, newest first.

- Each row says what it was, in the same words as the New session page: "Workflow · Preset Fix a layout", "Workflow · Orchestrated", "Agent · Auto agent" and "Agent · Scout".
- The page says what it holds in two lines under its title, whether it is empty or full.
- An empty Runs page is the Start a run field alone.

### Start blank

Start from the goal instead. **Start blank** opens the session straight on its Overview, where you add the goal, projects and work. The Overview is as wide as Runs, Artifacts and the branch pages, so nothing shifts as you move between them. Once you link an issue, **Write title and goal** drafts both from it for you to review.

### Named by Goodboy

Get a short title without writing one. A new session is named for you and marked **Named by Goodboy** until you rename it.

### Star an issue from Link work

**Link work** links a task to the session only. To keep a tracker issue for the whole workspace, press **Star it** under the issue and find it later in Tasks, under Starred.

### Undo an unlink

Unlinking a task from a session acts at once, with a 10-second **Undo** toast, and **⌘Z** works too. The unlink stays in the log with **Re-link**. Unlinking the issue you have open takes you back to its list; the breadcrumb above the issue does the same. If you moved elsewhere before the unlink finished, you stay where you went.

### Move an issue between the session and a branch

Choose where an issue belongs with **Move to** in its chip menu: the session or one of the open branches of its project. You can also drag the chip onto a branch row, and hold Alt to copy it instead. Every move has one Undo.

## Under the hood

This part is for contributors and agents who change the feature.

- Start form: `StartForm` draws the kinds, the fields, the settings row and the actions. `NewSessionStartForm` feeds it from the session draft and `RunsStartForm` from `useStartRun`. A kind declares the settings it uses in `START_KIND_SETTINGS`, and `startSettingsOf` keeps the order and drops a setting nothing supplies.
- Kind to route: `runAsOfStartFormKind` turns a pressed kind into the `RunAs` that `runAsRouteOf` turns into the route Start uses, with a typed token ahead of the kind. `routeLineOf` builds the live "Starts as" line.
- Edits: `StartEditsSetting` reads the draft, or the session on Runs. `applyStartEdits` calls `setSessionPermissionMode` before the first agent starts and does nothing when no mode was picked.
- Model chip: `RunModelChip` is the one control on every door and kind, the Agent kind of the New session page included. There `useDraftAgentModel` wraps the `useRunModel` view so a pick lands in the draft's `agentRouting`. `useRunModel` resolves the default of the slot the route lands on and keeps this start's pins by slot. `runModelSlotOf` maps a plan to the `workflow_orchestrator` task and a lead to its role, `auto` by default.
- Run page: `OrchestratorModelChip` reads `useOrchestratorModel`, which writes `setWorkflowOrchestratorRouting`. `AgentSettingsLine` draws the Auto agent label in front of the composer's model slot, and hides it with the slot when the box has no pill.
- Model pins: `startRoutedRun` takes `routing` for a lead and `orchestratorRouting` for a plan. `attachWorkflowToSession` stores the second as the run's `orchestratorRouting`. A start clears the pins.
- Prefix menu: `useRunPrefixMenu` reuses `QuickActionsPopover` for `~` and `@`. A pick sets the chip and empties the field.
- Attachments: `usePromptFiles` stages them. `startRoutedRun` saves them as goal attachments of the session (an agent) or the run (a plan) before the first agent starts.
- Limit chip: `autoLimitOf` returns the amount, its source and the default. `useAutoTreeLimit`, `AutoLimitChip` and its callers read it.
- Limit at start: `useAutoTreeLimit` returns `persist`, which resolves to the `StartLimit` that `startLimitOf` builds from the same facts the chip shows. `useStartRun` and `useStartShape` pass it to `startRoutedRun`, which hands `spendLimitUsd` and `limitSource` to `attachWorkflowToSession`. `runLimitOf` there sets the run's own limit and writes the same amount into its `rulesSnapshot`. The snapshot never carries a limit the form did not show. A start that passes nothing, such as a workflow from the chat prefix, copies the workspace limit of the Run defaults instead.
- Tiers: `limitTiersOf` words the session and provider month lines, `useAutoTreeLimit` returns them as `tiers`, and `runSettingsOf` uses the same function for the run's chain. `runLimitSourceOf` reads **default** or **this run** from the run's `limitSource`.
- Limit popover: `AutoLimitChip` uses `AnchoredPopover` at the standard popover width, so it flips and shifts inside the window.
- No limit: a Limit is stored only when you set one. **No limit** removes the workspace value, and a start never writes a limit you did not set.
- Kind chip: `runKindLineOf` words the chip, and the Runs list reads it too.
- Asks you chip: `AsksYouChip` is shared with the run's settings line. For the Auto agent `AutoLevelChip` wraps it, the same chip the running agent's settings line shows. The chip reads the session level, then the workspace default, through `useAutoLevel`, and `startRoutedRun` writes the pick with the `changeAutoLevel` store action before the lead starts.
- Guidance chip: `StartGuidanceSetting` reads the workspace text through `workspaceGuidanceOf` and the pick from the draft (`SessionDraft.guidance`, `null` until edited) or, on a session's Runs page, from `useStartRun`. `StartGuidanceChip` draws it on `SettingChip`, and `guidanceWordsOf` words the value and its tag. `guidanceShownOf` is the text on screen and `guidanceToSendOf` the text a start sends, so both read one pick. `startGuidanceReaderOf` picks the line on who reads it.
- Run guidance: `startRoutedRun` takes `guidance`, and `useStartRun` forwards it. A plan writes it to `rulesSnapshot.standingGuidance`, which the orchestrator reads as its Operator process. `null` keeps the workspace value. `''` starts the run without any.
- Agent guidance: an agent gets a `**Guidance**` section ahead of its ask. The Auto agent keeps its text in the `run.guidance` workspace value, which `spawnAgent` writes before the first turn.
- Auto guidance: `autoSystemPromptOf` adds a guidance block to the system prompt on every turn. `resolveDelegateChild` puts a `**Guidance**` section before the `**Task**` of each child.
- Unset guidance leaves every prompt as it was. `changeRunRoute`, `continueWithRole` and `moveToAuto` carry it to the run they start.
- Last kind you started: the setting `newSession.lastStart.<workspaceId>`, written after a start succeeds.
- Page intro: the two lines live in `SESSION_PAGE_INTRO` in `apps/desktop/src/features/session/sessionPageIntro.ts`, drawn by `SessionPageIntro` in the page header.
