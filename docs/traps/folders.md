# Traps in plain folders, session files and attachments

> **Read this when** you change a plain-folder session, its marker, its saved
> versions, or where an attachment or a dropped file is stored and read.
> **Not for** worktrees and branches ([git.md](git.md)) or the folder
> version design ([../architecture.md](../architecture.md)).

## Session folders

### A plain-folder session marker has two shapes

It is `.goodboy/session.json` inside a `.goodboy` folder; older sessions may hold `.goodboy` as one file. Only `marker_read` in `session_dir.rs` knows both, and `file_versions.rs` reads the marker through it: a second reader testing `.goodboy.is_file()` breaks file versions in every plain-folder turn. Tests build session folders with `session_dir_create_blocking`, in the test-only `session_dir/testing.rs`, so no creation code ships.

### A session marker is never missing

Moving a legacy marker file into `.goodboy/session.json`:

1. Stage a synced copy as `.goodboy-session.json`.
2. Remove the old file.
3. Rename the copy into place.

`marker_read` reads the staged copy too, so a crash between steps never leaves a folder Goodboy no longer knows as its own.

### A session folder is removed only by its own session

`session_dir_remove` refuses a folder whose marker names another session or that has no marker, so a legacy folder that lost its marker is kept and the error shown. A test that removes one builds it with `session_dir_create_blocking` and the same session id.

## Saved versions of a plain folder

### The before copies keep their old place

They stay at `file-versions/<session-id>/<version-id>-<name>` with a `file_versions` row. Everything new (the first copy, the index, staged runs, turn manifests) lives in `folder-versions/`, which older builds never read. A new place or name for the before copies is a new on-disk format and a minor release.

Nothing is written inside the user's folder: a restore writes a temporary file beside the target and renames it over. Startup finishes a staged run only when it is not live and older than a minute, so a second window booting mid-turn never ends that turn early.

### History of a folder is not where an agent may write

`inPlaceFoldersOf` answers where an agent may write now: unmounted projects of kind `folder`. Tracking a folder with git turns it into a repo whose old sessions still own saved turns, so every view of past changes (Changes, the turn card, the turn list load) goes through `historyFoldersOf` and `historyCandidatesOf`. Reading history through the writable selector loses it silently on conversion.

### The materialize bridge needs the folder's saved copy

It hands a plain folder to the agent only when the session holds its saved copy (`holdsFolderCapture`, kept by `createFolderSnapshotPort`). A turn started on a repository mount has no writer lease or copy on the folder, so it is refused with a pointer to the next turn.

### Unlinking a folder waits for its open turn

Unlinking forgets the first copy and staging, so `removeProject` reads `isTurnOpen` first, and `forget_folder` returns `FolderBusy` under the folder lock. A turn started in another window keeps its staging.

## Attachments and dropped files

### Attachments are checked twice

The size ceiling and type whitelist run in the composer and again in `attachment.rs`, because paths also come from persisted turn events and an OS drop skips the picker. A stored name is reduced to `[A-Za-z0-9._-]` with no folder part, against traversal and shell-hostile names.

### A dropped file is read through its handle

Read it through the handle `DroppedPaths` opened in the drop handler, never by path when the page asks. Screenshot tools drag a temporary file and remove it when the drag ends, before `attachment_read_dropped` arrives, so a read by path fails for every screenshot.

### Attachments never need a worktree

A session gets its worktree at the first write, so a read-only run has none, yet its goal or hint files must still save and reach the orchestrator.

- `saveGoalAttachments` writes into the worktree when there is one, else into the session scratch dir (`scratchDirPrepare`, as chat turns and Auto runs use). A scratch file is named `scratch-<id>-<name>`, so its `relPath` says where it lives without a column or migration.
- `attachmentDirOf` is the one function that says which dir holds a row, and `attachmentAbsolutePathOf` builds the path; thumbnails, `removeGoalAttachment`, `hintImagePaths` and the kickoff block all use it. Never join `sessionWorktrees[id][0]` and a `relPath`: a file saved before the worktree existed stays in scratch.
- `sessionScratchDirs` caches the scratch path, filled by `loadGoalAttachments` for a scratch row; a reader gets `null` until then.
- The orchestrator's cwd is the dir of its images. With images in both dirs, the worktree is the cwd and the scratch dir goes as `readDirs`, which becomes `--add-dir` on Claude and Copilot; other providers read the cwd only and can lose the scratch images.
- The scratch dir is under the Goodboy root, so it survives a restart and an archive, and `deleteTask` removes it. Its cache lives as long as `workflowRunAttachments`, until delete, so restored rows still resolve, and `sessionIdOfOwner` looks in archived sessions too.
- The artifact creation pane still needs a worktree: its paths go into the scout pack relative to the scout's cwd, a mount worktree.
