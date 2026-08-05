# Autonomy: watchdogs

Part of the [autonomy cluster](../autonomy.md). This file owns liveness: how
the delivery organization notices a dead or stalled agent and what it does
about it. Chains have stalled before with zero progress because an agent was
backgrounded and its turn ended; these rules exist so that never silently
repeats.

## The principle

Every long-running parent watches its children, and no watcher trusts a
report it could verify from disk. Progress is measured by observable facts
(commits, PR states, CI runs, files in the scratch path, ledger lines), never
by an agent's self-description.

## The ladder

Cadences are targets, bounded by the harness: every role spawns its children
foreground, so a parent blocked inside a synchronous call checks liveness at
the next boundary it owns (between spawns, between phases, between poll
iterations), not on a wall clock. When the harness offers background tasks
with notifications or scheduled checks, the cadences below apply literally;
otherwise they mean "at the first boundary after this much time has passed".

- **Release captain, ~30 minutes into any running phase**: at the next
  boundary, spawn a cheap watchdog that checks each active sibling's output
  for observable progress since the last check (and, in a parallel batch,
  ride one watchdog alongside the builders). A builder with no new commit, no
  test run and no scratch notes across two checks is presumed stuck. The
  watchdog only reports; the captain acts.
- **Delivery lead, 1 to 2 hours without news from a captain**: when the
  captain runs foreground, this check is the retry ladder applied to its
  eventual return; when it runs as a background task, spawn a watchdog that
  inspects the release's worktrees, branches, open PRs and CI runs. A captain
  quiet past two hours with no observable movement is presumed dead.
- **Issue triage officer**: its polling loop doubles as its own heartbeat;
  the delivery lead applies the same 2 hour rule to it.

## Recovery, in order

1. **Nudge**: ask the agent for a status with a hard deadline, when the
   harness allows messaging it.
2. **Replace**: kill the stuck agent, spawn a fresh one on the same brief
   plus a note of what the predecessor left on disk. Worktrees and branches
   survive agents; a replacement resumes from git state, not from memory.
3. **Drop**: if the same item kills two agents, the item is the problem.
   Drop it, record it in the backlog with what was observed, move on.
4. **Stop**: if the captain itself dies twice on one version, that counts
   toward the two-failed-releases stop condition in
   [safety.md](./safety.md).

## Rules for the watchers themselves

- Watchdogs are cheap, read-only, and bounded: one pass, one compact report,
  then gone. A watchdog never fixes anything and never messages the watched
  agent's siblings.
- Watchdogs run foreground like everyone else. A backgrounded watchdog is the
  failure mode it was hired to catch.
- Every check is logged in one line to the engagement's scratch state, so the
  next watchdog can tell "still slow" from "newly dead".
