# Traps in the resolve queue and its fixes

> **Read this when** you change resolve threads, a fix run for a comment or a
> note, the resolver lane, an accept, or a push of replies. **Not for** how a
> pull request is read per mount ([review.md](review.md)) or the resolve
> screens ([../features/review.md](../features/review.md)).

## Threads and publications

### `resolve_threads` is the only verdict history

There is no queue table. What the user sees is `resolve_threads.stage` (nine stages, eight states through `resolveRowState`), computed only by `nextStage`: thread writes go through `saveResolveThread`, queue decisions through `advanceResolveStage`. A direct `upsertResolveThread` skips the stage and leaves the row lying.

The Resolve lens reads `sessionResolveQueueItems`, whose entries copy the thread row, and `projectResolveRows` swaps in fresh rows by thread id. A projection that sets `sessionResolveThreads` alone leaves the queue stale, so a started resolver stays invisible until a reload.

Verdicts in memory come from the row through `threadOutcome`, never from replaying assistant messages; marker parsing writes rows but does not own them. `resolve_publications` and `resolve_publication_threads` track delivery, which lets an interrupted publish resume.

### An active publication row is the publish lock

The row carries a `holder` (window and launch) and a `heartbeat_at` refreshed every 10s. A window claims it only when it has no holder, is its own, or went silent over 60s; otherwise the publish returns `busy`. The map in `publicationLock.ts` is only a fast lane.

On session load and before every publish, a row silent over 60s is closed as failed (`The app stopped while publishing`). A reply caught in `sending` turns `uncertain`, and retry checks GitHub before posting again.

### Undo of an approval picks its verb

`undeferResolveQueueItem` moves only a `deferred` or `wont_fix` item; the database refuses an `accepted` one, which is reopened (`reopenResolveQueueItem`, stage event `user_unapproved`). `reviewComment.undo` picks the verb from the approval, and `reviewComment.matrix.test.ts` walks every state.

### A resolver can exit while its turn still settles

The provider `done` arrives, then `completeResolvedAgent` runs before the markers are saved. `reconcileResolveAttempts` therefore skips an agent whose turn is settling (`isTurnSettling` in `turnSettled.ts`), besides the lease and live run ids. Markers that arrive on an attempt failed as `interrupted` are recorded.

### A failed publication strands the approval

A failed publication advances the thread revision, so a fresh `preparePublication` answers `not_ready`. Retrying one reply goes through `publishThreadNow`, which resumes the failed single-thread publication. A reply posted by hand is marked with `setResolveThreadReplyPosted`, which keeps the revision; `updateResolveThread` would bump it and strand an approved reply.

### Every way out of a push preview cancels it

A prepared preview is a `previewed` publication row while the panel is open, and `useReviewPush` holds its phase. Cancel, the header toggle, a re-arm, unmounting and a `missing` answer all close it with `cancelPublication`, and a preview that resolves after the page left is cancelled on arrival (the phase is no longer `preparing`). A missed path leaves a row nobody can confirm. The header Push never narrows to the selected comment; only `Push only this one` passes `threadIds`.

## Notes and the owner's tree

### A note fix starts on the owner's working tree

When an attempt has a `note:` thread, `drainResolveQueue` and `resolverLaunchCopy` pass `shouldCarryWorkingTree` to `resolve_copy_prepare`. `owner_tree_on` writes the tracked edits and untracked files as one marker commit (author `goodboy@localhost`, subject `goodboy: your working tree before the fix`) through its own temporary index, so the owner's index and files never change. The marker is made on a clean tree too.

The candidate base is the branch head, never the marker: the copy returns it as `base`, and `prepareTurn` carries it as `copyBase` into `recordResolveAttempt`. `worktree_diff_range` diffs from the marker, so the proposal is only the agent delta.

### Notes take one fix at a time

`readyFixBlocking` (`resolveLane.ts`) holds a note fix while any fix waits for review on its branch, and any fix while a note fix waits. The pane shows **Apply or skip the ready fix first**, and either button drains the queue again. `owner_tree_on` refuses a start that is not the branch head, a candidate with more than one marker, or one whose first commit is not the marker. A run with a note is never split into fixes.

### A landing on the owner's tree is journaled

`integrate_onto_owner_tree` applies the fix commits to a private index built from the files on disk and writes it with `read-tree -m -u`. The journal keeps the trees before and after, the head and the branch; both trees sit under `refs/goodboy/recovery/<candidate>` until the landing ends, so `git gc` never takes them. A crash mid landing is finished on the next accept when every file is at one of the two trees, and a replay checks the branch and files first. Submodule moves and merge commits are refused.

### A tree write overwrites an ignored file

`read-tree -m -u` overwrites an ignored file, so every write of a fix's files (`branch_move.rs`, the note landing too) first lists its paths and refuses when one of them, or a folder above it, is on disk but untracked by its index.

### A fast forward in the shared worktree goes through `move_branch`

A comment fix that fast forwards, and a capture in the shared worktree (`shouldKeepUncommitted`, crash recovery included), use `move_branch`:

1. Capture the branch name and head before planning.
2. Refuse staged entries on the fix's files.
3. Move the files with a two tree `read-tree -m -u`.
4. Update that branch by name with the old head, never `HEAD`.

A branch switch in between, or a refused ref update, moves the files back unless the owner edited them since. It never runs `git add --update` and keeps other staged entries. Crash recovery of a copy run quarantines the copy, never the owner's worktree.

## The resolver lane

### A batch resolver never writes the real branch

A resolver from `startBatch` (`resolve_attempts.batch_id` set) runs in a detached copy made by `drainResolveQueue` through `resolve_copy_prepare`, at the branch head or the note's working tree snapshot, under the history copy reservations with slug `resolve-<attemptId>`. `sendTurn` gets it as `resolveCopyPath`. The turn takes no writer lease, gets the copy and its git admin folder as writable roots, and cannot push.

The copy mirrors every `node_modules` of the main tree to depth 3: real folders, symlinks for `.pnpm` and other real entries, and pnpm's relative links recreated so a workspace package resolves to the copy's code. A main tree without dependencies yields a copy without them. Nothing is written into the main tree.

Resolvers without a batch work on the real branch under the writer lease, one at a time. A copy is never reused: a later turn without one (an operator message) runs on the real branch with the lease.

### One lane per worktree, one agent at a time

One lane per mount worktree path holds at most one agent (`running`, or `waiting` for an answer), the rest `queued` in creation order; two branches still run side by side. Nothing reads `resolve_session_settings`, so there is no parallel limit. A retry, Fix anyway, rewrite reply, steer or typed message for an agent whose lane is held becomes a queued attempt (`queueTurnInLane`, from `prepareTurn`), and a recheck waits for a free lane (`ThreadRecheck.isQueued`).

### Each fix is built on the one before

`resolve_copy_prepare` takes `startSha`: the lane's last ready candidate, else the branch head. At turn end the work is captured as a candidate (`refs/goodboy/candidates/<attemptId>`, shared by every worktree), and the copy goes when its agent is done.

Capture keeps tracked changes only; untracked files, symlinks out of the checkout, ignored paths and `node_modules` never enter. It is stacked: the copy stays on the candidate tip, and a run with several fixes is split into one candidate per fix, each on the one before (all or nothing, else one shared candidate).

### A broken link in the chain is rebuilt

A mount's ready candidates chain by `baseSha`. A link is broken when its base is not the previous link, or is a fix refused, deferred, made stale, or taken by the branch under another commit. `laneChainOf` weighs every candidate, not only ready ones, so a refused first fix cannot leave the next heading the chain.

`reconcileResolveLane` runs after load, refuse, defer, a switch to reply only, a turn, an accept and every source sync, one at a time per session. It discards broken fixes, then rebuilds their comments on top with `LANE_REBUILD_HINT` and the model of the run that made them (`attemptOfCandidate` names a split fix after its run). Refusing or deferring a link drops it and rebuilds the ones after; taking a deferred fix back up rebuilds it.

### A failed rebuild never relaunches on its own

- When it cannot start, its comments are set aside again only while their approval is still `none` (the defer query takes `expectedState`), so a refusal committed meanwhile never becomes `deferred`.
- A failure before `startBatch` writes anything (a missing comment, `onWrite` not yet called) puts the fixes back to `ready` for the next reconcile.
- Any other failure leaves them `discarded` with a `sessionLaneRebuildFailures` entry (in memory, per session and worktree), shown with a Retry; `retryLaneRebuild` sets them `ready` and reconciles once. After a restart the entry is gone and the comments are fixed by hand.
- After the spawn, a failure keeps the agent; a failed config write is only logged.

### A source sync hands the lane its own comments

A sync passes `source` and the comments it fetched to `reconcileResolveLane`, because the UI cache gets them only after the sync. The lane rebuilds only fixes whose candidate mount is that source's, only for that source's threads. `startBatch` reads only those comments, never another source's cache, and it and the spawn name the mount (`mountId`). Only broken fixes holding a comment of that source are discarded, so a second pull request on the mount keeps its own.

The lane snapshots the mount revision and hands it down as `expectedMountRevision`. The spawn refuses with `StaleMountError` when the mount moved meanwhile (a branch switch during batch creation), setting the fixes back to `ready` without a Retry entry.

### An accept fast-forwards through the chain

`acceptResolveQueueItem` fast-forwards the branch through the link, accepting earlier links with it; a deferred or refused earlier link blocks it. A branch that only moved ahead takes the fix by cherry-pick, and each link records its landed commit.

A cherry-pick that no longer applies, or a branch that lost the fix's base (`the branch moved`), is aborted and reset: the links turn `stale`, the threads fail `failed:accept_conflict` for a retry on top, and later fixes are rebuilt. An answer that moved a revision without changing is repaired and retried once per link (`withStaleRecovery`); one that really changed stops the accept, naming the comment (`staleCommentName`). Every drain releases ended attempts' copies, and app start removes every `resolve-` copy no process holds.

## Starting a fix

### Hints when a fix starts

The hint typed before a fix is a plain text field, never re-parsed out of a prompt.

- `rulesOfKickoff` (`features/chat/utils/resolverKickoffParts.ts`) tries every `Operator notes` marker from last to first and keeps the first split that matches, so a hint or comment holding the marker, a heading or a fence still splits. Never split on the last marker only.
- **Your hint** reads it back with `hintOfMessage`, anchored on `OPERATOR_NOTES_GUIDANCE`, the line just before the notes. Change that sentence in one place; the golden prompts under `__prompts__` and the echo follow. The rewriter keeps its own `note` line and has no echo.
- `settleStartHint` clears a draft only when its revision is current, from a callback that fires when the first turn started (`onKickoffAccepted` in `spawnAgent`, `onAccepted` in `spawnPushFixer` and `startHistoryRewriter`). A resolver counts as accepted once its batch and attempt are recorded; a refused drain shows **Failed** with the hint, which **Retry** reuses.
- `analyzeFailingChecks` rejects a second hinted call while the same check is analyzed, instead of returning the running agent and dropping the hint.
