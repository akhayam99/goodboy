# Turns

> **Read this when** changing what happens between a sent message and its
> recorded outcome: where a turn runs, which provider and model it runs on,
> how the CLI is spawned and read, what a turn event means, how a failure
> falls back, the session summarizer that follows, how the chat reveals,
> scrolls and composes, or a read-only workspace chat or session Ask turn.
> **Not for** installing or
> connecting a provider CLI ([providers.md](providers.md)), how a workflow run
> advances ([workflows.md](workflows.md)), or mount lifecycle
> ([mounts.md](mounts.md)).

A turn is one message to an agent and the CLI run that answers it. This page
owns the pipeline; the pages below hold each part. Three layers carry a turn:

- The frontend drives it from
  `apps/desktop/src/store/slices/turn/sendTurn.ts` and reads the stream in
  `apps/desktop/src/features/chat/turn.ts`.
- The Rust shell spawns the CLI in `apps/desktop/src-tauri/src/turn.rs` and
  owns the process, so a turn outlives a window reload.
- Per-provider stream parsers in `packages/core/src/providers/` turn each
  output line into a `TurnEvent`.

A workspace chat and a session Ask are separate, read-only pipelines beside
this one. They share the CLI argument builder but not the session, the agent
or the `turn_event` channel.

## How sendTurn is laid out

`sendTurn.ts` holds `run`, which owns the cleanup that must happen whatever
the turn does, and `runOnce`, which calls one file per phase in the slice
(`apps/desktop/src/store/slices/turn/`). Each phase returns what the next ones
read. A phase that can end the turn early (blocked over budget, lease denied,
cancelled before the spawn) returns `turnDone` with the result; the others
return `turnReady` with their values. Side effects run in this order:

1. `prepareTurn`: the mount and working directory, the agent, the attachments
   and the workflow step the agent belongs to.
2. `routeTurn`: provider, model, effort and credential, the over-budget gate
   and the disconnected-provider gate.
3. `leaseTurnWriter`: the captured-mount check, the resolver's worktree writer
   lease, the write set lease (the turns of an Auto tree, and every writing
   turn in a plain folder) and, for a plain folder, the before snapshot.
4. `startTurnRun`: run id (the one the before snapshot reserved), user
   message, provider run row, the cancel-before-spawn claim
   (`claimTurnStart`), the agent row moving to `running`, session state.
5. `buildTurnPrompt`: permission flags, context preamble, handoff layers, the
   context-window warning.
6. `buildTurnSpawn`: the resolve attempt, the guards, the system prompt, the
   writable roots, the file-version capture, the handoff record, the span
   base.
7. `readTurnStream`: one loop over the CLI events.
8. `finalizeTurnStream`: span, run status, workflow completion, context
   refresh.
9. `recoverTurnFailure`: failure class, cooldown, fallback rerun, usage-limit
   stop, error state.
10. `closeTurnCapture` (always) and `settleTurn`: assistant message, summary,
    artifacts, nudges, drift, resolve phase, then the stored error is thrown.

The phases share one `TurnProgress` object: the stream phase appends to it,
and the finalize, recover and settle phases read it. It is a shared object,
not a return value, because the failure path must see the text streamed before
the throw.

After `runOnce` returns or throws, `run` releases the writer lease, drains the
resolve queue, opens the mount continuation and drains the agent queue.

## Pages in this folder

| Page                                                           | Open it when you change                                                                                         |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| [turns/pipeline.md](turns/pipeline.md)                         | A message sent after a result, which path closes the provider run row, what runs after a turn succeeds          |
| [turns/routing-and-prompt.md](turns/routing-and-prompt.md)     | Which provider and model a turn runs on, the prior turns block, the system prompt and its guards, context slots |
| [turns/write-destination.md](turns/write-destination.md)       | Where a turn writes, the writer and write set leases, resolver candidates, saved versions in a plain folder     |
| [turns/handoffs.md](turns/handoffs.md)                         | An agent's first turn, the handoff record and block, the kickoff, fan-out children, resolver fix runs           |
| [turns/spawn.md](turns/spawn.md)                               | How `turn_spawn` starts a CLI, confined roles, how Stop is confirmed, the end-of-turn cleanup                   |
| [turns/stream.md](turns/stream.md)                             | Reading the stream, when a turn ends, partial output, turn events, tool call states, context measurement        |
| [turns/text-reveal.md](turns/text-reveal.md)                   | The pace live text is written in, its hosts, blocks that fade in when they land                                 |
| [turns/recovery.md](turns/recovery.md)                         | Reload, quit, update and crash: the backlog, delivery ids, re-attach, resume, turn admission                    |
| [turns/live-state.md](turns/live-state.md)                     | The tail line, its adapters, clock and glyphs, the thinking line, the `live_work` read                          |
| [turns/chat-view.md](turns/chat-view.md)                       | The reading order, the turn footer and usage card, chat scroll and row heights                                  |
| [turns/failure-and-fallback.md](turns/failure-and-fallback.md) | Failure classes, the fallback plan, the usage-limit stop, the helper retry chain                                |
| [turns/spans-and-estimates.md](turns/spans-and-estimates.md)   | Turn spans, touched mounts, turn file sets, active time, estimates and time left                                |
| [turns/context-updates.md](turns/context-updates.md)           | The session summarizer, the decisions ledger, the learnings pass                                                |
| [turns/composer.md](turns/composer.md)                         | The agent composer, Send, Queue and Stop, the durable send, One composer (`PromptField`) and attachments        |
| [turns/workspace-chat.md](turns/workspace-chat.md)             | A read-only workspace chat turn, its images, storage, default model and Start work from chat                    |
| [turns/session-ask.md](turns/session-ask.md)                   | A session Ask turn, its scope, staged files, pack and answer format                                             |

## Where a turn writes

The destination order, the leases a writer takes and the saved versions of a
plain folder are in [turns/write-destination.md](turns/write-destination.md).

## Surviving a reload or a restart

Rust owns every CLI process, so the webview can go away while a turn runs.
Re-attach, resume and Stopped by restart are in
[turns/recovery.md](turns/recovery.md).

### Turn admission

The `turn_admissions` row that keeps another window from stopping an agent
that has not spawned yet is in
[turns/recovery.md](turns/recovery.md#turn-admission).

## Turn events

What each `TurnEvent` arm means is in
[turns/stream.md](turns/stream.md#turn-events).

## Failure and fallback

Failure classes and fallback moves are in
[turns/failure-and-fallback.md](turns/failure-and-fallback.md).

### Helper retry chain

How background helper calls retry is in
[turns/failure-and-fallback.md](turns/failure-and-fallback.md#helper-retry-chain).

## Turn spans

The `agent_turn_spans` row every run closes with is in
[turns/spans-and-estimates.md](turns/spans-and-estimates.md#turn-spans).

## Measured time and estimates

Active time and estimates are in
[turns/spans-and-estimates.md](turns/spans-and-estimates.md#measured-time-and-estimates).

## The decisions ledger

The ledger behind the `decisions` slot is in
[turns/context-updates.md](turns/context-updates.md#the-decisions-ledger).

## Workspace chat turns

The read-only workspace chat pipeline is in
[turns/workspace-chat.md](turns/workspace-chat.md), and the session Ask that
reuses it is in [turns/session-ask.md](turns/session-ask.md).
