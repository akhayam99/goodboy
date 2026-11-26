# The Commits tab

> **Read this when** you change the Commits tab of the Branch page: the graph, a live edit, Undo and Redo, backups and previous versions, Rebase on main or the history rewriter's copy. **Not for** the rebase banner and stop panel on every tab ([branch-push.md](branch-push.md#the-banners)) or Rebase all on the Projects card ([projects-card.md](projects-card.md#rebase-all)).

The Commits tab is where the branch is rewritten. There is no Rewrite history page:
the old history address, the palette verb and Activity history rows land on
`branch/commits`. A stored `diff` target with `page: 'history'` opens it too.

## The graph

The tab draws the branch as a graph (`history_graph`): a grey main trunk, your
branch leaving it at the real fork point, one row per commit newest first, and the
base row at the fork.

- There is no row of fact chips over it: the graph already says how many commits
  are yours, how far main moved and what is online.
- At rest the section is one column (`grid-cols-1`) on a 72px lane (trunk at x 20,
  lane at x 52). It fills the page column at every width.
- One row per commit: the title, then sha, author and age in `text-meta`, a faint
  `Not pushed` chip only on a commit that is not on origin, and the grip, a faint
  mark of a row that drags.
- Each row's `...` menu lives in a fixed cell that shows on hover and focus
  (`row-actions`, `HistoryRowActions`). Move up, Move down and Copy subject stay on
  the right click, since the drag handle moves a commit.
- The page header has one `?` button (`HistoryKeysHint`, an anchored popover) with
  `How to edit commits` (the Guide chapter Commits) and the keys of the focused row
  (`useHistoryKeys/historyKeys.ts`); no teaching line sits under the list.
- Merged and Closed make the page read only: Commits shows its list without editing
  or Rebase.

### Editing

The graph shows the live branch. There is no preview column, saved edit plan or
Apply step. The registry verb for `mount.rewriteHistory` and `diff.rewriteHistory`
reads `Edit commits`.

- Drag a row between two others to move it, or onto another to fixup into it.
- Focused-row keys: Alt with arrows to move, C for Fixup down, S for Squash down, R
  or Enter to reword, Delete or Backspace to drop.
- Row titles and accessible names read the refreshed commits after each successful
  edit.
- The graph updates immediately when a commit is moved, folded, renamed or
  removed. Removing a commit acts at once with Undo.
- Undo and Redo icon buttons sit in the Commits header. The same actions use ⌘Z and
  ⌘⇧Z while the page is open; text fields keep their own undo. Leaving the page
  clears the edit stack but keeps its backup refs.
- The existing Force push action updates the online branch separately. While the
  branch is behind its base, `Rebase on main` takes the secondary slot and Force
  push moves to `Branch actions`.

## A live edit

Each live edit takes the shown mount, branch, worktree and expected head
(`changeLiveHistory`).

1. The Git command (`history_live_edit`) holds a writer lease across replay and
   branch movement.
2. It saves a backup before replay.
3. It checks the result on a temporary copy.

- An agent reservation blocks inline, and a busy row disables further edits without
  a queue.
- A conflict leaves the branch, index and files unchanged, names the error inline
  and offers Rewrite with an agent or Undo to dismiss the failed edit.
- Dirty files use the stash consent and recovery flow.
- Undo and Redo restore a backup with an expected head check; failures retain the
  stack and the captured retry target.
- None of these operations pushes to GitHub, GitLab or Bitbucket.

### The guarded move

- The move refuses to overwrite local or untracked work. Files move with a two-way
  read-tree, then the branch ref moves with compare-and-swap.
- Undo and Redo use the same guarded move, writing a reciprocal backup first.
- A changed branch or head stops the operation.
- Resolve-thread commit references follow successful edits and return with Undo and
  Redo. A failed metadata update leaves the recovery refs available and shows an
  error.
- Empty commits stay; only removed or folded commits disappear. Commits before the
  first edit keep their shas.

## Backups

Every move leaves a backup under `refs/goodboy/backup/`, in a namespace made from
the full branch name.

- Live edits, Undo and Redo keep their backups for 30 days; they do not count
  toward the retained-backup cap.
- Restoring an older version uses the retained policy: the newest 20 per branch are
  kept, and an older one is dropped only while another retained ref contains its
  commit. The newest backup is never pruned.
- Older backups from the former naming remain read-only.

### Previous versions

`Previous versions n` is a fold row under the graph with its count at the end
(`HistoryVersionsLink`); it and `Previous versions…` in the page menu open the
`Previous versions` drawer (kind `history-versions`, side tier).

- Each version shows when, why (`Before a rebase`, `Before a fixup, squash or
drop`, `Before a reword or edit`, worked out by `history_backup_facts`), the
  commit count, the difference with now and an expandable commit list.
- `Reset branch to this version` (danger, anchored confirm) moves the branch back,
  and the drawer offers `Undo` right after.

## Rebase on main

`Rebase on main` replays the branch on origin with the history engine and runs no
agent.

1. The engine first predicts the replay in memory. When it conflicts, the button
   reads `Rebase on main · N conflicts`.
2. A clean rebase moves the branch only after the engine checks the result, with a
   backup ref and a push with lease.
3. A conflict stops the rebase with the branch as it was and asks in the panel
   (`RebaseConflictPrompt` inside `RebaseStopPanel`). No agent starts by itself:
   - **Resolve with the Lead**;
   - **Resolve in terminal** (`resolveRebaseMyself`: `worktree_start_rebase` in the
     worktree, then the terminal; `worktree_rebase_conflicts` reads each file's
     markers and `worktree_continue_rebase` finishes it);
   - **Abort rebase** (`keepRebaseStop`: it records `history_restored` with
     `reason: 'kept'`, which settles the stop in every window, and only then drops
     the run; a failed save changes nothing and offers Retry).

### The base row

**The base row** (`HistoryBaseRow`) only says where the branch starts: `Based on
main 9d4b1f7`, the merge base subject and its age.

- The rebase lives in the Commits head (`HistoryRebaseHead`), a split: `Rebase on
main` while the branch is behind, and a chevron listbox of the repository's
  branches (`Rebase on another branch`) that retargets the button to `Rebase on
<branch>`.
- The button asks in a `ConfirmPopover` anchored to it and runs the rebase command
  (`rebaseBranch`, with `ontoBranch` for another base) with a version of the current
  history kept.
- The Activity rebase suggestion (`Open rebase`) opens this page on the mount it
  names, scrolled to the base row with the head button focused
  (`HISTORY_FOCUS_BASE_EVENT`).

## The history rewriter's copy

The rewriter works on a temporary copy of the branch.

- Its writable directories are its copy, that copy's own git admin folder, the
  object store and the packed-refs lock file git takes when it clears a rebase
  marker.
- They confine it only under an OS sandbox or permission check (Codex in
  `workspace-write`, Claude outside `bypassPermissions`). In `bypassPermissions`,
  the default, the kickoff's rules are what keep it inside the copy. Codex rewriter
  turns also lose write access to the temp folders.
- Each copy lives in a folder Goodboy reserves atomically under
  `~/.goodboy/history-copies`, never in a temp folder a sandboxed agent can write,
  with an owner file and a lock it holds while the copy is in use. Nothing deletes a
  copy without both, so a second window never removes a copy in use.
- The owner file records the copy's git admin folder when the copy is made. The
  rewriter's roots and the cleanup use it only while it is
  `<common>/worktrees/<name>` and its `gitdir` names exactly that reserved copy,
  never the copy's own `.git`.
- Temporary copies left by a crash are removed when the app starts.
