# What each agent is handed

> **Read this when** you change an agent's first turn: the handoff record and
> block, the kickoff, "Suggested next", fan-out children or how a resolver run
> is fed. **Not for** the prompt layers every turn carries
> ([routing-and-prompt.md](routing-and-prompt.md)) or Auto's briefs
> ([../auto.md](../auto.md)).

## The first turn

A first turn is one with no turn run of its own in `agentRunHistory`, an agent
that never started, and no fallback retry (`hasOwnTurnRun`). The run that paid
for the orchestrator's decision (charged to the step's agent before it starts)
and the `orchestrator` and `pending` placeholders after a restart do not make a
turn a later one. Its `user_text` event carries `handoffId`, the agent id, so
the transcript can draw the handoff there.

### The handoff record

An agent's first turn stores one `agent_handoffs` row, written once and never
updated, only in the local database and with the workspace profile:

- Who sent it (`HandoffSender`), the ask in one line, the why and `doneWhen`.
- One-line sections: ask, instructions, goal, earlier steps, plan, files,
  threads, scope and rules, about you, role instructions.
- The exact text sent: `sent_system` only for Claude, `sent_message` for every
  provider.

### Who sent it

A composer that knows more than the message passes a `HandoffDraft` to
`sendTurn`: the workflow step its instruction, goal and plan, a cluster child
its cluster and parent, a scout tree child its area. Everything else comes from
the agent row (`deriveHandoffSender`):

- A resolver is sent by Resolve, a question delegate by its question.
- A child of another agent is sent by that agent, or as its follow-up.
- A workflow step is sent by the orchestrator on a dynamic run, else by the
  workflow.
- Anything else is sent by you.

The re-check, the scribe and the history rewrite pass their own sender
(`recheck`, `scribe`, `historyRewrite`) and never carry the session goal. The
stored `user_text` keeps the full composed text for provider replay; the
visible message uses the human ask, and attached plans stay in their own
section.

## The kickoff

`spawnAgent` sends a first turn only when the kickoff is not empty and
`shouldDeferKickoff` is unset (the push fixers set it and send the turn once
bound to their run). An agent with no seed, plan or step prompt sits in
Pending until you type.

- A seed fills the kickoff only when no `initialPrompt` or step prompt does.
  Unlike `initialPrompt`, it does not stop an implementer from fanning a
  clustered plan out.
- A plan the kickoff carries is marked used (`recordPlanConsumption`) only once
  that turn started or was lane queued, in `spawnAgent` and
  `activateWorkflowAgent` alike. A refused kickoff keeps the plan active and
  reports "The agent didn't start".
- Until then the plan reads starting (`planStarts`, held through
  `planStartLock`), and a second Run plan in this window is refused with "This
  plan is already starting".
- A fan-out still marks the plan before its children start.

### Suggested next

A turn that ends with a `<<handoff kind=... reason="...">>` marker shows a
"Suggested next" card under that message (`HandoffChip`). Its routing picker
starts on the target role's routing (`selectKindRouting`, the same
`scopedKindRouting` that `spawnAgent` uses). Start, from the card or from the
live nudge (`acceptSessionNudgeHandoff`), seeds the new agent's first turn
with the reason and the source agent's output (`composeHandoffSeed`,
`handoffSourceOutput`) as `seedPrompt`.

Inside a workflow run the marker is advice, not an action. A step agent that
emits `<<handoff ...>>` and `<<step-done ...>>` completes its step as usual, in
either order and with either marker split across deltas. It raises no live
nudge (`emitTurnNudges` skips an agent with a `stepId` and a
`workflowRunId`); the orchestrator reads the step output and decides.

### Fan-out children

A child counts as a fan-out child only by its shape (`fanOutChildKind`): an
implementer under an implementer (a cluster part), a scout under a wireframe or
report (an artifact scout), or a child of the same kind as a parent whose role
can fan out (a scout tree node).

Any other child, such as a planner started from a reviewer, settles on its
own: `completeResolvedAgent` never hands it to `advanceClusterImplementation`,
and `sendTurn` adds no cluster boundary. A follow-up of the same kind as its
parent, for a role that fans out or for an implementer, is still treated as a
fan-out child.

## Resolver turns

A resolver or re-check message has two parts: what the human wrote (the Ask)
and the rules Goodboy adds (the **Instructions** section, labelled "Added by
Goodboy"). `resolve_attempts.human_instructions` (nullable, no backfill) stores
the human part beside `instructions`, which keeps the full text.
`rulesOfKickoff` recovers the rules from the two, and falls back to the whole
message as the Ask when they do not line up.

A resolver works unattended in its own copy of the branch and never asks to
commit: the owner reviews, accepts and pushes. Each thread ends with
`comment-resolved`, `comment-wontfix` or
`<<needs-input id="..." options="a|b" recommended="a">>question<</needs-input>>`.

- `needs-input` is allowed only when a comment reads two ways that lead to
  different code. It carries two or three options and the recommended one.
- It lands on its thread as `needs_answer` and rides the open question rows
  (blocking, one choice), so Needs you handles it like any question.
- The workspace working rules never reach a resolver turn
  (`PROFILE_ACCESS.resolver` reads roles and topics only).

### One fix run per launch

Fixing N comments starts ONE resolver in ONE copy of the branch: 16 comments
are 1 agent. Each turn is bounded, the agent is not.

1. `startFixAttempt` splits the comments by file with `chunkConversations` (at
   most 12 per turn and half of the model's context window).
2. It starts the agent on the first chunk and holds the rest (`launchTurns`).
3. When a turn ends, `feedLaunchTurns` sends the next chunk to the same agent
   in the same copy.
4. It stops when the run failed, the owner stopped it or a turn was refused.

A comment in a chunk not yet fed reads Fixing (`heldLaunchIdOf`). Held chunks
live in memory, so a restart leaves the unfed comments Open.

`startFixAttempt` mints `resolve_attempts.launch_id` once per call, and
`startBatch` returns `batchId`, `launchId` and the single `agentId`. Every
later turn of that agent is another attempt row that inherits the launch, the
batch, the launch choice and the copy (`recordResolveAttempt` reads them from
the agent's latest attempt).

### Later turns of a fix run

- Answering a Needs you (`answerQuestions`), retrying what could not be fixed
  (`retryCouldntFix`), a hint on one comment (`continueResolveThreads`) and a
  typed message all send a turn to the same agent. Several answers make one
  turn.
- An answer counts as delivered only when its turn has started (`onStarted` on
  `sendTurn`). If the turn does not start, the error shows on the comment's
  card and the question stays open.
- `prepareTurn` hands any turn of a resolver with a batch the copy of its run
  (`resolverLaunchCopy`), so a typed message never lands on the live branch.
- The turn names the comments it claims (`resolveThreadIds`); others are not
  touched.
- The copy is kept while the agent waits or works and released when every
  comment of the run is settled (`keepsResolveCopy`).
- A new agent starts only with an explicit start over: `startBatch` again, or
  Retry after the owner picked another model.

A turn's commits are split into one candidate per fixed comment, each
cherry-picked on the same base (`worktree_split_candidates`, ids
`<attempt>-<n>`), so accept, refuse and retry act on one comment. A fix that
builds on an earlier one stays in the attempt's candidate, and reply-only
comments tie to no code. Rows from before the launch id are grouped by batch
id only. A re-check scout writes no attempt.

## The handoff block

The transcript draws the first message as one handoff block
(`features/chat/components/HandoffBlock`), the same for every provider.

- It starts closed: who sent it, the ask in one line and the why.
- Opening the header shows a chip per section and **All**. One chip opens one
  section below; a second chip replaces it.
- **View as sent** shows the exact text in mono, in two parts for Claude.
- The plan is a title and Open plan, never its body.
- When you wrote the first message yourself, your bubble stays and a one-line
  **Also received** strip sits above it.

On screen it never says "handoff": its eyebrow is "sent by". An agent with no
handoff row shows its first message as "first message · older format", clamped
to 8 lines, read by no parser. `reduceTranscript` makes the `handoff` item and
`TranscriptRows` counts it as the first user turn.

## The conversation and the record

The transcript drawer is the record (`mode="record"`, every row). The agent
page is one conversation (`ChatView` `mode="conversation"`, rows from
`conversationRows`), which keeps per turn:

- The user message, or the handoff block for a first turn.
- One summary line for the turn's tools (`turnSummary`, steps open inline).
- The final answer, app notices and the turn footer.
- The task list a `TodoWrite`, `update_plan` or `write_todos` call writes, as
  one checklist (`planChecklist`) in the turn that first wrote it.

Narration before the last tool call, the live turn and plan updates leave the
center. A pending permission request moves to the dock (`isAskInDock`) unless
no dock can show it, and an answered one leaves one quiet line
(`PermissionRecordLine`). Steps keeps error explanations after a later reply
succeeds, without recovery buttons (`TranscriptErrorRow` `isReadOnly`).

## Under the hood

- `spawn-from-comment.golden.test.ts` pins the text sent for the resolver, the
  re-check, the scribe and the follow-up byte for byte.
- `jargon-copy.test.ts` keeps "handoff" off the screen.
