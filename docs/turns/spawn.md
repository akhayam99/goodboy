# Spawning the CLI

> **Read this when** you change how `turn_spawn` starts a CLI: secrets,
> environment, write scope, confined roles, how Stop is confirmed or what the
> end-of-turn cleanup reaches. **Not for** the per-provider flags
> ([../providers.md](../providers.md)).

`turn_spawn` builds the argument list per CLI. What holds for every spawn:

- **Secrets travel by environment, never argv.** A bound API key goes from the
  keychain into the one variable its provider expects. The workspace's GitHub
  connection becomes `GH_TOKEN` and `GITHUB_TOKEN`. The bridge variables follow
  [../query-bridge.md](../query-bridge.md).
- **The child is its own process, not a clean one.** It inherits the app's
  environment with the resolved PATH on top
  ([../architecture.md](../architecture.md#subprocess-environment)), minus the
  variables a parent Claude session would leak. It runs in its own process
  group, so cancelling a turn stops everything it started.
- **Write scope is explicit.** The writable mounts and their git common
  directories go to the CLIs that accept extra directories, plus the bridge
  socket directory only while the bridge serves. Claude loads only project and
  local settings, and MCP tools are always disallowed.
- **Blocking work stays off the async runtime.** `turn_spawn`, `chat_turn` and
  `ask_turn` run the probe, the keychain read and the spawn on the blocking
  pool.
- **stderr drains on its own thread.** A full stderr pipe would otherwise
  block stdout and hang the turn.
- **One envelope per line.** Each stdout line is a `turn_event`, capped per
  line, then one end envelope with the exit code and stderr. When the end of
  the turn stopped processes the CLI left running, a `reaped` envelope comes
  first ([../architecture.md](../architecture.md) → Processes Goodboy starts)
  and becomes a `processes_stopped` event.

## Confined roles

`turn_spawn` takes an optional `confinedRole`, enforced in Rust
(`providers/cli_args.rs`, `role_access`) whatever the session permission mode
says, so `bypassPermissions` never widens it. An agent started by hand sends
none. The Lead's children send their role, every turn of the Lead sends `auto`
(`confinedRoleOf.ts`), and **Answer without editing** sends `scout`.

`scout`, `planner`, `investigator`, `reviewer`, `auto` and any unknown role
are read-only:

| CLI             | Read-only shape                                                                                                                                                                                                                                                                                                      |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Claude          | `--tools Read,Grep,Glob` in plan mode (Auto, `confinedRole: 'auto'`, runs in `default` mode, or `bypassPermissions` in Full access: `effective_permission_mode`), `--allowedTools` with scoped `Read(...)` grants only (`is_scoped_read_grant`), a deny list with Bash, the edit tools and the native subagent tools |
| Codex           | `-s read-only`, no extra roots: no writes, read-only commands still run                                                                                                                                                                                                                                              |
| Cursor          | Loses its bypass flags, runs `--mode plan`                                                                                                                                                                                                                                                                           |
| Agy             | `--mode plan`                                                                                                                                                                                                                                                                                                        |
| Gemini, Copilot | Lose their bypass flags                                                                                                                                                                                                                                                                                              |
| opencode        | Refused before any probe (`ensure_confinement`): `opencode run` without `--dangerously-skip-permissions` is unproven                                                                                                                                                                                                 |

A read-only Claude role also gets `--add-dir` for the session's project folders
and each project's main checkout (`readRoots`, built by `buildTurnReadRoots`), so
reading inside your projects never asks. Isolated copies send none.

Auto has no Bash allow rule and never calls Goodboy from inside its turn; its
decision is the block it ends its reply with. For `implementer`, `tester` and
`docs` the session mode stays, and Claude loses `Task` and `Agent`.

Before the spawn, `providers/cli_probe.rs` reads the binary's `--version` and
`--help` once per file (resolved path, size and modification time, so an update
is read again). A CLI whose help does not list the flags the role depends on is
refused with `confinement_unproven`.

## Stop is confirmed

A user Stop goes through `cancelTurnConfirmed` (`store/slices/turn/`), which
answers `exited`, `still_running` or `failed`.

1. The turn goes idle only on `exited`, after the run left `turn_list_live`.
2. Only then is the agent marked `stopped` (`markStoppedBy`), so a fan-out
   parent never joins while a stopped child is still alive.
3. Until then the agent reads running and `drainAgentQueue` skips it
   (`stoppingAgents.ts`).

When the kill is refused and the process lives, or the live list cannot be
read, the turn and agent stay running with nothing marked stopped. The error
shows, the queue drains again when the turn ends, and Stop again retries. A
refused cancel for a run already gone counts as `exited`.

- `cancelCurrentTurn` with reason `user` or `leave` waits for the exit;
  `handoff`, `teardown` and `auto` go idle without waiting.
- A stop by Auto (`reason: 'auto'`) marks the agent stopped by `auto` whatever
  the cancel answers, before the queue drains, so its parked queue cannot
  reopen it.
- A stop by you or by Auto drops the agent's queued `auto-message:` items.
- Every user Stop is kept in `stopRequests.ts` until the exit is confirmed.
  `useAgentStop` (`shared/hooks/`) turns it into `stopping` at once and
  `stalled` after 5 s (**Still stopping** with **Force stop**, the same call
  again). A request for an earlier run never counts.

### Leaving everything

A workspace switch, a disconnect and the window close sheet call `stopWork`
with reason `leave` and scope `all`.

- It skips a `blocked` agent whose run already left `turn_list_live`: there is
  no process, and marking it stopped would kill an ask the next load can
  still show. A wait whose process is alive is stopped, and archiving a
  session (scope `session`) stops the ask too.
- `endedWaitingRunsOf` is the one read: a failed live list keeps nothing, so
  Stop never leaves a live agent.
- `stopPlanOf` is the one list of what a stop reaches (agents, runs without an
  agent, deciding runs, minus the kept asks). The close sheet's number
  (`liveWorkCountOf`) reads it and closes on zero.
- A deciding run that did not stop counts as still running.

Anything still running keeps the caller where it is, since leaving would drop
the state a later Stop needs: archive keeps the session, a disconnect keeps the
workspace and rejects, and a switch stays and says so
(`refuseWorkspaceSwitch`; Retry stops again).

## What the end-of-turn cleanup reaches

The reap signals the leader's process group, the tree below the leader and
every process that still carries the turn's tag. On macOS the environment of
Apple-signed binaries (`sh`, `bash`, `sleep`) is hidden, so the tag cannot find
them; the group and the tree still cover one in the CLI's group or below a
visible process. A restricted child that started its own session and lost its
parent is out of reach. Third-party programs (node, bun, vite) keep the tag
wherever they go.
