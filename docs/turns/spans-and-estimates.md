# Turn spans and estimates

> **Read this when** you change how a turn's machine time, route and touched
> files are recorded, or how active time, estimates and time left are
> computed. **Not for** the tables themselves
> ([../architecture.md](../architecture.md)) or retention
> (`packages/db/CONVENTIONS.md`).

## Turn spans

Every provider run that reaches the CLI closes with one `agent_turn_spans` row,
keyed by its run id. `sendTurn` writes it through `recordTurnSpan` when the
stream ends and in the failure path before any fallback retry. The first write
wins, so a failure after a finished stream keeps the finished span.

| Field                          | Holds                                                                       |
| ------------------------------ | --------------------------------------------------------------------------- |
| `started_at`, `ended_at`       | Right before the CLI starts, and when its stream ends                       |
| `provider`, `model`, `effort`  | What the CLI was started with, after routing and clamping; `effort` null when no flag was passed |
| `cost_usd`                     | The sum of the run's telemetry, null when it recorded none                  |
| `end_reason`                   | `cancelled` (stopped), `failed` (thrown or no answer), `awaiting_user` (ends on a blocking question), else `succeeded` |
| `touched_mount_ids`            | The session mounts the turn changed, as a JSON array                        |

A span holds machine time only. Waiting on a question, a review or a retry
never falls inside one, so an agent's execution time is the sum of its spans.
`Agent.startedAt` to `lastFinishedAt` is wall clock and is not that number.

Spans outlive their session and agent (`ON DELETE SET NULL`), so duration
history stays with the workspace. A backfilled span from before spans existed
has `effort` null: its row shows the planned effort in faint, and it counts
only toward the tiers without effort.

After a span is written:

- `recordTurnPick` (`store/slices/turn/recordTurnPick/`) writes one
  `agent_turn_picks` row when the model has a known cause: `lead`,
  `fallback`, `pinned` or `best`. Impact reads it to say which turns were
  pinned.
- `recordTurnSpan` calls `refreshTurnSpans`, which reloads the session spans
  and workspace history only where a pane already loaded them.
- `listAgentTurnSpanRoutes` reads spans back as routes when a session opens,
  which is where the observed effort comes from after a reload.

### Touched mounts

`collectTouchedMounts` joins two signals:

1. Every `file_edit` path the CLI reported, mapped to the innermost mount that
   holds it.
2. Each writable mount's numstat (`worktreeChangedFiles`), read by
   `snapshotMountChanges` right before the CLI starts and at the end. A mount
   whose numstat moved counts, which catches shell edits.

The numstat signal is dropped when another agent of the session ran at the end
of the turn or closed a turn during it (`hasOtherSessionTurnSince`). Gemini
reports no `file_edit`, so it relies on numstat alone. A failure never fails
the turn; it falls back to the reported edits.

The activity feed shows these mounts on an agent row
(`useAgentTouchedWorktrees`, union over its spans) only when the session has
two or more mounts: a worktree icon and a count, the names in the tooltip.

### Turn file sets

`turn_file_sets` holds the files a turn wrote, one row per run and mount. Next
steps read it through `loadTurnFiles` (the `turn-files` slice).

1. `beginTurnFileSets` reads `worktree_snapshot` (head and the hash of every
   dirty file) of each writable mount right before the CLI starts.
2. `recordTurnFileSets` asks `worktree_turn_files` for the set when the turn
   ends, finished or failed, without holding the turn back.

The set is the files committed or edited since the snapshot, minus those only
the base branch changed (kept as `fromBase` so a row can say how many it hid),
plus any file whose hash moved while dirty. Counts come from the numstat
against the starting head. Nothing is recorded for a turn that ran beside
another agent (`isTurnShared`), and a failure is reported, never fatal.

## Measured time and estimates

`listSessionTurnSpans`, `listWorkspaceTurnSpans` and `listTurnSpans`
(`@goodboy/db`) read spans with the agent's parent and status. The
`durationEstimates` slice keeps `sessionTurnSpans` per session for live rows,
and `workspaceDurationHistory` per workspace (last 90 days) for the estimator,
with `everyWorkspace` built from the spans of every workspace.

### Active time

An agent's active time is the union of its own spans, its subagents' spans and
the turn running now. Parallel subagents count once, and a run's active time
is the union over its agents. `familyActiveTime`
(`features/workTreeModel/workTimeSource.ts`) computes it, and `agentActiveTime`
picks it for one agent. The row (`agentWorkTime`) and the run tail clock
(`agentActiveClock`) both read `agentActiveTime`.

### The estimate

`buildDurationHistory` (`@goodboy/core`) makes two units of sample: `steps`
(one per completed root agent, keyed by the role, provider, model and effort
of its last turn) and `turns` (one per `succeeded` span of any agent, chat
agents included). It adds one sample per finished orchestrated run.

`estimateDuration` takes a `unit`: `step` for a workflow step row, `turn` for
any other agent row. A running turn row measures only the turn running now. It
picks the first tier with enough samples:

| Tier                                                                | Minimum |
| ------------------------------------------------------------------- | ------- |
| Role, provider, model and effort                                    | 5       |
| Role, provider and model                                            | 5       |
| Same model and effort in every workspace (`modelAnyWorkspace`)      | 5       |
| Role and provider                                                   | 8       |
| Role alone                                                          | 8       |

- These minimums are the only gate.
- It keeps the newest 50, caps them at the 95th percentile, and returns a band
  of time and cost (`lowMs`, `midMs`, `highMs`). An unsized step gets the
  25th, 50th and 75th percentiles.
- A running row measures against the top of the band; a queued row shows the
  band.
- With no tier at its minimum, `estimateProgress` returns the closest tier
  (`have` of `need`) and the tooltip says "No estimate yet: 3 of 5 finished
  ...". A row never shows a number it cannot back.

### Labels

`workTime` (`features/workTreeModel/workTime.ts`) picks the label per phase:

- Queued: the band with `~`.
- Running: the time left (`timeLeftLabel`), or elapsed time with `Longer than
  usual` past the band, and `isMuchLonger` at twice its top.
- Waiting: elapsed time, frozen.
- Done: active time, with the same note when it ran past the band. A step row
  shows the note only while it runs.
- `headline` joins elapsed time and time left for the agent header and the
  Brief's Now.

`runTimeLeft` (`features/session/timeline/runTimeLeft.ts`) gives the workflow
detail header the running step's time left plus the usual time of each queued
step, or the orchestrated-run band minus what the run has done. It returns
nothing when a step left has no estimate or the running one is past its band.

`WorkTimeProvider` gives each panel one source and one 5 second clock
(`useNow`) that ticks only while something runs. Rows read it with
`useAgentWorkTime`; outside a provider a row shows no time column.

### Plans

- The workflow builder shows an estimate for every step a tier covers and a
  dash for the rest, and hides them all only when no step has one. An
  orchestrated run shows a band only from 5 finished orchestrated runs.
- The planner gives each drafted step a relative `size` (`small`, `medium`,
  `large`), never minutes: it has no history to judge time from, and an agent
  handed a deadline cuts scope.
- The size picks the band from the same samples: small the 10th to 50th
  percentile, medium the 25th to 75th, large the 50th to 90th.
- It is stored on the step (`steps.size`) so the run keeps the band the form
  showed, and no prompt carries it. A preset keeps no sizes.
