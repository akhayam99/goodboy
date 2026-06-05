# ADR-0002: Spawn User-Facing Subprocesses With the Login-Shell Environment

**Status**: Accepted  
**Date**: 2026-06-05  
**Deciders**: Amin

---

## Context

macOS apps launched from Finder/Dock inherit only a minimal environment, not the one a user's terminal has. `path_env.rs` already works around this for `PATH`: it probes the login shell once (`zsh -ilc 'printf %s "$PATH"'`), merges the result, and hands it to spawned commands via `command()`. That fixes binary discovery (`git`, `gh`, `claude`, editors) but nothing else.

The gap surfaced through the deferred review-comment resolution feature (see [[project_resolve_batch_push]]). "Push & resolve" and "Push now" funnel into `git_push` (`github.rs`), spawned with `command("git")`, PATH only. A target repo's `pre-push` hook (husky running `yarn`) reads `${GITHUB_PACKAGES_TOKEN}`, a variable the user exports in `~/.zshrc`. Absent from the GUI process env, `yarn` throws `Failed to replace env in config`, the hook exits non-zero, and the push is rejected. The branch never pushes and the review thread never resolves, while the queue (a pure DB write) keeps working. The failure looked silent because `emitNotification` records to the NotificationCenter, not a toast.

The terminal (`terminal.rs`) does not have this problem: it spawns the real login shell, which sources the rc files and so carries the full exported environment. Subprocesses spawned directly by the Rust shell do not.

## Decision

Resolve the **full login-shell environment** once, cache it, and replay it onto subprocesses that can trigger user-authored git hooks or tooling.

- `path_env::resolved_env()` probes the login shell (`zsh -ilc env`), parses `KEY=VALUE` pairs, dedups, and caches via `OnceLock`, the same lazy, cached shape as `resolved_path()`.
- `path_env::command_with_login_env(binary)` builds a `Command` pre-loaded with that environment, then overrides `PATH` with the resolved value. Callers may still set their own vars (e.g. `GH_TOKEN`) afterward; last write wins.
- `git_push` (`run_git_push`) uses `command_with_login_env`. The pre-push hook now sees the same environment a terminal would, so it behaves identically to a manual `git push`.

`command()` (PATH only) stays the default. The login-shell env is heavier to resolve and broader in scope; it is reserved for subprocesses that run user hooks or user tooling. Internal git plumbing (`rev-parse`, worktree management) does not run hooks and keeps `command()`.

Replaying the full environment is intentional: it mirrors what the user's terminal already does, so any tooling the hook depends on is satisfied. Skipping hooks (`git push --no-verify`) was rejected: it would silently bypass checks the user's repo relies on, and it does not match terminal behavior.

## Consequences

**Positive**

- Git hooks that depend on exported environment (registry tokens, tool config) work from the app exactly as they do in a terminal.
- The fix lives in the subprocess-spawn layer (Rust shell), so business logic in TS is untouched, consistent with the "Rust only for the shell" boundary.
- One cached probe; no per-push cost after the first.

**Negative / trade-offs**

- One extra login-shell spawn on first use (a few hundred ms), amortized by the cache.
- The whole exported environment reaches the hook process, same exposure as a terminal.
- An interactive shell that prints to stdout from its rc files can add noise to the probe; malformed lines (no `=`, whitespace in the key) are dropped during parsing.

## What this does NOT cover

- Surfacing push/resolve failures as a transient toast: today they land only in the NotificationCenter, which is why this failure read as "nothing happened." Tracked separately.
- Windows subprocess environment: there is no login-shell probe there; this decision is macOS/Linux scoped.
