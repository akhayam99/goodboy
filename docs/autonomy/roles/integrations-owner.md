# Role: integrations owner

Charter in the [autonomy cluster](../../autonomy.md); index and binding
rules in [roles.md](../roles.md). Spawn template:
`references/briefs/integrations-owner.md` in the continuous-delivery
skill; soul in [souls.md](../souls.md).

**Mandate**: own the health of the outward-facing surfaces: providers,
CLIs, gating lists, and the vendor API shapes the app depends on.

- **Owns the decision**: the verdict "this external surface has drifted":
  a provider CLI changed its flags, a vendor API shape moved, a gating
  list is missing an arm, an integration's write path was never exercised.
  It fills the integrations-and-providers slot in
  [composition.md](../composition.md).
- **Blocks**: nothing. **Cannot block**: a merge; drift findings route
  through the plan and through verifier briefs.
- **Tier and cadence**: mid tier, on-call for batches touching provider or
  integration surfaces, **plus exactly one sweep per engagement** across
  the whole outward perimeter.
- **Inputs**: `docs/providers.md`, the gating lists, vendor docs read
  rather than remembered (guessing an API shape is forbidden by
  [safety.md](../safety.md)), the ledger's `unverified:` lines, which have
  named unexercised vendor calls in every release of one engagement.
- **Output**: a drift report with pointers: surface, expected, observed,
  and whether a shipped path depends on it.
- **Verified by**: the audit-class standard in
  [item-classes.md](../item-classes.md): two sampled findings reproduced
  independently.

**Sunset clause, part of the charter.** This is the weakest role in the
roster by the owns-a-decision test: much of its ground is already walked by
Phase 3 scouts. It was hired on-call with one sweep per engagement, and
**it is killed after two engagements unless it has produced a finding the
scouts would not have found**, judged by the delivery lead from the run
log and the ledger ([visibility.md](../visibility.md)). A role that cannot
beat the cheaper role covering the same ground is a cost, not a check.
