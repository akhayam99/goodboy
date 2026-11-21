# Commits and history

The Commits section of the Branch page lets you clean up a branch before it goes to review. Fixup, squash, move, reword and drop commits live, with Undo and Redo and a backup before every edit.

### Shape the history

Clean up a branch by hand in the **Commits** section. Drag a commit to move it, drop it onto another to fixup into it, or reword or drop it; each edit updates the local branch immediately. Commits not yet on origin are marked **Not pushed**.

Commits use one line, grouped by Today, Yesterday or date. Your author label is hidden when it matches the repository's configured git name; if that name cannot be read, all authors show. An open editor or a history mark gives the row more room.

A mark on a planned row (squash into, fixup into, reworded) opens a fact card on rest. The card shows the commits it takes in or the new message. A step that may conflict in two or more files lists them.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/history-rewrite-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/history-rewrite-light.webp" alt="The Commits page of the branch hl/fix-duplicate-credit in payments-api: five commits on the graph with You are here, Not pushed marks, the On origin mark, Based on main at Release 2.14, Previous versions 1 and the Push 3 commits button in the header">
</picture>

<sub>Screenshot from Goodboy 0.40.1</sub>

### Safe edits

**Undo** and **Redo**, also **⌘Z** and **⌘⇧Z**, restore edits while the Commits page stays open. Each edit checks a temporary copy and saves a backup before the branch moves. An agent writing in the worktree blocks edits, and overlapping uncommitted files require stash consent.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/history-trial-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/history-trial-light.webp" alt="The Commits page of hl/ledger-export, pull request 90 of the session Reconcile the settlement export against the ledger snapshot, while an edit is checked: the notice Trying your changes on a temporary copy, Your branch is untouched until this finishes, and a progress bar at Step 3 of 7, Add retries to the export job, above seven commits and a Push 4 commits button">
</picture>

<sub>Screenshot from Goodboy 0.40.1</sub>

### Conflicting edits

A conflicting edit names the file and leaves the branch as it was. **Rewrite with an agent** offers help, and **Undo** dismisses the failed edit.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/history-conflicts-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/history-conflicts-light.webp" alt="The Commits page of pull request 90 on hl/ledger-export with the notice Couldn't edit the history, The edit conflicts in export.ts, Nothing was changed, with the buttons Rewrite with an agent and Undo and an Add a hint row above the commit list">
</picture>

<sub>Screenshot from Goodboy 0.40.1</sub>

### Conflicts merged in a copy

When a step stops on a conflict, the notice names the step and the file, and your branch is untouched. **Rewrite with an agent** lets the History rewriter merge the conflict in a copy, and Goodboy checks the result before anything moves.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/history-stopped-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/history-stopped-light.webp" alt="The notice Nothing was changed: a step doesn't replay cleanly, Step 3 of 7, Add retries to the export job, conflicts in webhook.ts, Your branch is exactly as it was, with Rewrite with an agent and Dismiss buttons above the commit list">
</picture>

<sub>Screenshot from Goodboy 0.40.1</sub>

### Push with lease and restore

**Force push** updates the online branch separately after a local edit. It sits in **Branch actions** and says your branch and origin differ. It is one verb, whichever button started it. A push that used the lease also finishes the waiting rebase or rewrite, with the edited replies, the pushed event and the pull request description. It checks origin with a lease so a teammate's newer push is never overwritten. Undo and Redo remain local, and leaving the page clears their stack while keeping the backup refs.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/history-result-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/history-result-light.webp" alt="The Commits page of pull request 90, Export the ledger as CSV on hl/ledger-export, after local edits: Branch actions open on Force push 7 commits, with the line Your branch and origin differ, Force push replaces the branch on origin (with lease), above seven commits with the top five marked Not pushed">
</picture>

<sub>Screenshot from Goodboy 0.40.1</sub>

### Backups

Under the graph, **Previous versions N** opens the older histories of the branch with when and why each was saved. **Reset branch to this version** puts one back, keeps the history you leave and offers Undo.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/history-backups-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/history-backups-light.webp" alt="The Commits page for payments-api hl/fix-duplicate-credit with the Previous versions drawer open: three versions (Before a rebase, Before a split twice), each with its commit count, Show commits and a Reset branch to this version button">
</picture>

<sub>Screenshot from Goodboy 0.40.1</sub>

### Suggest a message

Get a commit message drafted for a reword. Scribe writes it in place, and saving the message updates the local branch.

### Rebase on their commits

If someone pushed after you applied, Goodboy lists their new commits and offers to rebase on them and push again.

### Rebase on main

**Rebase** on the worktree status line (`6 behind main`) moves the branch onto the latest main with git alone. It needs no agent and no tokens.

- The Commits base row reads `Based on main 9d4b1f7`. It offers a rebase only onto another base.
- If your uncommitted files are in the way, Goodboy asks once to set them aside. It brings them back after the move.
- While the rebase runs, the status line reads it (`Rebasing · 3 of 7 · 1 conflict`), with **Abort**.
- Once it settles, a card above the Branch title says what happened and what you can do. It sits in the page flow, so it never covers the title, at any width.
- Every card, stopped or done, has **Dismiss** on its title row. Dismiss hides that card in this window, a reload included. It keeps the backup, and a new stop shows a new card.
- A branch shows one card at most, the newest. A rebase that finishes settles every older stop of the branch, so dismissing it shows nothing behind it.
- **Force push** replaces the branch on origin only if nobody pushed since you last looked. A failed Push or Force push in the Branch header offers the same two actions.
- If origin changed between your confirm and the push, the failure leads with **Check again**. It fetches and lists the commits only on origin, with author and subject. Then it asks again: **Force push anyway** drops them, **Rebase on their commits** keeps them. It offers no **Retry**, since that would reuse the old check.
- There, **Fix with an agent** and **Open in Terminal** read origin again first. Since nobody confirmed the new commits, they keep everything on origin: the agent rebases on it, and the terminal gets a rebase on origin, then a push. A failed start shows in the card, not in a toast.
- **Add a hint** under **Fix with an agent** and under **Rewrite with an agent** passes your words to the agent. A failed start keeps them.
- While Push, Rebase, Merge or another Branch header action runs, its button shows the pending word (**Pushing…**) and ignores more clicks.
- When it finishes, a line under the header says what happened (**Pushed 1 commit to origin.**). It stays until you dismiss it or start the next action.

**When a rebase stops**

Nothing starts by itself. The Branch page shows one card above the title, on every tab. The rail keeps one line with **Open rebase**.

On a conflict or a commit hook, the panel does three things.

- It reads **Rebase on main stopped: 2 files conflict** and **Your branch is as it was**.
- It lists every file with **Open** (your editor).
- It offers **Resolve with the Lead**, **Resolve in terminal** and **Abort rebase**, with **Add a hint** for the Lead.

**Resolve with the Lead**

- It starts one Lead run. The run picks the agent and the model, rebases the branch in its worktree and resolves the conflict.
- It asks you in the session only when a conflict is ambiguous. It never pushes.
- Until the Lead took the goal, the panel stays. A failed start keeps your hint and you can try again.
- While the Lead works, the panel reads **The Lead is rebasing on main** with **1 of 2 files resolved** and **Open transcript**. The word on the card reads **Resolving**, as on a check or a comment.

**Resolve in terminal**

- It starts the rebase in the worktree and opens the terminal on it. If the stop, the mount or its branch changed while it read the base, it starts nothing and says so.
- Then the panel reads **You are rebasing on main in the terminal**.
- A file turns green once it has no conflict markers. Each row also names its state to a screen reader: **Resolved**, **Still conflicts** or **The Lead is resolving**.
- **Continue rebase** stays off until no file is left. It stages the resolved files and continues. **Abort rebase** asks first.
- A conflict git leaves without markers stays open until you stage it with `git add` or `git rm`. Examples are a binary file, or a file that one side deleted. The panel says so, and Continue refuses it too.

**After the rebase**

- Once the branch caught up, by the Lead or by you, the panel reads **Rebased on main** and **Origin still has the old copy**.
- **Push** is the force push with lease of the Branch header. The panel reads **Pushed to origin** once origin has it.
- With or without a pull request, **Push** is the branch page's one push action. It has the same confirm, force with lease and failure line as the header. It shows while the branch has commits origin lacks.
- When someone pushed while you rebased, the panel reads **Rebased here, but origin has 1 new commit** and names the commit. It offers three verbs.
- **Rebase on their commits** puts yours on top of theirs, then pushes with the lease of what it rebased on.
- **Resolve in terminal** opens the terminal.
- **Undo rebase** uses the backup.

**The verbs of a stopped rebase**

- The verbs are one set. The banner, the panel and the Next row run the same ones. A hint typed under **Resolve with the Lead** or **Fix with an agent** therefore applies from whichever place you press the verb.
- A failed push keeps **Fix with an agent**, **Open in Terminal** and **Retry push**.
- While that agent works, the same panel reads **Fixing** with its step and time, with **Stop** and **Open transcript**. **Retry push** waits until it ends.
- It reads **Stopped: hook stopped the push** only when its error names `pre-push`. A remote `pre-receive hook declined` reads **Stopped: push failed**. The Local checks cell uses the same test.
- A dirty tree, a moved branch, a blocked move, a result that differs and a failed rebase offer **Retry rebase** and **Open in Terminal**.
- A verb that fails keeps the panel with its error and **Retry**, on the branch it failed on.
- The error is kept per branch. It names the branch when the session has more than one. Moving to another branch neither shows it nor locks that branch's verbs.
- A rebase can be in progress in the worktree without a Goodboy stop. A terminal or an agent can start it.
- Then the banner is one row, **Rebase in progress in the worktree**, with **Continue rebase**, **Open in Terminal** and **Abort rebase**. The header never yields to a banner that does not draw.

**While a stop is open**

- Whatever its reason, the pull request's Merge says **Conflicts with main. Resolve them in the banner.** The Branch header drops its primary and push.
- The header, the banner, the action registry and the rail all read one test. Merge in Search or run belongs to the registry. It reads the write destination's mount when it names none.
- The test finds a Goodboy stop in the phase stopped, or a rebase in progress in the worktree. It reads the page's live status or the status cache.
- **Abort rebase** closes the panel, leaves the branch where it was and records it. The stop leaves Next in every window, and Activity reads **Kept hl/fix-duplicate-credit as it was**. A later rebase that stops again brings a new row.
- A stop also leaves Next once its pull request merged or closed or its branch left the session. A newer stop on the same branch replaces it, so the older History rewriter stops asking under Needs you.
- Search or run has the same verb as **Resolve rebase conflicts with the Lead**.
- The panel does not depend on the window that ran the rebase. After a restart, a reload or in a second window, it comes back from the saved stop with the same verbs. **Resolve with the Lead** reads the rebase plan again before it starts.
- In Next the stop is one row titled by the branch, with the panel's main verb (see Overview).
- **Open rebase** on the stop's row in Activity, a click on its title in Next, and **Open rebase** on the transcript of a finished History rewriter all do the same. They open the branch the rebase stopped on, with this panel in view, by its mount, never the branch on screen.

**Rebase all**

**Rebase all** rebases every clean branch of a session with git, one at a time. It sits on the session Projects card when two or more branches are behind their base. Search or run has **Rebase all behind branches**.

A branch that conflicts goes to one Lead run. The Lead resolves the conflicts one by one and asks only when one is ambiguous.

- While it runs, the card line reads **Rebasing 2 of 9** with **Abort**. Once The Lead has the rest, it reads **The Lead has the rest**.
- **Abort** stops the branches that have not started and leaves the finished ones rebased. A failure on one branch never undoes the others.
- Each branch shows its own state on its row in the tree.

| Chip                    | Means                                                                     |
| ----------------------- | ------------------------------------------------------------------------- |
| **Rebasing**            | a breathing chip, with the replay step in its tooltip                     |
| **Queued**              | a quiet chip                                                              |
| no chip                 | the branch is rebased                                                     |
| **Conflict**            | the branch waits for the Lead                                             |
| **Lead resolving**      | a breathing chip while the Lead works on it, with the file in its tooltip |
| **Rebased by the Lead** | shown until every branch the Lead took is clean, and then nothing         |
| **Failed**              | the cause is in its tooltip                                               |

**Update all** in the Update group of Next runs the same batch with git only. It rebases behind and stopped branches, brings origin in where someone pushed and leaves every conflict to its own row.

The **Rebase N branches** step in Next opens the same flow as an inline picker.

- Every behind branch is checked. The button reads **Rebase all**, or **Rebase 2** after you uncheck one.
- **Also tidy commits with the Lead** is off by default. When on, it asks the same Lead run to fold fix-ups and reword messages after each rebase, locally.
- You push from the Branch header, which asks before a force push.

**When a stop settles**

A **Conflict** or **Failed** from a rebase is a record of where the branch stood when the rebase stopped. It is not the branch's state forever.

An agent or the terminal can finish the rebase outside this flow, for example a fixer, a Lead started elsewhere, or `git rebase --continue`. The stop then settles as soon as git shows all of these:

- no rebase in progress and no unmerged file;
- a branch no longer behind its base;
- when the stop recorded a head, a branch head that moved past it.

Then the row chip, the line under the Branch header, the inline conflict prompt and the **Couldn't rebase** step in Next all go. They go in every window, after the agent turn ends, on focus and on the status poll.

A rebase still in progress keeps **Conflict**. So does one the agent aborted back to the old head, and an unrelated commit that leaves the branch behind its base.

The other stops settle the same way when their cause is gone:

- **Rebased here, but someone pushed to origin** and a failed push settle once origin has every local commit and no rebase or merge is in progress. One quiet line, **Origin now has your rebased commits**, shows and fades. It is never a toast.
- A dirty tree settles once the tree is clean or the head moved.
- A moved branch settles like a conflict.

A git read that started before the stop never settles it. The backup stays, so **Undo** is still in the commits history.

### After a pull request merges

Decide what happens to a merged branch: **Ask first**, **Delete on this Mac** or **Also on origin**, per workspace or project, with 14 days to restore it. A branch with later commits, uncommitted changes, or one Goodboy did not create is left alone.

A merged branch is done. It shows no behind count, no warning dot, no rebase offer and no rebase conflict, and says "Merged, work complete".

**Delete local branch…** deletes the local branch and its folder after one inline confirmation: the pull request stays, and the branch on origin stays unless the after-merge setting removes it. The confirmation offers **Close branch** instead, which keeps the local branch and removes the folder, and counts the files that are not committed. **Undo** brings the branch back in a fresh folder. It stops and says why when the folder holds uncommitted or unpushed work. **Close branch** shows on its own only on a branch that did not merge, and says "Closing…" while it works. With two or more merged branches in a session, **Clean up N merged** does the same for each.

## Under the hood

This part is for contributors and agents who change the feature.

- Compact rows and local day groups: `HistoryCommitRow` and `historyDaysOf`. `HistoryCommitMetadata` hides the configured author read by `history_graph` for the named worktree. `useRowPositions` measures only keyed graph rows, so day headers add space without adding nodes.
- Fact cards on a planned row: `historyMarkCardOf` and `conflictCardOf`.
- Push with lease: `pushBranch({ mode: 'lease' })` is the one verb. A push that used the lease also finishes the waiting rebase or rewrite, with the edited replies, the `Pushed` event and the pull request description, in `apps/desktop/src/store/slices/history/settleHistoryPush.ts`.
- Rebase progress: `features/history/rebaseJob.ts` reports `progress`. The banner is `apps/desktop/src/features/history/JobBanner/index.tsx` and the live notice is `apps/desktop/src/features/history/components/CommitsHistory/HistoryLiveNotice/index.tsx`, which keep the hint of a failed start.
- Stopped rebase panel: `apps/desktop/src/features/history/components/RebaseStopPanel.tsx`, with `apps/desktop/src/features/history/components/RebaseConflictPrompt.tsx` and the count from `rebaseConflictOf`.
- Resolve in terminal: `apps/desktop/src/store/slices/history/resolveRebaseMyself.ts` starts the rebase, and `worktree_start_rebase` refuses a worktree no longer on the expected branch.
- File states in the panel: `apps/desktop/src/features/history/components/RebaseStopFiles.tsx` names each state to a screen reader. `is_stage_only` in `worktree_rebase_conflicts` and `apps/desktop/src/features/history/rebaseFileStatesOf.ts` find a conflict without markers. `worktree_continue_rebase` stages the resolved files and continues.
- Push after a rebase: `diff.push` is the branch page's one push action. `bringOriginInAndPush` adds the commits someone pushed to yours, then pushes with the lease of what it brought in.
- Verbs of a stopped rebase: `rebaseStopVerbs({ get, sessionId, mountId })` in `apps/desktop/src/store/slices/history/rebaseStopVerbs.ts` is the one set the banner, the panel and the Next row run. `useJobBannerActions` keeps the error per branch.
- Push failures: `isPrePushFailure` in `apps/desktop/src/shared/lib/` is the test the Local checks cell uses too.
- Origin moved before a force push: `pushMount` marks the failure `isOriginMoved`. `PushFailureActions` runs `checkBranchOrigin`, which drops a late answer, and `forcePushCheckedBranch`, which leases the checked sha. `branchPushPlan` reads origin again for the agent and the terminal. All three live in `apps/desktop/src/store/slices/history/pushFix/`.
- Rebase started elsewhere: `apps/desktop/src/features/history/JobBanner/GitRebaseRow.tsx` draws the row.
- Open stop: `hasOpenRebaseStopOf` in `apps/desktop/src/features/branch/hasOpenRebaseStopOf.ts` is the one test for a Goodboy stop in the phase `stopped` or a rebase in progress. `apps/desktop/src/features/history/historyRecovery.ts` and `apps/desktop/src/features/history/rebaseStopOf.ts` bring a stop back after a restart, a reload or in a second window.
- Rebase all: `apps/desktop/src/features/history/RebaseAllCard/index.tsx` draws the card. **Update all** calls `bringOriginInAndPush` with `canStartRewriter: false` in `apps/desktop/src/store/slices/rebaseAll/updateAll.ts`.
- Settled stops: `apps/desktop/src/features/history/isRebaseStopRelevant.ts` is the one judge per stop reason, and `apps/desktop/src/store/slices/rebaseAll/settleStaleRebases.ts` clears a stop once a newer git read shows its cause gone. `useRebaseStop` and `useRebaseStatuses` run it on every status read, upstream distance and dirty count included.
- One card per branch: `setHistoryRun` settles every older stop event of the mount when a rebase run reaches applied or pushed. `dismissRebaseCard` drops the run and settles its stop events. Settled stops live per window in sessionStorage (`apps/desktop/src/store/slices/rebaseAll/settledStopsMemory.ts`).
- The card sits in the Branch page header column above `BranchHeader`, not in the `PaneShell` lead (`apps/desktop/src/features/branch/components/BranchPage/index.tsx`).
