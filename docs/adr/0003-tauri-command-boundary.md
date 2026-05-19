# ADR-0003: Tauri command boundary

**Status**: Accepted
**Date**: 2026-05-19
**Deciders**: Amin

---

## Context

The frontend talks to Rust via `invoke('<cmd>', args)`. Three categories of mistake had accumulated:

1. **Permission breadth** — `gh_run` accepted any `gh` subcommand from the JS side, including destructive ones (`repo delete`, `secret`). `open_in_editor` would spawn any binary string. `open_url` would happily pass `javascript:` or `file://` URLs to `open` / `xdg-open`.
2. **Inconsistent error envelopes** — most commands returned a typed `Result<T, E>` with a `{kind, message}` envelope; a few (`open_url`, `provider_action`) returned `Result<_, String>` and a few (`check_provider_auth`, `get_provider_status`) were infallible, silently swallowing failures.
3. **Duplicated bookkeeping** — UUID generation, ISO timestamps, calendar math, and regex compilation were copy-pasted into every command module that needed them, and had already drifted (the `days_in_month` fallback returned 30 in one file and `unreachable!()` in another).

This ADR codifies the rules so the boundary stops being a bug-magnet.

## Decision

### 1. Allowlist every external surface

Any command that spawns a subprocess, opens a URL, or executes SQL **must** validate its argument against an explicit allowlist at the Rust boundary. The frontend is trusted but not infallible: a future bug, a misplaced template literal, or rendering of untrusted markdown can still produce an argument the command was never meant to accept.

- `editor::open_in_editor` / `open_file_in_workspace` — the `editor` argument is checked against `KNOWN_EDITORS` before spawn. Unknown binaries return `EditorError::NotAllowed`.
- `editor::open_url` — the URL scheme is checked against `ALLOWED_URL_SCHEMES` (`http`, `https`, `mailto`). Anything else returns `EditorError::SchemeNotAllowed`.
- `github::gh_run` — the first arg is checked against `ALLOWED_GH_SUBCOMMANDS` (`--version`, `api`, `pr`, `repo`); for `pr` and `repo` the verb is checked against a per-subcommand allowlist (`view`, `list`, `diff`, `checks` / `view`). `gh repo delete` cannot be reached from the frontend.

The `db_*` commands still accept arbitrary SQL because the migration system needs it; that surface is gated by the renderer's strict CSP and is not part of this ADR's allowlist set. A follow-up should consider splitting `db_exec` into a migration-only command and a query-only command, both with explicit SQL prefixes.

### 2. Every command returns a typed `Result<T, E>`

The envelope is `{kind: string, message: string}` via the custom `Serialize` impl that every command module already uses. New commands **must not** return `Result<_, String>` or be infallible — the latter hides failure modes from the UI.

Error type ownership:

- Per-module error enums with `#[derive(thiserror::Error)]`.
- Each module defines its own `serialize` impl that emits `{kind, message}`.
- The boilerplate is identical across modules; a future cleanup will introduce a `impl_command_error!` macro to remove ~150 lines.

### 3. Shared helpers live in `src-tauri/src/util.rs`

`uuid_v4`, `iso_now`, `ms_col_to_iso`, `is_leap_year`, `days_in_month`, `epoch_secs_to_datetime` are owned by `util.rs`. Modules import them via `use crate::util::{...}`. Re-implementing them in a new module is a review-fail.

Regexes used by multiple call paths must be hoisted into `OnceLock`-backed statics, not rebuilt on every call. Example: `worktree::sanitize_slug`.

### 4. Startup must surface, not panic

`lib::run` no longer `expect`s on `db::open`. A failure prints a clean message to stderr and exits 1. A future iteration should surface this via the tauri dialog plugin, but a clean exit is already a strict improvement on a Rust stack dump in the user's terminal.

## Consequences

**Positive**

- A compromised renderer cannot pivot the existing surface into arbitrary process execution, file open, or destructive `gh` operations.
- Frontend code can rely on a uniform error shape (`{kind, message}`) for every command, instead of having to switch on type per command.
- Calendar math has a single owner and a single bug fix point.

**Negative / trade-offs**

- The `gh_run` allowlist needs maintenance: every new `gh` subcommand the app wants to use requires adding to `ALLOWED_GH_SUBCOMMANDS` (or to the per-verb allowlist). Accepted — the cost is a one-line PR per addition; the alternative is leaving the surface broad.
- The DB commands are not yet allowlisted. Documented as a known gap.

## Follow-ups (tracked, not blocking)

1. Split `db_exec` / `db_execute` / `db_select` into clearly-named role variants (`db_run_migration`, `db_query`, `db_mutation`) with prefix-based SQL validation.
2. Introduce a `impl_command_error!` macro to collapse the duplicated `Serialize` impls.
3. Move `lib::run` startup failures into a tauri dialog rather than stderr.
4. Decide if `config_export::export_config_to_file` / `import_config_from_file` need a path-guard (canonicalize + reject paths outside the user's chosen home / dialog-supplied path).
