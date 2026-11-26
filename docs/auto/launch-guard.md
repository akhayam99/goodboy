# Launch guard and landing backstop

> **Read this when** you change how the Add or upgrade dependencies and Change
> protected files rows hold a Lead's writer: the guard at its start, the deny
> rules on its spawn, an allowance, or the backstop that refuses a change when
> the attempt lands or publishes. **Not for** the rows and grant asks
> themselves ([permissions.md](permissions.md)) or the publish gates
> ([publish.md](publish.md)).

The two rows are enforced when a writer starts, and checked again by the
backstop when its result lands and publishes.

## The lists

`packages/core/src/auto/launchGuard.ts` holds them once:

- `PROTECTED_FILE_PATTERNS`: host CI config, git hooks, code owners (env files
  are off: git ignores them).
- `PACKAGE_MANAGERS`: per manager the add, upgrade and install commands,
  manifests, lockfiles and offline settings.
- `OFFLINE_PACKAGE_MANAGERS`: npm, pnpm, pip, uv and cargo, whose settings were
  checked by hand so an add that would download fails. Yarn, bun and go rely on
  the deny rules and the backstop, as the row's help line says.

## At the start

1. `launchChildren.ts` reads both rows for a writer with `readLaunchPermissions`
   (a failed read asks both) and hands them to `startAttempt`.
2. `launchGuardStart` (`store/runtime/auto/launchGuard/`) reads the allowances of
   the delegation it retries (`listAutoGrantAllowances`), builds the guard with
   `launchGuardOf` and stores it in `write_set_json.guard`.
3. `markAutoGrantUsedStatement` for each allowance sits in the attempt insert's
   transaction: Allow twice starts one attempt, and a crash after Allow
   relaunches with it.

With both rows at Allow there is no guard and the write set is exactly
`{ worktreePath }`. A resumed attempt (`answerQuestion`) copies the paused
guard, and a relaunch reads the stored guard, never today's rows.

## On the spawn

`resolveChildTurn` reads the latest attempt's guard (an unreadable attempt
refuses the turn), and `readTurnStream` sends `launchGuardRulesOf` as
`launchGuard`: Claude deny rules for add and upgrade commands and for edits of
manifests, lockfiles and protected patterns (appended to `--disallowedTools` in
`cli_args.rs`); the offline settings in the env (`providers/launch_guard.rs`,
which refuses a guard on any CLI but Claude or Codex and any reserved name); and
for Codex no `sandbox_workspace_write.network_access=true`. Codex has no per-file
rule, so for protected files the backstop is the enforcement.

## An allowance lifts one

A dependency allowance names one package (and its version when given). Deny rules
cannot name an exception, so add, upgrade and install-with-arguments stay denied,
and so do hand edits of lockfiles. It lifts the manifest edit rules, the network
and the offline settings for that attempt, so the agent writes that one entry and
runs the install with no arguments. It is dropped when the row already allows
every dependency. A protected file allowance lifts only the pattern holding its
path.

## The brief and the ask

`launchGuardBriefOf` (`kickoff.ts`) joins the brief after
`AUTO_DEPENDENCIES_RULE` ([roles.md](roles.md#dependencies-in-the-brief)): do not
add or upgrade (installing the lockfile is fine), and when one is needed end with
`needs="dependency"` or `needs="protected_file"` and one line naming the package,
version and why, or the path and why. An allowance adds "You may add
nock@14.0.1" and says to edit by hand and install with no arguments.

When the attempt returns with that need and its guard asks, `needGrantsOf` adds
the `auto_grants` row in the settle transaction (`settleAttempt` `grants`),
subject from `needSubjectOf` (`nock@14.0.1`, or the path; a path off the list
asks nothing).

1. The Lead reads "the user is asked to allow it", and `waitingReturnsOf` leaves
   the agent out of its decisions meanwhile.
2. After `answerGrant`, `restartAfterGrant` starts it again through
   `continueChild`: Allow with that allowance, "Do it without" with the answer in
   the brief. Neither is undone; a late answer for a superseded attempt is
   dropped.
3. If the restart is refused (blocked or at the limit), the agent returns to the
   Lead's decisions and the allowance waits for its next retry.

## Landing backstop

Deny rules match commands, so an agent can work around one. The backstop is the
net behind the guard, not the permission. `changeGateOf`
(`packages/core/src/auto/changeGate.ts`) takes the rules (`readChangeRules`: both
rows read now, a failed read asks both, plus the attempt's stored allowances),
the changed paths and, with a dependency allowance, the patch
(`isDependencyPatchNeeded`). With both rows at Allow nothing is read. A row
tightened while the agent runs applies here.

- A manifest or lockfile of any manager, in any folder, is refused while the row
  asks, unless an allowance explains it (`unattributedDependencyPathsOf`,
  `dependencyChanges.ts`). A protected file is refused unless an allowed path
  names it.
- Each changed manifest line (`isManifestChangeCovered`) must be one entry, the
  allowed package, at exactly the allowed version (a `^`, `~`, `=` or `==` prefix
  passes; a range, `||`, a second specifier or entry, an inline table or extras
  do not). A moved line, a block opener and a removed line of that package pass.
- Each changed lockfile line (`isLockfileChangeCovered`) must belong to the
  allowed package or what it depends on in the patch: pnpm, yarn, npm and bun by
  indented entries, Cargo and uv by `[[package]]` blocks, `go.sum` by line. A new
  entry must carry the allowed version.
- An unattributed line, a binary lockfile, an uncommitted change with no patch
  and an unreadable patch all hold.

### At the end of an attempt

`finishAttempt.ts` reads the whole changed list (`attributeChanges`
`changedPaths`, not the capped `changedFiles`) and asks `landingRefusalOf`. A
list that cannot be read in full is refused: closed, not open. A refused result
settles `failed` with `changeRefusalOf`'s reason (the files, and that nothing ran
or landed): `verifyAttempt` is not called so no changed script runs, the publish
holds, the Scribe opens nothing, a revise does not land, and the Lead may start
the agent again.

### At publish

`planPublish` checks what the host would receive, on every plan, settle and
retry. The `readHostChanges` port (`launchGuard/readHostChanges.ts`) lists the
paths between the host's branch head (`worktreeRemoteHead`) and the commit to
push, or, when the branch or its head is not local, from the merge base with the
mount's base (`worktreeDiffFromMergeBase`, a three dot `worktree_diff_range`,
`origin/<base>` first), and returns the patch. A gated path holds with `so
nothing was pushed`; an unreadable list holds with the error and a retry. The
pull request path runs the same check (`hostChangeRefusalOf`).

A refused change stays in the worktree. A later attempt's own diff no longer
shows it, so that attempt can land, but the publish still sees it and holds until
an allowance covers it.

## Tests

- `launchGuard.test.ts` (one case per manager) and `launchGuard.sqlite.test.ts`
  (Allow, the stored guard, a later row change, Do it without, a protected path).
- `turn/fake_cli_tests.rs`: rules, settings and network at Ask, byte-equal at
  Allow.
- `changeGate.test.ts`, `launchGuard/readHostChanges.test.ts`,
  `launchGuard/changeGate.sqlite.test.ts` and the Rust
  `a_range_diff_from_the_merge_base_leaves_out_what_the_base_changed_since`.
