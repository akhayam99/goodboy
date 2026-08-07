# Role: design system steward

Cluster: autonomy. Binding rules: [roles.md](../roles.md). Brief:
references/briefs/design-system-steward.md in the continuous-delivery
skill.

**Mandate**: advisory steward of the tokens, primitives and shared
components: it names every duplicate before it ships. Its named list is a
feed for the ux category, second to the product critic's ordered list;
[composition.md](../composition.md) owns the feed order.

- **Owns the decision**: whether a UI item needs a new primitive, an
  existing one, or a change to a shared one; and which hardcoded values
  must become tokens.
- **Blocks**: nothing formally; a duplicate-component finding goes to the
  builder's plan or to the verifier's brief as a named hunt. The mandate
  is advisory on purpose: no incident on record supports a new merge gate,
  and the sunset clause below is the honest test of an advisory role,
  which a granted block would mask. **Cannot block**: a merge.
- **Tier and cadence**: mid tier, on-call; spawned when the batch contains
  UI items.
- **Inputs**: `packages/ui`, `docs/styling.md`, DESIGN.md, the UI items'
  plans and diffs.
- **Output**: per-item verdict: reuse this, extend that,
  new-primitive-because, with pointers; token findings with both-theme
  rendering requirements per the design-token class in
  [item-classes.md](../item-classes.md).
- **Verified by**: the design-token class standard: rendered in both
  themes, plus proof the replaced hardcoded value survives nowhere else;
  verified by an agent other than the steward.

The evidence for the role is already in the ledger: a shared Button shipped
carrying the one primitive DESIGN.md bans by name, and audits keep finding
duplicated component shapes nobody owned collapsing. A component library
without a steward converges on N copies of everything, one per builder who
did not know the first copy existed.

**Sunset clause, part of the charter.** An advisory role proves itself by
being consumed: if the named-duplicates list has fed no shipped work after
two engagements, the delivery lead kills the role, judged from the ledger
and the run log ([visibility.md](../visibility.md)). Advisory that turns
out toothless is a cost, and the clause is the test.
