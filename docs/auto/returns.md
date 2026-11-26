# Briefs and returns

> **Read this when** you change what a child of a Lead reads (its brief), how
> it ends (done or a return), how Auto is woken and must decide each return,
> how its answer is cut on the way back, or a helper started for a child's
> question. **Not for** the words a returned child reads on screen
> ([stops.md](stops.md#a-child-that-returned)) or what a result holds
> ([results.md](results.md)).

## A child reads its brief, not the session

A new delegation carries `briefVersion: 2` (`AUTO_BRIEF_VERSION`) in
`request_json`. `launchChildren` hands it to the turn and `briefSlotsOf`
(`store/slices/turn`) cuts the shared context to the goal slot: no decisions,
open questions, files touched or session summary. Profile, role, rules, images,
role notes and inline artifact bodies stay. A delegation from before the upgrade
has no version, so its retries and answers keep the full slots. The Context
drawer says "Agents the Lead starts read only their brief".

The prompt asks for a self-contained task of about 1,500 characters (goal,
inputs, constraints, done when, report shape). The hard cap stays
`DELEGATE_TASK_CHARS` (8,000), and a revise is exempt.

A spec may carry `"decisions":["D27"]`. `resolveDelegateChild` reads the ledger
(`listSessionDecisions`) and `composeBriefDecisions` writes each active decision
in full (cut at `AUTO_BRIEF_DECISION_CHARS`) as a `**Decisions**` section before
the task. A replaced, withdrawn or unknown id is named as such and the child
still starts. A bare id in the task is never expanded. The ids live in
`request_json.decisions`, so a retry reads the ledger again.

## The child returns, never blocks

The kickoff's Return section (`returnContract` in `core/auto/kickoff.ts`) has a
child end done, or do what it can, write its report and end with
`<<step-done id=".." status="returned" needs="shell">>` plus one line saying
what it needs. `needs` is `shell`, `writer`, `role:<role>`, `decision` or
`user`. A reading role keeps its report in the reply, never in a plan file.

`parseChildClosing` reads it into `ChildClosing.returned`: the needs, and the
request (the first line after the closing, else the last line before it).

- The first closing line wins. Whitespace inside the id is ignored, so a wrapped
  id still closes. An unknown value or role reads `user`.
- The outcome stays `blocked` (no migration), the reason `needs_<kind>`
  (`needs_role` for any role, named to Auto by `renderDelegationResult`),
  `needs_user` for none. `result_json.returned` keeps the needs and request.
- An old `status="blocked"` closing is a return with no needs
  (`ChildClosing.isLegacyBlock`): it settles blocked before the report check, and
  shell text may refine it to `needs_shell`. A `status="returned"` with no needs
  fails as a lost report.
- A revise child that returns lands nothing, whole new version or not: the
  artifact keeps its version (`returnedRevise` in `finishAttempt.ts`).
- A return is not a question: a reply that returns drops its blocking question,
  so the attempt settles instead of pausing.

## Auto is woken at once

A return never waits for its batch. `joinReady` settles it and writes its own
`results` row (`return:<generation>:<delegation>`, `returnOf` in the payload) in
one transaction with the owner and generation guard; the batch row later leaves
it out. A pending results row moves a waiting tree to merging, so Auto hears it
while siblings run. Returns landing during Auto's turn reach it together next.

- A return for an old generation is dropped.
- A return while the tree is stopped, paused or finished stays pending and is
  delivered on resume; nothing reopens the tree.
- Stop copies every undecided return row into the new generation in the same
  transaction (`stopTree`), so the message that resumes the tree brings it back.

## Auto must decide

Every delivery opens with **WAITING FOR YOUR DECISION** (`waitingReturnsOf` in
`store/runtime/auto/returns/`, rendered by `buildDeliveryText`): each undecided
return with its request, needs and report. A return is decided by:

- a later delegation with `retryOf` (continue);
- one with `"replaces":"<delegation id>"` (another role,
  `request_json.replaces`), a propose block included unless you decline it;
- `{"action":"release","delegation":"..","reason":".."}`;
- a `close` ([blocks.md](blocks.md#close)).

`releaseDelegation` stores `request_json.released`, guarded by owner, the
current generation and an undecided `blocked` row of that generation or older.
The same release replayed by the same run (recovery after a crash) applies again
without a write. `isAutoReturnDecided` is the one check: the delivery, the turn
settle and the Done word read it.

A turn that leaves a delivered return undecided copies it again
(`undecided:<generation>:<row>:<delegation>`, `isRepeat`, kept out of the results
block) and counts as no progress, so three such turns block the tree.

Older rows: a return without `returnOf` sits inside its batch row, and
`returnIdsOfRow` reads its `blocked` results as returns; when that batch was
delivered earlier, `joinReady` writes the missing return row
(`hasUnheardReturn`). A blocked child with no `returned` is never delivered again
(`isLegacyBlock`).

## The way back is an excerpt

`parseChildClosing` keeps a child's answer whole up to
`STEP_OUTPUT_EXCERPT_CHARS` (4,000, the Runs excerpt budget; the same as
`DELEGATION_SUMMARY_CHARS`). Above it the Runs head and tail cut applies
(`excerptStepOutput` in `summarizer/step-output.ts`, no model call) with
"[middle dropped, the full text is in the step transcript]" between. The return,
its needs and request and the blocking question are read before the cut. The
summary is never the only copy: a returned child's report artifact is captured
as on a done.

### Report artifacts

A writer (implementer, tester, docs, ci-fixer) may attach a long report as a
`report` artifact (`finishedPlain` registers it); writing none is not a failure
(`artifactPersistence` `not_applicable`). A read-only role owes its artifact:

| Ending                           | `artifactPersistence` | Result                                                              |
| -------------------------------- | --------------------- | ------------------------------------------------------------------- |
| Report registered                | `ok`                  | Goes on                                                             |
| No artifact block                | `not_written`         | `report_missing` with a closing line, `no_closing_envelope` without |
| A block that could not be stored | `failed`              | `artifact_persistence_failed`                                       |

A return with `needs` owes its report too, else `report_missing`. An artifact
block beside a blocking question is not captured (`captureArtifactsFromTurn`)
unless the same turn returns, so a scout released with its answer that then
writes no report ends `report_missing`.

## Answering a child that cannot resume

The resume text (`composeAnswerKickoff`) is the question and the answer. Only
Claude resumes (`AUTO_RESUMING_PROVIDERS`, `isAutoProviderResuming`; Codex drops
the session id in `cli_args.rs`). For any other provider `kickoffTextOf` in
`launchChildren.ts` puts the stored first kickoff (`request_json.kickoff`) and
"Where you stopped" (the paused attempt's `result_json.tail`) before the
question. `answerQuestion` copies that tail into the new attempt's `resume`
baseline, so a replay, a restart and `recover` write the same text.

## Substeps

A child that needs a scout or an investigator adds `needs="scout"` or
`needs="investigator"` to its blocking question (`parseSubstepNeeds` in
`core/auto/substep.ts`; other values are dropped). It pauses as for any question,
and the question row, the digest and the resume baseline keep `needs`. Auto, in
its own turn, answers it or delegates a scout or investigator with
`"forQuestion":"<question id>"` (`DelegateChildSpec.forQuestion`, in the request
hash; a retry cannot carry it). No new verb, no new admission caller.

### Admitting a helper

`resolveDelegateChild` finds the paused delegation
(`getPausedAutoDelegationOfQuestion`), stores `request_json.parent`
(`delegationId`, `questionId`, `depth`) and gives the helper a kickoff without
the ask rule (`isSubstep`). `core/auto/substepAdmission.ts` and
`autoSubstepStatements` refuse:

- `not_paused`: the parent is not paused on that question. Only its latest
  attempt counts (an answered pause stays a `paused` row behind the resumed one),
  so lookup, snapshot and guard read the highest ordinal.
- `generation_changed`: the parent is of another generation, as after a user
  message.
- `role_mismatch`: not a scout or investigator.
- `depth_cap`: the parent is a substep (`AUTO_TREE_DEPTH` is 2).

No count of helpers refuses one.

### Running helpers

A paused parent holds no run slot. At most `AUTO_SUBSTEPS_PER_PARENT` (2)
helpers of one parent run at once, counted by live attempts, so a helper that
finished or asked a question frees its place before its batch joins. A third
waits in `accepted` as **Queued** and starts when one of the two ends (`queuedStartableOf`, shared by `launchChildren` and
`advancePhase`, so a held helper never keeps the tree in `delegating`). The guard
in `runSlotStatements` also checks the parent still waits on that question.

- A helper not started yet (queued or waiting for your OK) whose parent no
  longer waits on its question (answered, asked another, finished or stopped) is
  settled `stopped`, reason `parent_ended`, with a result for the Lead and its
  reservation released, in one transaction (`dropOrphanHelpers`).
- The answer to a parent is always admitted; the parent waits in `accepted` for
  the next slot. A paused parent never times out.
- Cost per ask: one delegation and two attempts from the tree's counters and
  budget, as the digest says (`substepNeedsLine`).

### Answering the parent

`answer` may name an `artifact` of this tree: `answerQuestion` stores its title,
version and text (cut at `AUTO_DELIVERY_ARTIFACT_CHARS`) as `report` in the
`resume` baseline, written as "Report handed over". An unknown one is
`artifact_unknown` and the parent stays paused. A failed helper is answered in
plain text. The same answer twice is one resume.

`stopTree` cancels the helpers (requests with `request_json.parent`) first and
waits for them. A restart keeps the parent paused and the helper running through
`recover`. Runs and Orchestrated runs have no substeps.
