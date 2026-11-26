# The session page tabs, head and crumbs

> **Read this when** you change a session's page tabs, its head and title row, its crumbs, Esc inside a session, or how the user moves between sessions. **Not for** the Projects and Linked cards ([projects-card.md](projects-card.md)), the tools beside the page ([session-tools.md](session-tools.md)) or what each tab shows ([lens-surfaces.md](lens-surfaces.md)).

## Session page tabs

There is no session column. The places rail keeps Board current while a session is
open, and Sessions in the top bar (⌘B) opens the searchable list; a row opens its
session on Overview.

The session's pages are page tabs under the session title (`SessionPageTabs`, on
`PageTabs`): Overview, Runs, Artifacts, Questions and Context, on every session,
with or without a branch, from one list (`pagesOf` in
`features/session/pageRegistry.ts`).

- **No Changes tab.** Changes belong to a branch, so they open on the Branch page
  Changes tab ([addresses.md](addresses.md#aliases-live-in-canonicallocation)); a
  branchless session's `files` place shows its file versions as a detail.
- **No Overview or Desk switch.** A tool from the right rail splits the page into
  the Desk ([surfaces.md](surfaces.md#the-tools-build-the-desk)).
- **The tab is the stored place.** The selected tab is read from the open lens
  (`currentSignOf` over `useSessionPageLens`), so a reload restores it. A lens the
  tabs do not own (an integration list) selects no tab; a place that no longer
  exists opens Overview. A tab press opens its lens (`openSessionPage`) and writes
  nothing else.
- **Context** is `ContextTab`: the Projects and Linked cards (`SessionLevel`,
  through `ContextCardsContext`), then goal, decisions, summary and explanations
  (`ContextDrawer` in page mode). `openContextDrawer` navigates to the tab and
  keeps the section, view and highlight in the place's rows (`context.section`,
  `context.view`, `context.highlight`); it opens no drawer.
- **A pull request page shows its own tab row** under the crumbs
  ([branch-page.md](branch-page.md)). Never two tab rows.
- **No fold, no width.** `SessionFrame` keeps the session tools rail and its
  drawer inset only. The tools are a thin icon toolbar at the right edge, the same
  on every page ([session-tools.md](session-tools.md)).
- A studio over the session covers the page; the places rail lights that studio.

### Counts and the current sign

- Counts sit on Runs, Artifacts and Questions in one right-aligned slot as wide as
  its content: the total in tabular gray (`countSlotText`) at rest; the running
  count beside the 6px info dot while something runs; the warning dot first with
  its own count for a run that waits on you or failed (the dot of
  `runRowFactsOf`); the warning dot on Questions while a question waits.
- Every number comes from `pageSlotOf` over `usePageCountFacts`, so the label, the
  count and the dot never differ between tabs and tooltips. A tooltip holds the
  label, the count word ("1 running") and the shortcut (⌘⌥O, W, P, Q, F).
- The Runs count is `sessionRunCountsOf` over the `sessionRunsOf` rows the page
  lists, pinned to the Now card by `sessionRunsOf.test.ts`; the Artifacts count is
  `liveArtifactCountOf`, pinned to the page's All tab. A list page repeats no count
  under its title.
- `currentSignOf` (`SessionPageTabs/currentSign.ts`) returns a page id, `session`
  or `remembered`. A page with an entry takes `bg-selected` and
  `aria-current="page"`; on the Branch page the worktree row of the shown mount
  (`useBranchIdentity`) takes it instead.

## The session head

`SessionFrame` hands `SessionHead` (`app/components/SessionHead`) to
`SessionWorkspace` through `SessionHeadContext`, which draws it once above every
page and overlay: the title row, then the tab strip, whose rule spans the column.

- Every tab shows the same head at the same top; no tab draws a title of its own,
  and a kept page intro sits under the tabs in the muted role (the Runs lede).
- Pages sit under the head (`UnderTrailContext`), so their header adds no top
  inset and an empty one draws nothing.
- The session title is the h1 on a tab and plain text on a detail, whose own title
  row holds the h1.

### The title row

- The session title, the linked key in gray mono before it
  (`SessionOverviewPane/OverviewTitle`), then **New** and More session actions.
- **New** (`OverviewActions`, ⌘N) is a menu from the `newForm` kind whose pick
  opens its form in the New drawer.
- **More session actions** (`⋯` over the `session` kind,
  `SessionActions/SessionLevelActions`) holds five rows (`sessionMenuOf`): **Ask
  about this session** (⌘L), **Pin session** or **Unpin session**, **Refresh
  session** (⌘R), **Archive** and **Delete**. Each runs through the head's
  `useActionControls`, so a failure keeps the old state and shows under the row
  with Retry. An archived session shows Restore, which never asks, and **Delete**.
- **Archive session** is the filled button when every branch is merged, no agent
  works and no question is open (`ArchivePrimary`, `isArchivePrimaryOf`).
- A detail page drops More session actions (`SessionHeadActions` `isDetail`), so a
  page shows one `⋯`, the menu of what it shows; no page header carries a second
  session `⋯` (`scene-primaries.test.tsx`). `PaneActionsContext` stays for a page
  that lends its action to a nested header (the issue detail's back word).
- ⌘L (`ask.open`) is bound once per visible session (`useAskOpenShortcut` in
  `SessionWorkspace`), not by the button.
- The limit, the asks state and Stop running live on the run status line, the
  agent's Limit chip, the board card's right click menu and the palette.

### Archive and Delete ask

The archive verb carries a confirm (`archiveConfirmOf`, "Archive session?", saying
how many agents still run, from `runningAgentCountOf`, and that they keep
running). The `⋯`, the board card's right click menu, the palette and ⌘⇧A ask the
same way: `SessionArchiveBridge` anchors the ⌘⇧A confirm at the window corner, the
`⋯` anchors it to itself (`ArmedActionPopover`), and Undo on the toast restores.
Delete asks with the registry's delete confirm ("Delete session?").

### Rename in place

A rename request (`session-header`, from the palette, the board card's menu or the
shortcut) edits the Overview title in place while that Overview is open, else the
board card (`CardRenameField`). A click, or Enter or F2 on the focused title, does
the same; an archived session's title stays read only.

1. Both edit in `shared/components/TitleField`: on the Overview across the title
   row in the h1 role with a quiet underline, the linked key outside the field and
   written back before the name; on the board card in the compact density.
2. A click puts the caret where you clicked (Enter, F2 and a request select the
   name), so the text does not move.
3. A `LimitRing` fills toward 120 characters (`SESSION_TITLE_MAX_LENGTH` in
   `@goodboy/types`, the one number the store clamp, the field, the goal card and
   the issue brief prompt read), labelled `84 of 120 characters`, warning from
   90%. A longer draft is blocked before any write (`useInlineRename`).
4. Enter saves, Escape cancels, and focus returns to the title.
5. The write goes to the database first and the title changes only once it lands
   (`renameTask`), pending meanwhile. A failure keeps the old title and shows the
   error with Retry beside the open field; a refused name (empty, too long) shows
   the reason with no Retry (`canRetry`).

A title Goodboy wrote reads "Named by Goodboy" on the session hover card.

### The session limit

**Limit** and **Raise limit** on a paused run open the session spend popover from
the edit host in `SessionFrame` (`SessionCostChip` with `placement="editHost"`,
`requestSessionSpendLimitEdit`, `sessionSpendLines`). **Limit** on another
session's board card opens that session and holds the request by its id until its
edit host mounts and takes it once (`openSessionSpendLimitEdit`,
`pendingSpendEdit`); going anywhere else first drops it. An agent page's **Limit**
chip edits the same limit.

## Crumbs

On any place that is not a tab (`isTabView`: the Overview, Runs, Artifacts,
Questions, Context, also with a question drawer open), the head keeps its title
row and draws crumbs in place of the tabs (`SessionCrumbs`).

- **A back button leads the title row** (`SessionBackButton`, an outline
  `ArrowLeft` icon button the size of the head's controls, on the column edge),
  named `Back to {parent crumb}` with Esc in its tooltip. It calls `up`. There is
  no `Back to` line. A tab draws no back button and no crumbs.
- `crumbsOf` walks `parentPlace` from the open place up to the session and
  prepends `Overview` (`NAMES.overview`), never the session title. One crumb per
  object: a branch with a file or a thread open is one crumb.
- Each crumb but the last is a quiet `xs` button that calls `upTo`: a real
  navigation, so a reload or a deep link still goes there, and a Back when the
  entry below is that place. The last crumb is the page (`aria-current="page"`).
- Five crumbs or more fold (`crumbFoldOf`): the first and the last two stay, the
  rest become one `…` crumb with a menu (`SessionCrumbFold`); a middle crumb is
  capped at 192px.
- Session crumbs carry no status dot and no segment menu: each is one link.

### What each place reads

Names come from `placeTitleOf`, the one name a place has, which the history arrows
read too.

| Place                                                     | Crumbs                                               |
| --------------------------------------------------------- | ---------------------------------------------------- |
| A main agent                                              | `Overview › Runs › {agent}`                          |
| A sub agent                                               | `Overview › Runs › {parent agent} › {agent}`         |
| A run, a run step                                         | `Overview › Runs › {run title}`, then the step names |
| An artifact                                               | `Overview › Artifacts › {artifact title}`            |
| A branch or pull request                                  | `Overview › {branch name}`                           |
| A GitHub issue, a linked task, a branchless Changes place | `Overview › {page}`                                  |

- A run is named by its title, else its workflow's name, else `Run`. An Auto run
  and every agent under it use `autoRunTitleOf` (`features/session`: the first line
  of the ask, else of the run's first message, else `Lead`, never `Auto`), also
  read by the run page crumb and the Agents rail root.
- An agent Auto started that keeps its role name reads `{Role} · {short task}`
  (`agentTaskLabelOf`: the role noun and the first sentence through
  `taskTitleOf`, never the raw prompt), middle cut, the brief one click away.
- A delegated child names its root and parent agents between the run and itself,
  and an open question it answers adds a last crumb. There is no step strip and no
  "Part of {Workflow}" line.

### Structure, not history

- A parent comes from the open object, never from where the jump came from. The
  activity feed, the palette, a notification, a chip and a restored session are
  shortcuts into a place that already has a parent; none may rewrite it.
- Selecting an agent leaves the active lens where it was. Opening a child adds its
  parent; selecting a sibling changes only the child region.
- A child hangs off the section that owns it: a step under its run under Runs, an
  ad-hoc agent under Runs, a resolver under its comment on the Branch
  (`s/{session}/review/t/{thread}/agent`).
- The history arrows are memory, not a way up: `Back: {place}` and `Forward:
{place}`, the session title on a second line and `Hold to show history` on a
  third; a hold or right click opens the History menu. Tests take
  `[data-nav-arrow="back"]`.

## Esc is one ladder

Esc in a session is one ladder (`escapeLadder`, the base escape layer of
`SessionWorkspace`, the same steps as ⌘W below its studio):

1. A popover, a menu or a confirm takes Esc first.
2. In a field with text, Esc leaves the field and keeps the text. While an agent
   runs, the composer's Esc arms Stop first.
3. An open drawer closes: the top of the slot, then the drawer from the chip
   ([surfaces.md](surfaces.md#closing-the-top-of-the-slot)). Esc never changes
   Overview and Desk.
4. A page with a back row does what the row does: a step to its run, a run or an
   agent to Runs (through history when the list is below), a list page to the
   Overview.
5. On the Overview Esc does nothing.

No page registers its own Esc to leave, except the artifact run page, which has no
address yet.

### Keys that stay on the lists

- ⌘⌥W opens Runs and clears its filter (`clearRunsFilter`); below Runs (a run, a
  step, an agent, an Auto conversation) it lands on the list, and on the list it
  stays. ⌘↑ is the key that leaves.
- ⌘⌥A (`session.spawned`, Runs › Running), also a palette row, opens Runs on what
  is running (`runs.filter` in `focus.returnRows`). `RunsGrid` reads it through
  `useRunsFilter`, shows a Running chip with Clear filter, and says Nothing is
  running when the group is empty.
- ⌘⌥P does the same for Artifacts (`OBJECT_PAGE_LENSES` in `useAppShortcuts`). A
  studio or drawer over the list, and a generating artifact page
  (`focusedRunAgentId`, cleared by the key), count as below it. ⌘⌥L is free.
- Runs stays selected while any run, agent or Auto conversation is in the centre
  (`pageLensOf`). An Auto row opens that conversation and no tool. A preset run
  (`executionMode` not `dynamic`) shows its spawned agents in the Agents column of
  the run page; an orchestrated run shows its document
  ([workflows.md](../workflows.md#the-orchestrated-document)).

### A gone object says so

A deleted or moved run, agent, artifact or plan part shows one empty state, "This
run is no longer in this session" (`GoneObject`), with Back on a page; a drawer
waits for its collection to load first. A run still in the session whose steps did
not load says "Couldn't load this run" with Retry and Back (`RunMetadataMissing`,
an `ErrorStrip`), never that it is gone.

## Moving between sessions

### A Sessions row

One line: the title and one trailing `StatusMark`.

- A linked task's key leads when the goal starts with `[KEY]`: `sessionRowTitle`
  strips and returns it, and `SessionRowTitle` draws it in muted mono; the title
  truncates, the key never does. The switcher row and the hover card title do the
  same; the board card keeps its chip.
- The mark says the state by meaning (`sessionMarkOf`, from `useSessionRowFacts`).
  Under needs you it is the winning reason's mark from the one reason table: the
  question glyph, the approval hand, the amber alert, the green check of an
  approved pull request, and the red failed glyph only for an agent error, a
  stopped run, a failed push or failing checks. Running is the ring, done the
  merged check; in review, building and archived leave the box empty. Colour is
  never the only sign.

### The hover card

After a 500ms rest on a Board card, or keyboard focus for as long, the hover card
opens beside it with facts only: the full title; the stage word with its reason
when it adds a fact (under needs you, the winning reason, then each other on its
own line); the run progress (`Implement · 3 of 5`, from the steps that started);
the pull request with its checks (the state word only for Draft, Merged or
Closed); the linked task chips, one chip per project, the agent count, the spend
and the age.

- The card's signal opens what needs you (`attentionPlace`), and its **unread
  reply** button the latest agent with an unread reply (`openUnreadReply`).
- Moving to another card swaps it at once. Esc, a click outside, leaving the row
  and opening a page close it; the pointer may move onto it. Only a keyboard move
  of focus opens it, and the board never brings back a card open when it was
  hidden.
- The Sessions row, the hover card and the board card all read
  `useSessionSummary`, so they use the same words.

### Walking and switching

- `⌘⇧[` and `⌘⇧]` walk one order kept in the data (`sessionOrderOf`, read by
  `useSessionOrder`): pinned sessions in pin order, then sessions that need you
  (longest waiting first), then running, in review and building by last activity.
  Done and archived stay out unless pinned. The order covers the whole workspace,
  whatever the filter or sort.
- `⌃Tab` lists the pinned sessions (up to eight) and then the recent ones in
  last-opened order; a pinned session is listed once. The first press lands on the
  previous session. `Tab` and `⇧Tab` move while `⌃` is held, releasing opens and Esc
  cancels; a quick tap flips to the previous session without drawing the list.
- `⌥⌘↓` lands on the next session that needs you, in the board's order, on its
  `attentionPlace`.
- A focused terminal and an open dialog keep these keys.
- Any move into a session starts a fresh history entry. A worktree row click goes
  through `switchBranchMount` to that branch's landing tab
  ([branch-page.md](branch-page.md#sections-and-landing)).

### Pins

**Pin session** and **Unpin session** are session actions on a live session (the
board card's menu, `⌘K`, every session menu); the pin on a Sessions row toggles
it too.

- Pinned sessions form a **Pinned** group at the top of Sessions and of the
  switcher, oldest pin first. The pin also shows in the Overview title row and as
  a "Pinned" fact on the hover card.
- Archiving hides a pinned session but keeps its pin, so Restore and Undo bring it
  back under Pinned.
- Pins live per workspace in `workspace_values` (key `sessions.pinned`, a JSON list
  of `{ id, at }`), written by compare and swap with one retry so two windows never
  drop each other's pin, read on workspace open and window focus, and pruned of
  deleted sessions on read (`store/slices/session-pins`).
- **Move up** and **Move down** (`session.pinnedUp`, `session.pinnedDown`) reorder
  a pin from the card menu and `⌘K` while it can move; `movePin` swaps two
  neighbours' `at` through the same compare and swap. Dragging is not built.

## Board model

- **A branch is a row by its stored mount id, in any state.** A merged branch and a
  removed worktree keep their rows, because a row never reads the path. Work with
  no known branch lands in one "Not on a branch" row only while an agent or Lead
  there runs, waits or failed, or a question is open, or when the session has no
  branch; otherwise `branchBoardOf` hands its spend, time and counts to the facts
  line through `settled`.
- **Groups are Needs you, In progress, Merged and Not on a branch.** They order the
  rows of each project block (`projectBlocksOf`) and draw no head. Merged shows
  the 3 newest (`MERGED_FOLD_LIMIT`) unless it is the only group.
- **Delete local branches.** The button on the first block with a merged branch
  (and Delete local branch on a merged row with a cleanup proposal) asks, then runs
  `runAfterMergeCleanup` for each branch with `isLocalOnly` and
  `isRemovalRequired`: the folder and the local branch go, never the branch on
  origin, and a folder that refuses keeps its mount attached.
  - One toast offers Undo for all (`deleteMergedBranches`), and a second Undo
    finishes one that stopped halfway.
  - Branches that stay fold into one log row ("Couldn't delete 2 local branches",
    `reportErrors`, keyed by the delete) whose Retry runs only those and replaces
    the row with what is still left.
  - A branch deleted before its cleanup suggestion failed to clear stays in Undo,
    and its Retry only clears the suggestion.
  - The board draws no error line.
- **A row's stage comes from that branch only** (`branchFactsFor`, worded by
  `deriveSessionStage`); the session's error state and unread mark never reach a
  row.
- **Agent time is counted by id.** `sessionKpisOf` reads the board for the
  Overview facts line. A Lead on two branches is two rows and one Lead.

### The one session filter

**Filter sessions** (`StageBoard/SessionFilterPopover`, a `FilterButton`) sits in
the Board's tool row with the count of filters on (`displayStateOf`). Its popover
is a labelled dialog: **Sort** (`DisplayValueRow`: Needs you first, the default,
Alphabetical, Last activity, Created), **Projects** as `Checkbox` rows
(`FilterCheckRow`, "ledger-core, 2", shown only when two or more projects have
sessions), **Mark all as read**, and **Reset** while anything is off its default.

- The lanes are the status and the Archived lane is the archive, so there is no
  Status, Group or Show archived choice.
- The choices persist per workspace in browser storage
  (`goodboy:session-view:<workspace id>`, version 3), never in the database.
- The list shows all sessions, never only running ones: the project filter and the
  fold after eight rows hide nothing you did not ask for, and a session that needs
  you is never folded.

## Tests

- `SessionHead/index.test.tsx` pins one head at the same top on every tab.
- `every-place-has-a-way-up.test.tsx` walks one place per lens and target kind and
  fails when the crumbs differ from `crumbsOf`, a tab draws crumbs or a back
  button, a detail lacks the head back button, a studio trail is drawn, or a back
  arrow or chevron sits outside `DrawerFrame`, the head back button and the history
  arrows (with a named allowlist).
- `no-back-glyph-in-trail.test.tsx` keeps the glyph out of the crumbs.
