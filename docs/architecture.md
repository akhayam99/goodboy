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

### Launching git

Every git process the Rust shell starts goes through one builder,
`proc::git::Git` (`apps/desktop/src-tauri/src/proc/git.rs`). Nothing else in
production code builds a `git` command by hand, and a Rust test fails if it
finds one.

- Every call turns terminal prompts off (`GIT_TERMINAL_PROMPT=0`), sets the
  editors to `true`, and removes an inherited `GIT_DIR`, `GIT_WORK_TREE` and
  `GIT_INDEX_FILE`, so git always reads the repository the call names.
- `batch_auth()` also blanks the askpass helpers and puts ssh in batch mode.
  `worktree::git` uses it; the other callers keep their own auth behavior.
- `login_env()` starts git with the login environment, for the one caller whose
  `pre-push` hook needs it (`run_git_authenticated`).
- Every call has a timeout: 5 minutes for `fetch`, `push`, `pull`, `ls-remote`
  and `clone`, 10 minutes for everything else. When it fires, git and its
  children are killed and the caller gets a `timeout` error.
- A failure comes back as `GitError`, which serializes as `{kind, message}`.
  The message carries the arguments and the stderr with URL credentials
  redacted. `WorktreeError`, `GithubError` and plain `io::Error` callers map it
  without changing their own wire shape.

`spawn_streaming` is the exception to the timeout: the history predictor keeps
one `git merge-tree --stdin` process open for a whole plan, so its caller owns
the lifetime.

### Worktree module

The Rust side of worktrees and branch reads is one module,
`apps/desktop/src-tauri/src/worktree/`. Each file owns one job: `create`,
`remove`, `folder` and `orphans` for the folders on disk, `inspect` and
`detach` for what a folder holds, `base`, `branches` and `merge_state` for
base and branch resolution, `status`, `diff`, `changed_files`, `commits` and
`fast_forward` for reads and updates, `candidates` for agent fixes, `scratch`
and `exclude` for the goodboy directory, `git` for the shared runner, and
`error`, `types` and `slug` for what they share. `mod.rs` only declares the
files and re-exports their items, so callers keep writing
`crate::worktree::git` and lib.rs registers `worktree::worktree_create`. A
helper another file needs is `pub(super)`; nothing else leaves its file. Tests
sit in a `tests.rs` beside the file they cover.

### History module

Rewrite history and Rebase on main run in one Rust module,
`apps/desktop/src-tauri/src/history/`. Each file owns one job: `plan` orders
the steps and resolves the revisions, `merge_tree` and `predict` build the
in-memory prediction, `reservation` and `copies` own the throwaway copies
under the app folder, `trial` and `check` replay a plan in a copy and verify
the result, `journal`, `preflight` and `apply` move the branch safely,
`backups` keeps the restore refs, `run` chains preflight and trial, `rebase`
and `remote` read origin, `rewriter` collects an agent rewrite, and `runner`,
`commits` and `types` hold what they share. `mod.rs` only declares the files
and re-exports the items lib.rs, `turn.rs` and the worktree module use, so
lib.rs still registers `history::history_plan_run` and the other commands by
name. A helper another file needs is `pub(super)`. Tests sit in a `tests.rs`
beside the file they cover; the repository builders more than one group needs
live in the test-only `fixtures.rs`.

### Config export module

Backup and setup export run in one Rust module,
`apps/desktop/src-tauri/src/config_export/`. Each file owns one job: `bundle`
holds the schema version and the bundle structs, `groups` the export groups
and the preview structs, `export` builds a bundle from the database and lists
the findings a writer can leave out, `file` writes the `0600` file, `validate`
checks a bundle, `apply` writes an import in one transaction, `preview`
matches a bundle to what exists, `convert` holds the time, slug and project
helpers, `error` the error enum, and `commands` the four Tauri commands.
`mod.rs` only declares the files and re-exports the commands, so lib.rs still
registers `config_export::config_export_preview` and the others by name. A
helper another file needs is `pub(super)`. Tests sit in a `tests.rs` beside the
file they cover; the connection and project builders more than one group needs
live in the test-only `fixtures.rs`, and `wire_shape_tests.rs` pins the json of
every bundle struct. The writer map below counts Rust writes per file, so the
baseline names `config_export/apply.rs`.

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

### Where commands run

A Tauri command declared as a plain `fn` runs on the main thread, the same
thread that draws the window and handles input. While it works, nothing else in
the app moves. So the split is by what the command does.

- **A command that touches the file system, git, a subprocess or the keychain
  is `async fn`, and its blocking work runs inside
  `tauri::async_runtime::spawn_blocking`.** The command keeps its name,
  arguments and result. A join error becomes the command's own error type
  (`restart_prepare` and `history_git_supported` follow the same shape).
  Worktree, history, config export and import, the git and `gh` wrappers and
  `explore_read` already work this way.
- **A short SQLite call may run inline in an `async fn`.** An async command
  runs on the worker pool, not on the main thread, so a query under the `Db`
  lock does not freeze the window. Anything that can take long still goes
  through `spawn_blocking`.
- **A command that only reads or writes memory stays a plain `fn`.** That
  covers registry lookups, lease bookkeeping and the answers to the frontend
  (`mount_command_result`, `worktree_writer_*`, `frame_stage`).
- **Terminal and provider-login input stays a plain `fn` on purpose.**
  `terminal_write` and `provider_lifecycle_write` send keystrokes, and the main
  thread keeps them in the order they were typed. Two async calls could
  finish out of order.
- **Do not hold a `std::sync::Mutex` guard across an `.await`.** Take the
  lock, copy out what you need and drop it before the next `.await`, or do the
  whole locked section inside `spawn_blocking`.

`command_threading` (a Rust test) scans every `#[tauri::command]` and fails when
a plain `fn` command is not on its short list of in-memory commands. A new
command that does I/O has to be async, or the list has to change in review.

### Logging

Every build, debug and release, starts the log plugin first in `setup`
(`src-tauri/src/logging.rs`), before the query bridge and anything else that
can warn. It writes to one place: a local file, `goodboy.log`, in the system
log folder of the app. That folder is `~/Library/Logs/com.goodboy.desktop/` on
macOS, `~/.local/share/com.goodboy.desktop/logs/` on Linux and
`%LOCALAPPDATA%\com.goodboy.desktop\logs\` on Windows. Nothing is sent
anywhere; a debug build also prints to stdout.

- **Level.** `info` and above. The frontend has no channel into the file: the
  `log` permission is not granted, so a window cannot write to it.
- **Size.** A file rotates at 512 KiB. The plugin keeps the active file and
  the 3 most recent dated archives (`goodboy_<date>_<time>.log`). When two
  rotations land in the same second the plugin renames the older archive to
  `.log.bak`, and its own cleanup never removes those. So `logging::init`
  sweeps them at every start and keeps only the newest. That needs more than
  512 KiB logged in one second, and the one message a stranger could trigger
  on demand, a network peer that connects to the phone listener and fails the
  handshake, is logged at `debug` and never reaches the file. Normal size:
  under about 2.5 MiB. `logging::tests` floods the logger and pins the cap.
- **Access.** The folder is narrowed to the owner (`0700`) on macOS and Linux.
- **Content.** Log a fixed label and a short reason, never a token, a prompt,
  a file's content or a command line. `logging::detail` is the one way to
  print an error: it keeps the first line, hides credentials inside URLs and
  cuts the text at 200 characters.
- **Dropped errors.** `logging::note_failure` and `note_kill_failure` replace
  `let _ =` in process teardown (killing a terminal, script, provider login or
  live child) and in git cleanup (removing scratch and copy worktrees,
  `worktree prune`, `cherry-pick --abort` and the resets after it). A child that
  already exited is not reported. Other `let _ =` are still silent by design:
  event emits to a closed window and best-effort file cleanup.
- **Logging never blocks startup.** `logging::init` builds the logger itself
  and does not register the plugin. If the folder or file cannot be created or
  opened (a `goodboy.log` owned by root after a `sudo` run, a read-only data
  folder), it prints one line to stderr and the app starts with logging off.
- **Before the logger exists.** `db::open` runs before the app, so its
  messages go through `logging::early`: printed to stderr at once, and written
  to the file when `setup` starts the logger (at most 16 lines).

### Opening an artifact outside the app

- **There is no reader window and no print window.** A plan, a report and a
  wireframe render in the app through `ArtifactDocument` (`medium="screen"`,
  themed) and on disk through the same component (`medium="file"`, always
  light). `Open in browser` (`artifact_mirror_open`) opens that file with the
  OS default web browser, never with a `.html` file's default app: macOS asks
  Launch Services directly (`LSCopyDefaultApplicationURLForURL`, via
  `core-foundation-sys`), Windows asks the shell's association API directly
  (`AssocQueryStringW`, via `windows-sys`), both native calls rather than
  shelling out to `defaults`/`reg`, and both fall back to the platform opener
  (`spawn_open`) if resolution fails. Linux always uses that opener, which
  already resolves the default browser through `xdg-open` on its own. `⌘P`
  from there prints, with the browser's own print dialog.
- **The file is never stale.** `meta.json` carries `rendererVersion`
  (`ARTIFACT_RENDERER_VERSION`) beside `revision` and `updatedAt`. Rust's
  `is_current` compares all three, so a restyle that bumps the version alone,
  with no artifact change, marks every mirrored file pending and the
  post-boot backfill rewrites the whole archive.
- **The document carries no runtime style.** No `<style>` element and no
  `style` string built at runtime: Tauri adds a nonce to the CSP and the
  webview then drops `unsafe-inline`. The styles live in `artifactDocument.css`,
  keyed on `data-medium` (`screen` in the app, `file` on disk; `@media print`
  inside `file` covers paper). Every file on disk also carries its own
  `Content-Security-Policy` meta tag (`default-src 'none'; …`), so opening it
  in a browser makes no network call.
- **The artifacts folder is one command away.** The lens's `More` menu opens
  `~/.goodboy/workspaces/<slug>/artifacts/` in the OS file manager
  (`artifact_mirror_open_root`), since `~/.goodboy` itself is hidden.

### Frames

- **A wireframe is shown as its real pages, in an isolated frame.** The app
  never renders a wireframe in its own DOM. The viewer compiles the spec with
  the same renderer that writes the folder (`features/wireframes/wireframePages/`),
  hands the pages to Rust with `frame_stage`, and shows them in an
  `<iframe sandbox="allow-scripts">` on the custom `gbframe` scheme
  (`gbframe://localhost/<stage>/<page>`, `http://gbframe.localhost/...` on
  Windows). `frame_release` drops a stage when the viewer unmounts; stages
  live in memory, at most 16 MB, least recently used out first.
- **The frame has no same origin.** Without `allow-same-origin` its origin is
  opaque: no access to the parent, no cookies, no top navigation, no forms, no
  popups, and no Tauri capability covers it. Every `gbframe` response carries
  its own CSP (`default-src 'none'`, styles and scripts only from `gbframe`,
  `connect-src 'none'`, `form-action 'none'`) and `Cache-Control: no-store`.
  The app CSP only adds `frame-src gbframe: http://gbframe.localhost`.
- **One script of ours, only on the stage.** Rust serves the staged pages with
  one difference from the file on disk: `/_gb/stage.css` and `/_gb/stage.js`
  (`src-tauri/src/frame_stage.*`) in `<head>`. The file never holds them. The
  stylesheet hides the page chrome (`.wf-page-chrome`) so the stage shows the
  screen alone. The script talks to the parent only with `postMessage`:
  `navigated { path, height }` on load, `picked { nodeId, label }` and
  `pickEnded` while Pick is on; from the parent, `pick { isOn }`, `reveal { nodeId }`
  and `variant { variantId }` (sets `data-variant` on the page, which the
  generated stylesheet uses to hide nodes outside that release cut).
  The parent accepts a message only when `event.source` is that iframe's
  `contentWindow` and its shape parses (`frame/frameMessage.ts`). Pages mark
  each node with `data-node` so the script can find it.
- **Agent text reaches the page only escaped.** The renderer escapes every
  string of the spec; no agent string becomes a script, a `style` or an `on*`
  attribute.

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

The runner splits a migration into statements on semicolons, but keeps a
`CREATE TRIGGER ... BEGIN ... END` whole, so a trigger body may hold several
statements. A trigger without its closing `END` fails the migration.

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

Settings > Danger zone > Wipe local database stops every running turn,
summary, planner, script and terminal first. Then `db_wipe` empties the file
in one atomic step with SQLite's own reset (`SQLITE_DBCONFIG_RESET_DATABASE`
plus `VACUUM`), and the chain replays from m001 on the empty file. It never
drops tables one by one: that leaves views like `live_agents` behind, and the
first `ALTER TABLE ... RENAME` of the replay fails on them (see
[traps](traps.md#traps-in-the-toolchain)). Builds before 0.8.0 did exactly
that, so `db::open` checks the file at launch. It finishes the wipe only when
both signs of that old wipe are there: a view reads a table that no longer
exists, and one of `schema_version`, `sessions` or `agents` is missing. It
first checkpoints the WAL and copies the file (with its `-wal` and `-shm`) to
`data.db.pre-reset-<unix seconds>.bak`. If the copy fails, nothing is reset.
Then it runs the same reset before the migrations. A broken view on a
complete schema, and any other migration failure, still show the error
screen.

### Who writes each table

Each table has one writer, and the default writer is `packages/db`: the
migrations, the schema tests and the query functions live there, and the
frontend reaches SQLite through them. Rust writes a table only when the write
has to happen without the webview or inside one Rust transaction: the backup
export and import, a project move, the permission audit, integration
credentials and the budget checks. The unit is the command or the transaction,
not the table. The atomic agent operations moved with the agents: the routing
gate, the fan-out of a delegated batch and the status stamps are guarded
statements in `packages/db/src/queries/agent-write.ts`, and a workflow save is
one transaction in `saveWorkflow`.

The `ts` rows below have a ratchet:
`packages/db/src/migrations/rust-writer-map.test.ts` reads this table, scans
the production SQL in `apps/desktop/src-tauri/src/` and fails when Rust gains an
`INSERT`, `UPDATE` or `DELETE` on a `ts` table beyond the writes it lists as
its baseline. A new table has to appear here first: the same test fails on a
table this map does not name. The rows marked `rust` are written by Rust
commands; TypeScript still reaches some of them (`integration_credentials`,
`integration_bindings`, `permission_rules`, the `permission_audit_log`
cleanup) and moving those calls behind the commands is not done yet.

| Table                         | Writer | Notes                                                                                                               |
| ----------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------- |
| `agent_handoffs`              | ts     |                                                                                                                     |
| `agent_queued_messages`       | ts     |                                                                                                                     |
| `agent_turn_spans`            | ts     |                                                                                                                     |
| `agents`                      | ts     | Inserts, status, routing, viewed and done through `agent-write.ts`. Rust reads only.                                |
| `artifact_provenance`         | ts     |                                                                                                                     |
| `artifact_revisions`          | ts     |                                                                                                                     |
| `budget_alerts`               | rust   | `budget.rs`                                                                                                         |
| `budget_rules`                | rust   | `budget.rs`, and the backup import                                                                                  |
| `chat_messages`               | ts     |                                                                                                                     |
| `chat_session_links`          | ts     |                                                                                                                     |
| `chats`                       | ts     |                                                                                                                     |
| `context_slot_history`        | ts     |                                                                                                                     |
| `context_slots`               | ts     |                                                                                                                     |
| `deleted_branches`            | ts     |                                                                                                                     |
| `diff_comments`               | ts     |                                                                                                                     |
| `file_versions`               | ts     |                                                                                                                     |
| `github_pr_cache`             | ts     |                                                                                                                     |
| `goal_attachments`            | ts     |                                                                                                                     |
| `history_plans`               | ts     |                                                                                                                     |
| `integration_bindings`        | rust   | `integration_credentials.rs`, and the backup import                                                                 |
| `integration_credentials`     | rust   | `integration_credentials.rs`, and the backup import                                                                 |
| `integration_drafts`          | ts     | Exception: the query bridge saves a draft an agent proposes (`query_bridge/dispatch.rs`).                           |
| `messages`                    | ts     |                                                                                                                     |
| `mount_operations`            | ts     | Exceptions: a project move rewrites the paths in the log, and the query bridge writes it (`query_bridge/mount.rs`). |
| `mount_pr_links`              | ts     |                                                                                                                     |
| `notifications`               | ts     |                                                                                                                     |
| `nudge_events`                | ts     |                                                                                                                     |
| `open_questions`              | ts     |                                                                                                                     |
| `permission_audit_log`        | rust   | `permissions.rs`, at hook time                                                                                      |
| `permission_audit_retry`      | rust   | `permissions.rs`                                                                                                    |
| `permission_rules`            | rust   | `permissions.rs`, and the backup import                                                                             |
| `plan_consumptions`           | ts     |                                                                                                                     |
| `pr_review_drafts`            | ts     |                                                                                                                     |
| `pr_series`                   | ts     |                                                                                                                     |
| `pr_series_members`           | ts     |                                                                                                                     |
| `project_relocations`         | rust   | `project_relocation.rs`                                                                                             |
| `project_scripts`             | ts     | Exception: the backup import.                                                                                       |
| `project_sentry_links`        | ts     |                                                                                                                     |
| `projects`                    | ts     | Exceptions: the backup import and a project move.                                                                   |
| `provider_credentials`        | ts     |                                                                                                                     |
| `provider_limits`             | ts     |                                                                                                                     |
| `provider_runs`               | ts     |                                                                                                                     |
| `resolve_attempts`            | ts     | Exception: a project move rewrites `worktree_path`.                                                                 |
| `resolve_batches`             | ts     |                                                                                                                     |
| `resolve_candidate_items`     | ts     |                                                                                                                     |
| `resolve_candidates`          | ts     | Exception: a project move rewrites `worktree_path`.                                                                 |
| `resolve_check_runs`          | ts     |                                                                                                                     |
| `resolve_imports`             | ts     |                                                                                                                     |
| `resolve_publication_threads` | ts     |                                                                                                                     |
| `resolve_publications`        | ts     | Exception: a project move rewrites `worktree_path`.                                                                 |
| `resolve_queue_items`         | ts     |                                                                                                                     |
| `resolve_session_settings`    | ts     |                                                                                                                     |
| `resolve_threads`             | ts     |                                                                                                                     |
| `retained_worktree_paths`     | ts     | Exception: a project move rewrites the paths.                                                                       |
| `schema_migration_segment`    | ts     |                                                                                                                     |
| `schema_version`              | ts     |                                                                                                                     |
| `search_docs`                 | ts     |                                                                                                                     |
| `search_excluded_projects`    | ts     |                                                                                                                     |
| `search_index`                | ts     |                                                                                                                     |
| `search_index_state`          | ts     |                                                                                                                     |
| `security_findings`           | ts     |                                                                                                                     |
| `session_artifacts`           | ts     |                                                                                                                     |
| `session_budgets`             | rust   | `budget.rs`                                                                                                         |
| `session_decisions`           | ts     |                                                                                                                     |
| `session_events`              | ts     |                                                                                                                     |
| `session_external_tasks`      | ts     |                                                                                                                     |
| `session_workflows`           | ts     |                                                                                                                     |
| `session_worktrees`           | ts     | Exception: a project move rewrites the paths.                                                                       |
| `sessions`                    | ts     |                                                                                                                     |
| `settings`                    | ts     | Exceptions: the backup import and the restart marker (`restart_marker.rs`).                                         |
| `skills`                      | rust   | `skills.rs`, next to the skill files on disk, and the backup import                                                 |
| `step_library`                | rust   | `workflows.rs`. Only Rust writes it today; a candidate to move.                                                     |
| `steps`                       | ts     | `saveWorkflow`. Exception: the backup import.                                                                       |
| `telemetry_records`           | ts     |                                                                                                                     |
| `turn_events`                 | ts     |                                                                                                                     |
| `workflows`                   | ts     | `saveWorkflow` and `removeWorkflow`. Exception: the backup import.                                                  |
| `workspace_profiles`          | ts     | Exception: the backup import.                                                                                       |
| `workspace_starred_issues`    | ts     |                                                                                                                     |
| `workspaces`                  | ts     | Exceptions: the backup import and the per-workspace settings override (`settings_overrides.rs`).                    |
| `worktree_roots`              | ts     | Exception: a project move rewrites `repo_root`.                                                                     |

### On-disk data layout

Everything the app saves for itself lives in `~/.goodboy`.

- `data.db`: the SQLite database. Its copies from before each migration (`data.db.pre-m*.bak`) sit next to it, and so does the copy kept before a half-done wipe is finished (`data.db.pre-reset-*.bak`).
- `scratch/<session-id>/`: where a session's turns write before any project is mounted.
- `workspaces/<slug>/artifacts/<date>-<title>-<id>/`: a copy of each plan,
  report and wireframe of that workspace (`artifacts-dev/` for debug builds).
  A plan or a report gets `index.html`, `document.css`, `source.md` and
  `meta.json`. A wireframe gets one subfolder per version (`v1/`, `v2/`, ...:
  `index.html`, one page per screen and per state under `screens/`,
  `wireframe.css` and the version's `wireframe.json`), an `index.html` at the
  root that lists every version with what was asked, one
  `wireframe.schema.json`, a `README.md` and `meta.json`. Versions come from
  `artifact_revisions` and are never pruned; only Storage deletes the folder. The folder is
  keyed by the last 6 characters of the artifact id and keeps its name when
  the title changes; `meta.json` holds the id, kind, title, status, revision,
  session, workspace and dates. It is a mirror: the database is the truth, the
  app never reads these files back except `meta.json` to skip a copy that is
  already current, and deleting a folder breaks nothing. The copy is written
  when an artifact reaches the store and again at each new revision, and
  after boot the main window walks every artifact in pages of 25 to write the
  ones missing on disk. Artifacts of deleted sessions keep their row and their
  copy. The Storage page finds them through `sessions.deleted_at`, sizes their
  copy with `artifact_mirror_measure`, and its Delete removes the folder with
  `artifact_mirror_remove` (confined to the mirror root) before it deletes the
  row. If the row survives a failed delete, the next backfill writes its copy
  again. `session_artifacts`
  also stores `opened_at` (written when the artifact shell opens it, at most
  once per artifact every 10 minutes), `kept_at` and `kept_until` for the
  Storage Keep action.
- `file-versions/`: saved versions of files.
- `query/query-<pid>.sock`: the socket a running app uses for the query bridge, in its own owner-only folder (see [query-bridge.md](query-bridge.md)).
- `history-copies/`: the temporary copies Rewrite history replays a plan in.
- `boot-breadcrumbs.log`: how long each startup step took.

The app log is not in `~/.goodboy`; it lives in the system log folder (see [Logging](#logging)).

When a session works on a repository, it gets its own git worktree in the
repository's `.goodboy/worktrees/` folder ([mounts.md](mounts.md)). A session
can have several worktrees of the same project. The `worktree_roots` table
remembers every repository that ever held one, even after its project or
workspace is gone, and the storage scan only ever looks inside
`<repo>/.goodboy/worktrees/` of those roots. Sizes count allocated blocks,
the way Finder's "size on disk" does.

Two things live next to your code instead of in `~/.goodboy`. A folder
project keeps its session folders in `<project-root>/sessions/`. Skills live
in `<project-root>/.kay/skills/` or `<project-root>/.claude/skills/`.

### How mounts are saved and recovered

The mount table, the operation log, recovery and cleanup are described in
[mounts.md](mounts.md).

### Moving a project's folder

`projects.root_path`, `session_worktrees.worktree_path` and
`last_worktree_path`, `retained_worktree_paths`, `worktree_roots`,
`resolve_candidates`/`resolve_attempts`/`resolve_publications`,
`skills.file_path` and `mount_operations` all store absolute paths. Moving a
project's folder on disk (a new drive, `~/nerd` to `~/github`) does not touch
the database: every saved path still points at the old location, so the
project reads as `missing` and its sessions read as `unavailable`, the same
non-destructive state as a disconnected disk (see
[mounts.md](mounts.md)). Nothing is lost; git's own worktree links inside the
repo point at the old absolute path too, until `git worktree repair` runs
again from the new root.

`projects.root_commit` and `projects.remote_url` hold the repository's
identity (`repo_identity`: the root commit(s) from
`git rev-list --max-parents=0 HEAD`, and `origin`'s URL normalized without
credentials or a trailing `.git`), written when a project is linked, when it
is reconnected, and once in the background the first time its git status
comes back `ready` after boot. It never leaves the local database.

Relocating a project (`project_relocate` in
`apps/desktop/src-tauri/src/project_relocation.rs`) rewrites every table
above by path prefix inside one transaction, checks the `UNIQUE` constraints
on `projects.root_path` and `session_worktrees.worktree_path` first, and
calls `git worktree repair` from the new root once the commit lands. Finding
candidate folders (`find_moved_projects`) reads one level under a chosen
parent, computes `repo_identity` for each, and matches saved projects by
identity first and by folder name second; the desktop UI is
`features/workspace/components/LocateMovedProjects/`, backed by the
`project-relocation` store slice. `Undo move` reverses the same rewrite
through `project_relocation_undo`.

### Backup and setup export

Settings › App › Backup reads and writes a JSON bundle, schema version 3
(`apps/desktop/src-tauri/src/config_export/`, mirrored in
`packages/types/src/config-bundle.ts`). What goes in is chosen per group
(`ExportGroups`): workspaces, projects, folder paths, profile, workflows you
made, workflows the orchestrator wrote, saved scripts, permission rules,
budget rules, linked integrations and app preferences. Folder paths and
orchestrator-written workflows are off by default; every other group is on.
Never included, in any bundle: API keys and tokens, sign-ins, sessions and
transcripts, artifacts, worktree folders, usage history, notifications.
A workspace's JSON-shaped overrides (provider bindings, task models, role
models, provider pool) carry as nested JSON values in the bundle, not
string-encoded text; a bundle written before this stayed compatible through
a deserializer that still accepts the old `*Json` string fields.

Before a write, `config_export_preview` reports which open security findings
(`security_findings`, see [SECURITY.md](../SECURITY.md)) fall inside the
selected groups; `config_export_write` takes an explicit `leaveOut` list of
fingerprints and skips that finding's subject (a script, a permission rule,
a workspace's profile) entirely. The file is written with `0600` permissions.

Import is a read-only preview followed by an explicit apply, never one step:
`config_import_preview` matches each bundle workspace to an existing one by
id then by name, and matches each project without a folder path against
candidate folders under a chosen parent, reusing `find_moved_projects` from
project relocation (one matching engine, two call sites). The caller then
picks, per workspace, `merge into <existing>` or `add as a new workspace`,
and resolves a folder for projects the engine could not place, before calling
`config_import_apply`. The preview also returns `groupStats`, a per-group
adds/updates tally (workspaces, projects, skills, workflows, permission
rules, budget rules, scripts, linked integrations) computed by checking each
bundle row against the local database before any write, so the confirm step
shows what will change instead of only a post-apply count. Import only
inserts and updates; it never deletes a row, and a project it cannot resolve
a folder for is skipped and counted, not dropped from the file.
