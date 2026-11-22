# Workspaces and folders

A workspace keeps your folders together, and one session can work across several of them. Each branch an agent works on gets its own worktree, so agents edit in parallel without touching your checkout.

### Start from scratch

Begin with an empty folder and no repository. **Start from scratch**, inside **New workspace**, makes the folder, starts a git repository with a first commit and opens a first session in it. **Publish** later creates a GitHub repository for it, or links one you already have.

### Track a folder with git later

Start in a plain code folder and add git when you want it. When you pick a folder, Goodboy asks whether it is a **Code project** or **Documents**, preselected from what it holds, and you can change it later in **Settings › Folders**. A code folder can be tracked with git right at Create. **Track with git** in **Settings › Folders** shows the first commit before it happens: what goes in, dependency and build folders left out until you tick them back in, and files that look like secrets, which always stay out and go to `.gitignore`. Nothing leaves your Mac until **Publish to GitHub**. A repository with no commit yet holds sessions back, because a session branches from the latest commit: the empty board says so and its one action, **Make the first commit**, opens the same review in place and reads the repository again once it is made. A plain folder with an empty repository is still edited in place until its first commit. Git you set up outside the app is noticed when the window comes back: a code folder moves to branches between turns and offers **Keep editing in place**, and a documents folder asks first.

A plain folder is edited in place by one session at a time, and the next one waits its turn; reading is never blocked. Each plain folder row in **Settings › Projects** opens to its face, the saved versions it uses and a switch between Code project and Documents. Office files and PDFs are read, never rewritten, in a documents folder. What each turn changed is under **Changes** in the Session pages list, and it stays there when you later track the folder with git. Unlinking a folder waits while an agent is writing in it.

### Workspace with several folders

Keep your repos together as one workspace, and let one session work across several of them. The **Projects** card of a session lists each repo it touches, with its branch and the size of its changes. A folder gets a branch only when an agent needs to edit it. The **+** on the card adds another workspace folder, or connects a new repo or folder to the workspace from the same list.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workspace-several-projects-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workspace-several-projects-light.webp" alt="A Harborline session on its Overview: the tiles Branches 2 of 8 merged, Spend $8.07 for 5 agents and Time 3.3h, the next step Review the changes with Continue, then In progress 6 lists ledger-core with four branches and notify-relay with two, each branch with its pull request state, and Merge in order">
</picture>

<sub>Screenshot from Goodboy 0.40.1</sub>

### Starred folders, descriptions and base branch

Point agents at the right repo without naming it. Star a folder and give it a one-line description: both go into each agent's brief, and starred folders come first in the pickers. Each repo shows its base branch, read from origin.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workspace-starred-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workspace-starred-light.webp" alt="The Projects page of the Harborline workspace settings: Starred 2 with ledger-core and payments-api, each with a one-line description and the base branch main, Other folders 2 with notify-relay and runbooks, and a note about a session folder left on disk with Review in Storage">
</picture>

<sub>Screenshot from Goodboy 0.40.1</sub>

### Worktrees

Let agents edit in parallel without touching your checkout. Each branch gets its own worktree, a separate folder with its own changes and pull request, named gb- and six characters such as gb-7k2q9x, with the session and the branch shown next to it. **New branch**, the **+** on a folder row of the session's **Projects** card, adds one, **Close branch** clears a merged one, and **Reopen** brings back one whose files were kept.

The Projects card is one tree for every branch of the session. A branch is one line: its pull request state as a colored glyph, its pull request title (or the branch name when there is none) and, only when something needs you, one chip: failing checks, a conflict or how far it is behind. Live branches come first, queued, approved, open, draft, then those with no pull request; merged and closed ones fold into one **finished** line. Click a branch to open it: its pages (pull request, comments, changes, commits, checks) open under its row, with its **Rebase** line when it is behind, and a click on the open row folds them again. The branch menu, from the dots on the row, a right click or ⇧F10, holds Rebase, Switch branch, Link work to this branch, Copy branch name, Close branch and the rest.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workspace-worktrees-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workspace-worktrees-light.webp" alt="A session on its Overview with In progress 4: ledger-core with three branches (fix/ledger-reconciliation-idempotent-postings with pull request #418, ...ledgerbook-writes with #421 and ...statement-backfill with no pull request) and notify-relay with ...webhook-rate-limit-backoff #96, then Merged 2 with ...rounding-drift #412, and at the top the notice that fix/ledger-reconciliation-statement-backfill in ledger-core is closed and its files are still on disk, with a Reopen button">
</picture>

<sub>Screenshot from Goodboy 0.40.1</sub>

### Several branches per repo

Work on several branches of one repo in the same session, each in its own worktree. If a worktree ends up on another branch, a card says so and offers **Use this branch here** or **Keep both branches**.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workspace-branches-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workspace-branches-light.webp" alt="The Projects card of one session where two branches are not the ones recorded: ledger-core is on another branch and offers Check again and Not now, and notify-relay offers Use this branch here, Keep both branches and Not now">
</picture>

<sub>Screenshot from Goodboy 0.40.1</sub>

### Workspace switcher and Reconnect

Jump between workspaces and folders from one search. The current workspace sits on top with its folder count, **Add folder** (the folder picker, a repository or a plain folder, then an undo toast; a folder of another workspace points to its folders; **Move it here** into the open workspace, or a merge, adds the moved sessions without stopping any running agent, and it is refused with the number of agents running in the source until you stop them), **Manage folders** and its settings. The other workspaces follow in one list: a click switches once the new workspace has loaded, so a quick second click wins and a failed load keeps the workspace you were in, the window icon opens one in a new window, and a disconnected workspace keeps its place with **Reconnect**. **New workspace** closes the list and opens the one form. Disconnecting a workspace keeps its history, and adding its folder again offers **Reconnect** too.

A workspace you are not looking at can still need you. Its row in the list says **2 need you** in amber, or red when one of them is broken, with the reasons in place of the folder line, for a workspace open in another window as well as for one that is open nowhere. The same sessions are added up as a number on the workspace mark at the top of the left rail when any other workspace needs you, and the bell can widen to **All workspaces**. The count of a workspace nobody shows is read from the database every 30 seconds and counts what is saved there: an open question, a fix run waiting for your answer, a failed push, failing checks and an errored session. The window that shows a workspace also knows what lives only in memory, such as a plan or a permission waiting, so it sends its own count to the other windows and that count wins while the window is open.

### Sessions in the bar

**Sessions**, at the top left of the bar, or **⌘B** from any screen, opens your sessions in one list: Pinned first, then Needs you, Running, In review and Building. Type to filter by title or project, use the arrows and **Enter** to open one, and click a pin to move a row in or out of Pinned. A pin that cannot be saved leaves the row where it was and says so. **Open Board** at its foot shows the finished ones too.

### Overview and Desk

A session has two faces: **Overview** to read it, **Desk** to work in it. The control **Overview | Desk** sits at the right of the session's tabs, and **⌘J** switches between the two, also from a terminal or a Browser page (**View › Desk**). The head and the tabs stay the same on both faces. Switching adds nothing to Back and Forward, and Esc never leaves the Desk.

On the Desk a column at the left keeps the session in view: its state, Needs you, Now, the first two moves of Next, its projects and the Ask line, which steps aside while the Ask panel of that session is open. Everything to its right, under the head, is work: Terminal, Browser and Monitor fill it in up to two columns of two, and the agent, a pull request or Scripts open beside them. No space stays empty between the column and the tools, and nothing lies over the column. When the tools would get less than 880px beside the column, it folds into one status line that opens it in a popover, and the tools take the whole width. When even then the tools do not fit side by side, the ones after the second become tabs of one cell. The face changes at once: the tool it opens shows its own loading state, and an error with **Retry** stays in that tool.

A session opens again on the face you left it on; the first time, on the Overview. A Desk that comes back with no tool opens the terminal. On a page that is not a face, such as Runs, the control lights neither face, and Desk takes you back to the session on the Desk.

### New worktrees start usable

A new worktree is a clean checkout, so the folder settings carry what it lacks. **Worktree setup**, under a repository folder in Settings, lists its git-ignored files (`.env.local`, `config/local.json`), none ticked, a secret marked **secret: only when ticked**; the ticked ones are copied into every new worktree, only when git ignores them and never over a file that is already there. **Setup after creation** is prefilled from the lockfile (`pnpm install`) and says where it came from. When a session cuts a worktree, the overview shows **Worktree payments-api/retry-webhook is ready**, what was copied and the proposed setup with **Run** and **Not now**; the setup never runs without that click. Dependencies are never copied byte by byte: that is what the setup is for.

### Repo status across folders

See which repos have something to pull, right next to the workspace switcher.

Every 5 minutes Goodboy fetches origin for each repo. It compares the local base branch (the folder's base branch, else the remote default branch) with its upstream. Fetching never moves a local branch.

- A repo that is behind puts a dot and **3 behind** on the **Repositories** entry.
- A repo whose base branch has commits of its own reads **Diverged**. Its tooltip explains that Goodboy only fast-forwards, so you merge or rebase it yourself.
- When origin cannot be reached, the entry reads **Check failed**, with **Retry** on the row, and no toast.

The entry opens one header row: the title, when origin was last checked, **Pull all** once two or more repos can pull, and the refresh icon. Under it come the repos that need attention.

- A behind repo has **Pull**.
- A diverged repo has the reason in words.
- A failed check has **Retry**.
- The repos with nothing to pull fold into one quiet line, **18 up to date**. It opens on click.
- Every row shows its folder in Finder and opens it in the editor in one click. It keeps the action column put when it has no **Pull**, and opens its detail in place under the row.

A pull leaves some branches alone.

- A checkout on a feature branch stays there while its base branch moves.
- A base branch checked out with uncommitted files says so instead of offering **Pull**.
- A base branch that would not fast-forward, or is checked out in another worktree, is skipped.

**Settings › Advanced › Git** sets how often it checks (Off, 5, 15 or 30 minutes). Several windows on one workspace share one fetch.

⌘K **Pull main in all linked repos** and **Pull <branch> in <repo>** run the same pull. A toast lists each repo with its branch, and the title counts updated, skipped and failed.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workspace-repo-status-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workspace-repo-status-light.webp" width="740" alt="The Repositories popover opened from the top bar entry 2 repos behind, Diverged: Checked 4m ago with Pull all, payments-api 3 behind and ledger-core 1 behind each with Pull, notify-relay Diverged with the reason in words, risk-models Couldn't reach origin with Retry, and the line 18 up to date">
</picture>

<sub>Screenshot from Goodboy 0.40.1</sub>

### Locate moved folders

If you moved your repos to a new folder, the workspace settings name the folders Goodboy can't find. **Locate folders** finds them in the parent folder you pick, by their first commit and remote, and repairs the worktrees, with **Undo move**. After a failure, the move and the undo both pick up at the folder that stopped them.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workspace-locate-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workspace-locate-light.webp" alt="The Locate moved folders form: Confirm the folders Goodboy should reconnect, ledger-core moved from its old folder to ~/code/harborline/ledger-core, Same repository, and the buttons Cancel, Choose another folder and Move 1 folder">
</picture>

<sub>Screenshot from Goodboy 0.40.1</sub>

### Keep .goodboy out of git

Keep Goodboy's own folder out of your commits with one click. The card shows up only when git does not already ignore `.goodboy`.

### Branch names

Choose how new session branches are named, under **Naming** on the **Branches** page: a **Branch prefix**, with or without the task id, or a **Custom** template. Each choice shows the name it would give your last session, and existing branches keep their names.

### Stops for your OK

Choose when a new run in this workspace stops for your go: every step, after the plan or never. One row on the **Runs** page in Settings sets it for workflows and for the Lead alike. One click saves both, and a failed save keeps both old levels and shows the error under the row.

If the two were saved apart, the row names both and selects none until you pick one. Nothing changes before you do. A level saved in one window shows in the others. Each Lead can change its own level and its permission rows from its page.

### Monitoring

See which ports are taken and by whom.

**Monitor** on the right rail opens a panel beside your page. Click it again to close it, or choose **Open full page** in its header. Its number shows ports in use and warns when a pinned port is down. With no port in use, a warning dot shows a down pin. The panel stays closed after a reload.

The page and panel share four groups: **Pinned** (ports you pin, with your own description), **Run by Goodboy**, **From workspace** and **Listening on this Mac**. Every group shares one column grid under one sticky header (Port, Label, Opened by, Process, Up, CPU, Memory), a process on many ports is one expandable row, and a group's header carries its count and its free ports (`3 · 2 free`); the free count opens the free ports under the ports in use. Expanded rows sit one step in. A terminal or script with no port says "no port" in faint text and shows its process. **Opened by** names the place as links: the session, then the agent and its run for an agent's process, or the branch for a shell or a script. Each part opens its page. The branch opens the worktree that shows it now; a branch no worktree shows is named without a link. A process stays under the branch it started on after its worktree switches branch; a renamed branch follows its new name. A port also open in another worktree shows the warning dot and "+2" after its owner, the worktrees in the tooltip. Leftover processes sit on the same grid with their age under Up. Monitoring keeps what you left when you go to another page and come back: the search text, the folds you opened and the scroll position. From a branch it opens on that branch only, and a chip shows every port again. The Terminal page keeps its Archived fold too.

Rows rest quiet. **Stop** and the **⋯** button live in one fixed cell that fills when you rest on a row, tab into it or open its menu, and a right click on any row opens the same menu: Open in browser, Pin or Edit description, Stop, Force stop, Hide or Unpin, Copy address. Stop asks first and names who loses the port; a process that does not exit in time shows **Force stop** in its place, which asks again. A refused stop leaves the row and reports why. With nothing tracked the page says **No ports in use** and offers **Pin a port**. It works on macOS and Linux.

### Copy settings from another workspace

Set up a new workspace by copying another one. **Copy from…** in a settings page menu takes that page's values from another workspace, and **Copy all pages from…** takes them all. You see what changes before anything is saved, and folders and accounts are never copied.

**Opening another workspace**

Click a workspace and the top bar names it at once, with a soft pulse, while the board shows its loading state. The old workspace stays whole until the new one has loaded. If it cannot open, the top bar keeps the old name, and a small card under it says "Couldn't open Northwind." with a **Retry** button.

## Under the hood

Hover-card fixtures use branded ids and timestamps in `apps/desktop/src/features/workspace/components/SessionHoverCard/index.test.tsx`.

This part is for contributors and agents who change the feature.

- Switch mark: `WorkspaceIdentityRow`, the first item of the places rail, reads `switchingToWorkspaceId` and `workspaceSwitchError` through `useWorkspaceSwitchState`. **Retry** calls `setCurrentWorkspace` with the failed id. `StageBoard` draws its skeleton while a switch is set. The failed line floats in `AnchoredLayer` to the right of the mark, so the rail never cuts it. The mark is busy (`aria-busy`) while the switch loads. The switcher opens to the right through `SHELL_RAIL_POPOVER`. ⌘O sends `goodboy:open-workspace-switcher`. ⌘1 to ⌘9 call `openWorkspace` (`useAppShortcuts/workspaceKeys.test.tsx`).

- Attention count of an open workspace: the window that shows it sends its count to the other windows on `goodboy:attention`.

- Sessions popover: `SessionsPopover` (`features/workspace/components/SessionsPopover/`) reads the groups of `useSessionOrder`, filters them with `sessionsShownOf`, and registers `sessions.toggle` (⌘B). The pin calls `pinSession` or `unpinSession`; `index.test.tsx` covers a failed write.
- Sessions card: `SessionsCard` sits beside the popover, anchored to its trigger. It reads `sessionsCardPhase` from `store/slices/sessions-card/`. `hydrateSessionsCard` runs at boot after `hydrateChangelogSeen`. A saved `shell.sessionsCardClosed` gives `closed`. A fresh install, with no seen release, gives `closed` and saves it best effort. Otherwise the phase is `open`. Opening Sessions calls `closeSessionsCard`, which saves through `commitAfterConfirm` and sets `closed` only after the save. A failed save keeps the card and reports the error, and the next open retries, one save at a time. A read that answers after the close never reopens it. A window that regains focus re-reads the setting, so a close saved elsewhere closes this card too. `SessionsPopover/index.test.tsx` and `store/slices/sessions-card/index.test.ts` cover each case.
- Monitoring panel: `monitoringDrawerRegistration` renders `LazyMonitoringDrawer`, which loads `MonitoringDrawer` on first open; it shares `MonitoringSections` with `MonitoringPage`. `toggleRailTool` toggles the workspace drawer, and `UNSAVED_DRAWER_KINDS` excludes it from saved layouts and from a session dock grid saved before the window loaded. `ToolRailFrame` feeds `toolCountOf` and `portsFactOf` from `monitoringSignalOf`, which uses the same `monitoringSignal` as the left door. `monitorPanel.test.tsx` and `SessionTools/index.test.tsx` cover the panel and rail.
- Overview and Desk: `sessionFace` in the `session-view` slice holds the face per session, `SessionFace` picks `SessionOverviewPane` or `SessionDesk`, and both read one model (`useOverviewModel`). `switchSessionFace` sets the face first, replaces the history entry when it leaves another page, then calls `startDeskTool`, which opens the session terminal when the Desk holds no tool; `useSessionDockGrid` calls it again once the grid of a session it enters is back. A session with no branch prepares its folder first, and `deskToolStart` holds the loading state or the error that `DeskToolStatus` shows with Retry. `session.desk` (⌘J) runs `toggleCurrentFace` and declines away from a session; `app_menu.rs` binds it to **View › Desk**. The face is saved with the dock grid (`storedDockGridOf`, `recallSessionFace`). `SessionDesk/index.test.tsx` and `watchSessionDockGrid.test.ts` cover each case.
- Desk grid: `DeskBody` draws a `DockLane` beside the column. `DrawerColumn` measures it (`useDockLaneBox`) and lays the panels over it, solved by `dockLayoutOf` with `isDesk`: no page minimum, the detail and the grid fill the lane, then stack, then the tools after the second become tabs of one cell (`DockCellTabs`). The tool rail stays on the page. `isDeskColumnFolded` folds the column when the lane would be under 880. `dockLayoutDesk.test.ts`, `DrawerColumnDesk.test.tsx` and `u50/deskGrid.test.tsx` cover each case.
- Dock grid per session: `useWindowLayout` starts `useSessionDockGrid`, which saves the grid of the open session and brings it back on entry. The rules and the failure table live in [home-and-drawer.md](../navigation/home-and-drawer.md#the-grid-saved-on-the-session). `watchSessionDockGrid.test.ts` covers each case.
- Page memory: the `monitoring-view` slice (`store/slices/monitoring-view/`) holds the Monitoring search text and open folds (`monitoringViews`) and the Terminal Archived fold (`terminalArchivedOpen`). Both are stored per workspace, and every write names its workspace.
- Process folds: a fold on a process is keyed `proc:<pid>:<birthId>:...` (`processFoldKey`); `birthId` is the native birth time (macOS seconds and microseconds, Linux boot time and start ticks). `startedAt` stays milliseconds for display. A reused pid starts closed. A failed lookup (another user's process) gives a null `birthId`. The key then uses the pid and the command line. The fold is pruned only when the pid disappears. A full snapshot drops the keys of processes it no longer lists (`pruneProcessFolds`, called from `createMonitorRefresh`).
- Scroll: `useScrollMemory` keys it `monitoring:<workspace>:<target>`, so the full list and each branch keep their own position.
- Address: `{ kind: 'monitoring', target: { workspaceId, projectId, branch } }` in `store/slices/navigation/studio.ts`. The same branch name in another workspace or repository never matches.
- Ledger: every spawn records `agentId`, `runId` (the workflow run), `mountId` and the `branch` read from the worktree HEAD at spawn (`proc/ledger.rs`, `proc/git_head.rs`). Terminals and scripts take `mountId` from the session mount that holds their folder (`ledger::mount_id_in`). In memory only, no table. `process_ledger_list` reads each row at its mount's current folder (`session_worktrees` by `mountId`, else the recorded folder). `branchPath` says where the branch was confirmed on this read. `ledgerMountOf` prefers the recorded mount and branch over the mount's current branch, unless the ledger confirmed that branch outside the mount's current folder.
- Branch rename: a gone branch follows a rename only through a `Branch: renamed` reflog line that names it (`git_head::renamed_to`), never through HEAD. The line must be dated at or after the process start, from a name not recreated since. It must sit after the reflog line seen at spawn (`git_head::reflog_mark`). The rename chain in that reflog must end at its own name. When no reflog still holds the spawn line (pruned or rewritten), the plain lookup without the spawn line runs instead. Without such a line the recorded name stays. The lookup runs with the ledger unlocked, reads each reflog back to the start only, and is cached until the ref folders change.
- Opened by: `branchHomeOf` finds the live mount of the same session and project that has the recorded branch checked out, or none, and a removed worktree is never a link. `usePortOwnerChain` resolves names, `ownerChainOf` builds the links, `runTitleOf` is shared with the run page title. Branch page ports: `BranchRunningPorts` sits on the header meta line after the branch facts, `runningHereOf` over `selectPortRows`. A chip opens its port through `openWebLink`. `useMonitorPolling` takes `isEnabled` (the Branch page passes `isActive`) and every caller joins one shared interval in `joinMonitorPoll`, so Monitoring and the Branch page never poll twice.
- Ownership: `ownedMountsOf` merges `sessionMounts` with the hydrated `sessionProjectMounts`, and `selectPortRows` and the page both read it. `mountContaining` maps a process or terminal to the mount whose worktree holds its path (cwd included) and never matches a null path.
