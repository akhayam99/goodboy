# Commits and history

The Commits section of the Branch page shapes a branch before it goes to review: fold, move, reword and drop commits, see what would conflict, and apply with a backup one click away.

### Shape the history

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/history-rewrite-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/history-rewrite-light.webp" alt="The Commits section for payments-api hl/ledger-export: seven commits of your own listed Now, with fold and combine controls (Keep title, Keep both, Separate) and a Start from today's main button, next to the four commits the branch becomes After Apply, with a color legend underneath">
</picture>

<sub>Screenshot from Goodboy 0.13.1</sub>

Clean up a branch by hand, on the **Commits** section of the Branch page. Drag a commit between two others to move it, drop it onto another to fold it in, or rename or remove it. **Rebase on main** moves the branch start onto the latest main. A folded commit chooses **Keep title**, **Keep both** or **Separate** in one control, and hovering any commit of a fold highlights the whole group. At rest the Commits section is one column: the branch as it is, with **Rebase on main** on the first row and, under the list, a hint line with a **Keys** button that lists the keyboard keys. Nothing else shows until you plan a change. Then a panel opens beside the list with what the branch becomes **After Apply** ("7 commits become 4"), with a color for each kind of change, and the planned changes, **Reset all** and **Apply** appear under the list. Commits that are not on the online copy are marked **Not pushed**. The branch reloads by itself when it moves and nothing is planned. Each row's buttons, its `⋯` menu, a right click and **⌘K** on the focused row offer the same actions.

### Safe apply

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/history-trial-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/history-trial-light.webp" alt="Planned changes, 5 changes turning 7 commits into 4, with the notice Trying your changes on a temporary copy, Your branch is untouched until this finishes, and a progress bar at Step 3 of 7, Add retries to the export job, above the Apply here only and Apply and update online buttons">
</picture>

<sub>Screenshot from Goodboy 0.13.1</sub>

**Apply here only** and **Apply and update online** try the whole plan on a temporary copy first and check the result before your branch moves. A progress line names the step it is on, and a backup is saved before anything changes. If a step stops, it says which one and why, and your branch stays exactly as it was.

### Conflict prediction

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/history-conflicts-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/history-conflicts-light.webp" alt="Planned changes with four changes marked may conflict, and the warning 4 changes do not replay cleanly: webhook.ts is changed by more than one commit, with a Rewrite with an agent button">
</picture>

<sub>Screenshot from Goodboy 0.13.1</sub>

While you edit the plan, Goodboy tries it in memory and marks each change that may conflict. A warning names the file, here `webhook.ts`, and how many changes would not replay cleanly. Your checkout stays as it is.

### Conflicts merged in a copy

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/history-stopped-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/history-stopped-light.webp" alt="The notice Nothing was changed: a step does not replay cleanly, Step 3 of 7, Add retries to the export job, conflicts in webhook.ts, Your branch is exactly as it was, with Rewrite with an agent and Dismiss buttons above the list of five planned changes">
</picture>

<sub>Screenshot from Goodboy 0.13.1</sub>

When a step stops on a conflict, the notice says which step and file, and your branch is untouched. Click **Rewrite with an agent** to let the History rewriter merge the conflict in a copy. Goodboy checks the result before anything moves.

### Push with lease and restore

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/history-result-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/history-result-light.webp" alt="History rewritten, 7 commits became 4, listing the five changes made, Online copy updated with a safe force push and PR #214 shows the new version, a backup of hl/ledger-export with Copy ref, and the Restore it and Done buttons">
</picture>

<sub>Screenshot from Goodboy 0.13.1</sub>

**Apply and update online** replaces the online branch only when nothing newer is there, so a teammate's push is never overwritten. The result says how many commits became how many, counts each kind of change in colored chips ("25 folded · 1 renamed") and confirms the online copy. Up to five changes are listed one per line; past five, the new commit shows **Absorbed 25 commits**, which opens into groups by type (feat, refactor, test, fix) and each group into its titles. The graph ends at the last row. Branches up to 200 commits stay smooth: moving rows animate only up to 60. **Restore it** takes the old history back, and the backup stays for 30 days.

### Backups

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/history-backups-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/history-backups-light.webp" alt="The Commits section for payments-api hl/fix-duplicate-credit with the Backups panel open, one backup, Dedupe webhook retries in the handler from 1d ago, and a Restore previous history button">
</picture>

<sub>Screenshot from Goodboy 0.13.1</sub>

Open the `⋯` menu and choose **Backups** to see the older histories of this branch. **Restore previous history** asks beside the button ("Restore the backup from 3 Oct?") and then puts one back, keeping the history you leave as a new backup, and **Hide** closes the list.

### Suggest a message

Get a commit message drafted for a squash or a reword. Scribe writes it in place, and you can edit it before you apply.

### Bring them into the plan

Someone pushed after you applied? Goodboy lists their new commits and offers to add them to the plan and push again.

### Rebase on main

Rebase on main with the same engine, and bring in an agent only when there is a conflict.

Goodboy checks the worktree fresh before a rebase or restore. Unmerged files, an operation in progress and an unreadable status still stop it. Changes outside the paths the branch move touches stay in place, including staged and untracked files. The done line uses the count captured by the move, so later edits do not change what it reports.

When the move overlaps your files, the banner asks once: **Stash and rebase** or **Cancel**. Consent applies to that branch and planned head only. Goodboy sets staged, unstaged and untracked changes aside, moves the branch, and applies the saved stash by its exact commit with the index restored. Ignored files that Git might overwrite block the operation instead. The user's older stashes keep their order.

If bringing the files back conflicts, the branch has moved but the stash stays. The banner says **They are saved in a stash. Nothing is lost.** and offers **Open terminal** and **Copy the stash command**. An interrupted operation offers **Bring them back**; it restores only the stash recorded for that worktree's rewrite. A failed bring-back can be retried without repeating the branch move. Both states also offer **Done, forget it**, confirmed in a popover anchored to the button: it clears the saved-files record and stops offering to bring them back. The files stay in the stash and Goodboy keeps a safety copy of the stash for 14 days; it is also the way out when the stash was dropped by hand. A bring-back that finds its files already applied (the app stopped right after restoring) finishes instead of applying twice. Undo rewrite follows the same carry and consent policy.

If the files are back but stash cleanup fails, the completed move or restore
is recorded and a warning reports the stash SHA. `finish_restoration` in
`apps/desktop/src-tauri/src/history/apply.rs` returns that cleanup error
separately; the history slice reports it without repeating the move or pushing.

Sync with the remote and bringing origin into a plan still require a clean tree. `deriveNextSteps` in `apps/desktop/src/features/suggestions/deriveNextSteps.ts` keeps the rebase Next action available on a dirty tree: Git classifies the overlap before the move instead of hiding the action based on a count. These rules are implemented by `move_branch_with` and `bring_back` in the history backend, and by `applyHistoryRewrite` and `restoreHistory` in the history slice.

A rebase is one job, and one banner under the Branch header tells it, on every section of the page (not only Commits). The banner is a quiet strip with a thin tone line on its inner left edge, a title, one line and the actions on the right:

| State               | Title                                                | Line                                                                                                              | Actions                                                            |
| ------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Checking            | Rebasing payments-api on main                        | Checking the branch                                                                                               | none                                                               |
| Replaying           | Rebasing payments-api on main                        | Replaying 7 commits, or "Replaying 3 of 7" when the engine reports its steps                                      | none                                                               |
| Merging             | Rebasing payments-api on main                        | History rewriter is merging webhook.ts in a copy                                                                  | **See what it did**                                                |
| Checking the result | Rebasing payments-api on main                        | Checking the result against your branch                                                                           | none                                                               |
| Moving              | Rebasing payments-api on main                        | Moving the branch. A backup is saved first.                                                                       | none                                                               |
| Updating online     | Rebasing payments-api on main                        | Updating the online copy with a safe force push                                                                   | none                                                               |
| Done                | Rebased on main                                      | 7 commits, and "Your 11 files were not touched." when changes were not committed, then "Backup kept for 30 days." | **Undo rewrite**, **Dismiss**                                      |
| Choosing            | 11 files have changes that are not committed         | 4 of them are also changed on main. Goodboy sets them aside and brings them back.                                 | **Stash and rebase**, **Cancel**                                   |
| Restore conflict    | Rebased on main, but 2 of your files conflict        | They are saved in a stash. Nothing is lost.                                                                       | **Open terminal**, **Copy the stash command**, **Done, forget it** |
| Set aside           | Your files from the last rebase are still set aside. | Bring them back when you are ready.                                                                               | **Bring them back**, **Open terminal**, **Done, forget it**        |
| Uncommitted files   | 11 files have changes that are not committed         | Commit or stash them, then check again.                                                                           | **Check again**, **Open terminal**, **Dismiss**                    |
| Needs you           | History rewriter needs you                           | It could not merge webhook.ts.                                                                                    | **Retry with a note**, **See what it did**, **Dismiss**            |
| No provider         | No provider is connected                             | History rewriter needs one to merge the conflict.                                                                 | **Open providers**, **Dismiss**                                    |
| Result differs      | The result did not match your branch                 | Nothing was changed. Details has the output.                                                                      | **Dismiss**                                                        |
| Origin moved        | Someone pushed to the online copy                    | Nothing was pushed.                                                                                               | **Bring them into the plan**, **Dismiss**                          |
| Branch moved        | The branch moved                                     | Nothing was changed.                                                                                              | **Retry rebase**, **Dismiss**                                      |
| Push failed         | Rebased, but the push failed                         | A pre-push hook stopped it, or "The online copy was not updated." Details has the output.                         | **Retry push**, **Open terminal**, **Details**, **Dismiss**        |

The verbs run the engine and disable themselves while their call runs; a failure reads "Couldn't retry the rebase." through the error report. **Retry with a note** opens a two-row note ("Note for History rewriter", Esc collapses) in the banner and starts History rewriter again on the same plan with the note; the old copy is discarded first. **Bring them into the plan** reads the new online commits into the rebase. **Details** on a failed push opens the hook output in an anchored popover. The transcript that **See what it did** opens takes messages only while the rewriter's copy is alive ("Tell History rewriter what to do next"); after that it shows "This rewrite is finished. Retry it from the banner on the Branch page." with **Open rebase**, so no message can reach a copy that is gone.

When a checked rewriter result changes files outside the plan, **Review the change**
opens their diffs inline in the job banner. The comparison uses the expected
tree from the checker; when the upstream merge conflicts, it uses the original
tree for files outside those upstream changes. **Accept and apply** rechecks the
reviewed copy, moves the local branch through the normal backup and journal
path, and offers **Undo rewrite**. It does not push. **Discard** removes the
copy and leaves the job stopped. A changed or expired copy cannot be accepted.
Each file menu offers **Open in editor** for the kept copy and **Copy path**;
the copy target and editor error handling live in
`apps/desktop/src/features/diff/HistoryChangeDiff.tsx`.
The collector and acceptance boundary live in
`apps/desktop/src-tauri/src/history/rewriter.rs`; the move is owned by
`apps/desktop/src/store/slices/history/applyHistoryRewrite.ts`.

A running state shows a running dot and a shimmer on the title. A settled stop stays until you dismiss it, a new job starts, or its cause clears: the uncommitted-files banner leaves as soon as the tree reads clean. The banner replaces the red line under the header and the "Nothing was changed" notice inside Planned changes, which now only tells the stops of a plan you wrote.

A rebase stop is also one event in Activity: "Rebase of feat/export stopped · uncommitted files", with a short cause (uncommitted files, needs you, result differs, origin moved, branch moved, hook stopped the push), never the engine sentence. The notification of a stop is raised only when you are not on that session's Branch page, because the banner already tells you there.

### After a pull request merges

Decide what happens to a merged branch, **Ask first**, **Delete on this Mac** or **Also on origin**, per workspace or project, with 14 days to restore it. A branch with later commits, uncommitted changes, or one Goodboy did not create is left alone.

Unread commits show loading rows. An empty branch says it has no commits yet;
a failed read offers Retry and Details. Refreshes keep the last known commits.
