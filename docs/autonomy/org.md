# Autonomy: the organization

Part of the [autonomy cluster](../autonomy.md). This file owns the org chart,
the departments, who can block whom, and how a disagreement between peers is
resolved. What each role decides lives in its charter under
[roles/](./roles.md); the rules that bind every role live in
[roles.md](./roles.md); the floor everyone answers to is
[safety.md](./safety.md).

The org exists to ship, and every box on the chart costs tokens. A role earns
its place by owning a decision nobody else can make; frontend and backend are
not roles, they are builder competencies. Roles split into **standing** (runs
every release) and **on-call** (runs only when the batch touches its
surface), because an org that spawns everyone every time pays for attendance,
not judgment. That split priced per release is the derived cost ceiling,
owned by [cost-ceiling.md](./cost-ceiling.md).

## Org chart

```
delivery lead (one per engagement; length owned by the continuous-delivery skill)
├── release captain (one per release, or two sequential legs per composition.md)
│   ├── archaeologists (3-5, cheap, read-only)
│   ├── product owner (decides the release)
│   ├── head of engineering (feasibility and sequencing)
│   ├── challenger (attacks the plan cold)
│   ├── product critic (walks the shipped app)
│   ├── external scout (on-call: industry precedent)
│   ├── scouts (cheap, pressure-test the plan)
│   ├── builders (one per merge unit, in waves)
│   ├── debt surgeon (standing: owns the refactor floor)
│   ├── verifiers (one per PR, never the builder)
│   ├── test architect (judges whether the suite means anything)
│   ├── qa explorer (walks the built app between PRs)
│   ├── design system steward (on-call: UI items)
│   ├── ux designer (on-call: UI items)
│   ├── brand steward (on-call: imagery and moments)
│   ├── voice steward (every user-facing word)
│   ├── reliability owner (performance numbers and budgets)
│   ├── integrations owner (on-call plus one sweep per engagement)
│   ├── security officer (standing sweep, merge veto)
│   └── watchdog (periodic, checks siblings)
├── issue triage officer (periodic loop)
│   └── responder (sub-agent of the issue-triage officer, not a chartered role)
└── historian (end of release: memory and follow-through; spawned by the
    lead after the triage sweep)
```

The lead has no watchdog of its own: it inspects its captains directly, from
git and the PR list, per [watchdogs.md](./watchdogs.md).

## Departments

Departments are a reading aid and a verification map, not a management layer:
no department has a head that speaks for it, and coordination stays with the
parent. What they encode is who verifies whom, because no role reviews its
own work and the verifier must come from outside the author's box.

- **Delivery**: delivery lead, release captain, watchdog. Owns sequencing,
  publication, liveness.
- **Product**: product owner, product critic, external scout, historian.
  Owns what is worth building and what the org learned from shipping it.
- **Engineering**: head of engineering, builder, debt surgeon, scout,
  archaeologist, reliability owner, integrations owner. Owns whether the code
  can carry the plan and whether it still does after.
- **Quality**: challenger, verifier, test architect, qa explorer. Owns the
  adversarial half: assume the plan is wrong, assume the build is broken,
  assume the suite is lying, assume the app regressed.
- **Design**: ux designer, design system steward, brand steward. Owns flow,
  primitives, and what the eye sees before the text is read.
- **Communication**: voice steward, issue triage officer. Owns every word a
  human reads, in the app and on the threads.
- **Security**: security officer. Owns the surfaces data can leave through.

## Who can block whom

Blocking rights are deliberately few, because every block is a stall the
parent must resolve. The full definition of each block lives in the blocking
role's charter; this table is the map.

| Block                          | Holder                                                | Scope                                                                              |
| ------------------------------ | ----------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Merge of a PR                  | [verifier](./roles/verifier.md)                       | its own PR; verdict outranks builder report and green CI                           |
| Merge of any PR                | [security officer](./roles/security-officer.md)       | its perimeter; overrides the verifier for that class, always written and motivated |
| Merge of a class B data change | the owner                                             | per the [irreversible-data gate](./safety.md); silence never ships it              |
| An item entering the batch     | [product owner](./roles/product-owner.md)             | the filler ban and push-back right in its charter                                  |
| An item entering the batch     | [head of engineering](./roles/head-of-engineering.md) | infeasibility only, stated with what would make it feasible                        |
| A user-facing string shipping  | [voice steward](./roles/voice-steward.md)             | copy against [tone-of-voice.md](../tone-of-voice.md)                               |
| An image or moment shipping    | [brand steward](./roles/brand-steward.md)             | visual identity, inside the rails in its charter                                   |
| Publication                    | [delivery lead](./roles/delivery-lead.md)             | the only role that publishes, ever                                                 |

Everything not on this table is advice, not a block. The challenger, the
product critic, the test architect and the qa explorer produce findings the
parent weighs; they block nothing directly, and that is the design: a role
that both finds and blocks marks its own homework.

## Resolving a disagreement between peers

Peers never negotiate with each other; every role works alone and coordination
is the parent's job ([roles.md](./roles.md)). So a disagreement is always two
written positions on the parent's desk, and it resolves in this order:

1. **Policy wins.** If one position rests on this cluster or on
   [safety.md](./safety.md) and the other on preference, there is nothing to
   reconcile.
2. **Evidence wins.** A position citing a file, a line, a run or an issue
   beats a position citing experience. A finding without a pointer is
   discarded, not escalated; this org has held items for three cycles on
   premises nobody re-tested, and pointer-free claims are how that starts.
3. **The safer scope wins** when policy and evidence do not settle it, and
   the disagreement is recorded in the ledger. This is the existing
   captain-reconciles rule from the challenger's charter, generalized: one
   release recorded exactly this on a held data change, and the record later
   proved the cautious side had been arguing from a false premise, which only
   the record made discoverable.
4. **A veto ends the argument** for the classes that have one (see the table
   above), and the veto holder answers for it: the challenger reviews a
   security block for proportionality, the delivery lead reviews the use of
   every veto in its release review.

A disagreement that survives all four is an owner-inbox entry, and the
machine continues with what is unambiguous, per the push-back protocol in
[safety.md](./safety.md).
