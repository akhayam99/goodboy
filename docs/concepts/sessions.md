# Sessions and stages

> **Read this when** you change how a session's stage, its Needs you count, an
> agent's state word or a session's faces are worked out. **Not for** the state
> word table ([../concepts.md](../concepts.md#sessions)), the reason identifiers
> and their order ([identifiers.md](identifiers.md)) or what a session spends
> ([spend.md](spend.md)).

A **session** holds one goal ("Refactor authentication domain"), with its own
budget and notes every agent in it can read. Its stage is derived from what is
in it on every read, never set by hand and never stored.

## Running

"Running" has one meaning everywhere: an agent turn starting or running, an
agent waiting for a permission, or a workflow run deciding its next step. The
top bar chip, the switcher's "N running", the footer count, the update pill and
the restart-when-idle check all read it (`selectLiveWork`), so a workspace with
one agent waiting on a permission is never "idle".

A list never words that agent as running, though. `agentStateOf`
(`features/workTreeModel/agentStateOf.ts`) is the one table from an agent's
status, turn and open questions to its phase, word, node and dot, read by the
Runs grid, the Runs page count, the Running card and the Agents tree.

- A blocked turn is **Needs permission**: a waiting phase, an amber node without
  motion, counted in "N sessions need you" and sorted ahead of what runs. The
  session's **needs-approval** reason reads the same fact
  (`isTurnStatePermissionBlocked` in `features/session/agent-lifecycle.ts`), so
  the word and the count never disagree.
- A stopped agent that is not closed reads **Stopped**, with **Continue** on its
  row.
- **Agents** (`NAMES.agents`) names the tree of a run's agents and nothing else.

`NAMES` (`shared/utils/names.ts`) holds every state word, read by `glanceOf` and
every row. **Stuck**, **Blocked** (outside a pull request's merge state),
**Working**, **Planning** and **Pending** are not words on screen. An error reads
**Failed**, a limit **Paused**, and a hint, a stopped Lead or an agent that
stopped unfinished **Needs you** with one sentence.

## Needs you

**Needs you** outranks running when a human input waits: an open question, a
tool waiting for your permission, a comment the fix run needs you for, or a plan
waiting for approval (a workflow run held at its plan). The session stays in
needs you while its agents keep working, and every count (the top bar chip, the
board column, Search or run, `⌥⌘↓`) puts it there. An agent error also ranks
above running.

Failing checks, changes requested, comments the fix run could not fix, an
approved pull request and an unread reply rank below running, because an agent
may be working on exactly that. Every reason that holds is kept, and the hover
card lists them all. Each reason's words and mark come from one table
([identifiers.md](identifiers.md#session-stages)).

## Done

**Done** does not need a pull request. A session reads **done** with the reason
`answered`, `finished`, `report ready` or `plan ready` (`settledOutcomeOf`) when
no pull request is open, every agent finished and none runs or waits, no reply
is unread and no question is open. An active plan reads `plan ready`, an active
report or wireframe `report ready`.

Agents that only read (Scout, Planner, Reviewer, PR reviewer, Report, Wireframe)
settle a session on a mounted project too; any other agent only in a folder with
no branch, where no pull request can come. Writing again returns the session to
**running**, and an unread reply to **needs you**.

## Pull requests on the board

The board takes the worst pull or merge request across the mounts, whatever the
host: failing checks, then changes requested, then approved. A session is done
only when every request is merged or closed.

A Bitbucket mount reads checks from the commit statuses of the open pull request
(a failed or stopped status is failing, one in progress pending) and its review
state from the reviewers (a requested change wins, then one approval, then
reviewers who have not answered). A status it could not read keeps the last
answer and never reads green.

## Send to Lead targets

An active Lead is an open one: Working, Waits for you or Resting (`workRowsOf`,
filter `open`); a finished or stopped Lead is never a target. **Send to Lead**
offers at most three active Leads of the same workspace with a branch in the
item's project, ranked with no model call by `leadCandidatesOf`: the Lead that
holds the item, then the same branch, session and project, then the most recent.

## Overview, Desk and the Board

- **Overview** and **Desk** are the two faces of a session under one head, with
  no switch: opening a tool from the right rail makes the Desk, closing the last
  tool brings back the Overview, and a session reopens with the tools it had.
  The Desk always belongs to one session.
- **Changes** is not a session tab: a pull request's changes open from its row in
  the Overview's Projects block.
- A **move** takes a session forward, with its reason and verb. **Needs you**
  holds the moves only you can make, **Next** the ones after, and `needsYouOf`
  counts the first, the same number on the Board and in Sessions
  ([next-steps.md](next-steps.md)).
- The Board puts sessions in lanes by stage (building, running, in review, done,
  archived), with a row of cards for sessions that need you above them.

The files behind stages and live work are in
[identifiers.md](identifiers.md#where-things-live), and
`apps/desktop/src/__tests__/regressions/state-words.test.ts` checks the hub's
state word table against the code.
