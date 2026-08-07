# Goodboy: Autonomy

Goodboy ships Goodboy. Releases are decided, built, verified, and drafted by
an autonomous delivery organization made of agents; a human reviews after, not
before. This is the human hub: it owns the model, the floor, and the single
enumeration of the cluster's files, and nothing else. It is not agent read
material: the release captain's reading list lives in the continuous-delivery
skill's captain prompt and the delivery lead's in that skill's `SKILL.md`,
and neither includes this file. The deep dives live in the autonomy cluster
under `docs/autonomy/`: [org](./docs/autonomy/org.md),
[roles](./docs/autonomy/roles.md) with a charter per role under
`docs/autonomy/roles/`, [safety](./docs/autonomy/safety.md),
[composition](./docs/autonomy/composition.md),
[item classes](./docs/autonomy/item-classes.md),
[release loop](./docs/autonomy/release-loop.md),
[impact](./docs/autonomy/impact.md),
[issue triage](./docs/autonomy/issue-triage.md),
[watchdogs](./docs/autonomy/watchdogs.md),
[infrastructure](./docs/autonomy/infrastructure.md),
[visibility](./docs/autonomy/visibility.md),
[souls](./docs/autonomy/souls.md). Decisions that bind future releases are
recorded in [docs/adr/](./docs/adr/README.md).

## Control lives in the documentation

The owner does not steer the machine by prompting it. He steers it by editing
what it reads: [VISION.md](./VISION.md) says what Goodboy should become,
[DESIGN.md](./DESIGN.md) says how it should look and behave,
[AGENTS.md](./AGENTS.md) and [CONVENTIONS.md](./CONVENTIONS.md) say how it is
built, and the standing mandates say what the next releases must take on.
Keep these clear and every release goes where they point. That is also why
this documentation is maintained with the same rigor as the code: a stale doc
is a steering error.

Disagreement works the same way for everyone, owner included: open an issue.
Same queue, weighed by the [trust model](./docs/autonomy/safety.md).

## The shape

- A **delivery lead** runs an engagement of a few releases (length and
  default owned by the continuous-delivery skill): spawns one **release
  captain** per version, reviews and publishes each draft, keeps the
  ledger, runs the issue loop, watches for stalls. It never reads or
  writes code, and it reads verdicts and exceptions from disk, not
  narratives.
- A **release captain** owns one version through the phases of the
  [release loop](./docs/autonomy/release-loop.md), then dies. State
  survives on disk, not in agents.
- A **product owner** on the reasoning tier composes each release's
  **batch** per [composition](./docs/autonomy/composition.md): a fixed
  slot budget allocated across categories, issues first, a refactor floor
  that never flows away, audit slots always spent, owner-tunable per
  category in one `quota:` line, with authors weighed and contributors
  floored. The slot budget and the merge-unit ceiling live only in
  composition.md; the org deliberately runs a narrower shape than its
  founding ambition, because the width the ledger never tested is not a
  width it gets to assume, and the wider shape survives as a
  [graduation path](./docs/autonomy/composition.md) earned by green
  engagements. Items belong to
  [classes](./docs/autonomy/item-classes.md), each with its own
  deliverable and its own verifier: code is one class among several, not
  the definition of work. The PO holds the right of push-back: work ships
  because it moves something for a real user, never because it is
  possible. A **challenger** assumes every plan is bad and attacks it
  cold, because one strong opinion is not a review; it also judges the
  [impact bar](./docs/autonomy/impact.md), so a release that no user
  could name in a sentence is marked, published, and answered for in the
  next one.
- **Builds run in waves, concurrently when items share no files; merges
  never do.** The batch is consumed in waves with `main` green at the
  boundaries; within a wave, one PR merges, `main`'s own CI goes green,
  the next merges. The wave shape and the suite concurrency cap live in
  the [release loop](./docs/autonomy/release-loop.md). The serial merge
  lane pays for the parallel build lanes.
- Nothing merges on its author's word: every PR is verified by a **different
  agent** whose verdict outranks the builder's report and green CI. A change
  touching schema or stored data gets a second verifier and an owner
  question before the build; the irreversible kind never merges on silence
  ([safety](./docs/autonomy/safety.md)). A **security officer** sweeps
  every release's diffs with a merge veto for the surfaces data can leave
  through.
- Every open issue gets a decision and a reply every cycle. No issue goes
  dark, and a mandate nobody answers suspends itself loudly after repeated
  written push-backs ([composition](./docs/autonomy/composition.md))
  instead of being re-argued forever.

## The floor

The short version of [safety.md](./docs/autonomy/safety.md), which wins over
everything else:

- Publication is the delivery lead's alone, after reviewing the draft.
- Never: direct push to `main`, force-push, hook bypass, touching signing
  material or secrets, deleting published releases, telemetry or tracking of
  any kind, guessing at unknowns.
- `main` is never left red. Stop conditions (red main unrepaired, two failed
  releases, notarization failing twice) halt the engagement with a written
  handoff.
- Push-back and questions go to the owner asynchronously, in writing; the
  machine continues with what is unambiguous.

## Memory

Agents remember nothing between releases; the disk remembers everything.
State lives outside the repo in `~/.goodboy-autonomous/`: `MANDATES.md`
(standing direction from the owner, including the composition quota),
`BACKLOG.md` (what audits surfaced and nobody took yet), `LEDGER.md` (one
compact entry per release: theme, PRs, composition, impact, verdict, risks;
full narratives stay in the per-release scratch dirs), `OWNER_INBOX.md`
(push-backs, questions, stop reports), `FOLLOW_THROUGH.md` (what shipped
items generated in response, owned by the historian per
[its charter](./docs/autonomy/roles/historian.md)), `BASELINES.md` (the
compact cross-release carry the delivery lead distills from report blocks
before a published release's scratch dirs are deleted, defined in the
continuous-delivery skill), and a per-release run log per
[visibility](./docs/autonomy/visibility.md). The ledger doubles as the
metric: items proposed versus shipped versus dropped per cycle (the
captain's report records all three) is how the loop earns more frequency,
per release and over time. The ratio is always read alongside `closed-tab`,
the reason to open another tool that the release removed: that is the value
actually shipped. Inflating PR counts, splitting one feature into many PRs,
or sandbagging proposals to look reliable is exactly the failure this metric
exists to catch, not a way to score on it.

## Running it

The `continuous-delivery` skill under `.claude/skills/continuous-delivery/`
is the entry point: invoking it starts a delivery lead for an engagement.
Today the trigger is a human naming the skill; the direction is an autonomous
trigger, gated by the same judgment the product owner applies to work items
(run only when there is something worth shipping), once the shipped-to-
proposed ratio in the ledger proves the loop out.
