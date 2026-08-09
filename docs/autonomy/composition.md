# Autonomy: composition

Part of the [autonomy cluster](../autonomy.md). This file owns what goes into
a release: the defended total, the floors, the demand-composition procedure,
slot sizes and the merge-unit ceiling with the two-leg captain shape, the
quota-line parsing rule, the record of how the width was decided, how authors
are weighed inside the issue share, and what happens to standing direction
nobody answers. What each item class delivers and how it is verified is owned
by [item-classes.md](./item-classes.md); the trust model that weighs authors
is in [safety.md](./safety.md); the waves that consume the batch are in
[release-loop.md](./release-loop.md).

## The batch is composed to a defended total of 20

The unit of commitment is the **batch**: the slots the product owner commits
to one release after the challenge round. The release is the shipping
vehicle; the batch is what the organization takes on, consumes, ships, and
only then replaces. There is no timebox: a batch ends when its release is
drafted, because wall clock has never been the binding constraint here;
tokens and attention are.

The previous model allocated fixed slots per category (4 issues, 2 backlog,
2 refactor, 1 ux, 1 grouped copy/docs/design-system, 1 security, 1 perf; 12
total, recorded in [ADR 0001](../adr/0001-expand-the-delivery-org.md)'s
amendment). It shipped, and it failed in both directions at once: a cap
defends breadth and starves depth, a floor defends the quiet and starves the
urgent, and that model had one of those problems in every row. v0.1.75 and
v0.1.76 each left issue slots empty that other queues could have filled,
while the ux row's cap of 1 had no answer to a queue of twenty real ux items
beyond shipping one and deferring nineteen. The replacement, recorded in
[ADR 0003](../adr/0003-compose-to-demand-at-a-defended-total.md), keeps the
scar tissue and drops the per-category arithmetic:

- **A defended total of 20 slots.** The product owner composes toward 20
  every release. The total defends ambition against under-composition: a
  batch that arrives smaller says why in the plan, and thin queues at the
  filler bar is a valid why. It never works the other way: an item weak on
  its own merits is not admitted to reach the number.
- **Floors for the categories that cannot advocate for themselves**, carried
  over unchanged because they are the scar tissue: **refactor and debt, 2**,
  never flows away (refactor sat at zero for five straight releases while
  every flow rule pointed elsewhere); **security and privacy, 1** and
  **performance and reliability, 1**, audit slots that never flow, where "no
  findings" is a valid outcome written in the ledger
  ([item-classes.md](./item-classes.md)). A floor is a minimum, not an
  allocation: any floored category may take more space on demand like any
  other.
- **Everything above the floors is allocated by demand**, per the procedure
  below. No category has a cap; unused space is offered to whoever has real
  work, never wasted.
- **Org self-improvement keeps its hard cap of 1** and gains nothing from
  free space: routing idle capacity into working on itself is exactly how an
  organization stops working for users. The admission bar lives in
  [item-classes.md](./item-classes.md).
- **Integrations and providers**: no slot; a once-per-engagement sweep
  ([roles/integrations-owner.md](./roles/integrations-owner.md)).

## How the product owner composes, at Phase 2

The categories survive as vocabulary and measurement (github issues, product
backlog, refactor and debt, ux and navigability, copy, docs and design
system, security, performance, org), not as budget rows. The product owner
fills the batch from every queue at once, under these rules, in this order:

1. **The floors are seated first**: the debt surgeon's slices for the
   refactor floor, then the two audit slots. An item that fails the filler
   bar is never forced in to fill a floor; the debt surgeon picks a
   different slice of code instead.
2. **The filler bar gates every admission.** Demand-driven allocation
   without it is an invitation to manufacture demand: every candidate, from
   any queue, must move something for a real user (the PO's charter in
   [roles/product-owner.md](./roles/product-owner.md) owns the bar), and the
   push-back right covers mandated items too. A weak item is refused, not
   resized.
3. **The front door is first among equals.** An issue-backed candidate that
   passes the bar is never displaced by an internal item of lower priority:
   issues are the owner's sanctioned steering channel and the side that has
   actually starved (seventeen owner issues once waited while a standing
   mandate spent every headline elsewhere). Inside the issue share, the
   author-weighting order below applies unchanged.
4. **Breadth breaks ties.** Between two candidates of equal standing, the
   one from the category with less representation in the batch so far wins.
   This is the intelligent balance made mechanical: the loudest queue wins
   on merit, never by default.
5. **The ux feed order stands, with one exception.** The ux category draws
   from the [product critic](./roles/product-critic.md)'s ordered list
   first, then the [design system steward](./roles/design-system-steward.md)'s
   named duplicates, never the PO's taste. The exception: a triggered
   surface-rethink spike ([item-classes.md](./item-classes.md) owns the
   trigger and the deliverable) is admitted ahead of both.
6. **Design-system work holds first claim on its grouping** when the
   steward's list is non-empty and the previous release's copy, docs and
   design-system merge units carried no design-system item; a departure is
   declared like any deviation.
7. **The anti-monoculture bound.** One category past half the batch is a
   declared, deliberate choice: the plan and the ledger's `composition:`
   line name which queues were outbid and why. v0.1.72's single-issue Linux
   release is the precedent for doing that honestly. It is never an
   accident, and the floors hold even then: a ux-heavy release still ships
   its refactor floor and both audits.

Every departure from these rules is declared in the plan and in the
ledger's `composition:` line. A silent deviation is a defect; a declared one
is the system working.

## The owner tunes it in one place

The `quota:` line in `~/.goodboy-autonomous/MANDATES.md` survives the new
model as overrides on the total and the floors, for example
`quota: total 12, issues 6, refactor 3`. `total N` resets the defended
total; a named category takes the given count as a floor for that
engagement, guaranteed space whenever its queue can fill it at the bar. The
line cannot lower the standing floors (refactor 2, the two audit slots) and
cannot raise the org cap: those are policy, not allocation. A line the lead
cannot read this way, or whose surrounding prose describes a policy these
docs no longer contain, is an owner-inbox escalation, and the defaults apply
until the owner fixes it. That last clause is the repair path for owner-only
MANDATES.md itself, which no agent may edit. No other surface sets the
budget, and no agent edits the line.

## The record: how the width was decided

The 12-slot shape carried a graduation gate back to the founding width: two
green engagements at the 12-slot shape plus a superseding ADR. **A green
engagement**, defined here because the gate's own review flagged the phrase
as undefined: every target release published; zero stop conditions; `main`
never left red; no undeclared composition deviation; no ceiling breach; no
unconditional role missed without the delivery lead catching it before
publication. An infrastructure or harness interruption recovered per its
ladder ([infrastructure.md](./infrastructure.md),
[watchdogs.md](./watchdogs.md)) does not disqualify.

That gate was not met. Exactly one engagement has run the 12-slot shape: the
2026-08-06/07 engagement ran the retired 60/40 batch model. The owner
widened anyway, by direction, on 2026-08-09, which is his to do; [ADR
0003](../adr/0003-compose-to-demand-at-a-defended-total.md) is the record,
including what the one wide outing actually showed (an unconditional role
lost in both releases, parent-addressing failures, a captain killed by its
host) and the fixes that ship alongside the widening.

**The ratchet-back is the safeguard with an actor.** After any release at
this shape that breaches its ceiling, trips a stop condition, or leaves
`main` red, the delivery lead runs the next release at 12 slots and 7 merge
units and says so in the ledger header. A ratcheted release that is green by
the definition above returns the shape to 20 for the release after it.

## Slots are sized; slots are not PRs

Every slot carries a size, assigned by the product owner and checked by the
head of engineering:

- **S**: localized, often non-code (a copy pass, one doc, one token).
- **M**: one contained feature or fix.
- **L**: cross-cutting, a migration, a protocol, anything whose footprint
  crosses shared hotspots.

Hard ceilings, none of them owner-tunable through the `quota:` line:

- **At most 4 L slots per release.** L items are the ones that collide in
  footprints and eat verifier time; four is what the serial merge lane has
  actually carried. Depth past four L items serializes into the next
  release rather than widening this one.
- **At most 10 merge units (PRs) per captain leg, at most 20 per release.**
  The serial merge lane survives every speedup: merge one PR, poll `main`'s
  own CI green, merge the next; two PRs each green alone have broken `main`
  together twice, and the lane is what pays for the parallel build lanes.
  Its price at this width is known and accepted: `main`'s CI ran a 6.1
  minute median over its last 12 successful runs, so twenty serial merges
  cost about two hours of merge-lane wall clock against a release that runs
  several times that end to end. CI time was never the binding constraint;
  **one captain's context across the phases is**, so the number that grows
  is captains, never merge concurrency. A reconciled plan past 10 merge
  units is carried by **two sequential captain legs on the same version**:
  the first leg builds, verifies and merges at most 10 units, flushes its
  deciding artifacts to scratch as each phase completes (the captain
  prompt's disk discipline), runs no Phase 7, and reports
  `handoff (composition)`; the delivery lead spawns the successor with the
  predecessor-state block; only the final leg cuts the draft. Legs are
  sequential, never concurrent: `main` stays one resource. A handoff is not
  a retry and burns no failure budget. Twelve slots never meant twelve PRs
  and twenty do not mean twenty: **S slots of the same class group into one
  PR** (all copy fixes in one, all doc fixes in one), keeping per-item
  provenance in the PR body.
- **At most one class A or B data item per release** (the classes in
  [safety.md](./safety.md)). Each one costs an owner question, a dedicated
  schema challenge and a second verifier; stacking two in one release
  doubles the most expensive and least parallelizable work in the loop.
- An **experiment** ([item-classes.md](./item-classes.md)) occupies the
  slot of whatever category its change belongs to. There is no experiment
  budget row, so the class cannot become a filler channel.
- The suite concurrency cap and the serialized merge lane are owned by
  [release-loop.md](./release-loop.md) and unchanged by any of this.

## The merge queue, when the owner enables it

GitHub's merge queue batches verified PRs, tests them in combination, and
lands only what passes together, which removes the exact failure the serial
lane pays for (green alone, red together) instead of trading against it.
It is not enabled on this repository, and enabling it is repository
configuration: the owner's action, never an agent's. It costs a
`merge_group` trigger on both required workflows plus the branch-protection
switch. Until it exists, the serial lane above is the rule and nothing
degrades. Once it exists, Phase 6 changes shape per
[release-loop.md](./release-loop.md): verified PRs enqueue in merge order
and the queue does the combining, with the two-repair drop rule unchanged.
The recommendation stands in the owner inbox; this rule is written to
survive either answer.

## The tags every item carries

Every work item carries three tags from the moment it enters the plan, plus
its class per [item-classes.md](./item-classes.md) and its size above:

- **Provenance**: `issue #N` (the item exists because a human filed an
  issue) or `internal` (an audit, the backlog, or the org's own process
  surfaced it). Set at plan time, never reclassified: an internal item that
  later turns out to close an issue stays internal, so the count cannot be
  laundered by stamping `Closes #N` onto debt work. The closing-keyword
  rule itself is owned by [issue-triage.md](./issue-triage.md).
- **Author class**, for issue-backed items: owner or contributor, read from
  the GitHub record per the trust model.
- **Data class**: reversible or irreversible, per the gate in
  [safety.md](./safety.md), which owns the gate mechanics. The one fact
  composition owns: the item occupies a normal slot and counts against its
  category whether or not it merges this release, because composition
  measures what was committed, not what survived.

One marker rides on top of the tags: an item originating from the design
system steward's named-duplicates list carries `design-system` in the plan,
the PR body and the report, so the steward's sunset clause and the owner can
count work that would otherwise ship invisibly through refactor and fix
slots ([roles/design-system-steward.md](./roles/design-system-steward.md)
owns the clause).

Composition is measured over work items at plan time, never over merged PRs.
PR counts are the metric this organization already refuses to steer by (see
AUTONOMY.md): a verifier dropping a PR later changes what shipped, not what
was composed, and the product owner answers only for the latter.

## Precedence

Highest first: safety, explicit mandates, the product owner's filler ban and
push-back right, the composition rules above, the area rotation. A mandate
that eats slots beats the rules. An item that fails the filler bar (it must
move something for a real user, per the PO's charter in
[roles/product-owner.md](./roles/product-owner.md)) is never forced in to
satisfy a floor or the total: a mandated weak item is exactly the filler the
PO exists to refuse. A confirmed release blocker outranks the rules and
takes a slot from whichever category it must, declared like any deviation.

## Author weighting, inside the issue share

Issue-backed candidates are ordered by, in this order:

1. **Priority band** (`p0` > `p1` > `p2` > `p3`). Priority describes user
   impact and is set at triage time; it is never inflated to smuggle
   authorship past this step, because authorship gets its own step next.
2. **Aging promotion.** An accepted contributor item skipped by two
   consecutive batches outranks author weight in the third: it beats owner
   items of the same or lower priority, never a higher one. One skip is
   prioritization, two is a pattern, and the third batch acts. Triage keeps
   the skip count on the backlog entry.
3. **Author.** The owner's issue outranks a contributor issue of the same
   priority. This is the trust model applied to composition, not a wall:
   contributor work is protected by the aging step above and by triage's
   no-issue-goes-dark contract.
4. **Age.** Older accepted date first.

That aging step is the contributor floor. Not a reserved slot, which would
force weak work in thin queues, but a starvation bound: an actionable
contributor item cannot be passed over indefinitely on author weight alone,
and every skip is visible on the issue thread through the per-release triage
sweep, with the reason it was passed over.

Aging deliberately protects contributor items only. An owner item can sit
skipped forever without a counter promoting it, because the owner already
has a faster lever for anything he wants sooner: the mandates. That
asymmetry is the design, not a gap in it.

One bound on waiting, from the follow-through record
([roles/historian.md](./roles/historian.md)): an item blocked on an owner
answer gets its premise re-tested against the code before it is deferred a
third time. Four items once sat blocked three to four cycles each on
premises that were false, all of them unblocked by reading the code instead
of waiting; "held for the owner" had become a place items went to stop being
examined.

## Mandate decay

A standing mandate the product owner has pushed back on, in writing, in
**three batches without an owner answer suspends itself**. The three need
not be consecutive: the count is the raw number of unanswered push-backs the
ledger records for that mandate, which is what the delivery lead can
actually derive. One push-back is a question, two is a disagreement, three
unanswered is a deadlock, and re-litigating a deadlock every cycle burns
reasoning-tier tokens to produce no new information; this organization has
argued one mandate from scratch four cycles running with nothing to show for
it.

Suspension is loud, never quiet:

- The suspension is announced in the cycle's report, in the engagement
  report, and in a dated owner-inbox entry that names the mandate, the three
  push-backs, and the single sentence from the owner that would settle it.
- A suspended mandate stops binding the product owner and stops being
  re-costed. Every subsequent engagement report lists it under
  `suspended-mandates:` until the owner resolves it.
- Only the owner reactivates it, by editing `MANDATES.md`. Any edit that
  touches the mandate resets its push-back count to zero: a mandate the
  owner has re-affirmed is live direction again, and earns three fresh
  push-backs before it can suspend again.
- The delivery lead keeps the count, from the ledger's push-back records,
  and writes the current count into every captain's brief so no captain
  re-argues a settled or suspended mandate.

Decay applies to mandates only. Safety rules are not mandates: they answer
to [safety.md](./safety.md) alone and never decay.
