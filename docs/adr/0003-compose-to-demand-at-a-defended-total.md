# 0003. Compose releases to demand under a defended total of 20

status: accepted
date: 2026-08-09
owner: the repo owner, whose direction this records; drafted for him by the
org architect under the head of engineering's structural-decision clause
reviewed-by: the challenger, on the PR that lands this record, verdict on
the PR thread; plus the product owner as the bound role, owed by the first
release composed under this model, in the dated-obligation shape ADR 0001's
amendment established

## Context

Fixed per-category slots failed in both directions, on record. Starvation:
before the refactor floor of 2, refactor sat at zero for five consecutive
releases while every flow rule pointed elsewhere. Monoculture: ux was capped
at 1, so a release facing twenty real ux items would ship one and defer
nineteen, and no mechanism noticed. The owner's direction of 2026-08-09:
roughly 20 PRs per release, no fixed per-category numbers, unused space
taken by whoever else has something important to merge, an intelligent
balance instead of arithmetic.

The merge-unit ceiling of 7 was defended on merge-lane cost and captain
context. The delivery lead measured the first: `main`'s own CI at a 6.1
minute median over its last 12 successful runs, pricing twenty serial
merges at about two hours against a v0.1.76 that ran roughly 4.5 hours end
to end. CI time does not justify a ceiling of 7. Captain context does bind,
and the document's own answer, a second sequential captain when the ceiling
saturates two releases running, had its condition met at v0.1.75 (7 of 7
merge units) and v0.1.76 (7 of 7) and never fired, because the rule named
no actor and no moment.

The graduation gate back to the founding width required two green
engagements at the 12-slot shape. It was not met: the 2026-08-06/07
engagement ran the retired 60/40 batch model, so exactly one engagement has
run 12 slots, and "green engagement" was defined nowhere, as ADR 0001's own
review had flagged. The owner decided to widen anyway, which outranks the
gate; this record refuses to pretend the gate fired.

## Decision

Replace composition.md's fixed-slot model:

- **A defended total of 20 slots**, composed by the product owner from what
  the queues actually hold. A smaller batch is correct when the queues are
  thin at the filler bar; a weak item is never admitted to reach the number.
- **Floors survive for the categories that cannot advocate for
  themselves**: refactor and debt 2, security 1, performance 1, all
  never-flowing; org self-improvement stays capped at 1.
- **Everything above the floors allocates by demand** through the filler
  bar, with the front door first among equals, a breadth tiebreak between
  candidates of equal standing, and an **anti-monoculture bound**: one
  category past half the batch is a declared choice in the plan and the
  ledger, never an accident.
- **Merge units: at most 10 per captain leg, at most 20 per release**,
  carried by up to two sequential captain legs on the same version, split
  at the Phase 3/4 boundary where the ceiling derivation already happens.
  The first leg merges its units, flushes each phase's deciding artifact to
  scratch as it completes, and reports `handoff (composition)`; the
  delivery lead spawns the successor; only the final leg runs Phase 7. The
  serial merge lane and `main` as one resource are unchanged.
- **GitHub's merge queue is recommended to the owner** as the structural
  fix for the green-alone-red-together class; it is repository
  configuration, so the rule degrades gracefully while it is absent.

This record supersedes the composition decision of
[0001](./0001-expand-the-delivery-org.md): the slot budget, the merge-unit
ceiling, and the graduation path. 0001's other decisions (item classes, the
roles, the impact bar, waves as a mechanism, the follow-through record, the
run log, this directory) stand, and 0001 carries a third amendment pointing
here.

## Consequences

The widening happens against an unmet gate, by owner direction, and the
record says so. The single 12-slot engagement lost an unconditional role in
both releases, suffered repeated parent-addressing failures, and had one
captain killed by its host, so widening enlarges the blast radius of known
defects; the safeguards ride in the same change: ADR 0004's harness class
and child lifecycle, the captain prompt's disk discipline that the leg
handoff leans on, and composition.md's ratchet-back (a wide release that
breaches its ceiling, trips a stop condition, or leaves `main` red sends
the next release back to 12 slots and 7 merge units, declared by the
delivery lead in the ledger header). Twenty serial merges cost about two
hours of merge-lane wall clock; that price is accepted here, on the record.
Each captain leg carries no more context than the tested shape did.

## Alternatives considered

- **Fixed slots with bigger numbers**: rejected; it reproduces both failure
  modes at a new scale, and the owner rejected fixed numbers explicitly.
- **Pure demand with no floors**: rejected; five releases of refactor at
  zero is the record of what happens to categories that cannot advocate for
  themselves, and demand without the filler bar invites manufactured
  demand.
- **One captain carrying 20 merge units**: rejected; context, not CI, is
  the binding constraint, and the cluster's own answer (a second sequential
  captain) was already written. It failed for want of an actor, not for
  being wrong.
- **More concurrent merging**: rejected; two PRs each green alone have
  broken `main` together twice, and `main` is one resource.
- **Waiting for the graduation gate to be met honestly**: overruled by the
  owner, which is his to do. This record, the named safeguards and the
  ratchet-back are what honesty demands instead of the wait.
