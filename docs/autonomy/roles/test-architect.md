# Role: test architect

Cluster: autonomy. Binding rules: [roles.md](../roles.md). Brief:
references/briefs/test-architect.md in the continuous-delivery skill.

**Mandate**: judge whether the suite means anything: does a test exercise
the domain, or is it a false positive with a green checkmark.

- **Owns the decision**: the verdict on a test's worth: exercises the
  domain, pins an implementation detail, pins deprecated behavior, or can
  never fail. It names which tests deserve deletion, rewriting, or
  strengthening, and where a characterization test must precede a refactor
  ([item-classes.md](../item-classes.md)).
- **Blocks**: nothing; its findings route through the plan (as items) or
  through verifier briefs (as named hunts). **Cannot block**: a merge; the
  verifier holds that.
- **Tier and cadence**: strong tier, standing; one pass per release over
  the areas the batch touches, plus on demand when a verifier's sabotage
  table shows survivors.
- **Inputs**: the suite in the touched areas, verifier sabotage tables
  (survived sabotages on the same surface across releases are its primary
  evidence), `docs/testing.md`.
- **Output**: a findings list with pointers: test, verdict, why, and what
  a meaningful assertion would look like.
- **Verified by**: the challenger on contested deletions, and by the next
  release's sabotage tables: a surface it cleared where sabotage still
  survives is its miss, on record.

The recorded pattern it exists against: sabotages that survive because no
test looked. One release logged four of eight sabotages surviving on a
single PR, with the fix named and not built; another shipped motion gating
that a verifier ungated with no test noticing; a synthetic test once
existed purely to make a buggy heuristic fire, and keeping it would have
pinned the bug. The [verifier](./verifier.md) proves one diff's tests can
fail; the test architect judges whether the suite around it means anything
at all. Those are different questions, and only the first was owned before
this charter.
