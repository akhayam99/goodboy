# Storage

Free disk space and clean up branches, with what is safe to remove spelled out. Goodboy tells you why each folder or branch exists and what removing it costs, so you can clear space without guessing. **Transcripts and app data** at the foot of the page covers the rest, with one **Saved versions** row for the files agents changed in your folders. Those versions go by themselves 30 days after each session ends.

### Worktree folders

Free disk space from the checkout folders of archived, deleted or gone sessions. **Worktrees** lists each with its size and a check glyph when it is safe to remove (the reason is in its tooltip); **Remove** for one folder sits in its **⋯**, and **Remove 3 safe folders in Harborline** clears them together. Folders with changes, running agents or a process inside are skipped, with the reason. The verdict comes from Rust, the same checks the removal runs, so the page only reads it. Goodboy proposes and never removes by itself: nothing goes until you click, and a notice after a removal names what it freed. A clean folder with a terminal open in it, or in one of its subfolders, reads **A terminal is open here**, leaves the safe list and the bulk button, and offers **Close terminals**, which names each terminal and asks first (the same test the removal uses; an exited shell no longer holds a folder). **Undo** on the notice puts every folder it removed back on its branch, with the commits the branch kept, and puts the session's mount row back for an archived session; it never overwrites a folder that is already there, says which folder could not come back and why, and offers **Retry** for those. Ignored files such as `node_modules` are not restored.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/storage-worktrees-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/storage-worktrees-light.webp" alt="Settings › App › Storage: 5.1 GB on this Mac under the title, the Worktrees section with the filters To review, In use and Kept, and the table with hl/flaky-retry-test 2.5 GB and hl/retire-export-cron 1.8 GB in ledger-core and hl/receipt-email-retry 700 MB in notify-relay, each marked safe to remove, and the button Remove 3 safe folders · 5.0 GB">
</picture>

<sub>Screenshot from Goodboy 0.27.1</sub>

### Branches

Delete old branches with confidence. **Branches**, in the settings of a workspace, starts with the **After merge** rule, then lists the branches that are **Safe to delete** and shows how each was merged. Rust decides which branches are safe; the page only maps it to a label. Deleted branches wait in **Recently deleted** with **Restore**, and a merged branch can be removed with **Undo**.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/storage-branches-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/storage-branches-light.webp" alt="Settings › Harborline › Branches: the After merge rule first, 7 safe to delete and 2 need a look under the title, local branches grouped by repo under ledger-core, notify-relay and payments-api, each with its session, On origin or Gone on origin, and Safe to delete with how it merged, and Recently deleted 3 at the end">
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

## Under the hood

This part is for contributors and agents who change the feature.

- Folder verdict: `folder_verdict` in `apps/desktop/src-tauri/src/worktree/remove.rs`, sent as `verdict` by `worktree_folder_facts`.
- Open terminals: `terminalsInFolder` is the test the removal uses.
- Undo of a removal: `worktree_folder_restore`.
- Branch verdict: `is_safe_to_delete` on each scanned branch.
