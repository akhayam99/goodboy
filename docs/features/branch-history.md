# Commits and history

The Commits section of the Branch page lets you clean up a branch before it goes to review. Fold, move, reword and drop commits live, with Undo and Redo and a backup before every edit.

### Shape the history

Clean up a branch by hand in the **Commits** section. Drag a commit to move it, drop it onto another to fold it in, or rename or remove it; each edit updates the local branch immediately. Commits not yet on the online copy are marked **Not pushed**. A mark on a planned row (combines, folds into, renamed) opens a fact card on rest. The card shows the commits it takes in or the new name. A step that may conflict in two or more files lists them.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/history-rewrite-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/history-rewrite-light.webp" alt="The Commits page of the branch hl/fix-duplicate-credit in payments-api: five commits on the graph with You are here, Not pushed marks, the Online copy mark, Based on main, Previous versions 1 and the Commits help menu in the header">
</picture>

<sub>Screenshot from Goodboy 0.27.1</sub>

### Safe edits

**Undo** and **Redo**, also **⌘Z** and **⌘⇧Z**, restore edits while the Commits page stays open. Each edit checks a temporary copy and saves a backup before the branch moves. An agent writing in the worktree blocks edits, and overlapping uncommitted files require stash consent.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/history-trial-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/history-trial-light.webp" alt="The Commits page of hl/ledger-export while an edit is checked: the notice Trying your changes on a temporary copy, Your branch is untouched until this finishes, and a progress bar at Step 3 of 7, Add retries to the export job, above seven commits and a Push 3 commits button">
</picture>

<sub>Screenshot from Goodboy 0.27.1</sub>

### Conflicting edits

A conflicting edit names the file and leaves the branch as it was. **Rewrite with an agent** offers help, and **Undo** dismisses the failed edit.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/history-conflicts-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/history-conflicts-light.webp" alt="The Commits page with the notice Could not edit the history, The edit conflicts in export.ts, Nothing was changed, with the buttons Rewrite with an agent and Undo and an Add a hint row above the commit list">
</picture>

<sub>Screenshot from Goodboy 0.27.1</sub>

### Conflicts merged in a copy

When a step stops on a conflict, the notice names the step and the file, and your branch is untouched. **Rewrite with an agent** lets the History rewriter merge the conflict in a copy, and Goodboy checks the result before anything moves.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/history-stopped-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/history-stopped-light.webp" alt="The notice Nothing was changed: a step doesn't replay cleanly, Step 3 of 7, Add retries to the export job, conflicts in webhook.ts, Your branch is exactly as it was, with Rewrite with an agent and Dismiss buttons above the commit list">
</picture>

<sub>Screenshot from Goodboy 0.27.1</sub>

### Push with lease and restore

**Force push** updates the online branch separately after a local edit. It is one verb, whichever button started it. A push that used the lease also finishes the waiting rebase or rewrite, with the edited replies, the pushed event and the pull request description. While the branch is behind main it sits in **Branch actions**. It checks the online copy with a lease so a teammate's newer push is never overwritten. Undo and Redo remain local, and leaving the page clears their stack while keeping the backup refs.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/history-result-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/history-result-light.webp" alt="The Commits page after local edits: the Force push 7 commits button, Undo and Redo icons, five commits marked edited and Not pushed, and the hint Drag a commit to move it, drop it on another to fold it in">
</picture>

<sub>Screenshot from Goodboy 0.27.1</sub>

### Backups

Under the graph, **Previous versions N** opens the older histories of the branch with when and why each was saved. **Reset branch to this version** puts one back, keeps the history you leave and offers Undo.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/history-backups-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/history-backups-light.webp" alt="The Commits page for payments-api hl/fix-duplicate-credit with the Previous versions drawer open: three versions (Before a rebase, Before a split twice), each with its commit count, Show commits and a Reset branch to this version button">
</picture>

<sub>Screenshot from Goodboy 0.27.1</sub>

### Suggest a message

Get a commit message drafted for a reword. Scribe writes it in place, and saving the message updates the local branch.

### Bring them into the plan

If someone pushed after you applied, Goodboy lists their new commits and offers to add them to the plan and push again.

### Rebase on main

**Rebase** on the worktree status line (`6 behind main`) moves the branch onto the latest main with git alone. It needs no agent and no tokens.

- The Commits base row reads `Based on main 9d4b1f7`. It offers a rebase only onto another base.
- If your uncommitted files are in the way, Goodboy asks once to set them aside. It brings them back after the move.
- While the rebase runs, the status line reads it (`Rebasing · 3 of 7 · 1 conflict`), with **Abort**.
- Once it settles, the panel under the Branch header says what happened and what you can do.
- **Force push** replaces the online copy only if nobody pushed since you last looked. A failed Push or Force push in the Branch header offers the same two actions.
- **Add a hint** under **Fix with agent** and under **Rewrite with an agent** passes your words to the agent. A failed start keeps them.
- While Push, Rebase, Merge or another Branch header action runs, its button shows the pending word (**Pushing…**) and ignores more clicks.
- When it finishes, a line under the header says what happened (**Pushed 1 commit to origin.**). It stays until you dismiss it or start the next action.

**When a rebase stops**

Nothing starts by itself. The Branch page shows one panel under the header, on every tab. The rail keeps one line with **Open rebase**.

On a conflict or a commit hook, the panel does three things.

- It reads **Rebase on main stopped: 2 files conflict** and **Your branch is as it was**.
- It lists every file with **Open** (your editor).
- It offers **Resolve with Auto**, **Resolve myself** and **Keep branch as it was**, with **Add a hint** for Auto.

**Resolve with Auto**

- It starts one Auto run. The run picks the agent and the model, rebases the branch in its worktree and resolves the conflict.
- It asks you in the session only when a conflict is ambiguous. It never pushes.
- Until Auto took the goal, the panel stays. A failed start keeps your hint and you can try again.
- While Auto works, the panel reads **Auto is rebasing on main** with **1 of 2 files resolved** and **Open Auto**.

**Resolve myself**

- It starts the rebase in the worktree and opens the terminal on it. If the stop, the mount or its branch changed while it read the base, it starts nothing and says so.
- Then the panel reads **You are rebasing on main in the terminal**.
- A file turns green once it has no conflict markers. Each row also names its state to a screen reader: **Resolved**, **Still conflicts** or **Auto is resolving**.
- **Continue rebase** stays off until no file is left. It stages the resolved files and continues. **Abort rebase** asks first.
- A conflict git leaves without markers stays open until you stage it with `git add` or `git rm`. Examples are a binary file, or a file that one side deleted. The panel says so, and Continue refuses it too.

**After the rebase**

- Once the branch caught up, by Auto or by you, the panel reads **Rebased on main** and **Origin still has the old copy**.
- **Push** is the force push with lease of the Branch header. The panel reads **Pushed to origin** once origin has it.
- With or without a pull request, **Push** is the branch page's one push action. It has the same confirm, force with lease and failure line as the header. It shows while the branch has commits origin lacks.
- When someone pushed while you rebased, the panel reads **Rebased here, but origin has 1 new commit** and names the commit. It offers three verbs.
- **Bring them in** adds their commits to yours, then pushes with the lease of what it brought in.
- **Resolve myself** opens the terminal.
- **Undo rebase** uses the backup.

**The verbs of a stopped rebase**

- The verbs are one set. The banner, the panel and the Next row run the same ones. A hint typed under **Resolve with Auto** or **Fix with agent** therefore applies from whichever place you press the verb.
- A failed push keeps **Fix with agent**, **Open terminal here** and **Retry push**.
- It reads **Stopped: hook stopped the push** only when its error names `pre-push`. A remote `pre-receive hook declined` reads **Stopped: push failed**. The Local checks cell uses the same test.
- A dirty tree, a moved branch, a blocked move, a result that differs and a failed rebase offer **Retry rebase** and **Open terminal**.
- Only the last two of these can **Dismiss**: a result that differs and a failed rebase. **Dismiss** records the stop like Keep. A stop that blocks the branch has no Dismiss.
- A verb that fails keeps the panel with its error and **Retry**, on the branch it failed on.
- The error is kept per branch. It names the branch when the session has more than one. Moving to another branch neither shows it nor locks that branch's verbs.
- A rebase can be in progress in the worktree without a Goodboy stop. A terminal or an agent can start it.
- Then the banner is one row, **Rebase in progress in the worktree**, with **Continue rebase**, **Open terminal** and **Abort rebase**. The header never yields to a banner that does not draw.

**While a stop is open**

- Whatever its reason, the pull request's Merge says **Conflicts with main. Resolve them in the banner.** The Branch header drops its primary and push.
- The header, the banner, the action registry and the rail all read one test. The palette's Merge belongs to the registry. It reads the write destination's mount when it names none.
- The test finds a Goodboy stop in the phase stopped, or a rebase in progress in the worktree. It reads the page's live status or the status cache.
- **Keep branch as it was** closes the panel, leaves the branch where it was and records it. The stop leaves Next in every window, and Activity reads **Kept hl/fix-duplicate-credit as it was**. A later rebase that stops again brings a new row.
- A stop also leaves Next once its pull request merged or closed or its branch left the session.
- The palette has the same verb as **Resolve rebase conflicts with Auto**.
- The panel does not depend on the window that ran the rebase. After a restart, a reload or in a second window, it comes back from the saved stop with the same verbs. **Resolve with Auto** reads the rebase plan again before it starts.
- In Next the stop is one row titled by the branch, with the panel's main verb (see Overview).
- **Open rebase** on the stop's row in Activity, a click on its title in Next, and **Open rebase** on the transcript of a finished History rewriter all do the same. They open the branch the rebase stopped on, with this panel in view, by its mount, never the branch on screen.

**Rebase all**

**Rebase all** rebases every clean branch of a session with git, one at a time. It sits on the session Projects card when two or more branches are behind their base. The palette has **Rebase all behind branches**.

A branch that conflicts goes to one Auto run. Auto resolves the conflicts one by one and asks only when one is ambiguous.

- While it runs, the card line reads **Rebasing 2 of 9** with **Abort**. Once Auto has the rest, it reads **Auto has the rest**.
- **Abort** stops the branches that have not started and leaves the finished ones rebased. A failure on one branch never undoes the others.
- Each branch shows its own state on its row in the tree.

| Chip                | Means                                                                 |
| ------------------- | --------------------------------------------------------------------- |
| **Rebasing**        | a breathing chip, with the replay step in its tooltip                 |
| **Queued**          | a quiet chip                                                          |
| no chip             | the branch is rebased                                                 |
| **Conflict**        | the branch waits for Auto                                             |
| **Auto resolving**  | a breathing chip while Auto works on it, with the file in its tooltip |
| **Rebased by Auto** | shown until every branch Auto took is clean, and then nothing         |
| **Failed**          | the cause is in its tooltip                                           |

**Update all** in the Update group of Next runs the same batch with git only. It rebases behind and stopped branches, brings origin in where someone pushed and leaves every conflict to its own row.

The **Rebase N branches** step in Next opens the same flow as an inline picker.

- Every behind branch is checked. The button reads **Rebase all**, or **Rebase 2** after you uncheck one.
- **Also tidy commits with Auto** is off by default. When on, it asks the same Auto run to fold fix-ups and reword messages after each rebase, locally.
- You push from the Branch header, which asks before a force push.

**When a stop settles**

A **Conflict** or **Failed** from a rebase is a record of where the branch stood when the rebase stopped. It is not the branch's state forever.

An agent or the terminal can finish the rebase outside this flow, for example a fixer, Auto started elsewhere, or `git rebase --continue`. The stop then settles as soon as git shows all of these:

- no rebase in progress and no unmerged file;
- a branch no longer behind its base;
- when the stop recorded a head, a branch head that moved past it.

Then the row chip, the line under the Branch header, the inline conflict prompt and the **Couldn't rebase** step in Next all go. They go in every window, after the agent turn ends, on focus and on the status poll.

A rebase still in progress keeps **Conflict**. So does one the agent aborted back to the old head, and an unrelated commit that leaves the branch behind its base.

### After a pull request merges

Decide what happens to a merged branch: **Ask first**, **Delete on this Mac** or **Also on origin**, per workspace or project, with 14 days to restore it. A branch with later commits, uncommitted changes, or one Goodboy did not create is left alone.

A merged branch is done. It shows no behind count, no warning dot, no rebase offer and no rebase conflict, and says "Merged, work complete". **Clean up** removes its folder and deletes the local branch after one inline confirmation that lists what goes and what stays. The remote branch goes only when the after-merge setting says so. It stops and says why when the folder holds uncommitted or unpushed work. With two or more merged branches in a session, **Clean up N merged** does the same for each.

## Under the hood

This part is for contributors and agents who change the feature.

- Fact cards on a planned row: `historyMarkCardOf` and `conflictCardOf`.
- Push with lease: `pushBranch({ mode: 'lease' })` is the one verb. A push that used the lease also finishes the waiting rebase or rewrite, with the edited replies, the `Pushed` event and the pull request description, in `apps/desktop/src/store/slices/history/settleHistoryPush.ts`.
- Rebase progress: `features/history/rebaseJob.ts` reports `progress`. The banner is `apps/desktop/src/features/history/JobBanner/index.tsx` and the live notice is `apps/desktop/src/features/history/components/CommitsHistory/HistoryLiveNotice.tsx`, which keep the hint of a failed start.
- Stopped rebase panel: `apps/desktop/src/features/history/components/RebaseStopPanel.tsx`, with `apps/desktop/src/features/history/components/RebaseConflictPrompt.tsx` and the count from `rebaseConflictOf`.
- Resolve myself: `apps/desktop/src/store/slices/history/resolveRebaseMyself.ts` starts the rebase, and `worktree_start_rebase` refuses a worktree no longer on the expected branch.
- File states in the panel: `apps/desktop/src/features/history/components/RebaseStopFiles.tsx` names each state to a screen reader. `is_stage_only` in `worktree_rebase_conflicts` and `apps/desktop/src/features/history/rebaseFileStatesOf.ts` find a conflict without markers. `worktree_continue_rebase` stages the resolved files and continues.
- Push after a rebase: `diff.push` is the branch page's one push action. `bringOriginInAndPush` adds the commits someone pushed to yours, then pushes with the lease of what it brought in.
- Verbs of a stopped rebase: `rebaseStopVerbs({ get, sessionId, mountId })` in `apps/desktop/src/store/slices/history/rebaseStopVerbs.ts` is the one set the banner, the panel and the Next row run. `useJobBannerActions` keeps the error per branch.
- Push failures: `isPrePushFailure` in `apps/desktop/src/shared/lib/` is the test the Local checks cell uses too.
- Rebase started elsewhere: `apps/desktop/src/features/history/JobBanner/GitRebaseRow.tsx` draws the row.
- Open stop: `hasOpenRebaseStopOf` in `apps/desktop/src/features/branch/hasOpenRebaseStopOf.ts` is the one test for a Goodboy stop in the phase `stopped` or a rebase in progress. `apps/desktop/src/features/history/historyRecovery.ts` and `apps/desktop/src/features/history/rebaseStopOf.ts` bring a stop back after a restart, a reload or in a second window.
- Rebase all: `apps/desktop/src/features/history/RebaseAllCard/index.tsx` draws the card. **Update all** calls `bringOriginInAndPush` with `canStartRewriter: false` in `apps/desktop/src/store/slices/rebaseAll/updateAll.ts`.
- Settled stops: `apps/desktop/src/features/history/isRebaseStopSettled.ts` and `apps/desktop/src/store/slices/rebaseAll/settleStaleRebases.ts` clear a stop once git shows the rebase is done.
