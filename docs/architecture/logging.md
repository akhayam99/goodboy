# Logging

> **Read this when** you write a log line, print an error, or change where the
> app log lives and how it rotates. **Not for** render crashes
> ([frontend.md](frontend.md)). The other pages are listed in
> [architecture.md](../architecture.md).

Every build starts the log plugin first in `setup` (`src-tauri/src/logging.rs`),
before anything else that can warn. It writes one local file, `goodboy.log`, in
the app's system log folder: `~/Library/Logs/com.goodboy.desktop/` on macOS,
`~/.local/share/com.goodboy.desktop/logs/` on Linux,
`%LOCALAPPDATA%\com.goodboy.desktop\logs\` on Windows. Nothing is sent
anywhere; a debug build also prints to stdout.

## The file

- **Level.** `info` and above. A window cannot write to it: the `log`
  permission is not granted.
- **Access.** The folder is owner-only (`0700`) on macOS and Linux.
- **Size.** A file rotates at 512 KiB, and the plugin keeps the 3 newest dated
  archives (`goodboy_<date>_<time>.log`), under about 2.5 MiB in all. Two
  rotations in one second leave a `.log.bak` the plugin never removes, so
  `logging::init` keeps only the newest at each start. The handshake failure a
  stranger could trigger on the phone listener logs at `debug`.
  `logging::tests` pins the cap.

## What a line may hold

A fixed label and a short reason, never a token, a prompt, a file's content or
a command line. `logging::detail` is the one way to print an error: first line
only, credentials inside URLs hidden, cut at 200 characters.

- **Slow operations.** `logging::slow(label, started)` and `logging::timed`
  write `[slow] <label> took <n>ms` at 250 ms or more
  (`logging::SLOW_THRESHOLD`). The labels are fixed: `git <verb>` in the `Git`
  runner (the subcommand only, never an argument or a path, and `git` alone
  when it is not a plain name),
  `db_exec`, `db_execute`, `db_select` and `db_transaction` (each with a
  `<command> lock wait` line when the lock wait was that long) and `db_vacuum`.
  Spawn and the provider probes do not write one.
- **Dropped errors.** `logging::note_failure` and `note_kill_failure` replace
  `let _ =` in process teardown and git cleanup (scratch and copy worktree
  removal, `worktree prune`, `cherry-pick --abort` and the resets after it). A
  child that already exited is not reported. Event emits to a closed window and
  best-effort file cleanup stay silent.
- **A step that ended silently.** `step_end_log::log_step_end` writes
  `[turns] step ended without a result agent <id>: <reason>` when a workflow
  step still runs after its turn settled with nothing to continue it
  ([workflows.md](../workflows.md) → When a step stops without its done
  marker). It holds the agent id and a fixed reason, nothing from the
  conversation. Control characters become spaces, and each field is cut at 200
  characters.

## Startup

- **Logging never blocks startup.** `logging::init` builds the logger itself and
  does not register the plugin.
  If the folder or file cannot be opened (a `goodboy.log` owned by root after a
  `sudo` run, a read-only folder), it prints one line to stderr and the app
  starts with logging off.
- **Before the logger exists.** `db::open` runs first, so its messages go
  through `logging::early`: stderr at once, and the file when `setup` starts
  the logger (at most 16 lines).
- **A frozen window.** `window_heartbeat.rs` is a watchdog with no network and
  no kill: it notes a freeze in `last-crash.json`
  ([navigation/shell.md](../navigation/shell.md), After a crash the app could
  not show) and logs nothing else. It does not run in debug builds, where a
  paused debugger would read as a freeze.
