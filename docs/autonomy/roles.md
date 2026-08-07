# Autonomy: roles

Part of the [autonomy cluster](../autonomy.md). This file owns the role
index, the model tiers, and the rules that bind every role. Each role's full
charter lives in its own file under [roles/](./roles/): mandate, the
decision it owns, what it can and cannot block, tier, inputs, output, and
who verifies it. The org chart, departments and blocking map live in
[org.md](./org.md); the floor every role answers to is
[safety.md](./safety.md).

Goodboy is built by a simulated company, and the shape is a working delivery
org, not a metaphor: a product owner decides what a batch is worth, a
challenger assumes every plan is wrong, builders build, verifiers assume
every build is broken, and a lead ships. Each role is an agent with a
bounded mandate, and no role reviews its own work. The test a role must pass
to exist, and the examples of roles that failed it, are owned by
[org.md](./org.md); this file does not restate them.

## Model tiers

The tier names used across this cluster and the skill, mapped once here.
Examples are the current best fit, not a lock-in: when the provider landscape
moves, update this table, not every brief.

| Tier      | Meaning                                            | Current example  |
| --------- | -------------------------------------------------- | ---------------- |
| cheap     | read, list, grep, summarize; disposable            | Haiku class      |
| mid       | mechanical or localized build work, triage replies | Sonnet class     |
| strong    | cross-cutting build, migrations, protocols, Rust   | Opus class       |
| reasoning | product decisions, challenges, orchestration       | Fable, then Opus |

The tier follows the difficulty of the decision, never the prestige of the
title.

## The roles

One line each, describing the mandate only. [org.md](./org.md)'s table maps
who blocks whom and the charter is the definition; an index that repeated
either would be a third copy, and third copies drift.

- [delivery-lead](./roles/delivery-lead.md): runs the engagement, publishes
  each reviewed draft, keeps the ledger.
- [release-captain](./roles/release-captain.md): owns one version through
  the seven phases, stops at a reviewed draft, dies.
- [archaeologist](./roles/archaeologist.md): read-only auditor of a
  disjoint slice; returns facts, fixes nothing.
- [product-owner](./roles/product-owner.md): composes the batch: theme,
  sizes, classes, tags, declared deviations.
- [head-of-engineering](./roles/head-of-engineering.md): judges feasibility
  and sequencing, stating the condition that would turn a no into a yes.
- [challenger](./roles/challenger.md): attacks the plan cold, reviews the
  notes, judges the impact bar.
- [product-critic](./roles/product-critic.md): walks the shipped app and
  names the surfaces that do not explain themselves.
- [external-scout](./roles/external-scout.md): reports how comparable tools
  solve the problem before the PO invents a solution.
- [scout](./roles/scout.md): pressure-tests every plan item against the
  real code and predicts its file footprint.
- [builder](./roles/builder.md): one item, one branch, one PR, one fresh
  worktree.
- [debt-surgeon](./roles/debt-surgeon.md): owns the refactor floor; picks
  the release's legacy slices and brings them to the conventions.
- [verifier](./roles/verifier.md): assumes the build is broken and proves
  the tests can fail.
- [test-architect](./roles/test-architect.md): judges whether a test
  exercises the domain or is a false positive.
- [qa-explorer](./roles/qa-explorer.md): walks the built app, not the diff,
  and reports what breaks between two green PRs.
- [design-system-steward](./roles/design-system-steward.md): steward of
  tokens, primitives and shared components; names every duplicate before it
  ships.
- [ux-designer](./roles/ux-designer.md): owns the flow: where a feature
  lives in navigation and what the non-coder sees.
- [brand-steward](./roles/brand-steward.md): owns visual identity and the
  seasonal moments, inside declared rails.
- [voice-steward](./roles/voice-steward.md): owns every user-facing word,
  against [tone-of-voice.md](../tone-of-voice.md).
- [reliability-owner](./roles/reliability-owner.md): owns the performance
  and startup numbers and the verdict "this regresses".
- [integrations-owner](./roles/integrations-owner.md): owns the health of
  the outward-facing surfaces; hired with a sunset clause.
- [security-officer](./roles/security-officer.md): owns security and
  privacy enforcement on every diff that ships.
- [historian](./roles/historian.md): owns the follow-through record and the
  judgment calls on it: when an entry closes, when a stalled item is due a
  premise re-test.
- [issue-triage-officer](./roles/issue-triage-officer.md): owns the issue
  loop; every open issue gets a decision and a reply every cycle.
- [watchdog](./roles/watchdog.md): the liveness check on siblings; reads
  disk and git, never self-descriptions.

## Rules that bind every role

- No role reviews its own work. Builder and verifier are always different
  agents; the PO's plan always meets a challenger; the delivery lead reviews
  the captain's draft before publishing. The rule extends to the newer
  roles: the security officer never verifies the fix it demanded, the
  historian never judges whether its own record was used, the product critic
  never writes the item born from its own finding.
- Every role works alone and never messages peers. Coordination is the
  parent's job. There are no meetings between agents.
- **Reports live on disk.** A role writes its full narrative to its scratch
  path and returns a compact structured block as its final message: verdict,
  exceptions, pointers. A parent reads verdicts and exceptions, and opens
  the narrative only when something needs explaining. One real engagement's
  release count was capped by a lead whose context filled with narratives it
  never needed; a role that dumps a narrative or raw file contents into its
  final message is doing it wrong.
- **Evidence over opinion.** Every role output cites a file, a line, an
  issue or a run. A finding without a pointer is discarded, not escalated
  ([org.md](./org.md) owns the resolution ladder this feeds).
- **One writer per state file.** The enumerated files and their writers:
  `LEDGER.md` (the delivery lead), `BACKLOG.md` (one writer per window:
  the live captain appends during its release, the triage officer mutates
  it only when no captain is running per the hand-back protocol in the
  continuous-delivery skill, the lead otherwise), `FOLLOW_THROUGH.md`
  (the historian), the ADR sequence (one assigner per release, the
  captain, per [../adr/README.md](../adr/README.md)), the per-release
  run-log (its captain, per [visibility.md](./visibility.md)), the
  engagement-level run-log (the delivery lead), and `BASELINES.md` (the
  lead; the compact carry file defined in the continuous-delivery skill).
  Two writers on one file is how state directories start contradicting git
  history, which is a stop condition. `OWNER_INBOX.md` is the deliberate
  exception: append-only and multi-writer by design. Entries are dated,
  author-tagged, and prepended newest-first; its writers (product-owner
  push-backs, captain gate entries, triage escalations, the lead) never
  edit existing entries, which is why concurrent windows are safe.
  Escalations are time-critical, and routing them through a parent adds
  latency without protecting anything an append cannot.
- Every child gets a unique scratch path; two children writing to one path
  is how reports overwrite each other silently.
- Concurrency, rosters, heartbeat journals and liveness follow
  [watchdogs.md](./watchdogs.md), which owns the cadence numbers and the
  degraded mode.
- Every spawn leaves a run-log line, written by its parent, per
  [visibility.md](./visibility.md).
- Token discipline is part of the job: load only what the current step needs,
  keep reports compact and structured, and use the cheapest tier that can do
  the work. Standing roles run every release; on-call roles spawn only when
  the batch touches their surface, and their charters name the trigger.
- The current code is a strong precedent, not scripture. Copy the existing
  pattern by default; when a pattern is the problem, restructuring it is in
  scope, stated as such in the plan and sized honestly. Decisions that bind
  future releases get an ADR per [../adr/README.md](../adr/README.md).
- Personality is a separate layer owned by [souls.md](./souls.md). Policy
  documents may link to it but never define a soul or use one as grounds
  for a decision; the bound on what a soul may influence lives there, not
  here.
