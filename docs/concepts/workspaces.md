# Workspaces and folders

> **Read this when** you change how a workspace is created, named, switched or
> disconnected, or what a folder is and which face a plain folder shows.
> **Not for** how a session reaches a folder ([lazy-sessions.md](lazy-sessions.md))
> or the worktree layout ([../mounts.md](../mounts.md)).

A **workspace** holds your profile, your connected tools, one or more folders
and every session. The screen calls what it holds a **folder**; the code, the
database and the technical docs call it a **project** (`Project`, the
`projects` table). A folder has a root path on disk and is a git repository
(kind `repo`) or a plain folder (kind `folder`). It belongs to one workspace and
keeps only what is specific to that place: its scripts, its own settings and,
if you want, its own connection to a tool.

## Create a workspace

Every door says **New workspace** (Home, the switcher, Search or run, the menu
bar) and opens one form, with **Start from scratch** inside it. The form sets up
the folders of one workspace; they are not kinds of workspace, and a workspace
never links to another one ([ADR 001](../adr/001-workspace-project-rename.md)).

A new workspace is named after the folder you picked, never its parent:
`nameFromFolder` (`features/workspace/nameFromFolder.ts`) turns dashes and
underscores into spaces and capitalizes the first letter, so `ledger_core`
becomes "Ledger core". The folder keeps its name on disk, and you can rename the
workspace in place.

### Detection is read only

`validate_git_repo` and `scan_child_repos` (`src-tauri/src/repo.rs`) write
nothing. A failed check says why in `errorKind`: `not_found`,
`permission_denied` (macOS will not let Goodboy open it), `not_a_directory`,
`not_a_repository` or `git_failed`. Each repository reports its `defaultBranch`,
read on disk only (where `origin/HEAD` points, else the current branch, else
none), stored as the folder's `baseBranch`. A repo project needs a working git
setup before a session can make a worktree in it.

### One write on Create

`createWorkspaceWithFolders` (`store/slices/workspaces/`) takes the workspace id
the form made beforehand, the name, the folders and the folders to move here:

1. It refuses a move while agents run in that folder (naming the count and the
   other workspace), and a folder another workspace holds, before touching the
   disk.
2. It runs `git init` for a plain folder you chose to track, or creates the
   folder for Start from scratch, before any database write. A git failure
   writes nothing and shows git's message.
3. It writes the workspace, every folder, a new folder's first-lap phase and a
   plain folder's face in one transaction (`insertWorkspaceWithProjects`). A
   failed insert leaves no row.
4. Only then the store shows them, and the moves run through `adoptProject`,
   which refuses on its own while agents run there.

Retry is safe: the workspace id and the `root_path UNIQUE` column (m119) make a
second try reuse what the first left, and a scratch folder the first try created
is picked up instead of refused.

## The two faces of a plain folder

A plain folder is a **Code project** or **Documents** (`FolderPurpose`,
`'code' | 'documents'`, in `packages/types/src/folder.ts`); a repository has no
face. The face is one `project_values` row per folder, key `folder.purpose`,
deleted with the folder. The `store/slices/folder-purpose/` slice owns it:

- `hydrateFolderPurposes()` loads every row at boot, keyed by project id, and
  skips a row it cannot read. Call it again on window focus to pick up a face
  another window saved.
- `loadFolderPurpose({ projectId })` reads one row fresh, for a turn at send
  time.
- `setFolderPurpose({ projectId, purpose })` writes with a compare and swap (a
  lost race reads again once, then fails with an error) and changes the store
  only after the write resolved. A failure keeps the old face.
- `createWorkspaceWithFolders` writes the face of a `plain` folder in the Create
  transaction.

### The preselect

`read_folder_signals` (`src-tauri/src/folder_signals.rs`) lists the top two
levels read only, at most 2,000 entries, never follows a link and skips hidden
entries and dependency or build folders. It returns the code markers it saw
(`package.json`, `Cargo.toml`, `go.mod` and the like), a count per file kind,
the total files and bytes, and `isTruncated` at the cap. These counts are the
only source for a line such as "86 Markdown files". `scanFolderSignals({ path })`
keeps only the newest answer per path: a late older scan returns `null`.

`folderPurposeOf` (`features/workspace/folderPurposeOf.ts`) is the one preselect
rule. A code marker means Code project; otherwise source files are weighed
against document and media files, and the larger side wins. An empty folder or a
tie preselects nothing, and Create asks.

### The form row

The plain folder row (`FolderFaceChoice` in `shared/components/NewWorkspaceForm/`)
shows one line of what the scan saw (`folderSignalsLine`), then Code project or
Documents.

- **Code** offers **Track it with git when the workspace is created**, unticked.
  Ticked, Create makes the first commit through `folder_git_make_first_commit`,
  leaving out dependencies, build output and secrets, and the row counts the
  files that go in (`firstCommitCount`).
- **Documents** says what agents edit in place and what stays read only.
- A folder over 2 GB (`largeFolderOf`) says that files over 15 MB keep no
  versions.
- A folder inside a repository asks **The whole repository** or **Only this
  folder**, which creates the subfolder as a Documents folder and names the
  workspace after it.
- A failed scan preselects nothing, and the row says it could not look inside.

All face copy lives in `features/workspace/folderFaceCopy.ts`, and
`__tests__/regressions/documents-copy-has-no-git-words.test.ts` keeps the
Documents copy free of git words.

### A plain folder in use

- Its first copy of saved versions starts right after it is added, at Create and
  through `addProject` (`prepareLinkedFolder`, in the background). A failure
  marks the folder failed, and Projects settings offers Retry. `removeProject`
  forgets that copy.
- Storage shows the saved versions of every plain folder as one row
  (`savedVersionsBytes`, summed in Rust).
- Home names a one folder workspace by its face (`workspaceFaceLabel`), and the
  folder's row in Projects settings switches it ([../navigation.md](../navigation.md)).
- A session that edits it in place names the folder and what agents do there on
  the rail's **Folder** card, shows a folder card under Branches on the Overview
  (`SessionOverviewPane/FolderCard.tsx`, changes from `turnChanges`), and ends
  each writing turn in a card with Open in Changes and Undo changes from this
  reply (`features/chat/components/TurnChangesCard/`).
- The git verbs are not registered for a session without a branch: Comments
  (`session.review`) and Files (`session.diff`) leave the menus and Search or
  run, and **Changes**
  (`session.changes`) takes their place.

## Stars and descriptions

You can **star** a project and give it a one-line **description**, both on its
row in workspace settings. Every agent's project list, the planner's and the
orchestrator's included, puts starred projects first with their descriptions
and says to look there first when a request names no project. Pickers and the
Activity project filter put them on top; the New session picker opens on
Starred, then Recent, then All projects. A star never changes what an agent may
mount or write.

## One workspace per window

Switching a window to another workspace cancels every turn running in it, so a
window switches in place only when nothing runs. When agents run, the workspace
popover asks first and offers a new window instead. While agents run, a side
door (a notification, a Tasks item, New workspace) opens that workspace's own
window without asking and never touches this one. `⌘Enter` on a workspace row
always opens a new window.

## Disconnect and moved folders

**Disconnect** keeps a workspace and its folders in the database with all they
hold and only hides them. Re-adding the same folder through New workspace or Add
project reconnects it and its sessions instead of making a duplicate. A folder
that moved meanwhile is recognized by repository identity, and Goodboy offers to
locate it the same way as a moved connected folder.

Moving a folder on disk loses nothing either. The rows stay but point at the old
path, so the project reads `Folder not found` until you **locate** it (the new
folder, or its parent to locate several at once). See
[../architecture.md](../architecture.md#moving-a-projects-folder).
