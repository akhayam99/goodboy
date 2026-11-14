# Overview and activity

Open a session to see what it is for, what needs you and what happened so far.

### Session overview

Read a session as one page: the goal, what needs you, what runs and where each branch stands.

Every page of a session shares one head. The title row holds the session name, with its linked issue key in gray before it, then **New**, **Ask**, pin, refresh and more. A single click on the name renames it in place. Enter saves and Escape cancels. A small ring at the end of the field fills toward the 120 character limit and turns amber near it.

Under the title sit the tabs **Overview**, **Runs**, **Artifacts**, **Questions** and **Context**. Runs, Artifacts and Questions carry a count. No tab draws a title of its own, because the tab names the page. A session with exactly one branch adds a **Changes** shortcut that opens that branch's changes. With more branches there is no shortcut, since changes belong to a branch and its pull request.

The Overview reads top to bottom:

- The goal, then one status block: a line that says what is happening and, under it, one sentence of where the work stands. A chat the session came from sits under them.
- Notices come first when a branch needs a decision. Examples: a branch that moved, a branch off its pull request's commits, a project not yet published, a stopped rebase. A closed worktree shows a notice with **Reopen**.
- Five tiles: **Branches**, **Questions**, **Artifacts**, **Spend** and **Time**.
- One board with a row per branch.
- A session with no agent, no run and no branch shows the start form and nothing else.

**New** in the header starts an agent, a workflow or a write-up. **Ask** opens a panel beside the page. A branch, a pull request, an artifact or a run opens under the same head, and crumbs such as **Overview › Artifacts › Plan** replace the tabs. Each crumb is a link, and Esc goes one crumb up.

**Reading the task without a diff.** A product manager understands where a task stands from the page alone, never from a raw diff or a file list.

1. **The goal.** The page opens on what the task is for, in the words you gave it.
2. **The state.** One sentence from the running summary says where the work stands, with when it was written. It turns gray when it is older than a day.
3. **What waits for you.** The **Needs you** group of the board comes first, and each row says why in words.
4. **Where each branch stands.** Every row shows the six stages of its branch and the one step it stands at.
5. **What it costs.** The **Spend** and **Time** tiles add up every branch.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/overview-session-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/overview-session-light.webp" alt="The overview of Stop retried webhooks posting a second credit, with the goal, a Needs you block and the projects payments-api and notify-relay">
</picture>

<sub>Screenshot from Goodboy 0.33.0</sub>

### Refresh a session

Pull requests opened outside Goodboy, by an agent or from a terminal, show up when a turn ends or when you come back to the window. **Refresh** in the session's `...` menu, or **⌘R**, re-reads projects, branches and pull requests right away.

### Full log

Follow what happened in a session in one list. **Open the full log** in the session's **⋯** menu and in ⌘K opens it in a drawer beside the page.

- One row per agent, workflow run or fix run shows its state, model, time and cost.
- Plain facts get a row too, such as context changes, branch events and links.
- Rows go newest first, with a search box.
- Every row carries the glyph its concept has in the sidebar and the **New** menu. A workflow run has the Workflows glyph, an orchestrated run the orchestrator glyph, and an agent its role.
- **Mark as read** clears the unread marks.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/overview-activity-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/overview-activity-light.webp" width="821" alt="The overview of Per-tenant limits on payouts with the Full log drawer open beside it: the Needs you, Running, Next and Done cards on the left, with Full log on the Done card, and the Log on the right, with a search box and below Now a question to answer, the Build workflow with steps 3, 2 and 1, each with its role icon and title, then Summarise the plan, a rebase and Plan the payout limits">
</picture>

<sub>Screenshot from Goodboy 0.33.0</sub>

### Cards

See what needs you, what runs, where each branch stands and what finished, on one board.

The board groups the branches in this order: **Needs you**, **In progress**, **Merged** and **Not on a branch**. A group with no row is not drawn. Each group names itself in bold with its count in gray.

- A row names the branch and shows one connected track of six stages: Commit, Push, Pull request, Checks, Review and Merge.
- The track is filled up to where the branch stands. The state color shows only on that stage.
- Next to it is the step the branch stands at, such as **Checks failing** in red, **No pull request** in gray, **Approved** in green or **Merged** in violet. The state has the same color everywhere in the app.
- A branch an agent works on shows its agents and its spend. A dot marks what is new since you last looked.
- A long branch name is cut in the middle, so its end stays readable.
- A branch with no pull request reads **No PR**. A step that does not apply is a short dash instead of a circle.
- A row says each fact once. A column stays empty when the state already says it. A merged branch shows no checks.
- The **Not on a branch** row holds work that has no branch. It names itself by its next step, such as the open question, and never offers a branch verb.
- With many rows, **Merged** shows the first few and **Show 4 more** opens the rest.

The **Questions** tile filters the board to the branches with an open question. One line says so, with **Clear** to leave. **Branches** clears the filter. The other tiles only read.

A click on a row opens it in place. The open row shows the branch's runs, questions and artifacts, and one line of doors:

- **Changes** opens the Changes page of the branch, with its file count and line counts.
- **Terminal here** and **Browser here** open the tool on that branch, without changing the tools rail.
- **Open the PR page** opens the pull request page.
- On a merged branch, **Remove worktree** asks first. A failed removal keeps its reason and offers a retry for what is left.

A row with something to do carries one main verb, such as **Push**, **Open a pull request**, **Update** or **Answer**. Other waiting verbs sit in the open row. **Merged** holds one button that removes every merged worktree.

**Merge in order**

- Two or more branches that an agent declared a series show **Merge ledger-rounding in order** on the first open group.
- It asks for confirmation. It merges the bottom part first and re-reads each part right before it merges.
- It stops at the first part that cannot merge. The reason sits under the row: checks failing, conflicts, draft, changes requested, closed or a host error. Run it again after fixing it and it carries on from that part.
- It shows only on hosts that can merge with a chosen method (GitHub, GitLab and Bitbucket today).

### Next

Know the moves that unblock the task, such as answering a question, fixing a failing check or opening a pull request.

- Each branch row offers its first move as one short button such as **Start**, **Analyze** or **Push**.
- **Not now** puts a suggestion away until the situation changes. It says Dismissed with **Undo**, and ⌘Z brings the last one back.
- A question or an approval of your own is never put away this way.
- **Analyze** starts the Debugger on a failing check. Its next moves (open the analysis, **Start fix**, **Push**) then sit on that run.
- **Open a pull request** names the branch it opens. With several branches still without one, the row of the branch furthest ahead offers it.
- Once a pull request merges, **Remove the payments-api worktree** is offered with the reason and its size (`#418 merged · 412 MB`).
- When the last branch is merged or closed and a linked Linear or Jira item is not done, **Move HBL-412 to Done** is offered. The toast has **Undo**.
- **Archive this session** shows with the reason "All branches merged". It needs every branch merged or closed and nothing running, waiting or asking. The toast offers **Undo**.

**A stopped rebase**

- Its row says in one sentence what stopped ("2 files conflict with main: MembersPage.tsx and 1 more. Your branch is as it was.").
- It leads with the verb that fixes it: **Resolve with Auto**, **Bring them in**, **Retry rebase** or **Fix with an agent**.
- **Resolve in terminal**, **Keep branch as it was**, **Undo rebase** and **Open branch** sit in its **⋯** menu as they apply.
- A click on its title opens the branch with the rebase panel.

**Where a click goes**

- A stuck agent or a plan opens the Auto step.
- A check, review conversations or a pull request open that tab of the branch.
- Questions open the Questions tab.

### Time left

See how long a step has left, estimated from your own past runs. Queued steps show a range, and a run slower than usual turns its time warm. Resting on the time opens a card with the time running, the usual range, the cost and the basis.

### Changes

See and undo what agents changed in a session without a branch.

- In a plain folder agents edit in place. Every writing turn saves what it may change first, shell commands such as `rm` and `mv` and new files included.
- **⌘⌥F** opens the session's file versions. They show each turn, newest first, with the files it added, changed or removed and their line counts.
- Pick a file to see its text before and after, with the changed words marked.
- **Restore to before reply 3** puts one file back. **Undo changes from this reply** puts back the whole reply. **Remove this new file** takes out a file the agent created.
- Each restore first saves the text you have now, so **Undo restore** puts it back.
- A restore over text that changed after the turn asks in place before it writes. It names the other agent when a later turn of one wrote the same file (**Scout wrote there after turn 3.**).
- The Overview has a card that says where agents write and what is saved. It sits after the board.
- Each writing turn in the chat ends in a card with **Open changes** and **Undo changes from this reply**.
- Versions are kept until 30 days after the session ends. The cap per folder is 1 GB or the folder's own size, whichever is larger.
- The page shows how much they use and what was left out: files over 15 MB, links that leave the folder, dependencies and build output.
- Storage shows their size under **Saved versions**.
- A session that still works in an older session folder keeps its list of file versions under the same page.

## Under the hood

This part is for contributors and agents who change the feature.

- Session head: `SessionHead` (`app/components/SessionHead`) is drawn once by `SessionWorkspace` through `SessionHeadContext`. It draws the tabs on a tab view (`isTabView`) and the crumbs from `crumbsOf` otherwise. Esc goes up through `parentPlace`. `AskButton` opens the Ask panel.
- Overview board: `CentralColumn` spaces the notices, the start form and the board with `PANE_RHYTHM.groups`. `BranchBoard` draws the tiles (`BoardTiles`, on `StatCard`) and one row per branch (`BoardGroup`, `BoardRow`). `useBranchBoard` gathers the inputs of `branchBoardOf` and `visibleGroupsOf` applies the tile filter and the fold of **Merged**.
- Tiles: **Branches** (n of m merged), **Questions** (open, blocking count as the sub-line), **Artifacts** (the tab count, age of the newest), **Spend**, **Time**. `overviewTileFactsOf` feeds the two middle ones. Checks belong to the pull request page.
  - **Questions** filters the board to the branches with an open question. `BoardFilterNote` says so, and when no branch matches it shows one line and **Clear**, never an empty box. **Branches** clears; the others are plain tiles.
  - A long branch name is cut in the middle (`splitMiddleOf`, `BoardBranchName`) so its end stays readable.
  - A card with a branch verb and no branch (`cardRowIdOf`) never sits on the **Not on a branch** row. A rebase with one target belongs to that branch's row.
- Open row: `BoardOpenRow` renders `BranchWork` through `branchWorkTabRegistration`, then `BoardDoors`. The doors are **Changes**, **Terminal here**, **Browser here**, **Open the PR page** and, on a merged branch, **Remove worktree**. **Terminal here** (`openBranchTerminal`) opens one tab in that branch's folder, or shows the live one, and points the terminal's folder pill at it; **Browser here** (`openBranchBrowser`) opens the panel. Neither changes the Tools rail. The counts on that line come from `branchWorkCountsOf`, the function behind the Work tab badge. The open rows are state in `useOpenRows` and the last one is kept in `focus.returnRows['board.row']`, so a reload reopens it and a row that changes group stays open. While the terminal pushes the page the board hides stage dots, agents and spend (`data-narrow`).
- Row button: `cardsByRowId` gives each row the cards of its branch. `BoardRowAction` draws the main verb of the first from `useActionCardActions`, with its confirm and its failure. `BoardAlsoWaiting` lists the others in the open row, and `BoardLooseCards` lists cards that fit no row. `BoardMergeInOrder` is the series merge verb. `useRemoveWorktrees` removes the merged worktrees one by one through `resolveMountCleanup`, keeps a failed one with its reason and offers a retry for what is left.
- Archive: `ArchivePrimary` is the header button when `isArchivePrimaryOf` holds (every branch merged, no live agent, no open question). In every other case Archive stays in the session menu with the same guards.
- Loading skeleton: `SessionOverviewSkeleton` draws its cards from `overviewCardsOf` and the same surface (`OVERVIEW_CARD_SURFACE`). `SessionWorkspace` shows it through `SkeletonSwap`: nothing for the first 120 ms, then at least 160 ms. The notices slot animates its height with `HeightMotion` and `PANE_GROUPS_GAP_REM`.
- The overview draws the branch board only. `liveGroupsOf` orders the live groups that feed the board.
- Branch board model: `branchBoardOf` builds one row per branch in any state, plus a row without a branch. It sorts them into Needs you, In progress, Merged and Not on a branch. `branchFactsFor` feeds `deriveSessionStage` the facts of one branch only. A question on one branch leaves the others alone. `boardRowCellsOf` picks the words of a row and drops a word an earlier cell already said. `sessionKpisOf` reads the board for the Branches, Spend and Time tiles and counts Leads, agents and asks by id. Spend comes from `leadSpendByBranchOf`.
- Empty session: `useIsEmptySession` is the one rule for the start form, and `CentralColumn` places `FolderCard` after the board.
- Notices: `overviewNoticesOf` counts them for `overviewCardsOf`. A closed notice is not counted.
- `useOverviewNotices` holds the dismissals, keyed by `mismatchDismissalKeyOf` so a new mismatch shows again, and the stranded-branch check. A dismissal expires when its observation clears (`liveDismissalsOf`). Unchanged polls stay dismissed. `CentralColumn` draws the notices in one place above the board.
- `overviewHasContentOf` decides when the start form leaves: a card is drawn, a branch has commits, a request or a run. A folder card, an unassigned note or a closed worktree notice also keeps it away.
- Agent count: `runAgentCountOf` is the one agent count that the Runs grid and the subagent summaries share.
- Branch rows: `RANK_OF_STATE` in `branchStoryOf` orders the rows, `mergeSeriesInOrder` merges a series and `useMountMenuTarget` opens the branch menu.
- Tracker move suggestion: `trackerMoveSuggestionOf`.
- Archive suggestion: `archiveSuggestionOf`.
- Next rows: `nextGroupsOf` and `nextUnblockCountOf` order the moves a row offers.
- Next row copy: `planSentenceOf` writes the plan sentence and `rebaseStopRowOf` writes a stopped rebase.
- Folded rows: `foldDivergedIntoStops` in `actionCardsOf` folds a diverged card into its stopped rebase, `historyStopDetailOf` and `foldedVerbOf` word the folded stops, and `MENU_MAX_WIDTH` caps that menu.
- Open questions of one Auto run: `askingAutoRootOf` finds the run, from the `rootAgentId` of the answer-questions suggestion.
- Row opening: `openFor` in `useActionCardActions` and `suggestionPlaceOf` choose where a row opens.
- Time left card: `workTimeCardOf`.
- Changes: `otherWritersOf` names the agent that wrote a file after the turn.
- Files of a turn: no screen reads them. A Done row carries no files, model, cost or full text. The app core still decides the set: `worktree_turn_files`, saved per turn and branch in `turn_file_sets` by `recordTurnFileSets`. It compares the branch with what it held when the turn began and drops what only the base commits changed. A rebase never pours main's work into the turn. A file the turn committed, edited or fixed in a conflict stays. Work that was already uncommitted before the turn is not the turn's. A turn that ran beside another agent in the same branch records nothing, because the files could be theirs.
