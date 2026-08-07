# Autonomy: composition

Part of the [autonomy cluster](../autonomy.md). This file owns what goes into
a release: the batch, the split between issue-backed and internal work, how
authors are weighed inside the issue share, and what happens to standing
direction nobody answers. The trust model that weighs authors in triage lives
in [safety.md](./safety.md); the phases that consume the batch live in
[release-loop.md](./release-loop.md).

## The batch

The unit of commitment is the **batch**: the 3 to 6 work items the product
owner commits to one release after the challenge round. The release is the
shipping vehicle; the batch is what the organization takes on, consumes,
ships, and only then replaces with the next one. There is no timebox: a batch
ends when its release is drafted, not when a clock says so, because wall
clock has never been the binding constraint here; tokens and attention are.

Every work item carries three tags from the moment it enters the plan:

- **Provenance**: `issue #N` (the item exists because a human filed an
  issue) or `internal` (it exists because an audit, the backlog, or the
  org's own process surfaced it). Set at plan time, never reclassified: an
  internal item that later turns out to close an issue stays internal, so
  the count cannot be laundered by stamping `Closes #N` onto debt work.
- **Author class**, for issue-backed items: owner or contributor, read from
  the GitHub record per the trust model.
- **Data class**: reversible or irreversible, per the gate in
  [safety.md](./safety.md). Either class files its owner-inbox entry before
  any builder spawns, informational for a reversible item and a
  merge-holding question for an irreversible one; it still occupies a
  normal batch slot and counts against its share whether or not it merges
  this release, because composition measures what was committed, not what
  survived.

Composition is measured over work items at plan time, never over merged PRs.
PR counts are the metric this organization already refuses to steer by (see
AUTONOMY.md): a verifier dropping a PR later changes what shipped, not what
was composed, and the product owner answers only for the latter.

## The quota

Default composition target: **60% issue-backed, 40% internal**, applied to
each batch, fractional slots rounding toward the issue share. A five-item
batch is three issue-backed items and two internal ones; a three-item batch
is two and one.

Why 60/40. Issues are the owner's sanctioned steering channel and the side
that has actually starved: seventeen owner issues once waited while a
standing mandate spent every headline elsewhere. But the internal share
earns its 40% too: audit-driven work has caught defects no issue ever named,
including a cost engine that recorded zero spend for three providers while
looking fully configured. 60/40 keeps the front door first without going
blind to what only the audit can see. What would change the number: a
sustained empty issue queue (the share flows, see below), or two consecutive
releases where an audit-found release blocker was deferred for quota reasons
(then the internal share is too small and the lead says so in the report).

**The owner tunes it in one place**: a `quota:` line in
`~/.goodboy-autonomous/MANDATES.md`, for example
`quota: 8 issues / 2 internal per 10`. When the line exists it replaces the
default; when it does not, the default above applies. No other surface sets
it, and no agent edits it. The line is read as a ratio, not as a batch size:
`8 / 2 per 10` against a four-item batch is three issue-backed items and
one internal, rounded toward the issue share like the default. A line the
lead cannot read as a ratio is an owner-inbox escalation, and the default
applies until the owner fixes it.

The quota is a target with declared deviations, not a hard constraint:

- **Precedence, highest first**: safety, explicit mandates, the product
  owner's filler ban and push-back right, the quota, the area rotation. A
  mandate that eats slots beats the quota. An item that fails the filler bar
  (it must move something for a real user, per the PO's charter in
  [roles.md](./roles.md)) is never forced in to satisfy a ratio: a
  quota-mandated weak item is exactly the filler the PO exists to refuse.
- **Empty queues flow.** When a share's queue holds nothing that passes the
  filler bar, the unfilled share flows to the other source, and the plan
  states the shortfall and why.
- **A release blocker outranks the quota.** A confirmed regression takes a
  slot from whichever share it must.
- Every deviation is declared in the plan and lands in the ledger's
  `composition:` line. A silent deviation is a defect; a declared one is the
  system working.
- When accepted, unshipped issues pile past ten, the delivery lead may
  declare the next batch a **queue-drain batch**: composed entirely from
  issues, said so in the ledger, then back to the target.

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

## Mandate decay

A standing mandate the product owner has pushed back on, in writing, in
**three batches without an owner answer suspends itself**. The three need
not be consecutive: the count is the raw number of unanswered push-backs the
ledger records for that mandate, which is what the delivery lead can
actually derive. One
push-back is a question, two is a disagreement, three unanswered is a
deadlock, and re-litigating a deadlock every cycle burns reasoning-tier
tokens to produce no new information; this organization has argued one
mandate from scratch four cycles running with nothing to show for it.

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
