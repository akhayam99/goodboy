# Traps in Auto

> **Read this when** you change the Auto runtime, its admission, money,
> children, checks or publishes, or a screen that shows Auto. **Not for** how
> Auto works ([../auto.md](../auto.md)) or the role lists the compiler does
> not check ([store.md](store.md#hand-maintained-lists-the-compiler-does-not-check)).

## Auto gate and screens

Auto has one gate, and the legacy role grid never lists it. `AUTO_GATES.isDelegationEnabled` (compile time, read through `AutoReleaseContext` by `useIsAutoOn`) decides whether Auto exists and whether a start is Auto; there is no per person setting. Never read an old `agents.autoExperiment` row: a stored `false` must not hide Auto.

`visibleAgentKinds()` stays static; do not add `auto` to a role list to complete a menu. A role start test renders under `AutoReleaseContext` false (or `SessionDraftPane isAuto={false}`).

### The registry reads the gate, not React context

`when` sees facts, not context, so the registry reads `isAutoOn` from the settings and the compile gate. A scene or test that needs Move to Auto through the context drives `MoveToAutoPanel` or the feature function with `isReleased`.

### Auto's glyph and color are its own

The glyph is `CONCEPT_ICONS.auto` (`Orbit`): the AI glyph ratchet bans `Sparkles`. The token `agent-auto` is its own green-teal, not `primary`, so it stays put if the primary color changes.

### Delegation cards are placed by time

A card goes before the first user or handoff row at or after its batch's last settle. Never anchor it on a run id: the delegation row does not keep the run that created it.

### An Auto chat scene sets `lastViewedAt`

Every agent gets a `lastViewedAt` after its `lastFinishedAt`, or the chat marks it viewed on every render of the real store.

### An agent page's composer takes its own agent id

It never reads the session's `selectedAgentId`, which in an Auto session is often the root: the child would show the root's draft, queue and "running" state and send its message to Auto. `AgentDetailPane` gives `ChatView` the `agentId`, remounting the input per agent so a late failure dies with its page, and `ChatInput` threads it through `useAgentSelection`, `useTurnRouting` and `cleanupSentAttachments`. A new composer hook takes the id from there; `ChatInput/childComposer.test.tsx` pins it.

### A prompt line never calls a possible action impossible

"MOUNTS: none. No agent that changes files can start" made Auto never delegate: no refusal, no "Where should the Implementer work?" card, only prose. State the fact and the way forward (`NO_MOUNTS_LINE`, `describeMounts`), and test that the line has no "cannot".

## Plans and artifacts

### Approval is read through `effectiveApproval`

An artifact is approved only while `auto_artifacts.approved_revision` equals the live `session_artifacts.revision`. A hand edit or a restore writes the artifact row alone, so `approval_state` can say `approved` for a gone revision. Read `effectiveApproval` (`packages/core/src/auto/ledger.ts`), never the stored state.

### The approval of a plan tells Auto once

`approveAutoArtifact` writes only from `needs_approval` or another version's approval, and answers `already_approved` without a write otherwise, so `approveAutoPlan` sends nothing on a second press, surface or window. Never guard with a read before the write: two presses both pass it.

### The approval turn names the plan

`focusArtifactId` travels through `sendTurn`, the user turn port and the bridge into the outbox facts. Without it, two live artifacts make "Approved plan vN." ambiguous, Auto asks the user which one, and Build never starts.

### Only a plan waits on approval

A reviewer report is stored `needs_approval` too and never approved, so a reader of `approvalState` checks `kind === 'plan'` first (`isAutoPlanAwaitingApproval`). Auto writes no `plan_consumptions` and its agents have no run, so a plan with an `auto_artifacts` row belongs to its tree (`isPlanHeldByAuto`): never "Ready to implement", never Run plan. A child whose delegation settled, or whose tree rests or stopped, is not resumable: Auto retried it with a new agent (`isStoppedByRestart` takes the views).

## Admission, slots and money

### The admission rule is written twice on purpose

`autoAdmissionTreeStatement`, one guarded SQL statement, decides; `diagnoseAdmission` only names the refusal. A new limit goes into both, and `admit.sqlite.test.ts` checks the SQL alone so a stale snapshot cannot admit what the guard refuses.

### The resume is admitted twice too

`autoResumeTreeStatement` (phase, run, attempt limit and money in one guarded update) decides; `diagnoseResume` names the refusal. It accepts `deciding` and `delegating`, since one turn may answer questions after handing work over; `delegate` accepts `deciding` only.

### The first attempt's reservation is found by owner id

`auto_delegations.first_attempt_id` is minted at admission, before `startAttempt` creates the attempt row. Find the reservation by owner id, never by joining `auto_attempts`.

### No dollar ceiling per child

Never hold money for a child at admission or cap it in dollars: a hold refuses children and pauses the tree on unspent money, and a ceiling for an unknown cost bills for nothing. A child's money is its telemetry while it runs (`autoLiveUsdSql`), then its reconciled cost. `autoReservedUsdSql` skips `owner_kind = 'attempt'`, so old rows with an amount hold nothing.

### No count or clock stops a tree

Never add a fixed count of agents, runs, turns, delegate calls or refusals, or a clock, as a hard stop or a refusal of a hand over. The spend cap and the no progress streak guard it, and an invisible limit ends a useful tree with no way forward. `delegations_used`, `attempts_used` and `turns_used` are information only; `grants`, `refusals_used`, `turn_delegate_calls` and `last_refusal_key` are dead columns kept for old rows.

### Four running children is a start rule

It never refuses: a child past the free slots waits in `accepted`. Count running children with `readAutoRunSlots` (a live attempt on a `starting` or `running` delegation), in runtime and on screen, never by delegation state: an ended child stays `running` until its batch joins, so a batch would wait on its own queued member and the screen would show **Queued** forever. Start a waiting child only through `runSlotStatements`, the one guarded update that takes the slot.

### Auto money is REAL dollars

Compare `auto_*` money columns through `autoRemainingUsdSql` and `AUTO_USD_EPSILON`, never `===`.

## Turns and children

### A message to an Auto agent goes through the door

While the runtime runs, `spawnAgent` (first message) and `sendTurn` (later operator messages) call `currentAutoUserTurnPort`, which queues a `user` outbox row. The door exists only in the main window while delegation is on. Elsewhere the plain turn answers and an `<<auto>>` block in its reply is never applied: only `settleAutoTurn` applies one. Never send a root a turn with `origin: 'operator'` expecting the plain path; a delivery uses `origin: 'delegation'`.

### An operator message to a child is a continue

`routeAutoChildTurn` hands it to the main window, which admits a continue (`continueChild`). That runs outside Auto's turn, so `autoContinueTreeStatement` repeats the admission's open and money checks; a new check goes into both. A queued Auto message is known only by its prefix (`AUTO_MESSAGE_QUEUE_PREFIX` in the `queue:` delivery id); renaming either breaks `autoMessageCountOf`, the Lead's message count.

### A child is found by its delegation row

Use `isAutoChildAgent`, never a flag on the turn input: a reattached turn after a reload has no input, and the question and split gates still hold for it.

### An adopted source stays an ordinary agent

Move to Auto writes a delegation row with `adopted = 1`, so `isAutoChildAgent` is true, but the delegation lines, the Work rail and `autoTreeOfAgent` skip it. Its role is its kind's delegation role; a Generalist takes `implementer`, the only value the column allows, and the chat never shows it.

### A turn's Auto standing is read from the stored delegation

`routeTurn` (`resolveChildTurn`) reads the stored delegation, never `autoTreeViews`, which another window or a slow poll leaves stale. Pass the resolved `childTurn` on; a path that skips `routeTurn` starts a child with no role, route or `isAutoChild`. A new path that marks an agent running:

- goes through `claimTurnAdmission`, or an adoption from another window slips in between read and launch;
- spawns with `hasAdmission` and releases it once the spawn returns or fails (`releaseTurnAdmission`);
- on failure writes through `failOwnedRun` or `writeOwnedSessionState`, never by agent id alone, or an expired claim fails the next window's live run;
- stops agents only through `stopGhostAgent` or `stopGhostAgents`, never a status write, or it stops another window's unspawned claim.

Never decide a stop from `turn_list_live` alone: the statement keeps `NOT turn_is_live(provider_run_id)`, or a run spawned after the read is marked stopped while alive. Test databases get the function from `@goodboy/db/test-helpers` (`liveTestRuns`).

### An Auto child that fails to start says why

`launchChildren` settles it with `code: message` (`kickoff_failed: <the error>`, or `agent_not_created: <the error>`), never the bare code; the row and Auto's next message read that text, so keep `outcome.message` in a new refusal. A delegated `rewriter` always throws in `leaseTurnWriter` (it needs a `historyRewriters` copy binding), so admission refuses it.

### A publishing bridge act is declared `Access::Publish`

Push, open or merge a request, approve and decline are `Access::Publish` in their `VerbSpec` in `query_bridge/protocol.rs`, or an Auto child can call them. There is no second list; `query_bridge/auto_child.rs` names the 14 publishing verbs, so a new one fails until added there on purpose.

The refusal keys on the socket peer's pid and parent chain, never the run id in the request. Only `spawn_one` records turn pids (`spawn_turn`, with the turn's workspace and session): a spawn path that passes the bridge env without it makes every verb `caller_unknown`, and one that records a child as `HandStarted` opens the bridge to it. A `--workspace` or `--session` other than the turn's own is refused `scope_mismatch`.

## Writers, checks and publishes

### The online branch sha is recorded at launch only

`attemptToLaunch` writes it to `baseline_json.remote`. A launch path that skips it gets no watch, and an absent `result_json.verified.remote` reads "not watched", never "unchanged". A failed read stays `unknown`.

### A writer's changed files compare trees

They are the status snapshot diff plus the tree diff from start head to end head (`readCommittedFilesOf`). Compare trees, never commit ids, so a rewrite to the same tree lists nothing; a failed diff falls back to the status list, never "no change".

### A check verdict is green only on a clean, unmoved tree

`runAutoChecks` is green only when every ticked script exited 0 on a clean tree whose head did not move; `unknown`, `timed_out`, a dirty tree and a moved head read `not_checked`. A rerun refused for a moved head or dirty tree keeps the old verdict rather than swap a real result for one about newer code. It waits 30 minutes on the bridge (`longTimeoutMs`), not the 30 seconds of Stop and Retry. Scripts run in the main window's Scripts runner and stay in its list, and a new check path goes through `runAutoChecks` so the per worktree queue serializes it.

### A card that reads a new result field adds it to the signature

`loadAutoTrees` keeps old views when `sameAutoTreeViews` finds the same signature, which reads only the publish record, the checks run and the verified checks of `result_json`. A card reading another field adds it there, or the write lands and the card never redraws; that is how Force push once looked silent.

### A publish is written in two places that agree

`result_json.verified.publish` of the settled delegation and the same path in its last ended attempt's envelope are patched together by `publishAct`, in one transaction.

- A plain push waits for the settle: it is recorded `pushing` and sent only after `claimAutoAttemptPublishStatement` proves the tree is at that generation, not stopping, and owned by this window. A failure there stays `completed` with a `failed` record and never fails the delegation.
- A force push leases the online sha recorded at attempt start, never one read after the agent worked. A lost lease is retried only by reading origin again, keeping a new backup and asking a new confirm.
- `executePublish` reads the online sha back before any push, so a result pushed but not saved is never force pushed twice.
- The backup ref keeps the replaced online sha, made at the settle, not at the confirm.
