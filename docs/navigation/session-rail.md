# The session page tabs and its tools

> **Read this when** you change the page tabs of a session, its head and crumbs, the tools beside the page or the Scripts pane. **Not for** spacing, scroll and overlay mechanics ([styling.md](../styling.md)) or design intent and tone ([DESIGN.md](../../DESIGN.md)). The other pages are listed in [navigation.md](../navigation.md).

## Session page tabs

**No session column.** The places rail always shows New and the workspace places,
with Board current while a session is open. Sessions in the top bar (⌘B) opens
the searchable list, Pinned first, then grouped by state. A row opens its session on Overview. The session's
pages are page tabs directly under the session title (`SessionPageTabs`, built on `PageTabs`):
Overview, Runs, Artifacts, Questions and Context, on every session, with or without a
branch. There is no Changes tab: changes belong to a branch and its pull request, so the
pull request row of the Projects block opens that branch's Changes tab on the Branch page.
The tab row holds no Overview or Desk switch either: a tool from the right rail splits the
page into the Desk. Counts sit on Runs, Artifacts and Questions
(`pageSlotOf`). The pages come from one list (`pagesOf`
in `features/session/pageRegistry.ts`).

- **One session head.** `SessionFrame` hands `SessionHead` (`app/components/SessionHead`) to
  `SessionWorkspace` through `SessionHeadContext`, and `SessionWorkspace` draws it once, above
  every page and overlay, on the page column: the title row (the session title, renamed in
  place, then **New** and More session actions) and under it the tab
  strip, whose bottom rule spans the column like the branch page tabs. A detail page drops More
  session actions from the title row (`SessionHeadActions` `isDetail`), so a page shows one `⋯`,
  the menu of what it shows (the run, the artifact, the pull request); the session menu is one
  crumb up. Every tab shows the same head at the same top; no tab draws a title of its own ("Runs", "Questions", "Context" are the tab
  names), and a page intro, when kept, sits under the tabs in the muted role (the Runs lede).
  The pages below sit under the head (`UnderTrailContext`), so their own header adds no top
  inset and an empty one draws nothing. `SessionHead/index.test.tsx` pins one head at the
  same top on every tab.
- **A detail swaps the tabs for crumbs.** On an artifact, a branch or pull request, a run, an
  agent or any place that is not a tab (`isTabView`), the head keeps its title row and draws
  `Overview › Section › Item` in place of the tabs (`SessionCrumbs`, from `crumbsOf` in
  the navigation store). The crumbs are the `parentPlace` chain from the session Overview to
  the open place, one crumb per object (a branch with a file or a thread open is one crumb);
  each crumb but the last is a link that calls `upTo` with its place, and Esc goes one crumb
  up (`escapeLadder`, `up`). There is no `Back to` line; instead the title row starts with a
  back button (`SessionBackButton`, an outline `ArrowLeft` icon button the size of the head's
  other controls, its left edge on the column edge, the title shifted right by it) named
  `Back to {parent crumb}` with Esc in its tooltip. It calls `up`, the chain Esc walks, so on
  every page below a tab the user sees at once that the screen is secondary and how to leave
  it. A tab draws no back button. The first crumb reads `Overview`,
  never the session title, which the title row above it already shows. The session title in
  the title row is the h1 on a tab and plain text on a detail, whose own title row holds the h1.
- **Ask** in the right rail opens the Ask panel of the session in the dock grid (drawer kind
  `ask`, written by `openAsk` and `closeAsk` with the session they name), pressed while open; a
  second press closes it. The dock draws `AskPane` as a cell like Terminal or Browser, so the
  panel stays while the tabs change and the Overview never switches to the Desk
  (`deskToolsOf` leaves Ask out). The dock folds it and lays it over the page by the same rules
  as every tool. ⌘L (`ask.open`) opens it too and focuses its box.
  Close or Esc hides it. Ask keeps its conversation and starts no agent. The Context tab holds
  no Ask.
- **The tab is the stored place.** The selected tab is read from the open lens
  (`currentSignOf` over `useSessionPageLens`), so a reload that restores the place restores
  the tab. A lens the tabs do not own (an integration list) selects no tab; a place that no
  longer exists opens Overview. Pressing a tab opens that lens (`openSessionPage`) and writes
  nothing else.
- **A pull request page shows its own tab row.** On the Branch page the head shows the crumbs
  and the page keeps its title and its own tabs under them (see
  [branch-page.md](branch-page.md)). Never two tab rows.
- **Changes is a place of a branch.** The `files` lens on a session with a branch lands on the
  Branch page Changes tab of that branch (`canonicalLocation`); the board row's Changes door,
  the palette and the chord go there. A branchless session's `files` place still shows its
  file versions, as a detail under the crumbs.
- **Context** is `ContextTab`: the Projects and Linked cards (`SessionLevel`, handed in through
  `ContextCardsContext`), goal, decisions, summary and explanations (`ContextDrawer` in page
  mode). `openContextDrawer` navigates to the tab and keeps the section,
  view and highlight in the place's rows (`context.section`, `context.view`,
  `context.highlight`, read by the tab); it does not open a drawer.
- **No fold, no width.** The rail's fold, its width and its page-column fold key are gone with
  it; `SessionFrame` keeps the session tools rail and its drawer inset only.

## The Projects and Linked cards

The Projects and Linked cards (`SessionLevel/LevelProjects`, `LevelLinked`,
`LevelFolder`) sit in the Context tab.

- **The cards come first.** The Context tab draws the Projects card and the
  Linked card above its sections (`ContextPageFrame`). The cards have no
  identity row: the Overview title is the session's identity. The Overview h1 is the session title, the linked key in gray mono
  before it (`SessionOverviewPane/OverviewTitle`); a single click, or Enter or
  F2 on the focused title, renames it in place with the same rename as the
  board card (an archived session's title stays read only), and "Overview" is only the
  tab's label. The title row of the session head holds one button at the right
  (`SessionActions/SessionLevelActions`): **More session actions** (`⋯`,
  `ObjectOverflowMenu` over the `session` registry kind), which holds five rows:
  **Ask about this session** (`session.ask`, ⌘L), **Pin session** or **Unpin
  session** (`session.pin` / `unpin`), **Refresh session** (`session.refresh`,
  ⌘R), **Archive** and **Delete** (`sessionMenuOf`). Each row runs through the
  head's `useActionControls`, so a failure keeps the old state and shows under
  the row with Retry (`ActionStatusLine`). The limit, the asks state and Stop
  running are not in this menu: the run status line, the agent's Limit chip,
  the board card's right click menu and the palette keep them. An archived
  session shows only the `⋯`, with **Restore** and **Delete**. The rail has no
  foot: **Limit** and
  **Raise limit** on a paused run open the session spend popover from the edit
  host in `SessionFrame` (`SessionCostChip` with `placement="editHost"`,
  `requestSessionSpendLimitEdit`, `sessionSpendLines`). **Limit** on
  another session, from its board card, opens that
  session and holds the request by its id until its edit host mounts and takes
  it once (`openSessionSpendLimitEdit`, `pendingSpendEdit`); going anywhere else
  first drops it, so it never opens on another session. An agent page's
  **Limit** chip edits the same session limit. Archive asks first: the registry
  verb carries a confirm (`archiveConfirmOf`, "Archive session?", saying how
  many agents are still running in the session when any run, from
  `runningAgentCountOf`, and that they keep running after the archive), so the `⋯`, the board card's right click menu, the
  palette and ⌘⇧A (`SessionArchiveBridge` triggers the same verb and anchors
  its confirm at the window corner) all ask the same way, and Undo on the toast
  still restores it; the `⋯` anchors the confirm to itself (`ArmedActionPopover`
  over the rail's `useActionControls`, so a failure shows under the top row with
  Retry). Restore never asks. Delete asks with the registry's delete confirm
  ("Delete session?"). Rename has no rail
  control: a rename
  request (`session-header`, from the palette, the board card's right click
  menu or the shortcut) edits the Overview title in place while that session's
  Overview is open, else the board card (`CardRenameField`). Both edit in one primitive,
  `shared/components/TitleField`: on the Overview it spans the title row up to
  the header actions in the h1 type role with a quiet underline, the linked key
  stays outside the field and is written back before the name, and a click puts
  the caret where you clicked (Enter, F2 and a rename request select the name),
  so the text does not move; on the board card it is the compact density, the
  card's key before it. At the far right of the field a
  `LimitRing` fills toward the 120 character limit (`SESSION_TITLE_MAX_LENGTH`
  in `@goodboy/types`, the one number the store clamp, the field, the goal card
  and the issue brief prompt read), with no number, its label `84 of 120
characters`, in the warning tone from 90%. A longer draft is blocked before
  any write (`useInlineRename`). Enter saves, Escape cancels and focus goes back
  to the title. A rename writes the database first and changes the title only once the
  write lands (`renameTask`); the field shows pending while it writes, and a
  failed write keeps the old title and shows the error with Retry beside the field,
  which stays open; a name it refuses (empty, too long) shows the reason with no
  Retry (`useInlineRename` `canRetry`). Every one of these verbs is also in the board card's right
  click menu and the palette. A title Goodboy wrote reads "Named by Goodboy" on
  the session hover card. A tab has no crumbs: the column beside it is the way
  to another place. Only one level shows, so a session never carries a nested
  card in the workspace list.
- **The pages** come from one registry (`features/session/pageRegistry.ts`):
  Overview, Runs, Artifacts, Questions and Context. The changes of a branch open from its
  pull request row in the Projects block (`BoardTile`, `branchTabPlaceOf`), on the Changes
  tab of the Branch page with its `Changed` and `All files` modes (see the Changes section of
  branch-page.md). Questions is always there like Artifacts: its slot
  is the open count with the warning dot while a question waits on you.
  **Runs is the one entry for work** (ux27 one flow, unit 1): it folds the
  former Orchestrated, Agents and Auto agents entries. Its page lists every
  run of the session, one row per request, from `sessionRunsOf`
  (`features/session/sessionRunsOf.ts`): workflow runs (preset and
  orchestrated), Auto conversations and the agents you started by hand, newest
  first, In progress above Finished, archived runs left out. A row draws its
  state dot, a shape glyph (Workflow or Agent), the title, where it came from
  ("Workflow · Preset Fix a layout", "Workflow · Orchestrated", "Agent · Auto
  agent", "Agent · Scout"), its state word, progress, cost and
  age (`RunsGrid`). Opening a row opens the page it always had: a workflow run
  on its run page, an Auto conversation in the Auto chat, an agent in its
  overlay; an agent or Auto row keeps its right click menu. The old
  `orchestrated` lens folds into `workflows`
  (`foldedLensOf`, applied by `sessionPlace`, `canonicalLocation`,
  `applyLocation` and the workspace), and a saved window that names the retired
  `agents` or `auto` lens lands on Runs through `withoutRemovedPages`, so an
  old address or a saved window lands on Runs, the crumbs of a run read
  `Overview › Runs › {run}` and those of a top agent `Overview › Runs › {agent}`. An agent's home is Runs, or Comments for a resolver
  (`agentHomeLens`). A row never carries a native
  `title`. The Runs page opens on the Start a run field (`StartRun`), and
  **Start a run** in the New menu (`newForm.startRun`), in a session's ⌘K
  verbs (`session.startRun`) and ⌘K **Start from** a preset
  (`startRunFromPresetEntries`) all call `openStartRun`: it navigates to Runs,
  clears the run focus and, after navigation, sends the text to the field
  (`startRunEventName`). The Runs header holds no other start; the field is also the empty state. A
  page row ends in one
  right-aligned slot as wide as its content, so a label never truncates for an
  empty slot: the count in tabular gray (`countSlotText`), at rest the total;
  while something runs the number beside the 6px info dot is the running
  count, and a run that waits on you or failed puts the warning dot first with
  its own count (the dot of `runRowFactsOf`, the one the Runs row draws); a
  warning dot on Questions. The count word
  ("1 running", "4 artifacts") is the row's tooltip. A list page repeats no
  count under its title: Runs, Artifacts and a tracker list
  (Linear, Jira and the rest) carry their counts on their group rows or filter
  tabs only. Every number comes from
  one function, `pageSlotOf` over `usePageCountFacts`, so the label, the count
  and the dot never differ between the page tabs and their tooltips, which hold
  the label, the count word and the page's shortcut (⌘⌥O, W, P, Q, F); the Runs count is `sessionRunCountsOf`
  over the same `sessionRunsOf` rows the page lists, and a test pins it to the
  Now card (`sessionRunsOf.test.ts`); the Artifacts count is
  `liveArtifactCountOf`, pinned equal to the page's All tab.
- **Projects and Linked are cards** (`SessionLevel/LevelCard`), drawn in the
  Context tab with the grammar of every Context card: a `Band` (rounded
  `bg-fill`, 4px inset) whose head row is `ContextCardHead` (32px, the title
  12px in, the count from `countSlotText` beside it, the actions in one right
  slot on the title's centre line). The body pads 4px (`CONTEXT_CARD_BODY`)
  and a card row adds 4px (`CARD_ROW_INSET`), so text, chevrons, dots and
  counts sit 12px in, on the head's edge, and a hover fill keeps 8px of card
  around it. Every `+` of a level card, header or project row, is
  `LevelAddTrigger` in its own 24px `xs` box, with no size override from the
  card, so all of them share one right edge. The title and a fold chevron are
  one button. A card folds from its header and remembers it
  (`useLevelCardFold`, `goodboy:session-rail-folded-cards:v1`); folded,
  Projects keeps the worst state of its worktrees as one dot in the header
  (`useProjectsSignal`), and Linked shows its item count from 2 open or
  folded, so a state that needs you never hides in a fold. Cards sit 12px
  apart (`PANE_RHYTHM.block`), like every block of the tab.
- **Projects is one tree**, holding every branch of the session, so there is no
  second list to go back from. A folder row (`SessionLevel/ProjectTree`) is
  its name and its `+`; the name toggles the folder and a chevron shows only
  while it is folded. Its accessible name keeps the count and the host ("payments-api, 3
  branches, on GitHub"), never as visible text. A folder's branches sit one
  28px line each (`SessionLevel/WorktreeRow`, `BranchRowLine`): the pull
  request state glyph in its color (`pullRequestStateToneOf`, next to
  `pullRequestStateWordOf`, whose words are the labels of
  `PULL_REQUEST_PRESENTATION` so an open pull request reads Open everywhere;
  draft gray, open blue, approved green, in the merge queue a quiet gray
  (never the blue of open), merged violet, closed gray, no pull request a neutral branch glyph, the
  state table in packages/ui/design/rail-and-work.md), the title,
  and at most one chip. One function, `features/branch/branchRowFactsOf`,
  holds a row's title (the pull request title, else the branch name, drawn in
  mono), state word, number, host key, finished flag, order rank (queued,
  approved, open, draft, none, merged, closed), check counts and the one
  signal worst first: `n failing`, then `Conflict`, then `n behind` (`BranchRowChip`,
  `branchRowChipOf`); approved, queued, open, draft and running checks draw no
  chip, the glyph color carries them. Counts load first, then show: the git
  status reads of the card's branches land in the cache as one set, held at
  most 1.5 s so one slow read never freezes the rest and then lands alone, so the
  rows, the `n branches behind` line and the Next rebase row show no count
  (the list is `aria-busy`) until every branch is read, and a refresh keeps
  the last complete set until the new one has landed whole; a branch whose
  base changed shows no count until its new read lands. The check counts come from the runs read
  for the request on any host, skipped kept apart from passed. The number, the
  state word and the branch are not on the line: they sit in the row's fact
  card (`branchRowCardOf`: the branch as title, `#318` beside it, the state,
  the chip as **Status** and its cause as the footnote) and in the accessible name
  ("title, #318, Open, branch hl/fix, 1 failing"), and the current branch shows
  its number and branch in its Pull request page. The host is never written as text on a
  row, only its logo. Live rows are ordered by that rank, ties by declaration
  (`branchRowsOf`); merged and closed rows fold into one "n finished" row at
  the bottom of the folder (`FinishedFold`), closed by default, kept open
  while the current branch is inside it. A row that changes state moves, and
  focus and the current branch follow the mount, never an index. What you
  fold is remembered per session (`useRailTreeOpen`,
  `goodboy:session-rail-tree-open:v1`, the last 50 sessions). A click on a
  row makes its branch current and opens its pages in place (`switchBranchMount`
  pushes the Branch page into the center); a click on the current row folds or
  opens its pages. Only the current branch shows pages, so the card does not grow
  when you are busy. **Rebase all**
  (`features/history/RebaseAllCard`) is the first line of the card: `n branches behind`
  with a Rebase all button, then, while a batch runs, `Rebasing 2 of 9` with
  Abort in the same 28px line and the same button size, and Dismiss once it
  ended. It draws no list of branches: each branch's state lives on its row
  from the one source, the batch in the store (`rebaseAllRuns`,
  `rebaseAllBranchOf`), also read by that header line (`rebaseAllSummaryOf`):
  a breathing `Rebasing` chip (`soft-pulse`, still under reduced motion) with
  the replay step in the tooltip, a quiet `Queued` on the ones waiting, no chip once a
  branch is rebased even while its behind count is stale, a danger `Conflict`
  (tooltip "Waiting for the Lead") on a branch Auto has not started, a breathing
  `Lead resolving` with the Auto icon on the branch whose rebase is stopped in
  its worktree (tooltip "The Lead resolves 1 file: <path>", from the stop files of
  its history run), `Rebased by the Lead` once an Auto branch is clean again until
  every Auto branch of the batch is clean (`rebaseAllBatchSettledOf`), then no
  chip, `Failed` with the cause in the row tooltip. A `Conflict` or `Failed`
  branch turns `rebased` once git shows the rebase finished outside the flow
  (`settleStaleRebases`, after the turn ends, on focus and on the poll of
  `useRebaseStatuses`, mounted by `LevelProjects` and the central model; a pass that settles nothing writes nothing, and the list of settled stop ids keeps only events the session still holds). When the Lead has the rest the
  header line reads `The Lead has the rest`, still with no list. One function
  (`branchRowChipOf`) owns every chip text and tone. A late
  answer for a batch that is gone is dropped by run id; Abort lets the branch in
  flight finish and skips the queued ones. The card header carries one `+`
  (`LevelAddTrigger`, a ghost `xs` icon button named Mount a project: no border,
  no fill at rest, so the rail stays light) that opens the project picker
  straight away (`MountProjectAction`, no menu first): the folders an agent
  asked for (`pendingMountProposals`), then the workspace projects not yet in
  the session, then `Choose a folder…`, which picks a folder, links it to the
  workspace (`useConnectProject`, `addProject`) and mounts it in the same step.
  The toast's Undo unmounts it and takes it out of the workspace again
  (`mountWithUndo`). A plain folder session shows the Folder card with the same
  `+`, and its Projects card joins as soon as a repository is mounted. A folder of repositories, a project of another
  workspace or a failure says why in the picker and offers Open workspace
  projects. Each repo project row ends in its own `+`, named `New branch in
<project>` (`ProjectRowAdd`), which opens the new branch form
  (`NewBranchMountAction`) at once. It is the registry verb `project.newBranch`
  (`features/actions/kinds/project.ts`, offered on a repo project with a mount
  of a session that is not archived), so any surface that runs the verb opens
  the same form. It is quiet (`faint-foreground`, `foreground` on row hover or
  focus) but visible at rest and in the tab order, never hover only; a folder
  project keeps an empty slot of the same width so the counts line up. An
  archived session draws neither `+`.
- **The current branch, in the tree.** There is no level 2 for a worktree: the
  open rail stays on the session level whatever page is open, and showing the
  Branch lens only marks one row current (`SessionLevel/WorktreeRow`,
  `isOpened`: the row of the mount the Branch page shows). What level 2 held
  moved onto that row. Under it, always visible while it is current: the
  one state pill, with Rebase stopped before failing checks, behind and not
  pushed (`branchRowChipOf`, `branchRowFactsOf`). Request numbers lead the
  title before it truncates (`BranchRowLine`). Rebase actions live on the
  Branch page; Rebase all stays on the Projects header. A branch is one row
  and has no rows under it: its five pages (Pull request, or Merge request on
  GitLab, Comments, Changes, Commits, Checks) are the tab strip under the title
  of the Branch page, each tab with its count from `branchTabFactsOf`. The
  row carries the one pill, and the failing count in it is the number the
  Checks tab shows (`checksCountsOf`). Changes opens the diff in the center,
  whose changed file list sits in its own rail on the right of that page,
  never in the session rail. The branch switch (Switch branch…), Link work to this branch, Copy
  branch name, Copy path, Open in editor, Close branch and the rest are the
  mount registry, in the row menu below. A session restored with the Branch
  lens saved opens on the tree with that branch current and its page in the
  center.
- **The row menu.** One menu per branch row, the mount registry for that
  worktree (`useMountRowMenu`, the same verbs as the Overview tile of the
  branch): the row's `⋯` (`MountRowMenuButton`, named `<project>
· <branch> actions`), a right click on the row and ⇧F10 on it open the
  same list, so no verb is reachable only one way. The `⋯` sits in a
  `row-actions` cell (`data-worktree-actions`): empty at rest on a row that is
  not current, shown on hover, on focus inside the row and while its menu is
  open, and always drawn on the current row, so the guard against hover only
  actions has nothing to count. The cell keeps its 24px at rest so the chips
  line up. The anchors of the branch switch and of Link work open beside the
  row (`BranchRowAnchors`).
- **Folder** takes the place of Projects in a session that edits a plain
  folder in place (`SessionLevel/LevelFolder.tsx`, the folders of
  `inPlaceFoldersOf`): a card with one row per folder, its name and what
  agents do there from its face (`folderFaceLineOf`: "Documents · edits in
  place", "No git yet · edits in place"). Mounting the card loads the
  session's saved turns, so the Changes row shows its count before the page
  is opened. The Changes page itself (`SessionWorkspace/parts/ChangesPane/`)
  is described in [features/overview.md](../features/overview.md#changes); an
  older session that works in its own session folder keeps the list of file
  versions on that same page.
- **Linked** lists the session's linked work, one row per item: provider
  mark, key in one 72px mono column cut at the end (`LinkedKey`, the full
  key in the tooltip) so every title starts on one edge, title. A GitHub pull
  request a worktree row of the session already owns is not listed again
  (`githubRefOf`, same owner/repo and number). The row opens the item; its right-click menu holds
  Unlink and Move. It is a card like Projects, and its header carries the same
  `+` (`LevelAddTrigger`, named Link work), opening Link work (L). Every card
  header of the session level uses this one control, never a bordered chip.
- **Back.** ⌘[ is the top bar Back everywhere. Any move into the session
  (a row click, a page key, a link from the palette, a notification) starts a
  fresh history entry. A
  studio over the session (Tasks, Chat, Workflows, Terminal, Monitoring,
  Impact) covers the page and its rail; the places rail lights that studio's
  place.
- **The tools sit in their own column and never drill.** They are not in the
  rail: a thin icon toolbar at the right edge of the session content, between
  the page and the open drawer (see The session tools), the same on every
  page of the session.
- **The page tabs and places rail never fold.** The places rail shows New
  and the six places beside every session, without session rows
  (`app/components/ShellLeft/`). The diff page's file rail keeps its own fold.
- **A preset run keeps the rail on the session.** Opening a run with a fixed
  step list (a saved workflow or Describe steps; `executionMode` not
  `dynamic`) shows the run page in the center and leaves the rail on level 1;
  its spawned agents are in the Agents column of the run page. Esc on
  the run page goes one crumb up and lands on the Runs list, through
  history when the list is the page below.
  An orchestrated run shows its document with **Orchestrated** selected
  ([The orchestrated document](../workflows.md#the-orchestrated-document)).
- **An orchestrated run opens from Runs.** Runs stays selected while any run,
  agent or Auto conversation is in the center (the Runs page lists every
  current lens, `pageLensOf` read by `useSessionPageLens`). Esc on an orchestrated run and going up to Runs
  from a run land on the list, because a place with no run is the list.
- **Esc is one ladder in a session** (`escapeLadder`, the base escape layer of
  `SessionWorkspace`, the same steps as ⌘W below its studio). A popover or a
  confirm takes Esc first (its own layer). In a field that holds text, Esc
  leaves the field and keeps the text; while an agent runs, the composer's Esc
  arms Stop first and the page stays. An open drawer closes. A page with a back
  row does what the row does: a step goes to its run, a run or an agent to
  Runs, a list page to the Overview. The Overview has no row and Esc does
  nothing there. No page registers an Esc of its own to leave; the artifact
  run page, which has no address yet, is the one exception. A step row of the document opens the step
  on its page, under its run, for every kind of run (`presetRunFocusOf`).
- **Auto keeps the rail on the session.** An Auto row of Runs opens that
  conversation and opens no tool, and Runs stays
  selected on the rail while an Auto agent is in the center. ⌘⌥W opens Runs and
  clears its filter (`clearRunsFilter`); ⌘⌥A (`session.spawned`, Runs › Running),
  a palette row as well, opens Runs on what is running (`runs.filter` in
  `focus.returnRows`). `RunsGrid` reads that row through `useRunsFilter`, shows a
  Running chip with Clear filter, and says Nothing is running when no run is in
  the Running group. ⌘⌥L is free. Pressed below Runs (a run,
  a step, an agent or an Auto conversation) ⌘⌥W lands on the Runs list, and
  pressed on the list it stays: ⌘↑ is the key that leaves. ⌘⌥P does the same
  for Artifacts (`OBJECT_PAGE_LENSES` in `useAppShortcuts`). A studio or a
  drawer open over the list, and a generating artifact page (`focusedRunAgentId`
  in the store, cleared by the key), count as below the list, so the key lands
  on it.
- **A gone object says so.** A run, an agent, an artifact or a plan part that
  was deleted or moved shows one empty state, "This run is no longer in this
  session" (`GoneObject`), on its page or in its drawer, with Back on a page;
  a drawer waits for its collection to load before it says so. A run that is
  still in the session but whose steps did not load says "Couldn't load this
  run" with Retry and Back (`RunMetadataMissing`, an `ErrorStrip`), never that
  it is gone.

The tools (Terminal and Browser) are panes, not pages:
they open from the right rail at the right of the content (see The
session tools), never from a page header.
The linked records keep their lenses and stay in the palette.

**A session row says the name and the state, and the hover card and the board
card say the rest.** The places rail has no session
rows: the sessions live on the Board and in Sessions (⌘B, `SessionsPopover`).
A Sessions row is one line: the title and one trailing `StatusMark`, with the
ticket key of a linked task in front of it when the goal starts with `[KEY]`
(`sessionRowTitle` strips the key from the title and returns it;
`SessionRowTitle` draws it in muted mono, the title truncates and the key never
does; the switcher row and the hover card title do the same, the board card
keeps its chip). The mark says the state by meaning (`sessionMarkOf`, from
`useSessionRowFacts`): under needs you it draws the mark of the winning reason
from the one reason table (the question glyph, the approval hand, the amber
alert, the green check of an approved pull request, and the red failed glyph
only for an agent error, a stopped run, a push that failed or failing checks);
running is the ring, done the merged check, and in review, building and
archived leave the box empty. The hover card and the switcher draw the same
mark. Colour is never the only sign.

The rest is one rest away. After a 500ms rest on a Board card, or on keyboard
focus after the same delay, the hover card opens beside it: the full title,
the stage word with its reason when the reason adds a fact (under needs you, the
words of the winning reason, then each other reason that holds on its own line),
the run progress
(`Implement · 3 of 5`, counted from the steps that started, never estimated),
the pull request with its checks (the state word only for Draft, Merged or
Closed: the stage line already says In review), the linked task chips, one chip
per project, the agent count, the spend and the age. The card holds facts only:
the board card's signal opens what needs you (`attentionPlace`), and so does its
**unread reply** button (`openUnreadReply`): the latest agent with an unread
reply, never the first agent. Moving to another card swaps the hover card at
once, with no second wait. Esc, a click outside it, leaving the row and
opening another page close it, and the pointer may move onto the card. Focus
opens it only when the keyboard moved it, so a focus put back after a click or
a page change never opens it, and the board never brings back a card that was
open when it was hidden. The Sessions row, the hover card and the board card all read
`useSessionSummary`, so they say the same things in the same words. The board
card keeps one signal and hands the rest of the summary to the hover card; the
session header keeps its chips.

**The Board header holds the one session filter.** **Filter sessions**
(`StageBoard/SessionFilterPopover`, a `FilterButton`) sits in the tool row of
the Board header, with the count of filters on (`displayStateOf` owns that
count). Its popover is a labelled dialog: **Sort** on top (`DisplayValueRow`, a quiet
`Listbox`: Needs you first [default], Alphabetical, Last activity and Created),
then **Projects**, real `Checkbox` rows (`FilterCheckRow`) named with their
counts ("ledger-core, 2"), shown only when two or more projects have sessions,
then **Mark all as read**, and **Reset** while the sort or a project is off its
default. The lanes are the status and the Archived lane is the archive, so the
Board has no Status, Group or Show archived choice. The choices persist per
workspace in the browser storage (`goodboy:session-view:<workspace id>`,
version 3); nothing goes to the database. When a filter hides sessions, the
Board header reads "N hidden" with a ghost **Clear** (`HiddenByFilters`).

**`⌘⇧[` and `⌘⇧]` walk one order by state, kept in the data.** Pinned sessions come
first in pin order, then the sessions that need you (longest waiting first), running,
in review and building, each by last activity (`sessionOrderOf`, read by
`useSessionOrder`). Done and archived sessions stay out of the walk unless pinned. The
order covers the whole workspace, whatever the project filter or the Board sort,
and needs no list on screen. Pressing `⌘⇧]` four times from the first session
visits the next four.

**Pin a session and it stays at the top of Sessions.** **Pin session** and
**Unpin session** are session actions (the board card's right-click menu, `⌘K`
and every other menu of a session), shown for a live session only, one at a
time by whether it is pinned; the pin on a Sessions row toggles it too. Pinned
sessions form a **Pinned** group at the top of Sessions and of the switcher, in
the order they were pinned (oldest first). Archiving a pinned session
hides it with the archive; the pin is kept, so Restore and Undo bring it back
under Pinned. Pins are stored per workspace in the `workspace_values` table (key
`sessions.pinned`, a JSON list of `{ id, at }`), written by
compare and swap with one retry so two windows never drop each other's pin,
read when a workspace opens and when the window regains focus, and pruned of
deleted sessions on read (`store/slices/session-pins`). The pin shows in five
places: the Pinned group of Sessions, the board card's right click menu
(`Pin session` and `Unpin session`), a pin toggle in the
Overview title row, a "Pinned" fact in the session hover card, and the
switcher's Pinned section. **Move up** and **Move down** (`session.pinnedUp`,
`session.pinnedDown`) reorder a pinned session from the card menu and `⌘K`, only
while it can move; `movePin` swaps the `at` of two neighbours and goes through
the same compare and swap. Dragging is not built.

**The session page tabs carry one current sign.** `currentSignOf`
(`SessionPageTabs/currentSign.ts`) returns a page id, `session` or
`remembered`. A page with an entry (Overview, Changes, Runs, Agents,
Artifacts, and Questions while one is open) takes `bg-selected` and
`aria-current="page"`; on the Branch page the worktree row of the shown mount
(`useBranchIdentity`) takes it instead. While a studio (Tasks, Chat,
Workflows, Terminal, Impact) sits over the session the places rail lights that
studio's place. A worktree row click goes through `switchBranchMount` and
lands on the landing tab of that branch (`branchLandingTabOf`: Pull request, which is
the branch page while the branch has no pull request), never on the tab, thread or diff
focus of the branch it leaves. The Pull request entry under a branch row names the request
by its number alone (`#9998`, `MR !42`), so the label is never cut; the row above already
names the branch.

**Two keys switch sessions without opening Sessions.** `⌃Tab` opens a list of the
pinned sessions (a **Pinned** section, up to eight, in pin order) and then the
recent sessions in last-opened order, the open one first among them; a pinned
session is listed once. The first press still lands on the previous session
wherever it sits. `Tab` and `⇧Tab`
move while `⌃` is held, releasing `⌃` opens the chosen session and Esc cancels.
A quick tap flips to the previous session and never draws the list. `⌥⌘↓`
lands on the next session that needs you, in the board's Needs you order, on its
`attentionPlace`. A focused terminal and an open dialog keep both keys.

**The session overview is the reference page.** It shows the whole surface
grammar on one screen, so read it before designing a new surface. Here is its
rhythm. Each section has an eyebrow label, and a section has at most one
primary button. The goal, the notices, Needs you, Next and Activity are peer
sections in the pane body, one `PANE_RHYTHM.stack` gap apart. Space separates
sections, never a `<Divider />`, and a section never has a border. The Activity
header holds the **Activity | Log** switch, **Mark as read** while an agent has
an unread reply and the session cost on the right; the Log adds a search field
under it, and there is no description line. A section appears once its
fact exists (a plan, a workflow run, a PR on a project). Before that it is one
quiet action row (link an issue, start an agent, attach a workflow). So the
empty session reads as a young version of the same document, not a wall of
placeholders. Finished work collapses into one summary row per category. The
surface itself shows urgency, never a badge parked beside it.

**New session is a draft, not a session.** New, ⌘N (on Chat, Terminal and
inside Ask the same chord is new chat, new terminal and New question, see
[keyboard.md](../keyboard.md)), the board, the palette
and the checklist open the `New session` draft (the `session-draft` place,
address `new`). Nothing is written: no row in the database, the column or
the board. The title says `New session`, the page draws no crumbs, the
title is faint and cannot be renamed, and there is no `⋯` and no chip. The
column's New session row stays selected while the draft is open. Each workspace
keeps one draft in memory (`store/slices/sessionDraft/`), never on disk:
leaving it keeps it intact, New brings it back, and the button shows a primary
dot with `Draft in progress` while a written draft waits. The header has no
`Esc` label and no X: Esc closes the page (`closeSessionDraft`) and lands on
the place before it, or the board when there was none, which is also the
parent `up()` goes to (`placeBeforeDraft`). With nothing written Esc leaves at
once. The task field counts as written: while no session exists the draft holds
it as `workflowGoal` (`StartTaskField` writes it, and `useStartShape` and
`useStartRun` read it, and `pickIssue` fills it from Tasks). The
picked kind lives in the draft too (`startKind`, `startShape`), and a door
that opens the page on a kind writes it (`openNewSessionAs`); a picked kind
alone is not content. With text Esc
raises `Keep this draft?` under the form, inline and without a modal, in the
column (`SessionKickoff` takes it as its
`notice`). It holds one action: `Keep draft` (or a second Esc) leaves and keeps
the draft. The field text is the draft's `workflowGoal`, so leaving keeps it.
`Discard`, next to Start in the field, shows only with text and runs
`discardSessionDraft`: it clears the draft and both builder drafts of that
workspace, then closes the page. Back
returns to the draft like any other place. **Start blank** in the header (`startBlankSession`) is the way
to start from the goal: it creates a session with no title and no goal slot
and lands on its normal Overview (`Untitled session`, `Add a goal`, the start form inline), where
the goal, projects and work are added from the usual controls. Nothing is
required first, and the draft stays for the next New.

The draft asks no question first (`SessionKickoff`): **Projects** (`WhereChip`) is
optional and sits in the task field, and **Start blank** sits in the page
header. Where is a searchable multiple `Listbox` in three groups
(`projectPickerOptions`, `projectPickerGroups`): "Starred" by name, "Recent"
with at most five (the issue's matched folder first with its reason line, then
the active folder of the workspace's latest sessions, `recentProjectIdsOf`),
and "All projects" with the rest by name. `Project.lastAccessedAt` only moves
when a folder is added or reconnected, so it never orders the picker. Each row
carries a `ListboxStar`: the star or ⌘S on the active row calls
`setProjectStarred`, the row changes after the save, and a failure shows in the
list status (`useProjectStarToggle`). With nothing starred the list ends on one
hint line (`ProjectStarHint`). The draft
keeps the picks as `projectIds`; the first is the session's project and the
rest are added with it (`additionalProjectIds`).

A task comes in from Tasks: **Start** on an issue calls `pickIssue`, which puts
the issue in the draft's `pickedIssues` and fills the field with the issue goal
(`issueGoalOf`, the title when the goal is empty; the `goodboy:start-run:new`
event). Setup's issue handoff (`handOffFirstSession`) seeds the same field the
same way, so its draft can start at once. The picked issues show as rows above the
field (`PickedIssueRow`, removable). Start then runs `startSessionFromDraft`
with kind `task` and a `then` of kind `workflow-run`: the session is created
with the issues linked, and `startRoutedRun` starts the run the router picked
(a linked task reads as row 3, a plan, unless the ask names a role or a preset).
With no picked issue the kind is `workflow-run`. A failure keeps the draft, the
issues and the text, and Start becomes **Retry**.

**Start is the only way a session is born from the draft.** The primary
creates the session and starts the work in one gesture
(`startSessionFromDraft`): the title and the goal come from the issue, the
workflow goal or the first sentence of the Scout focus, a picked issue is
linked, and the column moves to the new session. The header marks that title
`Named by Goodboy` until you rename it or open the session again, and a better
title that arrives later fades in without moving the layout. If the start fails, the
session is removed again, the draft stays as it was and the reason shows
inline above the primary. A session that exists always has a real title, so
its header never has an empty state. Sessions created elsewhere with no
activity yet show the plain overview with its actions.

## Board model

- **A branch is a row by its stored mount id, in any state.** A merged branch stays a row and a removed worktree keeps its row, because the row never reads the path. Work with no known branch lands in one row, "Not on a branch", only while an agent or Lead there runs, waits for you or failed, or a question is open, or when the session has no branch at all; finished work with no branch draws no row and `branchBoardOf` hands its spend, time and counts to the facts line through `settled`.
- **Groups are Needs you, In progress, Merged and Not on a branch.** They order the rows inside each project block (`projectBlocksOf`) and draw no head of their own. Merged shows the 3 newest (`MERGED_FOLD_LIMIT`) unless it is the only group with branches.
- **Merged offers Delete local branches.** The button on the head of the first block with a merged branch (and Delete local branch on a merged row with a cleanup proposal) asks first, then runs `runAfterMergeCleanup` for each branch with `isLocalOnly` and `isRemovalRequired`: the folder and the local branch go, never the branch on origin whatever the after-merge rule says, and a folder that refuses to go leaves its mount attached. A merged branch held only by a clean worktree is not protected: the worktree goes first, then the branch, and Undo restores the branch (`restoreDeletedBranch`). A worktree with uncommitted changes keeps the branch (`Kept nw/x: its worktree has uncommitted changes. Remove the worktree first.`). Only the base branch, `main`, `master` and `develop` read as protected. The suggestions are counted once per mount (`uniqueByMount`), so a branch is counted and named once. One toast offers Undo for all of them (`deleteMergedBranches`), and a second Undo finishes one that stopped halfway. Branches that stay, refused or failed, fold into one log row ("Couldn't delete 2 local branches") through `reportErrors`, keyed by the delete, whose Retry runs only those again and replaces the row with what is still left; a branch deleted before its cleanup suggestion failed to clear stays in Undo and its Retry only clears the suggestion. The board draws no error line.
- **The stage of a row comes from that branch only.** `branchFactsFor` builds its facts and `deriveSessionStage` words them; the session's own error state and unread mark never reach a row.
- **The agent time is counted by id.** `sessionKpisOf` reads the board for the facts line of the Overview. A Lead on two branches is two rows and one Lead; the rows sum to the total.

## Crumbs

- **Every session place below a tab draws the crumbs in place of the tab strip.**
  `crumbsOf` (store, navigation) walks `parentPlace` from the open place up to the session
  and prepends the Overview, drawn as `Overview` (`NAMES.overview`). A main agent reads
  `Overview › Runs › {agent}`, a sub agent `Overview › Runs › {parent agent} › {agent}`; an agent Auto started
  that still has its role name reads `{Role} · {short task}` (`agentTaskLabelOf`: the role noun
  and the first sentence of its task through `taskTitleOf`, never the raw prompt; the head
  draws the task middle cut, the full brief one click away), a run `Overview › Runs ›
{run title}` (the run's title, else its workflow's name, else `Run`), an Auto run and every
  agent under it name the run through `autoRunTitleOf` (features/session: the first line of
  the ask, else of the run's first message, else `Lead`, never the default agent name
  `Auto`), which the run page crumb and the Agents rail root row read too, a run step adds its
  step names, an artifact `Overview › Artifacts › {artifact title}`, a branch or pull request
  `Overview › {branch name}` (one crumb with a file or a thread open), a GitHub issue, a linked
  task and a branchless Changes place `Overview › {page}`. Names come from `placeTitleOf`
  (store, navigation), the one name a place has, which the history arrows and their hold menu
  read too. A crumb is a quiet `xs` button; a click calls `upTo` with its place: a real
  navigation, so a reload or a deep link with no history below still goes there; when the
  entry below is that place it is a Back instead of a push. The last crumb is the page
  (`aria-current="page"`). Five crumbs or more fold (`crumbFoldOf`): the first and the last two
  stay, the ones between become one `…` crumb whose menu lists them (`SessionCrumbFold`), and
  a crumb between the first and the page is capped at 192px so the page crumb keeps the room.
  A tab (`isTabView`: the Overview, Runs, Artifacts, Questions,
  Context, also with a question drawer open) draws the tabs, and a drawer keeps its
  `DrawerFrame` back. `every-place-has-a-way-up.test.tsx` walks one place per lens and per
  target kind, renders `SessionWorkspace` with the head and fails when the drawn crumbs differ
  from `crumbsOf`, when a tab draws crumbs or a back button, when a detail draws no head back
  button named after its parent crumb, or when a studio trail is drawn. It also fails on a
  back arrow or chevron outside `DrawerFrame`, the head back button and the history arrows,
  with a named allowlist for the backs that are not a way up. `no-back-glyph-in-trail.test.tsx`
  keeps the glyph out of the crumbs themselves: on a secondary page the head holds exactly one,
  in the back button of the title row. The history arrows in the top bar are
  memory, not a way up: the left one reads `Back: {place}` and the right one
  `Forward: {place}` (an agent's name, a run's title, a page), with the
  session's title on a second line and `Hold to show history` on a third; a hold or a
  right click opens the History menu with the same names. A test that wants
  the arrow takes `[data-nav-arrow="back"]`.
- **The session title row holds the session's actions, once.** The page headers under the
  head carry only their page (an artifact's Details, Edit and `⋯`; a pull request's
  actions), so no page header carries a second session `⋯` (pinned by
  `scene-primaries.test.tsx`). `PaneActionsContext` stays for a page that lends its own
  action to a nested header (the issue detail's back word). ⌘L (`ask.open`, app plane) is
  bound once per visible session (`useAskOpenShortcut` in `SessionWorkspace`), not by the
  button, so two mounted pages never bind it twice.
- **The title row** reads the session title, renamed in place
  (`SessionOverviewPane/OverviewTitle`, see above) on every tab, and on its board card.
  It holds **New** (`OverviewActions`, ⌘N, a menu from the `newForm` kind of the action
  registry whose pick opens its form in the New drawer) and, on an archived session,
  Restore, then More session actions. **Archive session** is also the
  filled button of the row when every branch is merged, no agent works and no question is
  open (`ArchivePrimary`, `isArchivePrimaryOf`); otherwise Archive stays in the menu with
  the same guards. Below the head the Overview reads the state, Needs you, Now, Next, one
  block per project (`ProjectBlocks`) and Activity, the last section.

## The session tools

The right rail is one 56px column (`TOOL_RAIL_WIDTH_PX`; 44px, icons only, the
name in the tooltip, under a 1100px window, as the places rail) at the window's
right edge on every screen of a workspace, `aria-label="Tools"` (`SessionTools`,
drawn by `ShellToolRail` in
the shell's `rightRail` slot, and inside their own sheet by Tasks, Chat and
Workflows). It lives in the drawer container, never in the page container, and
every panel opens inward of it (see home-and-drawer.md, The rail is the anchor).
Those three pages fade their content in and out while the rail
stays still (`StudioFrame` animates its `data-studio-motion` nodes, never the
rail); a record panel open with the page fades in with it, and one
opened later keeps the drawer's own motion. Moving between the shell rail and
a page's rail keeps keyboard focus on the same tool (`railFocusMemo`). With a
record panel shown as an overlay the rail stays where it is, as it does on the
shell. It holds Terminal, Browser, Scripts, Ask
and Monitor (`RAIL_TOOLS`), with no heading above them. Each names itself under
its icon, and the toolbar is named Tools for the reader. All five stay visible
on every workspace page; Scripts and Ask are disabled without a session.
`toggleRailTool` toggles each panel to the rail's left. Explore, Agents and
Context open from their pages and keyboard shortcuts. A test
scene or frame without the shell rail keeps the column inside `SessionFrame`
(`ShellRailContext`).
Each tool keeps its pane id and optional shortcut in `RAIL_TOOLS`.
`SessionToolButton` names every tool below its icon in the
9px `text-rail` caption role: secondary (`TEXT_ROLE.secondary`) when closed,
label strength when open, so every caption keeps its contrast in light mode.
Each tool is one grid cell, icon row over label row on one centre column, and
the open tool is a quiet filled tile (`bg-selected`, no border). On a window under 480px tall all captions hide together and the tooltips
stay. Every icon's tooltip gives its name, shortcut and any signal reason. Ask uses its own question glyph, distinct from Chat.

A tool has four states (`toolStateOf`): at rest, pressed when it holds the
slot, waiting when it is the tool in the slot's back chip, and current when its
page is open (Terminal, Browser and Monitoring: selected,
`aria-current="page"`, and a click does nothing). Waiting draws a
small ring on the icon (`ToolWaitingRing`) and says so in the accessible name,
`Terminal, waiting`. Rail clicks go through `toggleRailTool`.
Terminal names the running terminals (`Terminal, 2 running`), Browser names
its tabs (`Browser, 3 tabs`); the words come from `toolFactOf` over
`runningTerminalCount` and `selectBrowserTabCount`. These counts stay in the
tooltip. Monitor shows ports in use as a
`CountBadge` (`toolCountOf`, `ToolCountMark`), warning when a pinned port is down.
With no port in use, a down pin still shows a warning `StatusDot` in that
corner (`tool-warning`), since a zero `CountBadge` draws nothing. Its count and
fact come from `monitoringSignalOf`, which reads the same `monitoringSignal`
as the left door. The signal dot and waiting ring anchor to the 16px glyph
(`tool-glyph`, `TOOL_CORNER_SLOT`), at its top end and top start corners. The
port count sits on the icon button's corner and never covers the label below.

Terminal, Browser and Monitor open from the rail on every page. Inside a
session, Terminal and Browser belong to that session; Monitor always shows the
workspace. Monitor opens
`MonitoringDrawer` with `sessionId: null` through `toggleRailTool`; its header
has Open full page, and `UNSAVED_DRAWER_KINDS` keeps it out of the saved window
layout. Terminal and Browser open with
`toggleTerminalDock` and `toggleBrowserDock` from the rail, the palette, the Go
menu, ⌃`and ⌘⌥T. On a session page the dock opens on the session's terminal
or tabs; anywhere else on the workspace's (the workspace folder terminal, or
the session the Browser page would pick, with an empty state when there is
none). The drawer request may carry`sessionId: null`. Open full page in the dock
header grows it into its page (`openTerminalOnPage`, `promoteBrowserTab`, a
push); while that page is open the dock stays in the store but is not mounted,
so Back brings it again on the same tab, and Dock on the page header moves it
back (`dockTerminalPage`, `demoteBrowserTab`).
The rail rings a tool from the same `selectSlotBack` the drawer head's back chip
reads, so the two never disagree: a reader or form in the chip rings nothing,
and a tool that is pressed never rings. The signal dot keeps its meaning and
sits with any state, on the other corner of the icon.

The column is a vertical toolbar with one tab stop. Up, Down, Home and End
move it (`toolbarIndexAfter`). Its signal dots keep their reason in the
button's accessible name: updating, failed, changed, or a finished script or
terminal command. An overlay drawer leaves live tools at its right edge
through `DrawerEdgeContext`. The page under it stays live: no veil, never inert.
`drawerLayoutOf` decides push or overlay from the content width excluding
both rails ([styling.md](../styling.md)).
Folding the rail leaves the column in place.

- **There is no Agents panel.** Runs is the one list of work: ⌘⌥A
  (`session.spawned`) and its palette row open Runs on what is running, and a
  window saved with the old `spawned` panel opens Runs filtered to Running
  (`withoutRemovedPages`). A row never opens a tool as a side effect: an Auto
  row of Runs opens the Auto page and nothing beside it. The
  Overview's run row opens that exact run page,
  including an orchestrated run, and Back returns to the Overview. Its step
  rows and status sentence are status, not parallel links to the Runs list.
- **An agent opens in the center.** Every door to an agent (the Overview, a
  delegation line, a run step, Who asked, a notification, the palette) lands
  on its page (`AgentDetailPane`, with the Auto notice for an Auto child; a
  preset run step reads as its run step page through `presetRunFocusOf`): no
  agent opens in a side panel, and a window saved with the old `auto-child` or
  `run-step` drawer opens the page (`withoutRemovedPages`).
- **A saved level 2 lands on its page.** A window saved on a run or on the
  Auto level before the panel opens on the same page and opens no panel
  (`withoutRemovedPages` drops the retired `sidebar-level` key); a tool it had
  open stays open. The panel is per window: the drawer belongs to the window's store.

- **Outside a session all five tools stay visible.** Terminal, Browser and
  Monitor work on workspace pages. Scripts and Ask are disabled and say
  "open a session first" (`ToolRailFrame`, `toolFactOf`). The **Chat** door
  (with New chat) is the workspace conversation that answers what Ask answers
  for one session. Explore and Context read one session, and ⌘L is bound only
  while a session is visible.

- **One workspace dock and one detail can stay open together.** `panelsOf`
  pairs Terminal, Browser or Monitor with a detail panel (`isWorkspaceTool`,
  `isPairedSlot`). `toggleRailTool` closes the selected panel when clicked
  again, and choosing another panel in the same slot replaces it. Esc closes
  through `DrawerFrame`.
- **Scripts and Ask are dock tools.** Their rail buttons name the
  session (`toggleRailTool`); `DrawerHost` renders `ScriptsPanel` and `AskPane` in a
  `DrawerFrame` cell of the dock grid like Terminal, Browser and Monitor. The Scripts chord,
  palette's Open Scripts, toasts and stored notifications (`open-lens`
  scripts) still open Terminal through `openToolPane`. Explore is **All files**
  on Changes, and Context is its tab.
- **Browser opens a page beside the work** (drawer kind `browser`,
  `features/browser/`): the session's tabs and the project pins in a reader
  tier pane, so the session rail folds to icons while it is open.
  [browser.md](../browser.md#the-pane) owns its address row, its tabs and the
  rules for the native view.
- **Terminal holds the scripts.** The folder pill ends with "All terminals"
  (the Terminal page). A Scripts menu ends the tab row (`TerminalScriptsMenu`):
  a pick opens a new tab in the pill's folder and types the command
  (`scriptCommandOf`). The panel loads on first open (`LazyTerminalDrawer`). A
  worktree that goes away under an open terminal shows "This worktree was
  removed" instead of closing silently. The Scripts chord still opens the old
  drawer until it is removed.
- **Terminal signals on its button.** The Terminal button shows a dot when a command that ran more than
  ten seconds ended while the drawer was closed (`useTerminalFinishSignal`, a
  3 second poll of `terminal_list_live` kept to the latest answer, state in
  `terminalFinishes`, cleared when the drawer opens). It says "finished", never
  "failed": the dot does not read the exit status the Terminal page shows. A script that ends while its session
  is not on screen raises one toast, `<script> failed in <project>` (or
  `finished`), with `Open output`, from `ScriptEndToastBridge` over the
  `goodboy:script-ended` event; a script you stopped, and a run that ended while
  the app was closed, raise nothing.
- **Stored pages map to panes.** `withoutRemovedPages` sends a stored
  `explore` or `scripts` page to the Overview with that pane open, and drops
  a stored `terminal` page.
- **Terminal picks its folder by itself.** ⌘⌥T and the toggle run
  `toggleSessionTerminal`: one worktree, that worktree; two or more, the one
  this session last opened a terminal on (`terminalScopes`, set by
  `openSessionTerminal`), else the active mount; a session without a branch,
  its session folder (`scratch_dir_prepare`, dropped when the user left the
  session before it answered). The remembered scope lives in memory and is
  evicted with the session.
- **The terminal pane header** shows the terminal icon, then the scope
  picker in the title's place (`TerminalScopePicker`, a combobox named
  `Terminal folder`, passed as `DrawerFrame`'s `titleContent`; the region keeps
  the name `Terminal`): the branch in mono only, never the worktree folder
  hash. The menu names each place `project · branch`. It lists this
  session's worktrees (an info dot when a shell there runs a process), the
  main checkout, the workspace folder and, in a session without a branch,
  the session folder. Picking one opens or reuses a shell there
  (`openSessionTerminal`, a workspace-owned tab for the workspace folder);
  each scope keeps its own tabs, nothing is killed. Then **Open on Terminal
  page** and Close.
- **Studios use the same `Trail`.** The `StudioFrame` band renders the studio
  name through the `Trail` primitive from `@goodboy/ui`. A studio body that
  goes deeper claims the band with `StudioTrail` (the workflow editor shows
  `Workflows > Ship a fix` with its save state and actions). A session page has
  no studio trail, only its own crumbs in the session head. In a split studio (Chat, Guide, What's new, Tasks, Notifications) the band
  is the first child of the detail beside the page rail, not a bar across the rail, so
  the crumb, the title and the body share one x ([frame map](../styling.md#the-frame-map)).
- **The parent crumb is Up, and the last crumb names the kind.** A studio
  trail only: no crumb carries a back glyph and `Trail` has no lead slot.
  `no-back-glyph-in-trail.test.tsx` fails on a chevron or arrow to the left
  inside a trail.
- **Every crumb has an icon, and depth compacts the trail.** The last crumb and
  its parent always stay full. The first crumb (the studio in a band)
  keeps its name through five crumbs. From five every other
  ancestor but the parent becomes an icon, and from six the first crumb does too.
  When the band still has no room, ancestors turn
  to icons from the left, then the icons after the first crumb fold into a `…`
  menu right after it; the first crumb is the anchor and never folds. An icon crumb keeps
  its name as tooltip and accessible name. `compactTrail` in `@goodboy/ui` is
  the pure rule; the label closes with a 220ms width transition (120ms fade),
  and a new crumb enters from the right 60ms later. Under reduced motion only
  the opacity changes.
- **A crumb carries no status dot.** Navigation is structure,
  movement rather than state. An agent's state is drawn once in the row node and once in the chip of
  the agent header, and the chip's tooltip (`stateDescription`) is the one place
  that explains the state words. Elapsed time shows only in the header. The Brief's
  Now band keeps the label and the "much longer" note.
- **A resolver title names the flow verb, not the kind.** `Resolve: index.ts
comment` for the maintainer's own comment, `Resolve: Mara Quint on index.ts`
  for another reviewer, `Resolve: 3 review comments` for a group. Rows saved with
  the lowercase `resolve: ` prefix are shown without it (`agentDisplayName` in
  `shared/utils`), so old and new rows read the same.
- **An integration page hangs off its own tool.** Its crumb uses the name
  the sidebar uses (GitHub, GitLab, Jira, Linear, Slack). A studio belongs under its own tool, never under another tool's lens.
- **Opening a child adds its parent to the crumbs**: a sub agent reads
  `Overview › Runs › {parent agent} › {agent}`. Selecting a sibling changes only the child
  region.
- **The crumbs show the structure of the app, not the history of the
  session.** A parent comes from the object that is open, never from the
  surface the jump came from. Selecting an agent leaves the active lens where it
  was, so that lens only ever records where the user came from. The activity
  feed, the palette, a notification, a linked-work chip and a restored session
  are shortcuts into a place that already has a parent. None of them may
  rewrite it. History is what Back is for.
- **The Branch is one page with its sections in the address.** A branch is shaped
  like a pull request: a split page, a rail of sections on the left and one centred
  column on the right, whose header (title and state chip, `project · head ▾ → base
· #318 by nadia-p · 7 commits`, where `project · head ▾` is the branch switcher,
  one primary by state, `⋯` for the rare pull request lifecycle; the primary and
  `⋯` are both 28px, `⋯` last, and a blocked primary's reason, such as `1 check
still running.` on Merge, reads in the meta line as well as in the tooltip) sits
  over the section body
  (`s/{session}/branch/{tab}[:{mount}][/t/{thread}]`). A section switch and a
  thread selection replace the entry, so Back never walks them; Esc is the way
  back to the section. The crumbs of a section, a thread or a file read the same
  `Overview › {branch name}` from every door; Esc on a thread or a file first goes
  to its section, then to the Overview. The branch switcher is `project · head ▾` in the
  header. `layers.ts` is
  gone. The requests `pr`, `review` and `files` (a mount present) are
  rewritten to the Branch address by `canonicalLocation`, so the palette, the
  shortcuts, a notification, a chip, a search hit and an Activity row all land
  on the same address; a saved place is rewritten the same way when it is
  restored. A GitLab or Bitbucket merge request keeps the `pr` page (the old
  studio stays reachable from its strip until the host cleanup), a session
  without a branch keeps its file versions (page id `files`, a detail under the crumbs).
- **A child hangs off the overview section that owns it**: a step under its
  run under Workflows, an ad-hoc agent under Agents, a resolver under its
  comment on the Branch (`s/{session}/review/t/{thread}/agent`). Back returns where
  you were, while the crumbs name the parents.
- **Segment menus.** The session crumbs carry none: each is one link. `CrumbMenu` stays in the `Trail` primitive (`@goodboy/ui`) and comes
  back per segment where a switch is missed, under one rule: its menu lists
  the siblings of what that segment names, plus at most two actions that belong
  to that thing. A segment whose menu would hold fewer than two entries, rows plus
  actions, is a plain crumb with no chevron. The page segment (depth one, or `Session` when it is alone)
  lists the session's pages with a count that names what it counts,
  grouped as pages, Tools and Linked. One pure table, `pageCountWordOf`
  (`features/session/pageCountWord.ts`), reads noun last and empty at zero:
  Branch `3 branches` with more than one mount and no diff, else `5 need you`, else the branch name of
  the one mount with its `+x -y` diff beside it on the open session's row only (a review note is not
  a branch fact and is not counted here), Runs
  `2 running` in the info tone (else `4 runs`, every kept run), Agents `1 running` (else `3 agents`), Artifacts
  `4 artifacts`, Questions `2 open`. The page tabs and the menu read it
  through `pageSlotOf` (`features/session/pageSlot.ts`); `Session`
  has no menu once it has children. A run lists the session's runs (Running,
  Finished, a chained run indented under its own with `after ...`); a step
  lists every step of its run in order, the ones not started switched off; an
  agent lists the agents of the same home grouped Needs you, Running, Done,
  newest first; an artifact lists the session's artifacts by kind. Actions
  exist only where a real action backs them: `Start a run`
  and `New artifact` (opens the kind picker) on their pages, `Stop this step`
  while a step runs and `Retry step` when it failed or is blocked
  (`recoverStuckStep`), `Show saved copy` and `Copy folder path` on the open
  artifact. An attempt offers `Resolve again` once no attempt on that comment
  is queued or running: it starts a new attempt with the Branch page's default
  instruction, through the same `useResolveAgain` hook the Comments tab uses.
- **A branch reads one state word**, the first
  that applies of `Rebase stopped` (or `Rebasing on main` while the rewriter
  works), `Merged`, `Gone on origin`, `Local only`, `Diverged from origin`,
  `Behind main by N` and `On origin` (`branchPriorityOf`). `Local only` and `Diverged from origin` read the branch's own
  remote copy (`branchPushStateOf`), never the base it was cut from. The Branch
  header reads the same word, so a stopped rebase never reads `On origin`
  next to Open in Terminal and Abort rebase. A
  branch whose pull request merged reads `Merged` even with no git ancestry
  (a squash merge), in the branch lists and in the Branch header alike
  (`isMountRequestMerged`). Changes opened without naming a branch lands on the active mount's Branch page Changes tab.
- **Files can reveal unchanged context.** Each hidden range offers the next 20
  lines beside either hunk, or all of its lines. Small ranges use one action.
  The file's final range stays uncounted until its sides load. Expansion stays
  with the file while scrolling and resets on a diff refresh. A failed read
  keeps the existing lines and offers Retry; oversized files offer the editor.
  The per-file expand-all registration in
  `features/diff/components/DiffView` lets file actions reveal the whole file.
- **A double click on a name in a diff line shows where it is defined and used.**
  Alt click does the same. The anchored popover shows project constants,
  functions, methods and types; a word without a project definition reads
  "Not defined in this project" and lists no uses. It shows the symbol kind and
  definition, use and change counts. Defined in comes first, then Changed on
  this branch with changed lines first and tagged, then Unchanged files with
  five references and Show more. A file appears under one group only: the
  file that holds the definition lists all its uses under Defined in, so
  Changed on this branch holds the other changed files. A long directory drops
  its leading segments behind a `…/` and keeps the segments next to the file
  whole, dimmed and joined to the filename with no gap; the file name is never
  truncated, the directory shrinks first, and the full path is the row's
  title. It says when it shows only the first 300. This contract lives in `features/diff/components/IdentifierPeek`.
  Every result opens the right drawer (`identifier-peek`, in
  `features/diff/components/IdentifierPeekDrawer`) and never moves the page: its
  scroll and selection stay. The drawer lists the same files in the same three
  groups, one row per file with one row selected; a definition file the branch
  changed carries a Changed tag. The list scrolls and shows five to six rows. A
  file changed on this branch shows its whole-file diff scrolled to the match;
  an unchanged file shows its source around the match under its full path and a
  one-line note, with an info icon, that it has no changes here. Choosing another file swaps the view and keeps
  the drawer open. A failed search or diff load has a Retry in the drawer. The
  drawer is keyed by worktree and word, so a late answer for an old word is
  dropped. The commit view has no peek, because its lines are not the working
  tree's.
- **A fix run has no page of its own.** Its transcript is a drawer on the
  Comments tab, so the Branch page behind it keeps its crumbs.
- **Settings claims its studio band** with Back to app, then Settings, the
  scope and the App section, beside the column and on Home alike. The scope
  segment lists App, the workspace, Providers and
  Integrations; the section segment lists the App sections. Neither carries an
  action: Settings has no project scope, so there is no `Use workspace values`
  to offer. A segment without an action is plain text and has no hover state.
  The first segment of a studio has no menu because studios change from the
  column. It is a button only when that studio has a start to return to.
- **Every menu row has five slots**: lead, label with a faint second part,
  meta, a state that is always a word (the same reading the Runs list
  makes in `sessionRunsOf`), and a check on the current row, which is there even
  when it is the only row. The last segment opens its menu from the whole
  segment and always shows the chevron; an ancestor goes up by its name and
  opens its menu from a chevron that is always visible, faint, and doubles as
  the separator: every segment but the last ends with the same chevron slot,
  whether it has a menu or not, so the gaps are equal. Name and chevron light
  up as one chip on hover. Page icons take the tone of their concept
  (linked tools keep their brand color). Widths are 300 (pages, scopes, sections), 380
  (runs, steps, agents, artifacts, conversations, attempts) and 460 (branches);
  a filter appears from nine rows up. An action that breaks something (Stop
  this step) confirms inside the menu's action band with `InlineConfirm`;
  Escape cancels the confirm first, then closes. Shortcuts live in the segment
  tooltip and the palette, never in the rows.
- **The workflow case extends the same control**:
  `Session > Runs > {Run} > {Step}`. A delegated child names its root and
  parent agents between the run and itself, and an open question it answers
  adds one last crumb. There is no separate step strip and no "Part of
  {Workflow}" line.

## The Scripts pane

a `Filter scripts` field from nine rows on, that `/` focuses, and an icon `New script`) over one list
a `Filter scripts` field that `/` focuses and `New script`) over one list
grouped by mount, project plus branch, from `useSessionScripts`. A project
mounted twice is two groups, and its saved scripts show in both; you pick
where a script runs by picking the row in the right group. A group header
collapses it, and the collapsed set is kept per workspace
(`goodboy:scripts-groups-collapsed:v1:<workspaceId>`).

Inside a group, three levels: project (the group header above), then Saved
(when at least one script is saved for that project) or a package, then the
row. When a group holds more than one manifest package (a pnpm, yarn or npm
workspace, or package.json next to composer.json), Saved gets its own titled
`ScriptSavedSection` (eyebrow `Saved N`), sitting above one `ScriptPackageSection`
per package: a `Package` glyph, the name from its manifest, the folder in mono
(root has none), the script count and, when something is running in it, an
info-toned `N running` badge. The root package comes first, then workspace
packages by folder, then composer; the filter matches the package name,
folder and a script's body too. Each package section has its own chevron:
beyond six packages the sections default closed, except the root, one with a
script running or run today, and any section a live filter matches (a filter
always forces its matches open, regardless of the stored state). The closed
or open state a person picks is kept per workspace and per package
(`goodboy:scripts-packages-collapsed:v1:<workspaceId>`). With a single
manifest package, rows stay flat under the project header, as before.

Every row is the same `ScriptRow`: category node, name (its tooltip names the
invocation, e.g. `Runs yarn workspace @northwind/web run dev`), the script's
**body** (`vite --port 3000`, not `yarn run dev`: the invocation is what
made every `dev` row look the same), Source (hidden inside a Saved or package
section, since the header already says it; shown as `Saved`/`package.json`/
`composer.json` only for a flat, single-package list), Last run in glyph and
word and one right edge of actions: Pin, Run and a horizontal `…` menu
(saved: Edit, Duplicate, Delete with an inline confirm; manifest: Save as
script, Copy command, both using the invocation). Pin, Run and the menu are
visible at rest, and Stop stays visible while the script runs. The group header's
one ghost refresh sits on the same edge. "Save as script" from a workspace package writes a command
that still runs in that package once saved at the project root
(`workspaceInvocation`: `yarn workspace <pkg> run <name>`, `pnpm --filter
<pkg> run <name>`, `npm run <name> --workspace <dir>`, `bun run --filter <pkg>
<name>`, `composer run-script <name> -d <dir>`), because a saved script always
runs from the worktree root. Clicking a row opens its output in the
`scriptRun` drawer, and the row whose output is open is selected. New script
and Edit open the same inline `ScriptEditor` card, at the top of the active
mount's group or in place of the edited row. Saved scripts of workspace
projects that are not in the session are named in one line under the groups.
The session has no scripts section: `$` launches, the Now chip
watches.

A pin belongs to the project, not
the worktree: its id is the source, the folder and the name
(`scriptPinId`, a saved script by its id), stored as a JSON list in the app
setting `scripts.pinned.<projectId>` (`toggleScriptPin`, loaded by
`loadScriptPins` through `useScriptPins`). A project with no pinned or saved
script reads `No scripts in <project>` with an inline `Pin a script` that opens
the project's manifest scripts in the group (`ScriptPinPicker`, pinning one adds
its row) and `New script`; it never sends you to Settings. A pinned script
shows once: in the `Pinned` strip at the top of the lens only when the session
has more than one project (one click runs one in its group's worktree), and
only in the rows otherwise. The palette lists pinned scripts under `$` with the
project name (`scriptPinEntries`, run through `runPinnedScript`; saved scripts show
their project name too). On the workspace Projects page the open editor card
of a project ends with a `Scripts` field (`ProjectScriptsField`, label
`Scripts · N pinned`): it reads the project folder when the card opens
(`loadProjectRootScripts`, kept in memory by root path), says `On <base>` and
where a pin shows, and lists the scripts with the same pin; a package label
shows only with several packages, a project with no package.json or
composer.json says so, and a failed scan is an inline `Notice` with `Retry`.
The row itself stays 32px and carries no scripts control.
