# Autonomy: infrastructure failures

Part of the [autonomy cluster](../autonomy.md). This file owns the difference
between the work failing and the world failing: how the organization
recognizes a GitHub or provider outage, what it keeps doing during one, and
what it never does to route around one. Liveness of our own agents lives in
[watchdogs.md](./watchdogs.md); stop conditions live in
[safety.md](./safety.md).

The rule this file exists for: **an infrastructure failure never burns the
stop budget, and never lowers the bar.** A release that cannot merge because
GitHub Actions is down is paused, not failed. A merge without an observable
required check is not a merge, it is a guess, and it stays forbidden even
when the outage is GitHub's fault.

## Telling them apart

Read the evidence before assigning blame:

- **Infrastructure**: the same failure across unrelated agents or PRs
  (provider rate limits, auth errors on every spawn); workflow runs
  cancelled with zero steps executed; workflows never dispatched at all for
  a pushed SHA; runs sitting `queued` with no runner while earlier identical
  runs started immediately; a declared incident on githubstatus.com. The
  component to check for CI is `Actions`, and its incident notices name
  webhook throttling explicitly when that is the mechanism.
- **The work**: a named test failing, the same one, twice; a typecheck error
  pointing into the diff; one PR red while its siblings pass the same
  checks.

Check the status page before diagnosing a CI failure, not after two repair
attempts. The two-repair budget in [release-loop.md](./release-loop.md) is
for the work; spending it on an outage wastes it and can trip a stop
condition nothing in the repo earned.

## Preflight

The delivery lead checks at engagement start and at every release boundary:
`main` green on its own CI, no tag build in flight, and, whenever anything
looks slow or silent, the `Actions` component on githubstatus.com. A new
release is not started into a declared major outage; a release already
running continues under build-ahead mode.

## Build-ahead mode

When merging is blocked but building is not (checks never dispatch, runners
starved, webhooks throttled), the captain declares build-ahead mode in its
scratch state and keeps going:

- Phases 1 through 5 continue: audit, decide, scout, build, verify. All of
  that is local work plus plain git pushes, which this class of outage does
  not block.
- Verified PRs queue instead of merging. The captain writes
  `merge-queue.md` in its release scratch dir: one line per PR, in merge
  order, with the PR number, the branch, any package overlap with earlier
  queue entries (which triggers the refresh rule in
  [release-loop.md](./release-loop.md)), and a pointer to the verifier
  verdict. A successor or the delivery lead executes the queue from that
  file without re-deriving anything.
- Nothing is tagged and nothing merges blind. Merging without an observable
  required check, or without the ability to poll `main`'s own CI afterwards,
  stays forbidden. A streak of never leaving `main` red is not traded for
  one outage.
- **No idle polling.** Waiting happens at boundaries: check the incident
  page and the queued runs when a phase ends, not in a sleep loop. When the
  outage outlasts the useful local work, the captain reports
  `paused (infrastructure)` with the queue on disk and exits; the delivery
  lead resumes it or hands it to the next engagement through the ledger.

The most valuable hours of one real outage were spent exactly this way:
building and verifying the next fix while the merges waited. Build-ahead is
the institutional version of that improvisation.

## Facts about this repo's pipelines

- Neither `ci.yml` nor `rust.yml` has a `workflow_dispatch` trigger. When
  webhooks are throttled, the only way to summon a run for an open PR is
  closing and reopening it, which forces a fresh `pull_request` event.
  Adding the trigger is a one-line `ci`-scoped change worth proposing as
  backlog work; until it lands, close/reopen is the only lever.
- A release build takes roughly 9 to 12 minutes. The homebrew cask bump is
  its own workflow after publish and can lag a recovered outage: a
  published release with all four assets is complete even while the cask is
  stale. Re-run the cask workflow; never re-release for it.
- Jobs cancelled at the runner timeout with zero steps executed are the
  outage signature, not the diff's.

## Provider outages

Model-provider failures (rate limits, 5xx across unrelated agents) pause the
affected role, which retries later on the same brief; the pause is noted in
the ledger. Releases that fail for provider or Actions reasons do not count
toward the two-failed-releases stop condition; releases that fail for
reasons the evidence cannot pin on infrastructure do.
