# Live state at the tail

> **Read this when** you change the line that says what an operation is doing
> now: the tail, its adapters, clock and glyphs, the thinking line, or the
> `live_work` read behind the working phrase. **Not for** how durations are
> measured ([spans-and-estimates.md](spans-and-estimates.md)).

## The tail

The live state of an operation is said once, as the last line of the content
the user reads: `TailLine` in `features/live-state/`. It knows no operation:
it takes `TailFacts` (`state`, `phrase`, `startedAt`, `stepAgentId`,
`actions`) and draws the glyph, phrase, clock and actions. Each operation has
one adapter in `features/live-state/adapters/` that builds those facts from its
owner of truth, and a header word or rail row of the same host reads the same
adapter.

| Adapter         | Operation                           |
| --------------- | ----------------------------------- |
| `agentTurnLive` | a plain agent or chat turn          |
| `autoTreeLive`  | Auto's tree phase and its root turn |
| `autoChildLive` | a child Auto started                |

The run tails (`RunTail`, `OrchestratedTail`), `AutoChildEnd` and
`AutoDockLive` draw from the adapters. The agent chat keeps its own thinking
line (`ThinkingIndicator`), so `agentTurnLive` only feeds `autoChildLive` and
`autoTreeLive` outside the scenes. The terminal has no tail (its output is its
tail), and dependency setup has no adapter until its state exists.

## Rules the adapters hold

- **Phrase.** It comes from the last tool event, never model text or command
  text: "Running pnpm in payments-api", "Reading export.ts" (`workingPhraseOf`).
  It keeps up to two script words only for known script runners, skips setup
  steps across `&&`, `;` and line breaks, unwraps `sh -c`, skips option values
  such as `--filter payments-api`, and shows only the program name otherwise.
- **Clock.** It shows execution time, never time spent waiting on you. A run
  step tail names its step in `stepAgentId`, and `TailLine` reads the step's
  active time through `agentActiveClock` from the `WorkTimeContext` source,
  the function the step row reads, so the two agree. Without that source it
  draws no clock. `RunStepFrame` (`clockStepAgentId`) and the Auto rail rows
  (`DelegationClock`) read it the same way.
- A tail that waits for your answer draws no clock. A running turn counts from
  `startedAt`. Clocks use `formatDuration` ("42s", "2m 37s"), show nothing in
  the first second, and only `working`, `waiting` and `queued` tick.
- **Actions.** A state that waits for the user (`needsYou`, `paused`,
  `failed`, `stopped`) puts its one forward move first as a small secondary
  button; others are quiet text actions.
- **Glyphs.** One per state everywhere (`TailGlyph`): `working` and `queued`
  the running node, `waiting` an info ring, `needsYou` the warning question
  node, `paused`, `failed` and `stopped` their nodes, `idle` a gray dot.
- A finished turn draws no tail: its summary line says it.
- **Stop.** One word for the open agent: Stop. Only where the object is not the
  open agent does the scope stay: Stop step. An Auto child card keeps Stop in
  its menu. `stopping` is its own state (a ring, a clock that keeps counting):
  Stopping with a busy Stop, then Still stopping with Force stop.
- **Auto children.** A stopped child offers Continue, never Retry, through
  Auto. It reads Queued only before it starts. One waiting for your OK is
  `needsYou` with Confirm and Decline on its pane; one that asked a question is
  `needsYou` with no Stop; a failed turn reads Failed.

## The thinking line

The thinking line counts from the turn start and ends with the turn: its clock
reads `startedAt` of the running turn state, never the mount time. It never
shows after an `error`, `auth_required` or `cli_too_old` item, even when the
turn state was left `running` without a `done` (`isTurnThinking`).

## Live work read

`live_work` (`src-tauri/src/live_work.rs`) answers what each live run of a
session is doing: one row per run with the session, agent, mount, branch
(resolved against the mount's current place), quiet time and the last open
tool.

The tool comes from the turn's own stream. The sink feeds every stdout line to
a per-run tracker that assembles split JSON lines (at most 64 lines or 256 KiB)
and reads real tool lifecycle fields only: Claude `tool_use` and
`tool_result`, Cursor `tool_call` by `call_id`, Codex command, patch and
file-change items, Copilot `tool.execution_*` and OpenCode tool parts.

- A line that only mentions a tool does not count, and only a real tool frame
  wakes `work-changed`.
- The tracker never reads the backlog, so an evicted completion cannot leave a
  call open.
- A provider with no tool frames (Gemini through `agy`, an unknown binary) has
  `canSeeTools` false and its phrase says "Working", never "No tool call yet".
- The quiet sample is shared for half a second, and a session read builds rows
  for that session only.

`readLiveWork` calls it and `workOf` turns rows into `Work` (place and
phrase). `useWorkOf` keeps the latest read only, so a newer failure stays
visible. It re-reads on `work-changed` (`{ sessionId, mountId }`, at most one a
second per session, to every window) and polls every 5 seconds for the quiet
time. `agent-turn` stays while it has readers.

## Under the hood

- `adapters.test.ts` holds a test for each adapter rule.
- Scenes `c01-tail-*` show every state.
