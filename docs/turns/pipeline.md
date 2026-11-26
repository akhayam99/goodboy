# Turn lifecycle

> **Read this when** you change what happens around the phases of a turn: a
> message sent while the last turn still runs, which path closes the provider
> run row, or what runs after a turn succeeds. **Not for** the phase list
> ([../turns.md](../turns.md) → How sendTurn is laid out).

## A message sent after a result

The `done` event flips the agent to idle before the CLI exits, so a message
typed in that gap would start a second CLI on the same session. A message the
operator sends to an agent therefore first stops a process that lingers after
its result (`stopLingeringTurn`, through the run `lingeringTurns` registered),
then waits for that agent's previous turn to settle (`waitTurnSettledFor`, at
most 30 s).

Only `origin: 'operator'` does this. A turn sent from inside the agent's own
finalize (a question delegate, a workflow continue) would wait for itself.

## When the provider run row closes

| Path                                                                             | Run status                                       |
| -------------------------------------------------------------------------------- | ------------------------------------------------ |
| The stream and its finalize step complete                                        | `succeeded`                                      |
| The same, but a stop landed                                                      | `failed`, "cancelled by user"                    |
| A stop lands before the spawn (`claimTurnStart`)                                 | `cancelled`                                      |
| The step's agent cannot be resolved                                              | `failed`                                         |
| A throw inside the stream or finalize step, or the run a fallback rerun replaces | `failed`                                         |
| Turn admission refused (`claimTurnAdmission`)                                    | `failed`, with the `turnRefusalMessage` sentence |

A throw before the run row exists (the user message write) leaves no run. A
throw in the prompt or spawn build closes the run `failed` (`cancelled` when a
Stop was pending), reverts the agent row and writes the session state
(`closeUnspawnedRun`, [recovery.md](recovery.md#exits-before-the-start)). A
throw in the agent status or session state write inside `startTurnRun` frees a
claimed agent (`revertAgentStart`) but leaves the run `streaming`; nothing in
the turn closes it.

## After a turn succeeds

The run is marked succeeded, then in order:

1. A project the turn asked to mount is mounted.
2. A workflow agent completes its step (`completeResolvedAgent`, which may
   auto-advance the run).
3. Context slots and open questions are refreshed from the turn.
4. The assistant message is stored.
5. The session summarizer is queued ([context-updates.md](context-updates.md)).
6. Artifacts are captured; a failed capture emits `artifact_capture_failed`.
7. Nudges fire, and drift from the agent kind's role raises a notification.

Whatever the outcome, a turn that forked a mount hands off to one continuation
turn on the new mount once it ends.

After the context refresh, a turn on a git mount mirrors the session's
`git diff --numstat` (same merge-base as the file-changes view) into the
`files_touched_numstat` slot. It is not a `SLOT_KEYS` entry but desktop state
the mobile client gets through the snapshot, beside the paths-only
`files_touched` slot it falls back to. A git failure never fails the turn.

### An artifact agent needs its artifact

An agent whose job is an artifact (report, wireframe, plan) is never marked
completed by a turn that left no captured artifact.

- A block that fails to parse, or a report or wireframe agent with no artifact
  that ends its turn without one, is set to `blocked` by
  `completeResolvedAgent`, and a workflow step does not advance. This case also
  emits `artifact_capture_failed` with code `missing`, so the transcript shows
  the Rewrite card.
- A block that parses but fails to save sets a completed report or wireframe
  agent back to `blocked` once the capture error lands. A plan that fails to
  save keeps the step moving.
- A step that has not said it is done and emitted no block keeps the usual
  continue path.
- A captured artifact of the expected kind counts as the step output, so the
  repair turn completes the step without a step-done marker.
- A blocked report or wireframe agent with no artifact reads "No artifact" in
  amber in the activity rows and the trail (`isAgentMissingArtifact`, row
  reason `noArtifact`).

## Under the hood

- `store.send-after-result.test.ts` pins the stop and the wait.
- `store.sqlite-turn.test.ts` holds the closed run row paths on a real
  database.
- `apps/desktop/src/features/artifacts/turnArtifactOutcome.ts` decides when an
  artifact counts as the step output.
