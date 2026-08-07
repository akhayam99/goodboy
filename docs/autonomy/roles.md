# Autonomy: roles

Part of the [autonomy cluster](../autonomy.md). This file owns the role charter
of the delivery organization: who exists, what each role decides, which model
tier it runs on, and how the roles check each other. The rules every role obeys
live in [safety.md](./safety.md).

Goodboy is built by a simulated company, and the shape is a working delivery
org, not a metaphor: a product owner decides what a batch is worth, a
challenger assumes every plan is wrong, builders build, verifiers assume
every build is broken, and a lead ships. The company takes a batch of work
([composition.md](./composition.md)), consumes it, ships it, then takes the
next one; it does not run forever, and quality is the point of the shape,
not a tax on it. Each role is an agent with a bounded mandate, and no role
reviews its own work. The org is deliberately small: a role earns its place
by owning a decision nobody else can make.

## Org chart

```
delivery lead (one per engagement, up to 5 releases)
├── release captain (one per release)
│   ├── archaeologists (3-5, cheap, read-only)
│   ├── product owner (reasoning tier, decides the release)
│   ├── challenger (reasoning tier, second opinion on the PO)
│   ├── scouts (cheap, pressure-test the plan)
│   ├── builders (one per PR, mid or strong tier)
│   ├── verifiers (one per PR, never the builder)
│   └── watchdog (periodic, checks siblings)
├── issue triage officer (periodic loop)
│   └── responder (per issue, drafts the reply)
└── watchdog (checks the release captain)
```

Roles with no data dependency on each other run concurrently:
archaeologists as one batch, scouts as one batch, builders on disjoint items
together, a verifier the moment its build lands. The PO, the challenger and
the merge phase are serial by nature: one feeds the next, or the resource is
shared. The concurrency contract is in the binding rules below; the liveness
answer that makes it safe is [watchdogs.md](./watchdogs.md).

## Model tiers

The tier names used across this cluster and the skill, mapped once here.
Examples are the current best fit, not a lock-in: when the provider landscape
moves, update this table, not every brief.

| Tier      | Meaning                                            | Current example    |
| --------- | -------------------------------------------------- | ------------------ |
| cheap     | read, list, grep, summarize; disposable            | Haiku class        |
| mid       | mechanical or localized build work, triage replies | Sonnet class       |
| strong    | cross-cutting build, migrations, protocols, Rust   | Opus class         |
| reasoning | product decisions, challenges, orchestration       | Fable / Opus class |

## The roles

### Delivery lead

The engagement owner. Invoked by the `continuous-delivery` skill, runs up to
five releases end to end, then reports and exits. It never writes code and
never writes a release itself: it spawns release captains, reviews their draft
releases, publishes each reviewed draft, keeps the ledger, runs the issue
triage loop, and watches for stalled children. It is the only role authorized
to publish a release. Model: reasoning tier.

### Release captain

Owns one version end to end: audit, decision, scouting, build, verify,
merge, draft.
Stops at a reviewed draft release; publication belongs to the delivery lead.
Follows [release-loop.md](./release-loop.md). Model: reasoning tier.

### Archaeologist

Read-only auditor. Each gets a disjoint slice of the codebase or the product
surface and returns a compact structured list of facts: what exists, what
drifts, what is dead, what an item would cost. Never fixes anything, never
touches git. Model: cheap tier.

### Product owner

The role that decides what the release is. Runs on the strongest reasoning
tier available, with the audit, the mandates, VISION and the backlog in hand.
Its output is a theme plus a batch of 3 to 6 sized work items, each tagged
with a persona, the three questions (what do I see, what can I do, where
does it take me next), and the three composition tags (provenance, author
class, data class) defined in [composition.md](./composition.md). The batch
meets the composition target there, or declares why it deviates.

The PO has an explicit right and duty of push-back. It does not accept work
just because the work is possible and on-vision: an item earns its place only
if it moves something for a real user. When the PO judges that a requested
item (including one from a mandate or from the owner) should not be built, it
says so in writing, with reasoning, through the push-back protocol in
[safety.md](./safety.md) (owner inbox plus the final report). A release is
allowed to be smaller than planned because the PO cut weak items; it is not
allowed to carry filler.

Design calls cite an industry precedent (VS Code, Cursor, Linear, Claude Code)
by house rule.

### Challenger

The role whose job is to assume the plan is bad and prove it. A second
reasoning-tier agent that receives the
PO's plan cold (no shared conversation) and attacks it: wrong priorities, missed
regressions of the non-coder read, items that fail see/do/next, cheaper paths
to the same user value, and anything that contradicts VISION or the audit. The
release captain reconciles PO and challenger; on an unresolved disagreement
the safer scope wins and the disagreement is recorded in the ledger. The
challenger also reviews the release notes before the draft is cut, and any
migration-touching plan item ([safety.md](./safety.md)) gets a dedicated
challenge of its schema design on top of the plan-level attack.

### Scout

Pressure-tests the plan before a line is written: does the assumed code exist,
is there a prior implementation to extend instead of duplicate, is a migration
number free, which gating lists a change must touch, what tests cover the
path. Scouts also produce each item's **predicted file footprint** (the
files and shared hotspots it will touch), which decides what builds
concurrently, and confirm the item's data class against the gate in
[safety.md](./safety.md). Scouts have contradicted every first plan so far;
a plan that skipped scouting has shipped wrong items. Model: cheap tier,
read-only.

### Builder

One work item, one branch, one PR, one fresh worktree, always cut from
`origin/main`, never from a sibling's unmerged branch. Follows AGENTS.md and
the repo conventions
without exception, writes the PR body it would want to review, and reports
honestly, including what it could not verify. A builder receives its item's
declared file footprint; when the work genuinely demands a file another live
item claims, it stops and reports instead of improvising, and the captain
serializes the remainder. Mechanical or localized work
runs on the mid tier; cross-cutting, state-machine, migration, protocol or
Rust work runs on the strong tier.

### Verifier

A different agent from the builder, always. Runs the full workspace checks,
reads the diff against the work item, hunts the known regression classes, and
sabotages the implementation to prove the tests can fail. The verifier's
verdict outranks the builder's report and CI. The full playbook is in
[release-loop.md](./release-loop.md). Any migration-touching PR
([safety.md](./safety.md)) takes two independent verifiers, the
second running the data playbook. Model: the tier of the build it checks,
never below mid; a cheap verifier is not a verifier.

### Issue triage officer

Owns the issue loop in [issue-triage.md](./issue-triage.md): every open issue
gets a decision and a reply every cycle. Spawns a cheap responder per issue to
draft the reply, reviews it against the trust model, posts it. Never merges
code; when an issue turns into work, it lands in the backlog for the next
release captain. Model: mid tier.

### Watchdog

The liveness check. A cheap agent spawned on a timer that inspects its
siblings' progress and reports stalls to its parent. Cadence and the recovery
ladder live in [watchdogs.md](./watchdogs.md).

## Rules that bind every role

- No role reviews its own work. Builder and verifier are always different
  agents; the PO's plan always meets a challenger; the delivery lead reviews
  the captain's draft before publishing.
- Every role works alone and never messages peers. Coordination is the
  parent's job.
- **Reports live on disk.** A role writes its full narrative to its scratch
  path and returns a compact structured block as its final message: verdict,
  exceptions, pointers. A parent reads verdicts and exceptions, and opens
  the narrative only when something needs explaining. One real engagement's
  release count was capped by a lead whose context filled with narratives it
  never needed; a role that dumps a narrative or raw file contents into its
  final message is doing it wrong.
- Every role gets a unique scratch path. Children with no data dependency on
  each other are spawned together, in one message, as concurrent background
  tasks with completion notifications; five builders once ran as the sum of
  their durations instead of the longest one, and that time bought nothing.
  Concurrency is bounded by the roster contract in
  [watchdogs.md](./watchdogs.md): roster before spawning, heartbeat
  journals, first-activity check, and a parent that never proceeds past an
  unresolved child. Where the harness cannot notify on background
  completion, the degraded mode is foreground spawning, one child at a time:
  slower, never silent.
- Every builder and verifier keeps the heartbeat journal defined in
  [watchdogs.md](./watchdogs.md). Watchdogs read journals and git, never
  self-descriptions.
- Token discipline is part of the job: load only what the current step needs,
  keep reports compact and structured, and use the cheapest tier that can do
  the work.
- The current code is a strong precedent, not scripture. Copy the existing
  pattern by default; when a pattern is the problem, restructuring it is in
  scope, stated as such in the plan and sized honestly.
