# Turns

> **Read this when** changing what happens between a sent message and its
> recorded outcome: where a turn runs, which provider and model it runs on,
> how the CLI is spawned and read, what a turn event means, how a failure
> falls back, or the session summarizer that follows. **Not for** installing or
> connecting a provider CLI ([providers.md](providers.md)), how a workflow run
> advances ([workflows.md](workflows.md)), or mount lifecycle
> ([mounts.md](mounts.md)).

Owns the turn pipeline. The frontend drives it from
`apps/desktop/src/store/slices/turn/sendTurn.ts`, reads the stream in
`apps/desktop/src/features/chat/turn.ts`, and the Rust shell spawns the CLI in
`apps/desktop/src-tauri/src/turn.rs`. Per-provider stream parsers live in
`packages/core/src/providers/`.

## Where a turn writes

- A turn writes into the mount it was aimed at, else the session's active
  mount, else the scratch folder ([mounts.md](mounts.md#where-a-session-writes)).
  The destination is resolved when the turn starts and recorded as the
  agent's write destination, so the place the user sees is the place the turn
  writes.
- A queued turn freezes the mount id, path and revision it was queued on. If
  the mount moved or changed revision before the turn starts, the turn refuses
  instead of writing somewhere else.
- A resolver turn takes the worktree writer lease before it spawns. A denied
  lease queues it as a resolve attempt rather than running two writers in one
  worktree. The lease is bound to the child process in Rust and released when
  that process exits.
- A resolver turn proposes only while another agent in the session is running.
  Its work is then parked as a candidate: committed to a candidate ref, the
  branch reset to where the turn started, and offered for acceptance on the
  queued comments it answers. A message the user types in the resolver chat,
  or any resolver turn once nothing else is running, applies: its commits stay
  on the branch. Work no queued comment covers is never parked.
- Recovery on load parks a leftover candidate only when its turn is not
  running, no later attempt started on that worktree, and a writer is still
  live or the resolver has not completed. Otherwise the candidate is dropped
  and the branch is left as it is.
- A turn in a folder project captures a recoverable file version before and
  after it runs.

## Which provider and model

The route is resolved once per turn, in this precedence: a fallback retry, a
model the user explicitly picked for this turn, the workflow node's routing,
the turn override, then the agent's own pin. `resolveProviderForTurn` then
applies budget caps and cooldowns. When every provider is over its cap the turn
does not start and says so; when budget moved it to another provider, the
transcript carries a notice. A turn that ran on anything other than the model
the user picked raises a warning notification naming both. A disconnected
provider with no bound API key stops the turn with a connect prompt instead of
spawning.

The route that actually ran is recorded per run in `runRouting`, keyed by agent
and run id, the moment the run id exists: provider, model and the effort flag
the CLI was started with (null when none was passed). `executedAgentRouting`
reads an agent's newest run from its turn telemetry and falls back to that live
record, so the agent's chip names the model that is running before any usage
lands. Telemetry has no effort, so the effort always comes from `runRouting`.
The live record is memory only and is evicted with the agent. Opening a session
seeds it back from the session's turn spans (`seedRunRoutingFromSpans`), and a
record a live turn already wrote wins.

## What the prompt carries

- The system prompt is the guards (write scope, session language, connected
  integrations, workspace profile) followed by the agent kind's own prompt.
  Claude receives it as an appended system prompt; every other CLI receives it
  at the top of the prompt, with the kind prompt fenced as a role boundary.
- A workflow step's first turn carries its predecessors' handoff summaries and
  the step prompt, and emits a `step_transition` event flagged `degraded` when
  the handoff it inherited was a fallback summary.
- The session's context slots are prepended, filtered by what the agent kind
  reads.
- A turn estimated at 85% or more of the model's context window raises a
  warning before it spawns.
- `renderHandoff` (`@goodboy/core`) owns that stacking: from the composed
  message out it adds the context slots, the child routing menu, the cluster
  boundary, the goal attachments, the prior turns and the verbosity line, then
  places the guards and the kind prompt per provider. The text it returns is
  byte for byte what the CLI received before it existed;
  `store.handoff-sent-text.test.ts` pins it for Claude and Codex.

## What each agent is handed

- An agent's first turn stores one `agent_handoffs` row (m185), written once
  and never updated: who sent it (`HandoffSender`), the ask in one line, the
  why, `doneWhen`, one-line sections (ask, goal, earlier steps, plan, files,
  threads, scope and rules, about you, role instructions) and the exact text
  sent (`sent_system` only for Claude, `sent_message` for every provider). It
  lives only in the local database and includes the workspace profile.
- A first turn is one with no run yet in `agentRunHistory`, an agent that never
  started, and no fallback retry. Its `user_text` event carries
  `handoffId`, the agent id, so the transcript can draw the handoff there.
- A composer that knows more than the message passes a `HandoffDraft` to
  `sendTurn`: the workflow step passes its instruction, goal and plan, a
  cluster child its cluster and the parent it came from, a scout tree child its
  area. Everything else comes from the agent row (`deriveHandoffSender`): a
  resolver is sent by Resolve, a question delegate by its question, a child of
  another agent by that agent or as its follow-up, a workflow step by the
  orchestrator on a dynamic run and by the workflow otherwise, and anything
  else by you. The visible `user_text` keeps the full composed text, because
  the prior turns block replays it for Codex, Cursor and Antigravity.
- The transcript draws that first message as one handoff block
  (`features/chat/components/HandoffBlock`), the same for every provider: who
  sent it, the ask in one line, the why, and a chip per section; a chip opens
  the block on its section. It opens by itself only while the agent has not
  answered yet. Earlier steps open their agent, the plan is a title and Open
  plan (never its body), and **View as sent** shows the exact text in mono, in
  two parts for Claude and one for the others with a line that says why. When
  you wrote the first message yourself, your bubble stays and a one-line
  **Also received** strip sits above it.
- On screen the block never says "handoff" (an internal word,
  `jargon-copy.test.ts`): its eyebrow is "sent by". An agent from before m185
  has no handoff row: its first message shows closed as "first message · older
  format", the original text clamped to 8 lines with Show all. No parser reads it. `reduceTranscript` makes the `handoff` item and
  `TranscriptRows` counts it as the first user turn.
- The transcript is the record and the Brief is the dashboard. What the agent
  received lives only in the handoff block; the Brief shows one line, "Sent by
  Orchestrator · step 4 · the ask", that switches to the Transcript tab with
  the block open (`requestHandoffOpen`). The Brief no longer carries Why this
  step or Expected output, and the old kickoff cards and their text parsers
  are gone.

Claude and the opencode family resume the provider's own session when the
agent's stored session belongs to the same provider. Cursor, Codex and
Antigravity instead receive a bounded block of prior turns. A mount
continuation never resumes, because it runs in another directory.

## Spawning the CLI

`turn_spawn` builds the argument list per CLI; the per-provider flags are
[providers.md](providers.md)'s. What holds for every spawn:

- **Secrets travel by environment, never argv.** A bound API key is read from
  the keychain into the one variable its provider expects; the workspace's
  GitHub connection becomes `GH_TOKEN` and `GITHUB_TOKEN`; the bridge variables
  are injected per [query-bridge.md](query-bridge.md).
- **The child is a clean process.** It takes PATH only
  ([architecture.md](architecture.md#subprocess-environment)), the variables a
  parent Claude session would leak are removed, and it runs in its own process
  group, so cancelling a turn stops everything it started.
- **Write scope is explicit.** The writable mounts and their git common
  directories are handed to the CLIs that accept extra directories, plus the
  bridge socket directory only while the bridge is serving. Claude loads only
  project and local settings, and MCP tools are always disallowed.
- **stderr drains on its own thread.** A CLI that fills the stderr pipe
  mid-stream would otherwise block stdout and hang the turn.
- Each stdout line is emitted as a `turn_event`, capped per line, followed by
  one end envelope carrying the exit code and stderr.

## Reading the stream

`createJsonLineAssembler` rejoins lines the CLI split, and one pure parser per
provider turns each line into `TurnEvent`s. A payload no parser models becomes
`unknown_payload` and is kept, never dropped.

- A usage-limit error ends the turn as a failure the moment it arrives.
- A CLI that exits without a single event fails with its non-JSON stdout and
  stderr, or with "exited without a response" when both are empty. One that
  produced events but no response and exited non-zero fails the same way.
- A turn that ends with no assistant text and no error appends a
  non-retryable "exited without a response" error.

## Turn events

`TurnEvent` and `ProviderUsage` live in `@goodboy/types`, so the core parsers
and the desktop app share them without depending on each other. Arms with
behavior beyond rendering:

- `permission_request` puts the run into `TurnState` `blocked` until a decision
  lands.
- `permission_decision` carries the chosen `PermissionScope`, which decides
  whether a retry is offered: an `allow` at session scope or wider is, a
  one-use approval is not, because it cannot carry into a new run.
- `step_transition` reports a workflow run advancing, with the context it
  carried forward.
- `error` carries `retryable`; only a retryable error offers Retry in the
  transcript.
- `provider_session_init` records the provider's own session id, which later
  turns resume from.
- `unknown_payload` keeps provider output the parsers do not model yet,
  counted per provider and payload type.

## Tool call states

A `tool_call` transcript item carries `runId`, `startedAt` and `endedAt`
(`apps/desktop/src/features/chat/utils/transcript-items.ts`), taken from the
`at` of `tool_call_start`/`tool_call_end` rather than the moment the row
mounts, so a duration survives a reload. `toolStatus`
(`apps/desktop/src/features/chat/utils/toolStatus.ts`) is the pure selector
that turns a tool call plus its context into one of six states, the same
alphabet the timeline's `WorkNode` uses at its `sm` size:

- `running`: started, not yet ended, and the caller vouches for its run
  (`activeRunId` matches, or is not given at all).
- `done`: ended without error.
- `failed`: ended with `isError`.
- `approval`: a `permission_request` for the same `toolUseId` has no
  `permission_decision` yet. `permissionFor` scans the surrounding items for
  this, since `cluster-operations.ts` now absorbs `permission_request` and
  `permission_decision` into the same operations cluster as the tool call
  they gate, instead of splitting the cluster around them.
- `stopped`: never ended, and the run it belongs to is no longer the active
  one (the turn ended, or a later run has started).
- `denied`: `permission_decision` was `deny`, whether or not the tool ever
  ended.

`OperationsCluster` derives one aggregate state the same way (approval beats
running beats stopped beats failed beats done) for its header glyph and
sentence; the rail on that header only appears for `approval`, because a
neutral row carries no rail (`DESIGN.md` → "A row that needs you or went
wrong carries a tone rail").

## Context measurement

Usage events feed telemetry and the context meter. Codex reports token totals
for the whole turn rather than what the context window holds, so after each
Codex usage event `codexMeasuredUsage` asks Rust for the thread's rollout file
under `$CODEX_HOME/sessions` (default `~/.codex`) and takes the latest
`last_token_usage` as the context size. When the rollout cannot be read, the
parsed usage stands.

## Turn footer

`usage` transcript items no longer cluster with operations
(`cluster-operations.ts`'s `ABSORBED_KINDS` dropped it): a `TurnFooter`
(`features/chat/components/TurnFooter/`) always renders on its own row,
right under the run's last assistant message. A `usage` item merges every
`usage` event for the same `runId` into one (`sumUsage` in
`transcript-items.ts`), because OpenCode reports several `step-finish`
events per run.

`useTurnFooter` reads its numbers from the store, not from the item: it
sums `sessionTelemetry[sessionId]` for the item's `runId` (input, output,
cached and cache-write tokens, context size, cost), and reads provider,
model and effort from `runRouting[agentId][runId]`, the same live routing
map `listAgentTurnSpanRoutes` seeds from persisted spans on reload
(`seedRunRoutingFromSpans`). Telemetry lags one store write behind the
`usage` event in the rare case a component reads it first, so the footer
falls back to the item's own `ProviderUsage` numbers (no provider or model
yet) until telemetry lands. A cost of exactly zero hides the cost entry
instead of showing `$0.00`, because zero usually means unknown, not free.

`turnFootersFor` (`utils/turnOutcome.ts`) derives, per run that produced a
`usage` item: `outcome` (`done`, `stopped` once a later run is active or
the turn ended with no `done`/`error` for it, `failed` once an `error`
lands for it) and `startedAt` (the earliest timestamp any item with that
`runId` carries: a `tool_call`'s `startedAt`, a permission event's `at`,
or the `usage` item's own `at` when nothing else timed the run). Duration
is `startedAt` to the `usage` item's `at`, so a text-only turn with no
tool call measures only from its own usage event onward. `ChatView`
computes this once per render and `TranscriptRows` resolves each `usage`
row's own `outcome`/`startedAt` before handing it to `TurnFooter`.

A `stopped` or `failed` footer shows the outcome's `WorkNode` glyph (the
same alphabet as the transcript's status column) and a token count when
one exists, never the full stats line. A `done` footer's leading glyph is
the provider's, not a lifecycle glyph, since done is the expected case;
clicking it (or `ⓘ`) opens `TurnFooterDetail`, an `AnchoredPopover` with
the itemized breakdown.

## Failure and fallback

`classifyProviderError` names the failure. A usage limit puts the provider on
cooldown until its reset. `planTurnFallback` then plans at most two fallback
attempts; an unclassified failure or a cancelled turn never falls back.

- The first attempt prefers the role's configured fallback, unless the failure
  is a usage limit on that same provider.
- A usage limit or an authentication failure moves to another provider at the
  same cost tier.
- An unreachable provider is retried once on the same model.
- A rate limit steps down a tier on the same provider.
- An unavailable model or an outdated CLI tries a sibling model on the same
  provider.
- Anything else moves to another provider. Candidates are connected, enabled
  for the session and not cooling down.

A fallback marks the failed run, posts the original error plus a notice naming
the move, and reruns the same input on the same mount target. A usage limit
with no fallback notifies, and when the provider names its reset time it
schedules one retry on the same model at that time. Any other failure leaves
the agent in `error` with a retryable error event.

## Turn spans

- Every provider run that reaches the CLI closes with one `agent_turn_spans` row, keyed by its run id. `sendTurn` writes it through `recordTurnSpan` on both exits: when the stream ends, and in the failure path before any fallback retry. The first write wins, so a failure after a finished stream keeps the finished span.
- A span holds machine time only: `started_at` is taken right before the CLI starts and `ended_at` when its stream ends. Waiting on an open question, a review or a retry never falls inside a span, so an agent's execution time is the sum of its spans. `Agent.startedAt` to `lastFinishedAt` is wall clock and is not that number.
- `provider`, `model` and `effort` are what the CLI was actually started with, after routing and clamping. `effort` is null when no effort flag was passed. `cost_usd` is the sum of the telemetry the run recorded, null when it recorded none.
- `end_reason` is `cancelled` for a stopped turn, `failed` for a thrown turn or one with no answer, `awaiting_user` when the answer ends on a blocking question, and `succeeded` otherwise.
- Spans outlive their session and agent (`ON DELETE SET NULL`) so duration history stays with the workspace.
- m184 rebuilt spans once for the succeeded runs from before spans existed, so estimates start from real history. It ties a run to its agent through the run's `done` turn event, or the agent's last `provider_run_id` when the events were pruned, and takes the provider run's own `created_at` to `finishedAt`, the machine time of that run. A backfilled span has `effort` null, because runs never stored the effort flag, so its row shows the planned effort in faint and it only counts toward the tiers without effort. The migration fills a helper table in one pass over `turn_events`, then inserts in 17 chunks by the last character of the run id, each committed on its own, and never overwrites a span the app recorded.
- `touched_mount_ids` lists the session mounts the turn changed, as a JSON array (null on spans from before it was recorded). `collectTouchedMounts` joins two signals. Every `file_edit` path the CLI reported maps to the innermost mount that holds it. On top of that, `snapshotMountChanges` reads each writable mount's numstat (`worktreeChangedFiles`) right before the CLI starts and again at the end, and a mount whose numstat moved counts too, which catches edits made through the shell. The numstat signal is dropped when another agent of the session was running at the end of the turn or closed a turn during it (`hasOtherSessionTurnSince`), because the change could be theirs. Gemini reports no `file_edit`, so its turns rely on the numstat signal alone. A failure never fails the turn; it falls back to the reported edits.
- The activity feed shows these mounts on an agent row (`useAgentTouchedWorktrees`, union over the agent's spans) only when the session has two or more mounts. The row shows the worktree icon and a count, never a name that the title would have to share space with; the tooltip and accessible name list the mounts. A mount that left the session drops out of the row.
- After a span is written, `recordTurnSpan` calls `refreshTurnSpans`, which reloads the session spans and the workspace history only where a pane already loaded them.
- `listAgentTurnSpanRoutes` reads a session's spans back as routes (run, agent, provider, model, effort) when the session opens. That is where the observed effort in the activity meta, the run tree and the agent header comes from after a reload.

## Measured time and estimates

- `listSessionTurnSpans`, `listWorkspaceTurnSpans` and `listTurnSpans` (every workspace) (`@goodboy/db`) read spans with the agent's parent and status. The `durationEstimates` store slice keeps them: `sessionTurnSpans` per session for live rows, `workspaceDurationHistory` per workspace for the estimator (last 90 days). Each workspace history also carries `everyWorkspace`, the same samples built from the spans of every workspace.
- An agent's active time is the union of its own spans, its subagents' spans and the turn running now (`agentTurnState` `running` since `startedAt`). Parallel subagents count once. A run's active time is the union over all its agents. `familyActiveTime` in `features/workTreeModel/workTimeSource.ts` computes it.
- `buildDurationHistory` (`@goodboy/core`) turns spans into two units of sample. `steps`: one per root agent whose status is `completed`, keyed by the role, provider, model and effort of its last turn. `turns`: one per `succeeded` span of any agent, chat agents included, since a chat agent never completes but closes turns. It adds one sample per finished orchestrated run.
- `estimateDuration` takes a `unit`: a workflow step row asks for `step`, any other agent row for `turn`, and a running turn row measures only the turn running now. It picks the first tier with enough samples: role, provider, model and effort (5), then without effort (5), then the same model and effort in every workspace (`modelAnyWorkspace`, 5, and the tooltip says `across your workspaces`), then role and provider (8), then role alone (8). These minimums are the only gate. It keeps the newest 50, caps them at the 95th percentile, and returns a band of time and cost (`lowMs`, `midMs`, `highMs`). An unsized step gets the 25th, 50th and 75th percentiles. A running row measures against the top of the band, so a typical run fills its arc without overflowing it; a queued row shows the band.
- `workTime` (`features/workTreeModel/workTime.ts`) picks the label per phase: a queued row shows the band with `~`, a running row the time left against the band (`timeLeftLabel`), its elapsed time past the band with the note `Longer than usual`, and `isMuchLonger` at twice the top of the band. A waiting row freezes its elapsed time; a done row shows its active time and the same note when it ran past the band. `headline` joins elapsed time and time left for the agent header and the Brief's Now.
- When no tier reaches its minimum, `estimateProgress` (`@goodboy/core`) returns the tier closest to it (`have` of `need`) and the tooltip says so ("No estimate yet: 3 of 5 finished ..."). The row never shows a number it cannot back.
- `runTimeLeft` (`features/session/timeline/runTimeLeft.ts`) gives the workflow detail header the time a run has left: the running step's time left plus the usual time of each queued step, or the orchestrated-run band minus what the run has done. It returns nothing when any step left has no estimate or the running one is past its band. The Start agent footer (`useLaunchEstimate`) shows the usual first turn only when the agent starts on its own, with instructions.
- `WorkTimeProvider` gives each panel (the activity feed, the workflow detail, the agent detail, a Brief's Subagents) one source and one 5 second clock (`useNow`), which ticks only while something runs. Rows read it with `useAgentWorkTime`; outside a provider a row shows no time column.
- The workflow builder shows an estimate for every step some tier can estimate and a dash for the others; it hides them all only when no step of the plan has one. An orchestrated run shows a band only from 5 finished orchestrated runs.
- The planner gives each drafted step a relative `size` (`small`, `medium` or `large`), never minutes: it has no history to judge time from, and an agent handed a deadline cuts scope. The size only picks the band from the same samples: small takes the 10th to 50th percentile, medium the 25th to 75th, large the 50th to 90th. It is stored on the step (`steps.size`, m172) so the running workflow keeps the band the form showed, and no prompt ever carries it. A preset keeps no sizes, because a size judges one plan, not every future goal.

## After a turn succeeds

The run is marked succeeded, then: a project the turn asked to mount is
mounted, a workflow agent completes its step (`completeResolvedAgent`, which
may auto-advance the run), context slots and open questions are refreshed from
the turn, the assistant message is stored, the session summarizer is queued,
artifacts are captured (a capture that fails emits `artifact_capture_failed`),
nudges fire, and drift from the agent kind's role raises a notification.

Whatever the outcome, a turn that forked a mount hands off to one continuation
turn on the new mount once it ends.

## The session summarizer

After each successful turn the session summarizer condenses what happened into
the session's context slots, which the next turn reads as its preamble. It is
the chat's handoff, as the post-step summarizer is a workflow's
([workflows.md](workflows.md#the-post-step-summarizer)).

- One summarization runs per session, and at most one waits: a newer turn
  replaces the waiting one. It runs when the app is idle.
- It runs on the summarizer task model, routed around cooldowns. When every
  candidate is cooling down it pauses and offers a retry.
- Slot writes are compare-and-set against the snapshot it read. A slot the
  user changed meanwhile is never overwritten; the summarizer runs again on
  the new value. A slot that comes back over twice its budget gets one more
  pass.
- An unparseable answer retries once. A usage, authentication or rate limit
  cools that provider and falls back to another task model. Anything else
  sets the error state and offers a retry. The turn itself never fails because
  its summary did.
- Its spend is recorded as summarizer telemetry, apart from turn spend.

A workflow agent's own handoff (`summarizeAgentOutput`) runs once per agent at
a time with a 90 second timeout, and a failure falls back to the deterministic
summary flagged `degraded`.
