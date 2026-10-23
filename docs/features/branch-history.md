# Commits and history

The Commits section of the Branch page lets you clean up a branch before it goes to review. Fold, move, reword and drop commits live, with Undo and Redo and a backup before every edit.

### Shape the history

Clean up a branch by hand in the **Commits** section. Drag a commit to move it, drop it onto another to fold it in, or rename or remove it; each edit updates the local branch immediately. Commits not yet on the online copy are marked **Not pushed**. A mark on a planned row (combines, folds into, renamed) opens a fact card on rest with the commits it takes in or the new name, and a step that may conflict in two or more files lists them (`historyMarkCardOf`, `conflictCardOf`).

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
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/history-stopped-light.webp" alt="The notice Nothing was changed: a step does not replay cleanly, Step 3 of 7, Add retries to the export job, conflicts in webhook.ts, Your branch is exactly as it was, with Rewrite with an agent and Dismiss buttons above the commit list">
</picture>

<sub>Screenshot from Goodboy 0.27.1</sub>

### Push with lease and restore

**Force push** updates the online branch separately after a local edit. While the branch is behind main it sits in **Branch actions**. It checks the online copy with a lease so a teammate's newer push is never overwritten. Undo and Redo remain local, and leaving the page clears their stack while keeping the backup refs.

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

**Rebase** on the worktree status line (`6 behind main`) moves the branch onto the latest main with git alone, with no agent and no tokens; the Commits base row reads `Based on main 9d4b1f7` and offers a rebase only onto another base. If your uncommitted files are in the way, Goodboy asks once to set them aside and brings them back after the move. While the rebase runs, the status line reads it (`Rebasing · 3 of 7 · 1 conflict`, with **Abort**, `features/history/rebaseJob.ts` `progress`); once it settles, the panel under the Branch header says what happened and what you can do (below), and **Force push** replaces the online copy only if nobody pushed since you last looked. A failed Push or Force push in the Branch header offers the same two actions. **Add a hint** under **Fix with agent** and under **Rewrite with an agent** passes your words to the agent, and a failed start keeps them (`apps/desktop/src/features/history/JobBanner/index.tsx`, `apps/desktop/src/features/history/components/CommitsHistory/HistoryLiveNotice.tsx`). While Push, Rebase, Merge or another Branch header action runs, its button shows the pending word (**Pushing…**) and ignores more clicks; when it finishes, a line under the header says what happened (**Pushed 1 commit to origin.**) until you dismiss it or start the next action.

When a rebase stops, nothing starts by itself and the Branch page shows one panel under the header, on every tab (`apps/desktop/src/features/history/components/RebaseStopPanel.tsx`); the rail keeps one line with **Open rebase**. On a conflict or a commit hook it reads **Rebase on main stopped: 2 files conflict** and **Your branch is as it was**, lists every file with **Open** (your editor), and offers **Resolve with Auto**, **Resolve myself** and **Keep branch as it was**, with **Add a hint** for Auto (`apps/desktop/src/features/history/components/RebaseConflictPrompt.tsx`, the count from `rebaseConflictOf`). **Resolve with Auto** starts one Auto run that picks the agent and the model, rebases the branch in its worktree, resolves the conflict and asks you in the session only when a conflict is ambiguous; it never pushes. Until Auto took the goal the panel stays, so a failed start keeps your hint and you can try again; while Auto works the panel reads **Auto is rebasing on main** with **1 of 2 files resolved** and **Open Auto**. **Resolve myself** starts the rebase in the worktree and opens the terminal on it; if the stop, the mount or its branch changed while it read the base, it starts nothing and says so, and `worktree_start_rebase` refuses a worktree no longer on the expected branch (`apps/desktop/src/store/slices/history/resolveRebaseMyself.ts`). Then the panel reads **You are rebasing on main in the terminal**, turns a file green once it has no conflict markers (each row also names its state to a screen reader: **Resolved**, **Still conflicts** or **Auto is resolving**, `apps/desktop/src/features/history/components/RebaseStopFiles.tsx`), and keeps **Continue rebase** off until no file is left (`worktree_continue_rebase` stages the resolved files and continues; **Abort rebase** asks first). A conflict git leaves without markers (a binary file, or one side deleted the file) stays open until you stage it with `git add` or `git rm`, and the panel says so; Continue refuses it too (`is_stage_only` in `worktree_rebase_conflicts`, `apps/desktop/src/features/history/rebaseFileStatesOf.ts`). Once the branch caught up, by Auto or by you, it reads **Rebased on main** and **Origin still has the old copy** with **Push**, the force push with lease of the Branch header, and **Pushed to origin** once origin has it. On a branch with no pull request, **Push** is the plain push of the branch (`pushBranch` in `useJobBannerActions`, `pushSessionBranch`), shown while the branch has commits origin lacks. When someone pushed while you rebased it reads **Rebased here, but origin has 1 new commit**, names the commit, and offers **Bring them in** (adds their commits to yours, then pushes with the lease of what it brought in, `bringOriginInAndPush`), **Resolve myself** (the terminal) and **Undo rebase** (the backup). A failed push keeps **Fix with agent**, **Open terminal here** and **Retry push**; a dirty tree, a moved branch, a blocked move, a result that differs and a failed rebase offer **Retry rebase** and **Open terminal**, and only the last two **Dismiss**, which records the stop like Keep. A stop that blocks the branch has no Dismiss. A verb that fails keeps the panel with its error and **Retry**. With a stop open, the pull request's merge line says **Conflicts with main. Resolve them in the banner.** **Keep branch as it was** closes the panel, leaves the branch where it was and records it, so the stop leaves Next in every window and Activity reads **Kept hl/fix-duplicate-credit as it was**; a later rebase that stops again brings a new row. A stop also leaves Next once its pull request merged or closed or its branch left the session (`apps/desktop/src/features/history/historyRecovery.ts`). The palette has the same verb as **Resolve rebase conflicts with Auto**. The panel does not depend on the window that ran the rebase: after a restart, a reload or in a second window it comes back from the saved stop with the same verbs, and **Resolve with Auto** reads the rebase plan again before it starts (`apps/desktop/src/features/history/rebaseStopOf.ts`). In Next the stop is one row titled by the branch with the panel's main verb (see Overview); **Open rebase** on the stop's row in Activity, a click on its title in Next, and **Open rebase** on the transcript of a finished History rewriter open the branch the rebase stopped on with this panel in view, by its mount, never the branch on screen.

**Rebase all** sits on the session Projects card when two or more branches of the session are behind their base (**Rebase all behind branches** in the palette, `apps/desktop/src/features/history/RebaseAllCard/index.tsx`). It rebases every clean branch with git, one at a time, then hands every branch that conflicted to one Auto run that resolves them one by one and asks only when a conflict is ambiguous. The card line reads **Rebasing 2 of 9** with **Abort** while it runs, and each branch shows its own state on its row in the tree: a breathing **Rebasing** chip (the replay step in its tooltip), a quiet **Queued**, no chip once it is rebased, **Conflict** while it waits for Auto, a breathing **Auto resolving** with the file in its tooltip while Auto works on it, **Rebased by Auto** until every branch Auto took is clean and then nothing, **Failed** with the cause in its tooltip. Once Auto has the rest the card line reads **Auto has the rest**. **Abort** stops the branches that have not started and leaves the finished ones rebased, and a failure on one branch never undoes the others. **Update all** in the Update group of Next runs the same batch with git only: it rebases behind and stopped branches, brings origin in where someone pushed (`bringOriginInAndPush` with `canStartRewriter: false`), and leaves every conflict to its own row (`apps/desktop/src/store/slices/rebaseAll/updateAll.ts`). The **Rebase N branches** step in Next opens the same flow as an inline picker: every behind branch is checked, the button reads **Rebase all** or **Rebase 2** after you uncheck one, and **Also tidy commits with Auto** (off by default) asks the same Auto run to fold fix-ups and reword messages after each rebase, locally; you push from the Branch header, which asks before a force push.

A **Conflict** or **Failed** from a rebase is a record of where the branch stood when the rebase stopped, not its state forever. When an agent or the terminal finishes the rebase outside this flow (a fixer, Auto started elsewhere, `git rebase --continue`), the stop settles as soon as git shows no rebase in progress, no unmerged file, a branch no longer behind its base and, when the stop recorded a head, a branch head that moved past it: the row chip, the line under the Branch header, the inline conflict prompt and the **Couldn't rebase** step in Next all go, in every window, after the agent turn ends, on focus and on the status poll. A rebase still in progress, one the agent aborted back to the old head, or an unrelated commit that leaves the branch behind its base keeps **Conflict** (`apps/desktop/src/features/history/isRebaseStopSettled.ts`, `apps/desktop/src/store/slices/rebaseAll/settleStaleRebases.ts`).

### After a pull request merges

Decide what happens to a merged branch: **Ask first**, **Delete on this Mac** or **Also on origin**, per workspace or project, with 14 days to restore it. A branch with later commits, uncommitted changes, or one Goodboy did not create is left alone.
