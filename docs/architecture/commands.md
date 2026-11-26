# Where commands run

> **Read this when** you add or change a Tauri command and must choose between
> a plain `fn` and an `async fn`. **Not for** how a command is wired end to end
> ([recipes/tauri-command.md](../recipes/tauri-command.md)) or Rust style
> ([rust.md](../rust.md)). The other pages are listed in
> [architecture.md](../architecture.md).

A Tauri command declared as a plain `fn` runs on the main thread, the one that
draws the window and handles input. While it works, nothing else in the app
moves. So the split is by what the command does.

- **I/O: `async fn`.** A command that touches the file system, git, a
  subprocess or the keychain runs its blocking work inside
  `tauri::async_runtime::spawn_blocking`. It keeps its name, arguments and result, and a
  join error becomes its own error type (`restart_prepare` and
  `history_git_supported` follow the same shape). Worktree, history, config
  export and import, the git and `gh` wrappers and `explore_read` already work
  this way.
- **Short SQLite: `async fn`, inline.** An async command runs on the worker pool, so a query under the
  `Db` lock does not freeze the window. Anything that can take long still goes
  through `spawn_blocking`.
- **Memory only: plain `fn`.** Registry lookups, lease bookkeeping and the answers to the
  frontend (`mount_command_result`, `worktree_writer_*`, `frame_stage`).
- **Terminal and login input: plain `fn`, on purpose.** `terminal_write` and `provider_lifecycle_write` send keystrokes,
  and the main thread keeps them in the order they were typed; two async calls
  could finish out of order. The command never writes to the pty itself: it
  queues the bytes for the session's writer thread (`proc::pty::PtyInput`, 256
  chunks deep), so a child that never reads cannot hold the main thread, the
  session lock, a close or a cancel. A full queue answers `backlogged`, a
  session whose writer died answers `input_closed`, and a session already gone
  is a quiet no-op.

Never hold a `std::sync::Mutex` guard across an `.await`. Take the lock, copy
out what you need and drop it before the next `.await`, or do the whole locked
section inside `spawn_blocking`.

## Tests

`command_threading` (a Rust test) scans every `#[tauri::command]` and fails
when a plain `fn` command is not on its short list of in-memory commands. A new
command that does I/O has to be async, or the list has to change in review.
