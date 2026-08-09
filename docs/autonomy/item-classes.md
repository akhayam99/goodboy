# Autonomy: item classes

Part of the [autonomy cluster](../autonomy.md). This file owns the classes a
work item can belong to: what each class delivers, how each class is
verified, and the deferred-verification rule including its delivery
channel. How many slots each category gets is owned by
[composition.md](./composition.md); the code-class verification standard in
full is owned by [release-loop.md](./release-loop.md).

The reason classes exist: for five straight releases every shipped item was
code, because code was the only class with a deliverable and a verifier
anyone had defined. Zero pure-refactor items, zero documentation items, zero
items improving the organization itself (ledger, engagement closed
2026-08-07). A class of work with no verification standard does not get
skipped politely; it silently stops existing.

Two rules bind every class:

- **A verifier different from the author.** No class is exempt, and `pnpm
test` is a code-class criterion, not a universal one. A class verified by
  its own author, or by a test suite that cannot see it, is unverified.
- **Class boundaries are footprint boundaries.** A docs item does not touch
  code, a copy item does not touch layout, a refactor item does not add
  behavior. The declared-footprint discipline from
  [release-loop.md](./release-loop.md) extends to non-code classes: an item
  that needs to cross its class boundary is two items, split at plan time.

## The classes

| Class        | Deliverable                                                       | Verified by                                                                                                                                                                                            |
| ------------ | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| code         | a PR                                                              | the full standard in [release-loop.md](./release-loop.md): typecheck, tests, knip, diff against the item, sabotage                                                                                     |
| refactor     | a PR with unchanged behavior                                      | characterization test first when the surface is uncovered, then the diff: no undeclared behavior change, no weakened assertion                                                                         |
| docs         | an updated doc                                                    | a different agent re-derives every claim from the code or the app and returns a claim/verdict table                                                                                                    |
| copy         | user-facing strings                                               | the [voice steward](./roles/voice-steward.md) against [tone-of-voice.md](../tone-of-voice.md), plus a grep for the banned words; the author never verifies                                             |
| design token | a token or primitive                                              | rendered in both themes, plus proof the hardcoded value it replaces survives nowhere else                                                                                                              |
| audit        | a findings list with pointers                                     | two sampled findings reproduced independently by another agent                                                                                                                                         |
| org          | a rule, brief, or policy doc                                      | **deferred**: recorded `pending-verification`, judged on the next cycle once the rule has actually run                                                                                                 |
| experiment   | a shipped change plus a success criterion written before it ships | **deferred**: the criterion (metric or observable, reading window in releases, revert shape) is recorded in the ledger entry at ship time; the captain of the named later release rules keep or revert |
| spike        | a written answer, often an ADR                                    | the [challenger](./roles/challenger.md) contests the conclusion, not the research                                                                                                                      |

Class-specific notes, each carrying its reason:

- **Refactor.** The characterization test comes first because a refactor of
  an uncovered surface has no way to prove "behavior unchanged"; the diff
  review then checks that no assertion got weaker, because a weakened
  assertion is how a behavior change hides inside a green suite.
- **Docs.** The claim/verdict table exists because docs rot by claim, not by
  file: a doc that is 90% true is read as 100% true. Re-derivation from the
  code is the only check that catches the 10%.
- **Audit.** "No findings" is a valid outcome and goes in the ledger as one;
  an audit slot never flows away for lack of findings
  ([composition.md](./composition.md)). The two-sample reproduction exists
  because an audit nobody re-runs is an opinion with a table of contents.
- **Spike.** The challenger attacks the conclusion because a spike's failure
  mode is a confident answer resting on research that never tested the
  alternative, and re-doing the research would just be a second spike.
- **Surface rethink, a spike variant.** The one sanctioned way to say "this
  surface is wrong whole and should be rebuilt", which no per-defect list
  can say. Admission bar mirrors the org-item citation bar: an owner ask
  for a rethink on the record, or the same surface named whole by two
  consecutive product-critic walks ([roles/product-critic.md](./roles/product-critic.md)
  owns the naming; the previous walk's condemnation travels in the
  delivery lead's baselines carry, so the second walk and the product
  owner can both see it); no citation, the challenger rejects it, because the
  filler bar exists precisely to refuse redesigns on taste. Deliverable: a
  written redesign of the surface (entry point, states, verbs, the three
  questions answered at surface level, and what it deletes), contested by
  the challenger like any spike; the conclusion goes to the owner inbox as
  a direction question before any implementation is planned. A triggered
  rethink is admitted ahead of ux defect items
  ([composition.md](./composition.md) states the same rule from the
  composing side).
- **Experiment.** The criterion is written before the build because a
  criterion written at judgment time always passes. A criterion nobody can
  read in its window is a failed experiment and reverts by default; the
  revert is a normal item, verified normally, occupying no new slot,
  because undoing a failed bet is not new commitment. Judgment is
  delivered through the pending-deferred mechanism below. Slot placement
  is one clause in [composition.md](./composition.md): an experiment
  occupies its own category's slot and has no budget row.

## Deferred verification: org items and experiments

An org item (a new rule, a changed brief, a policy doc) cannot be verified in
the cycle that writes it: the rule has not run yet, so any green verdict on
it would be a lie with paperwork. So org items ship marked
`pending-verification` in the ledger, and the next release's captain judges
them against what actually happened once the rule has been exercised. This is
an honest hole, not an elegant one; naming it beats masking it as green.

The judgment is **delivered, not hoped for**: the pending list rides the
next captain's brief, in the skill's `{{pending_deferred_items}}` block,
covering pending org items and experiment criteria alike, and the delivery
lead rejects a report that leaves an inherited item unjudged. Verdicts are
`kept | reverted | still-pending`, each with one line of reason on the
report's `self:` line; `still-pending` without a reason is a rejection too.
A record review (an ADR or a spike conclusion judged after the fact) uses
`sound | unsound` instead: a record is not kept or reverted, it is judged,
and forcing it into the other pair is how a review verdict goes unwritten.
The channel is written down because a deferred verdict with no delivery
mechanism is the same silent death this file diagnoses: release N ships the
item, release N+1 never receives it in its brief, and
`pending-verification` becomes a place work goes to stop being examined.

Org items also carry the strictest admission bar of any class, because
self-improvement is the only class that can grow itself:

- Sourced only from evidence the machine already records: the ledger's
  per-release process defects, unanswered `OWNER_INBOX.md` entries, watchdog
  reports and verifier verdicts (sabotages surviving on the same surface,
  false greens from the shared turbo cache), the run log's tier and verdict
  lines ([visibility.md](./visibility.md)), so a tier-discipline violation
  the log surfaces can become an org item, and issues opened after a
  release that name a gap.
- **Every org item cites either one incident that occurred in two distinct
  releases, or a single severe one.** No citation, the challenger rejects
  it. This is the guard against navel-gazing: without it, an org that may
  work on itself will.
- Every org item appears by name in the final report under `self:`, so the
  owner sees exactly what the machine spent on itself. A release where this
  class costs more than the product work is a declared defect.
- Slot allocation and the hard cap live in
  [composition.md](./composition.md).
