# What a child result holds

> **Read this when** you change the verified facts of a Lead child's result:
> the files it changed, the checks Goodboy ran on it, whether its branch moved
> online, or the outcome line every Auto message starts with. **Not for** how
> the result card draws them ([children.md](children.md#what-the-agents-reported))
> or the push that may follow ([pushing.md](pushing.md)).

A writer's verified facts live in `result_json.verified`. Read-only roles carry
none of them.

## Changed files

`verified.changedFiles` lists what a writer attempt changed, committed work
included. `attributeChanges` (`packages/core/src/auto/attribution.ts`) starts
from the status snapshots at launch and settle and adds the tree diff between the
launch head and the settle head (`readCommittedFilesOf`, port
`readCommittedFiles`, the `worktree_diff_range` command; `pathsOfPatch` lists
both sides of a rename).

- The diff compares trees, so history rewritten to the same tree lists nothing. A
  head that did not move skips the read.
- An unreadable diff falls back to the status files with `isComplete` false.
- A read-only role's change is still the `role_read_only_violation`.
- The list is capped at 50 files; the backstop reads the whole list
  ([launch-guard.md](launch-guard.md#at-the-end-of-an-attempt)).

## Checks

`verified.checksRun` holds the verdict of the scripts the user ticked as Auto
checks (`green`, `red`, or `not_checked` with a `reason`) and the `commit` they
ran on; `verified.checks` has one `harness` row per script. The outcome stays
`completed`. `checksVerdictOf` and `checksTextOf`
(`packages/core/src/auto/checks.ts`) own the verdict and its one line ("Checks
green: typecheck, lint", "Not checked: timed out"). `unknown` and `timed_out`
never read green.

| `reason`        | When                                     |
| --------------- | ---------------------------------------- |
| `none_ticked`   | No script ticked                         |
| `check_missing` | A ticked script the branch does not have |
| `timed_out`     | Past `AUTO_CHECK_TIMEOUT_MS` (5 minutes) |
| `tree_moved`    | The head or tree changed around the run  |
| `tree_dirty`    | Uncommitted changes                      |
| `not_available` | No end head                              |

A script is ticked next to its pin in the project settings (`toggleAutoCheck`,
key `scripts.autoChecks.<projectId>`, a JSON array of `scriptPinId` ids). Toggles
of a project run in one keyed queue, so two quick ticks keep both and a failed
save keeps the old selection. A ticked script the branch lacks is never dropped:
`listAutoChecks` returns it under `missing` (`missingCheckName`), nothing runs,
and `missingChecksOf` gives one `unknown` row per script ("Not checked: not on
this branch: lint").

### Running

`finishAttempt` calls `verifyAttempt` before the settle, only for a writer that
ended ok and closed with `done`.

1. The run is pinned to attribution's end head (`expectedHead`), so a run that
   waited while the head moved reads `tree_moved` and runs nothing.
2. `runAutoChecks` refuses a dirty tree (`tree_dirty`) and runs the scripts one
   by one through the `listChecks` and `runCheck` ports, which reuse the Scripts
   runner (the runs show on the Scripts page). Exit 0 is `pass`, a positive code
   `fail`, a run that could not start `unknown`.
3. It reads the snapshot again; a different head or any change reads
   `tree_moved` and drops the results.

A script past the timeout is cancelled and reads `timed_out` only once its
process ended. One still alive 30 seconds after the stop marks its worktree, and
every check there reads `unknown` until it ends (the user can force it from the
Scripts page). Runs on one worktree path share a keyed queue, the settle's and
the rerun's alike.

**Retry checks** (`rerunChecks`, forwarded to the main window with a 30 minute
wait) reruns against the recorded `commit`, offered only when `canRerunChecks`
(a commit known, something ticked, the tree was not dirty). A moved head, a dirty
tree or nothing ticked refuses with a sentence and keeps the old verdict.
Otherwise `patchAutoDelegationChecksStatement` and
`patchAutoAttemptChecksStatement` rewrite delegation and last attempt in one
transaction guarded by generation, so a late rerun writes nothing. A `red`
verdict holds the publish ([pushing.md](pushing.md#the-gate)).

## Remote watch

A push that slipped through is seen, not stopped.

1. When a writer attempt launches, first or resumed (`launchChildren.ts`,
   `attemptToLaunch`), `readRemoteHead` reads the branch's online sha
   (`worktree_remote_head`, `git ls-remote origin`) and `attemptBaseline.ts`
   stores `baseline_json.remote` (`sha`, `absent` or `unknown`).
2. At the settle `finishAttempt.ts` reads the branch recorded at the start again,
   and `remoteVerdictOf` (`packages/core/src/auto/remoteWatch.ts`) writes
   `verified.remote`: `unchanged`, `moved` or `unknown`, with branch, before and
   after.

- A failed read on either side is `unknown`, never `unchanged`; a branch that
  appeared or vanished is `moved`. No `origin` reads `unknown`.
- Attempts with no recorded baseline carry no `remote`. Failed and joined
  attempts (`failAttempt.ts`, `join.ts`) are not read.
- The outcome does not change. The card and the digest (`renderDelegationResult`)
  say the branch changed online, or could not be checked, and nothing for
  `unchanged`.

## The outcome line

Every message that ends an Auto turn or a child's work starts with one
`<<outcome>>text<</outcome>>`, at most `OUTCOME_MAX_CHARS` (100). The Auto prompt
asks for it (`READING_ORDER_RULE`) and every kickoff too (`OUTCOME_EXPECTED_NOTE`).
`core/auto/outcome.ts` owns it: `parseOutcomeLine` takes the last block,
`stripOutcomeLine` removes the blocks from the prose, `outcomeLineOf` decides the
line shown.

Markers are read tolerantly, because models mistype the close: an `outcome` word
led by up to six `<` or `/` and closed by up to three `>` is a marker, a slash
makes it a close, a second open ends the block, a stray close is dropped, and an
open with nothing after it hides the rest. The scan is one linear walk with no
regular expression. `AssistantText` strips the outcome before other markers.

The model never overrides the facts: red checks give "Checks failed: n", and a
failed, declined or put back push gives `publishTextOf`'s "Not pushed" text. With
no line the outcome word shows ("Done", "Failed: reason"), and with neither, no
line. The tone is data (`success`, `danger`, `warning`, `neutral`).
