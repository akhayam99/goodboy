# The board

The Board shows every session of a workspace in lanes by stage, so you see where each task stands, with what needs you at the top of **Running**. Sessions in the top bar lists the same sessions, so the page stays a board. Open a session and come back: the board is as you left it, with the same scroll and the same cards selected.

### Home

Home is the first page of a workspace: what needs you, what runs and how much is left, with the usage of your providers.

Home is where a workspace opens. It is a short page of cards, each a count with the rows behind it. Home holds no number of its own: each one is the number the Board and the badge show. A count that is still loading draws a skeleton, never a zero.

- **Sessions to finish** counts what is not done yet and splits it by what needs you, what runs, what is in review and what is open. **Open Board** goes to the list.
- **Needs you** lists the sessions that wait on you, the oldest first. A row names the reason and how long it waited. A permission wait says **Allow and continue** and answers in place; the row leaves once the answer went through. Any other row opens the place that needs you, as its Board card does.
- **Running now** lists the sessions that run, with how long each has run.
- **Usage** shows each window of your connected providers with its meter, its percent and when it resets. Without a connected provider it says so and offers **Connect**.
- **Spend** shows today with its change from yesterday, the week, a chart of the seven days and the sessions that cost the most. Without spend it says it fills as agents run.
- **Tasks** counts the new tasks and splits them by the connected tracker. Without a tracker it offers **Connect**.
- Four more cards start hidden: **Merged this week**, **Long running**, **Every run** and **Workspace setup**. A session counts as long running after a day.

Hover a card, or tab into it, to hide it with the eye in its corner. The grip next to it opens a menu, as a right click or Shift+F10 does. **Undo** in the toast and **⌘Z** bring the card back where it was.

A hidden card waits under **Hidden** at the bottom as **Show …**, in a fixed order. It returns last, at the size it had. **⌘K** has **Hide widget** and **Show widget** for each card.

The layout is saved per workspace right after each change. If saving fails, the layout stays as you made it. **Retry** shows above the list.

A short tip sits above the cards, one at a time. Close it once and it does not return. If the close fails, the tip stays and says so.

A card with nothing to say is not drawn, and the cards below move up. A list that is cut ends with **+N more**, which opens the Board. The cards sit on a grid of four columns in a wide window, two in a medium one and one in a narrow one. Every row of cards ends on one line.

### Needs you

See what waits on you at the top of the **Running** lane. A session that needs you sits there, whatever stage it was in, the oldest wait first. Its card has a yellow line at the left edge. The sessions that only run follow below it, with a blue line: blue means working, yellow means it needs you.

Each card reads like a lane card: the repository and branch, the title, then how long it waited and why, such as "Waiting 5h · Which currency rounds first?". The reason is the question itself, or the words of the state, such as "An agent failed". It wraps to two lines at most. A session with two open questions is one card that says "2 questions".

The lane count holds both kinds of card. The number on **Board** in the places rail stays the count of what needs you.

A card resolves nothing on the Board. Click it and its session opens at the exact point that needs you:

- a question, on its answer
- a plan, on its review
- a stopped or paused run, on its run
- a run held on its first check, on its card, with **Switch** in focus

A session of another workspace opens through that workspace.

### Merge train

Merge several pull requests, across sessions and repositories, with one gesture.

**Merge 2 in order** sits in the **In review** lane head when pull requests there are approved with green checks. It merges them one at a time, the smallest change first and a branch before the one that builds on it. Its tooltip names the method: squash and merge.

- Before each merge Goodboy reads the pull request again. When an earlier one landed in the same repository, it updates the next branch on the base its pull request targets and waits for its checks to report.
- While it runs, one line takes the place of the button: "Merging 1 of 2 · #76 notify-relay", then "Updating #305 on main · checks running", then "Merged 2 of 2".
- **Stop after this one** lets the pull request in flight finish and stops there.
- The train stops at the first pull request it cannot merge and says why. A conflict goes to the Lead, which resolves the rebase; the train never resolves it alone.

Nothing merges without your gesture: the train starts from the button and stops when you say so.

**Merge when green**, in the branch page menu while checks run, hands the merge to GitHub: it merges the reviewed head once every check passes. **Cancel auto-merge** takes it back.

### Stage board

See where each task stands without moving cards around. Five lanes always sit in this order, and each session sits in the lane that matches what is happening in it:

- **Open**
- **Running**
- **In review**
- **Done**
- **Archive**

A session that waits on you shows once, as a yellow card at the top of **Running**, and in no other lane. One that only waits for a quiet look, such as an approved pull request or an unread reply, stays in **In review** or **Open**.

Each lane is a quiet panel with a dot in its stage color beside its name and count. An empty lane shows one dashed slot. **Filter** sits on the tool row under the **Board** title.

**⌥⌘↓** goes to the next session that needs you. If the read of the sessions fails, one line says so above the lanes, with **Retry**.

With no session yet, **No sessions yet** explains that a session holds one goal, its agents and, for code, a branch. The five lanes show muted, with one sentence each. The only **New session** button sits in the first lane.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/board-stage-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/board-stage-light.webp" alt="The Harborline board with its sessions in six lanes: Building 3, Running 2, Needs you 2 with a question waiting on each card, In review 2 with #318 and #90, Done 2 with #198 and #205, and Archived 2">
</picture>

<sub>Screenshot from Goodboy 0.40.1</sub>

### Done and Archived lanes

Finished work stays in view. In Sessions, in the top bar, finished sessions sit in a **Done** group after the others, so a merged session is one click from reopening.

A session whose pull request merged or closed leaves the live groups of Sessions at once, unless you wrote after the merge. A session keeps its merged pull request after you delete its branch. The card stays in **Done** with the pull request number.

A branch is finished only when every branch of the session has a merged or closed pull request and no review thread waits on you. A failure or a reply from before the merge stops asking for you. One from after it stays. An open question, a review thread and a failed push keep asking. A failure stays until its own step runs again and completes. Another agent finishing does not end it.

A session that never opens a pull request reaches **Done** too, once its reply is read and nothing is running or open. The hover card gives the reason: "answered", "report ready", "plan ready" or "finished". Writing again brings it back.

- The **Done** lane header carries a **⋯** menu with **Archive all in Done** and **Archive done older than 7 days**, by the session's last activity.
- Each archives at once with **Undo**, or asks first when an agent there is still live.
- **Done** and **Archive** draw each session as one compact row: its title and its pull request.
- **Archive** folds to its count. **Show all** opens it and **Hide** folds it again.
- **Restore** on an archived row puts the session back where it belongs.

On a narrow window the two lanes share the last lane.

### Session card

Read a task at a glance: repository and branch, a two-line title, then its state, last move and one signal. The repository and branch sit in gray above the title, and the state, the time and the signal share the line under it. A card is as tall as what it says, and a session with no repository skips the gray line. The meta line never cuts a word: a long state wraps to a second line.

A click on a card, or Enter on its title, always opens the session on its Overview. Only the signal with its arrow, the pull request chip and a quick action open a specific place. A modifier click selects the card.

The signal is the first of these that applies:

- the reason a quiet card waits, such as "Approved, ready to merge"
- a failed check or an open question
- the pull request in its state color, which opens the pull request on a click
- a running dot, with the number of agents at work from two on

While an agent works, a line says what it does, such as "Running pnpm test in payments-api". The hover card, the Now chip and Sessions say the same line. When the signal already names the action that waits on you, such as "1 question for you", the signal itself is the button.

Rest the pointer on a card, or focus its title with the keyboard, to open the hover card with age, linked issues, agent count, cost, the pin and draft review comments. Esc, a click elsewhere or another page closes it. The card's right-click menu holds the rest of the session's verbs, among them **Mark as unread** and **Mark as read**.

**Mark as read** covers only what you have looked at. A reply that lands after the log you saw stays unread. A save that fails keeps the row unread and says so. A second window, or an answer from your phone, shows the same unread rows, questions and Slack drafts without a reload.

A thin colored line at the card's left edge tells its stage: gray while open, blue while running, yellow when it needs you, green in review, purple when done, and gray again once in the archive.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/board-card-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/board-card-light.webp" width="676" alt="Four session cards: Warn merchants before a payout hold in notify-relay and Fix the rounding drift in the settlement export in ledger-core, each with 1 question for you, and Stop retried webhooks posting a second credit in payments-api and one more project with pull request #318 and Reconcile the settlement export against the ledger snapshot in ledger-core with pull request #90">
</picture>

<sub>Screenshot from Goodboy 0.40.1</sub>

### Bulk select

Tidy many sessions at once. A card has no checkbox. Pick cards with:

- **Shift** click for a range
- **Option** click to add or remove one card
- a lasso with **Option** held for the cards it crosses
- **Shift+Enter** and **Alt+Enter** from the keyboard
- **Select** in a card's right click menu
- **⌘A** for all of them

Then **Archive**, **Restore** or **Delete** them from the bar at the bottom. Archive stops live agents first and asks once, **Stop 2 agents and archive**. With nothing live it archives at once. Delete asks first. Archive and Restore can be undone, and when some sessions could not be archived the bar names them with **Retry**.

**↑** and **↓** move between the cards of a lane. With **Shift** they extend the pick one card at a time.

**Rename** in the same menu edits the title on the card. **Enter** saves and **Esc** leaves the name as it was. When the write fails the card keeps its old name, and the field stays open, says why and offers **Retry**.

## Under the hood

This part is for contributors and agents who change the feature.

- Home layout: `useHomeLayout` (`features/home/layout/`) keeps a draft over the stored `home.layout` workspace value. It saves through `saveWorkspaceValue` on a 300 ms trailing debounce. Blur, a workspace change and unmount flush it. The workspace id is read at the gesture and travels with the draft. A failed write keeps the draft and shows `HiddenTray`'s Retry; this is the one owner-decided exception to commit after confirm, limited to the layout. `hideHomeWidget` and `showHomeWidget` return the index and size that Undo restores through `undoable`, so ⌘Z (`app.undo`) is the same stack. `parseHomeLayout` drops unknown ids and sizes. The tray is `trayWidgetsOf`, the catalog minus the layout. `useHomePaletteEntries` sends the `goodboy:home-widget-verb` window event that `useHomeWidgetVerbs` answers.
- Home tips: `HOME_TIPS` lists them; `useHomeTip` reads `home.tip.<id>` and writes it with `saveSetting`, so the tip hides only after the write landed. Each tip has its own key, so two windows keep both closes.
- Home reads: `dailySpendOf` reads today through `spendFigures`, the top bar's function. `mergedSinceOf`, `longRunningOf`, `setupDiffOf`, `workflowRulesOf` and `tasksFactsOf` are pure and tested on fixed records; the Tasks card counts `taskNewKeys` and calls no host.
- Home: `HomePage` (`features/home/`) reads `useHomeFacts`, which takes needs you and running from `useNowSessions`, the source of the badge and the Now chip, and the stage groups from `useStageGroupedSessions`. `placeWidgets` puts the cards on the grid and `completeRows` is its closing pass; `holesOf` is what `placeWidgets.test.ts` checks for every layout. `visibleWidgetsOf` leaves out an empty card. `AllowVerb` calls `usePermissionAsk`, the write path of the session page. `usageWindowFactsOf` gives Usage and the provider page one label, tone, percent and reset line.
- Deleted branch: `sessionStageRequestOf` reads the stored pull request of a branch whose worktree was removed (`historyRequestsOf`, from `mountPrLinks`), so `deriveSessionStage` derives Done from a merged request with nothing live. A closed one alone does not. `loadWorkspaceMountHistory` reads the removed mounts and their links for every session when a workspace opens or reloads, and `mountHistoryPatchOf` seeds `sessionMounts` with them (`listSessionMounts` and `listMountPullRequestLinks` take `sessionIds`). `loadMountHistory` does the same when `loadSessionMounts` hydrates one session. `sessionSettleOf` (`session-view/settle/`) reads every mount, removed ones too, through `mountRequestOf` and `mountPrLinks`. It hands them, with the thread states, to `isSettledOf` and `settledAtOf` in `@goodboy/core/attention`, which also holds `isFailureSettled`. Tested in `removedMountStage.test.ts`, `sessionStageRequest.test.ts` and the `deleted-branch-merged-light` scene.
- Done lane menu: `DoneLaneMenu`, the `doneLane` object kind and `doneLaneArchivesOf` give the **Archive all in Done** and **Archive done older than 7 days** actions.
- Lane window: `StageColumn` draws 50 cards of the `done` and `archived` lanes (`LANE_WINDOW`); selection reads the whole list, so Select all keeps selecting every session. `loadArchivedSessions({ workspaceId, isForced })` serves its cache, joins an in-flight read and re-reads only when forced on window focus (`useArchivedSessionsLoad`). A read that overlapped an archive, restore or delete is dropped (`archivedCacheVersion`), so the action's cache write is never overwritten by the older read.
- Card landing: `useBoardNavigation.selectCard` navigates with `lensPlace`. The signal, the pull request chip and the quick actions navigate to their own place. `useBoardNavigation/index.test.ts` and `StageBoardCard/index.test.tsx` cover each case.
- Card keys: `useBoardArrowKeys` walks the `[data-select-id]` cards of the lane (`role="group"`) the key came from and extends through `BoardSelection.onToggle`.
- Card rename: `CardRenameField` draws `TitleField` (`density="row"`) over `useSessionTitleRename`. `renameTask` writes first. A failure keeps the old title, leaves the field open and shows `RenameStatus` with Retry.
- Main region: `App` gives the board (`WorkspaceBoard`, which reads its own sessions), the session frame and the draft to one `PaneSwap`. The layer that leaves stays mounted, inert, for 120 ms while the new one is live, then sits under `Activity`, so the board comes back with the same scroll and selected cards and no new read. `PaneSwap` keeps each scroller's offset, because a hidden layer is `display: none`. `Activity` keeps state but runs effect cleanups, so `useRestHover` drops its target there. `SessionHoverCard` hides on a detached anchor and closes through `useCloseOnOutsidePointer` and `useCloseOnRouteChange` (`SessionHoverCard/closes.test.tsx`).
- Card motion: `StageColumn` draws its cards through `useListMotion` and `ListItemMotion` (`packages/ui`). An arrival fades in with a 4px rise while its height opens over 200 ms, a leaver fades out over 120 ms and then collapses over 200 ms. A change of more than 20 cards, a change of the view prefs or project filter (`motionResetKey`) and reduced motion update in place. A card that changes lane with fewer than 12 cards on the board slides from its old place to its new one over 200 ms (`useLaneTravel`, a FLIP on `data-select-id`); it skips the fade in the lane it leaves and the one it enters, and travels only when both places are inside the board. At 12 cards or more, after a reset and with reduced motion it enters the new lane as before. The slide is clipped by the destination lane.
- Load gate: `setCurrentWorkspace` sets `boardReady` with the rows, never the PR sweep; `StageBoardCard` reserves the signal width (`card-signal-reserve`).
- Facts before the board: `loadWorkspaceFacts` reads the open questions and the Not now choices of every session, one query each. It reads the trees that are not at rest in one query (`listAutoTreesToRecover`), and full views only of the sessions with an Auto agent that hold one. All of it lands with `boardReady`, so no card moves after the first paint. Each fact keeps its own failure: a bad tree drops only that session's views. A failed read sets `workspaceFactsError`, and `BoardFactsFrame` shows it above the lanes with **Retry** (`retryWorkspaceFacts`).
- Fresh facts: `markAllAgentsSeen({ sessionId, seenUpTo })` stamps the agents finished by `seenUpTo`, the newest finish the log rows show (`renderedUpToOf`). The button waits until the rows are drawn. It writes first, then sets the saved rows and announces `agent-seen`. On a failure it reads the stored rows back with `refreshAgentsSeen` and throws the first error. The loaders of open, answered and dismissed questions, `loadSessionSlackDrafts` and `refreshAgentsSeen` drop a late answer through `createLatestOnly()`. A local write reloads its own list, and a seen or unseen write cancels `seenReads`. `markAgentViewed` in `packages/db` only moves the stored time forward. The kinds and the listener are in `docs/event-bus.md`. `setCurrentSession` calls `loadSessionOpenQuestions` and holds no load of its own.
- Card signal: `boardSignalOf` reads `attentionWordsOf`, so a new reason needs no second table.
- Live line: `useFleetPhrase` reads `live_work` for every session in one call that all its readers share. A `work-changed` event or the poll (`FLEET_EVERY_MS`, 15 s) asks for a read while the window shows. `fleetPhraseOf` keeps the newest run's phrase. A phrase stays `FLEET_MIN_MS` (5 s) after it changed, and only the newest waiting one follows. A failed read keeps the last line, and a late answer is dropped. `StageBoardCard`, `SessionHoverCardBody`, the Now chip rows and `SessionsRow` read it.
- Waiting run: `waitingRunOf` names the run `attentionPlace` opens for the same reason, and `leadWaitWordsOf` gives a Lead its words and its button.
- Lanes: `boardByStageOf` drops every session `attentionCountOf` counts from the lanes and files a quiet attention session under `review` when it has a pull request, else `building` (shown as **Open**). `boardLanesOf` gives five lanes, four with Done over Archived, or four that scroll. `laneColumnsOf` picks the `PANE_RHYTHM` lane tracks for `BoardLanes` and `BoardSkeleton`, and `laneWidthOf` gives the same width in rem to the scrolling tracks (`laneWidthOf.test.ts`). `needsYouPlacement.test.ts` checks that every loud attention reason lands as one Running card and in no other lane, and every quiet one stays a plain card in its own lane.
- Needs you count: `needsYouOf` counts the sessions with `attentionCountOf`, the count the places rail uses, and turns each loud reason into moves, one per open question. Each session then gets one card with its question count. `pr-approved` stays out and lands in `readyToMergeOf`. It also needs `requestChecksOf` to read `success` (`readyToMergeOf.test.ts`). Tested in `needsYouOf.test.ts`.
- Needs you in Running: `NeedsYouCards` reads `useNeedsYou` and draws one `NeedsYouCard`, an `InteractiveRow` with the `warning` `ToneBar`, per card. `BoardLanes` hands them to the `running` `StageColumn` as its `lead`, above its own cards, and adds their count to the lane head. A click calls `openAttentionTarget` with the card's reason, so the landing is `attentionPlace` and another workspace goes through `attentionTargetChannel`. Tested in `NeedsYouCards/index.test.tsx`, `lanes.test.tsx`, `needs-you.rows.tsx` and the u52 board scenes.
- Card grammar: `cardContextOf` gives the gray line (`projectLineOf` and the first branch), and `cardFactsOf` the state and age of the meta line. `CardFactsLine` draws them in a wrapping row whose separator hides at a line start, beside the signal. `StageColumn` passes `density="row"` to the `done` and `archived` lanes. Tested in `cardContextOf.test.ts`, `cardFactsOf.test.ts` and `StageBoardCard/index.test.tsx`.
- Archived fold: `StageColumn` keeps the fold in local state, folded on mount and never while the list loads or is empty. Selection still reads the whole list, so Select all picks a folded session too (`lanes.test.tsx`, the `board-lanes` flow row).
- Held run: `waitingRunOf` words a held Lead "Stopped on a check" with the verb "Switch to <workflow>" (`holdWaitWords`). `attentionPlace` opens the held Lead first when two wait, and `AutoDockHold` puts focus on its first button when nothing else holds focus (`AutoDock.hold.test.tsx`, `waitingRunOf.test.ts`).
- Old entries: a history entry saved with the retired `board.layout` and `board.move` rows opens the stages (`needs-you.rows.tsx`).
- Merge order: `mergeOrderOf` proposes the order and its reason from `readyCarsOf`. It reads the mount, the base branch and the file count of a cached view. `MergeInOrder` in the In review lane head reads `useReadyToMerge` and `useMergeTrain`, which merges every ready car in that order (u50 merge train scenes).
- Merge train: `startMergeTrain` keeps one `mergeTrain` in the store, so the line survives leaving the Board. A second start while one runs answers `busy`. The train lives in the window that started it.
- Train engine: `mergeInOrder` serves the train and `mergeSeriesInOrder`. It reads each pull request before it updates or merges it. When its repository moved, `rebaseBranch` rebases the next branch onto the base of its pull request. After an update it waits for checks if the request had some. A read after `mergePr` confirms the merge landed. It polls the checks every 20 seconds for at most 45 minutes (`MERGE_WAIT`). A conflict goes to `resolveRebaseWithAuto`. Each stop has a test in `mergeInOrder.test.ts`, and `trainLineOf` gives the strip its line.
- Merge when green: `pullRequest.mergeWhenGreen` calls the port's `mergeWhenGreen`, `gh pr merge --auto` with the method and `--match-head-commit`, gated by `canMergeWhenGreen` (GitHub only). Tested in `pullRequest.mergeWhenGreen.test.ts` and `prQueued.test.ts`.
- Settled branch: `isSettledOf` needs at least one branch. Every branch needs a known merged or closed request. A branch with no request, a failed fetch or an open request is not settled. No thread may be in `needs_answer` or `failed`, and no agent may have started after the merge.
- Settle time: `settledAtOf` is the latest merge time (`pr.mergedAt`, `mr.mergedAt`, else the stored link's `mergedAt`). A closed request and a Bitbucket merge carry no time, so a failure beside them stays.
- Settled drops: `attentionFactsOf` takes `settle` and drops only `run-stopped` and `unread-reply` that predate it. It also drops the run-bound reasons (`needs-approval`, `plan-approval`, `run-waits-for-go`, `run-paused-at-limit`, `auto-needs-you`) while no run is live. Every other `HUMAN_INPUT_REASONS` entry stays.
- Settled tests: `deriveSessionStage.matrix.test.ts` holds one row per reason. `settle/settledByHost.test.ts` holds one case per host.
- Failure standing: `failureStandingOf` reads `Agent` rows, never `agentTurnState` times. A failed row ends when its slot was re-run and completed later, its Lead delegation was replaced, or it predates the settle time. A pending, skipped or unrelated agent never ends it.
- Failure writes: `deriveSessionState` takes the rows. It keeps the error of the agent being written and of any agent the owner cannot prove over. `deleteAgent`, `discardWorkflow` and `detachWorkflowFromSession` call the same function (`sessionMutators.test.ts`).
- Failure read: `stageInfoOf` passes `isFailureEnded` only when rows exist and every failed one ended.
- Boot repair: `repairErroredSessions` runs once at launch, after the ghost reconcile. It sets `state_kind` from `error` to `idle` when every failure ended. It leaves `updated_at` and `last_activity_at` alone and refuses while an agent runs (`session-error-repair.test.ts`, `repairErroredSessions.sqlite.test.ts`).
