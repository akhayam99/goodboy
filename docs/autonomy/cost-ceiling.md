# Autonomy: the cost ceiling

Part of the [autonomy cluster](../autonomy.md). This file owns the
per-release spawn ceiling: the role classification that feeds it, the
derivation formula, the repair margin, who declares what, and what stands
outside the ceiling. The breach rule (what a breach is and what it costs)
is owned by [release-loop.md](./release-loop.md); the run-log unit the
ceiling is stated in by [visibility.md](./visibility.md); the per-tier
history it is checked against by `BASELINES.md`, defined in the
continuous-delivery skill.

## Why derived, not constant

The ceiling used to be a constant: 50 spawns per release, at most 8 on the
reasoning tier, declared by the delivery lead at preflight before any batch
existed. Counting the minimum roster of a 12-slot, 2-wave release against
the charters shows the constant sat at the floor of correct behaviour: the
unconditional roster below is 11 spawns, archaeology adds 3 to 5, scouting
roughly one per plan item, building up to 7, verification at least one per
merge unit, and a watchdog every ~30 minutes across a multi-hour release
added 8 more. That is ~50 before a single repair, a second data verifier,
or one re-verify after a fix. A ceiling that correct behaviour breaches on
the first run teaches every agent the rule is decorative, which is worse
than no ceiling at all.

A constant is also the wrong shape. The roster a release needs is a
function of what the batch contains: a docs-and-copy batch needs no ux
designer and no design-system steward; a batch with no schema change needs
no second data verifier. Derived from the composed batch, a breach means
something real: the release is spawning roles its batch never called for,
or burning far more repair than history says it should.

## Who declares, who computes

The captain knows the batch and the lead owns cost policy, and a number
with two declarers is the two-writers defect this cluster has already paid
for on state files ([roles.md](./roles.md)). The split gives each party
one thing to declare:

- **The delivery lead declares the repair margin**, once per engagement at
  preflight, per tier, from the per-tier actuals carried in `BASELINES.md`
  (the repair share: repair agents, re-verifies, ladder replacements).
  With no history, the default margin is 25 percent of the derived roster
  per tier, rounded up. The margin and the previous release's per-tier
  actuals travel in the captain's brief as `{{ceiling_inputs}}`.
- **The release captain computes the ceiling**, once per release, at the
  Phase 3/4 boundary: after scouting settles the plan and before the first
  builder spawns, because merge units, groupings and conditional triggers
  are known only then. The derivation goes to the captain's scratch dir;
  the result goes on its report's `ceiling:` line.
- **The delivery lead audits the derivation** at its report-verification
  step, against the release's run log, never against the report alone.

One margin, one declarer; one ceiling, one computer; neither writes the
other's part.

## The formula

Ceiling = unconditional roster + mechanical terms + triggered conditional
roster + repair margin, stated in **per-tier spawn counts**, the unit the
run log already records ([visibility.md](./visibility.md)); token totals
are recorded nowhere, and a ceiling in a quantity nobody measures is void.
The ceiling counts the captain's children only, never the captain itself;
each pass of a twice-run role counts separately. At computation time the
Phase 1 to 3 terms are already actuals in the run log and enter the
derivation as such.

### Unconditional roster, every release

Eleven spawns, five on the reasoning tier. Each row's full charter is the
definition; this table carries only the count and the reason the spawn
never gains a trigger.

| Role (pass)                                                   | Tier      | Count | Why unconditional                                                                                                                                                                                           |
| ------------------------------------------------------------- | --------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [product owner](./roles/product-owner.md)                     | reasoning | 1     | there is no batch without it                                                                                                                                                                                |
| [head of engineering](./roles/head-of-engineering.md)         | reasoning | 1     | feasibility errors were found by builders mid-wave until this pass existed                                                                                                                                  |
| [challenger](./roles/challenger.md)                           | reasoning | 2     | plan attack and notes-and-impact review; one strong opinion is not a review                                                                                                                                 |
| [product critic](./roles/product-critic.md)                   | reasoning | 1     | covers a demonstrated omission: five consecutive releases nobody ran the built app (the ledger's engagement record); when this was conditional in practice, that was the result, and a trigger puts it back |
| [reliability owner](./roles/reliability-owner.md)             | mid       | 1     | same omission, the measured half; its charter states that a conditional spawn recreates the gap                                                                                                             |
| [security officer](./roles/security-officer.md), release pass | strong    | 1     | before the role, nobody read any diff for what leaves the machine; a trigger re-creates the unowned diff                                                                                                    |
| [qa explorer](./roles/qa-explorer.md)                         | mid       | 1     | the seam between two green PRs exists in every release; per-PR verification cannot see it                                                                                                                   |
| [voice steward](./roles/voice-steward.md), standing pass      | mid       | 1     | release notes exist every release and nobody else reads them against the tone doc                                                                                                                           |
| [test architect](./roles/test-architect.md)                   | strong    | 1     | the refactor floor guarantees code in every batch, so the suite verdict always has ground; sabotage survivors recurred across releases when nobody owned it                                                 |
| [debt surgeon](./roles/debt-surgeon.md)                       | strong    | 1     | standing by the refactor floor of 2 that never flows ([composition.md](./composition.md)): a budget rule, not a batch trigger                                                                               |

The product critic, the reliability owner and the security officer stay
unconditional no matter what the batch contains. They exist to cover a
demonstrated omission, and an omission is exactly what no batch reading
ever surfaces: the five-release nobody-ran-the-app gap happened while
running the app was everyone's implicit option and nobody's mandate. A
trigger drawn from the batch would put all three back where they were.

### Mechanical terms, from the batch

Functions of item count and merge units, never fixed numbers:

- **Archaeologists**: 3 to 5, per the charter; actuals by computation time.
- **Scouts**: one per surviving plan item; actuals by computation time.
- **Builders**: one per merge unit ([composition.md](./composition.md)
  owns the merge-unit ceiling), minus the units the debt surgeon authors
  itself.
- **Verifiers**: one per merge unit. The voice steward filling the
  copy-class verifier slot counts here, not a second time in the
  unconditional roster.

### Conditional roster, by trigger

Spawned, and counted, only when the batch pulls the trigger; a fuller
trigger definition lives in each charter, and a conflict between this
table and a charter is a bug in this table.

| Role (pass)                                                   | Tier      | Trigger from the batch                                                                                                                                                                       |
| ------------------------------------------------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [ux designer](./roles/ux-designer.md)                         | reasoning | a UI item or a new surface                                                                                                                                                                   |
| [design system steward](./roles/design-system-steward.md)     | mid       | UI items                                                                                                                                                                                     |
| [brand steward](./roles/brand-steward.md)                     | mid       | imagery or mascot work in the batch, or an approaching calendar moment (the one trigger not fully batch-derived; the calendar half is the captain's judgment call, stated in the derivation) |
| [external scout](./roles/external-scout.md)                   | mid       | a design decision, a new surface, or a spike likely to end in an ADR                                                                                                                         |
| [security officer](./roles/security-officer.md), Phase 2 pass | strong    | an item touching the security perimeter (the officer's charter owns the perimeter)                                                                                                           |
| second data [verifier](./roles/verifier.md)                   | mid+      | a class A or B data item (at most one per release, [composition.md](./composition.md))                                                                                                       |
| [integrations owner](./roles/integrations-owner.md)           | mid       | the engagement's one sweep (`{{carries_integration_sweep}}` yes), or a provider-touching batch                                                                                               |

### Outside the ceiling

- **Watchdogs.** Cheap, periodic, and load-bearing for liveness: their
  cadence follows wall clock ([watchdogs.md](./watchdogs.md)), not the
  batch, so counting them turns a slow afternoon into an apparent
  overspend and punishes the thing that keeps the org alive. They still
  leave run-log lines; excluded from the ceiling means uncounted, never
  unrecorded.
- **The delivery lead's own children**: the issue triage officer, its
  responders, and the historian. The ceiling prices one release; these
  price the engagement, and the lead answers for them in its own run log.
- **A Phase 7 veto's revert builder and verifier** consume the repair
  margin: undoing a defect occupies no slot
  ([release-loop.md](./release-loop.md)), and margin is exactly the
  budget for work the plan did not intend.

## The reality check

The derivation is checked, by the captain at computation time, against the
previous release's per-tier actuals from `BASELINES.md` (in the brief via
`{{ceiling_inputs}}`; `none` on a first release). A derived ceiling far
below what a comparable batch actually spent means the formula was
misapplied or the batch was misread, and the captain resolves that before
the first builder spawns, in writing, in the derivation. History corrects
the formula; the formula never argues with history.

## Worked examples

Full batch, 12 slots, 7 merge units of which 1 is the debt surgeon's, UI
items, one class A data item, 4 archaeologists, 11 surviving items:
11 unconditional + 4 + 11 + 6 builders + 7 verifiers + 1 second data
verifier + ux designer + design system steward + security Phase 2 pass
= 43 roster, 6 reasoning; margin at 25 percent adds 11 (2 reasoning);
ceiling 54 total, 8 reasoning. The retired constant of 50 sat below this
release's correct behaviour once watchdogs were counted.

Docs-and-copy batch, 6 slots, 3 merge units, no UI, no schema, 3
archaeologists, 6 surviving items: 11 + 3 + 6 + 3 builders + 3 verifiers
(the voice steward fills the copy unit's slot) = 26 roster, 5 reasoning;
margin adds 7; ceiling 33 total, 7 reasoning. A ux designer spawn inside this release is
a breach the moment it happens, which is the point: the ceiling now
detects roles the batch never called for instead of penalizing a normal
roster.
