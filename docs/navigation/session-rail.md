# The session rail and its tools

> **Read this when** you change the rail of a session, its breadcrumbs, the tools beside the page or the Scripts pane. **Not for** spacing, scroll and overlay mechanics ([styling.md](../styling.md)) or design intent and tone ([DESIGN.md](../../DESIGN.md)). The other pages are listed in [navigation.md](../navigation.md).

## Session rail

**The column never changes level; the session rail does.** The column always
shows the workspace: New session, the doors, then the Pinned and Sessions
lists. Clicking a session row selects that row, opens the session on its
Overview and shows its session rail at the left of the page, inside the
content sheet. The rail holds the levels that drill: level 1 is the session (its Projects tree holds every branch, with no level for a worktree),
and only the folded rail drills into a worktree's pages. A preset run and Auto
never drill the rail: what they spawned lives in the Agents panel of the
session tools (see The session tools). A drill and its back cross the
rail's levels in one move: a frozen copy of the leaving level slides 24px
toward the back and fades in 120ms while the new level slides in 24px from the
drill side over 200ms (`LevelStack`, `useLevelSwap`; the folded icons drill the
same way; instant under reduced motion); the column never moves. The host is `SessionRail` (`app/components/SessionRail`),
mounted once for the open session by `SessionFrame` beside the kept-alive
session pages, its level read by `useSessionRailLevel`. Every level stays
mounted, so the session level keeps its scroll and its selection while a
deeper level shows, and the hidden ones are `inert`. The rail is 240px by
default and resizes from 200 to 400 (`goodboy:session-rail-width:v1`); its
rows are the column's rows (28px, `SelectableRow`, the same type roles).

- **Level 1 reads top to bottom:** the pages, then the Projects card and the
  Linked card, then the foot. The session level has no identity row: the
  selected main sidebar row is the session's identity (its title and state
  node). The Overview h1 is the session title, the linked key in gray mono
  before it (`SessionOverviewPane/OverviewTitle`); a single click, or Enter or
  F2 on the focused title, renames it in place with the same rename as the
  sidebar row (an archived session's title stays read only), and "Overview" is only the
  rail entry's label. The rail's top row holds the rail
  toggle at the left and three buttons at the right
  (`SessionLevel/SessionLevelActions`): **Pin session**, a toggle that shows
  pressed while on and runs its registry action (`session.pin` / `unpin`; a
  failure keeps the old state and shows under the row with Retry,
  `ActionStatusLine`),
  **Refresh session** (⌘⇧R, `useSessionRefresh`, the same call as the key and
  the palette) and **More session actions** (`⋯`, `ObjectOverflowMenu` over
  the `session` registry kind), which holds **Spend and limit**
  (`session.spend`), **Archive** and **Delete** with the rest of the session's
  verbs. Autopilot has no rail control: Turn on Autopilot and Turn off
  Autopilot (`session.autopilotOn` / `Off`) stay in the sidebar row's right
  click menu and the palette. An archived session shows only the `⋯`, with
  **Restore** and **Delete**. The rail has no foot: **Spend and limit** and
  **Raise limit** on a paused run open the session spend popover from the edit
  host in `SessionFrame` (`SessionCostChip` with `placement="editHost"`,
  `requestSessionSpendLimitEdit`, `sessionSpendLines`). **Spend and limit** on
  another session, from its sidebar row or the workspace board, opens that
  session and holds the request by its id until its edit host mounts and takes
  it once (`openSessionSpendLimitEdit`, `pendingSpendEdit`); going anywhere else
  first drops it, so it never opens on another session. An agent page's
  **Limit** chip edits the same session limit. Archive asks first: the registry
  verb carries a confirm (`archiveConfirmOf`, "Archive session?", saying how
  many agents are still running in the session when any run, from
  `runningAgentCountOf`, and that they keep running after the archive), so the `⋯`, the sidebar row's right click menu, the
  palette and ⌘⇧A (`SessionArchiveBridge` triggers the same verb and anchors
  its confirm at the window corner) all ask the same way, and Undo on the toast
  still restores it; the `⋯` anchors the confirm to itself (`ArmedActionPopover`
  over the rail's `useActionControls`, so a failure shows under the top row with
  Retry). Restore never asks. Delete asks with the registry's delete confirm
  ("Delete session?"). Rename has no rail
  control: a rename
  request (`session-header`, from the palette, the sidebar row's right click
  menu or the shortcut) edits the Overview title in place while that session's
  Overview is open, else the main sidebar row. Both edit in one primitive,
  `shared/components/TitleField`: on the Overview it spans the title row up to
  the header actions in the h1 type role with a quiet underline, the linked key
  stays outside the field and is written back before the name, and a click puts
  the caret where you clicked (Enter, F2 and a rename request select the name),
  so the text does not move; on the sidebar row it is the compact density, the
  row's state node and key before it. At the far right of the field a
  `LimitRing` fills toward the 120 character limit (`SESSION_TITLE_MAX_LENGTH`
  in `@goodboy/types`, the one number the store clamp, the field, the goal card
  and the issue brief prompt read), with no number, its label `84 of 120
characters`, in the warning tone from 90%. A longer draft is blocked before
  any write (`useInlineRename`). Enter saves, Escape cancels and focus goes back
  to the title. A rename writes the database first and changes the title only once the
  write lands (`renameTask`); the field shows pending while it writes, and a
  failed write keeps the old title and shows the error with Retry beside the field,
  which stays open; a name it refuses (empty, too long) shows the reason with no
  Retry (`useInlineRename` `canRetry`). Every one of these verbs is also in the sidebar row's right
  click menu and the palette. A title Goodboy wrote reads "Named by Goodboy" on
  the session hover card. It has no back row: the column beside it is the way
  to another place. Only one level shows, so a session never carries a nested
  card in the workspace list.
- **The pages** come from one registry (`features/session/pageRegistry.ts`):
  Overview, Changes (with the count of changed files) in a branchless session only, Runs,
  Artifacts, and Questions last, always there like Artifacts: its slot
  is the open count with the warning dot while a question waits on you.
  **Runs is the one entry for work** (ux27 one flow, unit 1): it folds the
  former Orchestrated, Agents and Auto agents entries. Its page lists every
  run of the session, one row per request, from `sessionRunsOf`
  (`features/session/sessionRunsOf.ts`): workflow runs (preset and
  orchestrated), Auto conversations and the agents you started by hand, newest
  first, In progress above Finished, archived runs folded. A row draws its
  state dot, a shape glyph (Workflow or Agent), the title, where it came from
  ("Workflow · Preset Fix a layout", "Workflow · Orchestrated", "Agent · Auto
  agent", "Agent · Scout"), its state word, progress, cost and
  age (`RunsGrid`). Opening a row opens the page it always had: a workflow run
  on its run page, an Auto conversation in the Auto chat, an agent in its
  overlay; an agent or Auto row keeps its right click menu. The old
  `orchestrated`, `agents` and `auto` lenses fold into `workflows`
  (`foldedLensOf`, applied by `sessionPlace`, `canonicalLocation`,
  `applyLocation` and the workspace), so an old address, a saved window or a
  door that still names them lands on Runs, and the trail of an old agent or
  run reads Session, Runs, then the agent or run. A row never carries a native
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
  one function, `pageSlotOf` over `usePageCountFacts`, and the folded rail and
  its flyout read the same function; the Runs count is `sessionRunCountsOf`
  over the same `sessionRunsOf` rows the page lists, and a test pins it to the
  Now card (`sessionRunsOf.test.ts`); the Artifacts count is
  `liveArtifactCountOf`, pinned equal to the page's All tab.
- **Projects and Linked are cards** (`SessionLevel/LevelCard`): a rounded
  `bg-subtle` surface (`rounded-lg`) whose edges sit on the page row
  highlight edges: pages and cards share one column inset
  (`SessionLevel/railInset`, `RAIL_INSET`). The card pads its sides 8px and
  its top and bottom 4px (`CARD_INSET`, one constant read by `LevelCard`, so
  Projects, Linked and any later level card cannot drift) and a card row adds
  4px (`CARD_ROW_INSET`), so text, chevrons, dots and counts sit 12px in and
  a hover fill keeps 8px of card around it. Every right
  slot (counts, diff stat, the worst state dot, the `+` glyph) ends on the
  card's inner line. Every `+` of a level card, header or project row, is
  `LevelAddTrigger` in its own 24px `xs` box, with no size override from the
  card, so all of them share one right edge. It has a header row inside it: the
  title and a fold chevron as one button, then the quiet meta and a `+` icon
  button (`LevelAddTrigger`) at the right. A card folds from its header and
  remembers it (`useLevelCardFold`, `goodboy:session-rail-folded-cards:v1`);
  folded, Projects keeps the worst state of its worktrees as one dot in the
  header (`useProjectsSignal`) and Linked its item count from 2, so a state
  that needs you never hides in a fold. Cards sit 8px apart, 16px under the
  pages.
- **Projects is one tree**, holding every branch of the session, so there is no
  second sidebar to go back from. A folder row (`SessionLevel/ProjectTree`) is
  its name and its `+`; the name toggles the folder and a chevron shows only
  while it is folded. Its accessible name keeps the count and the host ("payments-api, 3
  branches, on GitHub"), never as visible text. A folder's branches sit one
  28px line each (`SessionLevel/WorktreeRow`, `BranchRowLine`): the pull
  request state glyph in its color (`pullRequestStateToneOf`, next to
  `pullRequestStateWordOf`, whose words are the labels of
  `PULL_REQUEST_PRESENTATION` so an open pull request reads Open everywhere;
  draft gray, open blue, approved green, in the merge queue the primary teal,
  merged violet, closed gray, no pull request a neutral branch glyph, the
  state table in packages/ui/design/rail-and-work.md), the title,
  and at most one chip. One function, `features/branch/branchRowFactsOf`,
  holds a row's title (the pull request title, else the branch name, drawn in
  mono), state word, number, host key, finished flag, order rank (queued,
  approved, open, draft, none, merged, closed), check counts and the one
  signal worst first: `n failing`, then `Conflict`, then `n behind` (`BranchRowChip`,
  `branchRowChipOf`); approved, queued, open, draft and running checks draw no
  chip, the glyph color carries them. The check counts come from the runs read
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
  when you are busy. Folded, the
  rail draws one pull request state icon per worktree under the page icons
  (`RailWorktrees`), its tooltip "project, branch, state word, worst state" and the worst
  state dot on its corner (`useWorktreeRowState`); the
  folded rail never draws the session node, and a worktree icon there drills
  the folded rail into the worktree's page icons (`RailWorktreeLevel`), since
  the folded rail has no tree. **Rebase all**
  (`features/history/RebaseAllCard`) is the first line of the card: `n branches behind`
  with a Rebase all button, then, while a batch runs, `Rebasing 2 of 9` with
  Abort in the same 28px line and the same button size, and Dismiss once it
  ended. It draws no list of branches: each branch's state lives on its row
  from the one source, the batch in the store (`rebaseAllRuns`,
  `rebaseAllBranchOf`), also read by that header line (`rebaseAllSummaryOf`):
  a breathing `Rebasing` chip (`soft-pulse`, still under reduced motion) with
  the replay step in the tooltip, a quiet `Queued` on the ones waiting, no chip once a
  branch is rebased even while its behind count is stale, a danger `Conflict`
  (tooltip "Waiting for Auto") on a branch Auto has not started, a breathing
  `Auto resolving` with the Auto icon on the branch whose rebase is stopped in
  its worktree (tooltip "Auto resolves 1 file: <path>", from the stop files of
  its history run), `Rebased by Auto` once an Auto branch is clean again until
  every Auto branch of the batch is clean (`rebaseAllBatchSettledOf`), then no
  chip, `Failed` with the cause in the row tooltip. A `Conflict` or `Failed`
  branch turns `rebased` once git shows the rebase finished outside the flow
  (`settleStaleRebases`, after the turn ends, on focus and on the poll of
  `useRebaseStatuses`, mounted by `LevelProjects` and the central model; a pass that settles nothing writes nothing, and the list of settled stop ids keeps only events the session still holds). When Auto has the rest the
  header line reads `Auto has the rest`, still with no list. One function
  (`branchRowChipOf`) owns every chip text and tone. A late
  answer for a batch that is gone is dropped by run id; Abort lets the branch in
  flight finish and skips the queued ones. The card header carries one `+`
  (`LevelAddTrigger`, a ghost `xs` icon button named Add folder: no border,
  no fill at rest, so the rail stays light) that opens the project picker
  straight away (`MountProjectAction`, no menu first): the workspace projects
  not yet in the session, then `Connect a repo or folder`, which picks a folder,
  links it to the workspace (`useConnectProject`, `addProject`) and lands on its
  preflight to add it here. A folder of repositories, a project of another
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
  status line, only while a git act is due (`BranchStatusLine`: `6 behind main
· 1 conflict` with `Rebase`, or `Rebasing on main` with `Abort`, the one home
  of Rebase; a failure keeps the line and shows the error under it with Retry,
  and a stopped rebase adds one line under it, its title with `Open rebase`, which opens the
  Branch page of that mount where the full panel lives); then
  its pages (`WorktreeEntries`), open unless you folded them: Pull request
  (Merge request on GitLab, with its number and the branch in mono),
  Comments, Files, Commits, Checks, the one with the open page marked
  current. Each page ends in one fixed right-aligned slot from
  `worktreeEntryFactsOf`: `Draft`, the comment count with a warning dot while
  one waits on you, the diff stat `+652 -99` in green and red beside the file
  count (the `useMountDiffStats` source of the Overview rows), `2 not pushed`
  or the commit count, `1 failed` with a danger dot or the check count; a
  known zero leaves the slot empty. Files is a plain page like the others:
  picking it opens the diff in the center, whose changed file list sits in its
  own rail on the right of that page, never in the session rail. The pages are
  drawn once, by the tree; the Branch page no longer portals its own rail
  anywhere. The branch switch (Switch branch…), Link work to this branch, Copy
  branch name, Copy path, Open in editor, Close branch and the rest are the
  mount registry, in the row menu below. A session restored with the Branch
  lens saved opens on the tree with that branch current and its page in the
  center.
- **The row menu.** One menu per branch row, the mount registry for that
  worktree (`useObjectMenuTrigger`, the same verbs as the old identity row
  and the status line): the row's `⋯` (`ObjectOverflowMenu`, named `<project>
· <branch> actions`), a right click on the row and Shift+F10 on it open the
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
- **Back.** On the folded worktree level the back icon goes up to level 1, and
  so does ⌘[ while focus is in the rail; on level 1 ⌘[ in the rail does
  nothing, and anywhere else ⌘[ is the top bar Back. Any move into the session
  (a row click, a page key, a link from the palette, a notification) starts a
  fresh history entry. A
  studio over the session (Tasks, Chat, Workflows, Terminal, Monitoring,
  Impact) covers the page and its rail; the column selects that studio's door
  and leaves the session row unselected.
- **The tools sit in their own column and never drill.** They are not in the
  rail: a thin icon toolbar at the right edge of the session content, between
  the page and the open drawer (see The session tools), the same on level 1,
  on a worktree, on a run and on Auto, folded rail or not.
- **Folded (44px).** The rail's own toggle (`SessionRailToggle`, Fold session
  rail, ⌥⌘B) folds it to the current level as icons with right tooltips
  (`SessionRailIcons`): on a branch the back icon, then one icon per page of the
  worktree (`RailWorktreeLevel`; only the folded rail drills there); on level 1
  one icon per page with its dot, then one pull request state icon per
  worktree. The folded rail has no foot and no top
  row buttons; the tools column beside the content stays as it is.
  ⌘B folds the column only, which shows New, the doors and the pinned session
  nodes on every screen. Folding the session rail leaves the diff page's file
  rail as it is.
- **A preset run keeps the rail on the session.** Opening a run with a fixed
  step list (a saved workflow or Describe steps; `executionMode` not
  `dynamic`) shows the run page in the center and leaves the rail on level 1;
  its spawned agents are in the Agents panel (see The session tools). Esc on
  the run Overview calls `leaveRunLevel`: the Runs list, a new history entry.
  An orchestrated run shows its document with **Orchestrated** selected
  ([The orchestrated document](../workflows.md#the-orchestrated-document)).
- **An orchestrated run opens from Runs.** Runs stays selected while any run,
  agent or Auto conversation is in the center (the Runs page lists every
  current lens, `pageLensOf` read by `useSessionPageLens` in the open, folded
  and flyout session levels). Esc on an orchestrated run (`leaveRunLevel`) and
  going up to Runs from a run (`upTo` clears the run focus when it lands on
  the Runs list) land on the list. A step row of the document opens the step
  in the pane (drawer kind `run-step`), never the center.
- **Auto keeps the rail on the session.** An Auto row of Runs opens that
  conversation with the Agents panel open (`openSpawned`), and Runs stays
  selected on the rail while an Auto agent is in the center. ⌘⌥W and the
  Agents key (`lens.agents`, ⌘⌥A) both open Runs, and pressed on Runs go back
  to the Overview.

The tools (Explore, Context, Ask, Agents, Scripts, Terminal) are panes, not pages:
they open from the session tools column at the right of the content (see The
session tools), never from a page header.
The linked records keep their lenses for now and stay in the palette.

**A sidebar row says the name and the state, and the hover card and the board
card say the rest.** A row is one line of 28px: a 14px `WorkNode` and the
title, with the ticket key of a linked task in front of it when the goal starts
with `[KEY]` (`sessionRowTitle` strips the key from the title and returns it;
`SessionRowTitle` draws it in muted mono, the title truncates and the key never
does; the switcher row and the hover card title do the same, the board card
keeps its chip). It has no second line, no `ToneBar`, no marks, no age and
no cost. The node says the state by meaning (`sessionNodeOf`, from
`useSessionSummary`): under needs you it draws the mark of the winning reason
from the one reason table (`?`, the approval shield, an amber `!`, a solid green
check for an approved pull request, and a red `!` only for an agent error or
failing checks); running is the ring, done a solid violet disc with a white check, in review and
building a 1px hollow ring named by the stage word, and archived a dashed ring,
only under Show archived. Colour is never the only sign. The open
session is set in medium weight and selected while its page is on screen. The row's
accessible description carries the stage word and its reason, so nothing is
mouse-only.

The rest is one rest away. After a 500ms rest on a row, or on keyboard focus
after the same delay, the hover card opens beside the column: the full title,
the stage word with its reason when the reason adds a fact (under needs you, the
words of the winning reason, then each other reason that holds on its own line),
the run progress
(`Implement · 3 of 5`, counted from the steps that started, never estimated),
the pull request with its checks (the state word only for Draft, Merged or
Closed: the stage line already says In review), the linked task chips, one chip
per project, the
agent count, the spend and the age, and one ghost action, **Open what needs
you**, when the session needs you. That action lands where the palette's Needs
you rows land (`attentionPlace`), and so does the board card's **unread reply** button
(`openUnreadReply`): the latest agent with an unread reply, never the first agent. Moving to another row swaps the card at once, with no second
wait. Esc and opening a session close it, and the pointer may move onto the
card. The row, the card and the board card all read `useSessionSummary`, so they
say the same things in the same words. The board card keeps one signal and
hands the rest of the summary to the hover card; the session header keeps its
chips.

**The user chooses what the list shows and in what order.** The sidebar list
has no "Sessions" eyebrow and no filter row of its own: the Sessions door row
holds one funnel button in its action slot at the right, **Filter sessions**
(`SidebarSessionsFilter` over `SessionFilterPopover`), with a primary 6px dot
while a filter is on (a status, a project or Show archived; `displayStateOf`
owns that count). The door row never regroups, so the popover stays open
while the list under it changes grouping. The Sessions page header holds the
same button. Its popover is a labelled dialog laid out like a display menu,
in sections spaced by `gap-3` (no unlabeled line inside a floating surface, see
docs/styling.md). On top, Display: two compact rows, **Sort**
and **Group**, the label at the left and the current value at the right
(`DisplayValueRow`); the value is a quiet `Listbox` that opens its choices.
Sort offers Needs you first [default], Alphabetical, Last activity and Created;
Group offers None [default], PR state, Stage and Project (the Sessions page
drops Group). Then **Filter** (an `Eyebrow`), with the captions Status and
Project over real `Checkbox` rows (`FilterCheckRow`), each named with its count
("Running, 3"). Status lists only the stages that have sessions, from Needs
you, Running, In review, Building and Done (`statusFilter` in the prefs; a
checked stage stays listed at zero so it can be cleared). Project lists the
projects of the sessions with their counts and shows only when two or more
projects have sessions (the same selection as the board's project filter).
Last in Filter, **Show archived**, a `Switch` with the archived count. **Reset** shows
only while the popover is off its default (a filter on, or Sort or Group
changed) and puts every choice back. The choices persist per workspace in the browser storage
(`goodboy:session-view:<workspace id>`, version 3: a version 2 record loads with
an empty status filter); nothing goes to the database.

A filter never hides a pinned session or the open session
(`withExemptSessions`, `filterSessionsByStatus`). When filters hide other
sessions, one quiet line under the list reads "N hidden" with a ghost
**Clear**; a list that filters out everything says "No sessions match".

By default the sessions that need you sit on top, the one that has waited longest
first, and the rest follow their last activity (`activityKeyOf`: the later of
the last finished turn and `sessions.updated_at`). Opening a session writes
`sessions.last_opened_at` and never moves a row, so the list holds still while
you click through it. A row moves only when its session has new activity or
starts needing you, or when it leaves or rejoins the Inactive group below. `last_opened_at` feeds `⌃Tab` and the switcher's recents
only. The Board's default order uses the same key. With no grouping the first
eight rows show and the rest sit under **Show N more**, remembered per
workspace. A session that needs you and the open session are never folded. A
grouped list shows every group, finished groups start collapsed, and nothing
folds. `⌘⇧[` and `⌘⇧]` walk this same displayed order and skip folded rows, so
pressing `⌘⇧]` four times from the first row visits the next four sessions.

**A session nobody touched for three days moves to an Inactive group at the
bottom.** One pure function, `sessionInactivityOf`
(`store/slices/session-view/sessionInactivityOf.ts`), owns the decision. A
session is inactive only when every one of these holds: it is not pinned, not
the open session, has no queued message (`agentQueue`) and no unsent draft
(`agentDraft`) on any of its agents, its own state is not starting, running,
blocked or error, its stage info is quiet (stage not needs you or running, no
attention reason and no second reason, so a question, an approval, a
permission, a failed check, a merge queue or an unread reply all keep it up),
it was not opened in the last 24 hours (`RECENTLY_OPENED_MS`), and its last
activity is more than 72 hours old (`INACTIVE_AFTER_MS`, strictly older, so a
session exactly at the edge stays). The last activity is the latest of
`created_at`, `updated_at` (bumped when the session's state changes),
`last_opened_at`, the state's own time, each run's start and
each hint sent to its orchestrator, and what `inactivityInputsOf` saw: each
agent's start, finish, completion, stop, close and last view, and the
`updatedAt` and `mergedAt` of the session's pull request and of every pull
request on its mounts, and the same two fields of the session's GitLab merge
request and of every merge request on its mounts (`sessionGitlabMr`,
`mountGitlabMr`), which move on a push or a review. A message you send
starts a turn, which keeps the session up while it runs and stamps the agent's
finish when it ends. Three days lets a Friday session survive the weekend; the
24 hour floor is stated on its own so a session you opened in the last day
stays up whatever the threshold. A session whose stage is done by a merged or
closed pull request does not wait for the three days: it leaves the live list at
once, unless you wrote after the request ended (the latest turn of a
conversation agent, not a resolver, rewriter, scribe, CI or Auto agent and not a
child agent, is later than the end by more than five minutes), which
`inactivityInputsOf` reports as `requestEndedAt` and `personTurnAt`. Every other
rule above still holds, so writing again brings it back. The threshold and
the floor are constants, with no setting. `useSessionInactivity` runs the
function for every listed session on a one minute clock (`useNow`) and keeps
the same map while no session crosses the line; `splitInactiveSessions` then
pulls the inactive sessions out of every group, drops a group it leaves empty
and appends one group with the key `inactive`, newest activity first,
whatever the sort. The sidebar draws it last as **Inactive** with its count
from two, after the fold, never folded; in a grouped list it is a toggle like
the others, open by default. Its rows show the title alone: the label already
says Inactive, and the age lives on the hover card. The List view of the
Sessions page groups by stage like the Board and draws no Inactive group: an
inactive row stays in its stage, and its last column reads its age in the same
form as every other row ("4d ago", `inactiveWords` over `formatAge`). A change to any input recomputes at once, so
opening, an agent starting, a new reply, a draft or a pull request event puts
the row straight back in the list. `⌘⇧[` and `⌘⇧]` walk the Inactive rows too.

**Pin a session and it stays at the top of the list.** **Pin session** and
**Unpin session** are session actions (the row's right-click menu, `⌘K` and
every other menu of a session), shown for a live session only, one at a time
by whether it is pinned. Pinned sessions form a **Pinned** group above
everything, in the order they were pinned (oldest first), under every sort,
group, project filter and fold: a pinned session shows once, under Pinned, and
leaves its own group and the fold's count; a stage group still counts its
pinned members, so the sidebar and the List say one number per stage. In a
grouped list the Pinned header is a toggle like the others; in a flat list it
is a label and the rest of the list reads **Sessions**. Pinned and Sessions
carry no count (the "Show N more" foot does); stage and project groups show
their count from two, in sentence case words from `stageWord`. Archiving a pinned session
hides it with the archive; the pin is kept, so Restore and Undo bring it back
under Pinned. Pins are stored per workspace in the `workspace_values` table (key
`sessions.pinned`, a JSON list of `{ id, at }`), written by
compare and swap with one retry so two windows never drop each other's pin,
read when a workspace opens and when the window regains focus, and pruned of
deleted sessions on read (`store/slices/session-pins`). The pin shows in six
places: the list's Pinned group, the row's `⋯` and right click menu
(`Pin session` and `Unpin session`), a pin toggle in the
Overview title row, a "Pinned" fact in the session hover card, the rail buttons, and the
switcher's Pinned section. **Move up** and **Move down** (`session.pinnedUp`,
`session.pinnedDown`) reorder a pinned session from the row menu and `⌘K`, only
while it can move; `movePin` swaps the `at` of two neighbours and goes through
the same compare and swap. Dragging is not built.

**The session level of the rail carries one current sign.** `currentSignOf`
(`SessionActivityBar/currentSign.ts`) returns a page id, `session` or
`remembered`. A page with an entry (Overview, Changes, Runs, Agents,
Artifacts, and Questions while one is open) takes `bg-selected` and
`aria-current="page"`; on the Branch page the worktree row of the shown mount
(`useBranchIdentity`) takes it instead. In the column the open session row
takes the sign while its page is on screen. While a studio (Tasks, Chat,
Workflows, Terminal, Impact) sits over the session the column selects that
studio's door and shows the session row in medium weight with no fill. A worktree row click goes through `switchBranchMount` and
lands on the landing tab of that branch (`branchLandingTabOf`: Pull request, which is
the branch page while the branch has no pull request), never on the tab, thread or diff
focus of the branch it leaves. The Pull request entry under a branch row names the request
by its number alone (`#9998`, `MR !42`), so the label is never cut; the row above already
names the branch.

**The rail holds the pinned sessions and, when needed, the open one.** Under the
doors, in the workspace scope only, the pinned sessions are 28px node buttons
(the same `StateNode` as their rows) in pin order, up to seven
(`RAIL_PINNED_LIMIT`), whatever is open: opening another session never moves a
node, only the marker. The open session, when it is one of those pins, keeps its
slot and takes the current sign (`bg-selected`, a 1px inset hairline, the glyph
at full foreground, `aria-current="page"`). When it is not pinned, or is pinned
beyond the seventh, it is one extra node after the pins and before `+N`
(`data-slot="rail-open-tail"`). A click opens the session; hovering or focusing
the current node opens a flyout (`RailFlyout`, the overlay layer of the hover
card) with the same pages list as the card (`SessionPages`, one source), the
branches when there are several, and the pinned sessions. Esc closes it and
returns focus to the button, and `→` or `↓` on the button moves into it. A studio
over the session leaves its button `remembered` (full foreground, no marker). The
other nodes carry the session title and the stage words in their tooltip. `+N`
counts the pins past the seventh and opens the same flyout with every pin. `New`
shows the draft dot and reads `New session, Draft in progress` while a written
draft waits elsewhere.

**Two keys switch sessions without the list.** `⌃Tab` opens a list of the
pinned sessions (a **Pinned** section, up to eight, in pin order) and then the
recent sessions in last-opened order, the open one first among them; a pinned
session is listed once. The first press still lands on the previous session
wherever it sits. `Tab` and `⇧Tab`
move while `⌃` is held, releasing `⌃` opens the chosen session and Esc cancels.
A quick tap flips to the previous session and never draws the list. `⌥⌘↓`
lands on the next session that needs you, in the board's Needs you order, on its
`attentionPlace`. A focused terminal and an open dialog keep both keys.

**Peek is a way of showing the column, not a second column.** The overlay
renders the same `SideColumn` (through `ShellLeft`), and the codebase has one
sessions list. Only the pinned column's Goodboy row opens its menu by itself
and reports updates; the peeked copy is quiet. Peek is wider than the pinned
column. The extra width applies at read time, so widening the peek never moves
the column. It opens after a short rest at the screen edge, so a graze does not
open it.

**The session overview is the reference page.** It shows the whole surface
grammar on one screen, so read it before designing a new surface. Here is its
rhythm. Each section has an eyebrow label, and a section has at most one
primary button. The goal, the notices, Needs you, Next and Activity are peer
sections in the pane body, one `PANE_RHYTHM.stack` gap apart: the header passes
`headerRhythm="section"`, so the gap under it is the same. Space separates
sections, never a `<Divider />`, and a section never has a border. The Activity
header holds the **Activity | Log** switch, **Mark all seen** while an agent has
an unread reply and the session cost on the right; the Log adds a search field
under it, and there is no description line. A section appears once its
fact exists (a plan, a workflow run, a PR on a project). Before that it is one
quiet action row (link an issue, start an agent, attach a workflow). So the
empty session reads as a young version of the same document, not a wall of
placeholders. Finished work collapses into one summary row per category. The
surface itself shows urgency, never a badge parked beside it.

**New session is a draft, not a session.** New, ⌘N (on Chat, Terminal and
inside Ask the same chord is new chat, new terminal and Reset chat, see
[keyboard.md](../keyboard.md)), the board, the palette
and the checklist open the `New session` draft (the `session-draft` place,
address `new`). Nothing is written: no row in the database, the column or
the board. The trail and the title say `New session`, the title is faint and
cannot be renamed, and there is no `⋯` and no chip. The
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
and lands on its normal Overview (`Untitled session`, `Add a goal`), where
the goal, projects and work are added from the usual controls. Nothing is
required first, and the draft stays for the next New.

The draft asks no question first (`SessionKickoff`): **Where** (`WhereChip`) is
optional and sits in the task field, and **Start blank** sits in the page
header. Where is a searchable multiple `Listbox` in two groups
(`projectPickerOptions`): "Suggested" holds at most five (the most recently
used, then starred ones) and "All folders" lists the rest by name. The draft
keeps the picks as `projectIds`; the first is the session's project and the
rest are added with it (`additionalProjectIds`). The page has no visible
title, the trail names it (a screen reader heading stays, drawn by
`PaneTitleRow` inside `sr-only`).

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

## Breadcrumbs

- **Every session page below the Overview draws one trail above its title.**
  Cut C1 is reversed: with the sidebar folded nothing else named the session.
  `SessionWorkspace` hands `<SessionTrail>` to the visible layer through
  `PageTrailContext` (`@goodboy/ui`), and `PageHeader` draws it as a 24px line
  at the head of the header, above the title row, in the same gap; `PaneShell`
  clears the context for its body, so a nested header never repeats it. The
  trail is `upTrailOf`: the session title, the page, then the item's kind
  (`Stop retried webhooks… › Orchestrated › Run › Agent`). Every crumb but the
  last is a link that calls `upTo` (Back when the entry below is that place,
  else a push); the parent crumb's tooltip reads `Go up to Run (⌘↑)`. The
  Overview draws no trail (its title names the session), nor does a drawer,
  which keeps its `DrawerFrame` back. The Branch page reads the same context
  through `BranchDetail`, which drops it when a studio band claims the top.
  Each page still opens with one header row from `PaneShell`: the page title,
  then the page actions and at most one `⋯`, the page menu. A crumb carries no
  menu (decision 6 of the breadcrumbs plan).
  `every-place-has-a-way-up.test.tsx` walks one place per lens and per target
  kind, renders `SessionWorkspace` and fails when the drawn trail differs from
  `upTrailOf`; a place that opens a drawer or a side pane is named with its
  reason. It also fails on a back arrow or chevron outside `Trail`,
  `DrawerFrame` and the history arrows, with a named allowlist for the backs
  that are not a way up.
- **The header holds only its page.** `SessionWorkspace` hands no actions
  to the page headers: the session tools live in their column at the right of
  the content (see The session tools), so no header carries a second `⋯` (pinned by
  `scene-primaries.test.tsx`). `PaneActionsContext` stays for a page that
  lends its own action to a nested header (the issue detail's back word).
  ⌘L (`ask.open`, app plane) opens Ask or, when it is open, focuses its box;
  the key is bound once per visible session (`useAskOpenShortcut` in
  `SessionWorkspace`), not by the row, so two mounted pages never bind it
  twice.
- **The Overview header** reads the session title, renamed in place
  (`SessionOverviewPane/OverviewTitle`, see above) and on the main sidebar row; Pin and Refresh on the session rail
  top row, Archive and Delete at its foot. The header holds
  **New**
  (`OverviewActions`, ⌘N on the Overview, a menu from the `newForm` kind of
  the action registry whose pick opens its form in the New drawer; filled only
  while nothing runs and Next holds no row) and, on an archived session,
  Restore. Context lives in the session tools.

## The session tools

One icon-only column at the right edge of the session content, between the
page and the open drawer, the same on every rail level and in this order:
**Explore** (⌘⌥X), **Context** (⌘⌥C), **Ask** (⌘L), **Agents** (⌘⌥L),
**Scripts** (⌘⌥S) and **Terminal** (⌘⌥T) (`SESSION_TOOLS`), read from what you
read to what you act with: Explore and Context first, Ask, Agents and Scripts
next, the Terminal, a tool, last. A thin separator (`role="separator"`, not a
button, so the arrow keys skip it) sits between the three groups, which each
tool carries as its `group`. Each tool keeps its pane id and its chord, so a
saved pane or a shortcut opens the same tool wherever it sits in the column. `SessionTools`
(`features/session/components/SessionTools`) is mounted by `SessionFrame`
after the page, one icon button plus its inset wide (40px) on the sheet background, its buttons starting on the
rail top row's line. Each tool is a square `md` `IconButton` with its icon only
(`SessionToolButton`), its name and chord in a left tooltip, its accessible name
reading the word and any note ("Context, Decisions changed since you last
looked" while a dot shows), `aria-pressed` with the `bg-selected` fill while
its drawer is open (`openPaneOf`). The Context dot is a badge on the icon's top right corner: info while the
summary runs, danger when it failed, primary when the context changed since
you looked. The column is a `toolbar` (`aria-orientation="vertical"`, named
Session tools) with one tab stop; Up, Down, Home and End move it
(`toolbarIndexAfter`). There is no menu, so a page header never shows a second
`⋯`. With a side pane in push mode the column sits right before the drawer;
when the window is too narrow for the pane to push (about 1100px with the
sidebar open), the pane floats over the page with the scrim and covers the
column, as it covers the rest of the page, until Esc or its close returns it;
the tool chords keep working. The line between the two is one rule,
`drawerLayoutOf` with `DRAWER_PUSH_RESERVE` ([styling.md](../styling.md)).
Folding the rail leaves the column in place, and a drill never moves it.

- **Agents holds every agent of the session** (drawer kind `spawned`,
  `app/components/SpawnedPanel`), in place of the old level 2 of the session
  rail: the same set as the Runs page, read from the same model
  (`useSessionRuns`), so a run, an orchestrated run, Auto and an agent you
  started yourself are all there. Its body follows the page (`useSpawnedFocus`): on a preset run (from
  Runs, the Running card, the Done card or a link to a step, read through
  `presetRunFocusOf`) it shows the run's identity row (the state dot and the
  title, which renames inline on click), the run's agents as a tree, **Add
  step** and the foot "Limit $3.00 · $1.12 spent" (`RunSpendFoot`); on an Auto
  agent or one of its children it shows Auto and its children as a tree, "No
  agents started yet" while Auto has none; Auto's limit sits on the Auto page's
  settings line (`AgentSettingsLine`), not in this panel. With nothing selected, or after **All launches**, it
  lists every live and recent launch of the session newest first
  (`launchesOf` over `sessionRunsOf`: runs that are not archived, orchestrated
  ones included, Auto roots and standalone agents, with the 30 newest finished
  ones as on Runs), each with its agents under it; a standalone agent is a
  launch of one row (`SpawnedAgentGroup`: role glyph, name, state word on the
  row) that opens its page in the center and keeps the panel open
  (`openSpawned` target `agent`), and a session with none says "No agents in
  this session yet"; picking a launch opens it in the center and keeps the
  panel open (`openSpawned` passes the panel as the navigation's drawer). The
  Overview's Now run header (`LiveRunBlock`) opens that exact run page,
  including an orchestrated run, and Back returns to the Overview. Its step
  rows and status sentence are status, not parallel links to the Runs list.
  The tree is drawn on the Activity rail, in the Activity orientation: a **Now**
  marker on top (`SpawnedNowRow`), the spine running down to the oldest
  launch, and inside each launch the children above their parent, newest on
  top, each joined to its parent's lane by the same branch curve
  (`spawnedRailOf` lays the rows out with `layoutTimelineRail`, `SpawnedRailCell`
  draws them with `TimelineRail`; a queued child dashes its lane). The DOM keeps
  each launch parent first for assistive tech and reverses it on screen
  (`flex-col-reverse` on `[data-spawned-launch]`); every reader of the screen
  order goes through `spawnedTreeItemsOf`. A focused Auto launch is the same
  `SpawnedAutoGroup` as the list, so it reads the same way: Now, the newest
  child, down to the oldest, Auto at the foot. A child
  that starts while you read lower in the list moves in at the top and the rows
  you read stay where they are (`useSpawnedScrollHold` keeps the first visible
  row's offset across the change; at the top, on Now, the new row simply shows).
  Focus stays on its row. The run page's step tree (`OrchestratedChecklist`)
  stays top down, the first step on top. A row is one 28px line: the
  state node on the rail, role glyph (the noun in its tooltip), title, a
  fixed chevron slot and a fixed time column (`DelegationClock`, the clock
  every work row reads), so icons and times line up down the list. The
  selected agent is revealed when the panel opens or the selection changes:
  a fold hiding it opens and the row scrolls to the middle, later changes
  scroll only as far as needed, and an agent missing from the tree changes
  nothing (`useSpawnedReveal`, `foldAncestorsOf`). An Auto
  root is titled by the ask it started with, loaded with the tree view, not
  its transcript (`autoRootTitleOf`, the same title as the Auto agents list) and a child by `autoChildLabelsOf`
  ([auto.md](../auto.md#the-chat)). Every Auto parent folds on its row (chevron,
  Right opens, Left folds, `foldSpawnedRowsOf`): a tree live when it first
  loads opens, a settled one folds, and a folded row keeps its state and says
  its count of children ("3 agents"); settled sub agents of a run fold into one
  row like the run page's (`useFoldedRunTree`). The rows are a `tree` with
  `treeitem`s and `aria-level` (`SpawnedTree`): one tab stop on the newest
  root, Up and Down and Home and End in screen order, Left to the parent
  (below), Right to the nearest child (above) or to open a fold, Enter or
  Space to open (`treeKeyTargetOf`).
- **A row opens its agent in the center and the tree stays.** Every agent row
  (a run step, an Auto child, the Auto root, an agent you started) goes
  through `openSpawned` with target `agent`: it navigates to `agentPlace` and
  passes the panel as the navigation's drawer, so a child shows on the same
  page as a top-level agent (`AgentDetailPane`, with the Auto notice for an
  Auto child; a preset run step reads as its run step page through
  `presetRunFocusOf`) and the tree stays open with the row selected, one click
  per hop. A run head opens its run page the same way. **j** and **k** with
  focus on a row of the tree open the next and the previous agent in screen
  order (`SpawnedTree`, `hopTargetOf`), stop at the ends, and leave focus on
  the row; **Up** and **Down** still only move focus, and Enter opens. The `auto-child` and
  `run-step` drawers remain for the doors that preview a child while the
  center stays elsewhere (Now, the delegation lines, the orchestrated
  document) and carry no way back to the panel.
- **A saved level 2 lands on the panel.** A window saved on a run or on the
  Auto level before the panel opens on the same page with Agents open
  (`withoutRemovedPages` drops the retired `sidebar-level` key). The panel
  is per window: the drawer belongs to the window's store.

- **Outside a session there is no tools group.** The workspace pages (the
  board, the studios) already hold the two tools that make sense there as
  column doors: **Terminal** (with New terminal on its plus) and **Chat**
  (with New chat), the workspace conversation that answers what Ask answers
  for one session. Ask, Explore, Context and Scripts read one session, so they
  exist only inside one, and ⌘L is bound only while a session is visible.

- **One pane at a time.** Every toggle goes through `togglePane`
  (`features/session/panes/`): pressing the open pane's toggle closes it,
  pressing another replaces it in the one right drawer. `openPaneOf` maps the
  open drawer to a cluster pane, so an Explore file opened from Explore keeps
  Explore lit, and a script output opened from Scripts keeps Scripts lit. Esc
  closes the pane (`DrawerFrame`).
- **Explore and Scripts are drawer kinds** (`explore`, `scripts`), not lenses.
  `ExplorePane` and `ScriptsPanel` render in a `DrawerFrame`. A file opened
  from Explore replaces it and shows **Back to files**; a script output opened
  from Scripts replaces it and shows **Back to scripts** (`DrawerFrame`'s
  `back`, carried by the payload's `from`); Run on a Service does not open it,
  Run on a Task does. `openExplorePane` takes the
  worktree to browse (the mount registry's Browse files passes it),
  `openScriptsPane` the project to scope to (Open scripts). `openLens` sends
  the old `explore` and `scripts` lenses to the panes, so the palette, toasts
  and stored notifications (`open-lens` scripts) still land.
- **Context signals ride on its row.** A 6px dot in the Context row's right
  slot (on the folded icon, its corner) marks decisions changed since the last
  look (info), a running summary (info, pulsing) or a failed summary (danger)
  (`useToolSignal`, over `contextNoteOf`); the row's tooltip and accessible
  name say why. The group loads the seen marker and the decisions once, as
  the old chip did.
- **Scripts and Terminal signal too.** The Scripts button shows a running dot
  while a script of the session runs and a danger dot for a failed run nobody
  opened (`scriptsSignalOf`; the drawer marks the run seen in `scriptRunsSeen`
  when its output is open, so the dot clears on that run and returns on the next
  failure). The Terminal button shows a dot when a command that ran more than
  ten seconds ended while the drawer was closed (`useTerminalFinishSignal`, a
  3 second poll of `terminal_list_live` kept to the latest answer, state in
  `terminalFinishes`, cleared when the drawer opens). It says "finished", never
  "failed": the shell gives no exit status. A script that ends while its session
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
  `Workflows > Ship a fix` with its save state and actions), so the app has one
  breadcrumb. In a split studio (Chat, Guide, What's new, Tasks, Notifications) the band
  is the first child of the detail beside the page rail, not a bar across the rail, so
  the crumb, the title and the body share one x ([frame map](../styling.md#the-frame-map)).
- **The parent crumb is Up, and the last crumb names the kind.** No crumb
  carries a back glyph and `Trail` has no lead slot, so a page never draws its
  own back link above its content. The last crumb of a run, an artifact, an
  artifact being created and a selected agent reads `Run`, `Artifact`,
  `New artifact` and `Agent`; the page title holds the name.
  `no-back-glyph-in-trail.test.tsx` fails on a chevron or arrow to the left
  inside a trail.
- **Every crumb has an icon, and depth compacts the trail.** Agents carry the
  agent glyph in their kind's colour, runs the run glyph, artifacts, questions
  and pull request modes their own. The last crumb and its parent always stay
  full. The first crumb (the session title on a page, the studio in a band)
  keeps its name through five crumbs. From five every other
  ancestor but the parent becomes an icon, and from six the first crumb does too.
  When the band still has no room, ancestors turn
  to icons from the left, then the icons after the first crumb fold into a `…`
  menu right after it; the first crumb is the anchor and never folds. An icon crumb keeps
  its name as tooltip and accessible name. `compactTrail` in `@goodboy/ui` is
  the pure rule; the label closes with a 220ms width transition (120ms fade),
  and a new crumb enters from the right 60ms later. Under reduced motion only
  the opacity changes.
- **The session trail starts at the session title.** The sidebar row and the
  rail vanish or point at a list when the sidebar is folded, so the first crumb
  names the session (`crumbOf`, through `sessionTitle`) and folds by the
  `compactTrail` rule when the line is short.
- The last crumb is the current location and is never clickable. A list view
  never fills in a crumb for an item the user has not opened yet.
- **A crumb carries no status dot.** The trail is structure, movement rather than
  state. An agent's state is drawn once in the row node and once in the chip of
  the agent header, and the chip's tooltip (`stateDescription`) is the one place
  that explains the state words. Elapsed time shows only in the header. The Brief's
  Now band keeps the label and the "much longer" note.
- **A resolver title names the flow verb, not the kind.** `Resolve: index.ts
comment` for the maintainer's own comment, `Resolve: Mara Quint on index.ts`
  for another reviewer, `Resolve: 3 review comments` for a group. Rows saved with
  the lowercase `resolve: ` prefix are shown without it (`agentDisplayName` in
  `shared/utils`), so old and new rows read the same.
- **An integration trail hangs off its own tool.** It uses the name the sidebar
  uses (GitHub, GitLab, Jira, Linear, Slack), at the same depth as any other
  lens. A studio belongs under its own tool, never under another tool's lens.
- **Opening a child extends the trail and keeps every ancestor**:
  `{session} › {HomeLens} › Agent`. Selecting a sibling changes only the last
  crumb and the child region.
- **The trail shows the structure of the app, not the history of the
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
  thread selection replace the entry, so Back never walks them; the trail is
  the way back to the section. The trail is
  `{session} › Branch › Thread` or `{session} › Branch › File`, the same from
  every door and always reading `Branch`, never the branch or pull request name
  (the header names it); Up is the crumb to the left of the open one. The
  Branch crumb has no menu; the branch switcher is `project · head ▾` in the
  header. `layers.ts` is
  gone. The requests `pr`, `review` and `files` (a mount present) are
  rewritten to the Branch address by `canonicalLocation`, so the palette, the
  shortcuts, a notification, a chip, a search hit and an Activity row all land
  on the same address; a saved place is rewritten the same way when it is
  restored. A GitLab or Bitbucket merge request keeps the `pr` page (the old
  studio stays reachable from its strip until the host cleanup), a session
  without a branch keeps Changes (page id `files`).
- **A child hangs off the overview section that owns it**: a step under its
  run under Workflows, an ad-hoc agent under Agents, a resolver under its
  comment on the Branch (`s/{session}/review/t/{thread}/agent`). Back returns where
  you were, while the trail says where you are.
- **Segment menus.** The session trail carries none for now: a crumb is a
  link. `CrumbMenu` stays in the `Trail` primitive (`@goodboy/ui`) and comes
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
  `4 artifacts`, Questions `2 open`. The sidebar row and the menu read it
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
  next to Open terminal and Abort rebase. A
  branch whose pull request merged reads `Merged` even with no git ancestry
  (a squash merge), in the branch lists and in the Branch header alike
  (`isMountRequestMerged`). The Files tab opened without a branch lands on the active mount.
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
  definition, use and change counts. Defined in comes first, then In this change
  with changed lines first and tagged, then Elsewhere with five references and
  Show more. Directory paths truncate in the middle and keep their separator
  before the filename. It says when it shows only the first 300. This contract
  lives in `features/diff/components/IdentifierPeek`. A result in this diff scrolls to its
  line and flashes it, expanding the hidden range first when the line sits in
  one; any other result opens the Explore file drawer on that line. The commit
  view has no peek, because its lines are not the working tree's.
- **A fix run has no segment of its own.** Its transcript is a drawer on the
  Comments tab, so the trail reads Session, Branch, Comments.
- **Settings draws no band in the column.** On Home, where it covers the
  window, it claims its studio band with Settings, the scope and the App
  section. The scope segment lists App, the workspace, Providers and models and
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

`ScriptsPanel` is one `DrawerFrame` (`Scripts`, count `N projects · N running`,
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
The session sidebar has no scripts section: `$` launches, the Now chip
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
their project name too). On the workspace Folders page the open editor card
of a project ends with a `Scripts` field (`ProjectScriptsField`, label
`Scripts · N pinned`): it reads the project folder when the card opens
(`loadProjectRootScripts`, kept in memory by root path), says `On <base>` and
where a pin shows, and lists the scripts with the same pin; a package label
shows only with several packages, a project with no package.json or
composer.json says so, and a failed scan is an inline `Notice` with `Retry`.
The row itself stays 32px and carries no scripts control.
