# Storage

Free disk space and clean up branches, with what is safe to remove spelled out.

### Worktree folders

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/storage-worktrees-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/storage-worktrees-light.webp" alt="Storage, Worktrees 5.0 GB, with the tabs To review 3, In use 0 and Kept 0: hl/flaky-retry-test 2.5 GB and hl/retire-export-cron 1.8 GB in ledger-core, hl/receipt-email-retry 700 MB in notify-relay, each marked Safe to remove, and the button Remove 3 safe folders in Harborline, 5.0 GB">
</picture>

Free disk space without guessing. **Worktrees** lists the checkout folders of archived, deleted or gone sessions by repo, with their size, when each last changed, why it exists and whether it is safe to remove. **Remove 3 safe folders in Harborline** clears them together, and it takes only clean folders idle for over 30 days. Folders with changes, running agents or a git operation in progress are skipped, with the reason.

### Branches

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/storage-branches-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/storage-branches-light.webp" alt="Clean up branches: 9 local branches with the tabs Safe to delete 7, Needs a look 2 and All 9, grouped by repo under ledger-core, notify-relay and payments-api, each with its session, On origin or Gone on origin, and Safe to delete merged by merge commit, rebase or pull request, plus the button Select 7 safe to delete">
</picture>

Delete old branches with confidence. Local branches are sorted into **Safe to delete** and **Needs a look**, each with its session, whether it still exists on origin and how it was merged: merge commit, rebase or pull request. **Select 7 safe to delete** picks them together, a row checkbox picks one, and the selection bar floats with the count, **Select all** and **Delete**, which confirms above the bar. Every deletion can be restored for 14 days.

### Storage scope

Clean up this workspace, other workspaces, removed ones or all of them, each with its weight, from the picker in the page header. Bulk actions name the scope they act on. The page reads as two groups: **Free up space** and **Clean up branches**.

### Free space chip

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/storage-free-space-chip-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/storage-free-space-chip-light.webp" width="680" alt="The top bar with the Free 4 GB chip hovered: Goodboy can free 4.1 GB of worktree folders nobody uses. Open storage. Beside it are 2 need you, 2 running and $9.62 today">
</picture>

See reclaimable space at a glance. While at least 1 GB of worktree folders can go, the top bar shows **Free 4 GB**. Hover it for the exact size, 4.1 GB here, and click to open Storage across all workspaces.

### Artifacts from deleted sessions

Decide what to keep from sessions you deleted: their plans, reports and wireframes, with **Keep** or **Delete**.

### Goodboy can free N GB

Hear about reclaimable space once, when idle safe folders pass 10 GB or the disk runs low. After a notice it waits 14 days and another 10 GB before speaking again.
