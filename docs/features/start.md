# Start a task

Begin from an issue, a workflow or a question. Everything starts as one draft, and it becomes a session only when you press Start, so empty sessions do not pile up.

### Start a run

Write what you want done and press Start. A Lead runs it: it plans first, then starts the agents it needs.

- The **Start a run** field sits at the top of a session's Runs page.
- On the **New session** page, the same form routes the goal you wrote the same way until you pick a kind.
- Its hint reads "~ workflows, @ roles".
- Typing `~` or `@` in an empty field opens the same menu as the chat box. Pick a workflow or a role and the **Plan** row shows it.
- A name typed in the text still wins over the Plan row.
- The Plan row and the settings under the box are [one start form](#one-start-form).
- Under the box, a line reads "Starts as ..." with the reason and the model. It changes as you type, before you press Start. Once you pick a workflow or one agent, the line by Start says what runs.
- The paperclip, paste and drop attach files and images, on Runs and on New session, whatever the kind. They go with the run to its first agent. A file that cannot be attached says why on the box, and the text and the other files stay.
- ↵ starts, ⇧↵ adds a line.

The pick is a rule table in the app, with no model call. Goodboy reads it top to bottom until a row holds.

| Order | If                                                                                                       | Goodboy starts                                                                                               |
| ----- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| 1     | You said it: `~Fix a layout` or `@Scout`, or a default you set in Settings                               | A Lead with that preset as its plan, or that role at once. A session default wins over the workspace one.    |
| 2     | The ask names a preset of the workspace, or shares at least two words of its description and step titles | A Lead with that preset as its plan, free to change it. A name match ranks first, then the preset last used. |
| 3     | A task is linked, or the ask is a list or names many places ("every page")                               | A Lead                                                                                                       |
| 4     | The session's open pull request fails its checks or has changes requested, and the ask is about it       | A Lead                                                                                                       |
| 5     | A question, a check or one file                                                                          | A Lead                                                                                                       |
| 6     | Nothing above                                                                                            | A Lead                                                                                                       |

- **Start as** sets the default for the workspace. **New runs in this session start as** sets it for the open session. Both are in Settings, under **Run defaults**. Every value starts a Lead. Only **Lead with a preset that fits** lets row 2 hand it a preset. A default saved as Workflow before reads as **Lead**.
- A preset becomes the Lead's plan: its brief lists the steps in order, with **Keep steps** or **May change steps**. A step pinned to a model keeps that model: the child the Lead starts for its role runs on it. A role you named starts that one agent, with no Lead.
- New runs never start the orchestrator. A run started on it before keeps its engine, its line and its page.
- The reason is kept with the run.
- If the start fails, the field keeps your text and Start becomes **Retry**.
- Moving to another session while a start is on its way drops the late answer, so its text or error never lands on the other session.
- **Start a run** in a session's New menu and ⌘K opens the field. ⌘K offers **Start from** each preset, which opens it with `~` and the preset name.
- Outside a session, ⌘K **Start a run** opens the New session page on Auto picks.
- Setup's last step draws this field too, pinned to Scout, so the first start teaches the second.
- On a session's Runs page the settings row holds a **Branch** chip with the session's branches. It reads **Any branch** until you pick one, and shows the branch alone when the session has one.
- A picked branch goes with the ask, so the run works on that branch. A failed start keeps it for Retry. A successful start clears it.
- The branch page header has **Start a run on this branch**. It opens the field on Runs with that branch picked.

### One start form

Every door draws the same form: the New session page, a session's Runs page (and so the New menu's **Start a run**), ⌘K, and the setup Scout run.

- The goal comes first. Under it the **Plan** row says who plans the run: **The Lead plans it**, **Follow a workflow** or **One agent**. The action row ends the form, with one line by Start on what runs.
- **The Lead plans it** is picked by default and reads the table above. A draft left on Orchestrated by an older version opens on it.
- **Follow a workflow** is off until the workspace has a saved workflow. Picked, it shows the workflow picker, the box **Keep its steps as written** (empty, the Lead may change a step and says why) and the steps below.
- **One agent** shows the role picker in the same row.
- Under the Plan row the settings read as one sentence, such as "Stops after the plan · Edits full access · Limit $8.00 · harbor-portal". **Change** opens the controls under it and **Done** closes them.
- Each control is written "Label: value" and opens its own popover, anchored to it, so it stays inside the window. The source of a value ("from Harborline") sits in the popover header, and a control is tinted when its value is not the default.
- A plan shows only the settings it uses. **Projects** shows on the New session page only. **Limit** and **Asks you** do not show on One agent: a plain agent has no limit to enforce and no step to stop at.
- The model sits in the message box, beside **Start**. It names the model of the Lead or the agent for this run, **Auto** until you pick one. A pick is for this run only.
- **Asks you** is the Lead's level, when the Lead plans and when it follows a workflow.
- **Edits** is what agents may do in the session: **Read only**, **Ask first**, **Edits allowed** or **Full access**. It reads the workspace default until you pick, and a start never writes a mode you did not pick. A pick applies to the whole session, and is set before the first agent starts. The chat box picker reads **Edits: Ask first**, the same label.
- **Limit** reads "Limit: $5.00" ("Limit: none" without one), with a quiet "default" while the amount is the one the kind starts from. Every kind, and a start with no kind pressed, starts from the **Run defaults** limit. Switching kind shows the new kind's default and keeps an amount you typed. Its popover lists $5, $10 and $25 beside the default and your typed amount, with an **Other amount** field and **No limit**.
- Under the amounts the popover names the limits that still apply: the session limit, then each provider's monthly limit. Each shows what is spent, as in "Session $0 of $20.00 · Claude $41.20 of $200.00 this month".
- The run gets exactly the amount the chip shows. **No limit** means no limit, even when the workspace has a default. A start never adds a limit you did not see. An amount you type applies to the run you start and never changes the Run defaults limit. It stays in the chip until the run starts, so a failed start keeps it for Retry and the next start begins from the default again. The help in the popover names the same source as the amount.
- The run page shows the same amount with its source, **default** or **this run**.
- **Guidance** shows on every kind. It starts as the workspace guidance, with a quiet "from Harborline" tag. Once you edit it the tag reads "this run", and "None" when you clear it.
- The chip shows the start of the text, and a tooltip shows all of it. Its popover has the text, **Use workspace guidance** and **No guidance**.
- The popover says who reads it: the Lead and the agents it starts, or the one agent.
- Switching the plan keeps the guidance you wrote. A start that fails keeps it, and Retry sends it again.
- Switching the plan keeps what you typed and the values that still apply.
- The primary always reads **Start**, whatever the plan.
- Setup's Scout run is pinned to one agent, so it draws no Plan row and no role picker, and the same settings as every other form.
- Start work from chat drafts the brief in the drawer, makes the session, then opens this form on the session with the goal filled in.

### Permission rows

A Lead's autonomy is nine rows you can read and change.

- The rows are: approve the plan, start agents that read, start agents that write, push, and open a pull request. The rest are add dependencies, change protected files, add a project and close the work.
- The three levels, **Every step**, **After the plan** and **Never**, are presets of these rows. **Custom** lights up by itself when the rows match none of them.
- The panel groups the rows under Agents, Git and publishing, Project and Finish, and its first line says what the Lead asks you before.
- Each row has its own value on a Lead and a default for the workspace. A row set on a Lead is marked **Changed**, with **Reset** beside it. A row you did not set follows the default live.
- The workspace level is **Stops for your OK** in the Run defaults, shared with workflows. The panel opens from the **Asks you** chip of the start form and from the Lead page.
- A row saves the moment you change it. A failed save keeps the old value and shows the error under the row.
- A row you tighten while an agent runs applies to its next start. One you loosen never releases a start that already waits.
- The spend limit shows under Finish, read only. Four rules never change, listed under Always on: a force push asks and takes a backup, you merge, agents never push, and the Lead never writes code.
- An older workflow run keeps the level it started with.

### The Kind chip

Every run started from the field or the New session page leads its settings line with a **Kind** chip that names what runs. It uses the words of its row on Runs: "Lead", "Lead · plan Fix a layout" and "Agent · Scout". A run started before keeps its name, such as "Workflow · Orchestrated" or "Workflow · Preset Fix a layout".

The chip opens one popover. It shows:

- the kind and "set at start";
- one line on what that kind does;
- why it was picked ("you picked it" when you chose it on the page), with how many steps Auto changed in the preset;
- **With the workflow** (Keep steps, May change steps) on an older preset run;
- the other kinds a new run can be (Lead, and Lead · plan for each preset).

Its last line says what a pick does.

- Before the first step starts, the list reads **Change it to** and a pick applies to the same run, so nothing is spent twice. A plan with no step yet that becomes one agent is replaced by that agent. Follow and Adapt switch in place.
- While the run is going, the popover is read-only: it says what the run is and why, and offers no other kind ("Fixed while the run is going. Stop it to restart as something else."). Two runs never work on the same branch at once. A run with no agent yet counts as going while its first decision is pending.
- When the run is stopped, failed or blocked, the list reads **Restart as**. A last line reads "Ends this run and starts a new one with what it did so far." The new run gets the same ask and what the first found. Then the first run closes. If the new run fails to start, the popover stays open with the reason and the first run is left as it was. If the first run cannot close, the popover says the new run started and the first did not end.
- Once the run is finished, the list reads **Start a new run as**. A last line reads "Starts a new run with the same goal." and the new run gets what the first found. The finished run stays in the list.
- The session default is not on the chip: set it with **New runs in this session start as** in Settings.

### The model of a run

The settings line of a run names the model that runs it, next to the **Kind** chip.

- An older orchestrated run shows **Orchestrator** with its model, **Auto** while the run follows the default. A pick is for this run only, and **Auto** in the picker goes back to the default. The chip is fixed while the orchestrator decides and once the run is over. The hint box below holds the same control.
- An agent or a Lead has its model in its message box, beside **Send**. A pick there applies from the next turn of that agent.
- The default of each is in **Settings › Models › Runs**.

### The New session page

Start a session from your goal: write it or pick an issue, then choose the kind of run.

- The first field is **Goal** ("Describe the goal, or pick one from Tasks"). Write it, or press **Pick from Tasks** in its bottom row to pick an open issue. The issue fills the goal when it is empty and links to the session.
- **Pick from Tasks** lists your open tasks by source, newest first. Tabs on top narrow it to one source (Linear, GitHub, Sentry, whatever is connected) and count what matches the search. Each row shows the key, the title, its state and its repo or project. Arrows move, Enter picks, Tab reaches the source tabs. A source that didn't load says so in the list with **Retry**. The page remembers the source you picked in this workspace.
- **Projects** sits in the settings row and reads **Auto picks**. The session runs on the workspace, and agents read every folder.
- The folders the goal needs are mounted on start. They are the workspace's only repo, the repo of a linked GitHub or GitLab issue, and the repos the goal names by their exact name.
- Later an agent mounts the folder it must edit by itself.
- Both share one allowance: the active folder, a folder linked by the issue and up to two more per session. More wait for your approval. See [mounts.md](../mounts.md#who-picks-the-folders).
- Open **Projects** to pin folders yourself. Clear it to give the choice back.
- A picked issue whose repository Goodboy recognizes pins that repository in **Projects**.

Under the task sits [one start form](#one-start-form).

- The page remembers the last kind you started in this workspace (saved after a start succeeds). It opens on that kind next time. The first visit opens on Lead.
- Each window keeps its own pick while it is open.
- ⌘K **New workflow session**, **New agent session** and **Start a run** open the page on Lead.
- The goal is required on every kind. If the start fails, the page keeps everything and Start becomes **Retry**. Leaving the page while a start is on its way drops the late answer.
- A session with no run shows this form inline on its Overview, so the first action is on the page. **New** stays the outline button in every state.
- After a start, if the new worktree reads its dependencies from another folder, a warning says to reinstall before the agent runs checks. The Branch page keeps its own notice.
- Start sends the kind you pressed, so the router does not guess. The run's line says "you picked it".

**Start blank** sits in the page header, and **Discard** sits next to Start once you wrote something. Esc closes the page and takes you back to where you were. If you wrote something, Esc asks whether to keep the draft or discard it, and keeping it leaves **New session** ready with your text. The text you typed survives a reload too.

**Projects** is optional. Search it by name, even with 50 folders in the workspace.

- The list opens on Starred, then Recent (the folders your latest sessions worked in, five at most), then All projects by name. A folder that matches the picked task leads Recent with the reason under its name.
- The star on a row, or ⌘S on the highlighted row, stars or unstars it. The star changes once the save is done; a failed save leaves it as it was and says why in the list. With nothing starred, one line at the bottom says how.
- It reads **Auto picks**, the folder you pinned, or how many you pinned.
- A pin always wins. With a folder pinned, nothing else is mounted on start.
- A Lead that has to write and finds no folder picks one the same way, inside the same allowance. It asks where it should work only when the task names no folder of the workspace or the allowance is spent.

### Start on a task

Start a session from an issue in Tasks, with the issue linked and its goal written in. **Start session** on an issue (or **Start from HBL-412** in its menu) opens the New session page. The issue sits above the goal field, and you can remove it with its ×. The goal is written in, and the kind is the one you started last.

A task is never a kind: **Pick from Tasks** works the same on every kind. Press Start. The session is created with the issue linked. The run starts as the kind you picked, or is routed like any other from Auto picks. If the start fails, the page keeps the issue and your text and Start becomes **Retry**.

The Linked card in the Context tab holds the linked work list, with older work under **Show history**. A row opens its record, with the session title as its first crumb above it. Unlink returns there after saving; a failure keeps the record open. Sentry rows open in **Tasks**, which their tooltip says, and name their issue, as in **Open PAYMENTS-42 in Tasks**. Work on any branch the session holds counts as current whichever branch is active; only work of a branch the session no longer holds, or already merged, goes under history. Search or run and provider shortcuts open **Link work** on that provider, also when the session pages are folded, and are not offered on an archived session.

### Review a pull request

A pull request waiting on you in Tasks shows **Review pull request** in place of Start. It opens a session with a read-only PR reviewer and the pull request checked out, on the Branch page where **Write review** waits.

### Start more work in a session

**New** in a session opens a menu: **Start a run**, **Write a report** and **Draw a wireframe**.

- **Start a run** opens Runs with the field focused.
- Report and Wireframe draft one from the session in the drawer.
- Inside a session the field keeps routing on its own. Write the ask, or type `@Scout` or `~Fix a layout` in the field.
- ⌘K offers the same **Start a run** and **Start from** each preset.
- A run you like can be kept from its page with **Save as preset**.
- While a run lives, **Pause run** (then **Continue** in its place) and **Stop run** sit as buttons in its header.

**Tools beside the page**

A thin column of icons sits at the right of every screen, under the caption **Tools**. It holds **Terminal** (⌃\` or ⌘⌥T) and **Browser**. They open beside whatever you are doing and stay open as you move between sessions and pages. With a dock open, the column sits on the dock's left edge. See [Terminal](keyboard.md#terminal) and [Browser](keyboard.md#browser).

The other views of a session open from its head and from the keyboard:

| View                 | Key |
| -------------------- | --- |
| **Ask**              | ⌘L  |
| **Context** tab      | ⌘⌥C |
| **Runs** on running  | ⌘⌥A |
| Changes on All files | ⌘⌥X |
| **Scripts**          | ⌘⌥S |

- **Context** opens on Goal; its cards share one menu for editing, versions and who reads them.
- Hover one to read its name and key. Each tool shows its name below its icon, brighter while it is open.
- **Agents** lists every agent of the session as a tree, the same set as the Runs page. Each run sits with its agents under it, a Lead first, and an agent you started yourself is a launch of one row with its state word.
- The tree follows the run you have open, or shows only what is live when nothing is open. **All runs** goes to the Runs page.
- Click an agent, or press Enter on it, to read it in the page beside the tree. The tree stays open with that agent selected.
- **j** and **k** with focus on a row open the next and the previous agent.
- A session with nothing live says "Nothing live right now".
- On a narrow window the panel lies over the page, and Esc closes it.

**Runs**

All the work of a session lives in one rail entry, **Runs**: the runs a Lead leads, older preset and orchestrated runs, and the agents you started. One row per request, newest first.

- Each row says who leads it: "Lead", "Lead · plan Fix flaky tests" when the Lead follows a preset, and "Agent · Scout" for a one agent run. An older row keeps its own line, "Workflow · Preset Fix a layout", and an orchestrated one adds a gray "older run".
- The page says what it holds in one gray line under its title, whether it is empty or full.
- Groups read their name in bold with their count in gray, 32px apart. A run's name leads its row; the kind, state, progress, cost and age after it are one step smaller and gray.
- **By branch** puts what needs you first, then what is running, then open branches with the newest work on top. **No branch** follows the same rules.
- A Lead and every agent it starts sit under the branch they work on. In a session with one branch, every run sits under it, older runs too.
- A branch whose pull request is merged or closed, or whose worktree is gone, folds under one **Finished** row at the bottom once its runs are done. The row is closed until you press **Show**.
- A finished run's name is gray. A live run keeps full weight and its state.
- Archived runs never show on Runs. The timeline keeps them, and the run's page restores them.
- An empty Runs page is the Start a run field alone.

### Start blank

Start from the goal instead. **Start blank** opens the session straight on its Overview, where you add the goal, projects and work. The Overview is as wide as Runs, Artifacts and the branch pages, so nothing shifts as you move between them. Once you link an issue, **Write title and goal** drafts both from it for you to review.

### Named by Goodboy

Get a short title without writing one. A new session is named for you and marked **Named by Goodboy** until you rename it.

### Star an issue from Link work

**Link work** links a task to the session only. To keep a tracker issue for the whole workspace, press **Star it** under the issue and find it later in Tasks, under Starred.

### Undo an unlink

Unlinking a task from a session acts at once, with a 10-second **Undo** toast, and **⌘Z** works too. The unlink stays in the log with **Re-link**. Unlinking the issue you have open takes you back to its list; the back row above the issue does the same. If you moved elsewhere before the unlink finished, you stay where you went.

### Move an issue between the session and a branch

Choose where an issue belongs with **Move to** in its chip menu: the session or one of the open branches of its project. You can also drag the chip onto a branch row, and hold Alt to copy it instead. Every move has one Undo.

A failed start keeps the goal and settings. Its cause appears above the form actions, and starting again retries. A missing provider offers Connect a provider; other failures offer Copy details.

## Under the hood

- Branch Runs tab: `branchWorkTabRegistration` (`features/session`) gives the Branch page its Runs tab, `useBranchWork` reads the branch group of runs, questions and artifacts once, and `branchWorkCountsOf` turns it into the badge. `components/BranchWork/index.test.tsx` checks that the tab counts what Runs and Questions count for the same branch; `u37-branch-work` is its scene. `placedAgentsOf` puts an agent with no mount on its Lead's tree mount or on the only mount of the session. Runs and the Overview board both read it. `placedAgentsOf.test.ts` covers one mount, two mounts and older rows.
- Agent page menu: `agentHeaderOmitOf` omits Change model because `AgentRunSettings` supplies the model control. `AgentHeaderActions` also omits redundant reply-copy and changes rows when needed. `p10-agent-page.test.tsx` caps child menus at five rows and keeps Copy name.

This part is for contributors and agents who change the feature.

- Start form: `StartForm` draws the Plan row (`StartPlanRow`, with `StartWorkflowPick` and `StartWorkflowSteps`), the settings row and the actions. `NewSessionStartForm` feeds it from the session draft and `RunsStartForm` from `useStartRun`. A kind declares the settings it uses in `START_KIND_SETTINGS`, and `startSettingsOf` keeps the order and drops a setting nothing supplies.
- Settings sentence: `StartSettingsRow` reads the words of each setting in `START_SENTENCE_ORDER` and keeps the controls under **Change**. `startSettingWordsOf` writes those words from the values the controls show: `useStartEditsMode` and `useDraftProjects` are shared with `StartEditsSetting` and `WhereChip` (`StartSettingsRow/index.test.tsx`). `startFormNoteOf` writes the line by Start.
- Branch chip: `StartRunBranchChip` sits in the Where slot of `RunsStartForm` and lists the attached mounts through `startRunBranchOptionsOf`. `openStartRun` takes the branch, `startRunBranchOf` reads it from the event, and `askOnBranchOf` adds it to the ask. `BranchTools` is the branch page door; `startRunDoors.scenes.test.tsx` and `BranchPage/overviewDoors.test.tsx` cover the doors.
- Kind to route: `runAsOfStartFormKind` turns a pressed kind into the `RunAs` that `runAsRouteOf` turns into the route Start uses, with a typed token ahead of the kind. `routeLineOf` builds the live "Starts as" line.
- Edits: `StartEditsSetting` reads the draft, or the session on Runs. `applyStartEdits` calls `setSessionPermissionMode` before the first agent starts and does nothing when no mode was picked.
- Model chip: `RunModelChip` is the one control on every door and kind, the Agent kind of the New session page included. Its `pill` variant sits in the `model` slot of the start box (`StartRun`, `StartTaskField`) with the composer pill look (`ROUTING_PILL_CLASS`); `START_KIND_SETTINGS` has no model key. `SessionKickoff` picks the view once and hands it to the box and to `NewSessionStartForm`. There `useDraftAgentModel` wraps the `useRunModel` view so a pick lands in the draft's `agentRouting`. `useRunModel` resolves the default of the slot the route lands on and keeps this start's pins by slot. `runModelSlotOf` maps a plan to the `workflow_orchestrator` task and a lead to its role, `auto` by default.
- Run page: `OrchestratorModelChip` reads `useOrchestratorModel`, which writes `setWorkflowOrchestratorRouting`. An agent page keeps its model in `ComposerToolbar` (`ComposerRoutingPicker`); `AgentSettingsLine` draws no model (`modelInComposer.test.tsx`).
- Model pins: `startRoutedRun` takes `routing` for a lead and `orchestratorRouting` for a plan. `attachWorkflowToSession` stores the second as the run's `orchestratorRouting`. A start clears the pins.
- Prefix menu: `useRunPrefixMenu` reuses `QuickActionsPopover` for `~` and `@`. A pick sets the chip and empties the field.
- Attachments: `usePromptFiles` stages them. `startRoutedRun` saves them as goal attachments of the session (an agent) or the run (a plan) before the first agent starts. On New session, `SessionKickoff` hands the files `useStartRun` stages to `StartTaskField` and to `useStartShape`. An agent or preset start sends them and removes them once it went through (`newSessionAttach.test.tsx`).
- Limit chip: `autoLimitOf` returns the amount, its source and the default. `useAutoTreeLimit` returns `view`, `start` and `settle`. Every kind reads the one default, `runDefaultLimitOf`, which reads the workspace rules through `workspaceRulesFor`, the same fn `attachWorkflowToSession` uses. The chip, its help (`AUTO_LIMIT_COPY.helpOf`) and the start read that one source, and the chip links to the Run defaults page (Change default, `openRunDefaults`). A typed amount is for that run only and never becomes the default. `useStartRun` and `useStartShape` call `settle` after a successful start, which drops the typed amount.
- Limit at start: `start` returns the `StartLimit` that `startLimitOf` builds from the same facts the chip shows. `useStartRun` and `useStartShape` call it at start time, and pass the result to `startRoutedRun`, which hands `spendLimitUsd` and `limitSource` to `attachWorkflowToSession`. `runLimitOf` there sets the run's own limit and writes the same amount into its `rulesSnapshot`. The snapshot never carries a limit the form did not show. A start that passes nothing, such as a workflow from the chat prefix, copies the workspace limit of the Run defaults instead.
- Limit of a Lead: for a Lead, a preset one included, `startRoutedRun` hands the amount to `spawnAgent` as `limitUsd`, or `null` when the person chose No limit. It lands in the `run.limit` workspace value before the agent row exists. `startAutoTree` reads it in place of the workspace default, so the tree starts at that cap, or uncapped. A lower session limit still wins (`startAutoTrees.sqlite.test.ts`, `spawnAgent.limit.sqlite.test.ts`, `runLimit.sqlite.test.ts`).
- Pinned steps of a Lead: the locked steps of a preset go to `spawnAgent` as `stepLocks`. They land in the `run.locks` workspace value before the agent row exists. `resolveDelegateChild` reads the lock of the first step with the child's role (`readRunStepLock`). It passes it as `stepLock`, so the child runs on that provider, model and effort (`runLocks.sqlite.test.ts`, `resolveChildRouting.test.ts`).
- Tiers: `limitTiersOf` words the session and provider month lines, `useAutoTreeLimit` returns them as `tiers`, and `runSettingsOf` uses the same function for the run's chain. `runLimitSourceOf` reads **default** or **this run** from the run's `limitSource`.
- Limit popover: `AutoLimitChip` uses `AnchoredPopover` at the standard popover width, so it flips and shifts inside the window.
- No limit: **No limit** on the chip is for that run only. A start never writes a limit, so the default changes only on the Run defaults page.
- Kind chip: `runKindLineOf` words the chip, and the Runs list reads it too.
- Asks you chip: `AsksYouChip` is shared with the run's settings line. For the Lead `AutoLevelChip` wraps it, the same chip the running agent's settings line shows. The chip reads the session level, then the workspace default, through `useAutoLevel`, and `startRoutedRun` writes the pick with the `changeAutoLevel` store action before the lead starts.
- Guidance chip: `StartGuidanceSetting` reads the workspace text through `workspaceGuidanceOf` and the pick from the draft (`SessionDraft.guidance`, `null` until edited) or, on a session's Runs page, from `useStartRun`. `StartGuidanceChip` draws it on `SettingChip`, and `guidanceWordsOf` words the value and its tag. `guidanceShownOf` is the text on screen and `guidanceToSendOf` the text a start sends, so both read one pick. `startGuidanceReaderOf` picks the line on who reads it.
- Run guidance: `startRoutedRun` takes `guidance`, and `useStartRun` forwards it. A plan writes it to `rulesSnapshot.standingGuidance`, which the orchestrator reads as its Operator process. `null` keeps the workspace value. `''` starts the run without any.
- Agent guidance: an agent gets a `**Guidance**` section ahead of its ask. The Lead keeps its text in the `run.guidance` workspace value, which `spawnAgent` writes before the first turn.
- Auto guidance: `autoSystemPromptOf` adds a guidance block to the system prompt on every turn. `resolveDelegateChild` puts a `**Guidance**` section before the `**Task**` of each child.
- Unset guidance leaves every prompt as it was. `changeRunRoute`, `continueWithRole` and `moveToAuto` carry it to the run they start.
- Last kind you started: the setting `newSession.lastStart.<workspaceId>`, written after a start succeeds.
- Permission rows: the rows, presets and precedence are `packages/core/src/auto/permissions.ts`. A Lead's own rows live in `auto_trees.permissions` and the default in the workspace value `auto.permissions` (m243). The panel is `LeadPermissionsPanel` in `features/auto/permissions/`; `PERMISSION_GROUPS` holds its four groups. The old `work.enabled` setting is never read: the rules it turned on are the rules for everyone, pinned by `upgradeFromSwitchOff.sqlite.test.ts`.
- Branch arrival: `openBranchWork` carries the requested group to `useRunsFolds`, which unfolds its finished rows in either grouping, and **Finished** when the group sits there. `rowControls.test.tsx` covers bare state rows past the cap, a merged branch, focus and scrolling.
- Runs order: `branchGroupOrderOf` orders the By branch groups and splits off the finished ones, which `FinishedBranches` folds. A removed worktree keeps its branch in `SessionRun.goneBranches`. `RunsGrid/index.tsx` drops archived runs. `RunsGrid/order.test.tsx` and the `u37-runs-order` scenes cover it.
- Page intro: the two lines live in `SESSION_PAGE_INTRO` in `apps/desktop/src/features/session/sessionPageIntro.ts`, drawn by `SessionPageIntro` in the page header.

`StartFailure` owns the recovery line shared by `StartForm`.

- Linked work: `LevelLinked` owns the list and history fold. `IntegrationPane` returns to Overview after unlink succeeds. `openLens` routes provider shortcuts to Link work with the provider as the event source, and `buildWorkItems` compares a link with every mount branch.

- Question arrival: `QuestionsGrid` unfolds Answered and focuses the plain question id in state mode. `QuestionsGridRow` ignores title clicks from nested buttons and links. `apps/desktop/src/features/session/components/SessionWorkspace/parts/QuestionsPane.byBranch.test.tsx` covers answered-only arrival and Also on without opening the drawer.

- Task picker: `TaskPicker` feeds `useInboxRecords` into `TaskPickerPopover` (`SessionKickoff/TaskPickerPopover/`). `taskPickerView` owns the open tasks, the grouping, the search and every count; done tasks and sources without candidates (Slack, Bitbucket) are left out. `useTaskPickerCursor` follows the task key, so a source that answers late keeps the cursor on the same task. `taskPickerSourcePref` keeps the source per workspace. `TaskPickerPopover/index.test.tsx` and the `u44-task-picker-*` scenes cover it.
