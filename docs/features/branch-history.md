# Branch history

Reshape a branch before it goes to review: fold, move, rename and remove commits, see what would conflict, and apply with a backup one click away.

### Rewrite history

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/history-rewrite-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/history-rewrite-light.webp" alt="Rewrite history for payments-api hl/ledger-export: seven commits of your own listed Now, with fold and combine controls (Keep title, Keep both, Separate) and a Start from today's main button, next to the four commits the branch becomes After Apply, with a color legend underneath">
</picture>

Clean up a branch by hand. Drag a commit between two others to move it, drop it onto another to fold it in, or rename or remove it. **Start from today's main** moves the branch start onto the latest main. A folded commit chooses **Keep title**, **Keep both** or **Separate** in one control, and hovering any commit of a fold highlights the whole group. The branch is drawn as it is **Now**, next to what it becomes **After Apply**, with a color for each kind of change. Each row's buttons, its `⋯` menu, a right click and **⌘K** on the focused row offer the same actions.

### Safe apply

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/history-trial-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/history-trial-light.webp" alt="Planned changes, 5 changes turning 7 commits into 4, with the notice Trying your changes on a temporary copy, Your branch is untouched until this finishes, and a progress bar at Step 3 of 7, Add retries to the export job, above the Apply here only and Apply and update online buttons">
</picture>

**Apply here only** and **Apply and update online** try the whole plan on a temporary copy first and check the result before your branch moves. A progress line names the step it is on, and a backup is saved before anything changes. If a step stops, it says which one and why, and your branch stays exactly as it was.

### Conflict prediction

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/history-conflicts-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/history-conflicts-light.webp" alt="Planned changes with four changes marked may conflict, and the warning 4 changes do not replay cleanly: webhook.ts is changed by more than one commit, with a Rewrite with an agent button">
</picture>

While you edit the plan, Goodboy tries it in memory and marks each change that may conflict. A warning names the file, here `webhook.ts`, and how many changes would not replay cleanly. Your checkout stays as it is.

### Conflicts merged in a copy

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/history-stopped-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/history-stopped-light.webp" alt="The notice Nothing was changed: a step does not replay cleanly, Step 3 of 7, Add retries to the export job, conflicts in webhook.ts, Your branch is exactly as it was, with Rewrite with an agent and Dismiss buttons above the list of five planned changes">
</picture>

When a step stops on a conflict, the notice says which step and file, and your branch is untouched. Click **Rewrite with an agent** to let the History rewriter merge the conflict in a copy. Goodboy checks the result before anything moves.

### Push with lease and restore

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/history-result-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/history-result-light.webp" alt="History rewritten, 7 commits became 4, listing the five changes made, Online copy updated with a safe force push and PR #214 shows the new version, a backup of hl/ledger-export with Copy ref, and the Restore it and Done buttons">
</picture>

**Apply and update online** replaces the online branch only when nothing newer is there, so a teammate's push is never overwritten. The result says how many commits became how many, counts each kind of change in colored chips ("25 folded · 1 renamed") and confirms the online copy. Up to five changes are listed one per line; past five, the new commit shows **Absorbed 25 commits**, which opens into groups by type (feat, refactor, test, fix) and each group into its titles. The graph ends at the last row. Branches up to 200 commits stay smooth: moving rows animate only up to 60. **Restore it** takes the old history back, and the backup stays for 30 days.

### Backups

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/history-backups-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/history-backups-light.webp" alt="Rewrite history for payments-api hl/fix-duplicate-credit with the Backups panel open, one backup, Dedupe webhook retries in the handler from 1d ago, and a Restore previous history button">
</picture>

Open the `⋯` menu and choose **Backups** to see the older histories of this branch. **Restore previous history** puts one back, and **Hide** closes the list.

### Suggest a message

Get a commit message drafted for a squash or a reword. Scribe writes it in place, and you can edit it before you apply.

### Bring them into the plan

Someone pushed after you applied? Goodboy lists their new commits and offers to add them to the plan and push again.

### Rebase on main

Rebase on main with the same engine, and bring in an agent only when there is a conflict.

### After a pull request merges

Decide what happens to a merged branch, **Ask me**, **Delete on this Mac** or **Also on origin**, per workspace or project, with 14 days to restore it. A branch with later commits, uncommitted changes, or one Goodboy did not create is left alone.
