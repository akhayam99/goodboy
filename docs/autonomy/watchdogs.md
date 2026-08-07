# Autonomy: watchdogs

Part of the [autonomy cluster](../autonomy.md). This file owns liveness: how
the delivery organization notices a dead or stalled agent and what it does
about it. Chains have stalled before with zero progress because an agent was
backgrounded and its turn ended silently; concurrency is now the default, so
these rules are what make that failure impossible to repeat quietly.

## The principle

Every long-running parent watches its children, and no watcher trusts a
report it could verify from disk. Progress is measured by observable facts
(commits, PR states, CI runs, journal lines in the scratch path, ledger
lines), never by an agent's self-description. A parent never fabricates a
pending child's result, and never reports success past a child it has lost
track of.

## The roster contract

Before spawning any batch of concurrent children, the parent writes a roster
to its scratch state: one line per child (role, work item, branch, worktree,
scratch path, spawn time). The roster is a crash-recovery manifest keyed on
git state, never on harness task ids: a replacement parent resumes from
branches, worktrees and journals, because task ids die with the parent that
held them.

- Every builder and verifier keeps a **heartbeat journal** in its scratch
  path: one appended line at each real boundary (reading done, a commit
  made, a test run started or finished). The brief says so explicitly; a
  child that was never told to journal cannot be judged by its silence.
- **First-activity check**: within about ten minutes of a spawn, every
  child's journal must exist. A child with no first activity is a failed
  spawn, not a slow thinker; respawn it foreground, once. A respawn that
  also produces no first activity drops the item per the ladder below.
- A completion notification resolves a roster entry. A parent reaching a
  phase boundary with unresolved entries either waits there doing bounded
  work (watchdog passes, reading finished verdicts, merge-tree checks),
  applies the ladder below, or writes the roster state to disk and reports
  `paused`; it never proceeds as if the entry were resolved.
- Notification loss and a slow child look identical from the parent's
  chair; journals and git tell them apart. A child whose journal or branch
  has advanced is alive regardless of notification silence. A child with
  neither across two checks is presumed dead.

## The cadence

- **Release captain, ~every 30 minutes while children run**: spawn a cheap
  watchdog that reads each live child's journal, branch and worktree for
  progress since the last check. No new journal line, no commit and no test
  run across two consecutive checks: presumed stuck. The watchdog only
  reports; the captain acts.
- **Delivery lead, 2 hours without news from a captain**: inspect the
  release's worktrees, branches, open PRs and CI runs. Quiet plus no
  observable movement is presumed dead.
- **Issue triage officer**: its polling loop doubles as its heartbeat; the
  delivery lead applies the same 2 hour rule.

## Recovery, in order

1. **Nudge**: ask the agent for a status with a hard deadline, when the
   harness allows messaging it.
2. **Replace**: kill the stuck agent, spawn a fresh one on the same brief
   plus a note of what the predecessor left on disk. Worktrees and branches
   survive agents; a replacement resumes from git state, not from memory.
   Before a replacement reuses a branch or worktree, confirm no new commits
   for a full check interval: the predecessor may still be writing, and two
   agents in one worktree destroy each other.
3. **Drop**: if the same item kills two agents, the item is the problem.
   Drop it, record it in the backlog with what was observed, move on.
4. **Stop**: if the captain itself dies twice on one version, the
   engagement stops, per the stop conditions in
   [safety.md](./safety.md).

## Rules for the watchers themselves

- Watchdogs are cheap, read-only, and bounded: one pass, one compact report,
  then gone. A watchdog never fixes anything and never messages the watched
  agent's siblings.
- Watchdogs spawn foreground: they run for seconds, and the liveness answer
  must not depend on the mechanism it exists to check.
- Every check is logged in one line to the engagement's scratch state, so
  the next watchdog can tell "still slow" from "newly dead".

## Degraded mode

When the harness cannot run background children with completion
notifications, everything above collapses to the older rule: children spawn
foreground, one at a time, and the cadences mean "at the first boundary
after this much time has passed". Slower, never silent. The delivery lead
decides which world the engagement is in once, at preflight, by probing:
spawn one trivial background child and see whether its completion
notification arrives. The verdict goes in the ledger header and in every
captain's brief, and each parent writes it into its scratch state so its
watchdogs and any successor know which rules apply.
