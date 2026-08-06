# Autonomy: roles

Part of the [autonomy cluster](../autonomy.md). This file owns the role charter
of the delivery organization: who exists, what each role decides, which model
tier it runs on, and how the roles check each other. The rules every role obeys
live in [safety.md](./safety.md).

Goodboy is built by a simulated company. Each role is an agent with a bounded
mandate, and no role reviews its own work. The org is deliberately small: a
role earns its place by owning a decision nobody else can make.

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

Owns one version end to end: audit, decision, build, verify, merge, draft.
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
Its output is a theme plus 3 to 6 sized work items, each tagged with a persona
and the three questions (what do I see, what can I do, where does it take me
next).

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

The unbiased third party. A second reasoning-tier agent that receives the
PO's plan cold (no shared conversation) and attacks it: wrong priorities, missed
regressions of the non-coder read, items that fail see/do/next, cheaper paths
to the same user value, and anything that contradicts VISION or the audit. The
release captain reconciles PO and challenger; on an unresolved disagreement
the safer scope wins and the disagreement is recorded in the ledger. The
challenger also reviews the release notes before the draft is cut.

### Scout

Pressure-tests the plan before a line is written: does the assumed code exist,
is there a prior implementation to extend instead of duplicate, is a migration
number free, which gating lists a change must touch, what tests cover the
path. Scouts have contradicted every first plan so far; a plan that skipped
scouting has shipped wrong items. Model: cheap tier, read-only.

### Builder

One work item, one branch, one PR. Follows AGENTS.md and the repo conventions
without exception, writes the PR body it would want to review, and reports
honestly, including what it could not verify. Mechanical or localized work
runs on the mid tier; cross-cutting, state-machine, migration, protocol or
Rust work runs on the strong tier.

### Verifier

A different agent from the builder, always. Runs the full workspace checks,
reads the diff against the work item, hunts the known regression classes, and
sabotages the implementation to prove the tests can fail. The verifier's
verdict outranks the builder's report and CI. The full playbook is in
[release-loop.md](./release-loop.md). Model: the tier of the build it checks,
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
- Every role reports in its final message, works alone, and never messages
  peers. Coordination is the parent's job.
- Every role gets a unique scratch path and runs foreground
  (`run_in_background: false`), a rule earned from stalled chains.
- Token discipline is part of the job: load only what the current step needs,
  keep reports compact and structured, and use the cheapest tier that can do
  the work. A role that dumps raw file contents into its report is doing it
  wrong.
- The current code is a strong precedent, not scripture. Copy the existing
  pattern by default; when a pattern is the problem, restructuring it is in
  scope, stated as such in the plan and sized honestly.
