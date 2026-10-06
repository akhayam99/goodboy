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
- Branch and directory names come from one slug rule: ASCII letters and digits,
  everything else becomes a dash, at most 48 characters, and a short hash when
  nothing is left. `slugify` in `@goodboy/core` and `slugify` in `worktree/slug.rs`
  give the same result for the same input.
- The branch name comes from one builder, `buildBranchName` in `@goodboy/core`,
  and the workspace template (Settings > Workspace > New sessions > Branch
  name). The default is `{prefix}/{task-id}-{slug}`, the shape from before 0.16.0
  without the session id at the end. The placeholders are `{prefix}`,
  `{task-id}`, `{slug}` and `{user}` (the GitHub login). A placeholder with no
  value disappears with the separator next to it, so a session without a task
  gets `<prefix>/<slug>`. The task id only enters when the session starts from a
  task: a task linked later never renames the branch. The prefix may hold `/`
  (`team/ak`); the worktree folder stays flat because `/` becomes `-`.
- A name an agent or the New worktree form asks for goes through the same
  prefix (project, then workspace, then the default). A name that already
  starts with `<prefix>/` stays as it is, `feat/x` becomes `<prefix>/feat-x`
  and a bare `x` becomes `<prefix>/x` (`prefixedBranchName` in
  `resolveMountNaming.ts`). A branch adopted with `existing` keeps its name;
  only when it is not there does the fork cut a new branch, under the prefix.
- When another live session, or the repository itself, already owns the name,
  the plan takes `-2`, `-3` and so on. An adopted branch is never renamed. The
  frontend sends the full name; `worktree_create` and `bootstrap_prepare` check
  it with `branch_name_problem` (`worktree/branch_name.rs`), the same table
  `isValidBranchName` in `@goodboy/core` is tested against
  (`branch-name.fixture.json`), so a name the ref rules refuse fails before
  anything is created.
- A folder mount is a plain directory at `<project-root>/sessions/<name>`.
  Folder projects always keep their directory; no Goodboy action deletes it.

## The first lap and the bootstrap move

A project made from the empty screen starts in its **first lap**. The phase is
one settings row per project (`bootstrap.phase.<project-id>`: `first-lap`,
`moving`, `done`), never a column, and it only moves forward. While it is
`first-lap`:

- One session, the first lap session, writes directly in the project folder
  on `main`. Its turns get a write destination of kind `root`
  (`writeDestination.ts`), and the scope guard says nothing is committed or
  pushed for it. There is no mount and no worktree.
- Files you attach to its messages are written to the session's scratch
  folder (`scratch_dir_prepare`), never under the project folder, and the
  prompt names them by full path (`persistAttachments`, `attachmentDir`), so
  the bootstrap move never picks up an attachment as work.
- Every path that cuts a worktree for that project refuses with one typed
  message (`ensureProjectMounted`, `FIRST_LAP_REFUSAL`): the first-turn rule,
  the + project chip, workflow steps and the query bridge. Starting a session
  opens the first lap session instead of a draft.

Publishing pushes `main` with an upstream and sets `origin/HEAD`
(`project_publish_main`). `project_remote_probe` answers `no-remote`,
`unreachable`, `reachable-no-main` or `main-present` and never acts on a guess.
Once `main` is on the remote, the bootstrap move runs on one click. Uncommitted
work goes into a worktree session named `bootstrap` in this order, and the
project folder is untouched until the copy is verified:

1. A temporary index records the folder as one commit object (`refs/goodboy/bootstrap/<project>` keeps it).
2. A branch named by the workspace template with the slug `bootstrap` and no task (`<prefix>/bootstrap` by default) is cut from `origin/<default branch>` and nothing else changes.
3. A session named `bootstrap` adopts that branch, so its worktree is an ordinary mount.
4. The snapshot is applied in that worktree with a three-way pick and every listed path is hashed against the snapshot. A conflict or a mismatch undoes the session, the worktree and the branch.
5. The folder is cleared by exact paths whose content still matches the snapshot. A file edited since stays and is listed. `git clean` and `git stash` never run.
6. Local `main` is aligned only when it is still Goodboy's single `.gitignore` commit.

A crash leaves the phase at `moving`; the next start verifies the copy and
finishes, or undoes it. A second move is not possible: the phase ends at `done`.

## Hiding .goodboy from git

`goodboy_ignore_status` (`apps/desktop/src-tauri/src/goodboy_ignore.rs`) checks
whether git already ignores `.goodboy` before anything writes to it: it runs
`git check-ignore -v --no-index .goodboy/worktrees/probe`, never a bare
`.goodboy` probe, since a trailing-slash rule (`.goodboy/`) only matches a
probe path that is clearly inside the folder. The check classifies the hit as
the project's `.gitignore`, `.git/info/exclude`, or the user's global ignore
file, and the result is stored on `projects.goodboy_ignore` so a re-check on
every render is never needed. When nothing already ignores it,
`goodboy_ignore_apply` writes `/.goodboy/` to one of those three places, never
more than one at a time, and removes the `.git/info/exclude` entry when the
project switches to the project or global choice. Adopting a repository that
already has commits never touches its `.gitignore` (`repo.rs::adopt_repo`);
only a still-commit-less repo gets the bootstrap write, matching
`create_repo`.

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
- **Remove from session** takes a project out of the session: every mount of that project
  is cleaned up per the chosen disposition and its row deleted. Each mount is
  its own removal; one that fails is reported with its reason, the rest still
  go, and the write destination is always handed over afterwards.
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

A mount can also go `unavailable` because its project's whole folder moved,
not because the mount itself was touched. That is not a recovery case: the
fix is `Locate moved projects` (`features/workspace/components/
LocateMovedProjects/`), which rewrites the project's and its mounts' paths
and repairs git's worktree links; see
[architecture.md](architecture.md#moving-a-projects-folder). Once the
project's `root_path` is corrected, the next git status read clears the
mount's `disk_state` on its own.

## Base branch

Every call that compares a mount with its base passes one name: the mount's
own base, then its project's, then nothing. `resolveMountBaseBranch` and
`selectMountBaseBranch` make that choice, and no caller writes `main` itself.
With no name, Rust finds the repo default in one ordered list: `origin/HEAD`,
then `main`, `master` and `develop` (the remote copy first), then the branch
the main checkout sits on. A checkout never becomes its own base, whatever
the name, so a repo with no default at all stays unknown and branch cleanup keeps
what it cannot place. Creating a mount may cut from the main checkout branch.
The rebase plan and the history graph take the same optional name.

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
commits that no remote branch and no default branch contain, unless the caller
passes `allowLocalCommits`: the Storage page does, because the branch keeps
those commits, and its confirm says how many folders have them. A folder git
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
  Fork is also the only way an agent makes a branch or worktree for the
  session: it cuts the worktree under `<repo>/.goodboy/worktrees`, attaches it
  and answers with the mount id and path. Agents are told never to run
  `git worktree add` or `git checkout -b` for session work.
  `--existing` attaches a branch that already exists, checked out as it is and
  never renamed.
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
- **A stopped rebase says so under its row.** Only `rebase-merge/` or
  `rebase-apply/` count, as git reads them. The Projects block shows a
  `Rebase stopped` notice with `Hand it to an agent` (a `Rebase on <base>`
  agent on that mount finishes it), `Open terminal`, and `Abort rebase`
  behind an inline confirm (`worktree_abort_rebase`, which refuses when no
  rebase is stopped).
- **A row names its layers.** Each Projects row links the three code host
  layers by name: `PR #318` with its state opens the pull request, the diff
  stat (`useMountDiffStats`, read from `sessionWorktreeRecords`, which
  `applyMountViews` rewrites on every mount change, so a branch attached or
  forked while the session is open counts at once) opens the Diff,
  and `N to resolve` (only while review comments of
  that pull request wait) opens Review on them. `Rewrite history` sits in the
  row menu.
- **Merged rows move under `Show completed`.** A row is merged when its
  request merged, or when a pushed branch that tracks its own name has a
  clean tree and nothing past the base. A merged request whose branch moved
  past its `merged_head_sha` stays open instead and reads `Merged, then N
new commits` (`checkMergedThen`, one git check per tip, kept in
  `mergedThen` by mount).
- **Requests are created per mount.** Creation refreshes the provider first,
  so a retry after the remote accepted a request attaches the existing one
  instead of opening a duplicate. GitHub and GitLab requests open as drafts
  unless the turn asks for ready.
- **A row reads its request from `mountGithub`, and every git action refreshes
  it.** `refreshSessionPr` fills the entry per mount (`gh pr list --head
<branch>`). Creating, merging, closing, reopening, marking ready or draft
  and editing a request refresh it forced. So do a push (`pushSessionBranch`,
  which the header, the suggestion and the resolve push share, and which also
  re-reads that worktree's status so the ahead count drops at once), a history push
  (rebase or rewrite) and a branch switch on any mount. Changes made outside
  the app (an agent that ran `gh`, a terminal) are caught cheaply:
  `recheckSessionMounts` runs when an agent turn ends and when the window
  regains focus (`useSessionFocusRecheck`, debounced 400ms, current session
  only). It makes at most one refresh per mount, skips a mount that is loading
  or whose request merged or closed, and skips a mount fetched in the last 5s
  (turn end) or 60s (focus). `useGithubPolling` still sweeps on boot, on a
  branch change and every 5 minutes, but its timer and its visibility sweep
  skip mounts already fetched with no request, so only the recheck finds a PR
  opened outside the app. There is no faster global poll.
- **The push count re-reads with the request.** Every push surface (the
  suggestion, the branch word, the sync control, the Diff's `Push branch`,
  Rewrite history's on-origin commits) reads one state, `branchPushStateOf`
  over `worktree_status`, which compares HEAD with the branch's own
  `<remote>/<branch>` ref ([traps.md](./traps.md)). An in-app push or history
  push re-reads the worktree status at once (`refreshWorktreeStatuses`).
  `recheckSessionMounts` re-reads the session's worktree statuses first, on
  turn end and on focus, with or without GitHub, so a push by an agent or a
  terminal, which moves the shared tracking ref, clears the count. A push
  from another clone does not move that ref: when a request refresh returns
  a head sha that differs from it, `syncBranchRefToPr` fetches that one ref
  (`worktree_sync_branch_ref`) and re-reads the status. No other fetch runs.
- **Refresh re-reads a session on demand.** The header's Refresh button
  (before Archive and Delete, hidden on an archived session), ⌘⇧R and the
  palette's `Refresh session` run `resyncSession`: mounts and branches from
  disk, the local branch and worktree status caches, linked work items, and
  every provider request forced, then the PR detail of the open session. The
  glyph pulses in place while it runs (`sessionSyncing`), the page stays live,
  and a failure raises an error notification with the provider's message.
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
  untracked work. The local branch survives every one of them except the
  after-merge rule below, and `mount attach` recreates a worktree from it.
- **After a pull request merges, a rule decides.** Workspace settings carry
  `After a pull request merges` (`workspaces.after_merge`): `Ask first`,
  `Delete folder and branch on this Mac` or `Also delete the branch on
origin`. A repo project can override it from its row editor
  (`projects.after_merge`, `Same as workspace · …` first). Workspaces from
  before the rule stay on `Ask first`; a workspace that never chose deletes on
  this Mac. When polling sees the merge and the rule is not `Ask first`,
  `runAfterMergeCleanup` deletes only a branch Goodboy created
  (`session_worktrees.branch_origin = 'created'`; older rows read `unknown`
  and are never deleted by the rule), only if `branch_merge_state` says it
  is merged or has no commits of its own, and only after the folder
  unmounts cleanly. Polling stores the head at merge on the request link
  (`mount_pr_links.merged_head_sha` and `merged_at`: GitHub `headRefOid`
  and `mergedAt`, GitLab `sha` and `merged_at`, Bitbucket the source
  commit), and a later poll without it keeps the stored one. A squash merge
  is read only from that record: its `merged_head_sha` is merged when the local tip (and
  `origin/<branch>`, if any) is an ancestor of it, and `Merged, then N new
commits` otherwise. Without a record, only a merge commit or a rebase
  counts. The tip is parked
  under `refs/goodboy/deleted/<branch>`, then `git update-ref -d` deletes
  the branch only if it still points at the checked sha. The origin choice
  runs `git push origin --delete` with `--force-with-lease` (on the merged
  head when the link has one, so a push after the merge refuses) and is off
  when
  GitHub already deletes merged branches (`delete_branch_on_merge`, read
  once a day). Anything kept falls back to the merge cleanup proposal with
  the reason (`Kept goodboy/fx-rates: 2 new commits after the merge.`).
  Each deletion is a `deleted_branches` row and a `branch_deleted` Activity
  row with `Restore`; the parked ref and the row go after 14 days.
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
series part, distance to main, diff, state, action, menu. A column no row
fills takes no width, and below a 36rem container the distance and diff cells
empty out (the Changes lens still has the diff). The row's actions come from
the `mount` kind of the action registry
(`features/actions/kinds/mount.ts`). The action cell shows the one action
the state calls for, picked by its `inline` slot: `Rebase on main` when main
moved, `Push N commits` when commits wait on a branch with a pull request,
`Create PR` when the branch has commits and no pull request, `Remove worktree`
once the pull request merged, `Reopen` on a closed row. A blocked action stays
visible, disabled, with its reason in the tooltip. The always visible row menu
(`⋯`, also on right click) lists every available action of the worktree: open
the pull request, the diff, Review, the terminal, the editor (one submenu level
of detected editors), scripts, Rebase, Push, Rewrite history, Switch branch,
Start new turns here (only with two or more mounts), the copies, then Close
worktree, or Remove from session on a closed row. There are no hover-only icons
on the row. When a rebase stops, the notice under the row brings the terminal
and Abort rebase forward. Below a 28rem container New worktree shows its icon
only. The project menu (`MountActionsMenu`, the `project` kind) holds Remove from session
and renders nothing when the project has no mount to remove.

With two or more mounts, a row shows its presence (`MountPresence`): the
state node of each agent whose turn runs, waits on an answer or needs you in
that mount, at most three, then a count. A node opens that agent. There is no
badge for the mount new turns start in; the chat header owns that choice.

The branch chip is the branch control: on a mounted repo row the whole chip
opens the branch switcher, whose header copies the branch name. Where the
branch cannot switch (unmounted rows, folder projects, a rebase in progress)
the chip only shows the name, and with uncommitted changes it says why in its
tooltip. Copy branch name lives in the row menu.

A branch row shows the tasks linked to that branch as chips (`LinkedTaskChip`, the
`task` kind). The visible **Put on a branch** action opens an anchored picker for a linked
task, with **Link work** for another task and **New worktree for** to give a
task its own branch. A task already on the session moves with
`assignSessionExternalTask`: it links the branch row, then drops the session row.
`takeOffSessionExternalTask` reverses it, and taking a task off its last branch
restores the session row. The chip opens its task; its hover or focus unlink
control takes it off this branch. Undo restores the exact placements in one
transaction, including removing a generated session row. `forkMount` takes `taskIdentifier` and `taskTitle` so a
worktree made for a task is named `{prefix}/{task-id}-{slug}`. The session header,
Board card and sidebar dedupe by provider and external id (`distinctTasks`); the
branch is visible only under its row in the Projects card.
