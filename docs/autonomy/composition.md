# Autonomy: composition

Part of the [autonomy cluster](../autonomy.md). This file owns what goes into
a release: the slot budget, the categories and how unspent slots flow, slot
sizes and the merge-unit ceiling, how authors are weighed inside the issue
share, and what happens to standing direction nobody answers. What each item
class delivers and how it is verified is owned by
[item-classes.md](./item-classes.md); the trust model that weighs authors is
in [safety.md](./safety.md); the waves that consume the batch are in
[release-loop.md](./release-loop.md).

## The batch is 20 slots

The unit of commitment is the **batch**: the slots the product owner commits
to one release after the challenge round. The release is the shipping
vehicle; the batch is what the organization takes on, consumes, ships, and
only then replaces. There is no timebox: a batch ends when its release is
drafted, because wall clock has never been the binding constraint here;
tokens and attention are.

The old batch was 3 to 6 items with a single 60/40 issue/internal quota.
That shape shipped, but it shipped narrow: one engagement produced 24 work
PRs across five releases with 46% issue-backed against a 60% target, and
zero pure-refactor items, zero docs items, zero org items, because a single
two-way ratio has no way to say "and the surround gets touched too". The
replacement is a **budget of 20 slots allocated across categories**:

| Category                      | Slots  | Notes                                                                                      |
| ----------------------------- | ------ | ------------------------------------------------------------------------------------------ |
| github issues                 | 5      | a ceiling, not a commitment: everything accepted at triage that passes the filler bar      |
| product backlog               | 3      | features and fixes surfaced by audits and the backlog                                      |
| refactor and debt             | 3      | **floor of 2, never flows away**: the gap that motivated this budget                       |
| ux and navigability           | 2      | drawn from the [product critic](./roles/product-critic.md)'s list, not from the PO's taste |
| copy and tone of voice        | 1      | user-facing strings against [tone-of-voice.md](../tone-of-voice.md)                        |
| design system                 | 1      | tokens, primitives, duplicates to collapse                                                 |
| docs and website truthfulness | 1      | docs that lie about the shipped app                                                        |
| security and privacy          | 1      | always spent: with no findings, the deliverable is the report                              |
| performance and reliability   | 1      | same, with a measurement, never an impression                                              |
| integrations and providers    | 1      | the surfaces facing the outside world                                                      |
| org self-improvement          | 1      | hard cap 2; admission bar in [item-classes.md](./item-classes.md)                          |
| **total**                     | **20** |                                                                                            |

The 60/40 number retires; its principle survives: the front door comes
first. Issues remain the largest single allocation because they are the
owner's sanctioned steering channel and the side that has actually starved
(seventeen owner issues once waited while a standing mandate spent every
headline elsewhere).

## Flow rules, when a queue is empty

- Unspent issue slots flow to **refactor first, then product backlog**.
  Never to org self-improvement: routing idle capacity into working on
  itself is exactly how an organization stops working for users.
- **The refactor floor of 2 never flows away.** An item that fails the
  filler bar is not forced in to fill the floor; the debt surgeon picks a
  different slice of code instead. The floor exists because refactor was at
  zero for five straight releases while every flow rule pointed elsewhere.
- **Security and performance never flow.** They are audit slots, and "no
  findings" is a valid outcome written in the ledger
  ([item-classes.md](./item-classes.md)).
- Every departure from the table is declared in the plan and in the
  ledger's `composition:` line. A silent deviation is a defect; a declared
  one is the system working. **More than three deviated categories is a
  defect, not a choice**: at that point the budget is fiction and the plan
  should say why.
- When accepted, unshipped issues pile past ten, the delivery lead may
  declare a **queue-drain batch**: every flowable slot reallocated to
  issues, said so in the ledger, then back to the table. The floor and the
  audit slots still hold.

The issue queue has not historically supported even five slots: for four of
five releases in the last engagement it held almost nothing buildable,
mostly waiting on owner answers. Five is therefore a ceiling; if the owner
wants it full, the lever is answering the inbox, not raising the number.

## The owner tunes it in one place

The `quota:` line in `~/.goodboy-autonomous/MANDATES.md` survives the new
model as **per-category overrides**, for example
`quota: issues 8, refactor 4, copy 0`. Named categories take the given slot
count; unnamed ones keep the table; the total stays 20, absorbed by the
flow-eligible categories. Floors and caps still bind: the refactor floor of
2, the org cap of 2, and the never-flowing audit slots are policy, not
allocation, and the line cannot lower them. A line the lead cannot read this
way, or whose arithmetic cannot reach 20 without breaking a floor, is an
owner-inbox escalation, and the table applies until the owner fixes it. No
other surface sets the budget, and no agent edits the line.

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
  actually carried.
- **At most 10 merge units (PRs) per release.** The bottleneck was never
  deciding, it is the serial merge lane with `main`'s CI polled green
  between merges, plus one captain's context across seven phases. Twenty
  slots do not mean twenty PRs: **S slots of the same class group into one
  PR** (all copy fixes in one, all doc fixes in one), keeping per-item
  provenance in the PR body. If the 10-PR ceiling saturates two releases
  running, the move is a second sequential captain on the same version,
  never more concurrent builds: `main` stays one resource.
- **At most one class A or B data item per release** (the classes below).
  Each one costs an owner question, a dedicated schema challenge and a
  second verifier; stacking two in one release doubles the most expensive
  and least parallelizable work in the loop.
- The build concurrency cap of 3 and the serialized merge lane are owned by
  [release-loop.md](./release-loop.md) and unchanged by any of this.

## The tags every item carries

Every work item carries three tags from the moment it enters the plan, plus
its class per [item-classes.md](./item-classes.md) and its size above:

- **Provenance**: `issue #N` (the item exists because a human filed an
  issue) or `internal` (an audit, the backlog, or the org's own process
  surfaced it). Set at plan time, never reclassified: an internal item that
  later turns out to close an issue stays internal, so the count cannot be
  laundered by stamping `Closes #N` onto debt work.
- **Author class**, for issue-backed items: owner or contributor, read from
  the GitHub record per the trust model.
- **Data class**: reversible or irreversible, per the gate in
  [safety.md](./safety.md). Either class files its owner-inbox entry before
  any builder spawns, informational for a reversible item and a
  merge-holding question for an irreversible one; it still occupies a normal
  slot and counts against its category whether or not it merges this
  release, because composition measures what was committed, not what
  survived.

Composition is measured over work items at plan time, never over merged PRs.
PR counts are the metric this organization already refuses to steer by (see
AUTONOMY.md): a verifier dropping a PR later changes what shipped, not what
was composed, and the product owner answers only for the latter.

## Precedence

Highest first: safety, explicit mandates, the product owner's filler ban and
push-back right, the slot budget, the area rotation. A mandate that eats
slots beats the budget. An item that fails the filler bar (it must move
something for a real user, per the PO's charter in
[roles/product-owner.md](./roles/product-owner.md)) is never forced in to
satisfy an allocation: a budget-mandated weak item is exactly the filler the
PO exists to refuse. A confirmed release blocker outranks the budget and
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
