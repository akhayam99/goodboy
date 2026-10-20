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

**Rebase** on the worktree status line (`6 behind main`) moves the branch onto the latest main with git alone, with no agent and no tokens; the Commits base row reads `Based on main 9d4b1f7` and offers a rebase only onto another base. If your uncommitted files are in the way, Goodboy asks once to set them aside and brings them back after the move. While the rebase runs, the status line reads it (`Rebasing · 3 of 7 · 1 conflict`, with **Abort**, `features/history/rebaseJob.ts` `progress`); once it settles, a line under the Branch header says in one line what happened or why a push failed with **Fix with agent** or **Open terminal here** beside it, and **Force push** replaces the online copy only if nobody pushed since you last looked. A failed Push or Force push in the Branch header offers the same two actions. **Add a hint** under **Fix with agent** and under **Rewrite with an agent** passes your words to the agent, and a failed start keeps them (`apps/desktop/src/features/history/JobBanner/index.tsx`, `apps/desktop/src/features/history/components/CommitsHistory/HistoryLiveNotice.tsx`). While Push, Rebase, Merge or another Branch header action runs, its button shows the pending word (**Pushing…**) and ignores more clicks; when it finishes, a line under the header says what happened (**Pushed 1 commit to origin.**) until you dismiss it or start the next action.

When the rebase hits a conflict, or a commit hook stops it, nothing starts by itself and your branch stays exactly as it was. The status line and the line under the Branch header ask inline: **2 files conflict with main**, the first file and how many more, then **Resolve with Auto**, **Open terminal here** and **Abort rebase**, with **Add a hint** for Auto (`apps/desktop/src/features/history/components/RebaseConflictPrompt.tsx`, the count from `rebaseConflictOf`). **Resolve with Auto** starts one Auto run that picks the agent and the model, rebases the branch in its worktree, resolves the conflict and asks you in the session only when a conflict is ambiguous; it never pushes. Until Auto took the goal the prompt stays, so a failed start keeps your hint and you can try again. Once Auto has it, the line reads **Auto is rebasing payments-api on main** with **Open Auto**, and **Rebased on main** when the branch caught up. **Abort rebase** closes the prompt and leaves the branch where it was. The palette has the same verb as **Resolve rebase conflicts with Auto**.

**Rebase all** sits on the session Projects card when two or more branches of the session are behind their base (**Rebase all behind branches** in the palette, `apps/desktop/src/features/history/RebaseAllCard/index.tsx`). It rebases every clean branch with git, one at a time, then hands every branch that conflicted to one Auto run that resolves them one by one and asks only when a conflict is ambiguous. The card line reads **Rebasing 2 of 9** with **Abort** while it runs, and each branch shows its own state on its row in the tree: a breathing **Rebasing** chip (the replay step in its tooltip), a quiet **Queued**, no chip once it is rebased, **Conflict** while it waits for Auto, a breathing **Auto resolving** with the file in its tooltip while Auto works on it, **Rebased by Auto** until every branch Auto took is clean and then nothing, **Failed** with the cause in its tooltip. Once Auto has the rest the card line reads **Auto has the rest**. **Abort** stops the branches that have not started and leaves the finished ones rebased, and a failure on one branch never undoes the others. The **Rebase N branches** step in Next opens the same flow as an inline picker: every behind branch is checked, the button reads **Rebase all** or **Rebase 2** after you uncheck one, and **Also tidy commits with Auto** (off by default) asks the same Auto run to fold fix-ups and reword messages after each rebase, locally; you push from the Branch header, which asks before a force push.

### After a pull request merges

Decide what happens to a merged branch: **Ask first**, **Delete on this Mac** or **Also on origin**, per workspace or project, with 14 days to restore it. A branch with later commits, uncommitted changes, or one Goodboy did not create is left alone.
