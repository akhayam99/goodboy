# Activity

> **Read this when** you change what a session's Activity, Log or Needs you
> block shows, or how history rows of a rebase or a rewrite settle. **Not for**
> what Next suggests ([next-steps.md](next-steps.md)) or the Branch page that
> owns history recovery ([../features/branch-history.md](../features/branch-history.md)).

A session keeps a list of everything that happened to it, in order, and the
**Activity** timeline shows it grouped by day, so you can read the work back
without scrolling through chats. Every event has a reason: an action that
cannot say why it happened is refused instead of saved blank.

It records branches and the container being created, issues linked and
unlinked, one pull request per project from opened to merged or closed, runs
started, stopped and archived, decision changes, projects materialized (with
their reason) or refused (with the error), tasks created in other tools, and the
history outcomes `history_rewritten`, `history_pushed`, `history_stopped` and
`history_restored`. Your edits of a pull request's title and description stay in
memory only, until you leave the session.

## Activity and Log

The feed has two views, **Activity | Log**, and every kind of row has exactly
one home. No Activity row has a `⋯`.

- **Activity** holds what you launched (an agent, a workflow run, a fix run), one
  row each with its role, state or action, model, time and cost, newest first
  with the lanes of a run drawn beside it. What happens inside a finished launch
  (steps, subagents, answered questions, and the plans, reports, wireframes and
  learnings behind "N outputs") folds into a count row on its lane. The count row
  stands where its newest folded row would read, so folding never moves it
  (`foldedSlotIndexOf` in `buildTimelineStream/ordering.ts`).
- **Log** holds the facts: outputs made without a launch, Context, branch and
  worktree events, link events (an unlink carries **Re-link**), pull request
  events and archive and restore. It is flat, newest first, one muted row per
  fact, with a search box and no categories.

## Needs you block

A **Needs you** block sits on top of Activity only while something waits on you,
with one row per owner, never per child: a pull request's fix runs ("#318 · 1
question · 5 fixes ready", counted in comments, in the words of the rows:
**fixes ready**, **questions**, **push failed**, **failed**), a run ("Retry policy · 1
question"), a stopped rebase (a short cause, never the engine sentence). Each
row's **Open** goes to whoever owns the action: the first comment that waits,
the exact question, the branch. Push is never offered there, and the block
needs no filter.

A fix run's Activity row reads "Fix run · #318 · 9 comments", one row per run.
**New** is always the outline button, offering **Start a run**, a report or a
wireframe. Suggestions live in **Next steps** above Activity, never as feed
rows.

### Open questions

An open question is asked once on screen, and each family counts once.

- A question inside a launch belongs to it: its row keeps "Needs you" and
  **Answer**, and Needs you carries one row for the run whose **Open** goes to
  the asking agent at the question.
- A question without a launch has no Activity row. It sits in Needs you while
  open and becomes a muted Log row once answered.
- The activity reports the questions its rows show (`shownQuestionIds`), so Next
  steps do not repeat them.

## History rows

History rows carry no verb and no `⋯`; the verbs live on the Branch page's job
banner (`docs/features/branch-history.md`). A row with a recovery stays in
Activity and opens the Commits tab, which owns it.

### When a stop leaves

A stop stays only while all of these hold:

- no later outcome of the same branch settled it
- git has not settled a rebase stop outside the flow (`settledRebaseStops`,
  written by `settleStaleRebases` from the stop's `head` payload and a newer git
  read)
- its branch is still an open, attached row of the session (Next and Needs you
  only: a merged or closed pull request, or a branch that left, takes it out;
  `openMountIds` from `useOpenStopMountIds`)
- for a stop that names a rewriter (`agentId`), that agent exists. Deleting it
  moves the stop to the Log and out of Needs you.

**Abort rebase** records `history_restored` with `reason: 'kept'` ("Kept <branch>
as it was"), which settles the stop like any later outcome. A stopped rewrite
waits in Needs you until a later outcome settles it.

### Where a history row opens

The row opens the branch's Commits tab by the stop's `mountId`
(`openMountCommits`), never the branch on screen. A rebase stop reads **Open
rebase**, and a row whose branch left the session has no verb.

The agent rows of those jobs read the job, not the turn (`jobFactsByAgentId`,
beside the resolver's seam in `buildTimelineStream`):

- History rewriter reads "Rebase on main" with the job's word (Replaying,
  Merging, Checking, Moving, Pushing, Done, or "Stopped: needs you" with the
  short cause) and opens **Open rebase**.
- Scribe reads "Pull request text" (Writing, Opening, Created #318, Couldn't
  open) and opens **Open overview**. A Scribe that refreshes a description or
  writes a commit message reads "Refresh pull request text" or "Commit message",
  muted and never in Needs you.

`history_rewritten`, `history_pushed` and `history_stopped` carry the rewriter's
`agentId`, so a finished row still reads Done or Stopped after a restart.

### Recovery verbs

The banner offers `Undo rewrite` for a rewrite, `Retry with a note` when The
rebase needs you, `Rebase on their commits` when origin moved, `Retry rebase`
when the branch moved and `Retry push` when the push failed. The Commits section
offers `Rewrite with an agent`, `Change the plan` and `Discard plan` for a
stopped plan, and `Reset branch to this version` for a push. Every engine
notification points at the branch's Commits with `Open branch`, so closing it
loses nothing.

### The history journal

The journal records expected head, target head, backup ref and branch, an
optional fifth line with the stash SHA, and a line with the exact ownership
message. `pending_stash` and `write_journal` own this contract.

- It is replaced atomically and synchronized before files are set aside, so a
  pending intent can find its stash after a crash before the SHA was recorded.
- A `restoring` marker, cleared on conflict, lets bring-back detect an
  interrupted restore. A restored marker prevents applying it twice if cleanup
  was interrupted.
- A pending intent with no stash is rolled back, never kept.
