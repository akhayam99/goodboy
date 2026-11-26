# Traps in provider CLIs and processes

> **Read this when** you change how Goodboy spawns, signs in, reads or stops a
> provider CLI or what a turn leaves running. **Not for** how a turn works
> ([../turns.md](../turns.md)) or adding a provider
> ([../recipes/add-a-provider.md](../recipes/add-a-provider.md)).

## Spawning a CLI

### Copilot gets no classic token

A Copilot run gets `GH_TOKEN` or `GITHUB_TOKEN` only when it is fine-grained (`github_pat_`). The CLI reads those variables before its saved sign-in and refuses classic tokens, so the Git host token Goodboy sets, or one from the shell, would break every turn or replace the Copilot sign-in. The agent's own shell then has no Git host token.

`strip_tokens_copilot_refuses` runs after `apply_git_host_access`; before it, the stored token would be set over the stripped one.

### A spawned Claude never thinks it is nested

`aux_spawn.rs` strips the variables that mark a run inside another Claude Code or Agent SDK session. Passed on, they make the claude CLI refuse with a nested-session error or fail its sign-in.

### A turn drains stderr on its own thread

`turn.rs` reads stderr beside stdout. Reading it after stdout ended deadlocked: a CLI that writes more than the pipe buffer (about 64 KiB) to stderr blocks and stops producing stdout.

### The query socket sits in its own folder

The socket is in `~/.goodboy/query/`, not `~/.goodboy`, because Codex and Claude turns get its folder as a writable `--add-dir`. Beside the database, that would expose `data.db`, `file-versions/` and `history-copies/`. `turn.rs` has a test that fails when a provider's `--add-dir` contains those paths.

This matters only where `--add-dir` confines: Codex in `workspace-write` and Claude outside `bypassPermissions`. Claude in `bypassPermissions` (the default), Cursor, OpenCode and Antigravity have no OS sandbox.

### Codex needs the own git folder of a linked worktree, not only the common one

A session worktree keeps its index, `HEAD` and `rebase-merge` in `<repo>/.git/worktrees/<name>`. With only `<repo>/.git` as an `--add-dir` root, Codex in `workspace-write` fails a commit on `index.lock` and a rebase on `rebase-merge` ("Operation not permitted"); adding the per-worktree folder fixes both (checked with Codex 0.162.1).

`buildTurnWritableRoots` takes `worktreeGitDirs` from `worktree_git_dir` for every writable mount, and keeps the common folder for refs and objects. A new place that hands a writer its roots calls `resolveTurnWritableRoots`.

### A read-only Cursor run takes the trust flag, never the force flag

`cursor-agent` 2026.10.22 and later ends a headless turn with "Workspace Trust Required" unless it gets `--force` or `--trust`. `workspace_trust_args` adds `--trust` after the probe, like `partial_output_args`, so `turn_args` and `side_job_args` stay pure. A fake Cursor CLI lists `--trust` in its `--help`, and a new Cursor spawn site calls it. Never replace `--trust` with `--force` on a read-only job: `--force` grants shell and write rights.

Never use `--force` for a read-only job: it grants shell and write rights.

### A Claude allow rule names a path, never a variable

Claude refuses a Bash command holding a variable, even an allowed one ("A variable in this command can't be checked before it runs"), so a rule names an absolute path, never `$GOODBOY_BIN`. Test a confinement with a command that writes: Claude allows `ls` without a rule.

## Sign-in and usage

### The sign-in CLIs speak through their exit code

`claude auth status` and `codex login status` exit 1 when signed out, with a good answer on stdout. `cursor-agent status` can say "Logged in (unable to fetch user details)" while every run fails "Authentication required". Reading a non-zero exit as unknown, unknown as signed out, or a local token as a server account each made providers flap.

`probeOutcomeOf` and `providerHealth.ts` keep them apart. Do not collapse them into one connected flag:

- a probe with no answer never changes the standing;
- a lost sign-in needs two answers 10 seconds apart;
- only a refused run or a `verified` answer speaks for the server.

### A CLI may read an unknown subcommand as a prompt

Claude Code before 2.1.41 sends `claude auth status` to the model as a message, so every probe spent a subscription request and the provider sat at cannot check. Never add an argument to a check or login command without the version that ships it.

`claude_version::has_auth_subcommand` gates the status check and `lifecycle_refusal` gates login and logout. The fake claude records every call, so `claude_auth_never_sends_a_prompt_to_an_old_cli` catches a slip.

### Auth checks run off the main IPC thread

The auth check is async and does its process work on a blocking thread. Four parallel refreshes on the main thread freeze every other IPC call.

### A lifecycle exit ships the truth

`provider_lifecycle_run` re-detects the binary and re-checks auth when the pty ends, on a non-zero exit too, and sends both with the exit code in `provider-lifecycle-exit`. A half install or a partial logout still changes the disk, so the UI never guesses. Cancel and shutdown stop the whole pty session, not the leader alone.

### The context bar reads the last assistant message

Claude and Cursor put the turn's billing totals on the final `result`; the live context size is the last `assistant` message's usage. A turn with tool calls sends several, so the first one or the totals drift further as the turn goes on. `parseAnthropicEnvelopeLine` keeps the last one and attaches it to the result event.

### Partial output writes a text twice if the whole line is not dropped

With `--include-partial-messages` (Claude) a text arrives as `text_delta` events and again as the whole `assistant` line; Cursor's `--stream-partial-output` does the same with timestamped lines and an untimestamped one. `takeStreamedBlock` drops the whole block only when `ctx.streamedText` still holds it, so a CLI that changes the final text (trimming, another join) shows it twice. `ctx.streamedText` resets on `message_start` and `result`, never between a delta and its line.

`partial_output_args` adds the flag after the probe, so `turn_args` tests stay pure and a fake CLI lists it in its `--help`. `queueTurnEventInsert` merges stored deltas by agent and run and writes the held text before that agent's next event; a path that writes `turn_events` without it reorders text.

## Stopping processes

### The reap walks the tree, not only the group

A CLI's Bash tool runs each command as its own session leader (measured under a Goodboy turn), so signalling the CLI's group misses an agent's dev servers and watchers. `proc/reap.rs` also walks the tree and matches the `GOODBOY_SPAWN_ID` tag. A child that clears its environment escapes the tag and is covered by the tree only while its parent lives. Do not shrink the reap to `killpg`.

### macOS hides the tag of Apple-signed binaries

System Integrity Protection hides the environment of `sh`, `bash` and `sleep` from `ps -E` and `KERN_PROCARGS2`, so the tag finds only third-party programs (node, bun, vite, the CLIs), not those Apple binaries. They are covered by the tree and the group while the run lives, and the end-of-turn reap signals the leader's whole group, so a restricted child in the group dies there.

A restricted child that left the group (its own session) and whose parent is gone is found by nothing: a known limit, not a bug for a broader match. A reap test with `sleep` as the straggler fails on macOS, so the tests use the test executable as the child.

### A pid is checked again before every signal

A pid from an earlier read may now belong to a stranger. `reap.rs` compares the kernel start time and the tag right before each TERM and KILL; `kill(pid, 0)` is not that check. A zombie has no readable identity on macOS, so a zombie leader stays in the table and is never signalled.

### The reap waits with `WNOWAIT` first

The reap waits for the leader with `waitid(WNOWAIT)`, then calls `child.wait()`. `wait()` first frees the pid, the tree is lost and the leader can no longer be proven ours, so processes outlive the turn again.

### A quiet side job is not stuck

The Claude CLI answers once, at the end, so the idle cap watches the CPU of the whole tree as well as the pipes. Do not turn it back into a wall clock.

### The reap stops an agent's daemons too

A tagged daemon the agent started on purpose (a file watcher of the version control tool, an ssh control master) is stopped too and restarts on demand. That is intended.
