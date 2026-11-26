# Process monitor

> **Read this when** you change how the app reads listeners and processes on
> the machine, stops a process, or files a port into a layer. **Not for** how
> Goodboy tags and reaps its own spawns ([processes.md](processes.md)). The
> other pages are listed in [architecture.md](../architecture.md).

## The snapshot

`monitor/mod.rs` answers `monitor_snapshot` with
`{ listeners, processes, taken_at, platform_supported }` (the last one is
`isPlatformSupported` on the wire). An optional `ports` list narrows the
listener scan. Every tool call runs through `proc::probe::run` with a 2 second
deadline.

| Platform | One read of the machine                                                                                       |
| -------- | ------------------------------------------------------------------------------------------------------------- |
| macOS    | `lsof -nP -iTCP -sTCP:LISTEN -Fpn`, one `ps -axo`, one batched `lsof -a -d cwd -p` and one `ps -o pid=,args=` |
| Linux    | `/proc/net/tcp`, `tcp6` and the `/proc/<pid>/fd` socket inodes                                                |
| Windows  | nothing, and `platform_supported: false`                                                                      |

`processes` holds only the listener holders and every process in a process
group the ledger knows, so the page can tell a leftover from a stranger.

`args_masked` replaces with `***` the value of `--token=`, `--password=`,
`--secret=`, a bare flag followed by its value, and any `KEY=value` whose key
contains TOKEN, SECRET, PASSWORD or KEY. It is never logged.

`monitor_watched_ports(project_root)` reads the ports a project declares and
keeps nothing else from those files: package.json scripts, `PORT` and `*_PORT`
integers in `.env`, `.env.local`, `.env.development`, `server.port` in the vite
config, and published compose ports.

## Stopping a process

`monitor_stop(pid, force)` (`monitor/stop.rs`) answers
`{ outcome: "stopped" | "still-running" | "refused", reason }`.

1. It refuses pid 1, this app, the processes that started it, a pid whose uid
   is not the app's and a pid missing from a fresh snapshot.
2. It sends SIGTERM (SIGKILL with `force`) and polls for up to 3 seconds; a
   zombie counts as gone. On Windows the same refusals sit in front of
   `TerminateProcess`.

The Goodboy rows never call it first. `stopGoodboyRow` routes to the script
cancel, the terminal close or the turn cancel, and falls back to
`monitor_stop` only when the app owns nothing for that process.

## The port join

`attributePorts` (`packages/core/src/monitoring`) joins the snapshot, the
ledger, the sessions' worktrees and the projects into one row per listener.
First match wins:

1. A Goodboy script, terminal or agent turn: the ledger row holding the pid,
   its parent or its group.
2. A session worktree, by the longest cwd prefix.
3. A project's main checkout.
4. Else an external process, by name.

- A watched port held by one worktree while another worktree of the same
  project runs carries `collision: { others }`.
- Each row carries the `source` that named its port (`script`, `env`, `vite`,
  `compose` or `learned`). Declared ports nobody holds come back as `free`
  rows.
- A port a Goodboy-owned process held joins the project's learned set
  (`monitor.learnedPorts.<id>`).

The pins are global settings, not per project: `monitor.pinnedPorts` holds the
user's pinned ports with an optional description, and `monitor.hiddenPorts`
the ports hidden from a layer. The first load folds the old
`monitor.watchedPorts.<id>` keys into the pins and deletes them.

`features/monitoring/splitPortRows.ts` files each port in one layer: Pinned,
Run by Goodboy, From workspace, then Listening on this Mac. The store slice
`store/slices/monitoring/` keeps the snapshot and applies a result only if its
`takenAt` is not older than the one held.
