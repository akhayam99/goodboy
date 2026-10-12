# Commits and history

The Commits section of the Branch page lets you clean up a branch before it goes to review. Fold, move, reword and drop commits, see what would conflict before you apply, and keep a backup one click away.

### Shape the history

Clean up a branch by hand in the **Commits** section. Drag a commit to move it, drop it onto another to fold it in, or rename or remove it, and a panel shows what the branch becomes before you press **Apply**. Commits not yet on the online copy are marked **Not pushed**.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/history-rewrite-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/history-rewrite-light.webp" alt="The Commits section for payments-api hl/ledger-export: seven commits of your own listed Now, with fold and combine controls (Keep title, Keep both, Separate) and a Start from today's main button, next to the four commits the branch becomes After Apply, with a color legend underneath">
</picture>

<sub>Screenshot from Goodboy 0.13.1</sub>

### Safe apply

**Apply here only** and **Apply and update online** try the whole plan on a temporary copy first and check the result before your branch moves. A backup is saved before anything changes. If a step stops, it says which one and why, and your branch stays as it was.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/history-trial-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/history-trial-light.webp" alt="Planned changes, 5 changes turning 7 commits into 4, with the notice Trying your changes on a temporary copy, Your branch is untouched until this finishes, and a progress bar at Step 3 of 7, Add retries to the export job, above the Apply here only and Apply and update online buttons">
</picture>

<sub>Screenshot from Goodboy 0.13.1</sub>

### Conflict prediction

While you edit the plan, Goodboy tries it in memory and marks each change that may conflict, naming the file. Your checkout is not touched.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/history-conflicts-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/history-conflicts-light.webp" alt="Planned changes with four changes marked may conflict, and the warning 4 changes do not replay cleanly: webhook.ts is changed by more than one commit, with a Rewrite with an agent button">
</picture>

<sub>Screenshot from Goodboy 0.13.1</sub>

### Conflicts merged in a copy

When a step stops on a conflict, the notice names the step and the file, and your branch is untouched. **Rewrite with an agent** lets the History rewriter merge the conflict in a copy, and Goodboy checks the result before anything moves.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/history-stopped-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/history-stopped-light.webp" alt="The notice Nothing was changed: a step does not replay cleanly, Step 3 of 7, Add retries to the export job, conflicts in webhook.ts, Your branch is exactly as it was, with Rewrite with an agent and Dismiss buttons above the list of five planned changes">
</picture>

<sub>Screenshot from Goodboy 0.13.1</sub>

### Push with lease and restore

**Apply and update online** replaces the online branch only when nothing newer is there, so a teammate's push is never overwritten. The result says how many commits became how many. **Restore it** takes the old history back, and the backup stays for 30 days.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/history-result-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/history-result-light.webp" alt="History rewritten, 7 commits became 4, listing the five changes made, Online copy updated with a safe force push and PR #214 shows the new version, a backup of hl/ledger-export with Copy ref, and the Restore it and Done buttons">
</picture>

<sub>Screenshot from Goodboy 0.13.1</sub>

### Backups

Choose **Backups** in the `⋯` menu to see the older histories of the branch. **Restore previous history** puts one back and keeps the history you leave as a new backup.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/history-backups-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/history-backups-light.webp" alt="The Commits section for payments-api hl/fix-duplicate-credit with the Backups panel open, one backup, Dedupe webhook retries in the handler from 1d ago, and a Restore previous history button">
</picture>

<sub>Screenshot from Goodboy 0.13.1</sub>

### Suggest a message

Get a commit message drafted for a squash or a reword. Scribe writes it in place, and you can edit it before you apply.

### Bring them into the plan

If someone pushed after you applied, Goodboy lists their new commits and offers to add them to the plan and push again.

### Rebase on main

**Rebase on main** moves the branch onto the latest main and calls an agent only on a conflict. If your uncommitted files are in the way, Goodboy asks once to set them aside and brings them back after the move. A banner under the Branch header follows the rebase and offers the next step if it stops.

### After a pull request merges

Decide what happens to a merged branch: **Ask first**, **Delete on this Mac** or **Also on origin**, per workspace or project, with 14 days to restore it. A branch with later commits, uncommitted changes, or one Goodboy did not create is left alone.
