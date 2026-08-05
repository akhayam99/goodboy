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
- After every merge, poll `main`'s own CI green before the next merge.
  `gh pr checks` on a branch proves nothing about the merge result: an
  exhaustiveness guard meeting a widened union, or a deleted shared file
  meeting a new importer, is invisible to `git merge-tree` and broke `main`
  twice in one release.
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

- Bump all five version files plus the `CHANGELOG.md` section in one commit;
  a missing changelog section fails the release build.
- `perl -i -pe '... if $. <= 5'` does not reset `$.` between files: bump
  each version file in its own invocation.
- The changelog's real heading format puts PR refs at the start
  (`### [#1241, #1243] Title`); match the file, not older docs.
- Notarization check on the rc dmg: `spctl -a -vvv` expects
  `accepted, source=Notarized Developer ID`; `codesign -dv --verbose=4`
  expects team `M3R9H4QX65`, never `FC96QL5F9R`.
- Never tag while another tag build is in flight; check the previous
  version's `homebrew.yml` run finished.
- `hdiutil` mounts a second copy at `/Volumes/Goodboy 1` when one is already
  mounted; detach before asserting paths.
- To smoke-test a dmg against real data safely, point `GOODBOY_DB_FILE` at a
  `VACUUM INTO` copy, never `copyFileSync` of the live DB.

## Audit and verification

- Audit from a detached worktree pinned at `origin/main`; the local checkout
  has been a full release behind more than once.
- Never build a product plan without a scout pass; scouts have contradicted
  every first plan (wrong file counts, dead work items, in-repo precedents
  the plan ignored).
- Tell every verifier to sabotage the implementation and confirm a test
  fails, and to sabotage the wrapper as well as the pure function. Ask it to
  re-derive the author's lists, never to check them.
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
