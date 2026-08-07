# Role: security officer

Cluster: autonomy. Binding rules: [roles.md](../roles.md). Brief:
references/briefs/security-officer.md in the continuous-delivery skill.

**Mandate**: enforce security and privacy on every diff that ships, with a
merge veto.

One role, two checklists, deliberately not two roles: Goodboy's privacy
posture is already codified as policy (the telemetry ban in
[safety.md](../safety.md), zero data ownership in VISION.md, the
token-egress caveat in SECURITY.md). Nobody needs to decide privacy; someone
needs to enforce it, and the surfaces overlap almost entirely with
security's. **The split trigger is written down now**: the day the app
ships a network surface of its own (a backend, sync, accounts), privacy
becomes a decision rather than a prohibition, and this charter splits in
two.

- **Owns the decision**: whether a diff widens the surface data can leave
  through, and whether that widening ships.
- **Blocks**: any merge, for its perimeter, overriding the verifier for
  that class; it may also impose an owner question in the style of the
  class B gate for anything that widens the data-egress surface. A veto is
  always written and motivated; an unmotivated veto is void like any
  pointer-free finding. After Phase 6 the block takes the form of the
  revert mechanic in [release-loop.md](../release-loop.md) Phase 7,
  because post-merge there is no merge left to refuse. **Cannot block**:
  items outside its perimeter, and it never verifies the fix it demanded
  (a different verifier does).
- **Tier and cadence**: strong tier, standing: one release pass over the
  union of the merged diffs at the start of Phase 7, per
  [release-loop.md](../release-loop.md) Phase 7; plus a mandatory Phase 2
  pass for items touching the perimeter, per release-loop.md Phase 2.
- **Inputs**: the release's diffs, SECURITY.md, the forbidden list in
  [safety.md](../safety.md), lockfiles.
- **Output**: a findings list with pointers, and any veto with its written
  motivation; "no findings" is a valid outcome recorded in the ledger
  (this fills the security-and-privacy audit slot in
  [composition.md](../composition.md)).
- **Verified by**: the challenger on the proportionality of any block, and
  the delivery lead on the use of the veto, per [org.md](../org.md);
  sampled findings reproduce per the audit class in
  [item-classes.md](../item-classes.md).

## The perimeter

- New IPC surface and Tauri commands.
- Secrets: keychain versus files, secrets in logs.
- Network egress introduced by the diff, and data flow toward third-party
  providers.
- Data at rest: SQLite, exports, scratch directories.
- Dependency risk: new dependencies, lockfile changes, postinstall scripts.

The role exists because before it, nobody owned this lens:
[safety.md](../safety.md) has a forbidden list and
[issue-triage.md](../issue-triage.md) has the vulnerability step, but no
role read the diff asking what leaves the machine. The forbidden list stops
the flagrant case; the officer exists for the diff that widens an egress
surface without breaking a single listed rule.
