# Storage

Free disk space and clean up branches, with what is safe to remove spelled out. Goodboy tells you why each folder or branch exists and what removing it costs, so you can clear space without guessing.

### Worktree folders

Free disk space from the checkout folders of archived, deleted or gone sessions. **Worktrees** lists each with its size and a check glyph when it is safe to remove (the reason is in its tooltip); **Remove** for one folder sits in its **⋯**, and **Remove 3 safe folders in Harborline** clears them together. Folders with changes, running agents or a process inside are skipped, with the reason.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/storage-worktrees-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/storage-worktrees-light.webp" alt="Settings, App, Storage: 5.1 GB with 5.0 GB that can go, the Can go, Review first and Keep bars, and the Worktrees table with hl/flaky-retry-test 2.5 GB and hl/retire-export-cron 1.8 GB in ledger-core and hl/receipt-email-retry 700 MB in notify-relay, each marked safe to remove, and the button Remove 3 safe folders in Harborline">
</picture>

<sub>Screenshot from Goodboy 0.27.1</sub>

### Branches

Delete old branches with confidence. **Branches**, under App settings, opens on the ones that are **Safe to delete** and shows how each was merged. Deleted branches wait in **Recently deleted** with **Restore**, and a merged branch can be removed with **Undo**.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/storage-branches-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/storage-branches-light.webp" alt="Settings, App, Branches: the line that Goodboy deletes the branch on this Mac after a pull request merges, Recently deleted 3, 7 safe to delete and 2 need a look, local branches grouped by repo under ledger-core, notify-relay and payments-api, each with its session, On origin or Gone on origin, and Safe to delete with how it merged">
</picture>

<sub>Screenshot from Goodboy 0.27.1</sub>

### Storage scope

Clean up this workspace, other workspaces, removed ones or all of them, from the picker in the page header. Bulk actions name the scope they act on.

### Artifacts from deleted sessions

Decide what to keep from sessions you deleted: their plans, reports and wireframes, with **Keep** or **Delete**.

### Goodboy can free N GB

Hear about reclaimable space once, when idle safe folders pass 10 GB or the disk runs low. After a notice it waits 14 days and another 10 GB before speaking again.

### Other tools

See how much space the other coding tools keep, without risking their history. **Other tools** at the foot of **Storage** lists Claude Code, Codex and Cursor with their size and how much comes from Goodboy sessions. It is read only, and Goodboy measures sizes and names, never the files inside.
