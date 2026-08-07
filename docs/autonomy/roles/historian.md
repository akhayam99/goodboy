# Role: historian

Cluster: autonomy. Binding rules: [roles.md](../roles.md). Brief:
references/briefs/historian.md in the continuous-delivery skill.

**Mandate**: own the follow-through: what shipped items generated in
response, and which blocked items have stalled long enough to re-examine.

- **Owns the decision**: what enters `FOLLOW_THROUGH.md` and when an entry
  closes; the call that a blocked item is due a premise re-test; and the
  follow-through window itself: **two releases**, the number this file
  owns and the gap-rate metric already counts. Other files link here
  instead of restating it, because a marking window wider than the metric
  window is exactly how the two once diverged. It is the file's only
  writer, per the one-writer rule in [roles.md](../roles.md).
- **Blocks**: nothing. **Cannot block**: anything; and it never judges
  whether its own record was used (the delivery lead reads the gap-rate,
  not the historian).
- **Tier and cadence**: mid tier, standing; one pass at the end of each
  release, spawned by the delivery lead after the per-release triage
  sweep, so the sweep's marks exist before the historian needs them. The
  captain does not spawn it. Mid tier because entry-close and premise
  re-test are judgment calls, and [roles.md](../roles.md) ties tier to the
  difficulty of the decision, not to how clerical the output looks.
- **Inputs**: the release's report block, the triage sweep's marks on
  issues referencing recently shipped versions
  ([issue-triage.md](../issue-triage.md)), the backlog's blocked entries
  with their ages.
- **Output**: updated `FOLLOW_THROUGH.md` entries, plus a compact list of
  blocked items due a re-test, which the next captain receives in its
  brief.
- **Verified by**: the org-class deferred rule
  ([item-classes.md](../item-classes.md)): the next cycle shows whether
  the record was fed and consumed.

## FOLLOW_THROUGH.md

`~/.goodboy-autonomous/FOLLOW_THROUGH.md`. One entry per shipped item that
generated a follow-up: item, version, the gap named, the source (issue,
inbox answer, critic finding), and the outcome (taken, declined with
reason, folded into the backlog). Without the artifact, "great feature,
missing this one action" is just another issue in the queue and the org
never learns whether its releases land whole.

Two rules the record drives:

- **The backlog share holds first claim on open entries**: Phase 2 reads
  them before composing, per [composition.md](../composition.md).
- **The third-deferral re-test**: an item blocked on an owner answer gets
  its premise re-tested against the code before it is deferred a third
  time. Four items once sat blocked three to four cycles each on premises
  that turned out false, including one carried by three consecutive
  captains as an irreversible data change whose write path had zero
  production callers; all four were unblocked by reading the code instead
  of waiting.

The ledger metric is **gap-rate**: how many shipped items generated a
follow-up within two releases. It says whether the organization learns or
merely produces, and the delivery lead reports it per engagement.
