# Turns

> **Read this when** changing what happens between a sent message and its
> recorded outcome: where a turn runs, which provider and model it runs on,
> how the CLI is spawned and read, what a turn event means, how a failure
> falls back, the session summarizer that follows, or a read-only workspace
> chat turn. **Not for** installing or
> connecting a provider CLI ([providers.md](providers.md)), how a workflow run
> advances ([workflows.md](workflows.md)), or mount lifecycle
> ([mounts.md](mounts.md)).

Owns the turn pipeline. The frontend drives it from
`apps/desktop/src/store/slices/turn/sendTurn.ts`, reads the stream in
`apps/desktop/src/features/chat/turn.ts`, and the Rust shell spawns the CLI in
`apps/desktop/src-tauri/src/turn.rs`. Per-provider stream parsers live in
`packages/core/src/providers/`.

## How sendTurn is laid out

`sendTurn.ts` holds `run`, which owns the cleanup that must happen whatever the
turn does, and `runOnce`, which calls one file per phase in the slice
(`apps/desktop/src/store/slices/turn/`). Each phase returns what the next ones
read; a phase that can end the turn early (blocked over budget, lease denied,
cancelled before the spawn) returns `turnDone` with the result, the others
return `turnReady` with their values. Side effects run in the order below.

1. `prepareTurn`: the mount and working directory, the agent, the slash skill,
   the attachments and the workflow step the agent belongs to.
2. `routeTurn`: provider, model, effort and credential, the over-budget gate and
   the disconnected-provider gate.
3. `leaseTurnWriter`: the captured-mount check and the resolver's worktree
   writer lease.
4. `startTurnRun`: run id, user message, provider run row, the cancel-before-spawn
   claim (`claimTurnStart`), the agent row moving to `running`, session state.
5. `buildTurnPrompt`: permission flags, context preamble, handoff layers, the
   context-window warning.
6. `buildTurnSpawn`: the resolve attempt, the guards, the system prompt, the
   writable roots, the file-version capture, the handoff record, the span base.
7. `readTurnStream`: one loop over the CLI events.
8. `finalizeTurnStream`: span, run status, workflow completion, context refresh.
9. `recoverTurnFailure`: failure class, cooldown, fallback rerun, usage-limit
   retry, error state.
10. `closeTurnCapture` (always) and `settleTurn`: assistant message, summary,
    artifacts, nudges, drift, resolve phase, then the stored error is thrown.

The phases share one `TurnProgress` object: the stream phase appends to it, and
the finalize, recover and settle phases read it. It is a shared object, not a
return value, because the failure path must see the text streamed before the
throw. `run` releases the writer lease and drains the resolve queue, opens the
mount continuation and drains the agent queue after `runOnce` returns or
throws.

The provider run row is closed on these paths only: `succeeded` when the stream
and its finalize step complete (`failed` with "cancelled by user" when a stop
landed), `cancelled` when a stop lands before the spawn (`claimTurnStart`),
`failed` when the step's agent cannot be resolved, and `failed` on any throw
inside the stream or finalize step, including the run a fallback rerun
replaces. A throw before the run row exists (the user message write) leaves no
run. A throw between the run row and the stream (the agent status write, the
session state write, the prompt and spawn phases) leaves the run `streaming`
and the agent `running`; nothing in the turn closes them. `store.sqlite-turn.test.ts` holds the closed paths on a real
database.

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

- An agent that ends a turn with a `<<handoff kind=... reason="...">>` marker
  shows a "Suggested next" card under that message (`HandoffChip`). Its
  routing picker starts on the target role's routing (`selectKindRouting`, the
  same `kindRouting` that `spawnAgent` uses) and can be changed before Start.
  Start, from the card or from the live nudge (`acceptSessionNudgeHandoff`),
  seeds the new agent's first turn with the reason and what the source agent
  wrote (`composeHandoffSeed`, `handoffSourceOutput`), passed as `seedPrompt`.
  `spawnAgent` sends a first turn only when the kickoff is not empty, so a
  started agent with no seed, plan or step prompt sits in Pending until you
  type. A seed fills the kickoff only when no `initialPrompt` or step prompt
  does, and unlike `initialPrompt` it does not stop an implementer from
  fanning a clustered plan out.
- A child of another agent counts as a fan-out child only by its shape
  (`fanOutChildKind`): an implementer under an implementer is a cluster part, a
  scout under a wireframe or report is an artifact scout, and a child of the
  same kind as a parent whose role can fan out is a scout tree node. Any other
  child, such as a planner started from a reviewer, settles on its own:
  `completeResolvedAgent` never hands it to `advanceClusterImplementation`
  (which marked it Blocked after its first turn), `sendTurn` adds no cluster
  boundary, and its first turn still names it. A follow-up of the same kind as
  its parent, for a role that fans out or for an implementer, looks the same
  as a fan-out child and is still treated as one.
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
  sent it, the ask in one line and the why. Closed, that is all it shows.
  Opening it (the header) shows a chip per section and **All**. A chip opens
  its section in a single panel below; the same chip closes it, and a second
  chip replaces the first rather than stacking. Closing the block hides the
  chips again. **All** shows every section together, including
  **View as sent**. It opens by itself only while the agent has not answered
  yet. Earlier steps open their agent, the plan is a title and Open plan
  (never its body), and **View as sent** shows the exact text in mono, in two
  parts for Claude and one for the others with a line that says why. When you
  wrote the first message yourself, your bubble stays and a one-line **Also
  received** strip sits above it.
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

## Surviving a reload or a restart

Rust owns every CLI process, so the webview can go away while a turn runs.

- **Every line has a sequence number and a backlog.** `turn_backlog.rs` keeps
  each run's envelopes (16 MiB per run, the newest 16 ended runs) and every
  `turn_event` carries its `seq`. `turn_attach(runId, afterSeq)` returns what
  came after a cursor and whether the run is still live; `turn_release` drops
  an ended backlog, which `runTurn` does when its stream closes.
- **The window that streams a turn owns it.** `runTurn` and `attachTurn`
  share one stream core (`features/chat/turn.ts`). After every event it hands
  on, it writes a cursor (`seq`, index inside that line, and the turn's owner:
  span fields, working directory, mount) to session storage
  (`features/chat/turnCursor.ts`). Session storage survives Cmd+R and nothing
  else, so a cursor means "this window was streaming this run before it
  reloaded".
- **Cmd+R re-attaches.** When a workspace loads, `reconcileLoadedAgent` keeps
  a running agent whose run has a cursor here (or a stream still open in this
  window) instead of cancelling it, and `reattachLiveTurn` asks Rust for what
  came after the cursor, skips the events it already stored, drops live lines
  it already replayed and stores the rest. When the run ends it settles the
  way `sendTurn` does: span, provider run, step completion, message, summary,
  artifacts, materialize requests and autorun. It does not plan a fallback,
  settle a scribe, rewriter or resolve attempt, capture file versions, or send
  drift and nudge notices. If Rust already evicted part of the output, a note
  says so; if the run is gone, the agent fails with a retryable error.
- **A clean exit marks what it cut.** On app exit, and in `restart_prepare`
  before the updater relaunches, Rust writes the live run ids to
  `restart.interrupted_runs` in the settings table and stops sending end and
  error envelopes, so a dying window never settles those runs as failed. The
  agents stay `running` in the database until the next load marks them
  `stopped_by = app`.
- **The next launch resumes them.** When a workspace loads,
  `resumeInterruptedAgents` resumes every `stopped_by = app` agent whose run
  the marker names and takes it off the marker. Taking is a compare-and-swap
  on the settings row (`replaceSettingIfUnchanged`), so when several windows
  or overlapping loads read the same marker, each run is claimed and resumed
  by exactly one of them. `planRestartResume` picks how:
  Claude and the opencode family resume their own session with a short
  "check before you run it again" prompt; Codex, Cursor and Antigravity get
  the same prompt plus the prior turns block; a turn cut before Claude opened
  a session is sent again as it was. A `decision_note` goes first ("Resumed
  after Goodboy restarted." or "updated."), and it names any tool call that
  had started and not ended. The turn goes through `sendTurn`, so budgets,
  limits and pins apply, and a resumed step completes like any other.
- **Anything else stays Stopped by restart.** An agent the marker does not
  name (a crash, a force quit) or one whose provider is disconnected shows
  "Stopped by restart" with **Resume**, which runs the same resume
  (`continueStoppedAgent`). Nothing restarts on its own after a crash.
  Past the agent itself, Next steps in the overview offers one **Resume all**
  for every agent the restart stopped in the session, and a workflow run
  shows the same action above its steps for its own agents
  (`WorkflowResumeStrip`). Both run `resumeStoppedAgents`, which resumes each
  `isStoppedByRestart` agent, never one you stopped and never a fan-out
  container (its children are resumed instead), skips an agent a second click
  is already resuming, and reports a failure only after trying the rest.

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

An agent whose job is an artifact (report, wireframe, plan) is never marked
completed by a turn that left no captured artifact. When the block fails to
parse, or a report or wireframe agent that owns no artifact yet ends its turn
without one, `completeResolvedAgent` sets the agent to `blocked` instead, and
a workflow step does not advance. A block that parses but fails to save sets
a completed report or wireframe agent back to `blocked` once the capture
error lands (`sendTurn`). A plan that fails to save keeps the step moving. A step that has not said it is done and
emitted no block keeps the usual continue path. The missing-block case also
emits `artifact_capture_failed` with code `missing`, so the transcript shows
the Retry capture card. A captured artifact of the expected kind counts as the
step output, so the repair turn completes the step without a step-done marker
(`apps/desktop/src/features/artifacts/turnArtifactOutcome.ts`). A blocked
report or wireframe agent that owns no artifact reads "No artifact" in amber
in the activity rows and the trail, instead of "Blocked" or "Needs you"
(`isAgentMissingArtifact`, row reason `noArtifact`).

Whatever the outcome, a turn that forked a mount hands off to one continuation
turn on the new mount once it ends.

After the context refresh, a turn on a git mount mirrors the session's
`git diff --numstat` against the same merge-base as the file-changes view into
the `files_touched_numstat` context slot. The slot is not a `SLOT_KEYS` entry: it is
desktop state that reaches the mobile client through the snapshot, next to the
paths-only `files_touched` slot the client falls back to. A git failure never
fails the turn.

## The session summarizer

After each successful turn the session summarizer condenses what happened into
the session's context slots, which the next turn reads as its preamble. It is
the chat's handoff, as the post-step summarizer is a workflow's
([workflows.md](workflows.md#the-post-step-summarizer)).

- One summarization runs per session. Turns that finish while it runs wait
  together and the next pass reads them all (the oldest drop out past 20,000
  characters, with a note saying how many). It runs when the app is idle.
- A consolidation pass waits behind them, at most one per session. It is
  queued when a run finishes, when a pull request merges (`pr_merged`), and
  when the active decisions go over their budget after a pass. It applies its
  operations like any pass and records `decisions_changed` with
  `consolidatedAfter` (`#612 merged`, `the run finished`, `decisions went over
budget`).
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

## The decisions ledger

Decisions live in a ledger (`session_decisions`, m197), not in the text of the
`decisions` slot. Every decision has a number per session (`D7`), a status
(`active`, `replaced` or `withdrawn`), who wrote it (an agent, the summarizer
or you), the agent and turn it came from, and the reason it left. The slot is
derived: the active decisions, newest first, one `- D7 text` line each,
rewritten after every change, so the preamble, the mobile companion and the
snapshot keep reading one string.

- `packages/core/src/context/decisions-ledger.ts` is pure:
  `applyDecisionOps` takes `add`, `reword`, `merge`, `replace`, `withdraw`
  and `restore`, and returns the ledger, the changes and the refused
  operations. `decisions-ledger-store.ts` loads, applies, saves and rewrites
  the slot.
- A decision nobody names stays as it is. Withdrawing or replacing needs a
  reason from the summarizer; an agent's withdrawal carries its reason as the
  marker body. Reword and merge keep the number; a merge keeps the lowest and
  marks the others `replaced` by it.
- Agents add with `<<ctx-decision>>`, replace with
  `<<ctx-decision replaces="D3">>` (optional `reason="..."`) and withdraw with
  `<<ctx-decision withdraw="D5">>why<</ctx-decision>>`. An addition that
  matches an active decision after normalizing (case, bullets, spaces) is a
  no-op.
- What you withdrew is a tomb: a marker with the same text does not bring it
  back. What you wrote or edited the summarizer can only replace with a
  reason, never reword, merge or withdraw.
- A session made before the ledger is seeded from its slot the first time the
  ledger is read, numbered in the slot's order.
- The summarizer never writes the `decisions` slot (an upsert of it is
  dropped). It answers `{ upserts, decisionOps }` and names decisions by
  number; an `add` without a `why` is dropped, because a line with no reason
  is state, not a decision. The `why` is kept on the row (`why`, m210) and
  shown under the decision in the context drawer; decisions from agents, from
  you and from before m210 have none. Operations that do not parse fail the answer, which
  is asked again once. Its summary is three sections, `Learned`, `State`,
  `Next`; an old `Problem` section is dropped on the next pass.
- The desktop applies every write through `applySessionDecisionOps`
  (`store/slices/decisions/`), which records one `decisions_changed` event with
  `{ added, replaced, withdrawn, merged, restored, decisionChanges }`. A reword
  records no event. Writing the `decisions` slot from the editor or the mobile
  companion goes through `reconcileDecisionsText`: numbered lines keep their
  decision, a missing number is a withdrawal of yours, a new line an addition.
- The preamble shows the decisions with their numbers and teaches the two
  attributes. Over budget it keeps the top lines, which are the newest.
- A consolidation pass (`mode: 'consolidate'`) has no turn and keeps only
  `merge` and `withdraw`. `packages/core/src/summarizer/decisions-eval.test.ts`
  is the fixed eval: rewording, merge, contradiction, state dressed as a
  decision, an Italian marker, a list over budget.

## Composer

`ChatInput` is one shell: field, then a 32px action row, no divider between
them. Focus shows as a stronger border plus a soft shadow, never a full ring:
the ring the box carried at every focus wrapped the whole thing in a color
loud enough to compete with the transcript, and the same anti-pattern is
avoided on `SendControl`'s own buttons.

- The action row's left side is `ComposerPlusMenu` (`+`, `parts/`): the menu
  is where the prefix syntax (`$` script, `~` workflow, `@` agent) is learned,
  not the placeholder, and it also holds Attach files. It reads `CHAT_PREFIXES`
  so a new prefix group appears there on its own. Then `PermissionModePicker`,
  then an attachment count once files are staged (the attachment chips
  themselves sit above the field, not in this row).
- The right side is `RoutingPicker` (with a `budget` prop, `ProviderUsagePill`
  passed in rather than living beside it) then `SendControl` (`parts/`): the
  same `ArrowUp` glyph as `ConversationComposer`, stop while a turn runs with
  nothing to send, Queue/Send now once there is something to deliver while a
  turn runs.
- `ChatInput/index.tsx` only composes. Its state lives in `hooks/use*` (agent
  selection, draft, queue, send, suggestions), its sections in `parts/`, and
  its derived flags in `composerView.ts`. It stays one component so the draft
  and pending nudges survive a re-render.
- `composerPlaceholder` (`ChatInput/lib.ts`) replaces the old placeholder that
  advertised every prefix inline: a role's first turn gets its
  `firstMessagePrompt`, otherwise `Reply to {role}` idle or `Queue a message
for {role}` while a turn runs, `{role}` being the agent's own name over its
  kind label. No prefix syntax appears in it.
- Queued messages and the agent's own suggestion sit in a tray attached above
  the shell (`bg-muted`, rounded top corners) when either has something to
  show; a routing fallback or all-budgets-exceeded notice (`RoutingIndicator`)
  sits above that, since it is a warning rather than composer content.
- `resolveSkillPrompt` returns the content unresolved when
  `WORKSPACE_FEATURES.skills` is off, so a message starting with `/` sends as
  plain text instead of failing with "unknown skill" while skills are
  disabled.
- Sending: `Enter` in this composer, because it talks to an agent;
  `⌘Enter` is for a composer that talks to a person (a PR comment, a Linear
  or Slack reply). Both are already the rule elsewhere in the app
  (`ConversationComposer`), this just names it: an agent composer sends on
  Enter, a people composer on ⌘Enter.

A workflow agent's own handoff (`summarizeAgentOutput`) runs once per agent at
a time with a 90 second timeout, and a failure falls back to the deterministic
summary flagged `degraded`.

## Workspace chat turns

A workspace chat asks the provider a question without a session, an agent or a
worktree. It has its own pipeline next to the session turn:
`apps/desktop/src/store/slices/chats/` drives it,
`apps/desktop/src/features/workspace-chat/runChatTurn.ts` reads the stream,
and `apps/desktop/src-tauri/src/chat.rs` spawns the CLI.

- **Always read-only, Claude or Codex only.** `chat_turn` reuses the session
  turn's argument builder but pins the read-only shape. The frontend sends only
  the chat id, provider, model, effort and text: unknown fields are refused,
  model and effort must match `[A-Za-z0-9._:-]` with no leading dash, the
  provider must match the chat row, and the binary is the provider's own CLI
  name resolved on the Rust side.
  - Claude runs with `--restricted` (file tools confined to the chat folders,
    no user, project or local settings), `--setting-sources ""`,
    `--settings {"disableAllHooks":true}`, `--strict-mcp-config` with an
    empty `--mcp-config`, plan mode, only Read, Grep and Glob, no session
    persistence, and a deny list for secrets such as `~/.ssh`, `~/.aws`,
    `~/.config`, `~/.goodboy`, `~/.claude`, `~/.codex`, keychains and `.env`
    files. The question goes after `--`, so a question that looks like a flag
    stays text.
  - Codex runs with the read-only sandbox (`-s read-only`),
    `--ignore-user-config`, `--ignore-rules`, `--ephemeral` and
    `-c mcp_servers={}`. This is a known limit, kept on purpose: the sandbox
    lets Codex read any file your user can read, not only the project
    folders. It blocks writes and network access for every command Codex
    runs, so no command can change a file or send one anywhere. What Codex
    reads goes only to its own model, as in any Codex session. Only Claude is
    confined to the project folders; pick Claude for a chat that must not
    look outside them.
  - Cursor, Gemini, opencode, OpenRouter and Moonshot are refused with "Chat
    needs a provider that can run read-only: Claude or Codex". m212 keeps
    `chats.provider` to `anthropic` and `codex`, and `CHAT_PROVIDER_IDS` in
    `@goodboy/types` lists them for the model picker.
  - A check on the final argument list refuses any write flag before the
    prompt and any missing read-only flag. The Rust tests in `chat.rs` pin
    all of this.
- **Where it reads.** Rust reads the chat's connected projects from the
  database by chat id. The CLI runs in the first project (oldest first) and the
  other projects are extra read roots for Claude. It never widens to a shared
  parent folder, and never uses `/`, the home folder or a parent of it.
- **Its own channel.** Output streams as `chat_event` with the chat id, never
  as `turn_event`, so no session sees it. There is no reload backlog: a reply
  still streaming when the window closes is marked stopped at the next load,
  and a load whose pass fails leaves it to the next one.
  A reply is done only when the stream reports no failure and the CLI exits
  with 0. A failure event or another exit keeps the partial text and marks
  the reply failed, with the error under it.
- **What it carries.** Each turn sends the workspace system prompt and the
  last turns of the chat as text; Goodboy owns the conversation, not the CLI.
  The files a read tool opened are kept on the reply for the "Read N files"
  trace. Codex reads through shell commands, so for Codex the trace takes the
  file arguments of `cat`, `nl`, `head`, `tail`, `sed -n`, `rg` or `grep` with
  a file, and `ls` of a file (`chatReadPath.ts`).
- **Storage.** `chats`, `chat_messages` (m212) and `chat_session_links` (m214). A
  chat stores its model as a catalog key and, once the user sets one, an
  `effort` that the next turn uses instead of the effort the key implies.
  Every assistant message records the `provider`, `model` and `effort` that
  produced it (m214 backfills older answers with the chat's model), and
  `ChatSummary.modelsUsed` lists the distinct provider and model pairs of a
  chat's answers, oldest first. `chat_session_links` saves each Start work or
  Add to a session (`new` or `add`, the chat, the session and the message it
  started from). Deleting a chat deletes its messages and links, never its
  sessions; deleting a session deletes its links. Idle is derived: a chat with
  no activity for seven days moves to the idle group, and only the user
  archives it.
- **Activity in the top bar.** `chatStreams` says which chats are answering.
  `useChatActivity` turns it into a running count and an unread flag for the
  Chat button in the top bar: a pulsing info dot (the tone of the running
  pill) and "1 chat running" while any reply streams, otherwise a still
  warning dot (the tone of the bell badge) and "New reply" while any chat is
  unread. The dot is positioned absolutely on the icon corner, so it never
  shifts the label. Every chat row mirrors it with the same tones, on the
  row's left edge.
  A chat becomes unread when its reply ends, done or failed, while the chat
  studio is not showing that chat; a reply the user stopped never does.
  Opening the chat, or archiving it, clears the mark. `unreadChatIds` lives in
  the chats slice and is saved in `localStorage` (`chat-unread:v1`), so it
  survives a reload without a migration.
- **Turn into work.** "Start work" drafts a brief (title, goal, what we know,
  files, projects) with one `summarize_session` call through `runAuxOneShot`
  with no tools and no working folder (`summarizeChatForWork.ts`). **Drafted
  by** picks the model that writes it: a `RoutingPicker` pill limited to chat
  providers with no effort (`isEffortHidden`), defaulting to the chat's own
  model and remembered per workspace in the `chat.workDrafter.<workspaceId>`
  setting (`workDrafter.ts`); changing it drafts again and drops hand edits.
  The model must answer one JSON object; anything else, a failure or 45
  seconds without an answer falls back to a brief drafted from the last answer
  (`draftWorkBrief`). **Start session** creates the session with the title,
  the goal (the brief goal, then "What we know" and "Files" as short lists)
  and the picked projects, with no first agent and no kickoff prompt, records
  a `new` link and opens the session overview; the user decides there what to
  run. **Runs on** (a `RoutingPicker` field with effort, new session only) is
  set afterwards through `setSessionConfig` as the session's `providerOverride`,
  `modelOverride` and `effort`, and only when the user changed it. **Add to a
  session** sends no turn: it records an `add` link and puts the title and
  brief into the latest agent's composer draft (`landOnSession.ts`). The
  panel starts on the keyboard with cmd or ctrl plus Enter.
  The Project field is a searchable multiple `Listbox` (`ProjectField.tsx`)
  with removable chips and a "No project" state; it starts with the projects the
  answer named files in, or none, and hides in "Add to a session" mode. The first
  picked project is `createSession`'s `projectId`; the others go in
  `additionalProjectIds`. The Session
  field (`SessionField.tsx`) is a searchable `Listbox` too: Active sessions,
  then Recent (done) ones, each row with the title, its projects, its stage and
  its age.
- **Mock mode.** With `VITE_GOODBOY_MOCK=1` the slice runs on an in-memory
  backend with Harborline chats, a fake streaming responder and a canned
  brief for the consent and retry chats, so scenes can send, stop and turn a
  chat into work. `?scene=chat-room` takes `work=drawer|project|add|session`
  (opens the panel, then the popover or mode), `chat=<key>` (`retry` drafts two
  projects) and `activity=running|unread` for the top bar and the list.
