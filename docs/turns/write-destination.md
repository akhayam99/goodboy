# Where a turn writes

> **Read this when** you change where a turn writes, which lease it takes
> before it spawns, how a resolver parks its work, or how a plain folder saves
> versions around a turn. **Not for** the mount lifecycle
> ([../mounts.md](../mounts.md)) or how a role is confined
> ([spawn.md](spawn.md#confined-roles)).

## The destination

A turn writes into the first of these that exists
([../mounts.md](../mounts.md#where-a-session-writes)): the mount it was aimed
at, the session's active mount, the first lap project folder, the plain
folders of the workspace in place, the scratch folder. The destination is
resolved when the turn starts and recorded as the agent's write destination,
so the place the user sees is the place the turn writes.

- A queued turn freezes the mount id, path and revision it was queued on. If
  the mount moved or changed revision before the turn starts, it refuses.
- A turn in a session that already writes in a `sessions/<name>` folder mount
  keeps it, takes no folder lease and captures a recoverable file version
  before and after it runs.

## Leases

Every lease is bound to the child process in Rust and freed by its exit,
whatever the window does, and released again when the turn ends.

| Turn                                     | Lease                       | When it is busy                  |
| ---------------------------------------- | --------------------------- | -------------------------------- |
| Resolver                                 | Worktree writer lease       | Queued as a resolve attempt      |
| Writer `confinedRole`                    | Write set lease             | Waits in `acquireTurnWriteSet`   |
| Writing turn in a plain folder           | Write set lease             | Waits in `acquireTurnWriteSet`   |
| No `confinedRole`, on a mount            | None                        | Runs beside others               |
| Read-only kind in a plain folder         | None                        | Never waits                      |

### The Lead's writers

A writer `confinedRole` is implementer, tester, docs, scribe, ci-fixer or
rewriter: the turns of a Lead tree, which is Auto in code. Its write set is its
working folder, the session's sibling mounts, each repo's common metadata
folder and each linked worktree's own git folder (`.git/worktrees/<name>`, from
`worktree_git_dir`). That is the list `turnWriteSet` hands to the CLI as
`--add-dir` roots, so the roots and the lease keys cannot drift.

Rust `acquire_write_set` (`worktree_writer.rs`) grants every key or none, in
sorted canonical order, and leaves nothing behind when a key is busy. A second
writer on a shared key waits:

- The agent reads "starting" with the band **Waiting for the writer**
  (`agentWriterWait`, `WriterWaitBand`).
- The tail Stop, Send now and the band's **Cancel** cancel the wait.
- The poll is one second and wakes at once when this window releases.
- After 30 minutes the turn answers `isWriterLeaseDenied`, like a resolver.

Two Auto writers on different worktrees of one repo serialize on the metadata
folder on purpose. An agent started by hand or as a workflow step has no
`confinedRole`, so two generalists in two worktrees of one repo run together.

### A plain folder has one writer at a time

A turn with no mount in a workspace with plain folders (`inPlaceFoldersOf`:
folder projects the session has no `sessions/` mount for) starts in the first
of them, gets the others as `--add-dir` roots and a root write destination
with no branch. A second session that wants to write waits with the band
**Waiting to write in acme-notes** (`WriterWaitBand`: who writes,
`queueEstimate` for the time left, **Answer without editing**, **Cancel**).

- **Answer without editing** (`answerWithoutEditing`) ends the wait and starts
  the same turn as `scout`, with no lease and no writable roots, so the CLI
  enforces read only.
- It is offered only where a provider confines a read-only role
  (`isAutoOwnProvider`). On the opencode family the band says the answer works
  only on Claude or Codex and the turn keeps waiting; `turn_spawn` refuses a
  read-only role there anyway.
- **Cancel** (`cancelWriterWait`) leaves the queue and records nothing.

The `[folder-scope]` guard (`scopeGuard.ts`) keeps every write, shell commands
and links included, inside the folders, and creates no repository. A Documents
folder (`readFolderPurposes`, read at send time) keeps Word, PDF, Pages,
Keynote, Numbers, Excel and PowerPoint files read only.

## Resolver candidates

A resolver turn proposes only while another agent in the session is running.
Its work is parked as a candidate: committed to a candidate ref, the branch
reset to where the turn started, and offered on the queued comments it
answers. A message typed in the resolver chat, or any resolver turn once
nothing else runs, applies: its commits stay on the branch. Work no queued
comment covers is never parked.

Recovery on load parks a leftover candidate only when its turn is not running,
no later attempt started on that worktree, and a writer is still live or the
resolver has not completed. Otherwise the candidate is dropped and the branch
left as it is.

## Saved versions in a plain folder

The before snapshot is the hook for saved versions. The data layout is in
[../architecture.md](../architecture.md).

1. With the lease held and before the user message is written,
   `leaseTurnWriter` reserves the run id and calls
   `inPlaceSnapshot.begin({ sessionId, runId, folders })`. If it throws,
   nothing is recorded, the lease is freed and the composer says "Couldn't save
   acme-notes before this turn, so the agent did not start" with Retry.
2. Boot installs the port (`createFolderSnapshotPort`,
   `store/slices/file-versions/`). `begin` brings each folder's first copy up
   to date and stages the run in Rust (`file_versions_folder_begin`); a folder
   that fails frees the ones already staged.
3. `closeTurnCapture` finalizes it after the stream, before `run` frees the
   lease. `finalize` writes the turn's changes, then the `file_versions` rows.

- A run that never spawns is discarded by `sendTurn` through
  `discardInPlaceCapture`.
- A failed finalize is kept in `folderCaptureFailures` for
  `retryFolderCapture`. A second finalize of one run returns the same changes.
- Startup finishes runs a restart left staged (`recoverStagedFolderTurns`),
  except live ones and ones younger than a minute, which the next turn in that
  folder finishes first.
- Restore and Undo restore refuse while a turn is staged in the folder.

The chat ends each writing turn of a plain folder in `TurnChangesCard`, under
the usage row: "Changed 2 files in acme-notes · saved before this reply", the
files with their line counts (`textChangesOf`), **Open in Changes**
(`sessionFileVersionSelectedPath`) and **Undo changes from this reply**, which
asks in the card when a file changed since. A failed capture shows "Changes
from this reply couldn't be saved" with Retry in its place.
