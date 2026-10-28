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

### Code highlighter

`apps/desktop/src/shared/lib/highlight` is the one syntax highlighter. Shiki
runs in a web worker behind `highlightCode`, with an in-process fallback; the
caps (5,000 lines, 1,000 characters a line) live in `caps.ts` so a view can
read them without loading Shiki. The diff (`SyntaxText`, `useDiffTokens`), the
chat code blocks (`APP_CODE_HIGHLIGHTER`) and the Explore file view
(`shared/components/SourceView`) all read it from there.

### Subprocess environment

When you open an app from Finder or the Dock on macOS or Linux, it gets a
bare environment. It does not get the variables your terminal has. The Rust
shell asks your login shell for the real environment and passes it on to the
processes it starts (`apps/desktop/src-tauri/src/path_env.rs`).

Which helper to use depends on what the process runs.

- If it runs a script the user wrote, it gets the full login environment. Use `command_with_login_env`, or `resolved_env()` for terminal spawners that never build a `Command`.
- Everything else gets the resolved `PATH` on top of the app's own environment. Use `command`. It sets `PATH` and does not clear anything else, so the child inherits every variable the app process holds. Nothing here is an allowlist.

`run_git_push` gets the full environment. A repo's `pre-push` hook can read
variables set in `~/.zshrc`, like registry tokens or tool settings. `skill_run_script`
gets it too, because a skill script is the user's own bash. `PATH`
and `TERM` are set after the login environment is copied, so they win over
anything your profile sets.

The login shell is asked at most three times if it fails or times out. A good
answer is cached for the life of the app. After three failures the static list is
cached: Homebrew, `~/.local/bin`, `~/.cargo/bin`, `~/.volta/bin`, `~/.asdf/shims`,
`~/.local/share/mise/shims` and every `~/.nvm/versions/node/*/bin`, newest first. The
probe runs in its own session and is killed and reaped on its deadline
(`apps/desktop/src-tauri/src/proc/probe.rs`).

`login_shell()` is the one place that decides which shell to use. The built-in
terminal and the environment check always agree because both ask it.

If a push fails because a variable is missing, do not skip hooks with
`git push --no-verify`. Pass the environment through instead. This layer runs
on macOS and Linux.

### Processes Goodboy starts

Every process the Rust shell starts for an agent carries four variables
(`aux_spawn.rs`, `SpawnTag`): `GOODBOY_SPAWN_ID` (128 random bits, one per
spawn), `GOODBOY_SPAWN_KIND` (`turn`, `chat`, `planner`, `summary`, `script`,
`terminal` or `probe`), `GOODBOY_APP_PID` (this app) and `GOODBOY_APP_START`
(this app's start time from the kernel, so a recycled pid is not mistaken for
this app). The tag is set on every provider spawn whether or not the query
bridge serves, and on the script and terminal commands where they are built.
Their children inherit it.

`proc/reap.rs` ends everything a spawn started. `reap` reads one table of
processes with `ps` and gives each row the start time the kernel reports for
it (`proc/kernel.rs`: `proc_pidinfo` on macOS, `/proc/<pid>/stat` on Linux).
The read runs through `proc::probe::run` with a 5 second deadline; a table
that does not answer counts as unreadable. Only processes that began after
this app did are asked for their environment, since an older one cannot carry
this app's tag (the startup sweep of a dead app's orphans still reads all).
It signals in this order: the tree below the leader (read before any signal,
while the leader is still ours), the leader's process group, then every
straggler whose environment carries this spawn id, this app pid and this app
start. The environment is read on its own, never from the command line
(`KERN_PROCARGS2` parsed past argc and argv on macOS, `/proc/<pid>/environ` on
Linux) and the keys are matched exactly, so an argument that looks like a tag
is not one. Each gets SIGTERM, 300 ms to leave, then SIGKILL. Before every
signal, TERM and KILL alike, the reap asks the kernel again: the pid must still
have the start time it had in the table and the tag must still be there, or the
process is skipped. After each round it takes a new table and goes again until
a round finds no new member (at most six rounds, then a warning in the log), so
a descendant spawned while the cleanup ran is found. It returns the processes
it signalled, shells last. If the table cannot be read, a leader the kernel
still shows as this app's child and as its own group leader gets its whole
group terminated anyway.

- **When it runs.** After a normal exit, in `live_child::wait_and_remove`,
  which waits for the leader without reaping it (`waitid` with `WNOWAIT`) so
  its pid and group cannot be reused while the reap reads the table. Also on
  cancel, on shutdown, on script Stop and on terminal close. A turn does not
  wait for its stdout to close: the reap closes the pipe a stray child held.
- **One way to start and stop a pty.** `proc/pty.rs` owns the stop of every
  pty session (terminal, provider login, script): `stop` signals the whole
  session by tag and then kills the leader, so Cancel on a login leaves no
  descendant. It also owns the wait, `wait_for_exit`, which polls `try_wait`
  and holds the session lock only for each poll, so a close or cancel is never
  queued behind a running child. A script `run_id` that is already live is
  refused (`duplicate`), and a finished run removes only its own registry
  entry, never a newer run under a reused id.
- **One way to signal and one way to open.** `proc/signal.rs` holds the only
  `kill`, `killpg`, liveness and session lookups (R7 in `docs/rust.md`), and
  `proc/open.rs` the only OS open: `open_target` for an address, `open_path`
  for a file or folder (refused when it is an executable) and `reveal`. Every
  child they start is detached and reaped. Editor detection reads the resolved
  PATH through `path_env::which`, with no `which` process.
- **What it never touches.** A pid without this spawn id or with another app
  pid or app start, pid 1, this app, another user's process, a pid whose start
  time or tag changed since the table was read, and a leader that is not this
  app's child. Only a leader this app still holds brings its tree and group.
- **The ledger.** `proc/ledger.rs` keeps one in-memory list of what the app
  started and still holds: `{ spawnId, kind, pid, pgid, sessionId, mountPath,
cwd, startedAt }`. A turn, a chat, a planner or a summary joins it in
  `LiveChild::tagged`, a script and a terminal when their pty starts. The row
  leaves when the run is reaped (`wait_and_remove`), when a script ends or is
  stopped, and when a terminal closes, so a finished spawn is never listed.
  A provider login or install (a pty too) is tagged and listed as a
  `terminal` while it runs.
  The `process_ledger_list` command returns it. `LiveScriptRun` and
  `LiveTerminal` carry the leader `pid`; a terminal also carries
  `foregroundPid`, the leader of its foreground process group when the
  platform reports it. A script's exit code is the real one: a signal reads as
  128 plus its number (a SIGKILL is 137), where it used to collapse to 1.
- **The monitor snapshot.** `monitor/mod.rs` answers `monitor_snapshot` (an optional `ports` list narrows the listener scan) with
  `{ listeners, processes, taken_at, platform_supported }` (the last one is `isPlatformSupported` on the wire) from one read of the
  machine: on macOS `lsof -nP -iTCP -sTCP:LISTEN -Fpn`, one `ps -axo`, one
  batched `lsof -a -d cwd -p` and one `ps -o pid=,args=`; on Linux
  `/proc/net/tcp`, `tcp6` and the `/proc/<pid>/fd` socket inodes; on Windows
  nothing and `platform_supported: false`. Every tool call runs through
  `proc::probe::run` with a 2 second deadline. `processes` holds only the
  listener holders and every process in a process group the ledger knows, so
  the page can tell a leftover from a stranger. `args_masked` replaces the
  value of `--token=`, `--password=`, `--secret=`, a bare flag followed by its
  value, and any `KEY=value` whose key contains TOKEN, SECRET, PASSWORD or KEY
  with `***`; it is never logged. `monitor_watched_ports(project_root)` reads
  the ports a project declares (package.json scripts, `PORT` and `*_PORT`
  integers in `.env`, `.env.local`, `.env.development`, `server.port` in the
  vite config, published compose ports) and keeps nothing else from those
  files.
- **Stopping a process.** `monitor_stop(pid, force)` (`monitor/stop.rs`)
  answers `{ outcome: "stopped" | "still-running" | "refused", reason }`. It
  refuses pid 1, this app, the processes that started it, a pid whose uid is
  not the app's and a pid missing from a fresh snapshot, then sends SIGTERM
  (SIGKILL with `force`) and polls for up to 3 seconds; a zombie counts as
  gone. On Windows the same refusals sit in front of `TerminateProcess`. The
  Goodboy rows never call it first: `stopGoodboyRow` routes to the script
  cancel, the terminal close or the turn cancel, and falls back to
  `monitor_stop` only when the app owns nothing for that process.
- **The port join.** `attributePorts` (`packages/core/src/monitoring`) joins
  the snapshot, the ledger, the sessions' worktrees and the projects into one
  row per listener, first match wins: a Goodboy script, terminal or agent turn
  (the ledger row holding the pid, its parent or its group), a session
  worktree by the longest cwd prefix, a project's main checkout, else an
  external process by name. A watched port held by one worktree while another
  worktree of the same project is running carries `collision: { others }`.
  Each row carries the `source` that named its port (`script`, `env`, `vite`,
  `compose` or `learned`). Declared ports nobody holds come back as `free`
  rows. A port a Goodboy-owned process held joins the project's learned set
  (`monitor.learnedPorts.<id>`). The pins are not per project: `monitor.pinnedPorts`
  holds the user's pinned ports with an optional description and
  `monitor.hiddenPorts` the ports hidden from a layer, both global settings.
  The first load folds the old `monitor.watchedPorts.<id>` keys into the pins
  and deletes them. `features/monitoring/splitPortRows.ts` files each port in
  one layer, Pinned, Run by Goodboy, From workspace, then Listening on this
  Mac. The store slice `store/slices/monitoring/` keeps the snapshot and
  applies a result only if its `takenAt` is not older than the one held.
- **Windows.** Each CLI spawn is assigned to its own Job Object with
  kill-on-close (`process_group::Job`), so a cancel ends the whole tree
  (`TerminateJobObject`) and so does the app dying. The assignment happens
  right after the spawn, so a grandchild started in that first instant can
  escape it.
- **One way to start an agent process.** A turn, a chat, a planner and a
  summary start through `live_child::spawn_tagged` (a turn through
  `spawn_tagged_with`, which lets it bind its writer lease and register with
  the query bridge before the child runs). It launches through
  `proc::spawn`, which gives stdin to `/dev/null` unless there is a prompt to
  pipe (fd 0 is never the app's own), pipes stdout and stderr, and kills the
  child before returning an error when a pipe is missing. A planner and a
  summary then run through `live_child::run_side_job`: both streams are kept
  to their last bytes (16 MiB for stdout, 256 KiB for stderr), the run goes
  under the caller's `runId` (`summarize_cancel`, `planner_cancel`) or an
  anonymous key, and a silent run is stopped by the idle cap. A turn and a
  chat share `turn::forward_lines` over the `EventSink` trait. Lines travel as
  `Arc<str>`, so the backlog and the window event share one copy.
- **Locks never hide a child.** A child registry, a slot and the turn backlog
  open through `util::lock_or_recover`. A panic elsewhere that poisoned the
  registry no longer skips the insert, the kill or the shutdown, so the
  process stays tracked and dies with its run. The turn backlog keeps at most
  50,000 events and 16 MiB per run, and every event weighs 64 bytes of
  overhead, so a flood of blank lines is bounded too.
- **Spawn sites.** `rust-spawn-sites.test.ts` counts `.spawn()` and `.kill()`
  in `src-tauri/src` outside `proc/` against `rust-spawn-sites.baseline.json`.
  It only falls: a new process is started through `proc/`.
- **Commands come from a table, never from the window.**
  `provider_lifecycle_run` and `open_command_in_external_terminal` take a
  provider id and an action (`install`, `update`, `login`, `logout`) and look
  the command up in `provider_commands.rs`; an unknown pair is refused. The
  `env` of a lifecycle run may carry only the names that table lists
  (`NO_OPEN_BROWSER`). `provider-commands-table-parity.test.ts` keeps the table
  equal to `PROVIDER_LIFECYCLE_COMMANDS` in `@goodboy/core`, which the UI shows
  and copies. `open_in_editor`, `open_file_in_workspace` and `explore_open` take
  an editor id from `KNOWN_EDITORS` (`editor.rs`), not a binary or a path.
  `open_file_in_workspace` and `explore_open` also take an optional `line` and
  `column`; `EDITOR_LINE_STYLES` (`editor.rs`) says how each editor spells them
  (`-g file:line:col`, `file:line:col`, `--line N --column N file`, or the
  plain path). `explore_open` still resolves the path inside the session
  folder first.
- **What was running when the app quit is written once, at drain.**
  `ended_work::persist` (called from `drain_child_processes`, before the
  registries are stopped) writes `restart.ended_work` to `settings`: the
  terminals whose shell had a foreground job (id and the `ps` command line) and
  every live script run (script id, session, name, cwd). An empty drain keeps
  the previous record, because the exit events call drain twice. The store reads
  it once at boot (`loadEndedWork`) and stores the record's `at` in
  `restart.ended_work_seen`, so the strips show on the first launch only.

- **External terminals come from a table.** `open_in_external_terminal` takes a
  folder (it must exist and be a folder) and an optional id from
  `KNOWN_TERMINALS` (`external_terminal.rs`: terminal, iterm, warp, ghostty),
  never an app name or a path; without an id it reads `terminal.app` from
  `settings` and falls back to Terminal.app when that app is gone. On macOS it
  runs `open -a <app> <folder>` with the two as separate arguments. A provider
  command (`open_command_in_external_terminal`) runs through AppleScript in
  Terminal.app or iTerm only. `detect_terminals` lists the installed ones.
- **Open never runs a file.** `util/open_guard.rs` refuses a file or bundle
  whose extension is executable (`.command`, `.app`, `.sh`, `.exe`, `.desktop`
  and the rest of its list, in any case) or whose execute bit is set, before
  `explore_open` or `artifact_mirror_open` hands it to the OS default handler.
  The refusal has kind `executable_refused`; Reveal stays allowed.
  `reveal_in_file_manager` takes an absolute path only.
- **Discovered scripts are quoted.** `project_scripts.rs` writes
  `npm run 'build all'` for a script name with a space, `&`, a quote or `$`
  (POSIX single quotes, a quote inside becomes `'\''`) and drops a name that
  starts with `-`.
- **Side jobs** (planner, summary) are stopped when they go quiet. A job is
  quiet when it has written nothing to stdout or stderr and no process in its
  tree has used any CPU for 10 minutes (`SIDE_JOB_IDLE`, checked every 15
  seconds). Output alone is not enough: the Claude CLI prints its whole answer
  once, at the end, so a long healthy call is silent, and the CPU of the CLI
  and of the tools it runs is what shows it is alive. A stopped job returns
  `isTimedOut: true` (`exitCode` stays null) and the caller throws
  `AuxTimedOutError`. Turns have no cap, but they are measured with the same
  evidence: a turn counts as alive when it wrote a stdout line or a stderr
  chunk (`LiveChild.activity`) or when the CPU of its process tree changed.
  `turn_quiet` answers, for each live run, how long it has been quiet
  (`TurnQuiet { runId, quietMs }`, the smaller of the output silence and the
  CPU stillness). One process table read serves every live run
  (`proc::reap::trees_cpu`), a run whose CPU cannot be read gets no answer,
  and nothing is stopped. The window asks every 30 seconds while a turn runs
  (`WorkTimeProvider`) and the row says "Quiet for 12 min" after
  `QUIET_TURN_AFTER_MS` (5 minutes, `workTime.ts`).
- **Startup sweep.** At launch, tagged processes of kind `turn`, `chat`,
  `planner`, `summary` or `probe` whose app is dead and whose parent is 1 are
  stopped (`sweep_orphans`). The app counts as dead when its pid is gone or
  its start time is not the one in the tag. Scripts and terminals are left
  alone. The count goes to the log and to the `orphans-swept` event.
- **What the user sees.** When a turn's reap stopped something, the turn emits a
  `reaped` envelope before its end, and the transcript shows one line under the
  turn: "Stopped 2 processes this turn left running: next-server, 1 more."
- **Boot reconcile.** At boot one update marks every `running` agent row whose
  provider run is not live as stopped (`reconcileGhostAgents`), in all
  workspaces, not only the open one. Runs the backend still holds and runs
  this window can reattach to are kept.

### Terminal and script output

A pty never loses what it printed. Each terminal and each script run owns an
`OutputRing` (`pty_ring.rs`): the last 262144 bytes it wrote and `total`, the
running count of every byte since the start. The reader thread pushes each
read into the ring first, then emits `terminal-output` or `script-output`
with `offset`, the running offset of the chunk's first byte. A ring survives
its process: on exit the pair (ring, exit code) stays in the `exited` store
for 10 minutes, and the entry leaves the registry before `terminal-exit` or
`script-exit` fires, so a snapshot read after the event always carries the
exit code.

`terminal_snapshot(sessionId)` and `workspace_script_snapshot(runId)` return
`{ data, offset, exitCode }`: the ring as base64, the offset of its first
byte, and the exit code once the process ended (`null` while it runs). An
unknown id returns an empty snapshot at offset 0.

The app listens once per event kind, and one factory owns the rules:
`shared/lib/createOutputStream.ts` (`createOutputStream({ outputEvent,
exitEvent, idField, isStartRequired })`) installs one output listener and one
exit listener, decodes each chunk, keeps the 256KB tail per id with its running
offset, hands chunks and the exit to the subscribers of that id, and exposes
`listenAll` for a reader that wants every payload. The terminal bus, the
provider lifecycle buffer and the script events are three configurations of
it, so a fix to the tail, the offset or the replay lands once.
`features/terminal/outputBus.ts` is
registered at boot (`reattachTerminalTabs`) and by every terminal driver; it
keeps a 256KB tail per terminal and hands each chunk to that terminal's
subscribers. `GenericTerminalPanel` subscribes first, buffers what arrives,
writes the snapshot, then writes only the bytes past the snapshot's end. When
the snapshot call fails the bus tail stands in. The scripts slice does the
same for every live run on boot (`registerScriptRunListeners` with
`shouldReplay`); what a script's transcript shows stays capped at 64KB.

Provider login and CLI update runs have no Rust ring. `invokeProviderLifecycleRun`
starts `features/providers/lifecycleOutputBuffer.ts` before the run, which keeps
the last 256KB per `runId` with the same running `offset`, and `InlineTerminal`
replays it through the same snapshot path, so a remount during a login still
shows the device code once. The buffer of an exited run is dropped when its
terminal unmounts, and only the newest four exited runs are kept. The run
actions that only need the text and the exit (`connectProvider`,
`runLifecycle`) read the same stream through `listenLifecycleOutput` and
`listenLifecycleExit`, so a login run costs two listeners, not six.

`shared/components/GenericTerminalPanel/index.tsx` keeps the normal terminal renderer when WebGL addon construction or activation fails, and disposes the failed addon. Acceleration is optional; an unavailable WebGL2 context does not close the terminal.

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
  `pre-push` hook needs it (`remote_auth::run_git_authenticated`, which returns
  `GitError`).
- Every call has a deadline set by its class (`GitClass`): 3 minutes for a
  read (`status`, `diff`, `log`, `rev-parse`, `rev-list`, `ls-files` and the
  other verbs that only look), 10 minutes for a write (every verb not named
  here), 30 minutes for the network (`fetch`, `push`, `pull`, `ls-remote`,
  `clone`, `submodule`, `lfs` and `remote`). A caller can set its own with
  `.timeout()`. When the deadline fires, git and its children are killed and
  the caller gets a `timeout` error that carries its class, so a wedged
  `git status` frees its thread in three minutes, not in half an hour.
- `english()` forces `LC_ALL=C`. A caller that matches git's error text (the
  worktree removal retry, the fetch that tells a missing branch from an outage)
  must use it, because git translates its messages.
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

### Diff file sides

A Tauri command that reads or deletes a file under a root uses
`apps/desktop/src-tauri/src/util/scoped_path.rs`. `resolve_within` returns the
canonical path of a file below a root and refuses a relative root, a `..`
component and a path or symlink that resolves outside the root. `open_within`
also walks the path with `openat` and `O_NOFOLLOW`, so a file swapped for a
symlink after the check is refused (unix only; other platforms refuse, and
`open_file_within` falls back to `resolve_within` where an attachment must still
work). `local_image_read`, `attachment_read`, `attachment_write`,
`attachment_delete`, `explore_*`, the single-file diff and `skill_run_script` all
go through it; a new command that takes a path must too.

`attachment_read_dropped` accepts only a path the window reported in a drag drop
event. The Rust shell records the paths of each window `DragDrop` event
(`dropped_paths.rs`, called from `on_window_event`: a webview window reports a
drop as a window event, never as a webview event) and removes a path the first time it is read, so a path that
was never dropped, or was dropped once and already read, is refused with
`not_dropped`.

`skill_run_script` takes the skill id, not a root. The roots come from the
skill's workspace projects in the database, and the script must resolve inside
`<root>/.kay/skills`. `session_dir_remove` takes the session id and removes a
directory only when it is a direct child of a `sessions` folder (or a mount
inside one) whose `.goodboy` marker names that session, and never through a
symlink. `worktree_scratch_remove` takes only a direct child of the temp folder
named `goodboy-check-*`.

`worktree_file_sides` reads local file contents for unchanged context expansion.
An omitted old revision uses the same configured merge base as the branch diff;
an omitted new revision reads the working file. Explicit revisions are resolved
before reading their git objects. The missing first parent of a root commit is
an absent side. The `:0` revision names the index, so staged and unstaged
comparisons read their own sides. A detected rename or copy reads the old path
for the old side, following the repository's diff configuration. Missing files
return an absent side. The read rejects absolute paths, traversal and symlinks
outside the worktree, including a missing file below an escaping symlink.
Either side over 2 MB or 20,000 lines, or containing invalid UTF-8 or NUL bytes,
makes the entire result too large with no text. The frontend loader names the
worktree and revision pair, fetches once
per file and diff refresh, and discards late results after its source changes.
The command lives in `apps/desktop/src-tauri/src/worktree/file_sides.rs`;
`features/diff/hooks/useFileSides` owns the expansion cache and retry state.

### Identifier peek

`worktree_grep_word` backs the double click on a name in a diff line. It refuses
a word that is not an identifier of 2 to 128 characters (`A-Za-z_$` first, then
`A-Za-z0-9_$`) before any process starts, then runs
`git grep -n --column -z -w -I -F --untracked -e <word> --` in the worktree
through the `Git` helper with an argument array and a 3 second deadline. It keeps
the first 300 matches (`truncated` says more existed) and trims each line to 240
characters. Exit 1 is an empty list. The definition guess is
`features/diff/lib/definitionOf.ts`: it reads declaration keywords for TS and JS,
Rust, Python and Go. It also recognizes TS and JS method signatures with a
body on the same line and Go receivers. The heuristic does not resolve imports
or establish symbol identity across scopes. Definitions under dependency and
vendor directories or in lockfiles do not qualify. Without a project
definition the popover hides all uses. The command lives in `apps/desktop/src-tauri/src/worktree/grep.rs`;
`features/diff/hooks/useIdentifierUses` keeps only the latest answer.

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
  finish out of order. The command never writes to the pty itself: it queues
  the bytes for the session's writer thread (`proc::pty::PtyInput`, 256 chunks
  deep), so a child that never reads cannot hold the main thread, the session
  lock, a close or a cancel. A full queue answers `backlogged`, a session whose
  writer died answers `input_closed`, and a session already gone is a quiet
  no-op.
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
- **Slow operations.** `logging::slow(label, started)` writes one `info` line,
  `[slow] <label> took <n>ms`, when an operation took 250 ms or more
  (`logging::SLOW_THRESHOLD`); `logging::timed(label, run)` wraps a closure the
  same way. The label is fixed: `git <verb>` in the `Git` runner (the
  subcommand only, never an argument or a path, and `git` alone when the word
  is not a plain subcommand name), and `db_exec`, `db_execute`, `db_select` and
  `db_transaction` for the webview's SQL commands, each with a second
  `<command> lock wait` line when waiting for the connection lock took that
  long. Nothing is exported or sent; the line lands in the same file and
  rotation as every other line. Spawn and the provider probes do not write one
  yet.
- **Dropped errors.** `logging::note_failure` and `note_kill_failure` replace
  `let _ =` in process teardown (killing a terminal, script, provider login or
  live child) and in git cleanup (removing scratch and copy worktrees,
  `worktree prune`, `cherry-pick --abort` and the resets after it). A child that
  already exited is not reported. Other `let _ =` are still silent by design:
  event emits to a closed window and best-effort file cleanup.
- **A frozen window leaves a record.** `window_heartbeat.rs` is a watchdog
  with no network and no kill: it notes a freeze in `last-crash.json` (see
  [navigation/shell.md](navigation/shell.md), After a crash the app could not show) and
  logs nothing else. It does not run in debug builds, where a paused debugger
  would read as a freeze.
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
- **The artifacts folder is one command away.** The lens header's `Show in
Finder` button opens `~/.goodboy/workspaces/<slug>/artifacts/` in the OS file manager
  (`artifact_mirror_open_root`), since `~/.goodboy` itself is hidden.

### Untrusted text

- **Text a stranger wrote reaches a prompt only through `untrustedBlock`.**
  Issue and ticket text, check names, check logs, file paths and PR text
  go through `untrustedBlock({ source, text })` in `packages/core`. It prints
  a line naming the source and saying the text is evidence only, then the text
  in a fence longer than any backtick run inside it, so the text cannot close
  its own block. The issue brief and the check analysis builders use it, and
  a test per builder fails when a host word lands outside a block. A new
  builder that puts host text in a prompt calls it too. It frames the text; it
  is not the boundary, which stays the permission mode.
- **Text a stranger wrote renders with a depth cap and linear patterns.**
  `parseMarkdown` opens at most six nested `<<tag>>` callouts
  (`MAX_CALLOUT_DEPTH`); a seventh opener stays plain text, so
  `'<<note>>'.repeat(2500)` cannot overflow the stack. The table divider is
  checked cell by cell, not with a regex that backtracks. If a parse or a render
  step still throws, `Markdown` logs it and shows the raw text in a `<pre>` for
  that block of text only; the rest of the window stays alive, and the next text
  parses again. The patterns in `redactReport` that match a stranger's text
  (URL scheme, scp remote, email) bound every repeat. A new pattern over
  untrusted text bounds its repeats and gets a pathological-input case in a
  perf test (`MarkdownDepth.test.tsx`, `redactReport.perf.test.ts`).
- **A key a model or a host controls is looked up with `ownValue`.**
  `ownValue({ table, key })` in `packages/core` reads a table through
  `Object.hasOwn`, so `constructor`, `__proto__` and `toString` answer
  `undefined` instead of an inherited function. The wireframe near tables
  (the enum gate the frame trusts), the GitLab job conclusions, the GitHub
  review decisions and the Claude rate limit status and window tables use it,
  each with a test that feeds the inherited names. Pattern expansion copies
  keys with `Object.fromEntries`, so a `__proto__` key stays data and never
  rewires a node. A new table keyed by a string from outside uses `ownValue`
  or a `Map`.
- **A remote image never reaches a reserved address.** `remote_image.rs`
  refuses, for IPv4, `0.0.0.0/8`, loopback, private, link-local, `100.64.0.0/10`,
  `192.0.0.0/24`, `192.88.99.0/24`, `198.18.0.0/15`, documentation, multicast
  and `240.0.0.0/4`; for IPv6, unique local, link-local, loopback, multicast,
  NAT64 (`64:ff9b::/32`), 6to4 (`2002::/16`), Teredo (`2001::/32`),
  documentation (`2001:db8::/32`), discard (`100::/64`) and the `::/96`
  IPv4-compatible block. An IPv4-mapped address takes the IPv4 rules. The table
  tests in `remote_image.rs` pin each range and its public neighbours; a new
  range changes both lists.

### Render errors

- **A render error ends one panel, not the window.** `PanelBoundary`
  (`app/components/PanelBoundary`) wraps each studio (`AppStudio`), each
  drawer (`DrawerHost`, keyed by `drawerKey`) and each session page
  (`KeepAliveWorkSurface`). A throw inside one shows "This page could not be
  drawn" in that panel with Retry (remounts the panel), a leave action (Go to
  the board, Close drawer or Close) and Report this (the inline crash report).
  The rail, the top bar and every other session stay alive.
- **The root `ErrorBoundary` in `main.tsx` is the last resort.** It only shows
  when the shell itself throws. Both use `ErrorBoundary` from `packages/ui`;
  a panel passes `renderFallback`, the root does not.
- **Every caught render error is written to the app log.** Both boundaries pass
  `onCatch={logRenderCrash}` (`features/bug-report/logRenderCrash`), which calls
  `log_render_crash` (`render_crash_log.rs`). It writes three `[render-crash]`
  lines (name and message, stack, component stack) to the local log only. Home
  folders become `~`, credentials are hidden and each field is cut to a fixed
  length.

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

- **The remote probe is a git read like the others.** `project_remote_probe`
  asks `ls-remote --symref origin HEAD` with a 15 second timeout, fetches the
  default branch only on a hit and sets `origin/HEAD`. Its four answers
  (`no-remote`, `unreachable`, `reachable-no-main`, `main-present`) fail closed:
  a timeout or a failed step is `unreachable`, never `main-present`. It runs on
  window focus and every 60 seconds (five minutes after three unreachable
  answers) only while a project is in its first lap, from `useBootstrapWatch`.
  That pace is `hostPollDelayMs`, the one backoff the host reachability state
  below reuses.

- **A host that does not answer is one state, not a message per poll.**
  `hostReachability` holds, per host (GitLab and Bitbucket), the first time of
  the outage and a count of `network` or `timeout` answers from the typed host
  failures. Every refresh of a request goes through `refreshMountRequest`, which
  feeds the state and holds a silent refresh back once a host has failed three
  times, until five minutes pass. A refresh the person asked for (`force`, or
  from a screen) always asks. Any other answer, even a refused sign-in, means
  the host is there. The top bar shows one quiet line per host with Retry, and
  Retry asks again for every session that already holds a request of that host.

### Database migrations

To add one, follow [recipes/migration.md](recipes/migration.md). Once a
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
to `schema_version` and clears the checkpoints. For versions up to
`ALREADY_EXISTS_TOLERATED_THROUGH_VERSION` (234, the last version shipped
before the checkpoint), a statement that fails with "already exists" or
"duplicate column name" counts as done: the runner logs a warning and keeps
going. A newer version has no such tolerance and fails, so a collision never
hides behind a skipped statement.

The runner splits a migration into statements on semicolons, but keeps a
`CREATE TRIGGER ... BEGIN ... END` whole, so a trigger body may hold several
statements. A trigger without its closing `END` fails the migration.

`registry.test.ts` guards all of this. It fails CI when two migrations share a
version, when a version number is skipped, or when a filename does not match
its registered version. It pins the SQL of every shipped migration by SHA-256
in `SHIPPED_MIGRATION_SQL_SHA256`, so an edited shipped body fails. A new
migration fails the test until you paste its SHA into that manifest; the
failure message prints the lines to paste. It also checks that upgrading from
a sample of older versions ends up with the exact same schema as a fresh
install: twelve sampled versions plus the oldest and the newest, not every
version.

Rust tests do not hand-write the tables they read. `schema-fixture.test.ts`
renders the schema the migrations build (tables, indexes, views and triggers,
without the search shadow tables) into
`apps/desktop/src-tauri/src/test_support/migrated_schema.sql`, fails when the
committed file differs, and regenerates it with
`GOODBOY_UPDATE_SCHEMA_FIXTURE=1`. Every Rust test that needs a table loads it
through `test_support::migrated_connection()` (the config export, the project
move and the connection tests do). `check-parity.test.ts` reads the string
`CHECK` lists from that same migrated schema and compares them, column by
column, with the constant that owns them.

When the app starts and a database file that already holds data has migrations
waiting, the runner first asks Rust for a copy next to it (`db_create_migration_snapshot`, a `VACUUM INTO` on the managed connection; the window SQL path refuses it). An empty
file (no recorded version and no table) gets no copy: there is nothing to keep. The copy is named
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

Settings > Backup > Reset > Delete all data stops every running turn,
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
cleanup) and moving those calls behind the commands is not done yet. The same
test guards that direction too: it scans `packages/db/src/queries/` for an
`INSERT`, `UPDATE` or `DELETE` on a `rust` table and fails when a query gains
one beyond `TS_WRITES_TO_RUST_TABLES` (today `integration-binding.ts`,
`integration-credential.ts`, `project-adoption.ts` and `workspace-merge.ts`).
The count only falls: remove a line when the write moves behind a command.

| Table                         | Writer | Notes                                                                                                                                                                                                                                                                                                     |
| ----------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `agent_handoffs`              | ts     |                                                                                                                                                                                                                                                                                                           |
| `agent_queued_messages`       | ts     |                                                                                                                                                                                                                                                                                                           |
| `agent_turn_spans`            | ts     |                                                                                                                                                                                                                                                                                                           |
| `agents`                      | ts     | Inserts, status, routing, viewed and done through `agent-write.ts`; Move to Auto inserts the Auto agent in its transfer. `mount_id` (m233) is written once at insert by `spawnAgent`, and only when that worktree row exists; removing the worktree sets it to NULL and keeps the agent. Rust reads only. |
| `artifact_comments`           | ts     |                                                                                                                                                                                                                                                                                                           |
| `artifact_provenance`         | ts     |                                                                                                                                                                                                                                                                                                           |
| `artifact_revisions`          | ts     |                                                                                                                                                                                                                                                                                                           |
| `auto_artifact_versions`      | ts     |                                                                                                                                                                                                                                                                                                           |
| `auto_artifacts`              | ts     |                                                                                                                                                                                                                                                                                                           |
| `auto_attempts`               | ts     |                                                                                                                                                                                                                                                                                                           |
| `auto_delegations`            | ts     |                                                                                                                                                                                                                                                                                                           |
| `auto_outbox`                 | ts     |                                                                                                                                                                                                                                                                                                           |
| `auto_reservations`           | ts     |                                                                                                                                                                                                                                                                                                           |
| `auto_trees`                  | ts     | Auto tree registry (`store/runtime/auto/`). Nothing in Rust writes it.                                                                                                                                                                                                                                    |
| `budget_alerts`               | rust   | `budget.rs`                                                                                                                                                                                                                                                                                               |
| `budget_rules`                | rust   | `budget.rs`, and the backup import                                                                                                                                                                                                                                                                        |
| `chat_message_attachments`    | ts     | Rows go in with their message through `insertChatMessage`. Rust reads them to build a turn's image root.                                                                                                                                                                                                  |
| `chat_messages`               | ts     |                                                                                                                                                                                                                                                                                                           |
| `chat_session_links`          | ts     |                                                                                                                                                                                                                                                                                                           |
| `chats`                       | ts     |                                                                                                                                                                                                                                                                                                           |
| `context_slot_history`        | ts     |                                                                                                                                                                                                                                                                                                           |
| `context_slots`               | ts     |                                                                                                                                                                                                                                                                                                           |
| `deleted_branches`            | ts     |                                                                                                                                                                                                                                                                                                           |
| `diff_comments`               | ts     |                                                                                                                                                                                                                                                                                                           |
| `file_versions`               | ts     |                                                                                                                                                                                                                                                                                                           |
| `github_pr_cache`             | ts     |                                                                                                                                                                                                                                                                                                           |
| `goal_attachments`            | ts     |                                                                                                                                                                                                                                                                                                           |
| `history_plans`               | ts     |                                                                                                                                                                                                                                                                                                           |
| `integration_bindings`        | rust   | `integration_credentials.rs`, and the backup import                                                                                                                                                                                                                                                       |
| `integration_credentials`     | rust   | `integration_credentials.rs`, and the backup import                                                                                                                                                                                                                                                       |
| `integration_drafts`          | ts     | Exception: the query bridge saves a draft an agent proposes (`query_bridge/dispatch.rs`).                                                                                                                                                                                                                 |
| `messages`                    | ts     |                                                                                                                                                                                                                                                                                                           |
| `mount_operations`            | ts     | Exceptions: a project move rewrites the paths in the log, and the query bridge writes it (`query_bridge/mount.rs`).                                                                                                                                                                                       |
| `mount_pr_links`              | ts     |                                                                                                                                                                                                                                                                                                           |
| `notifications`               | ts     |                                                                                                                                                                                                                                                                                                           |
| `nudge_events`                | ts     |                                                                                                                                                                                                                                                                                                           |
| `open_questions`              | ts     |                                                                                                                                                                                                                                                                                                           |
| `permission_audit_log`        | rust   | `permissions.rs`, at hook time                                                                                                                                                                                                                                                                            |
| `permission_audit_retry`      | rust   | `permissions.rs`                                                                                                                                                                                                                                                                                          |
| `permission_rules`            | rust   | `permissions.rs`, and the backup import                                                                                                                                                                                                                                                                   |
| `plan_consumptions`           | ts     |                                                                                                                                                                                                                                                                                                           |
| `pr_review_drafts`            | ts     |                                                                                                                                                                                                                                                                                                           |
| `pr_series`                   | ts     |                                                                                                                                                                                                                                                                                                           |
| `pr_series_members`           | ts     |                                                                                                                                                                                                                                                                                                           |
| `project_relocations`         | rust   | `project_relocation.rs`                                                                                                                                                                                                                                                                                   |
| `project_scripts`             | ts     | Exception: the backup import.                                                                                                                                                                                                                                                                             |
| `project_sentry_links`        | ts     |                                                                                                                                                                                                                                                                                                           |
| `project_values`              | ts     | Per-folder values (`folder.purpose`, `folder.git`), keys registered in `queries/entity-value.ts`; deleted with the project. The backup does not carry them.                                                                                                                                               |
| `projects`                    | ts     | Exceptions: the backup import and a project move.                                                                                                                                                                                                                                                         |
| `provider_credentials`        | ts     |                                                                                                                                                                                                                                                                                                           |
| `provider_limits`             | ts     |                                                                                                                                                                                                                                                                                                           |
| `provider_runs`               | ts     |                                                                                                                                                                                                                                                                                                           |
| `resolve_attempts`            | ts     | Exception: a project move rewrites `worktree_path`.                                                                                                                                                                                                                                                       |
| `resolve_batches`             | ts     |                                                                                                                                                                                                                                                                                                           |
| `resolve_candidate_items`     | ts     |                                                                                                                                                                                                                                                                                                           |
| `resolve_candidates`          | ts     | Exception: a project move rewrites `worktree_path`.                                                                                                                                                                                                                                                       |
| `resolve_check_runs`          | ts     |                                                                                                                                                                                                                                                                                                           |
| `resolve_imports`             | ts     |                                                                                                                                                                                                                                                                                                           |
| `resolve_publication_threads` | ts     |                                                                                                                                                                                                                                                                                                           |
| `resolve_publications`        | ts     | Exception: a project move rewrites `worktree_path`.                                                                                                                                                                                                                                                       |
| `resolve_queue_items`         | ts     |                                                                                                                                                                                                                                                                                                           |
| `resolve_session_settings`    | ts     |                                                                                                                                                                                                                                                                                                           |
| `resolve_threads`             | ts     |                                                                                                                                                                                                                                                                                                           |
| `retained_worktree_paths`     | ts     | Exception: a project move rewrites the paths.                                                                                                                                                                                                                                                             |
| `schema_migration_segment`    | ts     |                                                                                                                                                                                                                                                                                                           |
| `schema_version`              | ts     |                                                                                                                                                                                                                                                                                                           |
| `search_docs`                 | ts     |                                                                                                                                                                                                                                                                                                           |
| `search_excluded_projects`    | ts     |                                                                                                                                                                                                                                                                                                           |
| `search_index`                | ts     |                                                                                                                                                                                                                                                                                                           |
| `search_index_state`          | ts     |                                                                                                                                                                                                                                                                                                           |
| `security_findings`           | ts     |                                                                                                                                                                                                                                                                                                           |
| `session_artifacts`           | ts     |                                                                                                                                                                                                                                                                                                           |
| `session_budgets`             | rust   | `budget.rs`                                                                                                                                                                                                                                                                                               |
| `session_context_items`       | ts     | Learnings and role notes. They outlive the session; only a workspace delete removes them.                                                                                                                                                                                                                 |
| `session_decisions`           | ts     |                                                                                                                                                                                                                                                                                                           |
| `session_events`              | ts     |                                                                                                                                                                                                                                                                                                           |
| `session_external_tasks`      | ts     |                                                                                                                                                                                                                                                                                                           |
| `session_workflows`           | ts     |                                                                                                                                                                                                                                                                                                           |
| `session_worktrees`           | ts     | Exception: a project move rewrites the paths.                                                                                                                                                                                                                                                             |
| `sessions`                    | ts     |                                                                                                                                                                                                                                                                                                           |
| `settings`                    | ts     | Exceptions: the backup import and the restart marker (`restart_marker.rs`).                                                                                                                                                                                                                               |
| `skills`                      | rust   | `skills.rs`, next to the skill files on disk, and the backup import                                                                                                                                                                                                                                       |
| `step_library`                | rust   | `workflows.rs`. Only Rust writes it today; a candidate to move.                                                                                                                                                                                                                                           |
| `steps`                       | ts     | `saveWorkflow`. Exception: the backup import.                                                                                                                                                                                                                                                             |
| `telemetry_records`           | ts     |                                                                                                                                                                                                                                                                                                           |
| `turn_events`                 | ts     |                                                                                                                                                                                                                                                                                                           |
| `turn_file_sets`              | ts     | One row per writing turn and git mount, written when the turn ends (`recordTurnFileSets`).                                                                                                                                                                                                                |
| `workflows`                   | ts     | `saveWorkflow` and `removeWorkflow`. Exception: the backup import.                                                                                                                                                                                                                                        |
| `workspace_profiles`          | ts     | Exception: the backup import.                                                                                                                                                                                                                                                                             |
| `workspace_starred_issues`    | ts     |                                                                                                                                                                                                                                                                                                           |
| `workspace_values`            | ts     | Per-workspace values (`auto.treeLimitUsd`, `terminal.workspaceFolder`, `sessions.pinned`), keys registered in `queries/entity-value.ts`; deleted with the workspace.                                                                                                                                      |
| `workspaces`                  | ts     | Exceptions: the backup import and the override columns, which have one writer, `patch_workspace_overrides` in `settings_overrides.rs`. It writes only the columns a patch names, refuses a value the column does not allow, and returns the stored row; `packages/db` only reads them.                    |
| `worktree_roots`              | ts     | Exception: a project move rewrites `repo_root`.                                                                                                                                                                                                                                                           |

### Auto tree registry

Migration m230 adds seven tables for Auto, the agent that hands work to agents
of other roles. `AUTO_GATES.isDelegationEnabled` in
`packages/core/src/auto/limits.ts` is `true` and is the only gate (Auto has no
setting; an old `agents.autoExperiment` row is never read), and Auto decides
through the `<<auto>>` block, not through a bridge verb. The tables are additive, so an older build
refuses the file with `DatabaseFromNewerBuildError` instead of reading it.
m230 also adds the partial index `idx_agents_auto_roots` on `agents(session_id, ordinal)` for
root Auto agents, which the scan for an Auto agent without a tree (`listAutoAgentsWithoutTree`)
reads. m232 rebuilds `auto_delegations` (foreign keys off, copy, drop, rename,
the four indexes again, `foreign_key_check`) so its role CHECK also takes
`scribe`, `ci-fixer` and `rewriter`; the rows of the tables that hang on it are
kept.

- `auto_trees` is one row per Auto agent: phase, `phase_rev`, generation, stop
  state, the budget cap, the lifetime counters and the scheduler lease
  (`scheduler_owner`, `owner_lease_expires_at`). m231 rebuilds it (foreign keys
  off, copy, drop, rename, both indexes again, `foreign_key_check`) so the phase
  list gains `finished`, set only by the user, and `cap_usd` may be NULL for No
  cap. A plain `DROP TABLE auto_trees` would cascade through every child table;
  the rebuild keeps their rows. `listAutoTreesToRecover` and
  `idx_auto_trees_live` leave a finished tree out. `auto_delegations`,
  `auto_attempts`, `auto_reservations`, `auto_outbox`, `auto_artifacts` and
  `auto_artifact_versions` hang off it and go with it.
- `store/runtime/auto/scheduler.ts` is the one writer of tree state. A window
  writes only while it holds the lease, so a second window reads. Every
  transition names the phase revision, generation and phase it expects, and a
  lost race comes back as a typed answer.
- `admit.ts` takes a whole batch or nothing. The guarded statement in
  `packages/db/src/queries/auto-admission.ts` is the rule: phase, run, lease,
  the guards of `AUTO_TREE_LIMITS`, four open children (a paused delegation is not open, so a
  paused parent leaves its slot to a substep), remaining budget, plan approval and
  revision. A substep adds its own guard (`autoSubstepStatements`): the parent is
  paused on that question in this generation and has fewer than two helpers. `core/auto/admission.ts` only names the refusal for the caller.
- Money has one source, `treeSpend`: settled, live (what running children spent,
  from their telemetry), reserved and remaining. It feeds admission, the prompt
  line and the screen through `autoBudgetOf`; remaining is `autoRemainingUsdSql`
  in SQL and `autoTreeSpendOf` in JS, and the delivery line counts the turn
  reservation it is delivered with. An attempt keeps a reservation row at 0 USD
  (old rows with an amount are read as 0) and is reconciled to the actual cost,
  or to 0 with the cost marked unknown when none was recorded. Admission only
  asks that the limit has money left (`autoBudgetLeftSql`).
- `settleAttempt` and `landRevision` apply a result only while the tree
  generation, the lease, the attempt and the delegation still match. Anything
  else is dropped and its reservation released.
- `writeArtifactRevision` (`packages/db/src/queries/artifactRevision.ts`) is
  the one way to make revision N+1 of an artifact: a compare and swap on the
  base revision and the history row, in one transaction. The plan hand edit and
  the Auto landing both call it.
- Move to Auto is one transaction, `adoptAgentStatements`
  (`packages/db/src/queries/auto-adoption.ts`): guards for a vanished source, a Run
  step, a running status, an existing delegation or tree, and a lineage that holds
  an Auto agent, then the Auto agent, the tree in `merging`, the adopted delegation,
  its artifacts and the kickoff row. The unique key of the source is the guard
  itself, because writers serialize. A crash leaves all of it or none of it.
  `detachAdoptionStatements` is the inverse.
- A run started for an Auto delivery carries a `deliveryId`, and Rust refuses a
  second run for it ([turns.md](./turns.md) → Surviving a reload or a restart).
- Auto decides with one `<<auto>>` block at the end of its turn ([auto.md](./auto.md) → How Auto
  decides). `applyAutoBlock.ts` reads it when `settleAutoTurn.ts` runs, for a turn that ended
  ok on the current run of a tree that is `deciding` and not stopping, and calls `delegate.ts`,
  `answerQuestion.ts` or `finishTree.ts` through `runAutoCommand.ts`. A refusal, or a block that
  does not parse, becomes a `refusal` outbox row (join key `refusal:<run id>`, so a recovered
  turn writes it once) that the next delivery shows. The refusal counters count a refusal once
  per run: `recordAutoRefusal` takes the generation and the run id, stores them in
  `auto_trees.last_refusal_key` in the same guarded update that adds to `refusals_used` and
  `turn_delegate_calls`, and does nothing when the key is already there, so two duplicate
  settles of one turn move the counters once. `delegate.ts` parses the
  spec (`core/auto/delegateSpec.ts`: a closed role list, rejected before any
  normalization), resolves each child (`resolveDelegateChild.ts`: the mount through
  `core/auto/mountPick.ts`, the model through `resolveProposedRouting`, the artifact
  bodies and the kickoff text from `core/auto/kickoff.ts`) and admits the batch in one
  transaction. A writer must name its mount; a reader without one gets the primary
  mount, captured at admission. Nothing runs for a person until they start an Auto agent, because no tree exists before.
- Delivery to Auto is `deliver.ts`. One transaction claims the pending rows, stores the
  built text on the first row, reserves the turn ceiling and makes the tree `deciding`
  on a planned run id; then the turn starts under the first row id as its delivery id,
  and a second transaction accepts the rows. A refused start gives the rows, the
  reservation and the turn count back and blocks the tree with the reason. A claim that
  dies in between is found again by the delivery id. A blocked tree writes nothing until
  something changes: a gate block on an already blocked tree is not written again, only a
  budget block resumes by itself once the limit covers a turn, and every other block waits
  for `retryBlockedTree.ts` (Retry, a message from the user, or the recovery after a
  restart for a block that is not a gate). Retry resets the no progress streak and refuses
  past the time limit or the budget. `settleAutoTurn.ts` picks the next
  phase when the turn ends (delegating, waiting, merging, done or answering), puts the
  batch back when the turn failed, and counts a turn with no answer and no work, or whose
  block was refused. The text it delivers (`buildDeliveryMessage.ts`) starts with a digest of the
  tree (open agents with role, state and age, questions waiting, the budget) and carries each
  result's artifact text, cut when long, because a provider may not resume the session.
- Children start in `launchChildren.ts` only once the Auto turn is over. Each child
  gets its agent row with the preallocated id (`createAutoChild.ts`), a baseline
  snapshot of its mount (`worktree_snapshot`) and a turn with `origin: 'delegation'`,
  its `confinedRole`, the frozen mount target and its attempt id as delivery id.
  `finishAttempt.ts` reads the closing line (`core/auto/closing.ts`: the `step-done` line
  of its own agent id, and a blocking question), registers the artifacts the child
  wrote, attributes the changed files by comparing snapshots, and settles the attempt
  with a `DelegationResultV1`. A revise turn captures nothing in the old slot: the new
  version is parsed (`core/auto/revisionParse.ts`) and lands through `landRevision`.
  `join.ts` settles a batch only when every member ended, writes one results row under a
  unique key and `advancePhase.ts` moves the tree on. `createAutoRuntime.ts` runs these
  in order, one tree at a time.
- `stopTree.ts` writes the stop first: the generation goes up, the phase is `stopping`,
  the rows of the old generation are dropped. Then
  it cancels the run of Auto and of every live attempt with the confirmed cancel. Only
  when every process is confirmed gone does it close the attempts, settle the
  delegations as stopped, reconcile or release the reservations and set `stopped`; one
  cancel that fails leaves the tree `stopping`, and a restart resumes it. A late result of
  the old generation is dropped by the fences. A new user message reopens a stopped tree.
- `enforceDeadlines.ts` never cuts a working child on the clock. A running child is
  cancelled only when its agent wrote no `turn_events` row (output, tool call, usage)
  for `AUTO_CHILD_IDLE_MINUTES` (30), counted from the later of its attempt start and
  the start of this runtime (`readAgentLastEventAt`), so a past `deadline_at` on an old
  row never expires it at load; a tool call without its end (`hasAgentOpenToolCall`)
  counts as activity. It settles `timed_out` with reason `no_activity` only
  after the exit is confirmed, and Auto continues it with `retryOf`. A child paused on
  a question still expires at `deadline_at` and needs no process to expire.
  `expireStaleDecide.ts` handles a tree still `deciding` `AUTO_STALE_DECIDE_MS` (10
  minutes) after it entered the phase with no live root run: it settles the turn from the
  run outcome when one is stored, else moves the tree to `blocked` with
  `AUTO_STALE_DECIDE_TEXT`, reconciles the turn reservation and puts the delivered rows
  back as pending copies for Retry. A live run is never touched. `recover.ts`
  rebuilds a tree after a restart in the order of the recovery table: claimed rows are
  accepted when the registry holds the run and given back when it does not, a turn or a
  child whose run is gone is closed from what the run left behind (a child with no
  answer fails as interrupted), a live run is watched until it ends, and a revise whose
  landing was cut short is landed from the version stored on its attempt. Two windows
  recovering at once do not both act: the lease is the owner check.
- `makeAutoRuntime.ts` builds the real ports and the runtime from a database and the store
  getter; `store.sqlite-auto-manual-proof.test.ts` runs two of them on the real store for the
  stop, restart and crash proofs.
- `startAutoRuntime.ts` is the only place the pieces meet the app. `App.tsx` starts it in
  the main window. When `AUTO_GATES.isDelegationEnabled` is false it only registers the ports of the
  screens and starts nothing. When it is true (the shipped value) it builds the real ports
  (`createRealAutoPorts.ts`: the store's `sendTurn` and confirmed cancel, the mount list,
  `worktree_snapshot`, the delivery lookup of Rust, the child agent rows and the run
  ledger of `provider_runs`), claims each tree it recovers, and drives every live tree
  every fifteen seconds, which also renews the owner lease. The interval starts with the
  runtime and stops only on teardown. Each tick also starts the tree
  of an Auto agent that has none (`startAutoTrees.ts`), capped at the budget of its session,
  else at the `workspace_values` key `auto.treeLimitUsd`, else with no cap
  (`autoTreeCapUsd`). It hands the screens the ports they call, the answer to a
  confirm card (`confirmDelegation`) and the Stop button (`stopTree`); the Stop button
  reports a tree that did not stop, and one that another window runs. When delegation is
  on it also opens the Auto user-turn door (`registerAutoUserTurnPort`): the first message
  of a new Auto agent (`spawnAgent`, `sendAutoKickoff.ts`) creates the tree on the spot
  (`startAutoTree`, the same function the tick uses, so a race makes one tree) and queues
  the message as a `user` outbox row through `runtime.say`, instead of a plain turn. Every later
  operator message to the root of an Auto tree takes the same door from `sendTurn`
  (`routeAutoUserTurn.ts`).
- A child that asks a blocking question ends its attempt `paused` and queues a question row
  for Auto at once. `answerQuestion.ts` (the `answer` action) resumes it: in one transaction
  it admits a new attempt on the same agent with the question and the answer stored on it,
  checks that the limit has money left, counts it against the attempt limit and the four running
  slots (`core/auto/resumeAdmission.ts`) and moves the delegation from `paused` to `starting`.
  The same question answered twice is one resume; a different text is refused. The question
  of a child never reaches the open questions of the session
  (`routeQuestions.ts`, read by `finalizeTurnStream.ts`), so the user never answers a
  hidden child. Inside the tree no agent splits its work either: the kickoff forbids
  `<<fan-out>>`, and a split that still comes from the child of a delegation is turned
  down with a note on its turn (`isFanOutRejected.ts`, read by `completeResolvedAgent.ts`),
  so every process of the tree has a delegation. A retry is a delegate entry with `retryOf` and a reason only
  (`prepareRetry.ts`): it repeats the work of a settled delegation as a new delegation on
  the same agent and mount, with the model of the earlier attempt unless one is given,
  and the settled result stays as it was. A retry of a delegation that did not complete
  continues its work: the kickoff says to keep what is in the worktree, and its first
  attempt carries the baseline of the earlier one (`carriedSnapshot.ts`), so the
  result counts the commits made before the stop. A revise whose version already landed is not
  repeated: the retry answers with the landed version.
- The screens read the registry through one slice, `store/slices/auto-view/`:
  `loadAutoTrees({ sessionId })` reads the trees of a session with their
  delegations, artifact ledger and `treeSpend` budget (`readAutoTreeViews`),
  keeps only the latest answer and writes the store only when something
  changed (`sameAutoTreeViews`). `features/auto/useAutoTrees` loads on mount
  and polls every 2 seconds only while the session has an Auto agent that is
  pending, running or blocked, or a tree that is not finished; a finished Auto
  run reads once. Two hooks on one session share one interval
  (`useAutoTrees/sharedPoll.ts`); nothing pushes tree changes to a window yet. The Settings
  row counts the working trees with `countLiveAutoTrees`.

### On-disk data layout

Everything the app saves for itself lives in `~/.goodboy`, an owner-only folder (`0700`). `data.db`, its `-wal` and `-shm` files and every `.bak` copy are `0600`: `db::restrict_data_files` sets it on every open and restore, after the reset copy, and through the `db_secure_files` command that `runRuntimeMigrations` calls right after each snapshot (a failure there stops the migrations). Windows sets no bits.

One function, `app_paths::data_dir`, names that folder for all Rust code, and one function, `db::open_connection`, opens every connection to the database (foreign keys on, WAL, `synchronous = NORMAL`, a 5 second busy timeout). A debug build uses `data.dev.db` and `GOODBOY_DB_FILE` overrides the file (`db::resolve_db_path`). The history copy folder has no fallback: with no home folder, a copy fails with an error instead of landing in an empty path.

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
  once per artifact every 10 minutes, and read back as `SessionArtifact.openedAt`
  so a report or wireframe nobody opened shows New for its first 24 hours; an older
  one that was never opened reads Ready, since rows made before the column was
  written have no open time), `kept_at` and `kept_until`
  for the Storage Keep action. The Delete verb of the Artifacts list sets the
  status to `discarded` (Recently deleted) and Undo sets it back. Delete
  permanently, offered only on a `discarded` artifact, removes the folder with
  `artifact_mirror_remove` and then the row, which takes its plan consumptions
  (the Run by history) with it.
- `file-versions/<session-id>/`: saved versions of files, one copy per
  version named `<version-id>-<file name>`, each with its `file_versions` row.
  A session that writes in a `sessions/<name>` folder also stages its turn in
  `file-versions/<session-id>/staging/<run-id>/` until the turn ends. A
  staging that fails removes its run folder, and a run folder left without its
  manifest (a crash) is swept by the next begin of that run, so a retry is
  never refused for a leftover. A restore copies into a temp file beside the
  target and renames it, as the folder store does (`copy_atomic`), so a failed
  restore never leaves half a file. This layout is what older builds read:
  changing it is a new on-disk format and a one-way door
  ([versioning.md](versioning.md)).
- `folder-versions/<folder-key>/`: saved versions of a plain folder that agents
  edit in place, keyed by a hash of the folder's real path. Nothing is written
  inside the folder itself. `mirror/` is the first copy of the folder (an APFS
  clone where the disk allows, else a copy) as it was when the last writing
  turn began or ended, `index.json` its size, modified time and hash per file,
  `staging/<run-id>.json` a turn that began and has not been saved yet, and
  `turns/<session-id>/<run-id>.json` each turn's changes (added, modified and
  deleted, with before and after hashes) and each restore. Before copies of
  modified and deleted files go to `file-versions/<session-id>/` with their
  rows, as above. Not versioned: files over 15 MB, links, the dependency and
  build folders of the one `reproducible_dirs` table (see below), `.git`,
  `.DS_Store` and the `sessions/` folders of older sessions. A folder past
  100,000 files or 8 GB keeps its first files and the turn's `skipped` list
  carries one `folder_limit` entry with `omitted`, the number of files left
  unversioned. Pruning drops a session's versions 30
  days after it ends (archived or deleted), then the oldest versions over the
  folder cap (1 GB or the folder's size, whichever is larger), never the newest
  version of a file a live session changed; rows go only after their copies.
  Older builds never read this folder.
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
project keeps the session folders of sessions made before 0.27.3 in
`<project-root>/sessions/`; newer sessions write in the folder itself and add
nothing to it. Skills live
in `<project-root>/.goodboy/skills/`, the older `<project-root>/.kay/skills/`
(read until 0.31.0) or `<project-root>/.claude/skills/`.

### How mounts are saved and recovered

The mount table, the operation log, recovery and cleanup are described in
[mounts.md](mounts.md).

### Dependency and build folders

One table, `REPRODUCIBLE_DIRS` in `apps/desktop/src-tauri/src/reproducible_dirs.rs`,
names the folders a tool can rebuild, each with a scope. `Dependency`
(`node_modules`, `__pycache__`, `.venv`, `venv`, `Pods`, `vendor`) counts at
any depth. `Output` (`dist`, `build`, `out`, `target`, `DerivedData`, `.next`,
`.turbo`, `.gradle`) counts at the top of a project and, for the version walk,
at any depth. `TopOnly` (`coverage`) counts at the top of a project only. Four
readers ask it and none keeps a list of its own: the folder signals and the
saved-versions walk (`is_skipped_in_walk`: dependency and output at any depth),
the first-commit plan (`is_dependency` for any parent folder, `is_output_at_top`
for the first one), the detach assessment (`is_reproducible_at_top`: an ignored
folder like these is not at risk) and the script finder (`is_dependency`, plus
`.git`). Add a name there, with a test, and all four follow.

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
`apps/desktop/src-tauri/src/project_relocation.rs`) runs on a blocking
thread, not the async runtime. It first checks that the destination is a
folder and, for a repo project that saved a root commit, that the repository
there has the same one (`destination_differs` otherwise). Then it rewrites the
tables above inside one transaction, checks the `UNIQUE` constraints on
`projects.root_path` and `session_worktrees.worktree_path` first, and calls
`git worktree repair` from the new root once the commit lands. A path matches
only at a folder boundary (the path itself or the path plus `/`), never as a
substring and never through `LIKE`, so a sibling folder `ledger-core-web`, a
`ledger_core` next to `ledgerXcore` or a path holding `%` stay untouched. Every
update is scoped to the moved project: its own mounts, its retained paths (and
orphan rows with no project), its skills (same workspace), the resolve rows of
its mounts, and `mount_operations` JSON, which is parsed and rewritten value by
value. The saved folder versions (`folder-versions/<key>`, keyed by a hash of
the real path) are moved to the new key by `rekey_folder_versions`, on undo
too. What could not be carried over (git links, saved versions) comes back as
`repairError` and shows under the success notice. Finding
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
limits, linked integrations and app preferences. Folder paths and
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
rules, limits, scripts, linked integrations) computed by checking each
bundle row against the local database before any write, so the confirm step
shows what will change instead of only a post-apply count. Import only
inserts and updates; it never deletes a row, and a project it cannot resolve
a folder for is skipped and counted, not dropped from the file.
