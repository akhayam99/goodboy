# What stops a Lead

> **Read this when** you change a guard that blocks or pauses a Lead tree,
> Retry, the caps on returns, how many children run at once, the idle clock of
> a child, or deleting the root agent. **Not for** the spend limit itself
> ([limits.md](limits.md)) or how a returned child is decided
> ([returns.md](returns.md)).

## What stops an Auto tree

No fixed count of agents, runs or turns ends a tree or refuses a hand over: a
tree with 12 agents, 20 attempts or 30 turns keeps going. Only guards that
protect the user stop it:

- the spend cap ([limits.md](limits.md));
- `AUTO_TREE_LIMITS`: question cycles per delegation, the no progress streak and
  the [caps on returns](#caps-on-returns).

Nothing counts delegate calls per turn or refused calls per conversation.

### Columns kept and not read

These stay with no migration. Do not start reading them again.

| Column                                                                             | State                                               |
| ---------------------------------------------------------------------------------- | --------------------------------------------------- |
| `auto_trees`: `turn_delegate_calls`, `refusals_used`, `last_refusal_key`, `grants` | Never written or read                               |
| `auto_trees`: `delegations_used`, `attempts_used`, `turns_used`                    | Only count and show; high counts resume as they are |
| `auto_trees`: `hard_deadline_at`; `auto_delegations`: `deadline_at` (`NOT NULL`)   | Written and never read                              |

`message_limit` and `substep_cap` stay refusal codes only so stored refusals
still read.

## Caps on returns

Both lineage caps count from the root of the chain down every branch
(`lineageOf`).

| Cap                    | Value                                      | Counts                                                                                                                                   | Over it                                                                                                                                                    |
| ---------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `returnsPerDelegation` | 2                                          | Returns in the `retryOf` lineage (`returnCountOf`)                                                                                       | The third return closes the child; a `retryOf` in its lineage is refused `return_limit`, and Auto is told to hand the task to another role or ask the user |
| `rebriefsPerTask`      | 3                                          | Replaced agents and continues with a `task`, in the `retryOf` and `replaces` lineage, with the block's other children (`rebriefCountOf`) | The fourth is refused `task_rebrief_limit`, and Auto is told to ask with a propose block                                                                   |
| `returnsPerTreeWindow` | 6 in 30 minutes (`AUTO_RETURNS_WINDOW_MS`) | Returns, on a tree with no spend cap only                                                                                                | The sixth row carries `isOverWindow`, and `deliverNext` blocks with `AUTO_BLOCK_TEXT.limit_returns`                                                        |

- A `retryOf` or `replaces` may name only an undecided return, the latest agent
  of the task (`targetRefusalOf`, else `retry_unavailable`).
- Children of one block may share a `replaces` to split a task and count as one
  hand over; two `retryOf` of one agent in a block are refused.
- A propose block waits for you, so the lineage caps do not refuse it.
- The Lead's messages to a working child have no cap.
- With a spend cap, the cap stops a costly loop and any number of returns reach
  the Lead. Retry clears the window mark. A tree blocked on its limit whose limit
  is removed while such a return waits moves to the returns block (`blockTree`
  replaces only a budget block), so it reads Retry, not Raise limit.

## Blocked and Retry

A tree is blocked when a guard stops the next delivery (three answers with no
progress, the budget, six returns in 30 minutes with no limit), when the
provider refuses the Lead's turn, or when the Lead stopped answering. A tree
still deciding 10 minutes after its delivery (`AUTO_STALE_DECIDE_MS`) with no
live root run settles from what the run left, or with nothing stored blocks with
"The Lead stopped answering before it replied. Retry sends your message again."
and puts the message back.

No clock blocks a tree. A tree stored with "This conversation reached its time
limit." reads **Failed** like any block, and recovery after a restart leaves it
for the user (`isAutoGateBlock`).

### Block texts

The texts live in `turnGate.ts` ("The Lead replied 3 times with no next step.",
"The run reached its limit.", the returns text). A refusal at the streak limit
has its own text ([blocks.md](blocks.md#refusals)). The text is the stored
`blocked_reason`, so every older wording stays in `LEGACY_GATE_TEXTS`
(`packages/core/src/auto/legacyGateTexts.ts`).

- `isAutoGateBlock` and `isAutoBudgetBlock` read old and new texts alike, so an
  old block survives a restart and an old limit block resumes on a raise
  (`legacyGateTexts.sqlite.test.ts`).
- The tail shows an old text in current words (`autoBlockShownText`) and keeps
  the stored one, so its action does not move (`legacyBlockReaders.test.ts`).

### How a block reads

| Block                 | Word                          | Raises                                     | Action                         |
| --------------------- | ----------------------------- | ------------------------------------------ | ------------------------------ |
| Any guard but a limit | **Failed** on every surface   | `agent-error` (`autoFailedRootsOf`)        | **Retry**                      |
| At its limit          | **Needs you**, reason `limit` | `run-paused-at-limit` (`autoLimitRootsOf`) | Raise the limit, no Retry card |

A failed tree is not a wait for you: `autoWaitRootsOf` counts a plan, a project
ask and a stuck child, on the typed `AutoTreeState`, never a display word.

### A tree at its limit

`isAutoPausedAtLimit` is the one function the word, the glance and the row facts
read, whether the budget is spent or a guard blocked for the budget
(`leadStopOf`). Its row sits under Needs you.

### Retry

A blocked tree writes nothing while it waits, and resumes by itself only after a
budget block once the limit is raised. Otherwise **Retry** (`retryBlockedTree`,
through the retry port) clears the reason, resets the no progress streak and
redelivers what waits; at the budget it refuses with the reason. A user message
to a blocked tree is a Retry too, and the first recovery after a restart retries
a block no limit caused.

## A child that returned

A returned child (outcome `blocked`; reasons `needs_shell`, `needs_writer`,
`needs_role`, `needs_decision`, `needs_user`, or `declared_blocked` and
`missing_tool` on older rows) is not an error and not yours to move.

- While Auto decides it reads **Idle**, tail "Returned to the Lead: <its
  request>" (`returnedRequestOf`, else its summary).
- It reads **Done**, with no tail, once Auto continued (`retryOf`), replaced
  (`replaces`) or released it (`isAutoDelegationReplaced` over
  `isAutoReturnDecided`). A later agent on the branch that names it in neither
  field, or a proposal you declined (`declinedTargetsOfRow`), is no decision.
- A row from before the structured return (no `returned`) is decided by any role
  started later on its branch.

`autoSettledStateOf` turns the stored outcome into the word, and
`autoChildWordOf` is the one function the tail, the Agents column, the
delegation card and the Overview read. **Failed** is only a real error (a
process error, a lost report, no closing), with a sentence from
`delegationSentenceOf`. **Needs you** is Auto's alone. The dock draws no red
recovery for a returned child (`useAutoChildRecovery`), and `delegationCardOf`
drops its **Blocked** line and reason.

## Run slots

A batch has any number of children. At most `AUTO_MAX_RUNNING_CHILDREN` (4) run
at once, because each holds memory on the machine.

- A child runs while its latest attempt and its delegation are `starting` or
  `running` (`readAutoRunSlots`). One that ended waits for its batch without a
  slot.
- The rest wait in `accepted` and read **Queued**. The view reads the same slots
  (`runSlots`), so a child a free slot did not start within a minute reads
  **Never started** with its recovery (`autoStartableSinceOf`).
- Each start takes a slot in one guarded update (`autoTakeRunSlotStatement`,
  through `runSlotStatements` in `startAttempt` and `startQueuedAttempt`):
  `accepted` to `starting` only while fewer than four run, this window owns the
  tree and money is left. Two windows or a restart never start one child twice;
  a restarted window starts the waiting ones (`launchChildren` after `recover`).
- `launchChildren` offers `readFreeSlots` children, oldest first, in
  `delegating`, `waiting` and `merging`, never while Auto answers or the tree is
  blocked.
- The idle clock starts when the slot is taken. An answer to a paused child is
  admitted at once and waits in `accepted` for a slot. Stop settles the waiting
  children too.

Helpers of a paused parent have their own count
([returns.md](returns.md#running-helpers)).

## Time never cuts a working child

A running child has no wall clock deadline. It is stopped only after
`AUTO_CHILD_IDLE_MINUTES` (30) with no output and no tool activity in its
`turn_events` (`enforceDeadlines`, `readAgentLastEventAt`), a hung CLI.

- Quiet time counts from the latest of the last event, the attempt start and the
  app start, so a row whose `deadline_at` passed while the app was closed never
  expires on load.
- An open tool call (`hasAgentOpenToolCall`, a long build) is activity, bounded
  by the CLI's own tool timeout.
- A child paused on a question has no clock at all.

It settles `timed_out`, reason `no_activity`, and reads **Needs you**, never
**Stopped**, though the cancel marks the agent stopped (`isAgentStopDeliberate`,
`settledStatusOf`). Its page offers **Retry** and says its work is kept. A row
settled `deadline_passed` keeps its sentence.

## Work is kept

A child that ended stopped, timed out, failed or blocked keeps its worktree and
partial output. Auto continues it with `retryOf`: same agent and mount, a
kickoff that says to continue, not start over (`retryNoteOf`), and a first
attempt that carries the stopped one's baseline (`carriedSnapshot`), so the
result counts the earlier commits. Only a retry of a completed child with no
`task` starts again from scratch.

## Deleting the root agent

Deleting a tree's root agent first runs the stop (`stopAutoTreeForDelete`,
through the tree stop port and `stopTree`): the generation advances, running
children are cancelled, and the stop is confirmed only after that cleanup
succeeded.

- If a child does not exit, Auto is not running or another window owns the
  tree, the delete fails with the reason and the agent stays; deleting again
  resumes the stop.
- The purge (`agentPurgeStatements`) never touches the tree. Plans stay readable.
- The lists read only trees whose root is in the session (`liveAutoViewsOf`,
  `useAutoTreeViews`), so a tree left on a deleted or moved agent raises no
  card, line or count.

A child whose agent is gone is not stuck (`isAutoChildStuck`). A child accepted
and not started has no agent yet and still counts, and so does one whose agent
could not be created (`agent_not_created`): its failure and retry card stay.
