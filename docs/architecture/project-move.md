# Moving a project's folder

> **Read this when** you change how the app finds or relocates a project whose
> folder moved on disk, or add a table that stores an absolute path. **Not
> for** the missing and unavailable states themselves
> ([mounts.md](../mounts.md)). The other pages are listed in
> [architecture.md](../architecture.md).

## What a move breaks

These columns store absolute paths: `projects.root_path`,
`session_worktrees.worktree_path` and `last_worktree_path`,
`retained_worktree_paths`, `worktree_roots`,
`resolve_candidates`/`resolve_attempts`/`resolve_publications`,
`skills.file_path` and `mount_operations`.

Moving a project's folder on disk (a new drive, `~/nerd` to `~/github`) does
not touch the database. Every saved path still points at the old location, so
the project reads as `missing` and its sessions read as `unavailable`, the same
non-destructive state as a disconnected disk. Nothing is lost. Git's own
worktree links inside the repo point at the old absolute path too, until
`git worktree repair` runs again from the new root.

## Repository identity

`projects.root_commit` and `projects.remote_url` hold the repository's identity
(`repo_identity`): the root commit(s) from `git rev-list --max-parents=0 HEAD`,
and `origin`'s URL normalized without credentials or a trailing `.git`. It is
written when a project is linked, when it is reconnected, and once in the
background the first time its git status comes back `ready` after boot. It
never leaves the local database.

## Relocating

`project_relocate` (`apps/desktop/src-tauri/src/project_relocation.rs`) runs on
a blocking thread, not the async runtime.

1. It checks that the destination is a folder and, for a repo project that
   saved a root commit, that the repository there has the same one
   (`destination_differs` otherwise).
2. It checks the `UNIQUE` constraints on `projects.root_path` and
   `session_worktrees.worktree_path`.
3. It rewrites the tables above inside one transaction.
4. Once the commit lands, it calls `git worktree repair` from the new root.
5. `rekey_folder_versions` moves the saved folder versions
   (`folder-versions/<key>`, keyed by a hash of the real path) to the new key,
   on undo too.

What could not be carried over (git links, saved versions) comes back as
`repairError` and shows under the success notice. `Undo move` reverses the same
rewrite through `project_relocation_undo`.

### Which paths it rewrites

- **Folder boundary only.** A path matches as the path itself or the path plus
  `/`, never as a substring and never through `LIKE`. A sibling folder
  `ledger-core-web`, a `ledger_core` next to `ledgerXcore` or a path holding
  `%` stay untouched.
- **The moved project only.** Its own mounts, its retained paths (and orphan
  rows with no project), its skills (same workspace) and the resolve rows of
  its mounts.
- **`mount_operations` JSON** is parsed and rewritten value by value.

## Finding moved projects

`find_moved_projects` reads one level under a chosen parent, computes
`repo_identity` for each folder, and matches saved projects by identity first
and by folder name second. The backup import reuses it
([backup.md](backup.md)). The desktop UI is
`features/workspace/components/LocateMovedProjects/`, backed by the
`project-relocation` store slice.
