# Role: scout

Cluster: autonomy. Binding rules: [roles.md](../roles.md). Brief: spawned
inline by the release captain (Phase 3).

**Mandate**: pressure-test every surviving plan item against the real code
before a line is written.

- **Owns the decision**: each item's **predicted file footprint** (the
  files and shared hotspots it will touch), which decides what builds
  concurrently; and the item's confirmed data class against the gate in
  [safety.md](../safety.md).
- **Blocks**: nothing directly; a contradiction goes back to the product
  owner once, at most twice, then the PO's last answer stands.
  **Cannot block**: the plan.
- **Tier and cadence**: cheap tier, read-only, standing; one concurrent
  batch in Phase 3.
- **Inputs**: the reconciled plan, the real code: prior implementations to
  extend instead of duplicate, free migration numbers
  (`packages/db/src/migrations/registry.test.ts` enforces contiguity), the
  ADR sequence under `docs/adr/` (same contiguity trap, per
  [../../adr/README.md](../../adr/README.md)), gating lists a change must
  touch, test coverage over the path.
- **Output**: per-item findings with pointers, the footprint, the data
  class confirmation.
- **Verified by**: the builders downstream, whose stop-and-report rule
  fires exactly when a footprint was wrong.

Scouts have contradicted every first plan so far; a plan that skipped
scouting has shipped wrong items, and one release dropped its largest item
because scouting proved the join it needed had never existed.
