# Lens surfaces

> **Read this when** you change a session page that reads one kind of thing: the Overview, Activity, Runs, Questions, Artifacts, an issue, an agent page or the files of a project. **Not for** the Branch page ([branch-page.md](branch-page.md)) or the head and tabs around a page ([session-rail.md](session-rail.md)).

## Rules every lens keeps

- **One header grid for every page.** An 8px inset, one 32px title row with the
  page's only `h1` (`text-title`) and its actions at the right, the optional meta
  line under it, and the tabs on their own row below. The title's centre is 24px
  under the pane top and its left edge is the column's content edge on every page,
  studio and sub-page. The row is fixed (`h-8`, never wraps, a long title
  truncates). The crumbs name the structure, the `h1` the object. Header blocks sit
  `PANE_RHYTHM.block` apart; `frameGeometryOf` (`packages/ui`) is that table.
- **A lens you leave stays alive.** `SessionWorkspace` gives the lens panes to one
  `PaneSwap`, keyed by surface, and keeps the last three visited
  (`LENS_KEEP_ALIVE_CAP`) mounted under `Activity`, so scroll, filters and open
  threads come back, and the panes cross-fade. `useScrollMemory` (`packages/ui`, 50
  keys, LRU, `<sessionId>|<slot>`) restores the Branch page's scroll only once its
  data is loaded, and `evictSession` clears it on delete. After a swap the user
  caused, focus moves to the new pane's `h1`.
- **A lens shows one level; a studio is a rail plus a detail.** Selecting a card
  swaps the list for the detail, and the back row or Back returns. No lens keeps a
  rail beside its detail, except Review, whose open comment sits in the drawer
  beside the list. Completed and discarded groups sit behind header toggles that
  hide at zero, so a session whose runs are all done shows an empty state.
- **A lens is reached from the Overview or Search or run, never from a rail**, and
  its page has the session crumbs, no trail. Overview rows and chips route to it by
  expanding in place or opening a side panel. Lifecycle actions are not navigation
  and stay off those rows.
- **A count on a row is a promise.** It counts what the destination lists, every
  surface routing there shows the same number from the same selector, and a group
  with no home at the destination gets no badge.
- **Reference beside the work opens in the right drawer.** Popover = pick one
  thing in ten seconds; drawer = reference next to the work; page = the work.
  Creating or configuring stays in a popover, navigating in the rails and tabs, and
  an object you work on is a child page under the crumbs
  ([right-drawer.md](right-drawer.md)).
- **A blocked action is re-routed, never hidden.** A blocked workflow advance gives
  the reason on the CTA and opens an inline confirm before anything starts; with
  auto-run off, nothing advances without a click.
- A step chat is one explicit click, never an automatic redirect. A lens-wide
  toggle is its own row, never inside an empty state's action slot.
- **The switcher and Search or run list only destinations the session can use**,
  from one function. Every session offers **Open Context** (⌘⌥C) and Changes. Diff
  and the other branch lenses need a branch; Pull request is listed on every code
  host; a tool lens appears once its tool is connected. Provider entries open
  **Link work** on that provider and the Context tab, not on an archived session; a
  provider list address restores to Overview. Linked records keep their lenses in
  the palette.

## The Overview

The Overview is the reference page: it shows the whole surface grammar on one
screen, so read it before designing a new surface. One column on the 960 column of
the session pages (`PAGE_MEASURE.overview`): goal, notices, Needs you, Next,
Activity.

- **Rhythm.** Each section has an eyebrow label and at most one primary. Sections
  are peers one `PANE_RHYTHM.stack` gap apart, separated by space, never a
  `<Divider />` or a border. The surface shows urgency itself, never a badge beside
  it.
- **Young sessions.** A section appears once its fact exists; before that it is one
  quiet action row (link an issue, start an agent, attach a workflow), so an empty
  session reads as a young version of the same document. Finished work collapses
  into one summary row per category.
- **Goal** reads as prose (`GoalTeaser`, opening the Context drawer on Goal). The
  facts line under it opens on the source ticket (`OverviewTicket`).
- **Notices** (`OverviewNotices`) hold what a worktree asks you to decide
  ([mounts.md](../mounts.md#worktree-rows-and-the-overview-notices)): a closed
  worktree with Reopen, Restore branch or Remove, a failed action with `Retry`, a
  stopped rebase, foreign commits, a branch drift decision and the first lap
  Publish. A mount follows a branch renamed or switched in its worktree on the next
  status read and logs a `Branch` activity row; only a mismatch it cannot follow is
  a `warning` `Notice` with `Use this branch here`, `Keep both branches` and `Not
now`.
- **First lap.** Before main is on the remote the slot holds one row, `Not
published yet` with Publish (`LapPublishNotice`; Retry when the remote did not
  answer, `Checking the remote` while read). `FirstLapBanner` keeps only the move
  card, the move in progress and its report, as a `Notice` in the banner slot
  (`PaneBannerContext`).
- **Needs you** is the one home of a waiting ask: the eyebrow on the quiet notice
  surface, each row the question with the run or agent in gray, no totals. A
  question is answered there, never from a second `Answer` on the timeline row,
  which keeps only its `?` marker.
- **Next** shows up to three rows, the first verb the only filled button on the
  page. Next and Unassigned comments open with a level 2 `SectionHeader`. A Next
  button carries its label only, and the menu column leaves when no row has a menu.
- **Activity** holds the last three rows and `Open activity`, and no spend (it
  lives in the top bar and the spend popover). Its header holds the **Activity |
  Log** switch, **Mark as read** while an agent has an unread reply and the session
  cost; the Log adds a search field. Rows carry no cost (it is in the duration
  tooltip), the model line holds the effort (`Sonnet 5.5 · Medium`), the day label
  has no rule, and an empty Activity reads `Nothing ran yet`.
- Projects, Linked work and Artifacts live on the Context tab. Mount a project sits
  on the Projects card and on the Overview Projects head.

### Activity is a page under the Overview

`Open activity` (the Overview section, the Board card's `Open` submenu, ⌘K) opens
the `activity` lens: crumbs Overview › Activity, the back button to the Overview,
and a reload reopens it. It is not a sixth tab, and the session `⋯` does not list
it.

- `ActivityPage` (`PAGE_MEASURE.activity`) draws the log's rows, rail, nodes and
  heights, plus a row per script run read from `work_events`, never from
  `session_events`; a terminal command or a check rerun gets the same row once a
  writer records it there. `workOutcomeOf` names the result for the row and the
  Scripts pane alike.
- One boxed `SegmentedTabs` filters by kind (All, Agents, Branches, Checks,
  Scripts, Context), the search box stays, and a `FilterButton` filters by project
  through each row's `mount_id` once the session has two projects. A filtered
  workflow or agent keeps only its rows in that project, and a fact whose workflow
  or agent is filtered out shows as its own row.
- `Mark as read` shows only while an agent is unseen.
- The page reads the newest 200 runs, then 200 more each time the log runs out, so
  an older run still shows under a filter. A failed `work_events` read keeps the log
  and shows `Couldn't load scripts and commands` with Retry.

## Runs

**Runs is the one entry for work**: every run of the session, one row per request,
from `sessionRunsOf` (`features/session/sessionRunsOf.ts`): workflow runs (preset
and orchestrated), Auto conversations and agents started by hand, newest first, In
progress above Finished, archived runs left out.

- A row (`RunsGrid`) draws its state dot, a shape glyph (Workflow or Agent), the
  title, where it came from ("Workflow · Preset Fix a layout", "Agent · Auto
  agent"), its state word, progress, cost and age, and never a native `title`.
- A row opens the page it always had: a workflow run its run page, an Auto
  conversation the Auto chat, an agent its overlay. An agent's home is Runs, or
  Comments for a resolver (`agentHomeLens`).
- The old `orchestrated` lens folds into `workflows` (`foldedLensOf`, in
  `sessionPlace`, `canonicalLocation`, `applyLocation` and the workspace), and a
  saved `agents` or `auto` lens lands on Runs (`withoutRemovedPages`).
- The page opens on the Start a run field (`StartRun`), also its empty state; the
  header holds no other start. **Start a run** in the New menu
  (`newForm.startRun`), the session's ⌘K verbs (`session.startRun`) and ⌘K **Start
  from** a preset (`startRunFromPresetEntries`) all call `openStartRun`, which
  navigates to Runs, clears the run focus and then sends the text to the field
  (`startRunEventName`).

## Questions

One `ListGrid` (`parts/QuestionsGrid`) with **Needs you** then **Answered**, each
counted from two (`questionGroupsOf` in `questionsLensModel`). A question an agent
is answering stays under Needs you and says so in gray.

- A row reads the question, then a gray line naming the run: the answer (`You:` or
  `Agent:`) when there is one, the asker's role and agent name (`questionRunLine`;
  the name left out when it repeats the role), and the age. A blocking ask is one
  warning dot in the leading cell.
- Answered folds behind its count once nothing waits, and stays open while
  something does or while the open question is one of its rows.
- The first Needs you row takes focus when the page opens, once, only when nothing
  else has focus (the pane title `PaneSwap` focuses counts as free) and no question
  is open.
- `EmptyState` shows only when the session has no question at all.

### Opening a question

Every door goes through `openQuestion` (a run row's Answer, a Needs you row, the
run menu, a search hit, an Ask chip, the board, the banner, the Now chip): Questions
with that question open, the `question` target of the address (`questionPlace`).

- The address carries the id, so a reload reopens it, and the drawer (`question`
  kind, `QuestionDrawer`) is derived from it. Opening another question replaces the
  entry, so **Close** (the X and Esc, `closeQuestion`) returns to where you came
  from (the Overview, the list or Ask), never to an empty list.
- The drawer is titled with the asker's role and "asks" (`questionMetaOf`, as the
  row). The role links to the asker (`openAsker`, `features/session/openAsker.ts`):
  an agent you started opens its conversation at the question, a preset or
  orchestrated run step opens that step's page. A deleted asker keeps its role with
  no link.
- A row's right click is the `question` kind (`features/actions/kinds/question.ts`):
  **Open question** and **Open agent** (hidden for a deleted asker).
- The drawer card (variant `full`) names no asker, starts with the Recommended
  answer picked (`LiveQuestionCard`) so Enter sends it, and keeps one filled
  button: Skip and Answer in the footer, and **More** at the top with **Let an agent
  decide**, **Send as message** and **Dismiss question** (`questionMenuOf`).
  Answering moves to the next waiting question. Opened from Ask, it carries **Back
  to Ask**.
- In the asker's own conversation the card shows only the question: Blocking as a
  dot and a word with the pager on top, the question below, one subtle surface with
  no border, option rows without boxes (a faint key that becomes a check, the label,
  `Recommended` as a word), the delegate link and actions in one footer row; four
  options measure about 216px. The compact chat card keeps its footer.

## Artifacts

**A row is the button, with one verb at most**: the state-driven primary (`Run
plan`, `Approve`) on a Needs you row, `Stop` on a running generation, `Restore` in
Recently deleted; the column leaves when no row has one. Edit, Open in browser,
Copy source, Delete and Delete permanently live on right click and in the opened
artifact.

- Groups: Needs you, Running, Ready (plans), To read (reports and wireframes), Used,
  then Recently deleted, labelled like Questions. An unopened report reads `Unread`.
- No kind column (the glyph says it). The state cell shows only what the group does
  not, as a word with a 6px dot, never an icon, the progress (`part 2 of 4`) in its
  tooltip.
- `Run plan` or `Approve` is filled only when `planPrimaryOf` says so
  (`isSecondary` false); with comments not sent it is plain, like the header.
- An artifact page header draws no state chip: the state leads the gray meta line.
  A report shows its title only in the document; the header keeps a hidden `h1`.

## The focused issue page

The issue is an address (`external-task` target, `focusedExternalTask`), opened by
a card through `openExternalTaskLens`, so the crumbs read `Overview › {provider}`.
The page has no back button of its own.

- `Unlink` sits in the record's `⋯`, asks first and leaves an Undo toast. Once it
  lands the address is replaced by the Overview, unless the user moved on; a failure
  keeps the record and its error.
- `Placed on` in the Links group shows `This session` or the branches; its value
  (`TaskPlacementMenu`) opens the linked task row's `Move to` menu: `This session`
  and one entry per open branch of the project (`project · branch`, middle cut), the
  current placement checked.
- `IntegrationPane` hands both to every tracker through `RecordFrameContext`
  (`sessionVerbs`, `linkFacts`), so the loading and error states show the
  placement too.

## The Agent page always has its header

Every agent page (the planner, Scribe, a missing or loading agent) renders one
header row: role chip, title, provider mark, overflow.

- The composer's model chip always names the model the next turn will use, with
  its mark, never a bare `Model`.
- Each turn footer shows the model chip, the duration and the cost; tokens, cache
  share and context window sit in its detail popover.
- The live tail phrase is present tense in sentence case (`Collecting the output`).
- The usage footer drops the turn count when the agent has no turn of its own,
  instead of reading `0 turns`.

## Files of a project

Explore has no pane of its own: **All files** on Changes browses one project at a
time as a tree (`role="tree"`).

- The project chip (`ExploreProjectChip`) names the folder, `ledger-core ·
hl/ledger-rounding`, and with two or more mounts opens a menu grouped by project.
  A first-lap session reads `ledger-core, project folder`, a session without a
  project `Session scratch folder`.
- **A pick is view only.** It sets `exploreMountPath` in the session-view slice,
  never calls `switchBranchMount` or `setSessionActiveMount`, and no agent run moves
  it. Until you pick, the tree follows the write destination (`selectExploreMount`
  in `features/explore`, on `resolveWriteDestination`). A worktree that lost its
  files reads "This worktree is gone".
- `mount.browseFiles` (Browse files) opens All files on that mount's branch page,
  never the first branch (`openExplorePane` passes the mount to `openPlaceRows`). A
  stored `explore` target (`s/{session}/explore/{mount}`) still parses and lands on
  the Overview.

### Opening a file

Every control opens a file or folder through `openTarget` (`features/open/`): the
editor when one is set, else the file drawer for a file and the file manager for a
folder.

- A folder offers Open only when an editor can take it (a repository with an
  editor); a linked folder lists as a folder. The Rust containment check on read and
  open stays.
- The drawer key holds the project (`explore-file:{mount}:{path}`), so the same path
  in a second project replaces the drawer instead of closing it.
- A changed file's drawer offers `Preview | Changes`: Changes is its diff in the peek
  presentation, with Open full page (tooltip Open in Changes).
- **The reader drawer** header reads like the diff drawer's: the type glyph, the
  name, the one labelled open button (`openActionOf`), then 28px ghost buttons for
  Copy path, Wrap lines (code only, `aria-pressed`) and Close. A `Preview | Source`
  row shows only for Markdown and SVG, which open as Preview. The open failure line
  and its Choose editor link sit under the header.
- The body starts with the relative path in `text-code` (folders cut first), then
  size and age faint; no divider, no button. Code and Source render in `SourceView`:
  a `bg-muted` well that scrolls both ways, line numbers from a CSS counter so a copy
  never holds them, colours from the shared highlighter. Wrap is off for code and on
  for prose; the code choice is kept in `goodboy:explore-wrap:v1`.
- Past 5,000 lines or a line over 1,000 characters the text stays plain and one line
  says so. A file that is not text, an image or a PDF says "This file is binary.
  Open it in the app that owns it."

## Five rows in a menu

A `⋯` holds five rows at most in any one state, a destructive row included. A row
with another home (a button on the page, a control beside it) leaves the menu and
stays on the right click menu, which is not bound.

- `overflowCutOf` (`features/actions/overflowCutOf.ts`) names the rows to drop only
  when a state would draw a sixth: `artifactHeaderOmitOf` (the buttoned verbs, then
  Show in Finder, which the saved copy block offers), `recordHeaderOnlyOf` (Copy
  key, then Refresh) and `drawerMenuOmitOf` for the comment drawer (Copy link, then
  Agent transcript).
- The agent, run, session and branch menus list their rows
  (`AGENT_HEADER_MENU_IDS`, `runPageOmitOf`, `sessionMenuOf`, `branchMenuRowsOf`).
- Hover row menus list theirs per state. The rail branch row (`onlyOf`,
  `mountRowMenuOf`): open is Open pull request, Open, Switch branch, Copy and Close
  branch; merged is Open pull request, Open, Copy and Delete local branch; closed is
  Reopen, Copy and Unmount. The commit row (`HISTORY_ROW_MENU_IDS`; Move up, Move
  down and Copy subject stay on right click), the stored worktree row
  (`WORKTREE_ROW_MENU_IDS`) and the port row (`portRowMenuOf`: a row with a stop
  control omits Stop and Force stop, a nested row shows Stop, then Force stop once
  Stop did not end it). Each right click lists every row.
- `overflowRows.test.ts` and `overflowRows.drawer.test.tsx` in
  `src/__tests__/actions` walk every state through the real menu code and fail on a
  sixth row.
