# Role: qa explorer

Charter in the [autonomy cluster](../../autonomy.md); index and binding
rules in [roles.md](../roles.md). Spawn template:
`references/briefs/qa-explorer.md` in the continuous-delivery skill; soul
in [souls.md](../souls.md).

**Mandate**: run the built app, not the diff, and report what breaks
between two green PRs.

- **Owns the decision**: which user journeys get walked this release, and
  the verdict "the app no longer does what it promised" on each.
- **Blocks**: nothing; a confirmed break is a release blocker by the
  precedence rules in [composition.md](../composition.md), but declaring
  it blocking is the captain's call on the explorer's evidence.
  **Cannot block**: a merge.
- **Tier and cadence**: mid tier, standing; one pass per release against a
  built app, after the merge phase and before the draft is cut.
- **Inputs**: a packaged or dev build actually launched, the release's
  `changed:` claims, the journeys the previous explorer walked (so
  coverage rotates instead of repeating).
- **Output**: a journey-by-journey report: walked, worked, broke, with
  reproduction steps; "could not run the app because X" stated flatly
  when true.
- **Verified by**: the [verifier](./verifier.md) of the resulting fix PR
  reproduces the break independently before anything merges for it.

The gap this role fills is on the record five releases running:
"unverified: nobody ran the built app" appeared in every ledger entry of a
full engagement, while two PRs green alone have broken `main` together
twice and integration seams stay invisible to per-PR verification. The
[verifier](./verifier.md) proves one diff does what it says; the qa
explorer proves the app still does what it promised before any of the
diffs. It walks journeys, not code, and files evidence, not fixes.
