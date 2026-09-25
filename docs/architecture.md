# Repo architecture

> **Read this when** you are changing how the app runs things: the environment
> agents start with, how providers are picked, the boot path, git status reads,
> or database migrations. **Not for**
> deciding where new code goes inside `apps/desktop/src/` (see
> [file-system.md](file-system.md)).

Goodboy has four pieces that work together.

- The **desktop shell** is written in Rust with Tauri. It talks to the operating system and reads and writes files.
- The **frontend** is written in React. It draws the board and every session.
- The **local database** is SQLite. It holds everything the app remembers.
- The **provider CLIs** are Claude, Codex, Cursor and the others. They run your agents as separate processes.

Here is how a task moves through them. You start a session in the frontend.
The shell starts the provider CLI you picked, in the right folder and with the
right environment. The provider sends its work back as it goes. The shell
saves every step in SQLite. The frontend reads it from there to show you, and
the next agent reads it to pick up where the last one stopped.

This page walks through each of those systems. For how `src/` is laid out
inside the app, see [file-system.md](file-system.md). For the tools that run
the whole repo, see [CONVENTIONS.md](../CONVENTIONS.md).

## Under the hood

### Subprocess environment

When you open an app from Finder or the Dock on macOS or Linux, it gets a
bare environment. It does not get the variables your terminal has. The Rust
shell asks your login shell for the real environment and passes it on to the
processes it starts (`apps/desktop/src-tauri/src/path_env.rs`).

Which helper to use depends on what the process runs.

- If it runs a script the user wrote, it gets the full login environment. Use `command_with_login_env`, or `resolved_env()` for terminal spawners that never build a `Command`.
- Everything else gets only `PATH`. Use `command`.

`run_git_push` gets the full environment. A repo's `pre-push` hook can read
variables set in `~/.zshrc`, like registry tokens or tool settings. `skill_run_script`
gets it too, because a skill script is the user's own bash. `PATH`
and `TERM` are set after the login environment is copied, so they win over
anything your profile sets.

`login_shell()` is the one place that decides which shell to use. The built-in
terminal and the environment check always agree because both ask it.

If a push fails because a variable is missing, do not skip hooks with
`git push --no-verify`. Pass the environment through instead. This layer runs
on macOS and Linux.

### Provider routing

- The list of models is built into the app, not saved in the database. Each model's id, family, cost tier, effort levels, context window, routing weight and price are written in the provider catalogs under `packages/core/src/providers/`. Every model the app can run ships with the app. When the list changes, there is no row to edit and no migration to write.
- SQLite only stores your choices on top of that list, per workspace, project or session. A saved value points at a model. It never defines one.
- The app checks each saved choice against the built-in list when it reads it. If a provider or model id is no longer in the list, the app uses the built-in default instead of trying to start it. So removing a model from a catalog never breaks a workspace that picked it.

### Boot path

- **No command on the boot path blocks the UI thread.** Every Tauri command
  the boot sequence reaches that touches the database, the file system, a lock
  or a subprocess is async where it is declared
  ([ADR 002](adr/002-boot-path-leaves-the-ui-thread.md)).
- **The boot path starts no provider process, and `ready` says nothing about
  providers.** Providers start as `unknown` and are detected after boot,
  through one refresh entry point
  ([ADR 003](adr/003-provider-detection-leaves-the-boot-path.md)).

### Git status reads

- **A git read fails closed.** Distances and the working tree are `known` or
  `unknown` with a named reason. A zero never stands in for a failed read. An
  unknown never shows as a claim about the repository and never enables a
  change. A command that changes git passes its own safety config where it is
  called, and `git()` stays unaware of config
  ([ADR 004](adr/004-git-reads-fail-closed.md)).

### Database migrations

Each migration is one file, `mNNN-kebab-name.ts`, in
`packages/db/src/migrations/`. It exports one SQL string named `mNNNName`.
Register it in `index.ts` with the version number from its filename. Once a
migration has shipped, never edit it.

The runner (`runner.ts`) keeps a list of every version it has applied, not
only the highest one. It skips any version already in `schema_version`. So if
two branches both add version N, the second one to merge never runs on
machines that already ran the first. Nothing warns you, and it never catches
up. Give it a new number before you merge. Once the numbers are different,
two migrations that touch different tables can run in any order.

The runner splits each migration into parts wherever a `PRAGMA foreign_keys`
line appears. Each part commits on its own and saves a checkpoint row in
`schema_migration_segment`. If a migration stops halfway, the next start picks
up at the next part, so nothing is left half done. Only the last part writes
to `schema_version` and clears the checkpoints. If a statement fails with
"already exists" or "duplicate column name", the runner treats it as done. It
logs a warning and keeps going.

`registry.test.ts` guards all of this. It fails CI when two migrations share a
version, when a version number is skipped, or when a filename does not match
its registered version. It also checks that upgrading from every older
version ends up with the exact same schema as a fresh install.

When the app starts and a database file has migrations waiting, the runner
first saves a copy next to it with `VACUUM INTO`. The copy is named
`data.db.pre-m<next>-from-m<current>-<timestamp>.bak`. Here `<next>` is the
lowest version waiting to run, the one the copy protects you from.
`<current>` is the highest version already applied, the schema the file
really has. Copies made before 0.3.0 use the older name
`data.db.pre-m<current>-<timestamp>.bak`. The runner handles both. It finds
copies by the `data.db.pre-m` prefix and reads their age from the timestamp
at the end. It keeps the two newest and deletes the rest. If saving the copy
fails, no migration runs.

These copies are how you roll back a migration that cannot be undone. From
m117 on, 0.1.x builds cannot read the schema
([ADR 001](adr/001-workspace-project-rename.md)). To go back, restore the copy.
Installing an older version of the app on top does not work.

The runner refuses to open a file that holds a migration newer than any this
build knows. It throws `DatabaseFromNewerBuildError` before it takes a copy or
runs anything. The app then shows a full-window screen: "This database was
upgraded by a newer Goodboy." `schema_version` does not record which app
version applied a migration, so the screen cannot name it. The screen offers
two ways out. It can restore the newest copy whose schema this build can read,
or it can quit. Restoring moves the current file aside as
`data.db.newer-build-<ms>.bak`, so nothing is lost, puts the copy in its place,
and starts the boot again.

### On-disk data layout

Everything the app saves for itself lives in `~/.goodboy`.

- `data.db`: the SQLite database. Its copies from before each migration (`data.db.pre-m*.bak`) sit next to it.
- `scratch/<session-id>/`: where a session's turns write before any project is mounted.
- `file-versions/`: saved versions of files.
- `query-<pid>.sock`: the socket a running app uses for the query bridge (see [query-bridge.md](query-bridge.md)).
- `boot-breadcrumbs.log`: how long each startup step took.

When a session works on a repository, it gets its own git worktree in the
repository's `.goodboy/worktrees/` folder ([mounts.md](mounts.md)). A session
can have several worktrees of the same project.

Two things live next to your code instead of in `~/.goodboy`. A folder
project keeps its session folders in `<project-root>/sessions/`. Skills live
in `<project-root>/.kay/skills/` or `<project-root>/.claude/skills/`.

### How mounts are saved and recovered

The mount table, the operation log, recovery and cleanup are described in
[mounts.md](mounts.md).
