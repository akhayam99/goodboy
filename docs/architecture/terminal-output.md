# Terminal and script output

> **Read this when** you change how a terminal, a script run or a provider
> login keeps and replays what it printed, or how a script run is recorded.
> **Not for** how the process starts and stops ([processes.md](processes.md)).
> The other pages are listed in [architecture.md](../architecture.md).

A pty never loses what it printed. Rust keeps a ring per process, the window
keeps a tail per id, and a remount writes the snapshot and then only the bytes
past it.

## The ring in Rust

Each terminal and script run owns an `OutputRing` (`pty_ring.rs`): the last
262144 bytes and `total`, the count of every byte since the start.

1. The reader thread pushes each read into the ring first, then emits
   `terminal-output` or `script-output` with `offset`, the running offset of
   the chunk's first byte.
2. On exit the ring and exit code stay in the `exited` store for 10 minutes.
   The entry leaves the registry before `terminal-exit` or `script-exit` fires,
   so a snapshot read after the event carries the exit code.

`terminal_snapshot(sessionId)` and `workspace_script_snapshot(runId)` return
`{ data, offset, exitCode }`: the ring as base64, the offset of its first byte,
and the exit code (`null` while it runs). An unknown id returns an empty
snapshot at offset 0.

## The stream in the window

One factory owns the rules, `shared/lib/createOutputStream.ts`
(`createOutputStream({ outputEvent, exitEvent, idField, isStartRequired })`).
It installs one output and one exit listener per event kind, decodes chunks,
keeps a 256KB tail per id with its offset, hands chunks and the exit to that
id's subscribers, and exposes `listenAll`. The terminal bus, the provider
lifecycle buffer and the script events are three configurations of it, so a
fix to the tail, the offset or the replay lands once.

- **Terminals.** `features/terminal/outputBus.ts` is registered at boot
  (`reattachTerminalTabs`) and by every driver. `GenericTerminalPanel`
  subscribes, buffers, writes the snapshot, then only the bytes past its end;
  when the snapshot fails, the bus tail stands in. When WebGL addon setup
  fails, it keeps the normal renderer and disposes the addon.
- **Scripts.** The scripts slice does the same for every live run on boot
  (`registerScriptRunListeners` with `shouldReplay`). A script's transcript
  stays capped at 64KB.
- **Provider login and CLI update.** No Rust ring:
  `invokeProviderLifecycleRun` starts
  `features/providers/lifecycleOutputBuffer.ts` first (256KB per `runId`, same
  offset), and `InlineTerminal` replays it, so a remount during a login shows
  the device code once. An exited run's buffer drops when its terminal
  unmounts, and only the newest four exited runs are kept. `connectProvider`
  and `runLifecycle` read it through `listenLifecycleOutput` and
  `listenLifecycleExit`, so a login run costs two listeners.

## The script ledger

A script run leaves a row in `work_events`
([architecture.md](../architecture.md#who-writes-each-table)). `scripts.rs`
writes it at start, with the mount's branch in the payload, and stamps the end
and exit code before `script-exit` fires. A run stopped through
`workspace_script_cancel` is stamped 143, whatever the wait returned, so reloaded history reads it as
`cancelled`.

`listScriptLedger` reads the last run of each script per mount; no screen reads
it yet. Given those rows, `buildSessionScripts` gives every group `available`,
each saved and discovered script with its last run, pinned or not.
`workOutcomeOf` is the one outcome rule: `ok`, `error`, `cancelled` for an exit
of 130, 137 or 143, or `unfinished` when the end never landed (a quit). The
Activity page reads `listWorkEvents` through the `work-events` slice and words
each row with it.
