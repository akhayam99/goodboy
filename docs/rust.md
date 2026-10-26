# Rust rules

> **Read this when** you're writing or reviewing Rust under `apps/desktop/src-tauri/src/`. **Not for** how a Tauri command is wired end to end ([recipes/tauri-command.md](./recipes/tauri-command.md)), the systems behind the app ([architecture.md](./architecture.md)), or the comment and dash bans, which [AGENTS.md](../AGENTS.md) owns for Rust too.

The rules here are the ones a reviewer can cite and a cargo test can check. A rule is added when a file that needs it is touched, with its guard, not in advance. Rule numbers are stable: a gap means the rule is not written yet.

## R4: errors

- A command returns `Result<T, E>`. `E` serializes to an object with `kind` and `message`. Never a bare `String`.
- An error enum calls `impl_error_serialize!` from `util/mod.rs` and gives each variant a `kind()`. A command with no enum of its own returns `util::MessageError`: `Refused` when the caller asked for something not allowed, `Failed` for everything else.
- An enum whose variants carry data the UI reads (`BranchCleanupError`) serializes the same two fields by hand and adds that data as extra fields.
- A `spawn_blocking` join error maps to `MessageError::Failed`, and the inner `Result<_, String>` of a blocking body maps with `.map_err(MessageError::Failed)`.
- Guard: the three monitor commands pin the type in `monitor::tests::the_monitor_commands_reject_with_a_message_error`. The webview reads a bare string as kind `unknown`.

## R5: processes and signals

- A process is started, waited for, signalled and stopped under `proc/` only. `proc/spawn.rs` starts a piped child, `proc/pty.rs` owns a pty session (`stop`, `wait_for_exit`, `PtyInput`), `proc/probe.rs` runs a short tool call with a deadline, `proc/reap.rs` ends everything a spawn started and `proc/open.rs` opens a file, a folder or an address with the OS.
- `proc/signal.rs` is the only place that sends a signal or asks whether a pid is alive: `exists`, `is_reachable`, `send`, `send_to_group`, `group_has_members`, `session_of`. It refuses pid 0 and 1.
- A pty session is stopped with `proc::pty::stop`, which signals the whole session by tag before it kills the leader. Killing the leader alone leaves its grandchildren holding ports.
- A wait on a child never holds the lock the close and cancel paths need: `wait_for_exit` polls `try_wait` and takes the lock for one poll at a time. A write to a pty goes through `PtyInput`, a bounded queue with its own writer thread, so a child that never reads cannot block a command.
- An address or a path is opened through `proc::open::open_target`, `open_path` and `reveal`. `open_path` refuses an executable (`util/open_guard.rs`); `open_target` is for an http(s) address a caller already checked.
- A detached child is reaped by `proc::detach::detach`.
- Guard: `rust-spawn-sites` counts `.spawn()` and `.kill()` outside `proc/` and only falls.

## R6: one clock, one launcher

- Time is read in `util/time.rs` and nowhere else. The functions are `now_secs` (`u64`), `now_ms` (`i64`), `now_millis_u64` (`u64`, saturating), `now_nanos` (`u128`), `system_now` (a `SystemTime`, for APIs that take one) and `iso_now` for a timestamp string. A module never defines a private copy and never calls `SystemTime::now()`.
- `util/ids.rs` may read the clock, because an id mixes in the nanoseconds itself.
- Git is launched through `proc::git::Git` only.
- Guards: `util::time::tests::only_util_reads_the_system_clock_in_production_code` and `proc::git::tests::only_proc_git_launches_git_in_production_code`. Both read the production lines of every Rust file through `util/source_scan.rs`, which skips `#[cfg(test)]` items and files named `tests.rs`. A test that needs the clock calls the same helpers.

## R7: unsafe

- `unsafe` lives in `proc/` and `platform/`, wrapped in a function whose name states the invariant (`exists`, `send_to_group`, `session_of`). A caller elsewhere calls that function. A comment is not the way to justify a block.
- Guard: `proc::signal::tests::unsafe_outside_proc_never_grows_and_the_baseline_follows_it_down` counts the production lines with `unsafe` outside those folders against the per-file table in that test. The count only falls: lower the table in the same commit that removes a block.

## R9: wire structs

- A struct that crosses to the webview puts `#[serde(rename_all = "camelCase")]` on the struct, never a `rename` on each field. Only a key that is not the camelCase of its field keeps its own `rename`.
- A field inside an enum variant under a kebab-case `rename_all` is not covered by it: the enum adds `rename_all_fields = "camelCase"` (`MoveOutcome`, `BranchMergeState`), or the field keeps its own `rename`.
- A wire boolean follows the name the TypeScript side uses (`isPlatformSupported`). An internal boolean takes an `is`, `has`, `can`, `should`, `was` or `will` prefix in new code and when its file is touched.
- Guards: a `wire_shape` test per serialized struct pins its json (`util/wire_shape.rs`), and `util::wire_shape::a_field_never_renames_to_its_own_camel_case` fails on any `rename` that repeats the camelCase of the field it sits on.

## Not written yet

R1 to R3, R8 and R10 to R13 wait until a file they affect is touched.
