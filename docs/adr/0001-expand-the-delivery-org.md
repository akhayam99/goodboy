# 0001. Expand the delivery org to a 20-slot budget with item classes

status: accepted
date: 2026-08-08
owner: the repo owner, acting as product owner for the org itself
reviewed-by: the first engagement's challenger, during the v0.1.75 release
cycle. Verdict: **sound-with-reservations**. The diagnosis and its counted
evidence justify item classes, the refactor floor and the impact bar
completely; the reservations are about derivation and self-compliance, not
direction. Five claims named as thin: (1) the resize to twelve replaces one
untested number with another and derives neither; (2) the graduation gate
fires on "two green engagements", a phrase nothing in this repo defines;
(3) moving the headline numbers down by amendment contradicts the
supersession rule in README.md, which the graduation clause itself relies on
for moving them up; (4) this very line named one reviewer where README.md
requires the challenger **plus one role that would be bound**, so the review
it demanded was under-specified; (5) the cost control asserted in
Consequences was replaced by this record's own second amendment before a
single release ran. The bound-role reviewer remains unsupplied and is owed
by a later cycle

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

## Second amendment (2026-08-08)

**The ceiling becomes derived.** The flat cost ceiling (50 spawns per
release, at most 8 reasoning) is replaced by a per-release ceiling the
captain derives from the composed batch plus a repair margin the delivery
lead declares from history. Evidence: counted against the charters, the
minimum roster of a 12-slot, 2-wave release reached the constant before a
single repair once watchdogs were included, so correct behaviour breached
it on release one; and a constant cannot say that a docs-and-copy batch
needs no ux designer while a schema batch needs a second data verifier.
[docs/autonomy/cost-ceiling.md](../autonomy/cost-ceiling.md) owns the
formula and the roster classification;
[docs/autonomy/release-loop.md](../autonomy/release-loop.md) keeps the
breach rule, now meaning a spawn the batch never called for or repair
past the margin.

**The owner action.** MANDATES.md's Composition quota paragraph still cites
the retired 60/40 default that this record's composition model replaced.
Realigning that paragraph is the owner's alone, recorded here because no
agent may edit that file. Until it happens, the composition table wins and
the discrepancy escalates to the owner inbox per
[docs/autonomy/composition.md](../autonomy/composition.md).

## Third amendment (2026-08-09)

Recorded when the composition decision above was superseded. Three notes.

**The shape.** The slot budget, the per-category allocation and its flow
rules, the merge-unit ceiling, the wave widths, and the graduation
path this record and its first amendment defined are superseded by
[0003](./0003-compose-to-demand-at-a-defended-total.md), which records the
owner's direction to widen and the safeguards riding it. Every other
decision here stands: item classes, the roles, the impact bar, waves as a
mechanism, the follow-through record, the run log, and the ADR directory.

**The record corrected.** The graduation gate's "two green engagements at
the 12-slot shape" was never met: the 2026-08-06/07 engagement ran the
retired 60/40 batch model, so exactly one engagement ran 12 slots, and
"green engagement" was defined nowhere, as this record's own review
flagged. The definition now lives in
[docs/autonomy/composition.md](../autonomy/composition.md).

**The valve.** The second-sequential-captain sentence in composition.md
named no actor and no moment; its condition, the merge-unit ceiling
saturated two releases running, was met at v0.1.75 and v0.1.76 and nobody
fired it. It is replaced by the in-release leg handoff in 0003: the captain
derives the split at the Phase 3/4 boundary, the delivery lead spawns the
successor.
