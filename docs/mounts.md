# Mounts

> **Read this when** changing where a session writes on disk, how a mount is
> attached, removed or recovered, what the mount operation log records, or
> what a bridge mount verb does.
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
  path; when that write loses a revision race, the rendered view still says
  `missing`, because git's answer does not depend on the row.
- `removed`: a Goodboy action removed the directory.
- `unchecked`: the repository could not be read (unplugged volume, git
  error), and only then. The mount renders unavailable but is never treated
  as gone, so cleanup cannot mistake an unmounted drive for a deleted
  worktree.

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

Loading a session's mounts runs recovery once per session, and again on the
next load after any operation turns `uncertain` (marking one re-arms the
session; recovery's own `uncertain` marks do not, so an unreadable repository
is not retried on every load). There are no timers. Each operation is handled
under its repository lock and re-read once the lock is held, so recovery never
touches an operation that is still in flight, and skips one that settled while
it waited. Recovery reads every unsettled operation and finishes the database
step when the disk
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
in use), cleanup records a `pending` proposal instead of deleting. Archiving a
session never deletes either: it proposes cleanup for every mount still on
disk. Deleting a directory is always a named user action (unmount, remove,
detach). The user resolves a proposal inline: remove runs a normal unmount,
keep settles it. Paths that
outlive their row move to `retained_worktree_paths` and are probed later;
anything a worktree scan finds that no row, retained path or unsettled
operation owns is reported as an orphan.

`retained_worktree_paths` is the ledger of every folder Goodboy no longer
uses. A row may have no session, mount or workspace: an orphan the scan found
is written with `reason = 'orphan'` and `first_seen_at` set to the first scan
that saw it, and deleting a workspace sets `workspace_id` to null instead of
dropping the row. The scan walks `worktree_roots`, the registry of every
repository where Goodboy created a worktree. A root is written for each repo
project, disconnected ones included, and by `createProjectMount`, `forkMount`
and `attachMount` before `createWorktree` runs, so a crash between the
folder and its row still leaves the root registered. The registry has no
foreign key, so a root outlives its project and its workspace. An orphan row
never blocks a mount or a retained transfer from taking its path: the owner
replaces it.

Removing an orphan only touches a direct child of `<repo>/.goodboy/worktrees/`.
A symlink, a nested path, a folder in any other worktree root and a clone of
another repository are refused. A folder git still registers goes through the
same checked removal as an unmount, so uncommitted work keeps it. So do
commits that no remote branch and no default branch contain. A folder git
no longer tracks cannot be checked for changes, so the bulk action keeps it
too. Either one is removed only after the user confirms that folder on its own.

## Driving mounts from an agent

A turn drives its mounts through the bridge's `mount` and `series` verbs and
the two request-create verbs. The transport, the refusal codes and the rule
that a mount is named, never guessed, are
[query-bridge.md](query-bridge.md#a-mount-is-named-never-guessed)'s. A spawned
turn already carries `GOODBOY_WORKSPACE_ID`, `GOODBOY_SESSION_ID`,
`GOODBOY_MOUNT_ID` and `GOODBOY_RUN_ID`; `--mount` addresses any other mount.

- **Read before writing.** `mount list` returns each mount's id, project,
  branch, base, path, attachment, disk state and revision. `mount inspect`
  adds the observed head, the removal safety with its blockers and, on
  request, the size. A turn checks that the head matches the mount before
  changing files, and that removal is safe before asking for it.
- **Fork keeps both lines of work.** The new branch is cut from the named
  base; the source mount, directory, branch and request links do not change.
  The answer asks for a new turn: the current one stops, and Goodboy queues
  one continuation turn bound to the new mount, told that uncommitted source
  files are absent so it cherry-picks what it needs.
- **Switch moves one line of work.** The mount keeps its id and path, and
  request links on the previous branch stay as history. `mount activate`
  changes only the mount the next turn uses; a running or queued git or
  provider action keeps the mount id and revision it captured when queued.
- **A mismatch is resolved by intent.** A raw checkout, switch or detached
  HEAD never rewrites stored ownership: inspection records the mismatch and
  mount-scoped writes refuse until `mount resolve` names an intent. `switch`
  adopts the observed branch on the existing mount; `fork` adopts it on the
  existing directory and creates a second mount for the recorded branch. An
  in-progress merge, rebase or cherry-pick is finished first.
- **Requests are created per mount.** Creation refreshes the provider first,
  so a retry after the remote accepted a request attaches the existing one
  instead of opening a duplicate. GitHub and GitLab requests open as drafts
  unless the turn asks for ready.
- **A series is declared, never inferred.** `series create` names the split
  and its size; `series set-member` places a mount at a position, or reserves
  a planned position when no mount is given. Generated request text carries
  a "Part of" line with the work item and the position, never a closing
  reference for the series.
- **Retry reuses the request id.** After a timeout the turn reads the
  operation back before acting again; recovery reconciles what the disk and
  the database reached.
- **Directories go through unmount.** An agent unmounts through the bridge
  instead of deleting a folder and gets back `removed`, `missing` or `kept`
  with a reason. Archive, delete, storage settings, merge cleanup, unmount and
  orphan cleanup share one refusal policy: a running agent, a bound terminal,
  a writer lease, a lock, a git operation in progress, or dirty tracked or
  untracked work. The local branch always survives, and `mount attach`
  recreates a worktree from it.
- **Request identity is verified, never guessed.** A request missing from the
  database is attached to a mount only after a provider lookup confirms its
  provider, host, repository, number and head branch. A branch name alone
  does not prove earlier intent.

## Rendered view is not the row

`verifyMountViews` patches the rendered view (unavailable, detached) without
writing the row when git cannot confirm a worktree. A guard on an action the
UI offers reads the rendered view, not a fresh DB row; otherwise it refuses an
action the user can see, or allows one on a mount the user sees as gone.

## Mount row

Every row of every project shares one grid (each project group and its list
are subgrids of it), so the columns line up down the whole section: branch,
series part, sync, diff, state, action, menu. A column no row fills takes no
width, and below a 36rem container the sync and diff cells empty out (the Changes lens still has the
diff). Every row action lives in the always visible row menu
(`MountActionsMenu`): start new turns here (only with two or more mounts),
terminal, scripts, editors, copy path, then close (unmount) or remove. A
closed row offers Reopen in its action cell. The terminal and scripts icons on the row are
hover accelerators, shown at rest only while something runs there; a hover
icon is never the only way to an action. Below a 28rem container the idle
accelerators take no room and New worktree shows its icon only. The project menu holds Detach
project and renders nothing when the project has no mount to detach.

With two or more mounts, a row shows its presence (`MountPresence`): the
state node of each agent whose turn runs, waits on an answer or needs you in
that mount, at most three, then a count. A node opens that agent. There is no
badge for the mount new turns start in; the chat header owns that choice.

The branch chip is the branch control: on a mounted repo row the whole chip
opens the branch switcher, whose header copies the branch name. Where the
branch cannot switch (unmounted rows, folder projects) the chip copies the
name. Copy feedback is the check icon, never a toast.
