# On-disk data layout

> **Read this when** you change a file or folder the app keeps under
> `~/.goodboy`, the artifact mirror, or saved file or folder versions. **Not
> for** where a session writes its code ([mounts.md](../mounts.md)) or the app
> log ([logging.md](logging.md)). The other pages are listed in
> [architecture.md](../architecture.md).

Everything the app saves for itself lives in `~/.goodboy`, an owner-only folder
(`0700`). `data.db`, its `-wal` and `-shm` files and every `.bak` copy are
`0600`: `db::restrict_data_files` sets it on every open and restore, after the
reset copy, and through `db_secure_files`, which `runRuntimeMigrations` calls
after each snapshot (a failure stops the migrations). Windows sets no bits.

`app_paths::data_dir` names the folder for all Rust code, and
`db::open_connection` opens every connection (foreign keys on, WAL,
`synchronous = NORMAL`, a 5 second busy timeout). A debug build uses
`data.dev.db`, and `GOODBOY_DB_FILE` overrides the file (`db::resolve_db_path`).

## What is in the folder

- `data.db`: the database, with its copies from before each migration
  (`data.db.pre-m*.bak`) and before a half-done wipe is finished
  (`data.db.pre-reset-*.bak`), see [migrations.md](migrations.md).
- `scratch/<session-id>/`: where a session's turns write before any project is
  mounted.
- `workspaces/<slug>/artifacts/`: the artifact mirror (`artifacts-dev/` for
  debug builds).
- `file-versions/<session-id>/` and `folder-versions/<folder-key>/`: saved
  versions.
- `query/query-<pid>.sock`: the query bridge socket, in its own owner-only
  folder ([query-bridge.md](../query-bridge.md)).
- `history-copies/`: the copies Rewrite history replays a plan in. With no home
  folder, a copy fails instead of landing in an empty path.
- `boot-breadcrumbs.log`: how long each startup step took.

## The artifact mirror

Each plan, report and wireframe is copied to
`workspaces/<slug>/artifacts/<date>-<title>-<id>/`. The database is the truth:
the app never reads these files back except `meta.json`, to skip a copy that
is already current, and deleting a folder breaks nothing.

- **Contents.** A plan or a report gets `index.html`, `document.css`,
  `source.md` and `meta.json`. A wireframe gets one folder per version (`v1/`,
  `v2/`, ...: `index.html`, a page per screen and state under `screens/`,
  `wireframe.css`, `wireframe.json`), a root `index.html` listing every
  version, one `wireframe.schema.json`, a `README.md` and `meta.json`.
  Versions come from `artifact_revisions` and are never pruned; only Storage
  deletes the folder.
- **Name.** Keyed by the last 6 characters of the artifact id; it keeps its
  name when the title changes. `meta.json` holds the id, kind, title, status,
  revision, session, workspace and dates.
- **When.** Written when an artifact reaches the store and at each new
  revision. After boot the main window walks every artifact in pages of 25 to
  write the missing ones. How the file renders is in
  [artifact-frames.md](artifact-frames.md).

Deleting and keeping:

- Artifacts of deleted sessions keep their row and copy. Storage finds them
  through `sessions.deleted_at`, sizes them with `artifact_mirror_measure`,
  and its Delete removes the folder with `artifact_mirror_remove` (confined to
  the mirror root) before the row; if the row survives, the next backfill
  writes the copy again.
- The Artifacts list's Delete sets the status to `discarded` (Recently
  deleted), and Undo sets it back. Delete permanently, only on a `discarded`
  artifact, removes the folder and then the row, which takes its plan
  consumptions (the Run by history) with it.
- `session_artifacts` stores `kept_at` and `kept_until` for the Storage Keep
  action, and `opened_at`, written when the artifact shell opens it (at most
  once every 10 minutes) and read as `SessionArtifact.openedAt`. A report or
  wireframe nobody opened shows New for 24 hours; an older one never opened
  reads Ready, since older rows have no open time.

## Saved file versions

`file-versions/<session-id>/` holds one copy per version, named
`<version-id>-<file name>`, each with its `file_versions` row. This layout is
what older builds read: changing it is a new on-disk format and a one-way door
([versioning.md](../versioning.md)).

- A session that writes in a `sessions/<name>` folder stages its turn in
  `staging/<run-id>/` until the turn ends. A failed staging removes its run
  folder; one left without its manifest (a crash) is swept by the next begin of
  that run, so a retry is never refused for a leftover.
- A restore copies into a temp file beside the target and renames it
  (`copy_atomic`), so a failed restore never leaves half a file.

## Saved folder versions

`folder-versions/<folder-key>/` versions a plain folder that agents edit in
place, keyed by a hash of its real path. Nothing is written inside the folder,
and older builds never read this one.

- `mirror/`: a copy of the folder (an APFS clone where possible) as of the
  last writing turn's begin or end; `index.json` its size, time and hash per
  file.
- `staging/<run-id>.json`: a turn that began and is not saved yet.
- `turns/<session-id>/<run-id>.json`: each turn's added, modified and deleted
  files with before and after hashes, and each restore. Before copies go to
  `file-versions/<session-id>/` with their rows.

Limits:

- **Not versioned:** files over 15 MB, links, the folders of
  `reproducible_dirs` ([rust-modules.md](rust-modules.md)), `.git`,
  `.DS_Store` and older sessions' `sessions/` folders.
- **Size.** Past 100,000 files or 8 GB, a folder keeps its first files and the
  turn's `skipped` list carries one `folder_limit` entry with `omitted`.
- **Pruning.** A session's versions drop 30 days after it ends (archived or
  deleted), then the oldest over the cap (1 GB or the folder's size, whichever
  is larger), never the newest version of a file a live session changed. Rows
  go only after their copies.

## Outside the folder

A session working on a repository gets its own git worktree in the
repository's `.goodboy/worktrees/` folder, and can have several of one project
([mounts.md](../mounts.md)). `worktree_roots` remembers every repository that
ever held one, even after its project or workspace is gone, and the storage
scan only looks inside `<repo>/.goodboy/worktrees/` of those roots. Sizes count
allocated blocks, like Finder's "size on disk".

A folder project can still hold `<project-root>/sessions/` from an older build.
A new session writes in the project folder itself and adds nothing there.
