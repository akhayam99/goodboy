# How the Lead decides

> **Read this when** you change the `<<auto>>` block a Lead ends its turn
> with: an action, how a block is read and applied once, a refusal, or the
> delivery text Auto reads. **Not for** the `mount` block and the project ask
> ([projects.md](projects.md)), the levels and rows that gate admission
> ([permissions.md](permissions.md)) or the brief a child gets
> ([returns.md](returns.md)).

## Auto runs read-only

Claude's Auto lead uses `--permission-mode default` at every session mode but
Full access, where it uses `bypassPermissions`, with
`--tools Read,Grep,Glob` and explicit shell and write denies
(`effective_permission_mode` in `providers/cli_args.rs`). Other Claude read-only
roles keep plan mode; Codex keeps `-s read-only` and Cursor `--mode plan`.

Auto has no shell and never calls Goodboy inside its turn: no bridge command, no
capability token, no allow rule. It ends its final reply with at most one block:

```
<<auto>>{"action":"delegate","requestId":"r1","children":[...]}<</auto>>
```

No block is a plain answer. The block is hidden in the transcript like the other
markers; the delegation lines show what it did.

## The actions

| Action                      | Fields                                                          | Does                                                                                                     |
| --------------------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `delegate`                  | `requestId` (optional, derived from the run), `children`        | Hands one to four children to agents of a role (`parseDelegateSpec`)                                     |
| `propose`                   | `primary`, up to two `alternatives`                             | Offers a child that waits for confirmation; alternatives have a label and a role, no brief and no budget |
| `answer`                    | `delegation`, `question`, `text`, optional `artifact`           | Answers a child's question ([returns.md](returns.md#answering-the-parent))                               |
| `release`                   | `delegation`, `reason`                                          | Says a returned child is no longer needed ([returns.md](returns.md#auto-must-decide))                    |
| `message`                   | `delegation`, `text`                                            | Queues a note for a working child                                                                        |
| `stop`                      | `delegation`, `reason`                                          | Stops a working child                                                                                    |
| `close`                     | `target`, `as`, `reason`                                        | Tidies the Lead's own work                                                                               |
| `finish`                    | `summary`                                                       | Says the work is done                                                                                    |
| `follow`, `hold`, `deviate` | see [workflows-and-plans.md](workflows-and-plans.md#the-blocks) | Only on a run that follows a workflow                                                                    |
| `mount`                     | `project`, `branch`, `reason`                                   | Attaches a project ([projects.md](projects.md))                                                          |

`close`, `follow` and `deviate` may also come before the last block
(`parseAutoCloseBlocks`, `parseAutoNoteBlocks`), and `applyAutoBlock` runs them
first. `hold` is the last block of its turn.

### Child spec fields

- `retryOf` continues an agent that ended. With a `task` it is the same agent,
  role and worktree, the task briefed as **New instructions** (`prepareRetry`,
  `resolveDelegateChild`). A role, title or mount on a retry is `spec_invalid`.
- `revises` asks the role that made an artifact for its next version (leave
  `role` out). `parseDelegateSpec` reads `{"artifactId","expectedRevision"}`, a
  bare id, the `revision` or `version` keys and a version as text ("v1"); none
  means the latest. It needs no `reason` (`DELEGATE_REVISE_REASON`), `retryOf`
  beside it is read as the revise, and a refusal names the shape
  (`DELEGATE_REVISES_SHAPE`) and, when stale, the latest version.
- `title` is in [children.md](children.md#names); `replaces` and `decisions` in
  [returns.md](returns.md); `facts` in
  [roles.md](roles.md#branch-facts-for-a-scout); `forQuestion` in
  [returns.md](returns.md#substeps); `publish` in
  [pushing.md](pushing.md#publish).

### propose

`parseProposeSpec` validates the primary with the delegate rules and forces
confirmation. Alternatives live in the primary's request data, inside the replay
hash. Admission keeps the delegate's plan, mount, owner and generation guards. A
malformed proposal starts nothing and comes back as a refusal
(`proposals/propose.sqlite.test.ts`). The card is in
[workflows-and-plans.md](workflows-and-plans.md#confirming).

### A plan feeds one writer per role

- A second writer of a role on a plan an unsettled writer already took is
  refused `artifact_busy`, in the same batch or later; a tester or docs writer
  may still read it.
- A writer on a plan version that is no longer current is refused
  `stale_revision`, whatever the older approval.
- A child with `confirm: true`, or an ambiguous revise, asks at any level.

### message

`text` is at most `AUTO_CHILD_MESSAGE_CHARS` (2,000). It reaches the child as its
next turn when the current one ends, never mid-turn (`messageChild`). A child not
working is refused `not_running`. The queue id is the delegation and Auto's
turn, so a recovered turn that applies the block again replays it without
queueing or counting twice.

### stop

`stop` uses the dock Stop's cancel (`stopChild`, the `cancelRun` port with
`by: 'auto'`).

1. The reason is saved with `is_stopping` before the cancel, so a run end that
   wins the race or comes late settles with it (`settleAttempt`).
2. Once the cancel answers, whatever it answers, the agent is marked stopped by
   `auto` and its `auto-message:` items are dropped (`cancelTurnConfirmed`,
   `dropAutoMessages`).
3. It settles `stopped` with "Stopped by Auto: ..." and its work stays.

The child reads **Stopped by the Lead** (`stoppedPhraseOf`, the one owner of
every "Stopped by" label). A failed cancel is `tree_busy` and the delegation goes
back as it was. A stopped revise frees its artifact in the same transaction
(`failAttempt`, `stoppedRevise`). The idle cancel of `enforceDeadlines` also
stops `by: 'auto'`. A stop on an ended child answers `alreadyEnded`.

### close

`target` is a delegation or artifact id, `as` is `done`, `skipped` or
`discarded` (`AUTO_CLOSE_SHAPE`). Refusals of early close blocks are one row
(`refusal:<run>:close`).

- `closeTarget` stops a working agent first, then stores `request_json.closed`
  and the agent's `done_at` in one write guarded by owner and generation. A
  closed return counts as decided.
- The rail shows **Closed by the Lead**, **Skipped by the Lead** or **Discarded
  by the Lead** with the reason (`closedSentenceOf`). A discarded agent leaves
  the rail; its transcript stays.
- The same verb twice, or for a child already gone, is a no-op. An agent waiting
  to start or for an answer is `not_running`.

An artifact can only be discarded. While Approve the plan is Ask and the plan
waits for you, the ask is stored on the planner delegation
(`request_json.planDiscardAsk`) and the dock reads **The Lead wants to drop plan
vN** with **Drop plan vN** (`planDiscardAskOf`, `drop` on
`useAutoPlanApproval`). Otherwise `discardAutoPlan` discards it at once; your
Drop goes through the same function, then reloads the runs and tells the other
windows. Scene: `c07-auto-lead-tidy`.

### finish

Refused while an agent is open or a result waits, with the reason.

- Close the work at You: it stores nothing, the tree rests as Idle until you
  mark it finished, and the prompt asks Auto to suggest **Mark finished** and
  send `finish` only when you asked to close.
- Close the work at Lead: the turn settles `finished`, and the prompt
  (`buildAutoSystemPrompt` with `isLeadClosing`) asks for `finish` once done.
- A message to a finished Lead opens it again.

## Never a dead end

At every level Auto never ends a turn saying it cannot because of mounts, tools
or permissions (`AUTO_NEVER_REFUSE_RULE` in `prompt.ts`). A need for a role it
lacks goes to that role: **Never** delegates at once, **After the plan** follows
its plan gate, **Every step** sends a propose block. A writer that cannot start
still ends in a card or a named next step. A choice is a next step proposal,
never a prose yes or no question.

## Applying a block once

`parseAutoBlock` (`packages/core/src/auto/autoBlock.ts`) reads only the settled
text of a turn that ended ok: the last complete block, code fences stripped, raw
line breaks in strings escaped, the last `}` when the close marker is missing.

`store/runtime/auto/applyAutoBlock.ts` runs at the top of `settleAutoTurn`, only
for the current run of a `deciding` tree that is not stopping. A duplicate
settle, a late settle after a stop and a recovered turn admit once; the
admission guards and the request id replay do the rest. A delegate block on a
turn that is no longer the current run becomes a `not_deciding` refusal row
unless its request id was admitted. A stop or a restart stays silent.

The runtime keeps the run ids of the turns it started (`createOwnTurns`, set in
`deliverNext`, cleared after `settleAutoTurn`). `recoverTree` and
`expireStaleDecide` leave those runs alone, because the ledger marks a run done
seconds before the turn saves its answer. Only a run from an earlier process is
settled from the ledger.

## Refusals

What Auto cannot do comes back as a `refusal` outbox row, delivered with the next
turn under REFUSED, NOT DONE: a refused spec, a budget or limit refusal, a block
that does not parse.

- Such a turn is no progress, so `noProgressStreak` bounds retries. When the
  streak is at its limit and the next row is a refusal, the tree blocks with
  that refusal's reason (`autoRefusedBlockText`), not the generic line, with
  **Retry** on the tail.
- Every child refusal names the field or phrase to change ("facts" on a
  reviewer, the matched command), so Auto fixes the spec in one try.
- A row keeps the action, the code and the refused roles. While pending for the
  current generation it is `pendingRefusal`, said in the user voice on the tail
  (`refusalNoticeOf`, `AUTO_REFUSAL_USER_REASON`).
- `mount_ambiguous` and `mount_missing` are asked instead
  ([projects.md](projects.md#the-project-ask)).

## The delivery text

Every delivery starts with a digest of the tree: open agents with role, state
and age, questions waiting, the budget
([limits.md](limits.md#one-formula-for-money)) and a `MOUNTS:` line of usable
mounts as `id (project, branch)` (`buildMountsLine`). With no mount it says none
is attached yet and that a writer is still delegated.

Undecided returns are listed under **WAITING FOR YOUR DECISION**
([returns.md](returns.md#auto-must-decide)). Each result carries its artifact
text, cut when long, so a provider that does not resume still has its memory.
Each result line starts with the name on its card ("- Reviewer 2 (reviewer
<agent id>, <delegation id>): completed"). The prompt tells Auto the user sees
each result as a card, so it never repeats what an agent said and writes only
what it adds.

The bridge Auto does not use itself is in [query-bridge.md](../query-bridge.md);
its children are refused its publishing acts ([pushing.md](pushing.md)).
