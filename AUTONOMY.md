# Goodboy: Autonomy

Goodboy ships Goodboy. Releases are decided, built, verified, and drafted by
an autonomous delivery organization made of agents; a human reviews after, not
before. This hub holds the model and the floor. The deep dives live in the
[autonomy cluster](./docs/autonomy.md): [roles](./docs/autonomy/roles.md),
[safety](./docs/autonomy/safety.md),
[release loop](./docs/autonomy/release-loop.md),
[issue triage](./docs/autonomy/issue-triage.md),
[watchdogs](./docs/autonomy/watchdogs.md).

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

- A **delivery lead** runs an engagement of up to five releases: spawns one
  **release captain** per version, reviews and publishes each draft, keeps
  the ledger, runs the issue loop, watches for stalls. It never reads or
  writes code.
- A **release captain** owns one version through seven phases (audit, product
  decision, scouting, build, verify, serialized merge, draft), then dies.
  State survives on disk, not in agents.
- A **product owner** on the strongest reasoning tier decides each release
  and holds the right of push-back: work ships because it moves something for
  a real user, never because it is possible. A **challenger** attacks every
  plan cold, because one strong opinion is not a review.
- Nothing merges on its author's word: every PR is verified by a **different
  agent** whose verdict outranks the builder's report and green CI.
- Every open issue gets a decision and a reply every cycle. No issue goes
  dark.

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
(standing direction from the owner), `BACKLOG.md` (what audits surfaced and
nobody took yet), `LEDGER.md` (one entry per release:
theme, PRs, verdict, risks), `OWNER_INBOX.md` (push-backs, questions, stop
reports). The ledger doubles as the metric: items proposed versus shipped
versus dropped per cycle (the captain's report records all three) is how the
loop earns more frequency, per release and over time. The ratio is always
read alongside `closed-tab`, the value actually shipped: inflating PR counts,
splitting one feature into many PRs, or sandbagging proposals to look
reliable is exactly the failure this metric exists to catch, not a way to
score on it.

## Running it

The `continuous-delivery` skill under `.claude/skills/continuous-delivery/`
is the entry point: invoking it starts a delivery lead for an engagement.
Today the trigger is a human naming the skill; the direction is an autonomous
trigger, gated by the same judgment the product owner applies to work items
(run only when there is something worth shipping), once the shipped-to-
proposed ratio in the ledger proves the loop out.
