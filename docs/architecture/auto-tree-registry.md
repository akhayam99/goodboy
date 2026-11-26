# Auto tree registry

> **Read this when** you change the Auto tables, the scheduler that writes
> them, a transaction of the engine or how the runtime meets the app. **Not
> for** what Auto does for the user: its names, how it decides, what stops a
> tree, Blocked and Retry, what the screens read ([auto.md](../auto.md)). The
> other pages are listed in [architecture.md](../architecture.md).

The screens call the root Auto agent the Lead and its tree a run; the tables,
the role `auto` and the code keep the engine name ([auto.md](../auto.md#names)).
The runtime lives in `store/runtime/auto/`.

- `AUTO_GATES.isDelegationEnabled` in `packages/core/src/auto/limits.ts` is
  `true` and is the only gate. Auto has no setting, and an old
  `agents.autoExperiment` row is never read.
- Auto decides through the `<<auto>>` block, not through a bridge verb.
- Older orchestrated runs stay in `session_workflows` on their own engine; no
  migration moves a row between the two.

## The tables

m230 adds seven tables. `auto_trees` is one row per Auto agent: phase,
`phase_rev`, generation, stop state, the budget cap, the lifetime counters and
the scheduler lease (`scheduler_owner`, `owner_lease_expires_at`).
`auto_delegations`, `auto_attempts`, `auto_reservations`, `auto_outbox`,
`auto_artifacts` and `auto_artifact_versions` hang off it and go with it. The
partial index `idx_agents_auto_roots` on `agents(session_id, ordinal)` serves
`listAutoAgentsWithoutTree`.

- **m231** rebuilds `auto_trees`: the phase list gains `finished`, set only by
  the user, and `cap_usd` may be NULL for No cap.
- **m232** rebuilds `auto_delegations`: its role CHECK also takes `scribe`,
  `ci-fixer` and `rewriter`.
- **m243** adds `auto_trees.permissions` (JSON, `{}` follows the workspace
  default, one writer: `setAutoTreePermissionsIfUnchanged`, compare and swap),
  `auto_attempts.launch_snapshot` (written once, NULL shows no Went in line)
  and `auto_grants`.
- **m246** adds `auto_trees.guide`, the workflow a Lead follows:
  `ensureRunGuide` fills it once, `changeRunGuide` writes it only over the
  value it read, and a user message lifts a held check
  (`liftRunHoldStatement`), all in `store/runtime/runGuide/`.

Traps:

- **Rebuilds keep child rows.** m231 and m232 turn foreign keys off, copy,
  drop, rename, rebuild the indexes and run `foreign_key_check`. A plain
  `DROP TABLE auto_trees` would cascade through every child table.
- **One-way.** An older build refuses these files
  (`DatabaseFromNewerBuildError`, `packages/db/src/migrations/downgradeGuard.ts`)
  and offers the snapshot taken before the migration ran
  (`migrationSnapshotStorage` in `shared/lib/dbBoot.ts`).
- **Finished trees** are left out by `listAutoTreesToRecover` and
  `idx_auto_trees_live`.
- **Dead columns.** `refusals_used`, `turn_delegate_calls` and
  `last_refusal_key` stay from m230; nothing writes or reads them.

## Who may write a tree

- **One writer of tree state.** `scheduler.ts`, only while its window holds the
  lease, so a second window reads. Every transition names the phase revision,
  generation and phase it expects; a lost race is a typed answer.
- **Fenced results.** `settleAttempt` and `landRevision` apply a result only
  while the generation, the lease, the attempt and the delegation still match.
  Anything else is dropped and its reservation released. A failed or returned
  revise settles its attempt, delegation and artifact lock in the one
  `settleAttempt` transaction (`reviseFailureStatements`), so a crash never
  leaves the artifact revising.
- **Artifact revisions.** `writeArtifactRevision`
  (`packages/db/src/queries/artifactRevision.ts`) is the one way to make
  revision N+1: a compare and swap on the base revision and the history row.
  The plan hand edit and the Auto landing both call it.

## The transactions

- **Admission.** `admit.ts` takes a whole batch or nothing. The guarded
  statement in `packages/db/src/queries/auto-admission.ts` is the rule: phase,
  run, lease, remaining budget, plan approval and revision. A substep also
  needs its parent paused on that question in this generation with fewer than
  two helpers (`autoSubstepStatements`). `core/auto/admission.ts` only names
  the refusal for the caller. No count of agents refuses a batch:
  the cap of four running children is a start rule, and a child starts only
  through `autoTakeRunSlotStatement` ([auto.md](../auto.md) → What stops an
  Auto tree). Admission only asks that the limit has money left
  (`autoBudgetLeftSql`).
- **Money.** `treeSpend` is the one source: settled, live (what running
  children spent, from their telemetry), reserved and remaining. It feeds
  admission, the prompt line and the screen through `autoBudgetOf`; remaining
  is `autoRemainingUsdSql` in SQL and `autoTreeSpendOf` in JS, and the delivery
  line counts the turn reservation it is delivered with. An attempt keeps a
  reservation row at 0 USD and is reconciled to the actual cost, or to 0 with
  the cost marked unknown.
- **Move to Auto.** `adoptAgentStatements`
  (`packages/db/src/queries/auto-adoption.ts`) guards against a vanished
  source, a Run step, a running status, an existing delegation or tree, and a
  lineage that holds an Auto agent, then writes the Auto agent, the tree in
  `merging`, the delegation, its artifacts and the kickoff row. The source's
  unique key is the guard, because writers serialize. All or none survives a
  crash; `detachAdoptionStatements` is the inverse.
- **A decision.** `applyAutoBlock.ts` reads the block for a turn that ended ok
  on the current run of a `deciding` tree that is not stopping, and runs
  `delegate.ts`, `answerQuestion.ts` or `finishTree.ts`. A refusal or a block
  that does not parse becomes one `refusal` outbox row (join key
  `refusal:<run id>`) for the next delivery. `delegate.ts` rejects a role
  outside the closed list before any normalization
  (`core/auto/delegateSpec.ts`), resolves mount, model and kickoff per child
  (`resolveDelegateChild.ts`), and admits the batch in one transaction. Its
  snapshot reads the persisted session level and global approval switch for
  each handoff ([auto.md](../auto.md#how-auto-decides)). A writer must name its
  mount; a reader without one gets the primary mount, captured at admission.

Nothing runs for a person until they start an Auto agent, because no tree
exists before.

### Delivery to Auto

1. `deliver.ts` claims the pending rows in one transaction, stores the built
   text on the first row, reserves the turn ceiling and makes the tree
   `deciding` on a planned run id.
2. The turn starts with the first row id as its delivery id; Rust refuses a
   second run for a `deliveryId` ([turns.md](../turns.md) → Surviving a reload
   or a restart).
3. A second transaction accepts the rows.

A refused start gives back the rows, the reservation and the turn count and
blocks the tree with the reason; a claim that dies in between is found again by
the delivery id. The text (`buildDeliveryMessage.ts`) starts with a digest of
the tree (open agents with role, state and age, questions waiting, the budget)
and carries each result's artifact text, cut when long, because a provider may
not resume the session. When the turn ends, `settleAutoTurn.ts` picks the next
phase (delegating, waiting, merging, done or answering), puts the batch back on
failure, and counts a turn with no answer and no work, or whose block
was refused.

### A child's attempt

1. `launchChildren.ts` starts children only once the Auto turn is over, each
   with its preallocated agent row and the provider, model and effort Auto
   chose (`createAutoChild.ts`, `autoChildRoutingOf`), so its composer names
   that model, a
   baseline `worktree_snapshot` of its mount, and a turn with
   `origin: 'delegation'`, its `confinedRole`, the frozen mount target and its
   attempt id as delivery id.
2. `finishAttempt.ts` reads the closing line (`core/auto/closing.ts`: the
   `step-done` line of its own agent id, a return with its `needs` and
   request, a blocking question), registers the artifacts, attributes changed
   files by comparing snapshots, and settles with a `DelegationResultV1`. A
   revise turn captures nothing in the old slot: its new version is parsed
   (`core/auto/revisionParse.ts`) and lands through `landRevision`.
3. `join.ts` settles a batch only when every member ended, under a unique key,
   and `advancePhase.ts` moves the tree on. `createAutoRuntime.ts` runs this
   one tree at a time.

- **Questions.** A blocking question ends the attempt `paused` and queues a
  row for Auto. `answerQuestion.ts` resumes it in one transaction: a new
  attempt on the same agent with question and answer stored, checked against
  the money left, the attempt limit and the running slots
  (`core/auto/resumeAdmission.ts`), and it moves the delegation from `paused`
  to `starting`. The same question answered twice is one
  resume; a different text is refused. A child's question never reaches the
  session's open questions (`routeQuestions.ts`, read by
  `finalizeTurnStream.ts`), so the user never answers a hidden child.
- **No split.** The kickoff forbids `<<fan-out>>`, and a child's split is
  turned down with a note (`isFanOutRejected.ts`, read by
  `completeResolvedAgent.ts`), so every process of the tree
  has a delegation.
- **Retry.** A delegate entry with `retryOf` and a reason only
  (`prepareRetry.ts`): a new delegation on the same agent and mount, with the
  earlier attempt's model unless one is given; the settled result stays. A
  revise whose version already landed answers with that version.

### Stop

`stopTree.ts` writes the stop first: generation up, phase `stopping`, the old
generation's rows dropped. It cancels Auto's run and every live attempt with
the confirmed cancel, and only when every process is gone does it close the
attempts, settle the delegations as stopped, reconcile or release the
reservations and set `stopped`. A failed cancel leaves the tree `stopping`,
and a restart resumes it. A late result of the old generation is dropped by
the fences. A new user message reopens a stopped tree.

### Deadlines

`enforceDeadlines.ts` never cuts a working child on the clock (the idle rule is
in [auto.md](../auto.md) → What stops an Auto tree). Its cancel goes with
`by: 'auto'` and settles `timed_out` only after the exit is confirmed. A child
paused on a question still expires at `deadline_at` and needs no process to
expire.

`expireStaleDecide.ts` handles a tree still `deciding` `AUTO_STALE_DECIDE_MS`
(10 minutes) after it entered the phase with no live root run: it settles the
turn from a stored run outcome, or blocks the tree with
`AUTO_STALE_DECIDE_TEXT`, reconciles the turn reservation and puts the
delivered rows back as pending copies for Retry. A live run is never touched.

### Recovery after a restart

`recover.ts` follows the recovery table. Claimed rows are accepted when the
registry holds the run and given back when it does not. A turn or child whose
run is gone is closed from what it left (a child with no answer fails as
interrupted), a live run is watched until it ends, and a cut-short landing is
landed from the version stored on its attempt. The lease keeps two recovering
windows from both acting.

## Wiring into the app

`startAutoRuntime.ts` is the only place the pieces meet the app; `App.tsx`
starts it in the main window. With the gate off it only registers the screens'
ports. With the gate on (the shipped value) it builds the real ports
(`createRealAutoPorts.ts`), claims each tree it recovers, and drives every live
tree every fifteen seconds, which renews the lease, until teardown.
`makeAutoRuntime.ts` builds the same ports and runtime from a database and the
store getter.

- **Trees without one.** Each tick starts a tree for an Auto agent that has
  none (`startAutoTrees.ts`), capped at the session's budget, else the
  workspace's Runs Limit (`runDefaultLimitOf`), else no cap
  (`autoTreeCapUsd`).
- **The user-turn door.** `registerAutoUserTurnPort`: the first message of a
  new Auto agent (`spawnAgent`, `sendAutoKickoff.ts`) creates the tree on the
  spot with `startAutoTree`, the tick's function, so a race makes one tree,
  and queues the message as a `user` outbox row through `runtime.say`. Every
  later operator message to the root takes the same door from `sendTurn`
  (`routeAutoUserTurn.ts`).
- **The screens** get their ports, `confirmDelegation` and `stopTree`; Stop
  reports a tree that did not stop, and one another window runs.

## How the screens read a tree

Through one slice, `store/slices/auto-view/` ([auto.md](../auto.md) → What the
screens read): `loadAutoTrees` keeps only the latest answer and writes only on
a change (`sameAutoTreeViews`).

- `useAutoBoardWatch`, mounted in every window by
  `NeedsYouAnnouncementBridge`, polls every board session with a live Auto
  agent or a moving tree (`watchedAutoSessionsOf`), so Auto's waits reach the
  lane, the door and the away banner without opening the session. A resting
  tree (`AUTO_RESTING_PHASES`) is never polled, a `blocked` one only while an
  agent of its session is live.
- A read moves `autoClockAt` in 15 second steps while a child waits to start
  (`autoClockOf`), and `autoWaitRootsOf` reads it, so a child that never
  started counts as stuck on the board.
- `countLiveAutoTrees` counts the working trees for the Settings row.

## Tests

`store.sqlite-auto-manual-proof.test.ts` runs two runtimes from
`makeAutoRuntime.ts` on the real store for the stop, restart and crash proofs.
