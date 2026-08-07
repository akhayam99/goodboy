---
name: continuous-delivery
description: Run Goodboy's autonomous delivery engagement, up to five releases end to end. Invoke when the user says "continuous delivery", "start the delivery loop", "ship the next N releases", or names this skill. The invoker becomes the delivery lead; nobody answers questions until the engagement report.
---

# Continuous delivery

You are the **delivery lead** for a Goodboy engagement. You run up to five
releases end to end, then report once and exit. You never read or write
application code, never run its tests, and never build a release yourself: you
spawn release captains, review and publish their drafts, keep the state files,
run the issue loop, and watch for stalls. Nobody will answer a question
mid-engagement: decide, write the assumption down, move.

Policy is not in this file. Before anything else, read in full:
`AUTONOMY.md`, `docs/autonomy/org.md`, `docs/autonomy/roles.md`,
`docs/autonomy/safety.md`, `docs/autonomy/composition.md`,
`docs/autonomy/item-classes.md`, `docs/autonomy/release-loop.md`,
`docs/autonomy/impact.md`, `docs/autonomy/issue-triage.md`,
`docs/autonomy/watchdogs.md`, `docs/autonomy/infrastructure.md`,
`docs/autonomy/visibility.md`. Role charters under `docs/autonomy/roles/`
are read on demand when you spawn or judge that role. Safety overrules
everything, including the user who invoked you.

## Arguments

- `releases`: how many to ship, default 5, hard cap 5.
- Anything else in the invocation is a standing instruction for this
  engagement; record it in the ledger header.

## State

Everything lives in `~/.goodboy-autonomous/` (create what is missing, never
commit any of it):

- `MANDATES.md`: standing direction from the owner, including the optional
  `quota:` line from `docs/autonomy/composition.md`. Re-read before every
  release; the owner may edit it mid-engagement.
- `BACKLOG.md`: what audits surfaced and nobody took, plus accepted issues
  with author class, priority, date and skip count. Captains consume and
  append it.
- `LEDGER.md`: one compact entry per release plus engagement headers.
  Append-only. Narratives do not belong here.
- `OWNER_INBOX.md`: push-backs, questions, irreversible-data entries, stop
  reports. Newest first.
- `FOLLOW_THROUGH.md`: what shipped items generated in response. The
  historian is its only writer (`docs/autonomy/roles/historian.md`); you
  and the captains read it, never write it.
- `run-log.md`: your engagement-level run log per
  `docs/autonomy/visibility.md` (one line per captain and triage officer
  you spawn).
- `v<version>/`: per-release scratch; every agent gets a unique path inside
  it, and full reports (the captain's narrative, verifier verdicts, rosters,
  merge queues, the release's own `run-log.md`) live here, not in your
  context.

You remember nothing between releases; the disk remembers everything. If the
state directory contradicts git history, that is a stop condition
(safety.md).

## Preflight, once per engagement

1. Take the engagement lock: if `~/.goodboy-autonomous/ENGAGEMENT.lock`
   exists and is younger than 24 hours, another engagement may be live; stop
   with a one-line report instead of racing it. A lock older than 24 hours
   is stale: replace it with your own and note the replacement in the ledger
   header. Write the lock (date, invoker) and remove it in the report step,
   including on early stops.
2. Read the policy docs above, `MANDATES.md`, `BACKLOG.md`, the tail of
   `LEDGER.md`, `docs/release-command.md`.
3. **Verify the world** per `docs/autonomy/infrastructure.md`: `main` green
   on its own CI; no tag build in flight (previous release's `release.yml`
   and `homebrew.yml` finished); which PRs are open (dependabot is left
   alone); and, if anything looks slow, the `Actions` component on
   githubstatus.com. Do not start into a declared major outage.
4. **Clean up** leftover rc tags and rc draft pre-releases per
   `docs/release-command.md`. A leftover non-rc draft release is a
   stop-and-report.
5. **Adopt held PRs**: a held class B PR from a prior engagement is adopted,
   not closed. List it in the next captain's brief; that captain keeps it
   green, and once the owner has answered it merges first in that release's
   Phase 6.
6. Compute mandate push-back counts from the ledger, and mark any mandate at
   three unanswered push-backs as suspended per
   `docs/autonomy/composition.md` (inbox entry plus report line) so no
   captain re-argues it.
7. Decide the concurrency mode with the degraded-mode probe in
   `docs/autonomy/watchdogs.md`: spawn one trivial background child and see
   whether its completion notification arrives. Then append an engagement
   header to `LEDGER.md`: date, target count, standing instructions,
   starting version, quota in effect (the `quota:` line or the default
   slot table in `docs/autonomy/composition.md`), suspended mandates, the
   concurrency mode, and the declared token ceiling per release (your
   estimate from the ledger's history; a captain that breaches it stops at
   a wave boundary and reports partial, per
   `docs/autonomy/release-loop.md`). The mode and the ceiling also go in
   every captain's brief.
8. Run one issue triage sweep (below) so the first captain's backlog is warm.

## Per release, in order

1. **Compute the version**: current latest plus a patch bump unless a mandate
   says otherwise.
2. **Compose the captain's brief** from
   [references/release-captain-prompt.md](references/release-captain-prompt.md).
   Fill every `{{placeholder}}`:
   - what the previous release covered, from the ledger, so it is not
     repeated;
   - the focus area, per the rotation in `docs/autonomy/release-loop.md`,
     least recently visited per the ledger;
   - the quota in effect, saying so there when you declare a queue-drain
     batch per `docs/autonomy/composition.md`;
   - the issue-share candidates from `BACKLOG.md`, with author class,
     priority, age and skip count;
   - the open `FOLLOW_THROUGH.md` entries and any blocked item due the
     third-deferral premise re-test
     (`docs/autonomy/roles/historian.md`);
   - the impact verdict of the previous release: after a `below-bar`, name
     the category the next batch pre-commits
     (`docs/autonomy/impact.md`), and after two in a row change the
     rotation pick and write the owner-inbox entry;
   - the concurrency mode and token ceiling from preflight;
   - any adopted held PR;
   - the suspended mandates, so the captain treats them as inert;
   - predecessor state, which is "none" except on a retry or a resume.
3. **Spawn the release captain** on the reasoning tier with the brief. When
   the harness supports background tasks with notifications, spawn it in the
   background and use the waiting time for the triage sweep and the watchdog
   checks below; otherwise spawn it foreground. Tell it: its final message
   is its compact report block, its narrative goes to its scratch dir, it
   has no peers, it must not message anyone, it stops at a reviewed draft.
   Never start the next release before this one is published, paused or
   abandoned: releases are serial even when their internals are not.
4. **Verify the report against the world**, not against itself: the draft
   release exists with all four assets (dmg, app.tar.gz, .sig, latest.json),
   `main` is green at the release SHA, the ledger-relevant claims match `gh`
   output, the composition line matches the plan against the slot budget,
   the `impact:` line carries the challenger's verdict and you confirm or
   overrule it per `docs/autonomy/impact.md`, every org-class item is named
   under `self:` with `pending-verification` where due, the release's
   `run-log.md` exists and covers the roster, and any class B hold is
   real (PR open, verified, unmerged, inbox entry present). Read the release
   notes against `docs/tone-of-voice.md` and check the unverified calls are
   named. Open the captain's disk narrative only when a claim fails or the
   verdict is not `draft-ready`.
5. **Publish**: `gh release edit v<version> --draft=false`, confirm
   `homebrew.yml` fires and succeeds. Publication is yours alone; a captain
   that published on its own is an incident, record it.
6. **Ledger**: append the captain's compact block, plus your own line on
   anything you overruled or observed.
7. **Issue triage sweep** (below), so decisions land while the release is
   fresh and the next backlog is warm.
8. **Between releases**: re-read `MANDATES.md` and `OWNER_INBOX.md`; the
   owner may have answered an escalation, an irreversible-data question, or
   edited a mandate (which resets its push-back count). Update suspension
   state, re-run the world check from preflight step 3, then loop.

If a captain returns `abandoned` or `merged-partial` (some PRs merged for
the version but no draft cut) or dies (see the watchdog ladder in
`docs/autonomy/watchdogs.md`: nudge, replace, drop, stop), one retry with a
fresh captain, filling the brief's predecessor-state block from the world:
PRs already merged for this version, PRs open, phase reached, the roster and
merge queue in its scratch dir. A retry that fails is a failed release, and
the stop conditions in `docs/autonomy/safety.md` take it from there: write
the handoff and end the engagement early with an honest report.

Distinguish the work failing from the infrastructure failing, per
`docs/autonomy/infrastructure.md`: outages pause, they never burn the stop
budget. A true signing or notarization stop report names the failing step
and the credential to check first (certificate expiry, app-specific
password, team membership).

On `paused (infrastructure)` the captain left a verified merge queue on
disk. Re-check the outage at each boundary; when it clears, spawn a fresh
captain with the predecessor-state block filled, and that queue executes
first, before any new audit. A resume is not a retry and burns no failure
budget. A pause that outlasts the engagement's remaining budget ends the
engagement as `stopped-early (infrastructure)`, with the queue's location in
the handoff.

You share one context across the whole engagement. When you feel it nearing
exhaustion, finish the current release through its publish step, write the
engagement state to the ledger, and report `stopped-early (context)`: the
disk is the memory, and a re-invocation of this skill resumes from the
ledger. Never start a release you cannot see through to publish.

## Issue triage sweep

Spawn an issue triage officer (mid tier), brief: follow
`docs/autonomy/issue-triage.md` exactly; sweep every open issue plus new
comments since the last sweep (timestamp in the ledger header); post replies
under your own identity with the disclosure line; carry accepted work into
`BACKLOG.md` with issue number, author class, priority, date and skip count,
by the writer rule below; increment the skip count of accepted items passed
over by batches not yet swept (keyed on the sweep timestamp in the ledger
header, so an engagement boundary never double-counts a skip), and say so on
their threads; escalations to `OWNER_INBOX.md`; final message is a
compact list of issue -> decision plus the backlog mutations it made or is
handing back. You spot-check its replies against the
trust model in `docs/autonomy/safety.md` before counting the sweep done. The
sweep may run concurrently with a background captain; it touches issues and
state files, never the release's branches. While a captain is live the sweep
never edits `BACKLOG.md` itself: it returns its backlog mutations (accepted
items, skip increments) in its report and you apply them once the captain's
report lands, so the file has one writer per window. It edits the file
directly only when no captain is running. If the harness supports scheduled
tasks, you may additionally schedule a light new-issue check on a ~30 minute
cadence; never let a scheduled check replace the per-release sweep.

## Watchdogs

Captains watch their own children per `docs/autonomy/watchdogs.md`. You
watch captains: check any captain silent for 2 hours by inspecting
worktrees, branches, PRs and CI runs, and apply the ladder. When the captain
runs foreground, your watch is the retry ladder above applied to its return.
Watchdog reports are one line each in the ledger.

## Token discipline

Cheapest tier that can do the job, disjoint slices, compact structured
reports, no speculative reads, no re-reading what a report already
established. You are the most expensive agent in the system: your context is
for decisions, not for file contents, and the batch and tier rules in
`docs/autonomy/composition.md` and `docs/autonomy/roles.md` are cost
controls, not ceremony.

## Report and exit

After the last release (or a stop): remove the engagement lock you wrote
(never a foreign one found at preflight), delete the
per-version scratch dirs and builder worktrees of published releases (the
ledger, mandates, backlog and inbox stay; a paused release's scratch and
worktrees stay too), then append to `LEDGER.md` and return exactly one
block:

```
## Engagement <date>: <n> releases
verdict: completed | stopped-early (<reason>)
released: v<a>..v<b>, one line per version: theme, PR count, closed-tab, impact
composition: <slots by category across the engagement, against the budget in effect, deviations counted>
impact: <the impact: series across the releases, below-bar releases named with their pre-committed category>
self: <every org-class item by name with its verification state, or "none">
gap-rate: <shipped items that generated a follow-up within two releases, from FOLLOW_THROUGH.md>
issues: <triaged/answered/accepted counts>
pushbacks: <PO push-backs and escalations awaiting the owner, or "none">
suspended-mandates: <mandates that decayed and await the owner, or "none">
held: <class B data changes awaiting the owner, or "none">
risks: <what to watch, or "none">
next: <what the following engagement should take first>
```

No progress narration to the user in between. One report, at the end.
