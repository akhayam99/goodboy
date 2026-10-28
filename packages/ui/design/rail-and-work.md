# Rail and work vocabulary

> **Read this when** you draw the session rail, a work node, a row state, the history graph or the plan in the workflow builder. **Not for** tokens and scales ([DESIGN-SYSTEM.md](../DESIGN-SYSTEM.md)) or intent and product judgment ([DESIGN.md](../../../DESIGN.md)).

## Needs you and the two views

The feed has a header of its own: **Activity | Log**, a `SegmentedTabs` at
`xs` size with `role="tablist"`. It is the only control that changes what the
feed shows. There is no filter, no preset, no category, no hidden count and no
tag that says a row was shown because you started it. Every kind of row has
exactly one home (`activityView.ts`, `entriesOfView`):

- **Activity** holds what you launched, one row per launch: an agent, a
  workflow run, a fix run. The right side of a row says its state or
  its one action, then time, then cost, and never reserves an empty slot. A
  launch folds what happens inside it into its own row: steps and subagents
  (a chip, "4 subagents"), answered questions (the tally), and its plans,
  reports, wireframes and learnings behind the chip "N outputs", which opens
  them as rows below the launch. A history row that still has a recovery
  (a rewrite with a backup, a push, a stopped rewrite) stays in Activity with
  no verb and no `⋯` of its own: `Undo rewrite`, `Restore previous history`,
  `Retry` and `Retry with a note` live in the Commits tab of the Branch page,
  and the row opens it. No Activity row has a `⋯`.
- **Log** holds the facts: plans, reports, wireframes and learnings without a
  launch, Context, branch and worktree events, link events (an unlink carries
  **Re-link**), pull request events, answered questions without a launch and
  the session archive and restore. It is flat, newest first, with the `fact`
  grade, one muted row per fact, rows of one kind and day merged, and a search
  box at the top. Each row opens its own object.
- **Needs you** is a block on top of Activity, drawn only while it is not
  empty: a card on `bg-subtle` with one inner `warning` `ToneBar`, a neutral
  eyebrow and one row per owner, never one per child. The line is the only
  amber on the card: no ring, no triangle, muted row icons. A row is an icon,
  one line of text (`#318 · 1 question · 5 to review`,
  `Retry policy · 1 question`, `Rebase of feat/export stopped ×2`) and a ghost
  `xs` **Open** that goes to whoever owns the action: the first comment that waits on you (the question
  before the reviews, the reviews before the failures), the exact question, the
  branch. A pull request is one row however many fix runs it had. It never
  offers Push or Answer, because the verb stays with its owner. The owners come
  from the same row states as the rows themselves (`needsYouOwners`), so a
  question is counted once however many rows could show it.

A fix run is one row, `Fix run · #318 · 9 comments`: the resolver agent's own
row, with the tally of its comments in the five words (`5 ready · 1 needs you
· 2 working · 1 couldn't fix`) as its state line, the model cell, and the time
over the cost. It has no per-agent burst, no files below it, no `related` tag
and no retry count: a fix run is one agent, and a follow-up or a retry is
another turn of that agent. The row opens the run's page, and the comments
stay in the Comments tab, one click away. The title and the tally count
comments, never agents.

## Rail vocabulary

A feed reads up, a recipe reads down. Activity is a feed: newest first at every
level, like a git graph, so a child sits above its parent and the clock never
rises going down. The workflow run page is a recipe: steps in the order they
run, top down. Both draw their structure with the same four ingredients.

| ingredient | value                                                                              | meaning                                     |
| ---------- | ---------------------------------------------------------------------------------- | ------------------------------------------- |
| spine      | 1px, `--color-border`, solid, unbroken on every row, column 0                      | the session's own thread                    |
| lane       | 2px in the run's identity hue, one 16px column per run, a child lane one column in | a launch's members, each at its own time    |
| pattern    | solid or dashed                                                                    | solid happened, dashed has not happened yet |
| count row  | hollow 10px node on the lane, muted text on the label column, 24px high            | a finished branch, folded                   |

Content hugs its marker. The label of a row (ordinal, role glyph and title, a
fact row's words, a count row's summary) starts a fixed 10px after the right
edge of that row's own marker: label x is the marker column's x plus the marker
radius (10px, 5px for the count node) plus 10px. The rail space of a row ends
where its label starts, so depth 0, 1 and 2 indent by exactly one 16px column
each and no row has a wide empty gap between ball and text. The right-hand
columns (state, model cell, duration over cost) hang on the row's right edge and
stay aligned across rows; the time gutter is unchanged. A lane of another group
beside the marker that runs through a row and would touch the label (the next
column over for the 5px count node, two columns or more for a full node) pushes
that row's label to 10px past the lane, for every row kind.
`railInsetOf` in `railGeometry.ts` computes the space; the run page keeps its
one global rail width. The step ordinal is left-aligned in a 16px slot.

A lane starts at its origin marker with a quarter curve out of the column of
the row above it in the hierarchy and climbs through its members. The origin
row (the Workflow row) sits at the run's start time, at the bottom of its
members; the steps stand above it, newest on top. The subagents of a step open
upward from the step's own marker: the child lane branches from that marker,
never from the lane beside it. The lane takes the run's identity hue (one of
six calm hues, never red or amber: status colour stays on the markers), a child
lane the same hue. A discarded run dims its lane.

Time rules. Rows are in one time order whatever their level: a launch that
started while a run was working sits at its own time between the steps and the
lane passes beside it. Day rules sit between any two rows of different days,
inside a run that crossed midnight too, and the lane runs through them. The
newest group gets its day label unless it is from today. A queued step has no
clock; it sits on the dashed stretch above the newest dated row, under NOW.
While a run is live its lane continues dashed from its newest dated member up
through the NOW row, so the line itself says the work is live; a finished lane
ends on its newest member.

Folding. A branch folds only when it is finished. A live branch (a run that is
not finished or asks you something, a step with a running, queued or failed
subagent, a launch still working) shows
all its members and has no control to fold it. A finished branch folds by
default, whatever its size, into one count row that sits on its lane exactly
where its children would be, above the parent: `6 steps · 1 question answered`
over a run, `3 subagents` over a step, `2 outputs` over a launch. A tally follows the total only when not everything is done (`3
subagents · 1 closed`). A click on the count row, or Right on it, opens the
branch; the count row stays as the top cap of the lane and a second click, or
Left, folds it again. There is no chevron and no chip at the right of a feed
row; the run tree's fold row is the one exception and ends in a chevron, down
while it is folded and up while it is open.
Right and Left work on every expandable row too: Right opens the branch the row
carries, Left folds it, and Left on a child folds the branch it hangs in and
moves the focus to its count row. A run that finishes while you watch it stays
open until you fold it.

The lane is a control: a click on it opens the run page, with the tooltip `Open
workflow: <title>` and its shortcut, Shift+Enter on a focused row does the same
(`activity.openRun` in the shortcut registry), and the lane gets no hover tint.
A row click opens its own leaf: a step its chat, a run its page, a fix run its
page. A count row never navigates; it only folds and opens.

The recipe is the run page: `layoutTimelineRail` runs there with `hasSpine:
false`, the run lane takes column 0 and starts on the run's first step, steps
follow in execution order and children take column 1. Its lanes are `down`
groups, the feed's are `up` groups; `buildTimelineStream` takes the direction
from its caller, so the run tree and the agent tree keep their order. There is
no run row, no NOW and no time column on the run page. Its one count row is the
fold row of a settled set of sub-agents (`RunTreeFoldRow`): it sits under its
parent step, one column in, and opens the set downward, oldest first.

Never delete a rail element without the defect it fixes. 0.17 had a head node
with a grey stub for a folded group; the stub landed on the lane and not on the
step's marker, and the count row replaces it. The 0.17 elbow that rejoined a
queued child lane into its parent lane is not back: the dash up to NOW says
what it said. The lane hover wash and the thicker hover stroke are gone: they
lit a whole run for a pointer that was only passing.

Geometry is computed in
`apps/desktop/src/features/workTreeModel/railGeometry.ts`. Rows are laid out
against `apps/desktop/src/features/workTreeModel/timelineRhythm.ts`. Its grades
fix line height and box height (entry 40px, step 32px, queued 24px, fact 28px,
count 24px), so a node centres on its label's line and not on its row box. Every grade
carries the same 20px node. `fact` is the grade of every row of the Log: the
Context row ("Context · 1 added, 2 replaced", words and no diff colours), an
answered question, a plan or an artifact created without a launch ("Plan
created · Refund idempotency plan"), and every session event. It takes an 8px
gap instead of 12px and a 12px muted label, so a log row weighs the same as a
step and never as an agent.

The direction of time is one rule: the feed is newest first at every level. A
run or an agent sits where its origin started and its members stand
above it, each at its own time, so a step number only ever falls down the list
(8, 7, 6 above the run row; 8.4, 8.3 above step 8). Day rules sit between any
two rows of different days.

**A queued step is future, not hidden.** It is a row of its own with its own
dashed node, on the dashed stretch above the newest dated row. A failed step or
a parent you closed ends there; queued children of a failed parent cannot start
and draw as skipped when you closed the parent. The row states come from each
row's `RowState` in `buildTimelineStream`, not from a second status check.

Suggestions are not scheduled work, so they never draw a dash and never sit in
the activity feed. They live in the **Needs you** and **Next** cards of the
Overview, outside the log, as `docs/concepts.md` (Next steps) describes.

A second rule covers what Activity shows: **a finished launch is one row and
one count row, opened one level**. Nothing inside a finished launch is a row
until you open its count row, and a state that needs you can never hide inside
a folded branch: a branch with something that needs you, or something still
working or failed, is not finished and stays open, and Needs you carries it.
Density comes from the grades in `timelineRhythm.ts`.

## History graph

Rewrite history draws one branch on the same grammar: newer above older,
solid for what happened, dashed for what has not happened yet. Main is a
straight `idle` trunk with its head node and one dot per commit it gained
(the subject on hover); the branch leaves it with a quarter curve at the real
fork point and climbs in a `muted-foreground` lane, one node per commit. The graph shows the local branch and updates after each successful edit.
There is one full-width column at every window size. The moved row shows
an inline busy state while Git works; controls ignore further edits until it
finishes. Undo and Redo are icon buttons with tooltips in the Commits header.

Each action has one colour, read only through `HISTORY_ACTION_CLASSES` in
`apps/desktop/src/features/history/historyActionClasses.ts`:

| action                      | git term | colour     | token                      |
| --------------------------- | -------- | ---------- | -------------------------- |
| Keep                        | pick     | green      | `--color-success`          |
| Fold in, keep its title     | fixup    | azure      | `--color-history-fixup`    |
| Combine, keep both messages | squash   | yellow     | `--color-history-squash`   |
| Move                        | reorder  | violet     | `--color-history-move`     |
| Rename                      | reword   | neutral    | `--color-muted-foreground` |
| Remove                      | drop     | red        | `--color-danger`           |
| Rebase on the base branch   | rebase   | trunk grey | `--color-idle`             |

A kept row gets a green node. Warnings keep `warning` and the triangle.
`token-contrast-floor.test.ts` holds the history tokens at 4.5:1 on every
surface and their own marks. Successful row updates settle with `useFlipList`;
reduced motion makes the update instant. Errors and stash consent stay inline
with actions next to their reason.

## Work nodes and row states

Every surface that draws a sequence of work (the activity feed, the workflow
run tree, the agents on a project, the transcript's status column) draws its
nodes with one primitive, `WorkNode` in `packages/ui/src/components/WorkTree/`.
It knows nothing about agents: the caller hands it a state, a mark, a label
and a `size` (`md`, 20px, the default; `sm`, 14px, for a transcript row's
icon column), and sits on the canvas so the lane never shows through it.

| node       | ring                                    | centre                    |
| ---------- | --------------------------------------- | ------------------------- |
| `queued`   | 1.5px dashed, `faint-foreground`        | local index, faint        |
| `ready`    | 1.5px dashed, `warning`                 | play triangle, warning    |
| `running`  | 2px `border-soft` track + `spin-border` | local index, or info dot  |
| `question` | 1.5px `warning`                         | `?`, warning              |
| `budget`   | 1.5px `warning`                         | `$`, warning              |
| `approval` | 1.5px `warning`                         | shield, warning           |
| `alert`    | 1.5px `warning`                         | `!`, warning              |
| `failed`   | 1.5px `danger`                          | `!`, danger               |
| `approved` | 1px `success` over a solid `success`    | check, `on-tone` (white)  |
| `merging`  | 1.5px `primary`                         | half-filled core, primary |
| `done`     | 1px `success` over a `success/18` fill  | check, success            |
| `closed`   | 1px `border`                            | check, muted              |
| `stopped`  | 1px `border`                            | small square, muted       |
| `skipped`  | 1px `border-soft`                       | dash, faint               |
| `marker`   | `ring-1` in the concept tone            | the concept glyph         |
| `mixed`    | arcs per state, 2px, 1.5px gap          | the state of the children |

`mixed` is the node of a group row (a batch of resolves, a folded run or chain): the caller passes
`parts` (a tone and a count each) and the ring is split into arcs whose length
is proportional to the count, one tone per state, in the order given, with a
1.5px gap between arcs (none for a single part). The centre is a dot: a ball
shows a state and never a count, because a number in a ball reads as a step
number. It keeps the same 20px box as every other state.

`approval` is a pending permission request without a decision yet: a tool
call waiting on you, distinct from `question` (an open question waiting on
you) even though both use the warning tone. The transcript also gives a
turn's `blocked` state its own node this way instead of sharing `question`'s
glyph.

`failed` is the red `!` and means something broke. `alert` is the same sign in
`warning` for what you must act on while nothing is broken (changes requested,
comments the fix could not fix), so red stays rare. `approved` is a solid
`success` disc with a white check, 12px at `md` and at `sm`: ready to ship.
`finished` is its twin in `merged` violet: the same solid disc, ring and 12px
white check, for a session that is done. `merging` is a pull request waiting in
the merge queue: a hollow `primary` ring around a core filled on its right half,
drawn to the node's own scale, so it reads as in progress and never as a solid
disc, a check or the dashed pending ring. Neither is `done`, which is an outline
with a tinted fill and a `success` check (a finished workflow step). The glyph
inside a node is never under 12px, so the `sm` node (14px) keeps its ring and
only the glyph grew from 9px. Any state can also take `isSpinning`, which draws the running
`spin-border` around the node's own ring and glyph in the colour of
`spinClassName` (`spin-border-info` by default, motion-gated): the reason holds
the session while an agent still works.

A node can also take `progress`, measured active time over the usual time,
from 0 to 1 and clamped. A `running` node with progress draws a 2px `info` arc
from twelve o'clock over the `border-soft` track instead of `spin-border`, and
the `soft-pulse` head sits on the end of the arc. A `question` or `budget` node
keeps the arc frozen in `warning` over a `warning/35` track, with no motion.
A `failed` node never draws the arc. The arc steps with the panel's 5 second
clock and never animates between values: a ring that glides for nine minutes
decorates, it does not confirm. Without progress the node is the table above.

A node never carries a number. The step's full path (`4.2`) is the ordinal
column of the row, always visible, so the node only says the state: a row in a
sequence carries a dot until it has something to say, a fact row (plan,
artifact, event, issue, question) carries its concept glyph, and a state that
asks something or broke has its glyph, so colour never speaks alone.

A comparison of two versions (the wireframe Compare) marks each change with a
glyph and a word, never a colour: `+ Added`, `~ Changed`, `− Removed`,
`= Same`. On the pages, added nodes get a solid outline with `+`, changed nodes
a dashed outline with `~`, and removed nodes, on the older side, an outline
with `−`.

What a row is doing is computed once, as a `RowState` (phase, reason, ask), in
`apps/desktop/src/features/workTreeModel/rowState.ts`. Every surface reads that
value: the node comes from `rowStateNode`, the status in the row's state slot
from `statePresentationOf` (`workTreeModel/statePresentation.ts`), and the
single visible action from the ask. The state slot is a fixed 112px space
(96px under 790px) at the right of the label, right before the meta, so every
row says its state at the same x and the title takes the rest and truncates.
Quiet final states (Pushed, Accepted, Resolved, Reply only, Skipped, Closed)
show as an icon in their tone, with the word in the tooltip and for screen
readers; states that ask you or report trouble (Needs you, Ready,
Couldn't fix, Longer than usual, Step 3 ready) stay a word, in their short form,
with the full sentence in the tooltip. A new state is a row in the
`statePresentation` tables, never a branch in the component.
When several conditions hold, failed wins, then waiting (an answer, then the
next click, then the spend limit), then running, then queued, then done. The
summarizer briefing the next step and a chat turn in flight are the machine
working: they read as running, never as "Needs you". A run you stopped reads
as `stopped`, an agent you closed as `closed`: finished is not the same as
succeeded.

A fix run is a plain agent row. Its state line is the tally of its comments in
the five words, and its row never opens or folds anything: the comments live in
the Comments tab and the Needs you block carries the run when one waits on you.

Subagents have no group row and no chip. A finished step or agent that has
subagents has a count row above it on its own lane: `3 subagents`, with a tally
only when not all of them are done (`3 subagents · 1 closed`), muted, on the
label column right where the first child would be. A step with one subagent has
the same row. The count row opens the children above the step, one column in,
numbered 8.4, 8.3 down to 8.1 over step 8, each with its own time and cost; the
step's time and cost already include them, counted once, and the children show
their own. The row's unread dot covers the hidden children and Needs you
carries the run once, also for a subagent that asks or has failed. A subagent
that is working, queued, failed or waiting on you keeps its branch open: a
branch folds only when everything in it is finished. The outputs of an agent
work the same way: the count row `3 outputs` opens a plan, a report, a
wireframe or a learning as rows above it, on a lane of their own. Children grow
with `Reveal` like a group's, closing runs it backwards, and the lane keeps its
column whether it is open or not. A folded chain or run shows its descendants
when it opens; the trees (the run page and a Brief) always show them.

A finished workflow run or agent chain, whatever its size, is a third group
kind, `steps`: the run row keeps its own node (the state of the run, never a
count), and its count row sits above it with the summary from `groupSummary`
(`8 steps · 1 question answered · Context · 2 added, 2 replaced`), never
truncated: the Context part is the same string as the Context row inside the run
(`CONTEXT_LABEL` and `decisionCountsText`), summed over the rows of the run's
agents, and shows only when a row changed something. Those Context rows are
members of the run, graded `fact`, and a folded run hides them; a Context event
with no agent is a row of the Log. An answered or dismissed question inside a
run is counted in the summary and drawn as no row, and an open one keeps the run
open and is carried by Needs you. The run row's click opens the run page, not
the fold. A run that asks you something, failed or is still running is never
folded. The gutter clock carries a tooltip with the row's own times ("Started
16:41 · finished 16:57", "Started 10:09 · running"). The count row's label
aligns with the step titles, a step's ordinal and role glyph included. A row
already on screen never grows again: when a run finishes under the pointer its
rows join the group already open.

A resolver takes its row state from the comment it fixes, not from the agent:
the `review` reason carries the Review state and its word, one of five (Working,
Needs you, Ready, Couldn't fix, Done) or the quiet sub-word of a Done comment
(Pushed), with Review's tone and node. An agent that fixes several comments
counts them in comments ("3 ready · 1 needs you"), never as agents. A comment
that needs you, has a ready fix or could not be fixed sets the `reviewComment`
ask, so Needs you carries it and the row itself is not tinted.

## Row hover and focus

Every row that can be clicked reads as clickable in three ways at once: the
pointer turns to a hand, `bg-hover` washes it, and a keyboard focus draws the
focus ring. The three live in one string, `ROW_INTERACTIVE`
(`packages/ui/src/rowInteractive.ts`), and a row never copies it. `bg-hover`
is a `background-image` layer, so a waiting or unread row keeps its tint and
shows the wash on top of it. `SelectableRow` and the Activity rows
(`TimelineStreamRow`, `TimelineCountRow`, `TimelineMoreRow`) carry the whole
string on their one clickable element. `InteractiveRow` splits it, because its
frame is not the control: the frame takes `ROW_HOVER` so the wash stays while
the pointer is over an inner link or button, and the overlay button that opens
the row takes the ring. A row that opens nothing carries none of it, and no
pseudo-element stands in for the layer. The Files tree rows of a
diff (`ChangeTree`) take the shared string; a Board card washes
whole through `sessionCardShell` and its title button shows the pointer. An unread row keeps its tint under the
pointer: hovering it for 450ms marks it seen when the pointer leaves, never
while it is still on the row.
`row-interactive-is-shared.test.ts` holds the listed rows to the shared string.

A tree indents by one step. `treeIndentPx({ depth })` and `TREE_INDENT_PX` (12px a level on an 8px base) are the only source: the Changes tree sets its row padding with the first and the Files tree draws its guide spans with the second, so a user moving between them sees the same indent. Arrow keys in the Changes and Files trees are one pure function, `treeKeyMove` in `shared/utils`: Down and Up move a row, Right opens a branch and then enters its first child, Left closes an open branch and then goes to the parent, Enter and Space act on the row, Home and End jump. Each tree maps its rows to that shape and its result back to its own action. The session tree of the spawned panel keeps `treeKeyTargetOf`, because its rows run newest first. `hand-indent.test.ts` counts a `pl-5`, `pl-7` or `pl-9` and an inline `paddingLeft` that does not come from `treeIndentPx`.

**The rule of seen.** An agent is seen when it is open and the window is in
front: visible and focused. Opening it (`selectAgent`) stamps it, and the agent
it replaces, only while the window is in front. Opening one in a window that is
hidden or behind another stamps nothing, so a reply that arrived meanwhile keeps
its dot; the stamp comes when the window returns, from one hook
(`useViewedOnReturn`, on focus and on becoming visible) that marks the open
agent seen. Hover stays a second proof, as above. One test reads the window,
`isWindowInFront` in `shared/lib/`, and `store.viewed-stamping.test.ts` holds
each case.

## Session row, hover card and switcher

A session in the left column is one 28px line: a 14px `WorkNode` (`size="sm"`)
and the title, with a `gap-2` between them and `px-2` inside the pill. It has
no second line, no `ToneBar`, no marks, no age and no cost. A `WorkNode`
fills its disc with `bg-background` to mask a rail line behind it; on a
selected or current row it takes `isTransparent` (`StateNode`
`isOnSelectedRow`), so an idle node stays a ring on `bg-selected` and never
reads as a solid dot. `sessionNodeOf`
picks the node from the stage and, under needs you, from the winning reason,
and every surface that says why a session waits reads the same table,
`ATTENTION_REASON_META` in `features/session/session-stage.ts`: one mark, one
tone and one sentence per reason. The sidebar node, the switcher row, the hover
card, the Board card tone, the Now chip rows and the palette's Needs you rows
agree on tone and words, and the node's accessible label is the sentence.

Every row of that family reads its facts from `useSessionRowFacts` (summary, node, row title, task keys and plain title): a surface never repeats the three calls, and a surface that prints a session name uses `sessionTitle`, so a blank goal reads `Untitled session` on the rail, the switcher, the Now popover and a toast. A workspace row reads `useWorkspaceRowFacts` (last seen through `formatAdaptiveAge`, unread) and `NEW_WINDOW_TOOLTIP`. A suggestion card in the transcript (`NudgeCard`) draws its actions with `Button` and its dismiss with `IconButton`.

Red means broken, amber means you must answer, approve or act, green means
ready to ship, teal (`primary`) means waiting in the merge queue, violet means
done, blue means moving or new. A pictogram under 12px is unreadable, so the
marks inside the ring are typographic or 12px: `?`, `!`, the approval shield,
the check and the half-filled core of the queue.

| reason                | node                 | tone    | words                                    |
| --------------------- | -------------------- | ------- | ---------------------------------------- |
| `agent-error`         | `failed`, `!`        | danger  | An agent stopped on an error             |
| `run-stopped`         | `failed`, `!`        | danger  | A run stopped                            |
| `ci-failed`           | `failed`, `!`        | danger  | Checks failing                           |
| `open-question`       | `question`, `?`      | warning | 1 question for you (plural by the count) |
| `fix-needs-you`       | `question`, `?`      | warning | 3 comments need you                      |
| `needs-approval`      | `approval`, shield   | warning | Waiting for your permission              |
| `plan-approval`       | `approval`, shield   | warning | Plan v2 waits for your approval          |
| `run-waits-for-go`    | `approval`, shield   | warning | A run waits for you to continue          |
| `auto-needs-you`      | `approval`, shield   | warning | Auto waits for you                       |
| `slack-reply-waiting` | `approval`, shield   | warning | A Slack reply waits for your OK          |
| `run-paused-at-limit` | `alert`, `!`         | warning | A run paused at its limit                |
| `changes-requested`   | `alert`, `!`         | warning | Changes requested                        |
| `fix-couldnt-fix`     | `alert`, `!`         | warning | 2 comments it couldn't fix               |
| `pr-queued`           | `merging`, half core | primary | In merge queue                           |
| `pr-approved`         | `approved`, solid    | success | Approved, ready to merge                 |
| `unread-reply`        | `marker` and its dot | info    | New reply                                |
| stage `done`          | `finished`, solid    | merged  | Done                                     |

`pr-queued` is the one reason in the table that does not need you. It ranks
below the needs-you reasons and above `pr-approved`, and it is mutually exclusive
with it: a pull request in the merge queue is never also approved, ready to merge,
whatever its review decision. The session stays in the review stage, so the Board
card sits in In review with the `primary` tone bar, the sidebar, the switcher
and the hover card draw the `merging` node and the words, and the Now chip and
the palette's Needs you rows never list it. The hover card shows no Needs you
action for it. With several mounts, a mount in review or approved speaks for the
session ahead of a mount in the queue, and failing checks speak ahead of both.

`plan-approval` names the plan's version when it is known and says "The plan
waits for your approval" otherwise. The five waits that used to look idle are
reasons of the same table, each read from the predicate that already draws it
elsewhere, so the number is computed once: `run-stopped`, `run-paused-at-limit`
and `run-waits-for-go` come from the `wait` of `runRowFactsOf` (the run row's
Failed, Paused at the limit and Waits for you), `auto-needs-you` from
`autoTreeWordOf` (Needs you) or a stuck child, over trees whose root agent is in
the session and children whose agent is not gone, and `slack-reply-waiting` from
a pending Slack draft. Each opens its page (`attentionPlace`): the run page, the
Auto root, the latest agent where the draft card sits. A reason the person put
away with Not now (failing checks, an approved pull request) leaves the counted
set while the dismissed fingerprint of its suggestion holds, and a reason that
asks for input is never deferred. A session waiting for you also carries
`attentionSince`, the time its winning reason became true when the store keeps
one (a blocked turn, a question, a failed turn, an unread reply, a Slack draft),
and the Needs you order follows it, falling back to the last edit. Mark as unread stamps the latest finished agent unseen (`markAgentUnviewed`, `lastViewedAt` cleared in the store and the database) and never the agent on screen in the open session, which counts as seen; Mark as read and Mark all as read stamp every unread agent (`markAllAgentsSeen`, `markSessionsRead`), and `sessionHasUnread` is the one test for a row's dot. An unread reply is not a mark: the node
stays the quiet ring and takes the row's 6px dot (`hasUnread`), and the dot
also shows on any other node while a reply waits among the other reasons.

The door pill. The Sessions door, the folded rail and the top bar say how many
sessions need you with one function, `attentionCountOf` (read through
`useWorkspaceAttention`), over every session of the workspace and never the
project filter. A session counts when its stage is needs you and one of its
reasons is `warning` or `danger`; a session waiting only on `unread-reply` or
`pr-approved` is quiet and does not count. One session is the 6px dot, two or
more a `rounded-full` pill with the number (`9+` above nine, `text-meta`), in
`warning`, or `danger` as soon as one counted session has a danger reason
(`agent-error`, `run-stopped`, `push-failed`, `ci-failed`). A door with only quiet
sessions shows the neutral dot and no number. The tooltip and the label keep the
reasons ("3 need you: Checks failing, 1 question for you"). The top bar holds
no target of its own for it, because the chrome is capped at 24: the Now chip
leads with the same count as its first segment (a dot in the worst tone, the
number, the word "need you", hidden at zero), its tooltip carries the
`session.nextNeedsYou` key, and its list opens with a Needs you group and a
**Next that needs you** button that runs `goToNextNeedsYou`. The Needs you lane
header keeps the lane's own count, which also holds the quiet sessions, and its
tooltip carries the same key. `NeedsYouFeedback` is the inline status line beside
the chip: the key says
"Nothing needs you in <workspace>", "This is the only one" or "Opened <session>,
outside your project filter" there for two seconds, never in a toast.

A branch and its pull request follow one state table on every surface: the
Now card branch rows (`BRANCH_STATE_TONE` in
`features/session/central/branches/branchStateTone.ts`), the pull request pill
and icon (`PULL_REQUEST_PRESENTATION`, `pullRequestStateToneOf`) and the
attention reasons above. Color says the state of the thing in the row, never
whether it has a card in Next. `stateToneMap.test.ts` walks every map and fails
on a disagreement.

| state                                                  | tone    | words                        |
| ------------------------------------------------------ | ------- | ---------------------------- |
| merged                                                 | merged  | Merged                       |
| approved, ready to merge                               | success | Approved, Ready to merge     |
| in merge queue                                         | primary | In merge queue               |
| open, in review                                        | info    | Open, In review              |
| checks running, rebasing                               | info    | Checks running, Rebasing     |
| draft                                                  | neutral | Draft                        |
| no pull request, not pushed, nothing committed, closed | neutral | No pull request, Not pushed  |
| changes requested, conflicts, remote branch gone       | warning | Changes requested, Conflicts |
| checks failing                                         | danger  | Checks failing               |
| done agent or step                                     | neutral | a muted check, never green   |

Green for an open pull request would make approved stop standing out, so open
is `info`. `StepMeter` paints by state only: a done segment fills
`muted-foreground`, the running segment `primary` with a soft pulse, a step at a
ready gate or a question `warning`, a failed one `danger` and one not started
`border`. The role never colors a segment, it stays on the row icon, and green
never appears, so the bar cannot read as a passed test. A run of two steps or
fewer draws a tiny count (`1/2`, steps started over steps) instead of bars. The children of a Running row
hang from one 1px `border` lane with a quarter elbow each (`LiveSpine`); the
shared `WorkNode` done node keeps its violet disc.

`StageTrack` draws where a branch stands as one 80px line of stages (Commit,
Push, Pull request, Checks, Review, Merge on a Now card branch row). A 1px
line joins the stages and is filled `muted-foreground` up to the last stage
reached, `border` after it. A stage has four looks: done is a 6px
`muted-foreground` dot, current a 10px dot in the state tone (the only tone on
the track), todo a 6px hollow `faint-foreground` ring and skipped a short dash.
There is no ring state: a running or stale step is current, and its tone and
word say the rest. Each stage names itself and its state in its own Tooltip
("Checks skipped"). The track is `role="img"` and its accessible name lists
every stage with its state ("Commit done, Push done, Pull request current,
Checks to do, ..."). Never use `StepMeter` (segments of a run) or `WorkNode`
(one node) for stages with connectors.

The other nodes are the stage's own. Running is the ring with the centre dot,
done is `finished`: a solid `merged` violet disc with a white 12px check, the
same size and weight as the green approved disc, so it reads as complete next
to the hollow rings (a session whose pull request closed unmerged keeps
`closed`, the muted check), in review and building are a 1px hollow ring named
by the stage word (never "Idle"), and archived is `queued`, a dashed faint
ring, only under Show archived.

Human-input reasons (`open-question`, `fix-needs-you`, `needs-approval`,
`plan-approval`, `run-waits-for-go`, `run-paused-at-limit`, `auto-needs-you` and
`slack-reply-waiting`) outrank running: the stage is needs you and, while an agent
works, the node keeps the reason's mark and takes the running `spin-border`
(`isSpinning`), the Board card breathes as a running card, and the hover card
adds a line, An agent is working. An agent error and a stopped run keep their place above running.
Failing checks, changes requested, comments it couldn't fix, approved and unread
rank below running, because an agent may be working on exactly that.

The title is `text-row`. Needs you and running read in `foreground`, idle, done
and archived in `muted-foreground`. The open session is medium weight, and its
row has no fill while its pages are nested under it. The pages are 28px
child rows in a `SelectableRow` (the five work pages, and Questions while one is
open, warning-toned), with no indent of their own because the card
groups them (see The left column): the page icon in its concept tone, centred
in a 14px box so it sits in the node's column, then its word starting at the
title's x, and its count word in `faint-foreground`. There is one current sign,
from `currentSignOf`: the page that matches takes `bg-selected` and
`aria-current="page"` alone; where no row matches (Tools, linked records) or
the pages are folded, the session row takes `bg-selected` and
`aria-current="page"`; while a studio sits over it the session row keeps medium
weight and `text-foreground` with no fill and no `aria-current` (`remembered`).
The row carries `data-current-sign`. A 16px chevron button sits at the right end
of the open row (visible on hover and focus, always visible while folded,
`aria-expanded`), and a 20px ghost pin button in the same slot on hover and
focus of any live row (the checkbox owns the left slot). With two or more
branches the card nests a 28px row per branch under the Branch page while it
is current, at the page indent, up to five and then `All branches`: the repo
glyph, the branch cut at the end in `text-code`, and the pull request glyph;
the current branch reads in `foreground`. Every row and button takes its hover
wash and focus ring from `ROW_INTERACTIVE`, never a copy.

The hover card is `bg-floating`, `border`, `shadow-lg`, 320px wide and `p-3`,
and its title row, state rows and facts line are the `FactCard` parts
(`FactCardHeader`, `FactCardState`, `FactCardFootnote`), so it and every fact
card share one anatomy and cannot drift; only its chips and actions are its own,
at `z-popover`, 8px to the right of the column and aligned to its row, with a
`gap-3` between its blocks: the title in `text-heading`, the node with the stage
word and its reason in `text-meta` (under needs you, the winning reason's
words, then each other reason that holds on its own line behind a small tone
dot, so a red mark is always explained),
the run progress, the chips (`Chip` `xs`:
the pull request in its presentation tone, linked tasks as the compact task
chip, projects with the folder glyph), a `text-meta` line of agents, spend and
age in `faint-foreground`, and one `GhostActionButton` when the session needs
you. It opens after a 500ms rest or keyboard focus, swaps at once between rows,
and enters with `popover-in` once, never on a swap.

The switcher is the palette frame (`z-command-palette`, a scrim, the floating
surface) at `max-w-105`. Its rows are 36px `SelectableRow` options: node, title
and age. Its foot shows two gestures, `⌃Tab next` (the real control glyph from
`shortcutGlyphs('session.switcher')`) and `Release to open`; back and Esc still
work and live in the Keyboard shortcuts list. It stays hidden for the first
120ms of a hold, so a quick tap flips sessions without drawing it. With pins it
adds a `Pinned` eyebrow and listbox of up to eight sessions above `Recent
sessions`; the first `Tab` still selects the previous session wherever it sits.

## Rail

The 44px rail (`ColumnRail`) keeps its 32px door buttons and adds 28px node
buttons (`RAIL_NODE_BUTTON` in `RailButton.tsx`) under the doors, in the
workspace scope only: the open session (the row's `StateNode`, current
fill on its page, no fill and `text-foreground` while a studio sits over it),
then up to seven pinned sessions with the title and the stage words in a
tooltip, then `+N` in `text-meta`. The open session and `+N` open a flyout
instead of a tooltip: the floating surface, 288px wide, `z-popover`, 8px to the
right of the button, holding the title and stage words, the pages list (the
same `SessionPages`), the branches and a `Pinned` eyebrow with one row per pin.
It opens after a 150ms rest or keyboard focus, closes 180ms after the pointer
leaves, and Esc closes it and returns focus to the button. `New` shows a 6px
primary dot (`data-slot="draft-dot"`) while a written draft waits, and its label
and tooltip read `New session, draft in progress`.

## Work meta

The right end of a work row is `WorkMeta` in
`packages/ui/src/components/WorkTree/`. Its columns have fixed widths from
`WORK_META_COLUMN`, so every row reads down the same columns and a cost of
`$12.40` never pushes the model of the row above out of line. A row says a duration one way, minutes and seconds ("4m 40s"),
running or done, and so does every surface that reads `formatActiveTime`.

| column     | width | holds                                                                                                                                                 | in a narrow row                                |
| ---------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| time       | 80px  | measured time or estimate ("~3-7m left", "~6-9m", "4m 40s")                                                                                           | "left" goes under 640px, gone under 500px      |
| cost       | 48px  | what the row has spent, empty before anything is spent                                                                                                | under 620px it leaves the row                  |
| cost range | 72px  | an estimated cost range before a step starts (`isCostRange`)                                                                                          | under 620px it leaves the row                  |
| model      | 136px | `ModelBlock`: a 24px provider glyph cell, then model and version on line 1 (meta size), variant and effort on line 2 (chip size, faint), left aligned | lines hide under 640px, glyphs stay            |
| stack      | 72px  | Activity and Runs: duration on top (meta size, muted), cost under it (chip size, faint)                                                               | cost leaves under 620px, all of it under 500px |
| action     | 80px  | the one verb of the row (`ROW_ACTION_LABEL`, at most nine characters), right aligned; present only in a feed that has an actionable row               | never drops                                    |
| menu       | 24px  | the row menu, like Stop run on a run row                                                                                                              | never drops                                    |

The state slot of a work row (`WORK_ROW.stateSlot`) is not a column: it is
`min-w-28 max-w-64` (112 to 256px), so a long state such as "3 ready · 4
working · 1 couldn't fix" shows whole when the row has room, and the title is
what truncates first. Under 790px of row it narrows to 96px, under 320px it
leaves.

A row inside a `WorkTimeProvider` always renders the time column, empty when
it has nothing to say, so the columns stay in line. The cost column follows
the same rule: `cost={null}` keeps an empty column, and leaving `cost` out
drops it, as the builder does for a plan with no measured estimate yet. A
run row takes the time column and the cost column like any other row.

The step rows of the activity timeline and of the run tree (Runs, the run page
and a Brief's Subagents) are one grammar: role icon, step title, model with
effort, then time over cost. Both draw it from the same pieces, so they cannot
drift: `TimelineRoleGlyph` for the icon, `AgentRowMeta` for the right side
(`TimelineModelCell` and the stacked `TimelineRowMeta`), `agentRowIdentity` for
the card and the accessible name, and `useRowCard` for when the card opens.
The role is an icon only, never a coloured role-name pill: the 18px glyph has
the role as its accessible name (`role="img"`) and in the card header. The
workflow builder keeps its role pill because the role is a field there.

The right side uses three columns, in this order after the state word: the
model block (`ModelBlock`, drawn by `TimelineModelCell`), the stacked time and
cost column (`TimelineRowMeta`) and the action column. `ModelBlock` is the same
trick as the time and cost stack: a 24px glyph cell centred on the row midline
(14px icons, two providers overlap by 6px), then two 16px lines. Line 1 is the
model and version and sits on the baseline of the time, line 2 is the variant
and effort (`Thinking · High`, faint) and sits on the baseline of the cost; it
is left out when empty. The models are read from the turn spans of the agent in
run order. An agent that ran on two models shows the one it ended on with "from
Kimi K3" on line 2, and "3 models" from three. A run row shows the model with
most steps and "+ 2 models" under it. The card lists each model in order. The
name truncates before the title does, and under 640px the lines go and the
glyph cell stays. The title keeps a 160px floor (`WORK_ROW.label`) down to a
640px row; under it the title truncates first, so a state word never pushes
the model and the stack past the edge the other rows end on. A live agent ends on its current routing; an agent that has
not started shows its planned model in faint. Every row holds the model and the
stack, empty when it has nothing to say, so duration and cost line up down the
feed. The action column is a fixed 80px, `justify-end`, and a feed draws it on
every row as soon as one row has an action, so the model and the stack end on
the same edge in every row (`scripts/validate-scenes.mjs` measures it on
`step-rows-activity`, `step-rows-runs` and `workflow-run-plan-review` at 1100,
1440 and 1920). Action labels are verbs from `ROW_ACTION_LABEL`
(`features/workTreeModel/rowActionLabels.ts`): Answer, Skip, Open plan, Open,
Start, Resume, Retry. A label never passes nine characters and the row title
names the object ("Start", never "Start implementer"). A row has no menu slot.

The role glyph before the title and the model cell are the only two hover
targets that open a card (`RowIdentityCard`, `RowModelsCard`, `RunIdentityCard`).
Each one wraps its trigger in a `FactCard` and sends data only (header, facts,
a footnote, six rows at most: a model list or a run with many steps keeps five
and a footnote says how many more), so the cards sit on the floating surface
with the session hover card's timing: the pointer rests 500ms, the card closes
180ms after it leaves, and a card opens at once when another closed less than
300ms ago. The run tree opens the same cards: its glyph and meta sit above the
row's click layer (`WORK_ROW.pointerLayer`) and a click on them still opens the
step. A trigger passes through `TimelineRowIdentity.wrapCard`, so the glyph and
the model cell never import a card. Keyboard focus on a row opens the identity
card after the same 500ms (a click never does), blur and Escape close it, and
`i` on a focused row toggles it at once (`useRowCard`). Nothing is only in a card: the Brief has the same facts and the
accessible name of a feed row reads "Implementer", then "Sonnet 5.5, High".

The narrow rules are container queries, never window breakpoints, because
the same feed sits in a wide overview and in a split pane. The activity feed
puts the container on each row's content box (`WORK_ROW.container`, right of
the time gutter and the rail), so the widths above are the room the label and
the meta share, not the width of the panel. The label always gets what the
meta leaves: the role and run glyphs are the same 18px circle at every width,
the model cell keeps only its glyphs under 640px, and the state slot always reads the short form ("Needs you",
"Step 3 ready"), with the full sentence in its tooltip. A row with no state
word and no note draws no slot, so a finished row gives that room to its
title. The slot never shrinks. The title keeps about 45% of the row: the
meta gives way first, in this order, the cost leaves under 620px, the time
under 500px. Only then does
the title truncate, and the label keeps a 160px floor (`WORK_ROW.label`)
until the row is under 440px. Under 320px the row state goes (the node and the
action still say it). The cost stays in the time tooltip. A folded run or chain
keeps its title whole before its summary: the summary takes the room left
beside the title and truncates its tail first, then the title truncates. A list under 440px also
drops the time gutter; the day and Now labels move beside the rail. Label segments keep their
leading words and tokens whole ("Opened #612:") and only the last segment
truncates. A row carries no hover hint on its right; the open target and the
keys are read by screen readers (`aria-description`, `aria-keyshortcuts`).
"Longer than usual" shows only on a running step, never on a finished one, and
it is not a word in the row: the duration turns to the warning tone, the note
leads its tooltip and screen readers hear it after the time, so it never pushes
the model column.
What leaves the row stays in the routing tooltip, which
always reads the whole route ("Claude · Opus 5.5 · High"). The builder and the plan
parts draw the same block through `RoutingModelBlock`, with no fill and no chip. Its words come from
`routingLabelParts`, the same function behind the model picker trigger, so a
row, the trigger, the queue and a header say a route the same way: the catalog
label is the model name (`GPT-5.6 Sol`), the Cursor
modes and the effort are details. Planned routing (a step that has not
started) is faint; routing that ran is muted. The detail is faint while the
effort is only planned and takes the row tone once the run reports the effort
it was started with. When the run picked something other than the plan, in
model, provider or observed effort, the whole cell is underlined dotted and
its one tooltip names the plan ("Planned Opus 5 High, routing picked Sonnet 5
Medium", "Planned High, ran Medium"). Nothing is struck through. The activity
feed, the workflow run tree and the Subagents tree of a Brief all end their
rows with this meta, so a step and its sub-agents read the same wherever they
appear. Headers, cards, tables and the queue use the inline `RoutingLabel`. `RoutingLabel` says
the effort only when it is not the default Medium ("Sonnet 5.5 · High", plain
"Sonnet 5.5" at Medium), unless the effort diverged from the plan; its
tooltip always reads the whole route. The picker trigger draws the provider mark in its brand color, reads "Auto ·
Sonnet 5.5" while Auto resolves the route (`autoTrigger="resolved"`), and says
a verbosity only when it is not
Normal ("Verbose", "Terse"), and a pinned route as "· pinned" in gray.

## The plan in the workflow builder

The builder draws the plan with the same grammar as the run, so a step
looks the same before and after it starts. Every row is future, so every node is `queued` with its
number and the lane is dashed in the run's identity colour. There is no
ordinal column: nothing in the form can turn into a check. Each row draws
its own lane segment over its own height, so an expanded row lengthens its
segment and needs no second lane engine. A recipe reads top down: step 1 is the first row and
**Add step** is the last node, under the last step, so the lane is a dashed
line that ends at that node. The first row is the origin, so the lane starts at
its node, and a drop zone above step 1 draws no lane. The run tree and the
activity timeline keep growing upward to NOW on purpose. The form sits on the pane measure, the same column as the
workflow detail, so the plan keeps its width when the run starts. The meta
columns are `WorkMeta` with no `@container` above them, so the effort shows at
every width, since choosing it is the point of the form. The row's trailing
column is `WORK_META_COLUMN.menu`, sized to the reorder grip it holds. A row opens in place as
one group (the rule in `docs/styling.md`), and its model axes are the
`RoutingPicker` body mounted inline, not a copy of it. Once the workspace has
enough measured steps and at least one step in the plan has an estimate, each
row's time column holds its usual range and its cost column a cost range, in the same faint as the planned routing, and the
name row carries the plan's total in a muted chip. Nothing in the form draws a
percentage or an arc: nothing has run yet.

An orchestrated plan has no steps yet, so it draws the orchestrator as the
origin node, the guidance disclosure under it and three example rows below:
queued nodes, muted role pills and a bare bar for the title, never text or
routing, under a caption that says they are an example. They enter once,
top to bottom, staggered 120ms apart, with the
`fade-in` transition keyframe and `animation-fill-mode: backwards`. The
entry confirms that the mode changed and that the run grows one step at a
time. It never loops, and reduced motion drops it.
