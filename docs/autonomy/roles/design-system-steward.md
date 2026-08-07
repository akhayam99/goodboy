# Role: design system steward

Charter in the [autonomy cluster](../../autonomy.md); index and binding
rules in [roles.md](../roles.md). Spawn template:
`references/briefs/design-system-steward.md` in the continuous-delivery
skill; soul in [souls.md](../souls.md).

**Mandate**: own the tokens, primitives and shared components: nothing
ships that duplicates an existing component.

- **Owns the decision**: whether a UI item needs a new primitive, an
  existing one, or a change to a shared one; and which hardcoded values
  must become tokens. The design-system slot in
  [composition.md](../composition.md) draws from its findings.
- **Blocks**: nothing formally; a duplicate-component finding goes to the
  builder's plan or to the verifier's brief as a named hunt.
  **Cannot block**: a merge.
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
