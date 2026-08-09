# 0004. The harness is a failure class; children know their parents

status: accepted
date: 2026-08-09
owner: head of engineering, per its charter's structural-decision clause
reviewed-by: the challenger, on the PR that lands this record, verdict on
the PR thread; plus the release captain as the bound role, owed by the
first release run under these rules

## Context

At 02:19Z during the last engagement a captain's host process died.
Supervisor and supervised vanished atomically: every check in
`docs/autonomy/watchdogs.md` is performed by an agent inside one host
process, the delivery lead included and unwatched, so there was never a
watcher outside the process to report the event. `docs/autonomy/safety.md`
prices the work failing and `docs/autonomy/infrastructure.md` the world
failing, and this was neither; the delivery lead improvised the
classification in a state file agents may not quote publicly and captains
never read. The phase-flush habit that made recovery possible was carried
by hand in one captain brief and existed in no document.

Separately, six parent-addressing failures across two engagements share one
root cause: `_contract.md`, prepended to every specialist spawn, never
names the parent, while `roles/release-captain.md` asserts children report
to the captain by name, a mechanism no document establishes. And no rule
tells a child to close what it opened, so orphan shells and stale harness
task chips outlive their parents; cleanup deletes worktrees without
checking for live processes inside them.

## Decision

- `docs/autonomy/infrastructure.md` gains a third failure class, **the
  harness failing**: host process death, machine sleep, app restart, a
  stream stall the harness misreports as death. A harness death never fails
  a release and never burns the stop budget; the response is the watchdog
  ladder's replace, with the successor resuming from disk, and a resume
  after harness death is not a retry. The delivery lead diagnoses it (git
  untouched and green, plus no declared outage, plus no work defect, means
  harness) and records the classification in the ledger.
- `docs/autonomy/watchdogs.md` states the in-process limit as fact and
  specifies the **external watcher**: a launchd or cron job outside every
  agent process, roughly 15 minute cadence, reading only the state
  directory and git, spawning nothing, editing nothing, notifying the owner
  on a dead-lock or a stalled run log. Installing it is the owner's action;
  until it exists the delivery lead writes `harness-watch: absent` in the
  ledger header at preflight.
- `_contract.md` gains **parent identity** (the parent's name and role,
  reports addressed exactly so, disk as the only fallback when the parent
  cannot be resolved) and **close what you open** (terminate every
  background process and shell before the report block).
- The release captain prompt fills the parent placeholders on every spawn,
  confirms at roster resolution that a child's harness task reached a
  terminal state and left no running process (survivors killed by pid,
  never by name), and carries the **disk discipline**: each phase's
  deciding artifact reaches scratch when the phase completes, never batched
  at report time.
- The continuous-delivery skill's exit kills by pid any process cwd'd
  inside a worktree before deleting it and stops any still-live harness
  task, naming the honest limit that chips orphaned by a dead parent are
  cleanable only there or by the owner.

## Consequences

A harness death now costs at most one phase, because the artifacts a
successor needs are on disk before the phase that produced them ends. The
same disk discipline is what ADR 0003's two-leg captain handoff stands on:
one rule pays twice. The external watcher does not exist until the owner
installs it, and every unattended run says so in its ledger header instead
of carrying the risk silently. These are org-class changes: they ship
`pending-verification` and the first release run under them judges them.

## Alternatives considered

- **Stretching the watchdog to cover host death**: rejected; watchdogs are
  one-pass children of the process whose death is the event, and a role
  spawned by that process cannot report its death.
- **Children falling back to messaging the delivery lead** when the parent
  is unresolvable: rejected; that is the recorded failure restated with a
  different addressee. The watchdog cadence already reads journals and
  scratch, so disk is the fallback that needs no live recipient.
- **Keying rosters on harness task ids** so stale chips reconcile:
  rejected; the roster is deliberately keyed on git state because task ids
  die with the parent that held them.
