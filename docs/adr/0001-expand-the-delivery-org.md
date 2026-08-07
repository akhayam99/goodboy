# 0001. Expand the delivery org to a 20-slot budget with item classes

status: accepted
date: 2026-08-08
owner: the repo owner, acting as product owner for the org itself
reviewed-by: pending; the first engagement's challenger reviews this record
explicitly. The channel: the delivery lead includes this record in the
first captain's pending-deferred-items block, the captain hands it to its
Phase 2 challenger, and the captain updates this line with the review's
pointer in the release PR (see the amendment of 2026-08-08)

## Context

The delivery organization worked but shipped narrow. The engagement closed
2026-08-07 produced 24 work PRs across five releases at 46% issue-backed
against a 60% target, with the issue queue holding almost nothing buildable
for four of the five releases. Across all five: zero pure-refactor items,
zero documentation items, zero items improving the organization itself. The
batch model (3 to 6 items, one 60/40 quota) had no vocabulary for non-code
work, no verifier for it, and no floor forcing anyone to touch the
surround. Four backlog items sat blocked three to four cycles each on
premises that were false, unblocked only when someone finally read the
code. Nobody ran the built app in any of the five releases.

## Decision

Replace the batch model and widen the roster:

- **20 slots per release, allocated by category**, with flow rules, a
  refactor floor of 2, S/M/L sizes, a 10 merge-unit ceiling, and at most 4
  L slots ([docs/autonomy/composition.md](../autonomy/composition.md)).
- **Item classes with per-class verification**, including deferred
  verification for org work
  ([docs/autonomy/item-classes.md](../autonomy/item-classes.md)).
- **Waves**: the batch is consumed in 2 or 3 waves of at most 7 slots,
  `main` green between waves
  ([docs/autonomy/release-loop.md](../autonomy/release-loop.md)).
- **An impact bar** judged by the challenger, with below-bar releases
  publishing but pre-committing the next release
  ([docs/autonomy/impact.md](../autonomy/impact.md)).
- **Fourteen new roles**, each owning a decision nobody else can make,
  chartered under [docs/autonomy/roles/](../autonomy/roles.md); a
  security officer with a merge veto; an explicit sunset clause on the
  weakest hire.
- **A follow-through record** (`FOLLOW_THROUGH.md`) owned by the
  historian, with the third-deferral premise re-test
  ([docs/autonomy/roles/historian.md](../autonomy/roles/historian.md)).
- **A per-spawn run log**
  ([docs/autonomy/visibility.md](../autonomy/visibility.md)).
- **This ADR directory**, capped at two records per release.

## Consequences

The org can now spend a release on work no user sees, which is why the
impact bar ships in the same decision. More roles cost more tokens, which
is why on-call cadences, the run log, and the sunset clause ship in the
same decision. Org rules cannot be verified in the cycle that writes them,
so every org item ships `pending-verification` and this ADR itself is
judged by the first engagement that runs under it.

## Alternatives considered

- Keeping 3 to 6 items and raising release frequency instead: rejected;
  the starved classes were starved by composition, not by cadence.
- 20 slots as 20 PRs: rejected; the serial merge lane and the captain's
  single context are the bottleneck, hence the 10 merge-unit ceiling and
  grouped S slots.
- A separate privacy officer, a seasonal scout, a docs steward, a
  refactor planner, a CPO: each rejected on the owns-a-decision test;
  their reasons are recorded in
  [docs/autonomy/roles.md](../autonomy/roles.md) and the absorbing
  charters.

## Amendment (2026-08-08)

Recorded before the first run under this record, on the adversarial
review's evidence. Three changes.

**The resize.** The default release narrows from 20 slots, 3 waves, and 10
merge units to 12 slots, 2 waves, and 7 merge units. Evidence: the ledger's
last engagement closed at 4 small releases on an exhausted lead context,
and the 20-slot width was never tested; an untested width is an ambition
written as a fact. The 20-slot shape remains the graduation path, gated on
two green engagements at the 12-slot shape and an ADR superseding this one.
[docs/autonomy/composition.md](../autonomy/composition.md) owns the slot
budget and merge-unit numbers;
[docs/autonomy/release-loop.md](../autonomy/release-loop.md) owns the
waves.

**The review.** The original reviewed-by line was a retroactive hand-wave:
nobody had reviewed this record, and running under a rule is not reviewing
it. It is replaced by a dated obligation with a named channel and writer:
the delivery lead carries this record into the first captain's
pending-deferred-items block (the continuous-delivery skill's preflight
says so), the captain hands it to its Phase 2 challenger, and the captain
updates the reviewed-by line above with the review's pointer in the
release PR, per the review rule in [README.md](./README.md). An obligation
with no delivery mechanism is the undelivered-judgment pathology this
amendment exists to close.

**The owner action.** MANDATES.md's Composition quota paragraph still cites
the retired 60/40 default that this record's composition model replaced.
Realigning that paragraph is the owner's alone, recorded here because no
agent may edit that file. Until it happens, the composition table wins and
the discrepancy escalates to the owner inbox per
[docs/autonomy/composition.md](../autonomy/composition.md).
