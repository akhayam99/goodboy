# Processes Goodboy starts

> **Read this when** you start, stop or list a process from the Rust shell.
> **Not for** the environment it gets ([environment.md](environment.md)), the
> Processes page ([monitor.md](monitor.md)) or the bytes a pty prints
> ([terminal-output.md](terminal-output.md)). The other pages are listed in
> [architecture.md](../architecture.md).

## The spawn tag

Every process the Rust shell starts for an agent carries four variables
(`aux_spawn.rs`, `SpawnTag`), and its children inherit them:
`GOODBOY_SPAWN_ID` (128 random bits, one per spawn), `GOODBOY_SPAWN_KIND`
(`turn`, `chat`, `planner`, `summary`, `script`, `terminal` or `probe`),
`GOODBOY_APP_PID` and `GOODBOY_APP_START` (this app's start time from the
kernel, so a recycled pid is not taken for this app). The tag is set on every
provider spawn whether or not the query bridge serves, and on the script and
terminal commands where they are built.

## Starting a process

Every process starts and stops through `src-tauri/src/proc/`.

- **An agent process.** A turn, a chat, a planner and a summary start through
  `live_child::spawn_tagged` (a turn through `spawn_tagged_with`, which binds
  its writer lease and registers with the query bridge before the child runs).
  `proc::spawn` gives stdin to `/dev/null` unless there is a prompt to pipe,
  pipes stdout and stderr, and kills the child before returning an error when
  a pipe is missing.
- **Side jobs.** A planner and a summary run through `live_child::run_side_job`:
  stdout and stderr are kept to their last 16 MiB and 256 KiB, the run goes
  under the caller's `runId` (`summarize_cancel`, `planner_cancel`) or an
  anonymous key, and the idle cap below stops a silent run.
- **Output.** A turn and a chat share `turn::forward_lines` over the
  `EventSink` trait. Lines travel as `Arc<str>`, so the backlog and the window
  event share one copy. The turn backlog keeps at most 50,000 events and 16 MiB
  per run, at 64 bytes of overhead per event.
- **A pty.** `proc/pty.rs` owns the wait and the stop of every pty session
  (terminal, provider login, script). `wait_for_exit` holds the session lock
  only for each `try_wait` poll, so a close or cancel is never queued behind a
  running child. A live script `run_id` is refused (`duplicate`), and a
  finished run removes only its own registry entry, never a newer run under a
  reused id.
- **Signals and opens.** `proc/signal.rs` holds the only `kill`, `killpg`,
  liveness and session lookups (R7 in `docs/rust.md`), and `proc/open.rs` the
  only OS open (`open_target`, `open_path`, refused for an executable, and
  `reveal`). Their children are detached and reaped. Editor detection uses
  `path_env::which`, with no `which` process.
- **Windows.** Each CLI spawn gets its own Job Object with kill-on-close
  (`process_group::Job`), so a cancel or the app dying ends the whole tree. The
  assignment happens right after the spawn, so a grandchild started in that
  first instant can escape it.

Locks never hide a child: registries, slots and the turn backlog open through
`util::lock_or_recover`, so a poisoned lock does not skip the insert, the kill
or the shutdown.

## What the window may ask to run

The window never names a binary, a command or an app.

- **Provider commands.** `provider_lifecycle_run` and
  `open_command_in_external_terminal` take a provider id and an action
  (`install`, `update`, `login`, `logout`) and look the command up in
  `provider_commands.rs`; an unknown pair is refused. The run's `env` may carry
  only the names that table lists (`NO_OPEN_BROWSER`).
- **Editors.** `open_in_editor`, `open_file_in_workspace` and `explore_open`
  take an id from `KNOWN_EDITORS` (`editor.rs`). An optional `line` and
  `column` are spelled per editor by `EDITOR_LINE_STYLES`. `explore_open` still
  resolves the path inside the session folder first.
- **External terminals.** `open_in_external_terminal` takes an existing folder
  and an optional id from `KNOWN_TERMINALS` (`external_terminal.rs`: terminal,
  iterm, warp, ghostty). Without an id it reads `terminal.app` from `settings`
  and falls back to Terminal.app when that app is gone. On macOS it runs `open -a <app> <folder>`
  with separate arguments; a provider command runs through AppleScript in
  Terminal.app or iTerm only. `detect_terminals` lists the installed ones.
- **Open never runs a file.** `util/open_guard.rs` refuses a file or bundle
  with an executable extension (`.command`, `.app`, `.sh`, `.exe`, `.desktop`
  and the rest of its list, any case) or the execute bit, before
  `explore_open`, `artifact_mirror_open` or `artifact_mirror_path` hands it on
  (`executable_refused`). Reveal stays allowed. `reveal_in_file_manager` takes
  an absolute path only.

### Discovered scripts

`project_scripts.rs` reads `package.json` and `composer.json`, and
`project_scripts/tools.rs` reads the worktree root for Makefile targets,
justfile recipes, Cargo commands and `[alias]` entries, and `pyproject.toml`
entry points, pdm tasks and poe tasks (three groups with their own source, so
a shared name keeps both commands and both histories).

- A name with a space, `&`, a quote or `$` is POSIX single quoted
  (`npm run 'build all'`, a quote inside becomes `'\''`). A name that starts
  with `-` is dropped.
- Pattern rules, special targets, private recipes (the `private` attribute or
  a leading `_`), recipes with a required parameter and settings are left out.
- Files are parsed by line and never run. Each is read through
  `util/scoped_path.rs::open_file_within`, so a manifest or parent directory
  that links outside the worktree is ignored.

## The ledger

`proc/ledger.rs` keeps one in-memory list of what the app started and still
holds, `{ spawnId, kind, pid, pgid, sessionId, mountPath, cwd, startedAt }`,
returned by `process_ledger_list`.

- A turn, a chat, a planner or a summary joins in `LiveChild::tagged`; a
  script, a terminal and a provider login or install (listed as `terminal`)
  join when their pty starts.
- A row leaves when the run is reaped (`wait_and_remove`), a script ends or
  stops, or a terminal closes, so a finished spawn is never listed.

`LiveScriptRun` and `LiveTerminal` carry the leader `pid`, and a terminal its
`foregroundPid` when the platform reports it. A script's exit code is the real
one: a signal reads as 128 plus its number (a SIGKILL is 137).

## Ending a spawn

`proc/reap.rs` ends everything a spawn started.

1. It reads one `ps` table with the start time the kernel reports per row
   (`proc/kernel.rs`), through `proc::probe::run` with a 5 second deadline.
   Only processes that began after this app are asked for their environment
   (the startup sweep reads all). A table that does not answer counts as
   unreadable.
2. It signals the tree below the leader (read while the leader is still ours),
   then the leader's group, then every straggler whose environment carries this
   spawn id, app pid and app start.
3. Each gets SIGTERM, 300 ms, then SIGKILL. Before every signal the kernel is
   asked again: same start time and tag, or the process is skipped.
4. It takes a new table and repeats until a round finds no new member (at most
   six rounds, then a warning), so a descendant spawned meanwhile is found.
5. It returns the processes it signalled, shells last.

The environment is read on its own (`KERN_PROCARGS2` past argc and argv on
macOS, `/proc/<pid>/environ` on Linux), never from the command line, and keys
match exactly. If the table cannot be read, a leader the kernel still shows as
this app's child and its own group leader gets its group terminated anyway.

- **When it runs.** After a normal exit, in `live_child::wait_and_remove`,
  which waits without reaping (`waitid` with `WNOWAIT`) so the pid and group
  cannot be reused meanwhile. Also on cancel, shutdown, script Stop and
  terminal close. A turn does not wait for its stdout to close: the reap closes
  the pipe a stray child held. A pty `stop` signals the session by tag, then
  kills the leader, so Cancel on a login leaves no descendant.
- **What it never touches.** A pid without this spawn id or with another app
  pid or start, pid 1, this app, another user's process, a pid whose start time
  or tag changed, and a leader that is not this app's child. Only a leader
  this app still holds brings its tree and group.
- **What the user sees.** A turn whose reap stopped something emits a `reaped`
  envelope before its end, and the transcript shows "Stopped 2 processes this
  turn left running: next-server, 1 more." The CLI's own helpers (an
  executable in the folder a symlinked CLI resolves to, like Cursor's `node`)
  are stopped but not named (`proc::provider_helpers`); a CLI that is no link,
  and Linux, keep every process in the line.

## Quiet jobs and turns

A side job is stopped after 10 minutes with no output and no CPU used by any
process in its tree (`SIDE_JOB_IDLE`, checked every 15 seconds). Output alone
is not enough: the Claude CLI prints its whole answer at the end, so a long
healthy call is silent. A stopped job returns `isTimedOut: true` (`exitCode` stays
null) and the caller throws `AuxTimedOutError`.

Turns have no cap. `turn_quiet` answers, per live run, the smaller of the
output silence (`LiveChild.activity`) and the CPU stillness of its tree, from
one table read (`proc::reap::trees_cpu`); a run whose CPU cannot be read gets
no answer. The window asks every 30 seconds (`WorkTimeProvider`), and the row
says "Quiet for 12 min" after `QUIET_TURN_AFTER_MS` (5 minutes,
`workTime.ts`). Nothing is stopped.

## Launch and quit

- **Startup sweep.** Tagged `turn`, `chat`, `planner`, `summary` and `probe`
  processes whose app is dead (pid gone or start time changed) and whose parent
  is 1 are stopped (`sweep_orphans`). Scripts and terminals are left alone. The
  count goes to the log and the `orphans-swept` event.
- **Boot reconcile.** One statement marks every `running` agent row whose run
  is not live as stopped (`reconcileGhostAgents`), in all workspaces. Runs the
  backend holds, runs this window can reattach to, and runs with an unanswered
  permission ask (a `NOT EXISTS` on `turn_events` in `stopGhostAgents`) are
  kept. If it fails it stops nothing, and each workspace load reconciles its
  own agents. It finishes before the launch reads any agent.
- **Ended work.** `ended_work::persist`, called from `drain_child_processes`
  before the registries stop, writes `restart.ended_work` to `settings`: the
  terminals with a foreground job (id and `ps` command line) and every live
  script run. An empty drain keeps the previous record, because the exit
  events call drain twice. The store reads it once on idle (`loadEndedWork`)
  and stores its `at` in `restart.ended_work_seen`, so the strips show on the
  first launch only.

## Tests

- `rust-spawn-sites.test.ts` counts `.spawn()` and `.kill()` outside `proc/`
  against `rust-spawn-sites.baseline.json`, and only falls.
- `provider-commands-table-parity.test.ts` keeps `provider_commands.rs` equal
  to `PROVIDER_LIFECYCLE_COMMANDS` in `@goodboy/core`, which the UI shows.
