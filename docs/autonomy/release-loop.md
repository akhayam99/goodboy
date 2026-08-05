# Autonomy: the release loop

Part of the [autonomy cluster](../autonomy.md). This file owns the shape of
one autonomous release: the phases, the area rotation that keeps the whole
product scouted, the verification standard, and the merge discipline. The
mechanics of tagging and notarization live in
[release-command.md](../release-command.md) and [release.md](../release.md);
the repo-specific gotchas live with the `continuous-delivery` skill.

One release captain owns one version, runs these phases in order, stops at a
reviewed draft, and exits. The next version gets a fresh captain: state lives
on disk (ledger, backlog, mandates), never in a surviving agent.

## The thesis every release is measured against

Goodboy wins when the user never opens the other tool. Every work item answers
three questions or is rejected: **what do I see, what can I do to it, where
does it take me next.** The non-coder read is first-class: a release must not
regress the path where a PM understands the same task without ever seeing a
raw diff.

## The phases

1. **Archaeology.** 3 to 5 cheap read-only agents in parallel, disjoint
   slices, compact structured findings: recent intent (last 15 to 25 merged
   PRs against `origin/main`), the focus area of the cycle (see rotation),
   debt and seams, plus whatever the theme needs (scaffolding checklists,
   feasibility of the candidate headline). Audit from a worktree pinned at
   `origin/main`, never a possibly stale local checkout.
2. **Product decision.** The product owner turns audit, mandates, VISION and
   backlog into a theme plus 3 to 6 one-PR work items, sized, persona-tagged,
   with explicit non-goals and per-item risk. The challenger attacks the plan
   cold. The captain reconciles, re-reading the result against the mandates,
   not only against the objections.
3. **Scouting.** Cheap agents pressure-test every surviving item against the
   real code: prior implementations to extend, migration numbers free
   (`packages/db/src/migrations/registry.test.ts` enforces contiguity),
   gating lists and switches a change must touch, test coverage over the
   path. Contradictions go back to the PO once, at most twice, then the PO's
   last answer stands.
4. **Build.** One item, one builder, one branch (`ak/<type>-<kebab-desc>`),
   one PR, one fresh worktree per builder. Parallel only when items do not
   overlap in files; overlapping items serialize. House rules travel in every
   builder brief. Docs, README and website are updated in the same PR that
   makes them wrong.
5. **Verify.** A different agent per PR, always. See the standard below. The
   verifier's verdict is the one the captain trusts, over the builder's
   report and over green CI.
6. **Merge.** Serialized, never parallel: merge one PR server-side, then poll
   `main`'s own CI to green before merging the next. Two PRs each green alone
   have broken `main` together twice (an exhaustiveness guard meeting a
   widened union; a deleted shared component meeting a new importer). A PR
   red after two honest repair attempts is closed and recorded as dropped.
7. **Cut the draft.** Version bump in all five files plus the changelog
   section in one commit, release PR, merge, rc dry-run with notarization
   verified, then the real tag and the draft release. Stop there: the
   delivery lead publishes after review. Never tag while another tag build is
   in flight.

Afterwards the captain updates the backlog (what it took, what it surfaced
and left) and returns its report block; the delivery lead is the only writer
of the ledger and appends the block there.

## Area rotation

Recent PRs show trajectory, and trajectory tunnels: five releases of depth on
one surface starved the rest until the owner intervened. So each cycle names
one **focus area** in Phase 1, drawn from a rotation, and the audit digs
there even when recent history points elsewhere. This file owns the rotation
list; the ledger's per-release `focus-area` line is the visitation record the
delivery lead picks from. The rotation, extended as the product grows:

- workflows and agents (advance, carry-forward, routing, races)
- resolve, end to end against diff and the code hosts
- integration surface (render, act, route; one anatomy; write paths)
- UX and UI fine pass (layout, visual polish, copy, seams between sections);
  this area is never "done" and returns more often than the others
- legacy surfaces due a structural refactor (a page or flow the conventions
  outgrew)
- onboarding and first-run
- performance and startup
- the board, sessions and navigation
- providers, routing and cost surfaces
- themes and appearance beyond the current pair
- localization readiness and stray non-English strings
- docs and website truthfulness against the shipped app
- cross-integration ideas (what talks to what; hosts as code hosts vs task
  managers; notes on a project; pulling main from the board)

The headline still follows the mandates; the focus area shapes the body work
and the backlog. An area visited by no cycle in recent memory outranks one
visited last week.

## The verification standard

Every PR, before merge:

- `pnpm typecheck`, `pnpm test` across the whole workspace (native bindings
  present, otherwise the "green" claim covers one package), and the CI knip
  gate `pnpm knip --include files,duplicates,unlisted`.
- Read the diff against the work item, not against the PR body.
- **Sabotage the implementation and confirm a test fails.** Sabotage the
  wrapper as well as the pure function; builders' helpers have survived
  sabotage while the commands calling them did not. A test nobody can make
  fail is not a test.
- Re-derive the builder's claims instead of checking them: enumerate the call
  sites yourself, count the live symbols yourself.
- Tests are not sacred. A test pinning deprecated behavior gets deleted or
  rewritten, said so in the PR body. A test failing because the change is
  wrong means the change gets fixed. The verifier states which, with
  reasoning, and never weakens an assertion that still describes intended
  behavior.

Regression classes to hunt, all shipped in this repo at least once:

1. A gate added at one entry point with a sibling call site left un-wired and
   `void`-invoked, failing silently. Enumerate every caller.
2. A render path (lens, slot, tab) that typechecks and tests green but cannot
   be reached from the state that is supposed to mount it. Trace state to
   component.
3. A write path that compiles and is unreachable from the UI, or reachable
   but posting to the wrong object. Trace each verb from button to request.
4. A provider added to a shared list without an arm in every switch that
   consumes it, falling through to the wrong host. Enumerate the gating
   lists.
5. Two PRs green alone that break `main` together. Answered by serialized
   merges, hunted anyway.

## Honesty in the notes

Release notes come from the merged PR bodies the captain actually read, in
the repo's tone of voice. What was never exercised against a live tenant is
named in plain language in the notes, the PR bodies and the report: shipping
unverified-but-honest is the house standard, shipping unverified-and-silent
is a defect.
