# The board

The Board shows every session of a workspace in lanes by stage, so you see where each task stands, with what needs you as a row of cards above them. Sessions in the top bar lists the same sessions, so the page stays a board. Open a session and come back: the board is as you left it, with the same scroll and the same cards selected.

### Needs you

See what waits on you at the top of the Board. One row of cards sits above the lanes, the oldest wait first. Its head says **Needs you** with the count, the same number as the places rail. Each card is a session: its project, its title, why it waits and how long. The reason is the question itself, or the registry's words, such as "An agent failed". A session with two open questions is one card that says "2 questions". A card is as wide as one lane below it.

A card resolves nothing on the Board. Click it and its session opens at the exact point that needs you: a question on its answer, a plan on its review, a stopped or paused run on its run. A session of another workspace opens through that workspace.

When the cards are more than the row holds, the row scrolls sideways. **Scroll left** and **Scroll right** sit at its right end, and a trackpad scrolls it too. Every card is in the tab order, **←** and **→** move between cards, and a focused card scrolls into view. With nothing waiting there is no row at all.

### Merge train

Merge several pull requests, across sessions and repositories, with one gesture.

- **Merge 2 in order** sits in the **In review** lane head when pull requests there are approved with green checks. It merges them one at a time, the smallest change first and a branch before the one that builds on it. Its tooltip names the method: squash and merge.
- Before each merge Goodboy reads the pull request again. When an earlier one landed in the same repository, it updates the next branch on the base its pull request targets and waits for its checks to report.
- A merge counts only once the pull request shows as merged. One the host put in its merge queue stops the train.
- While it runs, one line takes the place of the button: "Merging 1 of 2 · #76 notify-relay", then "Updating #305 on main · checks running", then "Merged 2 of 2".
- **Stop after this one** lets the pull request in flight finish and stops there.
- The train stops at the first pull request it cannot merge and says why. A missing approval, checks it cannot read and a base that just merged each stop it too. A conflict goes to the Lead, which resolves the rebase; the train never resolves it alone.
- Nothing merges without your gesture: the train starts from the button and stops when you say so.

**Merge when green**, in the branch page menu while checks run, hands the merge to GitHub: it merges the reviewed head once every check passes. **Cancel auto-merge** takes it back.

### Stage board

See where each task stands without moving cards around. Five lanes, **Building**, **Running**, **In review**, **Done** and **Archived**, always sit in that order, and each session sits in the lane that matches what is happening in it. A session that waits on you shows once, as a card in the **Needs you** row above the lanes, and in no lane. One that only waits for a quiet look, such as an approved pull request or an unread reply, stays in **In review** or **Building**. The row's tooltip teaches **⌥⌘↓**, the key to the next session that needs you. When nothing needs you the key says so in the top bar for two seconds, and when the open session is the only one it says that instead. The **Board** title sits on the same header row, at the same height, as every other page. While the page loads it shows empty lanes, until it knows what needs you in every session, so a card never changes lane after it appears. If that read fails, one line says so above the lanes, with **Retry**. With no session yet, **No sessions yet** sits under the title at its left edge. It says a session holds one goal, its agents and, for code, a branch. It draws the five lanes muted with one sentence each. The only **New session** button sits in the first lane.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/board-stage-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/board-stage-light.webp" alt="The Harborline board with its sessions in six lanes: Building 3, Running 2, Needs you 2 with a question waiting on each card, In review 2 with #318 and #90, Done 2 with #198 and #205, and Archived 2">
</picture>

<sub>Screenshot from Goodboy 0.40.1</sub>

### Done and Archived lanes

Finished work stays in view. In Sessions, in the top bar, finished sessions sit in a **Done** group after the others, so a merged session is one click from reopening. A session that never opens a pull request reaches **Done** too: an answer from a read-only agent, a report, a plan, or a finished edit in a folder with no branch reads **Done** with the reason "answered", "report ready", "plan ready" or "finished" in the hover card, once its reply is read and nothing is running or open; writing again brings it back. A session whose pull request merged or closed also leaves the live groups of Sessions at once, unless you wrote after the merge. The **Done** lane header carries a **⋯** menu with **Archive all in Done** and **Archive done older than 7 days** (by the session's last activity), each archiving at once with **Undo**, or asking first when an agent there is still live, like the card menu. **Done** and **Archived** are lanes like the others, and **Restore** on an archived card puts the session back where it belongs. On a narrow window the two share the last lane.

### Session card

Read a task at a glance: its title on two lines, its project in gray, and one signal at the right. The signal is the first that applies. A card that waits for a quiet look says why in the registry's words, such as "Approved, ready to merge". The list rows show the same words. Otherwise it is a failed check or an open question, then the pull request in its state color (click it to open the pull request), or a running dot with the number of agents at work (the number shows from two on). While an agent works, a line says what it does, in the words of the session's Now: "Running pnpm test in payments-api". An agent with no project of its own names none. The line changes at most every 5 seconds, catches up within 15 and never moves; the hover card, the Now chip and Sessions say the same line. Age, linked issues, agent count, cost, the pin and draft review comments wait in the card that opens when you rest the pointer on it. When the signal already names the action that waits on you, such as "1 question for you", the signal itself is the button. No second icon shows. The hover card also opens when the title takes keyboard focus; the rest of the session's verbs are in the card's right-click menu, among them **Mark as unread** and **Mark as read**. Focus from a click never opens the hover card. Esc, a click elsewhere or another page closes it. A thin colored line at the card's left edge tells its stage at a glance: gray while building, cyan and breathing while running, amber when it needs you, green in review, purple when done, and gray again once archived.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/board-card-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/board-card-light.webp" width="676" alt="Four session cards: Warn merchants before a payout hold in notify-relay and Fix the rounding drift in the settlement export in ledger-core, each with 1 question for you, and Stop retried webhooks posting a second credit in payments-api and one more project with pull request #318 and Reconcile the settlement export against the ledger snapshot in ledger-core with pull request #90">
</picture>

<sub>Screenshot from Goodboy 0.40.1</sub>

### Bulk select

Tidy many sessions at once. A card has no checkbox: **Shift** click picks a range, **Option** click adds or removes one card, a lasso with Option held picks the cards it crosses, **Shift+Enter** and **Alt+Enter** do the same from the keyboard, **Select** in a card's right click menu picks it, and **⌘A** picks them all. Then **Archive**, **Restore** or **Delete** them from the bar at the bottom. Archive asks once for all of them only when agents are still live, **Stop 2 agents and archive**, and stops them first; with nothing live it archives at once. Delete asks first. Archive and Restore can be undone, and when some sessions could not be archived the bar names them with **Retry**.

**↑** and **↓** move between the cards of a lane. With **Shift** they extend the pick one card at a time.

**Rename** in the same menu edits the title on the card. **Enter** saves once the write lands and **Esc** leaves the name as it was. When the write fails the card keeps its old name. The field stays open, says why, and offers **Retry**.

## Under the hood

This part is for contributors and agents who change the feature.

- Done lane menu: `DoneLaneMenu`, the `doneLane` object kind and `doneLaneArchivesOf` give the **Archive all in Done** and **Archive done older than 7 days** actions.
- Lane window: `StageColumn` draws 50 cards of the `done` and `archived` lanes (`LANE_WINDOW`); selection reads the whole list, so Select all keeps selecting every session. `loadArchivedSessions({ workspaceId, isForced })` serves its cache, joins an in-flight read and re-reads only when forced on window focus (`useArchivedSessionsLoad`). A read that overlapped an archive, restore or delete is dropped (`archivedCacheVersion`), so the action's cache write is never overwritten by the older read.
- Card keys: `useBoardArrowKeys` walks the `[data-select-id]` cards of the lane (`role="group"`) the key came from and extends through `BoardSelection.onToggle`.
- Card rename: `CardRenameField` draws `TitleField` (`density="row"`) over `useSessionTitleRename`. `renameTask` writes first. A failure keeps the old title, leaves the field open and shows `RenameStatus` with Retry.
- Main region: `App` gives the board (`WorkspaceBoard`, which reads its own sessions), the session frame and the draft to one `PaneSwap`. The layer that leaves stays mounted, inert, for 120 ms while the new one is live, then sits under `Activity`, so the board comes back with the same scroll and selected cards and no new read. `PaneSwap` keeps each scroller's offset, because a hidden layer is `display: none`. `Activity` keeps state but runs effect cleanups, so `useRestHover` drops its target there. `SessionHoverCard` hides on a detached anchor and closes through `useCloseOnOutsidePointer` and `useCloseOnRouteChange` (`SessionHoverCard/closes.test.tsx`).
- Card motion: `StageColumn` draws its cards through `useListMotion` and `ListItemMotion` (`packages/ui`). An arrival fades in with a 4px rise while its height opens over 200 ms, a leaver fades out over 120 ms and then collapses over 200 ms. A change of more than 20 cards, a change of the view prefs or project filter (`motionResetKey`) and reduced motion update in place. A card that changes lane with fewer than 12 cards on the board slides from its old place to its new one over 200 ms (`useLaneTravel`, a FLIP on `data-select-id`); it skips the fade in the lane it leaves and the one it enters, and travels only when both places are inside the board. At 12 cards or more, after a reset and with reduced motion it enters the new lane as before. The slide is clipped by the destination lane.
- Load gate: `setCurrentWorkspace` sets `boardReady` with the rows, never the PR sweep; `StageBoardCard` reserves the signal width (`card-signal-reserve`).
- Facts before the board: `loadWorkspaceFacts` reads the open questions and the Not now choices of every session, one query each. It reads the trees that are not at rest in one query (`listAutoTreesToRecover`), and full views only of the sessions with an Auto agent that hold one. All of it lands with `boardReady`, so no card moves after the first paint. Each fact keeps its own failure: a bad tree drops only that session's views. A failed read sets `workspaceFactsError`, and `BoardFactsFrame` shows it above the lanes with **Retry** (`retryWorkspaceFacts`).
- Card signal: `boardSignalOf` reads `attentionWordsOf`, so a new reason needs no second table.
- Live line: `useFleetPhrase` reads `live_work` for every session in one call that all its readers share. A `work-changed` event or the poll (`FLEET_EVERY_MS`, 15 s) asks for a read while the window shows. `fleetPhraseOf` keeps the newest run's phrase. A phrase stays `FLEET_MIN_MS` (5 s) after it changed, and only the newest waiting one follows. A failed read keeps the last line, and a late answer is dropped. `StageBoardCard`, `SessionHoverCardBody`, the Now chip rows and `SessionsRow` read it.
- Waiting run: `waitingRunOf` names the run `attentionPlace` opens for the same reason, and `leadWaitWordsOf` gives a Lead its words and its button.
- Lanes: `boardByStageOf` drops every session `attentionCountOf` counts from the lanes and files a quiet attention session under `review` when it has a pull request, else `building`. `boardLanesOf` gives five lanes, four with Done over Archived, or four that scroll. `laneColumnsOf` picks the `PANE_RHYTHM` lane tracks for `BoardLanes` and `BoardSkeleton`, and `laneWidthOf` gives the same width in rem to the scrolling tracks and to each Needs you card (`laneWidthOf.test.ts`, `NeedsYouStrip/index.test.tsx`).
- Needs you count: `needsYouOf` counts the sessions with `attentionCountOf`, the count the places rail uses, and turns each loud reason into moves, one per open question. Each session then gets one card with its question count. `pr-approved` stays out and lands in `readyToMergeOf`. It also needs `requestChecksOf` to read `success` (`readyToMergeOf.test.ts`). Tested in `needsYouOf.test.ts`.
- Needs you strip: `NeedsYouStrip` reads `useNeedsYou` and draws one `NeedsYouCard`, an `InteractiveRow`, per card in a horizontal `ScrollFade`; `useStripScroll` shows the arrows only on overflow. A click calls `openAttentionTarget` with the card's reason, so the landing is `attentionPlace` and another workspace goes through `attentionTargetChannel`. Tested in `NeedsYouStrip/index.test.tsx`, `needs-you.rows.tsx` and the u52 board scenes.
- Old entries: a history entry saved with the retired `board.layout` and `board.move` rows opens the stages (`needs-you.rows.tsx`).
- Merge order: `mergeOrderOf` proposes the order and its reason from `readyCarsOf`. It reads the mount, the base branch and the file count of a cached view. `MergeInOrder` in the In review lane head reads `useReadyToMerge` and `useMergeTrain`, which merges every ready car in that order (u50 merge train scenes).
- Merge train: `startMergeTrain` keeps one `mergeTrain` in the store, so the line survives leaving the Board. A second start while one runs answers `busy`. The train lives in the window that started it.
- Train engine: `mergeInOrder` serves the train and `mergeSeriesInOrder`. It reads each pull request before it updates or merges it. When its repository moved, `rebaseBranch` rebases the next branch onto the base of its pull request. After an update it waits for checks if the request had some. A read after `mergePr` confirms the merge landed. It polls the checks every 20 seconds for at most 45 minutes (`MERGE_WAIT`). A conflict goes to `resolveRebaseWithAuto`. Each stop has a test in `mergeInOrder.test.ts`, and `trainLineOf` gives the strip its line.
- Merge when green: `pullRequest.mergeWhenGreen` calls the port's `mergeWhenGreen`, `gh pr merge --auto` with the method and `--match-head-commit`, gated by `canMergeWhenGreen` (GitHub only). Tested in `pullRequest.mergeWhenGreen.test.ts` and `prQueued.test.ts`.
