# Subprocess environment

> **Read this when** you start a process from Rust and must choose which
> environment it gets, or a push fails on a missing variable. **Not for** how a
> process is tagged and stopped ([processes.md](processes.md)). The other pages
> are listed in [architecture.md](../architecture.md).

An app opened from Finder or the Dock on macOS or Linux gets a bare
environment, without the variables your terminal has. The Rust shell asks your
login shell for the real environment and passes it on to the processes it
starts (`apps/desktop/src-tauri/src/path_env.rs`). This layer runs on macOS and
Linux.

## Which helper to use

- **A script the user wrote** gets the full login environment. Use
  `command_with_login_env`, or `resolved_env()` for terminal spawners that
  never build a `Command`.
- **Everything else** gets the resolved `PATH` on top of the app's own
  environment. Use `command`. It sets `PATH` and clears nothing else, so the
  child inherits every variable the app process holds. Nothing here is an
  allowlist.

A push (`git_push`, through `run_git_authenticated`) gets the full login
environment, so a repo's `pre-push` hook can read variables set in `~/.zshrc`,
like registry tokens or tool settings. `PATH` is set after the login
environment is copied, so it wins over anything your profile sets.

If a push fails because a variable is missing, do not skip hooks with
`git push --no-verify`. Pass the environment through instead.

## The login shell probe

`login_shell()` is the one place that decides which shell to use, so the
built-in terminal and the environment check always agree.

1. The login shell is asked at most three times if it fails or times out.
2. A good answer is cached for the life of the app.
3. After three failures the static list is cached: Homebrew, `~/.local/bin`,
   `~/.cargo/bin`, `~/.volta/bin`, `~/.asdf/shims`,
   `~/.local/share/mise/shims` and every `~/.nvm/versions/node/*/bin`, newest
   first.

The probe runs in its own session and is killed and reaped on its deadline
(`apps/desktop/src-tauri/src/proc/probe.rs`).
