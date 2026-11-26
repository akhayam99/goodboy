# Lead limits and spend

> **Read this when** you change the spend limit of a Lead run: the Limit chip,
> No limit, how the session budget caps it, what happens at the limit, or a
> number of money on screen. **Not for** the other guards that stop a tree
> ([stops.md](stops.md)) or the workspace default itself
> ([workflows.md](../workflows.md#workflow-rules)).

## Where a limit comes from

A limit exists only when a person sets one. The workspace default is the Limit of
Workflows › **Every run**, and a start never stores a limit: an amount typed on
the form is for that run only.

- The **Limit** chip of **Start a run** (`useAutoTreeLimit`) starts on No limit,
  or on the session budget when it pauses ("Limit for this run", with **No
  limit**). The smallest limit pauses Auto.
- A new tree starts on the smaller of the session cap and the workspace Limit
  (`autoTreeLimitOf` in `packages/core/src/auto/`, which names the winner).
- A session budget that only warns caps nothing: every path reads the session cap
  through `pausingSessionCapOf` (`apps/desktop/src/features/budget/`), which
  gives `null` for one.
- A session budget that pauses set under a running Lead's limit lowers it
  (`setSessionBudget` calls `lowerAutoLimitsToSession`): one write per unfinished
  tree, lowering only a cap still above it. Only the write checks cap and phase,
  never the earlier read, so a cap lowered first elsewhere is never raised and a
  cap raised after the read is lowered too. The next turn pauses on what is
  spent.

### A limit picked for one Lead

`run.limit` (`store/runtime/runLimit/`) maps the root agent id to dollars, or to
`null` for No limit. `readRunLimit` tells inherited (no entry), capped and
uncapped apart. `spawnAgent` writes it before the agent row exists, and
`startAutoTree` reads it instead of the workspace default, in whichever window
creates the tree. An uncapped Lead ignores the workspace default; a lower session
cap still wins.

## Changing the limit

The settings line (`AgentSettingsLine`) holds **Limit** "$5.00 from Harborline"
(`autoLimitWordsOf`: the source names the winner, "this Lead" once set), and the
popover ends with the chain ("This Lead $5.00, then session $8.00, then
Harborline $5.00. $5.00 comes first.").

- The popover (`AutoLimitSetting`) applies on Enter or close, also while the tree
  runs, with **Undo**. **Raise limit** on the tail opens it
  (`autoLimitOpenEvent`).
- Over a pausing session budget, or blank while one exists, it says the session
  limit comes first. Under spent plus reserved the write refuses.
- It changes only this conversation.

`setAutoTreeCap` (`store/runtime/auto/setAutoTreeCap.ts`) writes in one statement
that compares the cap it read and checks spent plus reserved, so no reservation
slips in between. A lost compare says "The limit changed in another window."; a
failed save keeps the popover open with the error. It leaves `phase_rev` alone,
so a running turn keeps its next step, then drives the tree, so a paused tree
resumes after a raise.

## No limit

A blank amount is **No limit**, a NULL `cap_usd` (m231), never a sentinel. A tree
is only created with a number; NULL comes only from this choice, and it is
refused while a session budget exists.

- The chip reads what is spent; the prompt says "no cap" and prints no left.
- The root turn claim and child admission pass a NULL cap
  (`autoBudgetCoversSql`), and the gates read it as unbounded
  (`autoRemainingForGates`). The tree never pauses on money.

## What the cap holds

The cap is checked against real spend: settled cost plus what running children
spent so far (`autoLiveUsdSql`).

- No money is held for a child and no child has a ceiling: it is admitted while
  money is left (or there is no limit) and runs until done.
- Only Auto's own answer holds `AUTO_TURN_CEILING_USD` (an aux job
  `AUTO_AUX_RESERVATION_USD`), so its turn never starts with less left.
- A child that reports no cost settles at 0, marked "cost unknown".
- A reservation stored on an attempt row is read as holding nothing.

The prompt tells Auto the spend left (`autoBudgetPromptLine`), never a count of
agents left.

## At the limit

The limit never throws away work. No new child is admitted and Auto's next turn
waits (`turnGate`, the budget reason), but nothing running stops.

- A running child finishes and settles with its commits, files and result kept,
  and may spend past the limit; the tail says so.
- A child paused on a question is never timed out, so the Lead can still answer.
- Children waiting for a slot keep waiting; a raise starts them.
- The tail reads **Paused at the limit** with **Raise to ...**, **Change limit**
  and **Stop**.

A raise drives the tree: the waiting results reach Auto in one turn. A raise that
still does not cover Auto's turn keeps it paused with the results kept. How it
reads is in
[stops.md](stops.md#a-tree-at-its-limit).

## One formula for money

What is left has one SQL formula (`autoRemainingUsdSql`, read by
`readAutoTreeSpend` and every admission check) and one JS formula
(`autoTreeSpendOf` in core, for seeds, fixtures and the delivery line); nothing
else subtracts. The delivery's budget line is built before the claim reserves the
turn's 0.50 USD, so it names that hold ("Held 0.50 USD for this answer. Left 0.68
USD.") and matches the rail's Left while the turn runs. It never speaks of money
reserved for agents. A delivery retried after a failed start reuses its text.
