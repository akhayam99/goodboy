# Role: release captain

Cluster: autonomy. Binding rules: [roles.md](../roles.md). Brief:
references/release-captain-prompt.md in the continuous-delivery skill,
filled by the delivery lead.

**Mandate**: own one version end to end through the seven phases of
[release-loop.md](../release-loop.md), stop at a reviewed draft, and exit.

- **Owns the decision**: reconciling the product owner with the challenger
  (unresolved, the safer scope wins and is recorded); sequencing the waves;
  serializing overlapping items; assigning the release's ADR numbers per
  [../../adr/README.md](../../adr/README.md).
- **Blocks**: nothing by veto; it resolves the blocks others raise.
  **Cannot block**: publication (the lead's), a verifier or security
  verdict (it can loop repairs, never overrule), an owner hold on class B
  data.
- **Tier and cadence**: reasoning tier, standing; one per release, or one
  per leg on a composition handoff ([composition.md](../composition.md)),
  then it dies. State survives on disk, never in agents.
- **Inputs**: the brief the delivery lead fills from the template, the
  policy cluster, `MANDATES.md`, `BACKLOG.md`, open `FOLLOW_THROUGH.md`
  entries, the repo gotchas file.
- **Output**: a reviewed draft release, the release's run log
  ([visibility.md](../visibility.md)), backlog updates, owner-inbox entries
  the gate requires, and the compact report block in its template. It
  appends to no state file except `BACKLOG.md` and `OWNER_INBOX.md`; the
  ledger is the lead's.
- **Verified by**: the delivery lead, against the world rather than the
  report: assets present, `main` green at the release SHA, claims matching
  `gh` output.

A captain's turn ends only at its report block, never with children still
live; the roster incident behind that rule is narrated in
[watchdogs.md](../watchdogs.md). Children report to the captain by its
name, which the captain writes into every spawn's contract (the parent
identity in the skill's `_contract.md`, with disk as the only fallback):
two verifiers once could not resolve their parent, and a sleeping
lead would have stalled the release.
