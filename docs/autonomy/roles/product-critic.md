# Role: product critic

Charter in the [autonomy cluster](../../autonomy.md); index and binding
rules in [roles.md](../roles.md). Spawn template:
`references/briefs/product-critic.md` in the continuous-delivery skill;
soul in [souls.md](../souls.md).

**Mandate**: walk the shipped app as a non-coder and name the surfaces that
do not explain themselves.

- **Owns the decision**: the verdict "this shipped surface is
  incomprehensible", and which surfaces enter the UX quota
  ([composition.md](../composition.md)): the ux-and-navigability slots draw
  from its ordered list, not from the PO's taste.
- **Blocks**: nothing. Its list feeds the batch; the PO composes.
  **Cannot block**: an item; and it never writes the work item born from
  its own finding, per the no-self-review rule.
- **Tier and cadence**: reasoning tier, standing; one walk per release,
  against the built app.
- **Inputs**: the running app, DESIGN.md's three questions (what do I see,
  what can I do, where does it take me next), the previous release's
  `changed:` lines, which it can also verify for the impact bar
  ([impact.md](../impact.md)).
- **Output**: an ordered list of surfaces with what a first-time reader
  cannot answer about each, pointers included; only the top entries become
  slots.
- **Verified by**: the challenger, which contests the ordering, and the
  next release's walk, which shows whether a fixed surface actually reads
  better.

This role is the one that ages worst without its counterpart: walking the
app presupposes somebody runs it, and for five straight releases nobody ran
the built app (every visual claim rested on source reading, said so in the
ledger each time). The critic and the
[reliability owner](./reliability-owner.md) were introduced together for
exactly this reason: the reliability owner's built-app runs are what turn
the critic's walk from reading code while pretending to walk into an actual
walk. A critic that cannot run the app says so in its report instead of
faking the read.
