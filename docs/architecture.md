# Repo architecture

> **Read this when** you're touching runtime systems around the app:
> subprocess environment, provider routing, database migrations. **Not for**
> where new code goes inside `apps/desktop/src/` (see
> [file-system.md](file-system.md)).

Goodboy is four pieces working together: a **desktop shell** (Rust, via
Tauri) that owns the OS process and the filesystem, a **frontend** (React)
that renders the board and every session, a **local database** (SQLite) that
holds everything the app remembers, and the **provider CLIs** (Claude, Codex,
Cursor and the rest) that actually run your agents as subprocesses.

A task's life through those pieces looks like this: you start a session in
the frontend, the shell spawns the provider CLI you picked with the right
environment and working directory, the provider streams its work back over
that subprocess, and the shell records every step in SQLite so the frontend
can show it and the next agent can pick up where the last one left off.

This page covers each of those runtime systems in turn. For the in-app `src/`
layout, see [file-system.md](file-system.md). For monorepo tooling, see
[CONVENTIONS.md](../CONVENTIONS.md).

## Under the hood

### Subprocess environment

macOS and Linux GUI apps launched from Finder or the Dock inherit a minimal
environment, not the one your terminal has. The Rust shell resolves the real
environment from your login shell and replays it onto spawned processes
(`apps/desktop/src-tauri/src/path_env.rs`).

The rule that decides which helper to use: anything running a user-authored
script body replays the login environment (`command_with_login_env`, or
`resolved_env()` for pty spawners that never build a `Command`). Everything
else takes `PATH` only (`command`). `run_git_push` replays the environment
because a repo's `pre-push` hook can read variables exported in `~/.zshrc`,
such as registry tokens or tool config. `PATH` and `TERM` are applied after
the replay, so they win over whatever the profile exported.

`login_shell()` is the single source of truth for which shell to use, so the
embedded terminal and the environment probe never disagree.

Never skip hooks (`git push --no-verify`) to dodge a missing-environment
failure. Replay the environment instead. This subprocess-environment layer
is macOS and Linux only: Windows has no login-shell probe.

### Provider routing

- The model registry is compiled, not stored. Ids, family, cost tier, effort
  ladder, context window, routing weight and price are authored in the
  provider catalogs under `packages/core/src/providers/`. A model the app
  can run ships with the app, so there is no row to edit and no migration to
  write when the registry changes.
- SQLite holds the overrides on top of that registry, and nothing else, at
  workspace, project and session scope. A stored value is a pin, never the
  definition of the thing it pins.
- A stored pin is validated against the registry at read time. A provider or
  model id the registry no longer carries falls back to the compiled default
  instead of reaching a spawn, so removing a model from a catalog can't
  brick a workspace that pinned it.

### Database migrations

Each migration is one file, `mNNN-kebab-name.ts` under
`packages/db/src/migrations/`, exporting a single `mNNNName` SQL string.
Register it in `index.ts` at the version number in its filename. Never edit a
migration after it has shipped.

The runner (`runner.ts`) keeps a set of applied versions, not a high-water
mark: a version already present in `schema_version` is skipped. So if two
branches both add version N, whichever merges second finds N already applied
on every machine that ran the first, and its migration never runs, silently
and permanently. Renumber before merging. Two migrations that touch
different tables need no ordering between them once renumbered.

Each migration is split into segments at `PRAGMA foreign_keys` boundaries.
Every segment commits on its own and writes a checkpoint row in
`schema_migration_segment`, so an interrupted migration resumes at the next
segment instead of half-applying. Only the final segment stamps
`schema_version` and clears the checkpoints. A statement that fails with
"already exists" or "duplicate column name" is treated as already applied:
warned, not fatal.

`registry.test.ts` is the guard. It fails CI on a duplicate version, a gap in
the version range, or a filename that disagrees with its registered version,
and it asserts that upgrading from every intermediate version reaches the
exact schema of a fresh install.

When a file database has pending migrations at boot, the runner first writes
a snapshot next to the database via `VACUUM INTO`:
`data.db.pre-m<next>-from-m<current>-<timestamp>.bak`, where `<next>` is the
lowest pending version (what the snapshot protects against) and `<current>`
is the highest applied version at that moment (the schema the file actually
holds). Snapshots written before 0.3.0 use the older
`data.db.pre-m<current>-<timestamp>.bak` shape. Both are recognised and
pruned: listing keys off the `data.db.pre-m` prefix, age off the trailing
timestamp. The two newest snapshots are kept, older ones are removed, and a
snapshot failure aborts the migrations before any of them runs.

This is the rollback path for irreversible migrations. From m117 onward the
schema is unreadable by 0.1.x builds ([ADR 001](adr/001-workspace-project-rename.md)),
so going back means restoring the snapshot file, not downgrading the app in
place.

### On-disk data layout

Everything the app writes for itself lives under `~/.goodboy`:

- `data.db`: the SQLite database. Its pre-migration snapshots
  (`data.db.pre-m*.bak`) sit next to it.
- `sessions/<workspace-slug>/<session-slug>-<id>/`: a session's container
  directory, for workspaces that didn't configure their own sessions root.
- `workspaces/<slug>/PROFILE.md`: a one-way projection of a workspace's
  profile. The database row is the source of truth and the file is never
  read back.
- `file-versions/`: the captured file version blobs.
- `query-<pid>.sock`: the query bridge socket of a running instance (see
  [query-bridge.md](query-bridge.md)).
- `boot-breadcrumbs.log`: boot phase timings.

Repository project mounts use dedicated git worktrees under the repository's
`.goodboy/worktrees/` directory instead. Several mounts of one project can
belong to the same session.

Two things live with your code instead of under `~/.goodboy`: a folder
project's session directories, under `<project-root>/sessions/`, and skills,
under `<project-root>/.kay/skills/` or `<project-root>/.claude/skills/`.

### Mount persistence and recovery

`session_worktrees` is the logical mount table. Its row id is the mount
identity. A project id identifies the repository that owns the mount, not
one checkout of it. Each mount owns its current branch, a nullable current
path, its last path, attachment state, disk observation and revision. The
active mount is stored on the session.

Pull request ownership lives in `mount_pr_links`, independently of the
branch-keyed provider caches, so a switch can clear the current provider
projection without deleting request history. `pr_series` and
`pr_series_members` store explicit grouping and order. They don't infer a
stack from commits.

Filesystem and provider mutations go through `mount_operations` with a
caller-owned request id. The operation is recorded before the external
action, so startup can finish a database transition when the worktree
already exists or has already disappeared, and provider creation refreshes
the remote before retrying. These checks make retry idempotent across the
observable interruption points, though they can't infer an unrecorded
historical request.

Hydration and archive restoration inspect every stored repository worktree
before projecting it as writable. A missing path is detached, kept as the
last path, and marked missing. Cleanup transfers dirty or otherwise unsafe
paths to `retained_worktree_paths` when the owning lifecycle needs to
continue. Every cleanup entry point shares the same checked Rust removal
boundary, and local branches are preserved.
