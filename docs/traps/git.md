# Traps in git reads, pushes and branches

> **Read this when** you change how Goodboy reads a branch, counts commits,
> pushes, rebases or moves uncommitted work. **Not for** pull requests and
> review comments ([review.md](review.md)) or the history rewriter's design
> ([../architecture.md](../architecture.md)).

## Reading the repository

### Git error text is read in English

`worktree::foreign` tests and the origin fetch behind them read git's error text, which a non-English locale translates. The fetch runs with `LC_ALL=C` (`git_english`), and a test that shells out to git for such text does the same.

### The ignore probe is a path inside the folder

`check-ignore -v --no-index` on a bare `.goodboy` answers "not ignored" for a directory-only rule (`.goodboy/`) while the folder does not exist, because git cannot tell the probe is a directory. `.goodboy/worktrees/probe` answers correctly either way. `repo.rs::IGNORE_PROBE_PATHS` and `goodboy_ignore.rs` use only that form.

### A landed branch reads as clean

`changed_files.rs` diffs the worktree against the merge-base so a push does not shrink the count. Once the base carries every file the branch touched, it diffs against `HEAD` and only uncommitted work counts: a squash or rebase rewrites commits, so ancestry says nothing.

- The numstat lines mirror git's, with `-` for binary files and a synthesised line for an untracked one.
- Every list is read with `-z`, so a non-ASCII name stays as it is.
- An untracked file over 1 MiB is not read (its line is `-\t-`).
- A git failure is an error, never "no changes".

### A push count never reads `@{upstream}`

A branch cut from a remote-tracking ref (`worktree add -b <b> <path> origin/main`) tracks it under git's default `branch.autoSetupMerge`, and `git push origin <b>` does not move it. So `@{u}..HEAD` and the `branch.ab` line of `git status` count the branch against main forever; a suggestion once kept asking to push 8 commits already on origin.

`branch_remote::branch_remote` compares HEAD with `<remote>/<branch>` and is the one reader for `worktree_status`, `worktree_commits` (`pushed`) and `project_git_status`; `upstream` is that ref or null. New branches are cut `--no-track` and the in-app push passes `--set-upstream`, but old branches still track main, so never go back to `@{u}`.

### A commit list and its count share one base

`worktree_status` (`mainDistance`) and `worktree_commits` take the mount's resolved base branch, and a caller that holds it passes it to `listBranchCommits` (`useSessionDiff`, `loadHistoryDraft`, `collectReportDiffEvidence`). Without it Rust uses the repository default and the numbers disagree.

### The background repo check never prunes

`worktree/base_divergence.rs` fetches with `--no-prune`, because a user's `fetch.prune=true` would let a check that runs every few minutes delete remote-tracking branches. Scenes stay quiet because `quietSceneRepoCheck` replaces `checkRepoDivergence` in the scene host.

### An empty repository has no `origin/HEAD` after its first push

Then `worktree_repo_default_base_branch` returns nothing and the base branch picker is empty. The publish and the probe run `remote set-head origin <branch>` after the push.

## Branches and pushes

### A new branch is cut from `origin/<base>`

`worktree/create.rs` prefers the remote base, so a stale local `main` never leaks commits, then `origin/master` when the base is `main` and only `master` exists, then the local branch. "origin has no such branch" and "origin could not be reached" are told apart: only the first lets a caller cut the branch itself, because an outage that silently became a fresh branch would diverge from the real one.

### There is one push verb

`pushBranch({ sessionId, mountId, mode })` (github slice) is the only push; a caller never calls `gitPush` or `pushWithLease`. `plain` pushes. `lease` force pushes with lease behind a `confirmed` guard (the commits the confirm listed, re-read from origin) or an `expected` guard (the remote sha the caller saw: the history family, Auto and restore).

A lease push on a mount whose history run waits for its push (`applied`, or `stopped` on `push-failed` or `origin-moved`) also settles that run through `settleHistoryPush`: run `pushed`, the plan, the edited replies, the `history_pushed` event and the pull request description. So every Push leaves the same trace. The result carries `reason: 'moved' | 'failed'` (`moved` is a stale lease), and `mount.push` and `diff.push` are one definition, `pushAction`.

### Sync and retry never starts the history rewriter

`syncBranchWithRemote` has no Rust command. It calls `history_rebase_plan` with the branch as its own base, which fetches `origin/<branch>` and plans the rebase of the unpushed commits, then replays the plan in a copy. A conflict discards the copy and stops; it never starts the rewriter like `rebaseBranch`, because the screen promises nothing is touched.

A failed push counts as "remote moved" only when it matches `isRemoteMovedError`. `verifiedPush` builds its two messages through the same module, so rewording them elsewhere turns the button off.

### Stopped rebase verbs come from one factory

Start new Lead, Resolve in terminal, Abort rebase, Rebase on their commits, Undo rebase, Retry rebase, Fix with an agent and Retry push are built by `rebaseStopVerbs`, called by `useJobBannerActions` (banner and panel) and `useActionCardActions` (Next rows). A new surface calls the factory; a rebuilt verb drops the start hint or the `adoptRebaseStop` step.

### A rebase stop never leaves the worktree mid-rebase

`rebaseBranch` replays on a copy, so a conflict leaves no rebase in progress and no unmerged file, and "no rebase in progress" cannot settle a stale `Conflict`. `isRebaseStopSettled` also needs the head to have moved past the recorded one (`HistoryStop.head`, `rebaseConflict.head`, the `head` payload of `history_stopped`), or with no record, the branch level with its base. `settleStaleRebases` trusts only a git read started after the record (`readWorktreeStatusRead().readAt`).

A mock scene that seeds a conflict run gives it the same head as its worktree status, or the stop settles on mount. **Resolve in terminal** starts the rebase in the worktree on purpose and marks `rebaseConflict.isHere`, which `settleStaleRebases` leaves alone (like a run handed to Auto), so **Push** stays offered after `git rebase --continue`.

### Rebase all has one source for per-branch state

The batch in the store (`rebaseAllRuns`, read through `rebaseAllBranchOf`) feeds the row chip (`branchRowChipOf`) and the card header (`rebaseAllSummaryOf`); keep no second list. A `rebased` row draws no behind chip even on a stale git status, which is why the chip reads the batch first. A late answer lands by run id and `patchRun` drops it when the run was cleared or replaced. Abort lets the branch in flight finish and marks the queued ones skipped.

## Moving uncommitted work

### Uncommitted work never moves with `git clean` or `git stash`

Nor with a copy and a blanket delete. The bootstrap move records the folder with a temporary index (`Git::index_file`, the only repo env that survives the launcher), verifies the copy by hash and clears exact paths whose content still matches. Ignored files stay.

### History stashes are shared across worktrees

`refs/stash` lives in the common directory, so another worktree or a terminal may push or drop entries during a rewrite. History applies its exact stash SHA after checking its unique message, never pops, and never writes `refs/stash` or its reflog by hand. `drop_own_stash` finds the index by SHA, drops it and checks the SHA git printed; if the slot shifted, it puts the dropped entry back with `git stash store`. Ambiguous entries are kept.

Ignored files are checked against both HEAD and the target: stash push's cleanup can overwrite a directory HEAD tracks as a file, even on an untouched path. `overlap_for_repo` in `history/dirty.rs` honors `core.ignorecase`.

If the entry disappears before verification, `find_stash` searches commit objects for the message and checks the stash parents against the captured HEAD. `move_branch_with` protects the verified commit in `refs/goodboy/stash/<sha>`; discovery before that ref exists cannot survive immediate object pruning. `prune_guards` removes guards older than 14 days (by stash commit date) on the next job, never one a journal names.

- A `stash pending` intent with no stash (the push failed on `index.lock`, or the app died) is rolled back by `roll_back_intent`, which removes the backup ref and the journal; `pending_stash` reads "pending, nothing found" as none.
- The journal's seventh line is `restoring` during a restore and cleared on a conflict or failure, so it survives only a crash between applying and recording `restored`. `bring_back` then asks `is_restored` (no unmerged paths, untracked files byte-equal to the stash, a stash path changed) and finishes instead of applying twice.
- **Done, forget it** (`forget_saved`) clears the journal and keeps the guard ref. A stash whose object is gone is clearable, never an error.

The writer lease covers cooperating Goodboy writers, not an editor writing during git's capture and reset; it is not a filesystem lock. A cleanup failure keeps the stash rather than restoring again.

## Dependencies and push fixes

### An install never goes through a link

`worktree_deps_unlink` removes a symlinked install folder (`node_modules`, `vendor` or nested) only when it resolves outside the worktree, and only the link: a package manager would write through it into the other checkout. `worktree_deps_check` and `worktree_deps_unlink` take the repository path too and refuse a folder the repository does not list as a worktree. Nothing else is touched, and nothing is deleted before **Reinstall dependencies**.

### A push fix outlives its card

A **Fix with an agent** card can unmount or reload while the agent works, so `branchPushFixes` and `pushFixOutcomes` hold the fix in the store, and `pushFixMemory` writes both to browser storage. A fix whose agent is gone, deleted or finished is not working (`pushFixStateOf`), so a crash never leaves a branch on Fixing. The result is kept six hours, and a new fix on the branch clears it.
