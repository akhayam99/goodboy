# Lead providers and routing

> **Read this when** you change where the Lead or one of its children may run,
> or how the Lead picks each helper's provider and model: the candidates list,
> the guards on a pick, a pick that moves, or the routing a helper keeps. **Not
> for** installing or connecting a provider ([providers.md](../providers.md))
> or the provider pool of a run ([workflows.md](../workflows.md)).

## Where the Lead and its children run

Auto runs on Claude, Codex, Cursor, Gemini and Copilot (`AUTO_OWN_PROVIDERS`),
because it only reads there. It never runs on the opencode family (opencode,
OpenRouter, Moonshot, `AUTO_UNCONFINED_PROVIDERS`): opencode's `plan` agent
denies edits but asks before a shell command, and whether `opencode run` without
`--dangerously-skip-permissions` then denies the ask instead of waiting is
unproven. Three layers hold the line:

1. The composer lists only `AUTO_OWN_PROVIDERS`; with none connected,
   `autoUnavailableReason` says "Connect Claude, Codex, Cursor or Gemini to use
   the Lead."
2. `kindRouting` never resolves Auto to the family (it skips the role default, a
   stored pick and the chat's model), and `spawnAgent` refuses an Auto agent on
   it.
3. `turn_spawn` refuses `auto` and every reading role on an opencode binary
   (`ensure_confinement`).

A reading child runs wherever Auto runs, under the same confinement (Cursor
`--mode plan` included). A writing child runs only on Claude and Codex
(`AUTO_WRITER_CHILD_PROVIDERS`): a Cursor writer passes `--force` with no flag
that denies `git push` or `--no-verify`, and the launch guard runs only on Claude
and Codex. `autoChildProviders` gives the list per role; `routeTurn` and
`turn_spawn` (`ensure_auto_child`) both refuse a child turn outside it.

## The candidates list

A Lead turn ends its message with the models list (`leadCandidatesBlock`, never
the system prompt). A resumed Claude Lead gets it again only when it changed
([blocks.md](blocks.md#the-delivery-text)); every other Lead turn carries it: one
line per provider in your order with its room, load and models per rung, the
Provider priority rule (By order or By load, from `spreadByHeadroom`), and the
writer, reviewer family and pin lines. One selector feeds it,
`selectCandidateInputs` (the last 5 hours of turns, read once by
`readProviderAgentTurns`). With fewer than two providers left it is omitted. The
Lead copies `provider`, `model` and `effort` from a row and says why in
`modelReason`.

## Checking a pick

`resolveChildRouting` builds the candidates for the child's role and difficulty
(`buildCandidates`, scope `helper`) and checks the pick (`checkPick`). A pick
that passes runs as sent and keeps the Lead's line. A pick a guard removes moves to the best candidate by
the rule, and the reason says so ("The Lead asked for Cursor Sonnet 5.5: agents
that write code do not run here yet. Claude: first in your order."). A child with
no pick takes the best by the rule.

The guards: Off, not connected, out of room, cooling down, a writer on Cursor,
the writer's family for a review, off a role pin, and a provider where a helper
of the same role did not start in this tree.

- A role pin always wins; a preset step lock (`stepLock`) wins over all
  ([starting.md](starting.md#what-a-start-stores)).
- The session composer's model steers the Lead only, never a helper.
- A reviewer is routed against the family of the writer of the revision it reads
  (`writerFamilyOf`: that delegation's stored pick, else the owner's); with no
  writer artifact there is no family guard.
- With **Provider priority** on **By load**, `resolveChildRouting` passes the
  headroom (`readHeadroom`), so a Claude past 80% of a limit goes behind Codex.
  Only Claude and Codex report limits.
- When nothing passes, `childRoutingRefusal` names each connected provider with
  its reason (usage limit until a time, budget reached, no visible model, reading
  roles only) and points to Settings › Models.

### A start that failed

An attempt that ended `kickoff_failed` is the trace the next pick reads.
`failedStartsOf` lists those providers for the role in the current generation,
and `resolveDelegateChild` and `recheckQueuedRouting` pass them as
`failedStarts`, so the next helper of that role starts elsewhere (cause
`failed-start`).

- A retry of a helper that did not start drops the failed route: `prepareRetry`
  copies neither pick into `requested` when it names that provider, and no
  `agentLock` holds it.
- Continuing a helper that ran keeps its lock even if a sibling did not start.
- A queued helper whose provider did not start and that has no other left settles
  `blocked` with the refusal instead of starting there.

## The routing a helper keeps

`routing_json` (typed `AutoRouting`, built by `storedRoutingOf`) holds the pick,
the reason, `source` (lead, pin, rule, fallback, lock), the cause of a moved
pick, the Lead's `modelReason` and up to 18 weighed candidates without rates,
struck rows last. A role pin reads `source` pin whether the pick matched or moved
to it. Tell a pin from a Lead pick by `source`, never by `requested` (what the
Lead asked for). Rows without these keys still read.

## Picks that change later

- **Queued.** A queued child is checked again when its slot frees
  (`recheckQueuedRouting` in `launchChildren`). If its provider went Off, out of
  room, into cooldown or over budget, it starts on the best candidate (source
  fallback, or pin) with the cause and new candidates stored; `modelReason`
  stays. The recheck keeps the reviewer's family guard and sizes the step from
  the stored task type and difficulty. It never ran, so this is no swap.
- **Continue.** A retry with a task, or a message from the person, keeps the
  agent's provider, model and `modelReason` (`agentLock`). A cooling provider
  refuses it with the time to send again (`agentLockWait`).
- **Plain retry.** With no task it picks again: the stored pick is offered as the
  Lead's and moves only when a guard removes it.

## The pool

A tree's pool is the run pool when there is one, else the workspace pool (the
providers the Models page policy does not turn off), else every allowed provider
(`autoChildPool`, `runProviderPool`).
