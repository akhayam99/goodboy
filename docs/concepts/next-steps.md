# Next steps

> **Read this when** you add a suggestion kind, change how a move is ranked,
> dismissed or undone, or change where a suggestion shows. **Not for** the rows
> of the Activity feed ([activity.md](activity.md)) or the words of a label
> ([vocabulary.md](vocabulary.md)).

One engine, `deriveNextSteps` (`features/suggestions/`), decides everything the
app suggests doing next. Nothing else derives a suggestion, and every surface
calls the same `useSuggestionActions` resolver, so "Continue" does the same
thing on the board and in the overview.

## A move

A suggestion is a **move**. `deriveNextSteps` takes one `signals` object
(`NextStepSignals`, `features/suggestions/nextStepSignals.ts`) and returns
`NextMove` values, so it runs for any session with no mounted view. A move
carries:

- a **reason** in words. `moveOf` drops a move with none.
- its **evidence**: log lines of a failed check, the files of the last turn, the
  command, how long an agent is quiet, or **Open on** a host for a check outside
  GitHub Actions
- its **place**: the tool that acts and the mount it acts on
- **completesWhen**: what ends it
- a **group**: moves that unblock the task first, then moves that carry on, then
  upkeep. Upkeep shows one move, only when nothing else is left
  (`keepOneUpkeep`).

Each suggestion also has a **band** (0 waits on you, 1 unblocks, 2 ships, 3
improves), a **why** (its second line), a **fingerprint** (kind, object, trigger
version) and a **target key** (the object it is about). `dedupeByTargetKey`
keeps one per target key, the lower band.

### Freshness

A move built from a pull request read is never hidden for being old. Its `read`
is `fresh` within eight minutes (longer than one poll round), `stale` after, and
`unread` when the pull request was never read; a read that never happened is
not fresh (`isFresh`). A stale or unread move says **Checked 12m ago** with
**Recheck**.

When a move ends, `nextSettleState` (`useSettledMoves`) leaves one quiet line for
two seconds, only where a source says so (the pull request read). A move put
away with **Not now** leaves none.

## Acting and dismissing

A suggestion you acted on, or put away with "Not now", does not come back for the
same fingerprint, for good:

1. Every act or dismiss writes a `next:<kind>` row to `nudge_events`
   (`useNextStepOutcomes`), with the fingerprint in its `contextJson`.
2. `dismissedFingerprintsFromEvents` (`nextStepOutcomes.ts`) reads them back with
   no time bound, so a reload does not bring back what you dismissed.
3. `recordNextStepOutcome` and `revertNextStepOutcome` bump the session's
   revision in `OUTCOME_REVISIONS` once the write landed, and the rows are read
   again, so a grouped card such as open-pr moves to its next branch on **Not
   now** and back on **Undo**.

It returns only when the trigger changes and the fingerprint with it (new
commits, new red checks, a new plan).

Three "Not now" on one kind in a session within 14 days, with no acceptance
between, move that kind behind everything else (`shouldDemote`,
`nextStepGates.ts`). It is the engine's only learning, reads the session's own
history, and resets the moment one of that kind is accepted.

### Undo of Not now

**Not now** registers an `undoable` operation on the app undo stack
(`useSuggestionRunner`): the toast says Dismissed with **Undo**, and ⌘Z (Ctrl+Z
off macOS) restores dismissals in reverse order. It yields while a text field
has focus.

1. Undo deletes the dismissal's `next:<kind>` row (`revertNextStepOutcome`,
   `deleteNudgeEvent` in `packages/db`), waiting for that write if still in
   flight.
2. The suggestion shows again only after the delete succeeded. A failed delete
   reports the error, and ⌘Z can retry.
3. The operation drops once the Next slot unmounts (`isCurrent`).

A dismissal that carries an outside decision (`onDismiss`: a project proposal,
**Close branch**) is not undoable and shows no toast.

## Where a suggestion shows

- The overview splits the moves once (`overviewMovesOf`): Needs you, then the
  first three in Next (`MoveCard`), then the branch rows, where a suggestion is
  the row's main verb (`BoardRowAction`, from `cardsByRowId`). The Decide and
  Fix groups come first, Update and Ship after.
- A row has the main verb, an optional second verb and **⋯**, which holds **Not
  now** and the alternatives. Only the top move of Needs you, or the first of
  Next when nothing waits, carries a filled primary; every other verb takes the
  `secondary` look of its intent (`actionButtonLookOf`).
- A short visible verb (`shortLabel`) sits over the full `label`, which stays the
  accessible name.
- A primary that starts an agent takes the role icon and color of its
  `agentKind` (`agentKindPalette`, the role picker's source); others keep the
  `SUGGESTION_ICONS` glyph with the band tone. Hovering an alternative previews
  its role on the glyph.
- The **⋯** menu is the `suggestion` kind of the action registry
  (`features/actions/kinds/suggestion.ts`). `useActionCardActions` builds its
  target from the suggestion, `agentKind` and `useIsAutoOn`, not from closures of
  `useSuggestionActions`. `useSuggestionRunner` wraps each alternative with
  `track`, so the primary and the menu are held while one runs.

### Per-branch gating

The pull request cards (fix checks, open PR, push, mark ready, merge) wait per
branch: `isMountBusyOf` hides a card only while an agent with that
`Agent.mountId` runs. An agent without a mount gates them only when the session
has exactly one mount; with two or more it gates none, because nothing proves
where it writes. The rebase title names the folder, or the branch when mounts
share a folder (`mountLabelOf`); the open-pr title always names the branch.

### One place for each offer

- Next never offers what an Activity row already offers for the same run.
  `isOfferedByActivity` (`features/suggestions/isOfferedByActivity.ts`,
  exhaustive over the kinds) runs before `dedupeByTargetKey`: the hint that
  starts a run stays, its follow-ups live only on its row.
- **Continue all** after a restart stays, because no row resumes several agents.
  A failed agent's **Retry** stays, because its row has none.
- A permission has one place in the overview, the **Needs you** callout. Its
  approve-tool suggestion stays out of Next; a second blocked agent the callout
  does not name still shows there.
- The answer-open-questions suggestion counts only questions the Activity does
  not show. With one, **Answer** opens the asking agent at it
  (`useOpenAgentQuestion`); with more, the questions view.

## The kinds

Twenty-six kinds ship, in `SUGGESTION_KINDS` (`features/suggestions/types.ts`).

### You and the agents

- answer open questions
- approve a pending permission (opens the agent's chat)
- sign back in after `auth_required` (the `goodboy:open-settings` event)
- **Continue all** for every agent a restart stopped (band 0)
- retry the last standalone agent that failed
- **Ask the Implementer what blocks it** (`ask-agent`: quiet from 5 to 30
  minutes, then Needs you takes it)

### Runs and plans

- continue a workflow's ready step (left to its Activity row by
  `isOfferedByActivity`). The board card's "Continue" and the Next primary both
  call `activateWorkflowAgent` on the same pending agent.
- run a ready plan. Accepting it raises the Follow toast every start uses
  (`planRunToast`, `docs/navigation/model.md` Follow toasts).
- continue with a workflow once a standalone scout or generic agent finishes
  clean with a goal and no workflow attached (a discarded run does not count).
  "Set up" attaches the workspace's first library workflow with the session's
  goal in one click; it is never a goal-aware pick.

A failed workflow step has no suggestion: its Activity row carries **Retry
step**.

### Checks

- analyze a pull request's failing checks ([Failing checks](#failing-checks))
- **Run the failing test** (`run-failing-test`: a GitHub Actions check fails,
  its log names a test file, the project has a `test` script)
- **Rerun** a check (`rerun-check`: the job log says it timed out; it runs `gh
run rerun <run> --failed`, the one rerun shape in `gh-allowlist.json`)

The `checks-log` slice reads a failed check's log once per check
(`readCheckLog`).

### Branches and pull requests

- fix review conversations. The "Fix N" card never starts an agent: it sends a
  `fix` request (`requestReview`) and opens the **Fix comments** drawer with
  those comments checked. N comes from the fixable part of `reviewTally`
  (`useFixableThreadIds`), so every host counts alike.
- rebase a project. `rebase-project` also carries a stopped rebase, with the
  conflicting files, above **Rerun**.
- push unpushed commits on a clean worktree, counted against origin by
  `branchPushStateOf`: `Not pushed yet` when origin has no copy, and `Branch
diverged from origin` with `Review history` instead of a push when origin
  moved on its own
- open a pull request once a mount is ahead with none yet
- mark a green draft ready
- merge an approved and green pull request
- **Merge … in order** for a series of two or more open pull requests on hosts
  that let Goodboy pick the merge method (`merge-series`,
  `seriesMergeSuggestionOf`)
- review the changes once a standalone implementer finishes clean
- move a tracker item to Done ([integrations.md](integrations.md#the-tracker-follows-the-merge))

### Folders and upkeep

- add a proposed project (`mount-project`, which says `asked 2 times` and moves
  up when an agent asked more than once)
- the next script after a turn (`next-script`: a changed migration, lockfile or
  schema, `nextScriptRulesOf`)
- **Unmount** a folder no turn touched for seven days (`unmount-folder`)
- close a worktree (`close-worktree`: a merged pull request at once, or a clean
  worktree with nothing to push, no pull request and no change for seven days)
- **Archive this session** once its branches are merged or closed and nothing is
  live (`archive-session`, `archiveSuggestionOf`)

### Rules for single kinds

- **Open a pull request** is one row per session (`openPrSuggestionOf`), titled
  with the branch because a compact row hides the why. It leads with the branch
  whose Scribe text is under way, then the most commits ahead, then project and
  branch name, skips a branch put away with **Not now**, and lists the other
  branches in **⋯**. **Create pull request** opens the worktree the payload
  names, never one looked up at click time.
- Merge and close-worktree arm a confirm on the row; every other kind runs on one
  click.
- Push, open-pr, mark-ready and merge-pr act on the mount their suggestion names
  (`markPrReady` and `mergePr` take a `mountId`), never the session's active
  mount.

### Command safety

A discovered script with no outside text runs on the click. A command with text
taken from a log (the failing test), or a destructive script (`migrate`, `seed`,
`deploy`, `clean`, `reset`, `drop`, `push`), is written in the worktree's
terminal prompt and waits for Enter (**Add to prompt**). A test name from a log
is quoted (`shellQuote`). Nothing runs without a click.

## Failing checks

A check analysis agent has `sourceKind` `failed_check` and keeps the check URL in
`sourceCommentUrl`. The latest non-deleted agent for that session and URL owns
the check row status; its transcript owns the finding and **Proposed fix**. The
source type is in `packages/types/src/workflow.ts`, the selector in
`apps/desktop/src/store/slices/agents/selectCheckAnalysis.ts`.

The fix's commit comes from the repository, not the transcript.
`readCheckFixCommit`
(`apps/desktop/src/store/slices/check-fix-commits/readCheckFixCommit.ts`) takes
the newest commit on the mount branch made after the fix started, and
`selectCheckChain` turns it into `fixed-local` (not pushed), `fixed-pushed` or
`fix-failed` (no new commit). The transcript's `commitOf` stands in only when the
repository cannot be read.

1. The Next card is only the first hint, **Analyze**
   (`apps/desktop/src/features/suggestions/fixChecksSuggestionOf.ts`).
2. Once the Debugger runs, its one Activity row, "CI fix · check · #318", opens
   the Debugger drawer.
3. **Start fix** and **Push** (`pushCheckFix`) sit on the Overview cards, which
   pass `isActivityShown` false. The palette and the composer cards drop them
   through `isOfferedByActivity` and hide the plain push card for that branch.
4. The hint comes back only to start something new: **Analyze** after an
   analysis without a fix, **Analyze again** when the check still fails after the
   push.

The generic **Review the changes** card never fires for a `failed_check` agent.
