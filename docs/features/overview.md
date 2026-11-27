# Overview and activity

Open a session to see what it is for, what needs you and what happened so far.

### Session overview

Read a session as one page: the goal, what needs you, what runs and where each branch stands.

#### The head and the tabs

Every page of a session shares one head. The title row holds the session name, with its linked issue key in gray before it, then **New** and **⋯**, which holds Ask, pin, refresh, archive and delete. A single click on the name renames it in place. Enter saves and Escape cancels.

Under the title sit the tabs **Overview**, **Runs**, **Artifacts**, **Questions** and **Context**. Runs, Artifacts and Questions carry a count. There is no Changes tab: changes belong to a branch and its pull request, so they open from the pull request row under **Projects**.

**New** in the header starts an agent, a workflow or a write-up. **Ask about this session** in the **⋯**, or ⌘L, opens the Ask pane beside the page. While the pane is closed, the foot of the Overview keeps a few suggestions and one field: pick one or send a question and the pane opens and answers there. A branch, a pull request, an artifact or a run opens under the same head, and crumbs such as **Overview › Artifacts › Plan** replace the tabs. Each crumb is a link, and Esc goes one crumb up.

#### What the Overview shows

The goal sits above the page when it says more than the title. The Overview then reads top to bottom, always in this order:

- **The facts.** One quiet line: the ticket the session came from, the spend, which opens its limit, and the agent time. The ticket opens the task, and its **⋯** holds **Open in Linear**, or the tracker the task lives in. With more linked work, **+2** opens the Linked list in Context. **Summary, 5m ago** opens the written summary in Context.
- **Notices**, when a branch needs a decision. Examples: a branch that moved, a branch off its pull request's commits, a project not yet published, a stopped rebase. A closed worktree shows a notice with **Reopen**.
- **Needs you** is a yellow dot and one row per item, like Projects. A row gives what happened, one quiet line with who, where and when, and its verbs. The first verb is filled. An open question sits there too, with **Answer**. A Lead that waits on a permission gets one row, with **Allow and continue**. The row goes once you answer, and **Show full request** reads the whole call before you allow it. The project row of that Lead stays quiet about it.
- **Now** lists each agent once, with a live turn: who, the project, what it does right now and for how long. It shows three rows and **N more**. A click on a row opens that agent.
- **Next** holds up to three moves.
- **Projects**: one block per project with its branches inside.
- **Activity** shows the last three rows of the log.

A session with no agent, no run and no branch shows the start form and nothing else. The decisions and the summary live in the **Context** tab.

#### Projects

The head of a project block carries the project name, one door, the worktrees and their size, **New branch** and **Unmount**. The door is **Merge in order** for a series, or else **Delete local branches** for merged ones. It asks first: keep the files or remove the worktree. The toast offers Undo.

**Unmount** stays off while a branch of the project is attached. Its tooltip says "You can't unmount a project while branches are attached. Close them first."

**Mount a project** sits at the head of Projects. It lists the folders an agent asked for, then the workspace, then **Choose a folder…**, which adds a folder to the workspace and mounts it in one step. Agents of the session read and write a mounted folder. Undo takes back what the mount added.

#### Read a task without a diff

You understand where a task stands from the page alone, never from a raw diff or a file list.

1. **The goal.** The page opens on what the task is for, in the words you gave it.
2. **What waits for you.** **Needs you** comes next, and its move says why in words.
3. **Where each branch stands.** Every row in a project block names the step its branch stands at.
4. **What it costs.** The facts line adds up the spend and the agent time of every branch.

#### Archived sessions

An archived session keeps the same overview, read only. Its branches and their pull requests stay on it, with the pull request state, even after their worktree folders were removed.

**Restore** brings back the worktree of each branch whose pull request is still open, from the remote when the branch is gone on this Mac. When one cannot come back, a message says why and the closed worktree stays on the overview with **Reopen**.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/overview-session-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/overview-session-light.webp" alt="The overview of Stop retried webhooks posting a second credit: the goal, that payments-api credits a redelivered event once and ledger-core shows one posting per event id, then the Branches, Spend and Time tiles, In progress 2 with hl/fix-duplicate-credit in review in payments-api and hl/surface-retry-state with checks running in notify-relay, Merged 1, and one open question under Not on a branch with Answer">
</picture>

<sub>Screenshot from Goodboy 0.40.1</sub>

### Refresh a session

Pull requests opened outside Goodboy, by an agent or from a terminal, show up when a turn ends or when you come back to the window. **Refresh session** in ⌘K, or **⌘R**, re-reads projects, branches and pull requests right away.

### Activity

Follow what happened in a session in one list. **Activity** on the Overview shows the last three rows, and **Open activity** opens the Activity page under the Overview, with the crumbs Overview › Activity. **Open › Activity** in the Board card's menu, or **Open activity** in ⌘K, opens it too.

#### What a row shows

- One row per agent, workflow run or fix run reads on one line: its time, its role glyph, its task, then a state and model column. The glyph is tinted by the state and is the row's only marker: no node, no connector and no link icon. The role is the glyph's tooltip, and its number is for screen readers only. The cost sits in the card on the time.
- Plain facts get a row too, such as context changes, branch events and links.
- A script you ran gets a row with its result, such as `test:integration failed (exit 2) in payments-api`.
- Done is a small green check. Only a row that waits on you or failed stands out.
- Rows hold no buttons. A row that waits on your answer shows **Answer** in its state column, and the row opens the agent that asks. The next step for a row, such as **Push** or **Apply fix**, stays on its branch row above.

#### Find a row

- Rows go newest first, with a search box.
- Filter by kind (All, Agents, Branches, Checks, Scripts, Context) and, when the session has two projects or more, by project.
- The log shows the newest 50 rows, and **Show 50 older rows** adds the next 50.
- **Mark as read** clears the unread marks.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/overview-activity-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/overview-activity-light.webp" alt="The overview of Per-tenant limits on payouts scrolled to its Log, under the Needs you and Not on a branch groups: a search box and, below Now, a question to answer, Harden retries in payments-api waiting with steps 3, 2 and 1, each with its role icon and model, then Build, Summarise the plan, a rebase and, under Nov 3, Plan the payout limits">
</picture>

<sub>Screenshot from Goodboy 0.40.1</sub>

### Cards

See where each branch of each project stands, and what finished, under **Projects**.

Each project is one block with its name in the head. Its branches sit inside by state: what needs you first, then what is in progress, then merged and closed. Work with no branch sits in a **Not on a branch** block.

#### A branch tile

Each branch is one tile, like a pull request in a list.

- The first line names the branch. One chip on the right sums up where it stands: **Asks you**, **Checks failing**, **Running**, **Not pushed** or **PR open**. A merged or closed branch has no chip: its second line says **Merged** or **Closed**. The pull request number there opens the pull request. A branch you deleted after its merge stays as one such row, with no worktree button, and **Reopen** in its menu brings the branch back. **Not on a branch** shows only when the session never had a branch.
- The second line holds a few quiet facts: the pull request, such as **PR #12**, the lines added and removed, the runs and the questions that wait.
- When a check fails, the chip names it, such as **integration-tests failed**.
- A tile with something to do carries one button. **Answer** comes first and opens the exact question, then the first waiting step, such as **Rebase**, **Push** or **Open a pull request**. A merged branch offers **Remove worktree** once its cleanup is proposed.
- When another session changes the same file of the project, **Overlaps** sits before the button. Its popover lists the branches in the order to merge them, names the shared files and offers **Message the Implementers** and **Open in Changes**. It warns and never blocks.
- A Lead counts as work on its own branch. A working Lead shows that branch **Running**, and a Lead that waits for you or failed puts it under **Needs you**.

A click on the tile opens the page of its branch. A click on the lines added and removed opens the **Changes** tab. The tabs of the branch page hold the conversation, changes, commits, checks and runs.

The run count of a tile holds every run that worked on its worktree, also a run that was not started on it and only touched it.

#### The tile menu

Every tile has the same **⋯** menu as the branch on the **Projects** card: open, terminal, editor, copy the name, push, close the branch and the rest. A right click on the tile opens the full menu at the pointer.

**Close branch** is red and asks first, inside the menu. A clean branch offers **Remove the folder** and **Keep the folder**. A branch with uncommitted changes or commits not pushed says so and offers only **Keep the folder**. The branch and any pull request stay. When the folder can't be removed, the branch stays attached and a message says why.

#### Not on a branch and long lists

The **Not on a branch** tile holds work that has no branch. It names itself by its next step, such as the open question, and opens Runs. It shows only while that work runs or needs you.

With many tiles, merged and closed branches fold after the first few and **Show 4 more** opens the rest of that block. The head of the first block with a merged branch holds one button that removes every merged worktree. A failed removal keeps its reason and offers a retry for what is left.

#### Merge in order

- Two or more branches that an agent declared a series show **Merge ledger-rounding in order** in the head of the first block.
- It asks for confirmation. It merges the bottom part first and re-reads each part right before it merges.
- It stops at the first part that cannot merge. The reason sits under the row: checks failing, conflicts, draft, changes requested, closed or a host error. Run it again after fixing it and it carries on from that part.
- It shows only on hosts that can merge with a chosen method (GitHub, GitLab and Bitbucket today).

### Next

Know the moves that unblock the task, such as answering a question, fixing a failing check or opening a pull request.

**Next** shows the first three moves, each with its reason. The rest stay on their branch rows as one short button such as **Start**, **Analyze** or **Push**. A move with no branch row waits under **Next**, in **More next steps**.

#### Dismiss a move

**Not now** puts a suggestion away until the situation changes. It says Dismissed with **Undo**, and ⌘Z brings the last one back. A question or an approval of your own is never put away this way.

#### Checks and scripts

- **Analyze** starts the Debugger on a failing check. Its next moves (open the analysis, **Start fix**, **Push**) then sit on that run.
- **Run the failing test** names the test a failed GitHub Actions check points at and writes the command in the terminal of that worktree. It waits for your Enter.
- **Rerun integration-tests** shows when the job log says the check timed out. It reruns only the failed jobs. A check outside GitHub Actions shows **Open on** and the host instead of a log.
- After a turn that changed a migration, a lockfile or a schema, the script that follows is offered with the file as its reason.
- **db:migrate** is written in the terminal and waits for Enter. An install or a generate runs on the click.

#### Pull requests and cleanup

- **Open a pull request** names the branch it opens. With several branches still without one, the row of the branch furthest ahead offers it.
- Once a pull request merges, **Remove the payments-api worktree** is offered with the reason and its size (`#418 merged · 412 MB`). A worktree a running agent or a live Lead still works in is never offered.
- When the last branch is merged or closed and a linked Linear or Jira item is not done, **Move HBL-412 to Done** is offered. The toast has **Undo**.
- **Archive this session** shows with the reason "All branches merged". It needs every branch merged or closed and nothing running, waiting or asking. The toast offers **Undo**.
- A folder no turn touched for 7 days offers **Unmount**. A clean worktree with nothing to push, no pull request and no change for 7 days offers **Remove the ledger-core worktree**.

#### Agents that go quiet

**Ask the Implementer what blocks it** shows when an agent has been quiet for 5 minutes. After 30 minutes the question moves to Needs you.

#### A stopped rebase

A stopped rebase sits in Fix, first, above **Rerun**, and says how many files conflict. A branch that is only behind stays in Update.

- Its row says in one sentence what stopped ("2 files conflict with main: MembersPage.tsx and 1 more. Your branch is as it was.").
- It leads with the verb that fixes it: **Start new Lead**, **Rebase on their commits**, **Retry rebase** or **Fix with an agent**.
- **Resolve in terminal**, **Abort rebase**, **Undo rebase** and **Open branch** sit in its **⋯** menu as they apply.
- A click on its title opens the branch with the rebase panel.

#### Where a click goes

- A stuck agent or a plan opens the Lead step.
- A check, review conversations or a pull request open that tab of the branch.
- Questions open the Questions tab.

### Time left

See how long a step has left, estimated from your own past runs. Queued steps show a range, and a run slower than usual turns its time warm. Resting on the time opens a card with the time running, the usual range, the cost and the basis.

### Changes

See and undo what agents changed in a session without a branch.

In a plain folder agents edit in place. Every writing turn saves what it may change first, shell commands such as `rm` and `mv` and new files included.

#### Review and restore

1. Press **⌘⌥F** to open the session's file versions. They show each turn, newest first, with the files it added, changed or removed and their line counts.
2. Pick a file to see its text before and after, with the changed words marked.
3. Restore it:
   - **Restore to before reply 3** puts one file back.
   - **Undo changes from this reply** puts back the whole reply.
   - **Remove this new file** takes out a file the agent created.

Each restore first saves the text you have now, so **Undo restore** puts it back. A restore over text that changed after the turn asks in place before it writes. It names the other agent when a later turn of one wrote the same file (**Scout wrote there after turn 3.**).

Each writing turn in the chat ends in a card with **Open in Changes** and **Undo changes from this reply**.

#### What is kept

- Versions are kept until 30 days after the session ends. The cap per folder is 1 GB or the folder's own size, whichever is larger.
- The page shows how much they use and what was left out: files over 15 MB, links that leave the folder, dependencies and build output.
- Storage shows their size under **Saved versions**.

## Under the hood

This part is for contributors and agents who change the feature.

- Session head: `SessionHead` (`app/components/SessionHead`) is drawn once by `SessionWorkspace` through `SessionHeadContext`. It draws the tabs on a tab view (`isTabView`) and the crumbs from `crumbsOf` otherwise. On the Desk face it spans the page at the Desk gutter, so the head, the Desk column and the tools share one left edge. Esc goes up through `parentPlace`. The `session.ask` verb in More session actions (`sessionMenuOf`) opens the Ask pane. `AskFoot` ends `CentralColumn` while `selectIsAskOpen` is false, draws `AskStarters` and `AskComposer`, and sends through `openAsk` then `sendAskQuestion`; `CentralColumn.askFoot.test.tsx` proves it.
- Reading order: `CentralColumn` draws `OverviewFacts`, the notices, `NeedsYouSection`, `NowSection`, `NextSection`, `ProjectBlocks` and `OverviewLog`, spaced with `PANE_RHYTHM.groups`. `CentralColumn.readingOrder.test.tsx` pins the order.
- Facts: `OverviewFacts` leads with `OverviewTicket`. It reads `sessionExternalTasks` with no fetch and no tracker state, and names the first session part-of task. Its menu verb is `task.openInTracker`, and `+N` opens the `context` lens (`OverviewFacts/index.test.tsx`, u50 overview scene). Then `SessionCostChip` (the one spend number), the agent time from `sessionKpisOf`, and the summary age from `summarizerStatus`. The head draws no project state; the pull request state lives on the `ProjectBlocks` rows.
- Goal: `GoalTeaser` reads the goal as flat text (`inlineMarkdownText`), so a goal of only spaces or markup that renders to nothing offers **Add a goal** instead of an empty row.
- Permission wait: `useSessionPermissionAsk` finds the first agent with an open ask through `openPermissionAsksOf`. `NeedsYouSection` draws it as `NeedsYouPermission`. The button runs `usePermissionAsk().allow`, the `allowAndContinue` of the dock card. `useOverviewModel.hasNeedsYou` counts it. `ProjectBlocks` passes `permissionMount`, so `boardTileChipOf` drops the permission word on the row of that mount only. A blocked agent with no transcript loads it first. `NeedsYouPermission/index.test.tsx` and the `lead-permission-wait` scene cover it.
- Moves: `overviewMovesOf` splits the cards once. Band 0 goes to Needs you, the next three to Next, and the rest to the branch rows. An open question no move covers joins Needs you as `NeedsYouQuestion`. `shownAskIds` keeps an **Answer** off a row whose question Needs you already shows. `MoveCard` draws a move in two densities, `needs` for a Needs you row (`needsYouLinesOf` words its title and meta line) and `row` elsewhere. It uses `MoveVerb` and `MoveEvidenceChips`, and reads the reason and evidence of the move (`actionCardsOf`). Tones come from `STAGE_TONE`.
- Now: `useSessionWork` reads `live_work` through `readLiveWork` and `listenWorkChanged`, at most once a second. `liveGroupsOf` keeps the latest delegation of an agent the Lead retried. `nowRowsOf` places each live agent once under its Lead and caps the list at `NOW_LIMIT`. It turns `agentWriterWait` into a warm wait line. `useNowModel` gathers the agent nouns and waits.
- Tile facts while running: `BoardTileFacts` drops the line counts while the branch runs.
- Activity: `OverviewRecentRows` draws the newest three rows of `useTimelineRows`, deferred like `LogPane`.
  - A long branch name is cut in the middle (`splitMiddleOf`, `BoardBranchName`) so its end stays readable.
  - A card with a branch verb and no branch (`cardRowIdOf`) never sits on the **Not on a branch** row. A rebase with one target belongs to that branch's row.
- Deleted branch row: a removed mount keeps its row through `buildMountRows`, which falls back to the stored link (`storedRequestOf`) when no live request is cached. `BoardTileFacts` makes the request word a link (`openLink`) on a settled row, and the menu offers **Reopen** from `mount.reopen` (`fetchableRequestOf`). `loadWorkspaceMountHistory` and `loadMountHistory` read the removed mounts and their links. Tested in `ProjectBlocks/index.test.tsx` and `loadSessionMounts.test.ts`.
- Project blocks: `projectBlocksOf` groups the board rows by project ID and keeps the state order of `branchBoardOf` inside a block. It folds the merged and closed rows that `branchBoardOf` hides. `ProjectBlock` draws one block, headed by `BoardProjectHead`. A head only sends `PROJECT_DETACH_EVENT` for its `projectId`. `BoardProjectRemovals` mounts one `MountActionsMenu` per session project (`sessionProjectIdsOf`) outside the blocks, so a folded project or one with all worktrees closed still hears it. The first block with a mount takes the request (`useProjectDetachRequest`). The test is `ProjectBlocks/projectRemoval.test.tsx`.
- Mount and Unmount: `announceUnmount` gives the Unmount toast its Undo through `remountAfterUnmount` when the project had one mount (`ProjectMountRows/unmountUndo.test.tsx`). `BoardProjectHead` turns Unmount off while `attachedBranchCountOf` counts an attached branch of a repo project, with `UNMOUNT_BLOCKED_REASON` as its tooltip, and draws `NewBranchMountAction` after the worktrees door (`ProjectBlocks/projectHead.test.tsx`).
- Close branch: `mountCloseConfirm` picks the outcomes from `hasWorkOnlyInFolderOf`. **Keep the folder** is `mount.closeKeepFolder` (`closeMountKeepingFolder`); **Remove the folder** calls `unmountMount` with `onKeptFolder: 'refuse'`, so a folder git keeps leaves the row as it was (`actions/kinds/mount.close.test.ts`, `ProjectBlocks/projectHead.test.tsx`). `MountProjectAction` heads the Projects section and the folder card. `mountPickerGroups` orders the picker. `mountWithUndo` mounts with Undo, and Undo takes a folder added by Choose a folder… out of the workspace again (`ProjectMountRows/chooseFolder.test.tsx`).
- Tile menu: `useMountRowMenu` (the `mount` target from `useMountMenuTarget` and `useObjectMenuTrigger`) and `MountRowMenuButton` serve both `BoardTile` and the rail's `WorktreeRow`, so the two rows list the same verbs (`ProjectBlocks/rowMenu.test.tsx`). The button lists its rows per state with `mountRowMenuOf`.
- Branch tile: `BoardTile` is a link (`role="link"`) to the Changes tab of its branch (`branchTabPlaceOf` with `files`), addressed by mount id; a tile with no branch opens Runs. The move on the tile opens the tab its fact names (`tabForFactOf`). A failing branch names its first failing check (`failingChecksOf`) on the chip. `boardTileChipOf` picks the one chip from `stageWordOf`, `branchStoryOf`, `NAMES` and `STAGE_TONE`. The order: Merged or Closed (`row.isSettled`, with the merged tone or `BRANCH_STATE_TONE.closed`), an open question, a blocked state, the Needs you group, Running, then the story word.
- Tile overlap: `BoardTile` mounts `OverlapChip` (`placement="session"`) for its mount; the read and the order live in [mounts.md](../mounts.md#overlaps-between-mounts). Tested in `ProjectBlocks/overlapChip.test.tsx`, `OverlapChip/index.test.tsx`, `overlapGroupOf.test.ts` and the u50 overlap scene.
- Tile facts: `BoardTileFacts` leads with the request number (`requestShortOf`, PR or MR) and reads the lines from `useMountDiffStats`, the Changes tab owner. Runs come from `branchWorkCountsOf`, the Runs tab badge. Waiting questions are the row's `askIds`, the owner of the chip. The branch page header carries **Start a run on this branch**, **Open a terminal here** and **Open the browser here** (`BranchTools`), so a tile needs no doors.
- Tile button: `cardsByRowId` gives each tile the cards of its branch; `cardRowIdOf` puts a question card with no branch on the tile that holds its ask. `boardTileActionOf` picks one: the answer card or, with none, **Answer** on the first open question that Needs you does not show (`questionPlace`), then the first card. A closed tile takes no button. A merged tile takes **Remove worktree** (`BoardRemoveButton` for its one mount). `BoardTileAction` draws it through `BoardRowAction`, with its confirm and its failure. A card that fits no tile sits in Next. `BoardMergeInOrder` is the series merge verb. `useRemoveWorktrees` removes the merged worktrees one by one through `resolveMountCleanup`, keeps a failed one with its reason and offers a retry for what is left.
- Archive: `ArchivePrimary` is the header button when `isArchivePrimaryOf` holds (every branch merged, no live agent, no open question). In every other case Archive stays in the session menu with the same guards.
- Loading skeleton: `SessionOverviewSkeleton` draws its cards from `overviewCardsOf` and the same surface (`OVERVIEW_CARD_SURFACE`). `SessionWorkspace` shows it through `SkeletonSwap`: nothing for the first 120 ms, then at least 160 ms. The notices slot animates its height with `HeightMotion` and `PANE_GROUPS_GAP_REM`.
- `liveGroupsOf` orders the live groups that feed the board and Now.
- Branch board model: `branchBoardOf` builds one row per branch in any state, plus a row without a branch. It sorts them into Needs you, In progress, Merged, Closed and Not on a branch. `branchFactsFor` feeds `deriveSessionStage` the facts of one branch only, its Leads included, read through the Lead stop model of `autoTreeWordOf` in `boardInputsOf`. `runningByRowIdOf` counts the running agents and Leads of each row. A question on one branch leaves the others alone. `boardRowCellsOf` names a tile with no branch by its next step. `sessionKpisOf` reads the board for the agent time of the facts line and counts Leads, agents and asks by id. Spend comes from `leadSpendByBranchOf`.
- Empty session: `useIsEmptySession` is the one rule for the start form, and `CentralColumn` places `FolderCard` after the project blocks.
- Activity page: `OverviewLog` draws the Activity section with `OverviewRecentRows`. **Open activity** and `session.openLog` (`sessionActivity.ts`) open the `activity` lens. `SessionLensPane` draws it as `ActivityPage` around `LogPane`.
- Activity filters: `activityKindOf` sorts a row by kind and `activityMountIdsOf` reads its project from `mount_id`. `activityEntriesOf` prunes a workflow or agent to its rows in the chosen project and detaches a fact whose lane or launch was filtered out (`activityEntriesOf.test.ts`). `useWorkEvents` reads `listWorkEvents` when a script run starts, launches (`isLaunched`) and ends, and keeps the latest answer. It asks for the next 200 when `LogRows` runs out of rows (`useWorkEvents/index.sqlite.test.tsx`). `workEntriesOf` makes each a `work` timeline entry. `ActivityPage.sqlite.test.tsx` covers the rows, both filters, an older run past the first page and Retry.
- Log rows: each row sits in a `content-visibility: auto` box sized by its laid out height. `useRowPreload` on the page scroller (`scrollParentOf`) draws the rows one screen around the view. `TimelineRail` draws every lane with one stroke (`RAIL_STROKE`). Steps and queued rows use the `sm` `WorkNode` on the 28px step grade of `TIMELINE_RHYTHM`. `TimelineDayRule` draws its hairline.
- Row line: `TimelineRowLabel` draws each row as an `ActivityRow` in the `feed` density, toned by `timelineRowTone` from the row state. Agent and run rows pass `TimelineRowMeta` with `layout="feed"`, an `ActivityMeta` with the state, model and time columns; `TimelineFeedState` fills the state cell. The run page keeps the stacked layout. `TimelineCountRow` strokes an unlaned fold node in `--color-border-soft`. Tests: `TimelineStreamRow.test.tsx`, `TimelineMeta.test.tsx`, `TimelineRowLabel.test.tsx`, `TimelineRunStreamRow.test.tsx`; scenes `activity`, `activity-groups`, `activity-question`, `activity-log` and their `-light` twins.
- Log paging: `LogPane` paints the search box and **Mark as read** at once. It mounts `LogRows` through `useDeferredValue`, keyed by the session. `LogRows` draws pages of `LOG_PAGE_ROWS` from `logPageOf`, each in a transition. `timelineFullGutterOf` sizes the gutter from one stream built with `shouldExpandEveryGroup`.
- Notices: `overviewNoticesOf` counts them for `overviewCardsOf`. A closed notice is not counted.
- `useOverviewNotices` holds the dismissals, keyed by `mismatchDismissalKeyOf` so a new mismatch shows again, and the stranded-branch check. A dismissal expires when its observation clears (`liveDismissalsOf`). Unchanged polls stay dismissed. `CentralColumn` draws the notices in one place under the facts.
- `overviewHasContentOf` decides when the start form leaves: a card is drawn, a branch has commits, a request or a run. A folder card, an unassigned note or a closed worktree notice also keeps it away.
- Agent count: `runAgentCountOf` is the one agent count that the Runs grid and the subagent summaries share.
- Branch rows: `RANK_OF_STATE` in `branchStoryOf` orders the rows, `mergeSeriesInOrder` merges a series and `useMountRowMenu` opens the branch menu.
- Tracker move suggestion: `trackerMoveSuggestionOf`.
- Archive suggestion: `archiveSuggestionOf`.
- Archived session: `useArchivedWorkRecord` calls `loadSessionWorkRecord`, which reads every mount row and its latest stored pull request link; `storedRequestOf` turns the link into the row's request. Restore runs `reopenArchivedWork`. Tests: `store.sqlite-archived-work.test.ts` and the `archived-work` scenes.
- Settled work in Next: `deriveNextSteps` drops Review the changes, Fix review conversations and the agent retries when `isSettledWorkOf` finds the branch merged or closed, from `settledMountIds` on any host (`useSessionSuggestions/settledWork.test.tsx`).
- Next rows: `nextGroupsOf` and `nextUnblockCountOf` order the moves a row offers, and `isStoppedRebaseOf` tells a stopped rebase from a branch that is only behind. `sortNextSteps` orders the moves by `moveGroupOf` first.
- Next row copy: `planSentenceOf` writes the plan sentence and `rebaseStopRowOf` writes a stopped rebase.
- Folded rows: `foldDivergedIntoStops` in `actionCardsOf` folds a diverged card into its stopped rebase, `historyStopDetailOf` and `foldedVerbOf` word the folded stops, and `MENU_MAX_WIDTH` caps that menu.
- Open questions of one Auto run: `askingAutoRootOf` finds the run, from the `rootAgentId` of the answer-questions suggestion.
- Rebase picker: `MoveRebasePicker` lists the branches behind and starts `rebaseAll` for the ones kept checked.
- Time left card: `workTimeCardOf`.
- Changes: `otherWritersOf` names the agent that wrote a file after the turn.
- Files of a turn: no screen reads them. A Done row carries no files, model, cost or full text. The app core still decides the set: `worktree_turn_files`, saved per turn and branch in `turn_file_sets` by `recordTurnFileSets`. It compares the branch with what it held when the turn began and drops what only the base commits changed. A rebase never pours main's work into the turn. A file the turn committed, edited or fixed in a conflict stays. Work that was already uncommitted before the turn is not the turn's. A turn that ran beside another agent in the same branch records nothing, because the files could be theirs.
