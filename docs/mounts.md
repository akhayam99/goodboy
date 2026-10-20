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
- A repository mount is a git worktree at `<repo>/.goodboy/worktrees/gb-<6 chars>`,
  where the six characters are lowercase base36 (for example `gb-7k2q9x`). The
  folder name carries no session and no mount id: the session and the branch
  are shown next to it. `allocateMountDirName` draws the name from a source
  seeded with the mount id, so a retried request lands in the same folder. If
  the folder exists and is not a worktree of the repository, it draws again, up
  to eight times, then takes a 12 character name. Worktrees made before 0.26.0
  keep their old `<session-slug>-<mount-id>` folder: the path is stored in
  `session_worktrees.worktree_path` and in the mount row, and nothing
  recomputes it. Re-attaching a removed mount reuses the folder name of its
  last stored path. The local branch outlives the worktree.
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
- A name an agent asks for (`mount fork`, `mount switch --create`) or the New branch form gives goes through the same
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
- A plain folder gets no mount and no session folder. A new session writes in
  the folder itself: its turns get a write destination of kind `root` with no
  branch, one session writes in a folder at a time under the write set lease,
  and the guard keeps every write inside it ([turns.md](turns.md#where-a-turn-writes)).
  `ensureProjectMounted` answers `in-place` for a folder project and
  `createProjectMount` refuses one, so no path cuts a `sessions/` folder.
- A session made before 0.27.3 that already has a folder mount at
  `<project-root>/sessions/<name>` keeps it and keeps writing there: moving an
  agent's earlier output into the user's files would be a write nobody asked
  for. Folder projects always keep that directory; no Goodboy action deletes it.

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

## Git later

A plain folder gets git only when you ask, or when git shows up by itself.

- **Track with git** (Settings, Projects, the Git band) reads a first commit
  plan first, read only: `folder_git_first_commit_plan`
  (`src-tauri/src/folder_git.rs`) lists what `git add` would take through a
  scratch git dir outside the folder, so the folder's own `.gitignore` and
  git's global excludes count, and groups it into what goes in, dependency and
  build folders left out by default (they can be ticked back in), and files
  that look like secrets (`.env*`, `*.pem`, `*.key`, `id_rsa` and the like),
  which are always left out and never offered. Goodboy's own `.goodboy` and
  old `sessions/` folders stay out too.
- `Make the first commit` (`folder_git_make_first_commit`) runs `git init` on
  `main` (an empty repository keeps its branch), writes the left out paths to
  `.gitignore`, checks git really ignores them, stages, refuses if a staged
  path still looks like a secret, and commits as git's own identity, or as
  `Goodboy <goodboy@localhost>` when git has none, the same fallback the
  first lap uses. Any failure removes the new `.git` and restores
  `.gitignore` (or the index of an empty repository). No remote is set.
- `convertProjectToRepo` takes the folder's write lease first, so the commit
  never runs while a session writes in place; the error names that session.
  The project becomes `repo` only after the commit and `validate_git_repo`
  resolved. New sessions then cut their branch from local `main`, which works
  with no `origin` (`worktree/create.rs` falls back to the local branch).
- **Publish to GitHub** on a repository with no remote is the first lap's
  `PublishPanel` and `publishFirstLap`: create on GitHub or link an address,
  then push `main`.
- Git set up outside the app is noticed by `probeFolderGit`
  (`folder_git_probe`, read only) on workspace open, on window focus, when a
  turn ends and when the Git band opens (`useFolderGitProbe`). A code folder with commits becomes `repo` by itself,
  only while no session holds its write lease, and the band says so with
  `Keep editing in place`. A documents folder, or a folder inside another
  repository, keeps writing in place and asks once. The answer to keep
  editing in place is one settings row, `folder.git.<project-id>` =
  `in-place`, and the probe leaves that folder alone after it.

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
- **Switch** changes the branch of one mount in place, and a mount follows by itself when its worktree lands on another branch (a rename or a checkout), adopting it unless git is mid-operation or another mount holds that branch.
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
fix is `Locate moved folders` (`features/workspace/components/
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
detach). The user resolves a proposal from the Overview Next slot
(`cleanupSuggestionOf`): one row `Remove the <project> worktree` with the reason
and the size (`#418 merged · 412 MB`, or `Session archived`), or one row
`Remove 2 merged worktrees` for several. `Remove worktree` asks first, then runs a
normal unmount for each proposal in turn (`resolveMountCleanup` passes
`isRemovalRequired`, so a removal git refuses fails the `unmount` operation,
leaves the mount attached and the proposal pending, and reports the error;
pressing `Remove worktree` again retries); `Not now` hides the row with Undo
(the proposal stays pending, keyed by its request ids). Paths that
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

The Storage page does not poll the process monitor, so each removal first
refreshes the snapshot (`refreshMonitorSnapshot`) and fails closed: when the
read fails, or the platform cannot list processes (`isPlatformSupported` is
false), the folder is kept with the reason "Could not check for running
processes". The ledger alone never decides, because an unreadable monitor
reads as "no processes" and would delete a worktree something still runs in.

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
- **A stopped rebase says so in the Overview notices.** Only `rebase-merge/` or
  `rebase-apply/` count, as git reads them. The Overview notices slot
  (`OverviewNotices`, one `MountNotices` per open mount) shows a
  `Rebase stopped` notice with `Hand it to an agent` (a `Rebase on <base>`
  agent on that mount finishes it), `Open terminal`, and `Abort rebase`
  behind an inline confirm (`worktree_abort_rebase`, which refuses when no
  rebase is stopped).
- **A worktree names its layers under its row.** The current branch row of the Projects tree in the
  session rail holds the code host layers as entries: Pull request with its number,
  Files with the diff count (`useMountDiffStats`, read from
  `sessionWorktreeRecords`, which `applyMountViews` rewrites on every mount
  change, so a branch attached or forked while the session is open counts at
  once) and Comments while review comments wait. `Rewrite history` sits in the
  row menu of the tree.
- **Finished worktrees fold into `N finished`.** A row is finished when its
  request merged or closed (`isCompletedRequest` in `buildMountRows`,
  `mountRowModel.ts`); the session level folds those rows under one
  `N finished` row per project. Ancestry never decides it, so a row never moves
  when its worktree status arrives.
- **A GitLab row reads the same facts as a GitHub one.** `refreshSessionMr`
  fills `mountGitlabMr` per mount and, for an open merge request only, reads it
  once more (`gitlab_get_mr`: the head pipeline and the merge status) with its
  approvals (`gitlab_mr_approval_state`), at the cadence of the refresh and in
  no loop of its own. `mapMrToPullRequestState` turns them into `checks`
  (`success`, `failure`, `pending`, or null with no pipeline), `mergeable`
  (false on conflicts, null while GitLab is still checking) and
  `reviewDecision` (`approved` once approvals are met, otherwise
  `review_required`; GitLab has no changes requested), so the sidebar glyphs,
  the readiness and the Board read a real state. A failed extra read leaves the
  fields null and never fails the refresh.
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
  commit), and a later poll without it keeps the stored one. A Bitbucket mount
  also keeps the `checks` and `reviewDecision` of its open pull request in the
  mount slice, refreshed with the request (one extra statuses call per refresh,
  open requests only), so the sidebar, the Board and the Now chip see a failed
  status or a requested change. A squash merge
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

## Branches that are not the owner's

The branch pickers (Switch branch `Pick existing`, New branch `Existing
branch`, New branch for a task) list three groups from `useBranchChoices`:
`On this Mac` (local branches), `Open pull requests` (open requests of the
repository, from `gh pr list`, fork heads left out) and `On origin` (remote
branches nobody has locally, from `worktree_list_remote_branches`). Each entry
carries the request number and its author when known, and the search matches
the name, the number, the author and the request title. The list opens on the
branches already read and refreshes after a background `git fetch --prune
origin` (`worktree_fetch_remote_branches`). `mergeBranchChoices` merges the
three sources; a request whose branch was never fetched is still offered.

Choosing a branch that exists on origin and not locally checks out a local
branch tracking `origin/<name>`, never one cut from the base. The guard lives in
Rust, so it holds for typed names too:

- `worktree_change_branch` with `createNew` and `worktree_create` for a new
  branch name first fetch that one ref. When `origin/<name>` exists and no local
  branch has the name, the worktree is added or switched with `--track` on it.
  When a local branch with the name points at the same commit, it is used as it
  is. When the local branch differs, the call fails with the typed error
  `local_branch_differs` and nothing is overwritten; the form shows the message
  inline. Switching onto an existing name that is only on origin does the same
  `--track`.
- The fetch decides. When it says origin has no such branch, a cached
  `origin/<name>` is stale and is ignored. When origin cannot be reached and a
  cached `origin/<name>` exists, the call fails with a "could not look up"
  error instead of adopting what may be old commits; with nothing cached a
  fresh branch is still cut, so work offline keeps going. The fetch passes `--`
  before the branch name, and the two commands that take a branch from the
  frontend refuse a name that starts with `-`.
- The switcher also says so under a typed name that is on origin (`That branch
is already on origin`), with the request number and author.
- A mount made this way is `branch_origin = 'adopted'`: `worktree_create`
  answers `trackedRemote`, `worktree_change_branch` answers `adopted`, and
  `updateSessionMountBranch` writes the origin with the branch. Only a switch
  onto a fresh name keeps `created`, so the after-merge rule never deletes a
  teammate's branch. An adopted fork keeps the name as typed, without the
  workspace prefix.

A mount that was stranded before the guard (the branch was cut from the base
while `origin/<name>` has the commits) is repaired in place. A row whose
worktree has nothing past the base and either an open request or an upstream of
its own name that is behind runs `worktree_remote_branch_state` once per head
(one fetch of that ref). When origin has commits the local branch lacks and
contains the local tip, the row shows one notice with `Use the PR's commits`
(`ForeignCommitsNotice`). The button is disabled with the reason while the
worktree has local changes. `moveMountToRemoteCommits` runs
`worktree_use_remote_commits`: it refuses a dirty tree and a local branch with
commits of its own (`local_branch_differs`), then fast-forwards to
`origin/<name>` with `merge --ff-only` and sets the upstream. It never resets or
rewrites anything. The row then records `adopted` and re-reads its status. No
migration is involved.

## Rendered view is not the row

`verifyMountViews` patches the rendered view (unavailable, detached) without
writing the row when git cannot confirm a worktree. A guard on an action the
UI offers reads the rendered view, not a fresh DB row; otherwise it refuses an
action the user can see, or allows one on a mount the user sees as gone.

## Worktree rows and the Overview notices

The Overview has no Projects section. A worktree is a one line row of the
Projects tree in the session rail (`WorktreeRow`: state glyph, the pull request
title or the branch, at most one chip: failing, conflict or behind). The
current branch alone opens in place under its row: the status line with
Rebase, then its pages (Pull request, Comments, Files with the diff stat,
Commits, Checks). Its row menu (the `⋯`, a right click, Shift+F10) holds the
`mount` kind of the action registry (`features/actions/kinds/mount.ts`). The
navigation rules live in [navigation.md](navigation.md#session-rail).

What a worktree asks the user to decide shows once, in the Overview notices
slot (`OverviewNotices`, one `MountNotices` per open mount, the first lap
`LapPublishNotice` with Publish before any mount exists):

- **A closed worktree** (`ClosedWorktreeNotice`) says the branch and project,
  then `Its files are still on disk.`, `Its files were removed.` or, when its
  branch was deleted locally and on origin, `Its branch was deleted.`
  (`checkMountBranchGone`). Its buttons are the mount's `inline` registry verbs:
  `Reopen`, `Restore branch` (only when Goodboy kept a saved copy,
  `restoreGoneBranch`) and, for a deleted branch, `Remove`
  (`removeGoneMount`, after the dirty-files guard). A verb with a confirm asks
  in `ActionConfirmPanel` under the notice.
- **A failed action** of that mount raises `MountActionFailureNotice`
  (`danger`, `Couldn't <verb> <project>`, `Details`, `Retry`); a failure whose
  cause cannot change shows no Retry and can be dismissed.
- **A stopped rebase**, **foreign commits** on origin (`ForeignCommitsNotice`),
  **a branch drift decision** (`MountBranchDecision`: `<project> is on another
branch`, one gray line `Expected <branch>, found <branch>` with each branch in
  truncating mono, `BranchExpectedLine`; the buttons carry the choice) and the
  **Also in** chip of a branch another session holds (`AlsoInChip`).

The slot draws nothing when nothing is present.

A worktree row of the session level is also a drop target for a linked task
(`data-task-drop="branch"`): dragging a Linked row onto it moves the task to that
branch, Alt copies (`useTaskDrag`, `useTaskDropState`). Every placement change
goes through `moveSessionExternalTask` (`to` a session or a branch of the
task's own project, `isCopy` keeps the source): it computes the next rows of that
task and writes them once, so one Undo restores the exact rows, including
removing a generated session row. `assignSessionExternalTask` and
`takeOffSessionExternalTask` are thin callers of it. A task of another project is
refused. **Link work to this branch** (the `mount.putTaskOnBranch` label in a
mount menu) opens the put on a branch picker anchored under the branch row of
the tree. `forkMount` takes `taskIdentifier` and `taskTitle` so a
worktree made for a task is named `{prefix}/{task-id}-{slug}`. The Linked rows,
the Board card and the sidebar dedupe by provider and external id
(`distinctTasks`); a task only placed on a branch is a Linked row too, named
`on <branch>`.

## On the session overview

The Now block closes with the branch facts, read by `useBranchFacts`
(`features/session/central/branches/`) from `useMountRows` and `mountRequestOf`.

- Every branch is one 32 px `ListGridRow` of the Branches `ListGrid`
  (`BranchList`, `BranchRow`), so every column lines up: the branch name
  (232 px, never the folder), the project (112 px, only when the branches span
  two or more projects), the request number (48 px), a `StageTrack` of six
  stages (Commit, Push, Pull request, Checks, Review, Merge) joined by one line
  (80 px), the state word (124 px), one short fact (the rest, such as "2
  threads to answer" or "24 commits to push") and a chevron (16 px). A row
  never says it has a card in Next: the rank already puts it first. One branch
  has no eyebrow; two or more have the eyebrow with the count. A row opens the
  Branch page of that mount and holds no button: a verb lives only in Next.
- `branchStoryOf` is the one function that turns the facts into the step word,
  the tone, the blocker and the dots. The row, its accessible name
  (`branchSentenceOf`, which starts with the branch) and the rank all read it.
  Merged and closed branches stay in the list (`useBranchFacts` reads
  `finishedRows` too), last. The story names a `BranchState` and its tone
  comes only from `BRANCH_STATE_TONE` (`branchStateTone.ts`), the table in
  [DESIGN-SYSTEM.md](../packages/ui/DESIGN-SYSTEM.md); never from whether the
  branch has a card in Next. An approved branch that cannot merge says
  Conflicts, amber.
- The order is `branchEntriesOf`: failing first, then a branch with a card in
  Next (in the card order of `cardOrderOf`, which also maps a Rebase card to
  each branch it rebases), then a branch where an agent works, then waiting,
  then local, then merged. The list shows 8 rows and folds the rest into one
  disclosure row ("12 more branches, 4 merged", `aria-expanded`); with 9
  branches all nine show, because the fold row would be as tall as the one
  row it hides.
- Check names and open conversations come from `PrDetail`. `useBranchDetails`
  reads it with `refreshSessionPrDetail({ mountId })` only for a GitHub branch
  that is open, fresh and has failing checks or a change request, on the
  existing 30 s detail TTL. It asks again only when the mount, its pull
  request number or the PR snapshot time (`fetchedAt`) changes, never because
  its own detail read changed `mountGithub`. A failed read records
  `mountDetailFailures[mountId]` (time and mount revision) and the same
  revision is not read again for 60 s unless forced; a new revision reads at
  once, and a failure that lands after the revision moved is dropped.
  `branchDetailOf` drops a detail of another pull
  request number. GitLab and Bitbucket, and a read that failed, keep "Failed
  on the last push" and "A reviewer asked for changes"; a read detail says the
  check names ("static-analysis failed") or the threads ("2 threads to
  answer").
- `useBranchLabels({ sessionId })` gives the project and branch of a mount when
  the session has two or more, for the branch chips on cards, groups and done
  rows (`BranchChip`).
- PR cards are gated per branch in every overview: `deriveNextSteps` skips fix
  checks, mark ready, merge, open PR and push on a mount only while an agent
  runs on that mount (`isMountBusyOf`, see Next steps in
  [concepts.md](./concepts.md)). The Open a pull request and single Rebase
  card titles name the branch when two mounts share a folder (`mountLabelOf`).
- Host nouns: `#` for GitHub and Bitbucket, `!` for GitLab. Both read through
  `mountRequestOf`, so `#309` and `!42` sit side by side.
- Behind is `distanceBehind` on `useWorktreeStatuses`, the number the rebase card
  uses (`features/suggestions/useSessionSuggestions/index.ts:403`).
- A stale read is one `isFresh` calls old (`features/suggestions/nextStepGates.ts:11`,
  5 minutes). Checks is the current stage, the word is Open or Draft and the
  blocker says "Checked 12m ago" (`branchFactsOf`, `branchStoryOf`).
- A step that cannot apply is a short dash (`skipped`) in its slot, never a
  pending circle, so the six slots still line up. Only a fresh read can skip
  (a stale read keeps every circle), and only when the host data proves it
  (`mountRequestOf` projects `isChecksAbsent` and `isReviewOptional`):
  - Checks, GitHub: `checks` is null and `checksUnknown` is not set (the
    `statusCheckRollup` is empty; an unreadable rollup keeps the circle).
    GitLab: the merge request has no `headPipeline`. Bitbucket: never skipped,
    because a null `checks` also means the statuses were not read.
  - Review, GitHub: `reviewDecision` is null and `reviewRequests` (read with
    the PR list, `hasReviewRequests`) is empty; a requested reviewer keeps the
    circle. GitLab: approvals were read, none are left and nobody approved.
    Bitbucket: the pull request is open and has no reviewer, so no decision.
  - A branch with both skipped reads Ready to merge ("No checks or review
    required"). A failing check is never skipped.
  - A queued pull request (merge queue or auto merge, `queued` in
    `PullRequestStateKind`) shows In merge queue on the Merge stage as the
    current step.
  - Every stage names itself and its state in the shared Tooltip ("Checks
    skipped" for a dash), the track's accessible name lists every stage with
    its state, and `branchSentenceOf` lists the skipped steps (`BranchStep.name`)
    in the row's accessible name.
- Only GitHub gets a PR card today. `useSessionSuggestions` reads
  `mountGithub` alone for the PR verbs
  (`features/suggestions/useSessionSuggestions/index.ts:447`), so a GitLab or
  Bitbucket branch shows its state in the list and has no Mark ready, Merge or
  Fix checks card yet.
