# Surviving a reload or a restart

> **Read this when** you change what happens to a running turn when a window
> reloads, another window loads, or the app quits, updates or crashes: the
> backlog, delivery ids, re-attach, resume and turn admission. **Not for** how
> Auto recovers its tree ([../auto.md](../auto.md)).

Rust owns every CLI process, so the webview can go away while a turn runs.

## The backlog

`turn_backlog.rs` keeps each run's envelopes (16 MiB per run, the newest 16
ended runs), and every `turn_event` carries its `seq`. `turn_attach(runId,
afterSeq)` returns what came after a cursor and whether the run is still live.
`turn_release` drops an ended backlog, which `runTurn` does when its stream
closes.

## One delivery starts one run

A spawn may carry a `deliveryId`. `turn_spawn` records it in
`turn_delivery.rs` and refuses a second run for the same id with
`delivery_duplicate`, naming the first run. A spawn that fails gives the id
back. `turn_delivery_lookup(deliveryId)` (`lookupDeliveryRun`) answers the run
and whether it is live, for the life of the app process: the newest 2048 are
remembered, and a live run is never forgotten.

- `sendTurn` mints `hand:<uuid>` for a turn the caller gave none, and for every
  fallback retry, which is a new attempt.
- A caller that sends the same message twice gives the same id. The queue
  sends `queue:<id>`.
- Auto sends its own ids. A queued message to Auto hands its `queue:<id>` to
  the Auto outbox as the join key (`user:<delivery id>`, unique per tree), so a
  resend after a crash writes no second echo.

### A second send of a known id

`sendTurn` first asks `turn_delivery_lookup` and keeps the ids it is sending in
this window, and answers `isAlreadySent` without a second user message. When
the backend still refuses with `delivery_duplicate` (another window won), the
transcript says "This message was already sent." and no fallback starts.

There is no outbox table for a hand-sent turn: a crash ends as "Stopped by
restart" with Continue.

### A queued row across a restart

The registry forgets every id at restart, so the saved `user_text` event
carries the `deliveryId` too, and `deliverQueuedTurn` asks
`countUserTextEvents` for it before it sends. If that check fails, the message
stays queued and the error shows.

- Just before `startTurnRun` writes the `user_text` (after a first start
  cancel check), the row saves `writtenTexts`, the count of its texts no start
  followed. If that save fails, the send stops and the row is held.
- The message counts as delivered only when more texts exist than that, so a
  text left by a cancel or a throw before the start never removes the row.
- The row leaves on `onStarted`, which `sendTurn` fires once after
  `turn_spawn` resolved (`onSpawned` on `runTurn`), across a fallback, and on
  `delivery_duplicate`, since that run has the message.
- A failed spawn fires nothing: the row stays Not delivered, and its
  transcript error offers no second Retry.

### Exits before the start

- Every exit before the start resets a `starting` or own `running` state
  (`releaseUnstartedTurn`).
- A throw in the prompt or spawn build also writes back the agent row, the
  provider run and the session and forgets the run id (`closeUnspawnedRun`),
  so Stop has nothing to chase and Retry keeps the handoff.
- A Stop during the build finds no process, so `sendTurn` checks
  `cancelledRunIds` right before the spawn and takes the cancelled path.
- A Stop during `turn_spawn` kills the process once it exists.
- Neither Stop fires `onStarted`.

### Turns started for Auto

A turn started for Auto passes `SendTurnInput.origin: 'delegation'` with the
planned `runId`, the `deliveryId` (the outbox row id of an Auto turn, the
attempt id of a child) and `onSettled`. `settleTurn` calls `onSettled` once
with the text, the failure or cancel flag and the files the turn touched.
`store/runtime/auto/startAutoTurn.ts` waits for the delivery to appear in
`turn_delivery_lookup` before it calls the turn accepted.

## A window reload re-attaches

`runTurn` and `attachTurn` share one stream core (`features/chat/turn.ts`).
After every event it hands on, it writes a cursor (`seq`, the index inside that
line, and the turn's owner: span fields, working directory, mount) to session
storage (`features/chat/turnCursor.ts`). Session storage survives only a window
reload (Cmd+Shift+R), so a cursor means "this window was streaming this run".

1. When a workspace loads, `reconcileLoadedAgent` keeps a running agent whose
   run has a cursor here (or a stream still open in this window).
2. `reattachLiveTurn` asks Rust for what came after the cursor, skips the
   events it already stored and stores the rest.
3. When the run ends it settles like `sendTurn`: span, provider run, step
   completion, message, summary, artifacts, materialize requests and autorun.

A re-attached run does not plan a fallback, settle a scribe, rewriter or
resolve attempt, capture file versions, or send drift and nudge notices. If
Rust already evicted part of the output, a note says so. If the run is gone,
the agent fails with a retryable error.

## A waiting permission survives a load

A permission ask arrives in the run's final result, so the run is over while
its agent row still says `running`.

- The boot sweep (`reconcileGhostAgents`) keeps every run with an undecided
  ask, in every workspace.
- On a workspace load, `reconcileLoadedAgent` reads the run's saved events
  (`findUndecidedPermissionAsk`). A `permission_request` with no
  `permission_decision` keeps the agent and puts a `blocked` turn state back,
  so Needs you and the ask card read as before.
- A decided ask, or one the load cannot read, stops the agent.

## Quit, update and relaunch

On app exit, and in `restart_prepare` before the updater relaunches, Rust
writes the live run ids to `restart.interrupted_runs` in the settings table and
stops sending end and error envelopes, so a dying window never settles those
runs as failed. The next load marks those agents `stopped_by = app`.

### The next launch resumes them

When a workspace loads, `resumeInterruptedAgents` resumes every
`stopped_by = app` agent the marker names and takes it off the marker with a
compare-and-swap (`replaceSettingIfUnchanged`), so each run is resumed by
exactly one window or load. `planRestartResume` picks how:

| Provider                        | Resume                                                      |
| ------------------------------- | ----------------------------------------------------------- |
| Claude, the opencode family     | Its own session, with a short "check before you run it again" prompt |
| Codex, Cursor, Gemini           | The same prompt plus the prior turns block                  |
| A turn cut before Claude opened a session | Sent again as it was                              |

A `decision_note` goes first ("Resumed after Goodboy restarted." or
"updated."), naming any tool call that had started and not ended. The turn goes
through `sendTurn`, so budgets, limits and pins apply.

### Anything else stays Stopped by restart

An agent the marker does not name (a crash, a force quit), or one whose
provider is disconnected, shows "Stopped by restart" with **Continue**, which
runs the same resume (`continueStoppedAgent`). Nothing restarts on its own
after a crash.

Next steps offers one **Continue all** per session, and a workflow run offers
**Continue** or **Continue all** on its run tail (`runTailOf`,
`orchestratedTailOf`). Both run `resumeStoppedAgents`, which resumes each
`isStoppedByRestart` agent (never one you stopped), resumes the children
instead of a fan-out container with an unfinished child, skips an agent a
second click is already resuming, and reports a failure only after trying the
rest.

### An Auto child never gets a plain turn

Continue on an agent Auto started goes through Auto (`autoRetryRouteOf`): it
sends Auto "Continue the Implementer that stopped (delegation <id>) from where
it left off: <task>", so the tree continues the same agent with `retryOf`.

- `resumeStoppedAgents` skips Auto children: the tree recovers its own work.
- The child is found from the tree view, or from its parent being the Auto
  root when the view has not loaded.
- A message you type on such a child goes from `sendTurn` to
  `routeAutoChildTurn`, which continues its delegation through Auto
  (`docs/auto.md`, Talking to a child) before any spawn.
- Only a child of a finished, stopped or detached tree keeps the plain
  confined turn.

## Turn admission

A turn marks its agent running before it spawns, with the prompt build in
between. Another window that loads in that gap sees a running agent with no
live run and no cursor of its own. The admission row keeps it from stopping
that agent.

### The claim

- `claimTurnAdmission` writes `turn_admissions` (agent, run, the app launch
  from `turn_launch_id`, the claim time) in the transaction that marks the
  agent running.
- `sendTurn` deletes it once `turn_spawn` resolved, or when the turn ends
  without a spawn. `revertAgentStart` deletes it with the claim it gives back.
- The claim refuses with `turn_running` while the agent runs on a pending or
  streaming run, which covers a held row. Two processes never run for one
  agent.

### Held, stopped or cleared

- **Held.** A row is held while the newer of `spawned_at` and `claimed_at` is
  younger than 120 s (`TURN_ADMISSION_HOLD_MS`) and it comes from this launch.
  `reconcileLoadedAgent` and the launch sweep (`stopGhostAgents`) leave its
  agent alone. The stop is one statement that also checks the run and the row,
  so a claim that lands between the read and the write wins.
- **Live check.** The stop statement also asks Rust, through the SQL function
  `turn_is_live` (`turn_live.rs`), whether the run is spawning or live, and
  leaves the agent running when it is. So a run that spawned after a window
  read `turn_list_live` is never marked stopped, adopted or claimed again. Only
  a run the same window cancelled skips the check.
- **Abandoned.** A row from an earlier launch is cleared at the next launch,
  and one older than the hold by whichever window reconciles next. When the
  launch cannot be read, the age alone decides.

### The spawn checks it

1. Right before `turn_spawn`, `readTurnStream` publishes `spawned_at` on the
   row (`publishTurnSpawn`), which renews the hold.
2. A spawn from a claimed turn carries `hasAdmission`. `turn_spawn` refuses it
   with `admission_lost` when the row is gone or names another run.
3. The check and the mark that makes the run read as spawning happen under the
   database lock, so a stop runs either before the check (the spawn is
   refused) or after it (`turn_is_live` keeps the agent).

The publish lives in TypeScript because `turn_admissions` belongs to
`packages/db` in the writer map. An adoption or a detach is refused with
`turn_running` while a held row stands.

### A refused spawn has lost the agent

`recoverTurnFailure` treats `admission_lost` as loss of ownership
(`settleLostAdmission`): it marks only its own run failed, gives the agent back
only while the row still names its run (`revertAgentStart`), writes no session
state while another run holds the agent, and never plans a fallback.

Every failure write that targets the agent or the session is conditioned on
the failing run (`runOwnership/failOwnedRun`,
`runOwnership/writeOwnedSessionState`). A window that wakes after its claim
expired never marks another window's live run failed.
