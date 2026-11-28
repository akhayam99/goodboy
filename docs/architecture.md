# Repo architecture

> **Read this when** you are changing how the app runs things: the boot path,
> the processes it starts and stops, the environment agents start with, git
> reads, how providers are picked, database migrations, who writes each table,
> or the files the app keeps on disk. **Not for** deciding where new code goes
> inside `apps/desktop/src/` (see [file-system.md](file-system.md)) or a trap
> that looks like a bug (see [traps.md](traps.md)).

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

This page is the index. It keeps a short summary under each heading other docs
link to, and the writer map, which a test reads here. The detail lives in
[architecture/](architecture/). For the tools that run the whole repo, see
[CONVENTIONS.md](../CONVENTIONS.md).

## Pages

Startup and the window:

- [boot.md](architecture/boot.md): the launch order, the shell before data,
  light agent rows, idle work.
- [commands.md](architecture/commands.md): a plain `fn` or an `async fn` for a
  Tauri command.
- [frontend.md](architecture/frontend.md): hidden pages, render errors, the
  code highlighter.
- [logging.md](architecture/logging.md): what a log line may hold, where the
  log lives, rotation.

Processes:

- [environment.md](architecture/environment.md): which environment a process
  gets, the login shell probe.
- [processes.md](architecture/processes.md): the spawn tag, the reap, the
  ledger, side jobs, quiet turns.
- [monitor.md](architecture/monitor.md): the machine snapshot, stopping a
  process, port attribution.
- [terminal-output.md](architecture/terminal-output.md): how a pty's output is
  kept and replayed, the script ledger.

Git and files:

- [git.md](architecture/git.md): the git builder, status reads, host outages,
  file sides, identifier peek.
- [rust-modules.md](architecture/rust-modules.md): the worktree, history and
  config export modules, rebuildable folders.
- [file-access.md](architecture/file-access.md): paths under a root, dropped
  files, folder removal.
- [mounts.md](mounts.md): how mounts are saved and recovered.

Data:

- [migrations.md](architecture/migrations.md): the runner, the schema gate,
  copies, a newer build, a wipe.
- [table-writers.md](architecture/table-writers.md): why each table has one
  writer, what Rust reads, the ratchet.
- [auto-tree-registry.md](architecture/auto-tree-registry.md): the Auto tables
  and the engine's transactions.
- [data-layout.md](architecture/data-layout.md): what lives under
  `~/.goodboy`, the artifact mirror, saved versions.
- [project-move.md](architecture/project-move.md): finding and relocating a
  moved project folder.
- [backup.md](architecture/backup.md): what a backup bundle carries and how an
  import applies.

Text from outside:

- [artifact-frames.md](architecture/artifact-frames.md): the wireframe frame
  and artifact files outside the app.
- [untrusted-text.md](architecture/untrusted-text.md): text a stranger wrote,
  in a prompt, a renderer, a table or a fetch.

## Under the hood

### Boot path

No command on the boot path blocks the UI thread, and the boot path starts no
provider process. The shell shows before the data, and the launch order,
`LaunchReads` and the light agent rows are in
[architecture/boot.md](architecture/boot.md).

### Subprocess environment

A script the user wrote and a push get the full login environment; everything
else gets the resolved `PATH` on top of the app's own environment
(`apps/desktop/src-tauri/src/path_env.rs`). The helpers are in
[architecture/environment.md](architecture/environment.md).

### Processes Goodboy starts

Start and stop processes through `src-tauri/src/proc`. Every spawn carries a
tag, and the reap ends everything that carries it
([architecture/processes.md](architecture/processes.md)).

### Provider routing

- The list of models is built into the app, in the provider catalogs under `packages/core/src/providers/`: each model's id, family, cost tier, effort levels, context window, routing weight and price. When the list changes, there is no row to edit and no migration to write.
- SQLite only stores your choices on top of that list, per workspace, project or session. A saved value points at a model. It never defines one.
- The app checks each saved choice against the built-in list when it reads it. If a provider or model id is no longer in the list, the app uses the built-in default, so removing a model from a catalog never breaks a workspace that picked it.

### Database migrations

To add one, follow [recipes/migration.md](recipes/migration.md). How the
runner works is in [architecture/migrations.md](architecture/migrations.md).
The rules:

- Once a migration has shipped, never edit it. `registry.test.ts` pins every
  shipped body by SHA-256.
- A version is never reused. The runner skips any version already in
  `schema_version`, so if two branches both add version N, the second to merge
  never runs on machines that ran the first, and nothing warns you. Give it a
  new number before you merge.
- No query reaches a table before the migrations of this build are applied
  (the schema gate). A migration that throws records no version, and the
  launch error screen offers Retry.
- A copy of a database that holds data is taken before a migration runs.
  Restoring it is how you roll back a migration that cannot be undone;
  installing an older build on top does not work.

### Who writes each table

Each table has one writer, and the default writer is `packages/db`; Rust
writes a table only when the write must happen without the webview or inside
one Rust transaction. `packages/db/src/migrations/rust-writer-map.test.ts`
reads the table below and fails on a new write across the line or a table the
map does not name ([architecture/table-writers.md](architecture/table-writers.md)).

| Table                         | Writer | Notes                                                                                                                                                                                                                                                                                                                                |
| ----------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `agent_handoffs`              | ts     |                                                                                                                                                                                                                                                                                                                                      |
| `agent_queued_messages`       | ts     |                                                                                                                                                                                                                                                                                                                                      |
| `agent_turn_picks`            | ts     | One row per agent turn whose model has a known cause (m246), written by `recordTurnPick` after the span: `lead`, `fallback` (the guard replaced the Lead's pick), `pinned` (a role pin or a lock) or `best` (no pick named). Read from the helper's stored pick or the step's routing decision. Rows go with their span.             |
| `agent_turn_spans`            | ts     |                                                                                                                                                                                                                                                                                                                                      |
| `agents`                      | ts     | Inserts, status, routing, viewed and done through `agent-write.ts`; Move to Auto inserts the Auto agent in its transfer. `mount_id` (m233) is written once at insert by `spawnAgent`, and only when that worktree row exists; removing the worktree sets it to NULL and keeps the agent. Rust reads only.                            |
| `artifact_comments`           | ts     |                                                                                                                                                                                                                                                                                                                                      |
| `artifact_provenance`         | ts     |                                                                                                                                                                                                                                                                                                                                      |
| `artifact_revisions`          | ts     |                                                                                                                                                                                                                                                                                                                                      |
| `auto_artifact_versions`      | ts     |                                                                                                                                                                                                                                                                                                                                      |
| `auto_artifacts`              | ts     |                                                                                                                                                                                                                                                                                                                                      |
| `auto_attempts`               | ts     |                                                                                                                                                                                                                                                                                                                                      |
| `auto_delegations`            | ts     |                                                                                                                                                                                                                                                                                                                                      |
| `auto_grants`                 | ts     | One row per ask of a Lead for a dependency, a protected file or a pull request (m243, [auto.md](auto.md)). Rows go with the tree.                                                                                                                                                                                                    |
| `auto_outbox`                 | ts     |                                                                                                                                                                                                                                                                                                                                      |
| `auto_reservations`           | ts     |                                                                                                                                                                                                                                                                                                                                      |
| `auto_trees`                  | ts     | Auto tree registry (`store/runtime/auto/`). Nothing in Rust writes it.                                                                                                                                                                                                                                                               |
| `browser_tabs`                | rust   | `browser/tab_rows.rs`. Url and title only, never cookies or page content ([browser.md](browser.md)). Rows of a session go with it; a pin goes with its project.                                                                                                                                                                      |
| `browser_visits`              | rust   | `browser/visit_rows.rs`. Url, title and the last visit time, at most 200 per session ([browser.md](browser.md)). Rows go with the session, and with its tab rows on archive.                                                                                                                                                         |
| `budget_alerts`               | rust   | `budget.rs`                                                                                                                                                                                                                                                                                                                          |
| `budget_rules`                | rust   | `budget.rs`, and the backup import                                                                                                                                                                                                                                                                                                   |
| `chat_message_attachments`    | ts     | Rows go in with their message through `insertChatMessage`. Rust reads them to build a turn's image root.                                                                                                                                                                                                                             |
| `chat_messages`               | ts     |                                                                                                                                                                                                                                                                                                                                      |
| `chat_session_links`          | ts     |                                                                                                                                                                                                                                                                                                                                      |
| `chats`                       | ts     |                                                                                                                                                                                                                                                                                                                                      |
| `context_slot_history`        | ts     |                                                                                                                                                                                                                                                                                                                                      |
| `context_slots`               | ts     |                                                                                                                                                                                                                                                                                                                                      |
| `deleted_branches`            | ts     |                                                                                                                                                                                                                                                                                                                                      |
| `diff_comments`               | ts     |                                                                                                                                                                                                                                                                                                                                      |
| `file_versions`               | ts     |                                                                                                                                                                                                                                                                                                                                      |
| `github_pr_cache`             | ts     |                                                                                                                                                                                                                                                                                                                                      |
| `goal_attachments`            | ts     |                                                                                                                                                                                                                                                                                                                                      |
| `history_plans`               | ts     |                                                                                                                                                                                                                                                                                                                                      |
| `integration_bindings`        | rust   | `integration_credentials.rs`, and the backup import                                                                                                                                                                                                                                                                                  |
| `integration_credentials`     | rust   | `integration_credentials.rs`, and the backup import                                                                                                                                                                                                                                                                                  |
| `integration_drafts`          | ts     | Exception: the query bridge saves a draft an agent proposes (`query_bridge/dispatch.rs`).                                                                                                                                                                                                                                            |
| `messages`                    | ts     |                                                                                                                                                                                                                                                                                                                                      |
| `mount_operations`            | ts     | Exceptions: a project move rewrites the paths in the log, and the query bridge writes it (`query_bridge/mount.rs`).                                                                                                                                                                                                                  |
| `mount_pr_links`              | ts     |                                                                                                                                                                                                                                                                                                                                      |
| `notifications`               | ts     |                                                                                                                                                                                                                                                                                                                                      |
| `nudge_events`                | ts     |                                                                                                                                                                                                                                                                                                                                      |
| `open_questions`              | ts     |                                                                                                                                                                                                                                                                                                                                      |
| `permission_audit_log`        | rust   | `permissions.rs`, at hook time                                                                                                                                                                                                                                                                                                       |
| `permission_audit_retry`      | rust   | `permissions.rs`                                                                                                                                                                                                                                                                                                                     |
| `permission_rules`            | rust   | `permissions.rs`, and the backup import                                                                                                                                                                                                                                                                                              |
| `plan_consumptions`           | ts     |                                                                                                                                                                                                                                                                                                                                      |
| `pr_review_drafts`            | ts     |                                                                                                                                                                                                                                                                                                                                      |
| `pr_series`                   | ts     |                                                                                                                                                                                                                                                                                                                                      |
| `pr_series_members`           | ts     |                                                                                                                                                                                                                                                                                                                                      |
| `project_relocations`         | rust   | `project_relocation.rs`                                                                                                                                                                                                                                                                                                              |
| `project_scripts`             | ts     | Exception: the backup import.                                                                                                                                                                                                                                                                                                        |
| `project_sentry_links`        | ts     |                                                                                                                                                                                                                                                                                                                                      |
| `project_values`              | ts     | Per-folder values (`folder.purpose`, `folder.git`), keys registered in `queries/entity-value.ts`; deleted with the project. The backup does not carry them.                                                                                                                                                                          |
| `projects`                    | ts     | Exceptions: the backup import and a project move.                                                                                                                                                                                                                                                                                    |
| `provider_credentials`        | ts     |                                                                                                                                                                                                                                                                                                                                      |
| `provider_limits`             | ts     |                                                                                                                                                                                                                                                                                                                                      |
| `provider_runs`               | ts     |                                                                                                                                                                                                                                                                                                                                      |
| `resolve_attempts`            | ts     | Exception: a project move rewrites `worktree_path`.                                                                                                                                                                                                                                                                                  |
| `resolve_batches`             | ts     |                                                                                                                                                                                                                                                                                                                                      |
| `resolve_candidate_items`     | ts     |                                                                                                                                                                                                                                                                                                                                      |
| `resolve_candidates`          | ts     | Exception: a project move rewrites `worktree_path`.                                                                                                                                                                                                                                                                                  |
| `resolve_check_runs`          | ts     |                                                                                                                                                                                                                                                                                                                                      |
| `resolve_imports`             | ts     |                                                                                                                                                                                                                                                                                                                                      |
| `resolve_publication_threads` | ts     |                                                                                                                                                                                                                                                                                                                                      |
| `resolve_publications`        | ts     | Exception: a project move rewrites `worktree_path`.                                                                                                                                                                                                                                                                                  |
| `resolve_queue_items`         | ts     |                                                                                                                                                                                                                                                                                                                                      |
| `resolve_session_settings`    | ts     |                                                                                                                                                                                                                                                                                                                                      |
| `resolve_threads`             | ts     |                                                                                                                                                                                                                                                                                                                                      |
| `retained_worktree_paths`     | ts     | Exception: a project move rewrites the paths.                                                                                                                                                                                                                                                                                        |
| `schema_migration_segment`    | ts     |                                                                                                                                                                                                                                                                                                                                      |
| `schema_version`              | ts     |                                                                                                                                                                                                                                                                                                                                      |
| `search_docs`                 | ts     |                                                                                                                                                                                                                                                                                                                                      |
| `search_excluded_projects`    | ts     |                                                                                                                                                                                                                                                                                                                                      |
| `search_index`                | ts     |                                                                                                                                                                                                                                                                                                                                      |
| `search_index_state`          | ts     |                                                                                                                                                                                                                                                                                                                                      |
| `security_findings`           | ts     |                                                                                                                                                                                                                                                                                                                                      |
| `session_artifacts`           | ts     |                                                                                                                                                                                                                                                                                                                                      |
| `session_budgets`             | rust   | `budget.rs`                                                                                                                                                                                                                                                                                                                          |
| `session_context_items`       | ts     | Learnings and role notes. They outlive the session; only a workspace delete removes them.                                                                                                                                                                                                                                            |
| `session_decisions`           | ts     |                                                                                                                                                                                                                                                                                                                                      |
| `session_dock_grids`          | ts     | The dock grid of a session (m244, written by `saveSessionDockGrid`): the last write wins between windows, and the row goes with its session ([home-and-drawer.md](navigation/home-and-drawer.md#the-grid-saved-on-the-session)).                                                                                                     |
| `session_events`              | ts     |                                                                                                                                                                                                                                                                                                                                      |
| `session_external_tasks`      | ts     |                                                                                                                                                                                                                                                                                                                                      |
| `session_workflows`           | ts     |                                                                                                                                                                                                                                                                                                                                      |
| `session_worktrees`           | ts     | Exception: a project move rewrites the paths.                                                                                                                                                                                                                                                                                        |
| `sessions`                    | ts     |                                                                                                                                                                                                                                                                                                                                      |
| `settings`                    | ts     | Exceptions: the backup import and the restart marker (`restart_marker.rs`).                                                                                                                                                                                                                                                          |
| `skills`                      | rust   | The Skills feature is gone. Only the backup import (`config_export/apply.rs`) and a project move still write it, and the rows stay for a downgrade.                                                                                                                                                                                  |
| `step_library`                | rust   | `workflows.rs`. Only Rust writes it today; a candidate to move.                                                                                                                                                                                                                                                                      |
| `steps`                       | ts     | `saveWorkflow`. Exception: the backup import.                                                                                                                                                                                                                                                                                        |
| `telemetry_records`           | ts     |                                                                                                                                                                                                                                                                                                                                      |
| `thread_reads`                | ts     | One row per review thread shown in the Comments tab (m239, [review.md](features/review.md)). Rows go with the session.                                                                                                                                                                                                               |
| `turn_admissions`             | ts     | One row per agent between a turn's claim and its spawn (m242, [turns.md](turns.md)). `turn_spawn` refuses a run whose row is gone. Rows go with the agent.                                                                                                                                                                           |
| `turn_events`                 | ts     |                                                                                                                                                                                                                                                                                                                                      |
| `turn_file_sets`              | ts     | One row per writing turn and git mount, written when the turn ends (`recordTurnFileSets`).                                                                                                                                                                                                                                           |
| `work_events`                 | rust   | `work_ledger.rs`. One row per run of work born in a Rust process; today each script run, started and then ended by `scripts.rs`. `run_id` is unique, so a second window never writes a run twice. `kind` has no CHECK list: `queries/work-events.ts` holds the kinds and drops one it does not know. Rows go with the session.       |
| `workflows`                   | ts     | `saveWorkflow` and `removeWorkflow`. Exception: the backup import. m246 adds `entry_check`, `stop_rule`, `then_suggest_id` (no foreign key, a missing one reads as none) and `is_order_kept`. A save that leaves one out keeps the stored value; NULL is never set, which the seeder fills on a built in, and empty text is cleared. |
| `workspace_profiles`          | ts     | Exception: the backup import.                                                                                                                                                                                                                                                                                                        |
| `workspace_starred_issues`    | ts     |                                                                                                                                                                                                                                                                                                                                      |
| `workspace_values`            | ts     | Per-workspace values (`auto.level`, `run.guidance`, `run.limit`, `run.locks`, `terminal.workspaceFolder`, `sessions.pinned`, `home.layout`, `session.language`), keys registered in `queries/entity-value.ts`; deleted with the workspace.                                                                                           |
| `workspaces`                  | ts     | Exceptions: the backup import and the override columns, which have one writer, `patch_workspace_overrides` in `settings_overrides.rs`. It writes only the columns a patch names, refuses a value the column does not allow, and returns the stored row; `packages/db` only reads them.                                               |
| `worktree_roots`              | ts     | Exception: a project move rewrites `repo_root`.                                                                                                                                                                                                                                                                                      |

### Auto tree registry

Migration m230 adds the Auto tables. `store/runtime/auto/scheduler.ts` is the
one writer of tree state, under a lease
([architecture/auto-tree-registry.md](architecture/auto-tree-registry.md)).

### On-disk data layout

Everything the app saves for itself lives in `~/.goodboy`, an owner-only
folder; a session's worktrees live in the repository's `.goodboy/worktrees/`
([architecture/data-layout.md](architecture/data-layout.md)).

### Moving a project's folder

A move on disk leaves every saved absolute path at the old location, so the
project reads as `missing` until `project_relocate` rewrites its paths
([architecture/project-move.md](architecture/project-move.md)).

### Frames

A wireframe is shown as its real pages in a sandboxed `gbframe` iframe with no
same origin ([architecture/artifact-frames.md](architecture/artifact-frames.md)).

### Untrusted text

Text a stranger wrote reaches a prompt only through `untrustedBlock` and
renders with a depth cap and linear patterns
([architecture/untrusted-text.md](architecture/untrusted-text.md)).
