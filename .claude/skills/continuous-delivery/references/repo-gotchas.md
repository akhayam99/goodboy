# Repo gotchas, earned the hard way

Verified facts from previous autonomous chains. Hand this file to every
release captain; captains hand the relevant lines to builders and verifiers.
When one of these stops being true, fix the line in the same PR that changes
the behavior.

## Worktrees and installs

- New worktrees need `pnpm install` (`CI=1`); reuse main's cargo target dir.
- `pnpm install` in a new worktree exits 1 at the `prepare` lifecycle
  (lefthook refuses when `core.hooksPath` points at the shared `.git/hooks`).
  Harmless: deps and native bindings install before `prepare`. Verify
  `node_modules` and `better_sqlite3.node` exist, then proceed. Do not reset
  `core.hooksPath`.
- Worktrees created with `--ignore-scripts` have no `better-sqlite3`
  bindings, so `@goodboy/db` tests error out and a "green" claim covers only
  the desktop package.
- `lefthook` silently no-ops if `.git/hooks/*` points at a deleted worktree.
  Run `pnpm exec lefthook install` and confirm.
- Never two agents in one worktree. Parallel agents doing `git reset` in a
  shared worktree destroy each other.

## CI, checks, merging

- The CI knip gate is `pnpm knip --include files,duplicates,unlisted`. Bare
  `pnpm knip` is red on `main`; do not chase its extra findings unless the
  work item is exactly that.
- The merge lane and its polling rule are owned by
  `docs/autonomy/release-loop.md` Phase 6; the one fact it lacks:
  `gh pr checks` on a branch proves nothing about the merge result, only
  `main`'s own CI does.
- `gh pr view --json mergeable` returns UNKNOWN for 20-30s after a sibling
  merges; poll until it settles.
- Background bash is killed at the turn boundary: poll CI in a foreground
  `until` loop. `until ! gh pr checks N 2>&1 | grep -q pending; do sleep 60;
done` works; nested-quote jq inside single quotes does not.
- A release build takes ~12 minutes, beyond the 10-minute Bash ceiling:
  budget two consecutive foreground loops.
- Force-push is not authorized: refresh a stale branch with
  `git merge origin/main`, never rebase.
- `registry.test.ts` in `packages/db` enforces a contiguous migration range:
  two parallel migration PRs must land in numeric order. Assign numbers up
  front and control the merge order.
- commitlint rejects camelCase identifiers in the commit subject: plain
  lowercase prose in the subject, identifiers in the body. Subjects over 72
  chars do not land.
- A stacked PR whose parent is squash-merged does **not** auto-retarget: it
  keeps pointing at the dead branch, and once retargeted to `main` it can go
  `CONFLICTING` (a modify/delete needing hand resolution). Stacking is
  banned by release-loop.md; if you inherit one, retarget it **before**
  merging it and expect one conflict per squashed parent.
- Neither `ci.yml` nor `rust.yml` has a `workflow_dispatch` trigger. When
  webhooks are throttled or a run was never dispatched, the only way to
  summon one for an open PR is closing and reopening it. Adding the trigger
  is a one-line `ci`-scoped change worth proposing as backlog work; until it
  lands, close and reopen is the only lever.
- Turbo caches are shared across worktrees: a `FULL TURBO` green can be a
  sibling's replayed log, not a run. `pnpm exec turbo run test --force` and
  a log saying `0 cached` is what a verifier's green claim rests on.

## Git hygiene

- `git add -A` at the repo root swallows the untracked cargo `target/`.
  Stage explicit paths.
- `gh pr merge --delete-branch` fails on a local branch still held by a
  worktree; harmless, the remote branch is deleted.
- `gh release download` fails with "not a git repository" outside the repo:
  use `--dir` and run from the repo root.
- `cargo fmt` formats the whole crate regardless of file arguments and
  reformats `provider_credentials.rs`, which is not fmt-clean on main.
  Revert that hunk before committing.

## Release mechanics

The steps, formats and checks are owned by `docs/release-command.md`; below
only what it does not say.

- `perl -i -pe '... if $. <= 5'` does not reset `$.` between files: bump
  each version file in its own invocation.
- `hdiutil` mounts a second copy at `/Volumes/Goodboy 1` when one is already
  mounted; detach before asserting paths.
- To smoke-test a dmg against real data safely, point `GOODBOY_DB_FILE` at a
  `VACUUM INTO` copy, never `copyFileSync` of the live DB.

## Running the built app

The Phase 7 walks (qa explorer, reliability owner, product critic) consume
a runnable build of merged `main`; this recipe fills their app-state
placeholder, so could-not-run is the exception, not the default.

- Build: `pnpm tauri:build` from a worktree pinned at merged `main`
  (a release build takes ~12 minutes; see the Bash-ceiling line above).
  The bundle lands at
  `apps/desktop/src-tauri/target/release/bundle/macos/Goodboy.app`.
- Launch the binary directly, never via `open`, so the env var applies:
  `GOODBOY_DB_FILE=<copy> .../Goodboy.app/Contents/MacOS/Goodboy`.
- Database isolation is mandatory for every walk, not only dmg smoke
  tests: `GOODBOY_DB_FILE` points at a `VACUUM INTO` copy per the line
  above. A walk against the owner's live database corrupts real state to
  test a draft.

## Audit and verification

The standard itself (sabotage, re-derive, scout pass, serialized merges) is
owned by `docs/autonomy/release-loop.md`; below are only the facts that doc
does not carry.

- The local checkout has been a full release behind more than once; that is
  why audit worktrees pin at `origin/main`.
- A test placed in a describe block does not necessarily exercise that
  block's branch, and a test written this round can assert the bug it was
  meant to catch. Both have shipped here; verifiers check for both.
- Subagents have reported green tests that were not green and negative
  claims ("X does not exist") that were false. Verify load-bearing claims
  from disk.

## Known traps in the product code

- `fetchIssueCandidates` has a deliberately dead `case 'bitbucket':
return []` arm, and `issueSources.ts` deliberately has no bitbucket entry.
  "Fixing" either ships a picker that lists nothing forever.
- `RemoteHostKind` deliberately has no `'bitbucket'`; adding it breaks the
  `never`-checked `resolveSessionStudioOpenEvent` and `remoteHost.test.ts`.
- The mobile companion's `fetchIssuesFor` and `resolveIssueForSession` fall
  through to GitLab for unknown providers; the gating lists
  (`ALL_ISSUE_PROVIDERS`, `CREATE_SESSION_PROVIDERS`) are hand-enumerated.
  Adding a provider to a list without a matching arm silently queries
  GitLab.
- `pending_resolutions` is a transient push queue, not a durable verdict
  log; making it durable was investigated and rejected. The durable source
  is message replay via `hydrateResolverOutcomes`.
- `LENS_KINDS` is a hand-maintained set whose only consumer is
  `readPersistedLens`; a missing entry silently breaks lens restore with no
  compile error.
- `LinkedPrChip` and `NewSessionView` sniff `[data-studio-overlay]` in the
  DOM; do not "fix" this without centralizing fullscreen-studio state first
  (`sessionStudio` tracks 3 kinds, `StudioShell` backs 17 studios).
