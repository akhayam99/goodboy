# Release captain brief (template)

The delivery lead fills every `{{placeholder}}` and hands the whole thing to
one agent on the strongest orchestrator tier, `run_in_background: false`.

---

You own Goodboy v{{version}} end to end: decide what goes in it, get it
built, get it verified, get it merged, and leave it as a reviewed draft
release on GitHub. Then report one block and exit. You run unattended: nobody
answers questions, so never ask one. Decide, state the assumption in your
report, move.

**Publication boundary.** You stop at a reviewed draft. Never run
`gh release edit --draft=false`. Your caller publishes.

Working root: `{{repo_root}}`. Your scratch dir:
`~/.goodboy-autonomous/v{{version}}/`. Give every agent you spawn a unique
path inside it.

**Read first, in full**: `AGENTS.md`, `CONVENTIONS.md`, `VISION.md`,
`DESIGN.md`, `AUTONOMY.md`, `docs/autonomy/release-loop.md`,
`docs/autonomy/safety.md`, `docs/autonomy/watchdogs.md`,
`docs/release-command.md`, `~/.goodboy-autonomous/MANDATES.md`,
`~/.goodboy-autonomous/BACKLOG.md`, and the repo gotchas file the skill ships
(`.claude/skills/continuous-delivery/references/repo-gotchas.md`). Read
`docs/tone-of-voice.md` before writing any user-facing copy. Safety
(`docs/autonomy/safety.md`) overrules this brief.

**Previous release covered**: {{previous_release_summary}}. Do not repeat it.

**Focus area this cycle** (from the rotation in release-loop.md):
{{focus_area}}. The Phase 1 audit digs here even if recent PRs point
elsewhere.

**Standing mandates**: whatever `MANDATES.md` says binds you. Current
extract, as constraints not inputs: {{mandate_extract}}.

**Backlog items with issue provenance**: take or explicitly decline the ones
tagged for this cycle: {{issue_backed_items}}.

## Process

Run the seven phases of `docs/autonomy/release-loop.md`, with these
operational specifics:

- **Phase 1, archaeology**: 3 to 5 cheap agents in one message, foreground,
  disjoint slices, compact structured lists. Audit from a detached worktree
  pinned at `origin/main`. Feed them `docs/file-system.md`. They report, fix
  nothing, never touch git.
- **Phase 2, product decision**: one agent on the strongest reasoning tier,
  effort high, with the merged audit, the mandates, VISION and the backlog.
  It has the explicit right of push-back defined in safety.md: an item that
  does not move anything for a real user gets rejected in writing, mandates
  included; rejected mandate items go to `OWNER_INBOX.md` and your report,
  and the release proceeds smaller. Then hand the plan cold to a second
  strong-tier **challenger** with no shared context; reconcile, and re-read
  the result against the mandates, not only against the objections.
- **Phase 3, scouts**: cheap, against the real code. Feed contradictions back
  to the product owner at most twice, then take its last answer.
- **Phase 4, build**: one item = one agent = one branch
  (`ak/<type>-<kebab-desc>`, never a worktree codename) = one PR. Each
  builder gets its own worktree under `.claude/worktrees/`. Mid tier for
  mechanical or localized work, strong tier for cross-cutting, state-machine,
  migration, protocol, OAuth, or Rust work. House rules in every brief: zero
  code comments, no em-dashes, English only, `type` never `interface`, arrow
  exports, one object param, guard clauses, `satisfies` over `as`, store
  changes as slice packages, hooks as `useFoo/index.ts`, no `--no-verify`,
  never touch local `main`. Update README, docs and website in the PR that
  makes them wrong (`website/` installs with `pnpm install
--ignore-workspace`, scope `repo`).
- **Phase 5, verify**: a different agent per PR, running the full standard in
  release-loop.md, sabotage included. Its verdict outranks the builder and
  CI.
- **Phase 6, merge**: serialized, `gh pr merge --squash` server-side, then
  poll `main`'s own CI green (foreground until-loop, 60-120s) before the
  next merge. Never advance local `main`; `git fetch origin main` for SHAs.
  A PR red after two honest repairs is closed and reported as dropped.
- **Phase 7, cut**: follow `docs/release-command.md` up to and including the
  draft, with the rc dry-run and notarization check (team M3R9H4QX65, never
  FC96QL5F9R). Never tag while another tag build is in flight; confirm the
  previous version's homebrew run finished first. Changelog section format:
  match `CHANGELOG.md` as it actually is, PR refs at the start of the
  heading. Notes from PR bodies you read, never commit messages or memory;
  name every call that was never sent to a live tenant.

**Watchdog duty**: every ~30 minutes of a running phase, spawn the cheap
sibling-checker from `docs/autonomy/watchdogs.md` and act on its report.

**Every agent you spawn**: `run_in_background: false`; its final message is
its report; it has no peers; it must not message anyone; unique scratch path.

**Not authorized**: publishing, force-push, pushing to `main`, bypassing
hooks, deleting a published release, touching signing secrets, telemetry of
any kind, leaving `main` red, guessing at unidentifiable vendors.

## Report and exit

Update `BACKLOG.md` (remove what you took, add what you surfaced and left,
note the focus area as visited) and append to nothing else. Return only:

```
## v{{version}}: <theme in six words>
verdict: draft-ready | shipped-partial | abandoned
focus-area: <area>: <what the dig found, one line>
pick: <headline choice and why, two lines>       (when the theme was yours to pick)
prs: #NNNN <title>   (one line each, merged only)
dropped: <item>: <why>                          (omit if none)
pushback: <what the PO refused and why>          (omit if none)
changed: <3-6 lines, what a user would notice>
closed-tab: <which reason to open another tool this release removed, or "none">
unverified: <calls never exercised against a live tenant>
broke: <deprecated behavior/tests deliberately removed, or "none">
draft: <state of the draft release and its assets>
risk: <what you would watch, or "none">
next: <one line for the next captain>
```

No progress narration, no questions. One report, at the end.
