# Autonomy: the release loop

Part of the [autonomy cluster](../autonomy.md). This file owns the shape of
one autonomous release: the phases, the area rotation that keeps the whole
product scouted, the verification standard, and the merge discipline. What
goes into the batch is owned by [composition.md](./composition.md); outages
and the build-ahead mode by [infrastructure.md](./infrastructure.md). The
mechanics of tagging and notarization live in
[release-command.md](../release-command.md) and [release.md](../release.md);
the repo-specific gotchas live with the `continuous-delivery` skill.

One release captain owns one version, runs these phases in order, stops at a
reviewed draft, and exits. The next version gets a fresh captain: state lives
on disk (ledger, backlog, mandates), never in a surviving agent. The phases
are ordered but not barriered: build and verify stream, so a verifier starts
the moment its build lands while other builds still run. Only the merge
phase is a true barrier, because `main` is one resource.

## The thesis every release is measured against

Goodboy wins when the user never opens the other tool. Every work item answers
three questions or is rejected: **what do I see, what can I do to it, where
does it take me next.** The non-coder read is first-class: a release must not
regress the path where a PM understands the same task without ever seeing a
raw diff.

## The phases

1. **Archaeology.** 3 to 5 cheap read-only agents spawned as one concurrent
   batch, disjoint slices, compact structured findings: recent intent (last
   15 to 25 merged PRs against `origin/main`), the focus area of the cycle
   (see rotation), debt and seams, plus whatever the theme needs
   (scaffolding checklists, feasibility of the candidate headline). Audit
   from a worktree pinned at `origin/main`, never a possibly stale local
   checkout.
2. **Product decision.** The product owner turns audit, mandates, VISION and
   backlog into a theme plus a batch of 3 to 6 one-PR work items, sized,
   persona-tagged, composed per [composition.md](./composition.md) (the
   issue/internal split, author weighting, declared deviations), with
   explicit non-goals and per-item risk. Items touching schema or stored
   data carry their data class per the gate in [safety.md](./safety.md),
   and the owner question for any class A or B item is written **before
   Phase 4 starts**. The challenger attacks the plan cold; any item
   touching schema or stored data gets its schema design challenged on its
   own. The captain
   reconciles, re-reading the result against the mandates, not only against
   the objections.
3. **Scouting.** Cheap agents, one concurrent batch, pressure-test every
   surviving item against the real code: prior implementations to extend,
   migration numbers free
   (`packages/db/src/migrations/registry.test.ts` enforces contiguity),
   gating lists and switches a change must touch, test coverage over the
   path. Each scout also returns its item's **predicted file footprint**:
   the files it expects to touch, plus any shared hotspot it crosses (the
   app shell, store slice barrels, provider gating lists, shared registries;
   the places most items meet). Contradictions go back to the PO once, at
   most twice, then the PO's last answer stands.
4. **Build, concurrently where footprints allow.** One item, one builder,
   one branch (`ak/<type>-<kebab-desc>`), one PR, one fresh worktree per
   builder, every branch cut from `origin/main`.
   - Items whose footprints share no file and no hotspot build
     concurrently, spawned as one batch under the roster contract in
     [watchdogs.md](./watchdogs.md), **at most three at once**: whole
     workspace test runs and cargo builds contend on one machine, and
     load-induced flakes read as red, which the two-repair rule then turns
     into dropped healthy PRs. The captain may raise to four only when the
     concurrent items are docs- or UI-light.
   - Overlapping items either collapse into one item at plan time (when
     they are honestly one concern) or serialize: the second builder starts
     from a fresh `origin/main` after the first item's PR merges.
   - **Never stack a PR on an unmerged branch.** A stacked child does not
     retarget when its parent is squash-merged, and it lands conflicting
     the moment it is retargeted; both have cost real repair time.
     Independent branches from `main` are faster and safer.
   - A builder that finds it must touch a file another live item claims
     stops and reports; the captain serializes the remainder rather than
     letting two agents race on one file.
   - House rules travel in every builder brief. Docs, README and website
     are updated in the same PR that makes them wrong.
5. **Verify, streaming.** A different agent per PR, always, spawned as each
   build lands rather than after all of them, in its own worktree checked
   out at the PR branch, never the builder's. See the standard below. The
   verifier's verdict is the one the captain trusts, over the builder's
   report and over green CI. Repairs loop per PR (builder or a fresh
   repair agent, then re-verify) without holding the other lanes.
6. **Merge.** Serialized, never parallel, and this survives every speedup:
   merge one PR server-side, then poll `main`'s own CI to green before
   merging the next. Two PRs each green alone have broken `main` together
   twice (an exhaustiveness guard meeting a widened union; a deleted shared
   component meeting a new importer), and concurrent builds widen exactly
   that window, so the serial merge lane is what pays for the parallel
   build lanes. When the just-merged PR and the next in the queue touch the
   same package, refresh the next branch with `git merge origin/main` and
   let its CI re-run before merging it. A PR red after two honest repair
   attempts is closed and recorded as dropped. A class B data change with
   no owner answer does not merge; the release ships without it per
   [safety.md](./safety.md).
7. **Cut the draft.** The challenger reviews the release notes first, per
   its charter in [roles.md](./roles.md). Then: version bump in all five
   files plus the changelog
   section in one commit, release PR, merge, rc dry-run with notarization
   verified, then the real tag and the draft release. Stop there: the
   delivery lead publishes after review. Never tag while another tag build is
   in flight.

Afterwards the captain updates the backlog (what it took, what it surfaced
and left), writes its full narrative to its scratch dir, and returns its
compact report block; the delivery lead is the only writer of the ledger and
appends the block there.

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
- **Sabotage the implementation and confirm a test fails.** Commit the
  checked-out state first, so an interrupted verifier leaves a branch and
  not a wreck. Sabotage the
  wrapper as well as the pure function; builders' helpers have survived
  sabotage while the commands calling them did not. A test nobody can make
  fail is not a test. Report sabotages as a table with a survived column:
  "all tests green" and "the fix is pinned" are different claims.
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
   merges, hunted anyway, and hunted harder now that builds run
   concurrently: before each merge, re-run `git merge-tree` against current
   `main` and ask what the just-merged diff changed that this one consumes.

### The data playbook

For any PR that touches the schema or stored data, on top of everything
above, run by the second verifier the gate in [safety.md](./safety.md)
assigns:

- Run the migration against a `VACUUM INTO` copy of a production-shaped
  database, never a synthetic empty one and never a `copyFileSync` of a
  live file.
- Kill the migration partway through and prove the app recovers on next
  launch: resumes, or rolls back clean. A crash mid-migration is a state a
  real user will hit.
- Prove the previous app version against the migrated database does what
  the item claims: for class A, opens and runs; for class B, state exactly
  what breaks, because that is what the owner is being asked to accept.
- Verify the migration number is still free at merge time, not just at
  scout time: two concurrent migration PRs must land in numeric order.

## Honesty in the notes

Release notes come from the merged PR bodies the captain actually read, in
the repo's tone of voice, which owns their shape and length
([tone-of-voice.md](../tone-of-voice.md) sets the heading form, the paragraph
budget and the follow-up line).

What was never exercised against a live service is still tracked in full, but
each audience gets it in its own form. The captain's report and the PR bodies
name it flatly, because the delivery lead and the reviewer need the risk.
The notes carry it as a **follow-up**: what the work stands on, and what the
app does if reality disagrees. Never a confession of not having tested.
Silence is still the defect; self-flagellation is not the cure.
