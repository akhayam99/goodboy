# Autonomy: the impact bar

Part of the [autonomy cluster](../autonomy.md). This file owns the impact
bar: what a release must move, who judges it, and what a below-bar verdict
does to the next release. The metric it complements, `closed-tab`, is
defined in AUTONOMY.md; the phases that produce the judgment are in
[release-loop.md](./release-loop.md).

## The bar

A release passes the bar when it moves at least one of five things in a way
a user could name in one sentence without reading a diff: **feature,
documentation, navigability, copy, user experience.**

The bar exists because a 20-slot budget
([composition.md](./composition.md)) makes it possible to spend an entire
release on true, verified, worthwhile work that no user would ever notice:
audits with no findings, refactors with unchanged behavior, org rules
pending verification. All of that is legitimate; a release made only of it
is the machine polishing its own gears. Two releases in the last engagement
already reported `closed-tab: none` honestly; the bar turns that honesty
into a consequence instead of a shrug.

## Who judges

- **The challenger** judges the bar in Phase 7, where it already reviews the
  release notes: it reads the draft cold and answers whether the sentence a
  user would say actually exists. The challenger judges rather than the
  captain because the captain composed the release and no role reviews its
  own work.
- **The delivery lead** confirms the verdict before publishing, as part of
  verifying the report against the world. A lead that disagrees with the
  challenger records the disagreement in the ledger and its own verdict
  stands, because publication and its consequences are the lead's alone.

Evidence, not vibes: the bar is met when `closed-tab:` is not `none`, or
when `changed:` contains at least one line the
[product critic](./roles/product-critic.md) could verify by walking the app.
A `changed:` line only a diff reader can confirm does not count.

## Below the bar

A below-bar release **still publishes**. Blocking it would burn the whole
machine's work to make a point, and the work is real even when invisible.
Instead:

- The ledger entry and the captain's report carry `impact: below-bar`, with
  the missing categories named.
- **The next release pre-commits the missing category**: its product owner
  reserves at least one slot for user-visible work in a category the
  below-bar release lacked, declared in the plan like any composition
  deviation.
- **Two below-bar releases in a row** produce an owner-inbox entry and the
  delivery lead changes the area rotation pick for the next release, because
  at that point the rotation is feeding the machine work users cannot see
  and the fix is direction, not effort.

Reading the series: the `impact:` line accumulates in the ledger, one per
release. A healthy engagement mixes `pass` with an occasional declared
`below-bar`; a run of `below-bar` is the earliest cheap signal that the
budget's categories are misallocated, and it is the delivery lead's job to
say so in the engagement report rather than let the series speak for itself.
