# Mounts

> **Read this when** changing where a session writes on disk, how a mount is
> attached, removed or recovered, or what the mount operation log records.
> **Not for** the product meaning of a session or project
> ([concepts.md](concepts.md)) or the migration rules
> ([architecture.md](architecture.md)).

Owns the on-disk layout of session mounts, the mount lifecycle, the operation
log and recovery. Code lives in `apps/desktop/src/store/slices/project-mounts/`
and `apps/desktop/src/store/slices/mount-cleanup/`.

## Where a session writes

- Before any mount, a turn runs in `~/.goodboy/scratch/<session-id>`. The
  directory is created by the first turn that needs it and removed when the
  session is deleted.
- A repository mount is a git worktree at
  `<repo>/.goodboy/worktrees/<session-slug>-<mount-id>`, truncated to a fixed
  length. The local branch outlives the worktree.
- A folder mount is a plain directory at `<project-root>/sessions/<name>`.
  Folder projects always keep their directory; no Goodboy action deletes it.

## Rows and disk

`session_worktrees` is the mount table. The row id is the mount identity; a
project id names the repository that owns the mount, never one checkout. Each
row owns its current branch, nullable current path, last path, attachment,
disk observation and a revision. Every lifecycle write is a compare-and-set on
that revision, so a write that loses a race reports it instead of overwriting.

Pull request ownership lives in `mount_pr_links`, independently of the
branch-keyed provider caches, so a switch can clear the current provider
projection without deleting request history. `pr_series` and
`pr_series_members` store explicit grouping and order; they never infer a
stack from commits.

Hydration and archive restoration inspect every stored repository worktree
before projecting it as writable. Disk states:

- `present`: the worktree was seen registered.
- `missing`: git reported the path gone. The row detaches and keeps the last
  path.
- `removed`: a Goodboy action removed the directory.
- `unchecked`: the repository could not be read (unplugged volume, git
  error). The mount renders unavailable but is never treated as gone, so
  cleanup cannot mistake an unmounted drive for a deleted worktree.

## Lifecycle

- **Attach** creates or adopts a worktree and inserts the row.
- **Switch** changes the branch of one mount in place.
- **Fork** creates another mount from an explicit base and leaves the source
  intact.
- **Unmount** removes the worktree and keeps the row with no current path.
- **Remove** removes the worktree of a mount whose work is complete, from its
  row or, for archived sessions, from storage settings, and keeps the row.
- **Detach** takes a project out of the session: every mount of that project
  is cleaned up per the chosen disposition and its row deleted. Each mount is
  its own removal; one that fails is reported with its reason, the rest still
  detach, and the write destination is always handed over afterwards.
- **Forget** deletes the row of a mount that is already off disk or kept on
  purpose; it never touches the directory.

Removal always goes through the checked Rust removal boundary: safe mode
refuses dirty work, locks and open users, and local branches are preserved.
Every mutation of one mount holds the repository lock, then the mount lock,
so two operations on one repository never interleave.

## Operation log

`mount_operations` records filesystem and provider mutations under a
caller-owned request id, before the external action runs. Statuses: `pending`
(a cleanup proposal waiting for the user), `running`, `succeeded`, `failed`,
and `uncertain` (the external action may have happened but the row write did
not land). A retried request whose operation `succeeded` reuses its result,
which makes retry idempotent across the observable interruption points. It
cannot infer a request that was never recorded.

Every directory removal outside unmount runs through `runMountRemoval` as a
`remove` operation: it is logged `running` before the disk is touched, with
the mount id, path, whether the directory was meant to stay, and how the row
finishes (`clear-path` keeps the row without a path, `drop-row` deletes it).
A cleanup that fails closes the operation `failed` with the row untouched; a
row write that throws or loses its revision leaves it `uncertain`. A cleanup
proposal is also a `remove` operation, but it only ever sits in `pending`,
which is what keeps the two apart.

## Recovery

Loading a session's mounts runs recovery once per session. Recovery reads
every unsettled operation and finishes the database step when the disk
already reached the target: a forked worktree that exists gets its row, an
unmounted worktree that is gone gets its row cleared. An operation whose
repository cannot be read stays `uncertain`.

A `remove` operation is finished from its recorded input, never from a live
closure: a row that is already gone closes it; a path git reports missing gets
the recorded finish applied (a `drop-row` settles the mount's cleanup
proposals before deleting the row, since the proposal's mount link is cleared
on delete); a directory that was meant to stay lets a `drop-row` delete the
row; any other directory still there closes the operation `failed` and stays
on disk for the user to retry. Recovery never deletes a directory.

## Cleanup proposals

When a lifecycle step must continue but a directory cannot go (dirty, locked,
in use), cleanup records a `pending` proposal instead of deleting. The user
resolves it inline: remove runs a normal unmount, keep settles it. Paths that
outlive their row move to `retained_worktree_paths` and are probed later;
anything a worktree scan finds that no row, retained path or unsettled
operation owns is reported as an orphan.

## Rendered view is not the row

`verifyMountViews` patches the rendered view (unavailable, detached) without
writing the row when git cannot confirm a worktree. A guard on an action the
UI offers reads the rendered view, not a fresh DB row; otherwise it refuses an
action the user can see, or allows one on a mount the user sees as gone.
