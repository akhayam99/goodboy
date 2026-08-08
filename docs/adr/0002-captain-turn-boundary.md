# 0002. Bind the release captain's turn to its report block

status: accepted
date: 2026-08-08
owner: head of engineering, per its charter's structural-decision clause
(`docs/autonomy/roles/head-of-engineering.md:13-14`: "it writes the ADR for
structural decisions")
reviewed-by: the challenger, who located this gap against the captain
template, the shared spawn contract and watchdogs.md; and the release
captain, the role this rule binds. Per the review rule in
`docs/adr/README.md:38-39` ("the challenger reviews every ADR, plus one
role that would be bound by it").

## Context

`docs/autonomy/watchdogs.md:27-30` records the incident this decision
closes: "one captain ended its turn with five children still live at
6-item scale, having lost track of them." A release captain spawned
children and returned control to its caller while they were still running,
which is the silent-stall failure the watchdog cadence in that same file
exists to catch, not to prevent at the source.

The rule that would have prevented it already exists in one place: the
captain's own role charter, `docs/autonomy/roles/release-captain.md:32-36`,
states "A captain's turn ends only at its report block, never with children
still live" and points to `watchdogs.md` for the incident. But the
captain's actual reading list, in
`.claude/skills/continuous-delivery/references/release-captain-prompt.md`,
never includes that charter file: the brief's phase-triggered-reads
paragraph (its lines 48-49, before this PR) names a role's charter as read
"when you spawn that role," and a captain never spawns itself. A rule that
lives only in a
document the bound role never reads is not a rule that role follows, it is
a rule that role happens to satisfy until it does not.

Checking where the gap actually was, rather than assuming the prompt was
the whole fix, found it was narrower and wider than expected:

- `release-captain-prompt.md:10-11` and `:243` (base `a2d5066b5`, before
  this PR) describe the report's shape ("report one block and exit," "No
  progress narration, no questions. One report, at the end."): they say
  what the report looks like, not that nothing may end the turn before it.
- `release-captain-prompt.md:195-197` (same base) reads "children follow
  the roster contract in `docs/autonomy/watchdogs.md`; run that file's
  sibling-check cadence against your roster while children run and act on
  its reports": grammatically this **assumes** the captain is still
  running when children run; it does not **require** that it stay running.
- `references/briefs/_contract.md` (same base), the file prepended to
  every specialist spawn, bound the spawned child (scratch path, work-alone
  rule, soul) but said nothing about what its parent owes it while it is
  alive.

So the rule survived only by being hand-pasted into each captain's filled
brief by its caller (the delivery lead), each release, which does not
scale and fails silently the one time it is forgotten. Per
`docs/autonomy/item-classes.md:97-100`, an org item must cite one incident
in two distinct releases or a single severe one; the incident above is
severe on its own terms (five live children, one captain, complete loss of
tracking) and is the only citation this record relies on.

## Decision

Carry the turn-boundary rule into every place a captain's behavior is
actually assembled from at spawn time, each in that file's own voice, and
touch nothing else:

- `.claude/skills/continuous-delivery/references/release-captain-prompt.md`
  (the read captains actually run on): a new **Turn boundary** paragraph at
  lines 16-22, next to the existing Publication boundary, stating the turn
  ends only at the report block and that spawning children then handing
  back to the caller is the failure watchdogs.md exists to prevent. The
  roster-contract paragraph at lines 199-207 gained one sentence (205-207)
  tying the rule to the phase-boundary mechanics already in
  `docs/autonomy/watchdogs.md`.
- `.claude/skills/continuous-delivery/references/briefs/_contract.md` (the
  contract every spawned child receives): a new bullet at lines 17-21
  stating, from the child's side, that its parent's turn does not end
  while it is live.
- `docs/autonomy/watchdogs.md` (the file that owns liveness policy): a new
  **The turn boundary** paragraph at lines 35-40, inside the roster
  contract section, stating the rule as policy and naming it as the direct
  fix for the incident the same section already narrates.

The role charter (`docs/autonomy/roles/release-captain.md:32-36`) already
carried this rule and is left unchanged; it was never the gap.
`docs/autonomy/roles.md` and `AUTONOMY.md` are pure indexes (one line per
role, or an enumeration with an explicit "not agent read material" notice)
and carry no rule text for any role, so neither needed a fourth copy of
this one.

## Consequences

A captain reading its own brief, its own roster-contract paragraph, and
the contract prepended to every child it spawns now meets this rule three
times before it can miss it once, without depending on the delivery lead
remembering to hand-paste it into a filled brief. That closes the
mechanical gap.

It does not close the verification gap: this is an org item, and
`docs/autonomy/item-classes.md:69-74` is explicit that an org item "cannot
be verified in the cycle that writes it," because the rule has not run
yet. This record ships `pending-verification`. The next release's captain
is the first one to actually run under a template that carries this rule
inline, and it is the next release's ledger entry, not this one, that can
say whether a captain still ended its turn early. Until that judgment
lands, this ADR records a decision, not a result.

## Alternatives considered

- **Patch only the prompt template.** Rejected: the prompt is what a
  captain reads, but `_contract.md` is what every child was spawned under,
  and a rule the parent follows that the child's own contract is silent on
  is only carried from one side. Both needed it, in each one's own voice.
- **Rely on the existing charter and stop.** Rejected: the charter already
  states the rule (`roles/release-captain.md:32-36`) and the incident
  still happened, because the charter is not on the captain's own reading
  list. A rule nobody reads at the moment it matters is not a rule.
- **A fourth copy in `AUTONOMY.md` or `docs/autonomy/roles.md` for
  visibility.** Rejected: both files are explicitly indexes, not rule
  text (`AUTONOMY.md:6`: "nothing else"; `roles.md`'s role list is one
  line of mandate per role). A fourth copy of a rule that already lives in
  three places, each at its own altitude, is the third-copy drift this
  cluster warns against elsewhere, not a safety margin.
- **Widen this ADR to also fix the underlying reading-list gap** (the
  charter a captain never reads). Rejected as its own item: the footprint
  discipline in `docs/autonomy/item-classes.md:22-26` treats a crossed
  class or scope boundary as two items, and reworking the captain's
  read-first list is a different, larger change than restating one rule in
  three files.
