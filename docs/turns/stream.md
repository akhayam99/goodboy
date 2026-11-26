# Reading the stream

> **Read this when** you change how CLI output becomes turn events: the
> parsers, when a turn ends, partial text, the store flush, what an event arm
> means, a tool call's state or the context size. **Not for** a window reload
> ([recovery.md](recovery.md)).

`createJsonLineAssembler` rejoins lines the CLI split, and one pure parser per
provider turns each line into `TurnEvent`s. A payload no parser models becomes
`unknown_payload` and is kept, never dropped.

## When a turn ends

- A usage-limit error ends the turn as a failure the moment it arrives.
- A CLI that exits without a single event fails with its non-JSON stdout and
  stderr, or with "exited without a response" when both are empty. So does one
  that produced events but no response and exited non-zero.
- A turn that ends with no assistant text and no error appends a
  non-retryable "exited without a response" error.

### A result ends the turn even when the process stays alive

Claude and Cursor print a `result` line (the `done` event) and normally exit.
When a tool moved to the background (a Bash that hit its timeout), Claude keeps
the process and the stream open. Without a watch the turn end is never
processed: no span, no message, no step completion.

A process can print more than one `done`, and a new turn can start up to 15
minutes after the first. `createTurnResultWatch`
(`features/chat/turnResultWatch.ts`) arms a timer on every `done`:

- **5 s** (`TURN_END_MS.grace`) when the turn closed its work (a step-done or
  cluster-done marker, or a blocking question), or no tool moved to the
  background.
- **12 min** (`TURN_END_MS.background`) when a tool moved to the background and
  the work is not closed. Claude wakes the agent with a new turn when the task
  ends (it stops a task after 10 minutes). Writing to the agent cuts the wait
  ([pipeline.md](pipeline.md#a-message-sent-after-a-result)).
- Any line that starts new work (`isTurnActivity`: anything but usage, done,
  unknown payload, stopped processes and notes) cancels the timer and starts a
  new segment.

When the timer fires, `turn_cancel` stops the process (the normal reap, so the
stopped processes are still listed) and the stream ends normally, or after
`TURN_END_MS.force` (2 s) without the end envelope. Other providers end by
exiting, so the timer only applies to `done`.

## Partial output

A turn of Claude or Cursor spawns with `--include-partial-messages` or
`--stream-partial-output` when `cli_probe::partial_output_args` finds the flag
in the CLI's `--help` (once per file, in `spawn_one`; side jobs keep their
argv). The workspace chat and Ask (`chat.rs` `spawn_chat_turn`) add it after
their read only argv is checked, just before the single `--`. Codex, an old
CLI, a failed probe and every other provider keep whole text blocks.

- The envelope parser (`anthropic-envelope-parser.ts`, `streamedText.ts`) turns
  each `text_delta` of a top level `stream_event` into one `assistant_text`
  marked `isPartial`. It drops the whole `assistant` line's text block that
  follows when it is contained in the streamed text.
- A block stays open until its own `content_block_start` or
  `content_block_stop`, or a top level `user`, `result` or `tool_call` payload.
  Any other payload between two deltas never opens a paragraph, so a word or a
  marker split across deltas stays whole (`BLOCK_BOUNDARY_PAYLOAD_TYPES`).
- Cursor deltas are the `assistant` lines with a `timestamp_ms`; the whole line
  without one is dropped the same way.
- Usage, tools and the result stay on the whole lines.
- `queueTurnEventInsert` holds `isPartial` deltas up to 250 ms per agent and
  run and stores one `assistant_text` row for them without the flag, before the
  next event of that agent. The store and the reveal still get every delta.

## Into the store

- **One listener per window.** `features/chat/createRunEventRouter.ts` holds
  the one `turn_event` listener and hands each envelope to its run's handler
  ([../event-bus.md](../event-bus.md) → Cross-window events).
- **The flush is coalesced and bounded.** `store/slices/transcripts/buffer.ts`
  writes `assistant_text` deltas at most once per window: 16 ms up to 1,000
  rows in the agent's transcript, widening linearly to 100 ms at 5,000 rows,
  because each write copies the agent's array. Other kinds flush at once. The
  budgets are in `store/slices/transcripts/streamBudgets.ts`
  ([../testing.md](../testing.md) → No stopwatch in the gate).
- **Opening an agent reads twice and merges by id.** `selectAgent` shows the
  last 50 stored events (`STREAM_BUDGETS.initialTranscriptRows`), then the whole
  history. Every event through `appendTurnEvent` carries the id of the
  `turn_events` row that stores it (`turnEventIds`), and `mergeTranscript`
  adds the live events whose id is not stored yet. A live event is never
  dropped or shown twice. `createLatestOnly` drops an older open's answer once
  a newer one started.

## Turn events

`TurnEvent` and `ProviderUsage` live in `@goodboy/types`, so the core parsers
and the desktop app share them without depending on each other. Arms with
behavior beyond rendering:

| Event                   | Behavior                                                                |
| ----------------------- | ----------------------------------------------------------------------- |
| `permission_request`    | Puts the run into `TurnState` `blocked` until a decision lands          |
| `permission_decision`   | Its `PermissionScope` decides retry; its `reason` keeps a denial's text |
| `user_text`             | Provider input; `deliveredBy: 'auto'` marks text the app built          |
| `operator_text`         | Display only: words a user typed to an Auto agent                       |
| `step_transition`       | A workflow run advancing, with the context it carried                   |
| `error`                 | `retryable` decides whether Retry shows                                 |
| `provider_session_init` | The provider's session id, which later turns resume from                |
| `unknown_payload`       | Output no parser models yet, counted per provider and payload type      |

### Permission asks

- An `allow` at session scope or wider offers a retry. A one-use approval does
  not, because it cannot carry into a new run.
- An ask is open (`openPermissionAsksOf`) while the turn is `blocked`, it has
  no decision, no `tool_call_end` came after it and no `user_text` followed.
  The denied tool's own `tool_call_end` comes before the ask, so order matters.

### Text the app built

- `user_text` with `deliveredBy: 'auto'` covers Auto's deliveries and a child's
  first brief (origin `delegation`). Resume, the preamble and retry still send
  it as written. Only the chat draws it as the collapsed `auto_delivery` row,
  which keeps its `runId`; the child result cards that run read sit under it
  (`AutoDeliveryResults`, see [../auto.md](../auto.md), The chat).
- `operator_text` is written when Auto takes the message. Nothing that resumes
  or counts turns reads it, and the question ordinals ignore it
  (`isOperatorEcho`). Its `attachments` are the images already written.
- `storedAttachments` on `sendTurn` are images written before the turn.
  `prepareTurn` uses them as they are, like a retry's `attachmentRefs`, and
  names each by its full path in the prompt.

### Errors

The failed turn notice also offers **Open transcript** (not inside that
agent's own drawer). `reduceTranscript` gives the error row `failedToolUseId`
(`failedToolUseIdOf`), and the drawer scrolls to the row that holds it
(`data-tool-use-ids`, `useRevealToolCall`), else opens at the end.

## Tool call states

A `tool_call` item carries `runId`, `startedAt` and `endedAt`
(`apps/desktop/src/features/chat/utils/transcript-items.ts`), taken from the
`at` of `tool_call_start` and `tool_call_end`, so a duration survives a
reload. `toolStatus` (`apps/desktop/src/features/chat/utils/toolStatus.ts`)
turns a tool call plus its context into one of six states, the alphabet of
`WorkNode` at its `sm` size:

| State      | When                                                                           |
| ---------- | ------------------------------------------------------------------------------ |
| `running`  | Started, not ended, and `activeRunId` matches or is not given                  |
| `done`     | Ended without error                                                            |
| `failed`   | Ended with `isError`                                                           |
| `approval` | A `permission_request` for the same `toolUseId` has no decision yet            |
| `stopped`  | Never ended, and its run is no longer active                                   |
| `denied`   | `permission_decision` was `deny`, ended or not                                 |

`permissionFor` scans the surrounding items for `approval`, because
`cluster-operations.ts` absorbs both permission events into the cluster of the
tool call they gate. `OperationsCluster` derives one aggregate state (approval
beats running beats stopped beats failed beats done). Its header rail appears
only for `approval` (`DESIGN.md` → "A row that needs you or went wrong carries
a tone rail").

## Context measurement

Usage events feed telemetry and the context meter. Codex reports token totals
for the whole turn, not what the context holds, so after each Codex usage event
`codexMeasuredUsage` reads the latest `last_token_usage` from the thread's
rollout file under `$CODEX_HOME/sessions` (default `~/.codex`). When it cannot
be read, the parsed usage stands.
