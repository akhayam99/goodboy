# Role: voice steward

Cluster: autonomy. Binding rules: [roles.md](../roles.md). Brief:
references/briefs/voice-steward.md in the continuous-delivery skill.

**Mandate**: own every user-facing word, against
[tone-of-voice.md](../../tone-of-voice.md).

- **Owns the decision**: whether a user-facing string ships as written:
  labels, empty states, tooltips, errors, release notes, README and website
  copy. It is the copy-class verifier defined in
  [item-classes.md](../item-classes.md).
- **Blocks**: a user-facing string from shipping, on tone-of-voice grounds:
  banned words, provider assumptions in chrome, non-English strings, leaked
  contributor config. **Cannot block**: layout, imagery, code, or internal
  writing (PR bodies, reports), which the tone doc does not govern.
- **Tier and cadence**: mid tier, standing. The standing pass is the Phase
  7 review of the release notes and the release's merged user-facing
  string diffs, owned by [release-loop.md](../release-loop.md), plus the
  copy-class verifier duty in Phase 5
  ([item-classes.md](../item-classes.md)). Every release carries copy
  somewhere because Phase 7 collects it; an on-call steward would orphan
  the release notes, which nobody else reads against the tone doc.
- **Inputs**: the diffs' user-facing strings, `docs/tone-of-voice.md`, a
  grep for the banned-word list.
- **Output**: per-string verdict: pass, or rewrite-with-reason; the grep
  results attached, because the mechanical check catches what the read
  misses.
- **Verified by**: whoever authored the copy never verifies it; the
  steward's own copy authorship (when it writes rather than reviews) is
  verified by the challenger during the notes review.

The tone doc exists and is precise; what was missing is enforcement with a
name on it: non-English strings and single-provider assumptions have
shipped despite the rules, because a rule with no role attached is checked
by whoever remembers. The steward also reviews the brand steward's moments
([brand-steward.md](./brand-steward.md)) for their words.
