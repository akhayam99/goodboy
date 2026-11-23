# The shell

> **Read this when** you change the frame of the window: a context menu, a surface, the top bar, the column foot, the menu bar, the report sheet, the column doors or a shortcut. **Not for** spacing, scroll and overlay mechanics ([styling.md](../styling.md)) or design intent and tone ([DESIGN.md](../../DESIGN.md)). The other pages are listed in [navigation.md](../navigation.md).

## Skeleton

The window is one strip of chrome (the top bar), the places rail on the left,
one main slot and, inside a workspace, a right rail with a dock. Nine principles say where
each thing lives. A principle marked **holds** is true in the code today and is
guarded by a test. A principle marked **target** is the direction of the
skeleton: it is not true yet, no test fails on it, and the unit that makes it
true turns it into a **holds** line and adds its guard in the same change. A
unit that changes the skeleton edits this section first.

1. **Left is where you go. Holds.** The places rail holds New and the six
   places, and no tool; an open session keeps the Board lit, since the session
   is a child of the Board (`ShellLeft/index.test.tsx`,
   `regressions/places-rail.test.tsx`). The Desk is a face of the session, not
   a place: it adds no item and keeps the Board lit too. Sessions in the top bar
   moves from one session to another without the Board. Owned by The places
   rail and the session page tabs.
2. **Right is what you hold. Holds.** The right rail sits at the sheet's right
   edge on every screen of a workspace: the session tools on a session page,
   Terminal and Browser at its foot everywhere. Terminal and Browser stay open
   across every move, and on Tasks, Chat and Workflows the page's own panel and
   the dock stay open together, the panel left of the dock (`toolsStay.test.ts`,
   `StudioFrame/panelAndDock.test.tsx`, `p10-right-dock.test.tsx`). Owned by The session tools
   ([session-rail.md](./session-rail.md)).
3. **One home, one name. Target.** Owned by Column doors.
4. **A page replaces the page. Target.** Owned by Surfaces.
5. **The top bar is identity, movement and live state. Target.** The bar holds
   no control for another container: the sidebar toggle left with the column.
   Every chip opening the home of its number is target.
6. **The bottom-left is the app's corner. Target.** Owned by The column foot.
7. **A menu shows five rows at most. Target.** Right-click menus are exempt:
   they mirror the action catalog (Context menus).
8. **The places rail never folds. Holds.** It has no toggle, no peek and no
   saved width: 64px with a word under each icon, 44px icons only under a
   1100px window, and an old folded choice changes nothing
   (`regressions/places-rail.test.tsx`). Owned by The places rail.
9. **Inside a session, the right opens its Desk. Target.** On the Overview,
   Browser, Monitor and Scripts on the right rail open the Desk with that tool,
   and Terminal opens over the Overview; on the Desk they show and hide its
   panels. Outside a session, the Board included, a tool opens beside the page
   as principle 2 says. Today a tool on the Overview still opens the dock
   beside it. Owned by The session tools.

What holds today and is guarded:

- **One selected sign.** A control lights from `isCurrent` and never from its
  own state, in the places rail, the page tabs and the bell; every one of them reads the one column place (`useColumnPlace`),
  New session included; the page tabs read the session pages sign
  (`currentSignOf`). Every page except the New workspace flow names a place, so
  exactly one control is lit, and the open session is never lit under a page. `__tests__/navigation/oneDoor.test.ts`.
- **One door for moves.** Only `navigate`, `back`, `forward`, `up` and
  `amendFocus` move the user outside the navigation slice. Same test.
- **Saved layouts load without loss.** A window layout and the fold choices
  written by 0.32.0 restore: every studio kind, every drawer kind, the board,
  a session, and a Terminal dock without a session.
  `__tests__/navigation/restore-previous-build.test.ts`.
- **Every route has a row.** `__tests__/surfaces/navigation-flows/`.

A persisted key, a studio kind, a drawer kind and a lens id keep their names:
the fixtures above are the proof that a build can still read what the last one
wrote.

## Context menus

Every object's actions are written once, in the action registry
(`features/actions/`). A kind (`kinds/session.ts`, `kinds/agent.ts`,
`kinds/artifact.ts` and the rest) lists each verb with its label, icon, group,
shortcut from `SHORTCUTS`, when it shows, the reason it is blocked, and its
confirm or undo rule. `useObjectActions` resolves the verbs of one target live
from the store, and `useActionEnv` runs them. The overflow menu
(`ObjectOverflowMenu`), the right click (`useObjectMenuTrigger` and the one
`ObjectMenuProvider` in `App`) and the palette read the same list, so a verb
never exists on one surface only.

- **Visible actions.** The primary action is a visible, labeled button.
  Frequent alternatives stay visible beside it or on the row they affect.
  `⋯` holds copy and rare actions. A linked task is one row of the session
  level's Linked group (`LinkedTaskRow`): a click opens the task, a drag moves
  it, and Unlink, Move to and Remove from this branch sit in its right click
  menu (⇧F10), with no kebab and no hover control.
  Putting work on a branch is `Link work to this branch` (`mount.putTaskOnBranch`), on the
  Overview branch row and in the Projects tree row menu. Link work is the single entry
  for linking work to a session or workspace. Moving a task is one verb,
  `Move to`: in the linked row's menu (⇧F10), in the focused issue's
  `Linked to` row and in the palette.
- **The Board session card.** Its right click (and ⇧F10) opens the
  session kind's menu: **Open** (a submenu with Overview, Comments, Changes,
  Log, Editor, Terminal and External terminal; a verb that cannot run stays in
  it with its reason as a tooltip), Rename, Pin session or Unpin session, Mark
  as read, Start a run, Link work, **Set limit…**, **Copy** (Title, Branch
  name, Worktree path and the pull request link, named by `requestNounLabel`),
  then Stop all running agents (it acts at once, and its toast offers
  **Continue**), Archive (it acts at once, **Undo** in the toast) and Delete,
  whose confirm still asks first. `withSessionSubmenus` (`kinds/sessionGoToActions.ts`) tags the Open
  and Copy rows, and `toMenuEntries` folds a group of two rows or more into its
  submenu (one row stays flat with its full label). A child with choices, such
  as Worktree path with several worktrees, opens its chooser beside the
  submenu (`MenuList`). Ask about this session,
  Refresh session, Write title and goal, Select, the run setting (Start next
  steps without asking, which also sits in the Set limit form: the box follows
  the live setting until you tick it, and a save whose limit landed but whose
  run setting failed says so, and Save again sends only the run setting) and Move up or
  down carry `placement: 'palette'`: ⌘K lists them, no menu draws them. The
  header `⋯` (`sessionMenuOf`) holds Pin, Link work, Copy, Archive and Delete.
  The row is `select-none`, like every row that carries `ROW_HOVER` or
  `ROW_INTERACTIVE` (`SelectableRow`, `InteractiveRow`, `ListGridRow`, the
  Board card): see Where the webview menu stays.
- **Focus after a removal.** A menu verb that removes its row (archive,
  delete, close) leaves the focus on the row next to it, across a group, or the
  one before it on the last row. The right click and the `⋯` capture the
  neighbour before the write (`keepRowFocus`, on `captureReturnFocus` in
  `packages/ui`), rows carry `data-row` (`ListGridRow`, `InteractiveRow`, the
  rail branch row, the Overview branch tile) or `data-select-id` (the Board
  card), and a neighbour drawn anew is found again by that identity. The
  search stays inside the row's landmark: the sole row of a list hands the
  focus to its list, never to a row in another pane. Undo on the toast puts the
  focus back on the restored row once the undo finished. A row that only
  changes (pin, read) keeps the focus.
  The shared confirm (`ActionConfirmPanel`) passes the same `returnFocusTo`.
- **One order.** The registry and right click list Open, Act, Copy, then
  stop, archive and destructive verbs, with one rule before that last group.
  `MenuList` draws rules only from five rows up and an icon on every row or on
  none (`menuShapeOf` in `packages/ui`). Menus and visible controls use the
  same definitions and availability rules.
- **No verb that does nothing.** A surface tells the registry what it shows
  through `env.viewing` (`useActionEnv`, `ObjectOverflowMenu` and
  `useObjectMenuTrigger` take `viewing`): the artifact viewer its artifact,
  the agent header and the messages of the agent page (`TranscriptViewingContext`)
  its agent, the run page its run. Open, Open agent and Open
  run are not offered for the object already on screen, on any of its menus.
  `__tests__/actions/menuParity.test.tsx` checks registry parity on existing
  surfaces, `stateMatrix.test.ts` pins the Open rows, and
  `__tests__/actions/handBuiltMenus.test.ts` fails on a menu built by hand
  outside the registry, against a shrinking list of menus that are not objects
  (page chrome, a few value pickers). The same test fails, with no allowlist,
  on any `role="menu"`, `menuitem`, `menuitemradio` or `menuitemcheckbox`
  written in `features/`, `app/` or `shared/`: every menu, value pickers
  included, renders its rows through `AppMenuList` (radio entries for
  pickers, items for verbs), and only the menu primitives in `packages/ui`
  write those roles.
- **What each object offers.** A session: Open, Comments, Changes, Open in Terminal
  (one choice per worktree in ⌘K; the menu opens the first), Open in
  editor; Rename (inline, in the row that opened the menu), Start next steps
  without asking or Ask before starting each step (the session's Asks you: the
  default of a run started without its own setting and of agents outside a
  workflow; the Runs page header has no switch), Start a run, Link
  work (L on the Overview); copy the title, worktree path, branch and pull request link; Archive with its
  confirm and Undo, and Delete with its confirm (Restore once archived). Several sessions: Copy
  titles, Archive N, Restore N, Delete N. Archive N asks once for all of them
  with the same `archiveConfirmOf` as one session ("Archive 3 sessions?",
  summing `runningAgentCountOf` over them, and saying running agents keep
  running: archive never stops an agent). Cancel archives nothing; a partial
  failure archives the rest with Undo on the toast and names the sessions it
  could not archive above the bar, with Retry for those only. Archive instead
  on the Delete N confirm archives at once, with no second ask. An agent: Open agent, Show its
  changes; Message this agent (not on the agent's own page, where the composer is), Interrupt while a turn runs, Close or Reopen,
  Let the Lead take it from here on an old standalone agent of a standard role,
  Detach from the Lead on an agent that was moved, Change model (one submenu); copy the name; Delete agent. A
  workflow run: Open run, Open in Changes; Answer, Start run, Continue, Restart
  step, Start the next step, Restore; Copy run summary; Stop run, Archive
  run and Delete run, each confirmed. An artifact: the viewer's verbs by kind and status,
  from the list row too, plus Delete on any stored artifact that is not already
  deleted (Undo, no confirm) and Delete permanently on a deleted one (confirmed). A plan part, a Tasks record (with the tool verbs of
  an open record), a pull request, a worktree row of the Overview (`mount`), a
  project, the Diff of a branch (`diff`), a diff file, a file or folder row in
  Explore (`exploreFile`), a commit on the rewrite
  page, a storage worktree, a script, a transcript message and a link in
  rendered text have their own kinds. So has a card of the Next slot
  (`suggestion`, `kinds/suggestion.ts`): its target holds the suggestion as data
  (`suggestion`, the role the primary starts, whether Auto is on) and no
  closure, and its verbs are the other ways to answer that card, the
  items of its **⋯** menu: Continue with Tester and Continue with Implementer (each a
  message to the Auto run of the session through `continueWithRole`, or a role
  started at once when there is none)
  on a check-changes card, one verb per project (`suggestion.rebase.<target id>`,
  built by `adapted`) on a rebase card with two or more, and Talk it through
  with Auto (`suggestion.talkWithAuto`) on a card that starts a role. The run handlers live in the kind (`continueWithRole`,
  `startRebaseTarget`, `startTalkItThrough`); the row only adds the pending and
  accepted bookkeeping around them (`track`). One field says which available actions
  also get a visible control on their surface: `slot` (`primary`,
  `secondary`, `inline`, `nudge`, `notice`, `hover`, `section`, `chip`,
  `empty`, and `menu`, the default, for the menu alone). A surface reads its
  buttons from it (the artifact viewer header its primary and secondaries,
  the Branch header and the worktree row theirs), at
  most one primary and three secondaries; the menu, the right click and the
  palette ignore `slot` and list every available action.
  `useActionControls` renders those controls with the pending words on the
  control, the blocked reason on the line under the header and a failure with
  Retry under the control. Its runs live in the `action-runs` slice
  (`store/slices/action-runs/`), one run per target: `actionRunKeyOf` names a
  pull request by session and mount and a diff by session and worktree, so the
  Branch header and every other surface on that target share one busy mark,
  refuse a second press while it runs and show the same result line, even
  after the surface that started it unmounts. Every mounted controls hook is
  a surface of its key: a settled run is dropped when the last surface
  unmounts and when its session is deleted, and a failure that settles with
  no surface left is logged unread, because the check runs when the write
  fails. A pending run older than ten minutes is reset when a surface mounts
  again. Another kind keeps a run per hook instance, dropped on unmount. A
  confirm that meets a run another surface started in between stays open.
  The Branch overflow menu runs close and convert to draft through the same
  controls. A button reads `pendingId` through
  `actionButtonStateOf` (busy, `pendingLabel` while it runs, the elapsed
  seconds after three, disabled). An action that mutates defines
  `pendingLabel` and `doneLabel`; when it finishes `ActionRunLine` (under
  `ActionStatusLine`) shows the `doneLabel` sentence with a dismiss button
  until the next action, and a run that returns `'unchanged'` (a rebase that
  stopped or went to the history rewriter) shows no sentence. The controls set
  `isOutcomeShown` and `hasRunSurface` on the action env, so a pull request
  write that fails while a surface is mounted is logged as a read row with no
  toast, and Merge and Mark ready skip their toast; the palette, which has no
  line, keeps them. The Mark ready done line keeps a Follow button to the
  pull request tab (`doneTo` on the action) while that tab is not open.
  `kinds/mutationFeedback.test.ts` fails a new async diff or pull request
  action that lacks either word. `__tests__/actions/stateMatrix.test.ts`
  pins, per kind and per state, which verbs show, in which slot, and why a
  verb is blocked, and runs them on the real store; `kinds/*.matrix.test.ts`
  pins the same for the three UX5 kinds against the plan's state table.
- **Preview, tint and held rows.** A verb may carry a `preview` (a role
  today): a menu that is given `onPreview` calls it with the descriptor while
  the row is hovered or focused and with `null` when it leaves or the menu
  closes, and the surface draws it (the Next tile shows the role). `iconClassName` tints
  the icon of a verb in the menu (the role color). A verb that opens a host page
  writes no host word: its `label` is `Open`, its `iconOf` the host logo
  (`shared/components/hostIconOf`) and its `ariaLabel` the spoken `Open on GitHub`, which
  the menu row (`aria-label`), the bar verb, the button and the palette read
  (rule 6: the host is a logo, never text, on a row, chip, hover or menu). `ObjectOverflowMenu` also
  takes `track`, which wraps every run of its rows (pending keys, accepted
  outcomes), and `isHeld`, which keeps a row visible but unable to run
  (`isDisabled` of a menu entry, `aria-disabled`, the description kept). All three
  are optional, and no other surface sets them.
- **Pointer and keys.** The menu opens at the pointer and flips to stay 8px
  inside the window. ⇧F10 (`menu.open`) and the Menu key open it on the
  focused row, and Control-click is a right click. The arrows, Home and End
  move, typing jumps to the first match, Enter runs, ArrowRight opens the one
  submenu level, Escape closes and gives focus back. The row the menu acts on
  keeps a primary outline (`data-menu-open`) while the menu is open.
- **Selection, like Finder.** A right click on a row that is part of a
  multi-selection acts on the whole selection (the several sessions kind, and
  the several chats kind in the chat list). On an unselected row it clears the
  selection and acts on that row alone.
- **One selection bar.** The Board, the chat list, Review,
  Branches and the Storage lists share `SelectionBar` (`packages/ui`). The
  Board cards draw no checkbox at all: a card is
  its optional ticket key, its title, then its state node at the right (the node
  never hides), and the selection is the modifier click (Shift for a range,
  Option, Command or Control to add or remove one), Shift+Enter, Alt+Enter and
  Alt+Space on the focused card, Shift+Arrow on the Board, X on the hovered or
  focused one, Command A, and **Select** in the row menu (`session.select`,
  shown only when the menu is opened from a row or card, through
  `viewing: { kind: 'selection' }`, and delivered to that row by
  `requestSelect` and `useSelectRequest` like Rename). A Board
  card keeps `aria-pressed` on its title button because it holds quick
  actions, and its state word is the button's description. The bar's
  `aria-live="polite"` dock announces `n selected`. Once a session is selected, a
  quiet line in the dock under the bar reads "Shift click for a range, Option
  click to add one"; with nothing selected the list shows no hint. The chat rows, Review, Branches and the Storage lists
  keep their checkbox (on the chat rows it takes the place of the state node,
  `StateNode` `isCheckboxSlot`). The lasso stays. The bar floats at the bottom of the surface that owns the
  selection with Clear, the count, Select all and the verbs. The sessions bar
  takes its verbs from the `sessions` kind through `ObjectSelectionBar`, so
  its words are the menu's words (`shortLabel` on the bar, `label` for the
  accessible name); the chat list does the same with the `chats` kind (Archive,
  Delete). A verb that undoes runs at once with the Undo toast; a
  verb that does not asks in a confirmation above the bar with what goes and
  what stays (`goes`, `stays`, `items` and `altActionId` on `ActionConfirm`).
  The keys live in the `selection` group of the shortcut registry
  (`selection.toggle` X, `selection.all` ⌘A, `selection.clear` Esc,
  `selection.delete` Delete) and run through `useSelectionKeys`, which acts
  only while the pointer or the focus is inside the list. Esc goes through the
  escape stack: the confirmation closes first, then the selection clears. Review
  keeps its own `review.select` and `review.selectAll`. The scroller of a
  surface takes a bottom margin while something is selected, so the bar never
  covers the last row.
- **Confirm and undo.** A confirm is one placement, anchored to its trigger
  (`ConfirmPopover`): Cancel has focus on a danger confirm, `Cmd+Enter` confirms,
  and no card confirm exists any more (`inline-confirm-placement.baseline.json`
  is empty). A verb that loses work confirms in a `ConfirmPopover` on its button
  (Delete, Delete permanently, Discard, Close run, Merge, Close pull request,
  Delete script, Close branch, Unmount, Abort rebase, Restore a
  backup). The Branch header's Merge asks "Merge #318 into main?" and Close
  asks "Close #318 without merging?" beside their buttons. Deleting a diff note
  acts at once with Undo, which posts the same note again; a pull request
  review draft asks in a popover. Remove
  from session and a storage worktree's Remove keep their detailed confirm (the
  removal plan, the forced remove) in their own menu. A reversible verb runs at once with an Undo toast (Archive, Delete on an artifact,
  Close agent, Unlink, Stop tracking, Remove from this branch). The toast lasts
  about 10 seconds and Cmd+Z undoes the latest operation outside a text field.
  Reversible removals never ask for confirmation. Removing a commit on the Commits tab acts immediately with Undo.
- **Blocked verbs stay.** A verb that cannot run now stays in the menu, dimmed,
  on one line with its reason as the tooltip (and as the row's description for
  a screen reader), and does nothing when chosen. A verb that
  does not apply to the state is not shown.
- **Where the webview menu stays.** Every object row answers right click with
  its object menu from `features/actions`, never the webview one. A row whose
  object has verbs elsewhere gets that object's kind and the same verbs: a
  changed file in the tree takes `diffFile` like the diff file header, a review
  or fix comment row `reviewComment`, a Context question card `question`, a
  check run `checkRun`, a decision change `decision`, a workspace in the
  switcher `workspace`, an issue to start from `issueCandidate`, and a central
  branch row the rail branch's `mount` target from `useMountRowMenu` (one
  source for both, so the worktree status and host verbs match). A row with no
  verbs of its own reuses the nearest object's kind (a GitHub issue row takes
  `link`, a worktree page row its branch's `mount`), and a row with no object
  at all (a Done row, a folder in the changed file tree, an Activity decision
  or history batch row) takes the generic `item` kind: Open with the row's own
  open label, and Copy name. `object-rows-open-our-menu.test.tsx` right clicks
  every row type in its scenes and fails on a row that opens no menu. The native
  menu stays in three places only (`useNativeMenuPolicy`, `keepsNativeMenu`):
  editable text fields and the composer (a checkbox or radio is a row, not a
  field), the terminal, and text the user selected
  before the right click inside a reading region. A reading region is any
  element marked `data-reading-region`: `Markdown`, the transcript card shell
  (`TranscriptShell`), the workspace chat thread, `SourceView`, the diff body
  (`DiffView`) and `ArtifactDocument`. A selection the right click made itself
  never counts (the policy reads the selection at the press), and chrome never
  counts: rows are `select-none` through `ROW_HOVER`, so the press cannot even
  select their label. A link in rendered text gets Open link and Copy link.
  Everywhere else the webview menu, and its Reload, is suppressed, and a blank
  area opens nothing.

## Surfaces

**Shell layout.** One strip of chrome sits above, and under it the places rail
plus main. There is no footer. **There is one app layout and every surface fills
its slots.** The board, the session and the studios do not define their own
frames. A surface that needs a different frame changes the shared one instead of
forking a second (`app/shellArrangement`, which every shell mount, the app and
the mock scenes alike, reads). The Desk is one more frame of the same solver,
not a fork: `DeskBody` draws a `DockLane` beside its column and `dockLayoutOf`
lays the tools in it with `isDesk`, while the head, the tabs and the right rail
stay those of the session. **The places rail never changes; a session adds
one rail of its own.** The places rail is the workspace's navigation and looks
the same on every screen. Inside a session the pages are page tabs (see Session page tabs)
under the page title, inside the content sheet. No other surface
adds a navigation column: filters or a list that belong to a page sit beside
the detail as a page rail. The right drawer is context, never navigation. The
right drawer holds reference material beside the page and closes with the pane
that opened it.

**The right drawer is one slot, and the latest open wins.** What it replaced
waits in a back chip at the left of the drawer head, one level deep, so a
third open drops the oldest. The chip reads the kind and the title
(`Plan · Add tax to the checkout total`, `Terminal`); a click swaps the two.
Closing the drawer brings back what the chip holds, and closing that empties
the slot. **The dock follows the page.** A session drawer belongs to its
session: while a page (a studio) replaces the session, the drawer parks, out of
sight and out of reach of every close key, and Esc, Close or Back brings it
back with the session. A parked drawer stays mounted, hidden and inert
(`DrawerColumn` `isParked`), out of the flow so the page takes its width, with
no exit and no width change, so a draft, a scroll position or a running
terminal survives the trip. The session under the page widens while the drawer
is parked and narrows again on return, so its transcript re-wraps. Terminal
and Browser are workspace tools and follow no session: they stay docked across
every move, on another session, on the Board and beside every page but their
own (`keptTool`, `selectDrawerPanel`). Under their own page they stay in the
store but are not mounted (`useShellRight`), so no shortcut answers twice. At
a narrow width the dock floats over the page: the page slot lives in its own
layer (`data-studio-host`, `isolate`), so the dock and its scrim always paint
above the page. On
Tasks, Chat and Workflows the page's own panel and the dock open together in
the order content, page panel, rail, dock: `AppShell` hands the dock to the page
through `ShellDockContext` (`isDockInStudio` from `useShellRight`), and the
page's `DrawerColumn` puts its panel in the `detail` slot, so below the push
width both lie over the page with a scrim. Close keys
read `selectDrawerPanel`, which is null under a studio unless a workspace tool
shows beside it, and the history entry keeps the drawer. A workspace switch
empties the slot. Esc inside a parked drawer is suspended, so it reaches the
page, and so are the list keys and the Scripts run and stop keys
(`useIsDrawerParked`), so a hidden list never moves or runs a script. After the trip the drawer's inner step (a plan in Ask) answers first
again. A drawer's own key (⌘⌥S) on a page leaves that page and every
page stacked under it, and shows that drawer; it never closes a parked one,
and an overlay drawer takes focus back. Esc in the session is one ladder: an open
menu, popover or field takes it first, then the top of the slot closes, then
the drawer from the chip, then the page goes up. A face is not a step of the
ladder: Esc never switches Overview and Desk (model.md, A face is not an
entry). ⌘⇧W (Ctrl+F4 off macOS,
File > Close the Drawer) closes the top of the slot from anywhere, a focused
terminal or web page included; an open menu or dialog takes it first, and a
parked drawer is never closed. The right rail stays at 44px
and says the same thing: the tool in the slot is pressed, the tool in the chip
wears a small ring and is named waiting, and a signal dot sits with either (see
[session-rail.md](./session-rail.md), The session tools). The rules, the store and the navigation cases are in
[home-and-drawer.md](./home-and-drawer.md) (One drawer at a time).

**The places rail** (`app/components/ShellLeft/`, on the `ShellRail`
primitive) is on every screen with a workspace, in the same shape everywhere:
the workspace mark first (`WorkspaceIdentityRow`: the workspace's tile with its
name under it; ⌘O or a click opens the switcher popover to the right of the
rail through `SHELL_RAIL_POPOVER`, 12px inside the window, and ⌘1 to ⌘9 switch
without opening it; the number of sessions that need you in other workspaces is
its count, amber, or red when one is broken, and a dot says another workspace
had activity; while a switch loads the word names the target and the mark is
busy, a failed switch keeps the workspace you were in and says
`Couldn't open {name}.` with **Retry** beside the mark), then
New (⌘N, an outlined tile; a dot and `New session, draft in progress` while a
draft waits), then Board (⌘⇧H), Tasks, Workflows, Chat, Connect and Impact,
then at the foot Settings (⌘,), the bug and the Goodboy signature. Each item is an
18px icon with one word under it. Connections reads Connect on the rail; the
full name stays its accessible name and shows in its tooltip. Impact is last
and quiet. The rail holds no tool: Terminal and Browser live on the right rail
(The session tools). Monitoring has no item: it opens from the Go menu and the
palette (`home: 'menu'` in `destinations.ts`). One item is lit, from the one
column place through `railPlaceOf`: an open session keeps the Board lit, a page
lights its own item, and a current item does nothing, except the Board lit
under a session, which goes to the Board (`canReselect` on `ShellRailItem`). Two signals only, read
from the store (`useDoorSignals`) and chosen by `railMarkOf`: the needs-you
count on the Board, the dot on Tasks for new tasks; the fact goes into the
accessible name. The running terminals and the browser tabs count on the right
rail instead (`Terminal, 2 running`, `Browser, 3 tabs`). While the Monitoring
page is closed, `useMonitoringSignalRefresh` rescans only the pinned, learned
and Goodboy-run ports every 30 seconds (`monitor_snapshot` with a port list,
merged into the snapshot), only while the window is visible and the snapshot
is older than 15 seconds, and never beside another scan. Under a 1100px window
the rail drops to 44px icons and each word moves into its tooltip. The rail
never folds, never resizes and saves no width. The sidebar list, its fold, its
peek and its flyout are gone, and ⇧⌘B has no command: the sessions live on the
Board and in Sessions (⌘B). A 0.39 build saved `goodboy:left-sidebar-width:v3`
and `goodboy:sessions-sidebar-collapsed`; neither sizes or folds anything,
and neither is deleted, so a return to 0.39 finds its sidebar (`restore-previous-build.test.ts`
boots from a folded sidebar 320 wide). Before any workspace exists the rail keeps only its foot.

**Header actions.** One grammar draws the actions of every page header and
drawer header (`HeaderActions`): secondary controls, at most one secondary
button, at most one filled primary, then the overflow `...`, all 28 tall, the
last one on the column edge. The Session overview holds only the overflow
(Refresh, Pin session, Archive session, Delete session...); Delete session...
opens its confirm beside the overflow trigger without moving the page, and Escape or Cancel gives
focus back to the overflow. The Agent page keeps Interrupt, Close or Reopen as
one ghost button with its word (it folds into the overflow below 560px) and
`Delete agent` in the overflow. The artifact header reads
`[Details] [secondary] [primary] [...]`, where Details opens the artifact drawer
on its last tab. A branch reads `[Abort rebase] [one primary] [...]`, and while
the push confirm or any action confirm is open the primary turns secondary so
the confirm holds the one filled button. A plan drawer reads
`[Edit] [Approve] [...]`; Approve reads Approving until the approval resolves,
then closes the drawer on any page and raises one toast, and a plan whose run
was approved reads Approved with no primary until the run starts the step. The
run pages (the preset run level and the orchestrated document) hold one
primary in their header (`runHeaderPrimaryOf`): **Answer** for an open
question, **Raise limit** at the limit, else the verb of `runPrimaryOf`
(**Review plan**, **Approve and continue**, **Continue**, **Retry**, **Decide
next step**, **Start step 2**, **Start run**, **Restore**), else **Pause run**
or, once paused, **Continue** in the same place (`RunLiveVerbs`, the
`workflowRun` registry's own `when`). The tail says the state and keeps only
its own step verbs. The `⋯` follows See, Steer, Settings, Copy, End: View
diff, Skip step N (and Pause or Continue while the header holds another
primary), Step routing (orchestrated), Save as preset, Copy
run summary, **Stop run** (asks first), Archive run and Delete run, never
the approve button. A failed Pause, Continue or Stop leaves the run as it was,
reports the error and keeps the word, so pressing it again is the retry.
The title is the only h1 of the page; the head's back button (`Back to Runs`), its crumbs
or Esc (the session's one Esc ladder) go back to the list, and no other chevron on the page does.
Scripts reads `[search] [New script]`. A page with no actions draws no `...`.

A window is a strip, a set of columns, and a pane. Each owns one thing.

**The strip** is one row on the chrome, with no line under it: the edge of the
content sheet closes it. It renders **outside** the grid, so no column resize,
hide animation or overlay can move it.

**The columns** are one grid at saved widths, clamped when read.

- **The left rail has one shape per window width, never a fold.** `AppShell`
  takes it as `leftRail`: its grid column is `auto`, so the rail's own width
  (64px, or 44px under a 1100px window) sizes it, with no resize handle and no
  saved width. It works at rail width because it holds places and two marks,
  not the list. The shell grid holds the rail and the page, nothing else.
- **No pane and no page folds the rail.** A session has no column of its own:
  its pages are the page tabs under the title.
- **The overlay slots sit inside the grid, not above it.** A studio is
  a page in the one main slot: it draws inside the content sheet, over the page
  it replaces (`AppShell`'s `studio`, `[data-studio-slot="content"]`), so the
  places rail stays live beside every studio, and the drawer parks under it. The
  slot is opaque (`bg-background`, `bg-chrome` for a studio that draws its own
  sheets), so the page never shows through while a studio fades in or out. The
  page under it stays mounted and inert. A studio never covers the top bar.

**The pane** is the work. It is the only surface that scrolls its own body,
mounts editors and takes a title.

**The Projects card of the session level shows which projects a session has
materialized.** It lives in the Context tab, not on the Overview, and always has
the Add action, even before the first mount. Each mounted project is a label
row that folds its worktrees, each worktree folds its main pages one more
indent in; a merged or closed worktree stays a row with its pull request
icon, never a "finished" fold. Sessions are created lazily on the workspace
([concepts.md](../concepts.md) → Lazy sessions), and this group is where a
session's footprint grows. What a worktree asks the user to decide shows in the
Overview notices slot ([mounts.md](../mounts.md#worktree-rows-and-the-overview-notices)).

## Top bar

The top bar says what is happening now. The column takes you to places.
Preferences live in Settings. Each item has one home; anything else that shows
it is a signal that links there. Every chip on the right opens the home of the
number it shows: Now ends on Monitoring, Usage opens the Providers menu and
from it a provider page in Connections, Spend opens Impact on its Spend tab. The bell
opens its own popover.

On macOS the window has no native title bar: the traffic lights sit inside the
top bar, and its left zone starts 72px in (`--titlebar-inset`, 0 in full
screen and on other systems).
The bar is a deep drag region: any spot that is not a control moves the window,
and a double click zooms it. Controls never drag.

The bar is one three-column grid, `minmax(0,1fr) auto minmax(max-content,1fr)`,
with each zone pinned to its own track (`col-start-1/2/3`), so an item that
drops never lets another zone slide into its column. When the right zone
outgrows its half, the command center slides off the midpoint instead of being
covered.

- Left: Sessions, then Repositories. The workspace mark lives at the top of the
  places rail, not in the bar. The bar holds
  no sidebar toggle: the places rail never folds. Sessions (`SessionsPopover`,
  ⌘B from any screen, `sessions.toggle`) opens a studio wide (500px) popover
  through the one placement rule: the 12px shell gutter from every window
  edge, the height capped at the room left, the list scrolling between a fixed
  search field and a fixed Open Board foot. Its groups are `sessionOrderOf`'s
  (Pinned, then by state; the Needs you number is `attentionCountOf`), typing
  filters by title or project, the arrows and Enter open a row, and the pin
  calls `pinSession` or `unpinSession`, which leave the row in place when the
  write fails. Each row says the state of its session: the status mark, the
  live line or the project, the count of what waits on you from the Queue's
  `needsYouOf`, and **Desk** when the session opens again on its Desk. So you
  move from one session to another without going through the Board.
  After an update from a build that had the sidebar list, a one-time card
  under the Sessions control (`SessionsCard`, 320px wide, the same placement
  rule) reads "Your sessions moved here" with **Show sessions**. It is not a
  dialog and blocks nothing. Opening Sessions in any way, the key included,
  closes it for good: the close is saved (`shell.sessionsCardClosed`) before
  the card goes, so a failed save keeps it and the next open retries. A fresh
  install never shows it (`store/slices/sessions-card/`).
- Centre: the movement cluster, then the command center. `Back` and `Forward`
  (24px icons) name their destination in the label and the tooltip
  (`Back: Comments`, the session on a second line, `Hold to show history` on a
  third, `⌘[`), sit at 40% with `Nothing to go back to` when the history is
  empty, and open the last 12 entries on right click or a 400ms hold. Board and
  Chat left the bar for the places rail. Board, the rail's first place, is pressed
  (`aria-current="page"`) on the board and does nothing; over a studio on the
  board it closes the studio; in a session it stays lit, since the session is
  its child, and a click on it goes to the board as a history entry, like ⌘⇧H
  and Open Board in Sessions (`ShellLeft`). Chat is a door to the `chat` studio on the
  chat you had open last in this workspace (`lastChatByWorkspace`, memory only,
  `selectChatDoor`), else the most recent chat by activity, else a new chat; after
  you press New chat (in the Chat page header on an open chat, `ChatHeader`, or
  ⌘⇧N) it opens a new one until you pick a chat again. The rail
  place, the top bar button and the palette entry share that rule. A chat with no message is one centred stage (the glyph, **Ask about {workspace}**, one sentence, the composer and up to three suggestions); the first message docks the composer at the bottom. Archiving or
  deleting the open chat lands on the next most recent one, not a blank page. Its
  row carries a running dot or a new-reply dot. The command
  center opens the palette and shows ⌘K; it never takes typing itself. In the palette,
  every search with text and no prefix starts with `Ask in Chat`, which opens
  a new chat with the query as its first message. Inside a session (the
  session or one of its agents in scope) `Ask about this session` comes first
  and `Ask in Chat` second (`askEntries`): it opens the Ask drawer and sends the
  query. A query that reads like a question (ends with `?` or has four words
  or more) has the first Ask row picked, a shorter one keeps the best match
  picked so Enter still jumps.
  Start session in a chat's Start work from chat panel creates the session and
  Add to session picks one; both then call `openStartRun` with the brief, which
  navigates to that session's Runs as a new history entry after the chat's own
  and fills the **Start a run** field (nothing starts until Start); Back returns
  to the same chat because `captureLocation` keeps `appStudio`.
- Right, in this order: the Now chip (running, scripts, each
  only when above zero, from `deriveSessionStage` through `useNowSessions`, so a running
  session that needs you is not counted as running; its dots are static, and its tooltip
  names the unit: "2 sessions running, 1 script running"; at zero one muted slot is drawn so the chips beside it never move: "Idle" with the neutral ring, or "Needs you" with the warning dot while a session waits on you), Usage,
  today's spend (hidden until the first cent today) and the bell (its unread count beside
  the icon, drawn like a door or tab count: one number, capped at 9+, in the quiet unread
  tone, or warning when an unread item carries an action). There is no storage chip:
  a control that appears when a threshold is crossed breaks the rule above,
  and "Free 7 GB" read as free disk, not what can go. The "N GB can go" line
  lives on the Storage row of the Settings rail. Now opens one popover grouped by those
  two, and a group with no rows is not drawn. The popover ends on **Open Monitoring**,
  the page that owns those counts. Sessions that need you are not in the
  bar, in the chip or in its panel: the Board door carries the count. Needs you counts three
  units, and each tooltip names its own: sessions ("2 sessions need you") on the Board
  door, the dock badge and Search or run; questions ("3 questions") on the
  Questions tab of the session; items ("4 items need you") on the Overview card and
  the Runs group. The bell is unchanged. A script row moves to its
  session and opens that run's output in the right drawer. A running session
  row opens the session hover card (facts only) after the pointer rests, the
  same card the sidebar shows. `Usage`: one chip per connected plan provider (Claude, Codex,
  Gemini, Cursor), in the provider order, with providers that report nothing
  last. The order never follows state. At rest a chip is its glyph and one bar of
  the provider's tighter window; the percent shows in tabular gray above 70%, `Out` with the
  reset day at 100%, a clock marks data older than 30 minutes or a window that
  reset since, and a dashed track means no data. The chip's fact card
  (`LimitsTooltip` around `limitsCardOf`) always carries every window as a row
  with its percentage and its reset, the free Codex resets as a row when Codex
  is out, and the update age in the footnote. A click on any chip, or
  on a provider under `+N`, opens the Providers menu anchored under the strip
  (`LimitsProvidersMenu` and its `ProvidersMenuPanel`, loaded on first open): the policy list, Connect for each CLI provider that is missing, and
  Manage providers. Usage stays in the chip tooltip and in Settings >
  Providers. Without a workspace a chip still opens that usage page.
  The strip is a toolbar: arrow keys move between chips. With no provider
  connected the strip is one `Connect a provider` chip that pulses and opens
  the same menu, and nothing shows while providers are still being detected.
  A bar in the chrome is always a provider window; money is always a figure.
  Then Spend: the figure with `today`, named `Spend
today. Open Impact`, opening the Impact studio on its Spend tab (it is never
  merged with a count). Impact itself is the last sidebar door, a page like
  Tasks with no band and no Close, and ⌘K reaches every tab. The bar holds no
  Impact icon. Last the bell, which opens the
  notification popover and stays pressed while the Notifications page is open.

The bar is an `@container/topbar` and degrades on its own width, never the
viewport, so app zoom takes the same path as a narrow window:

1. Below `chrome-wide` the command center narrows (its `Search or run` label
   shows from `chrome-labels` up; the workspace name lives in its tooltip) and
   Usage keeps two chips instead of four.
2. Below `chrome-labels` it becomes an icon with ⌘K, the signal words
   (`running`, `scripts`, `today`) drop and Usage keeps
   one chip. Counts, dots, glyphs and the spend figure stay, and their
   tooltips carry the words.

The traffic lights, identity, the movement cluster, the command center, the
spend figure, the first Usage chip and the bell
never hide. A Usage chip is
the provider glyph and one bar, the percent beside it only above 70%; every
window lives in its tooltip and its accessible name. A provider with no
figures yet draws no chip. The Usage chips past the ones that fit, and the
providers with no figures, are the only overflow: a `+N providers` chip (the
hidden provider glyphs first, like a Usage chip, then `+1 provider`, never a bare
number; with no chip shown it reads `Usage`) takes the
tone of the worst hidden provider and lists them. It stays visible at every bar width. No other control moves into an
overflow menu. `chrome-labels` sits below the 1024px minimum window, so words
only drop under zoom.

- Workspace identity opens an anchored popover that switches and creates
  workspaces. ⌘O opens that same popover, never a second one, and the palette
  lists workspaces as rows of its own. `Search workspaces` filters by
  workspace name and by folder path. The current workspace row carries its
  folder count (`folderCountLabel`, "3 projects"), **Add project** (the folder
  picker, a repository or a plain folder, then an undo toast) and **Manage
  folders**; the foot holds one **New workspace**, which closes the popover and
  opens the one form. The current workspace sits in its own
  `This window` row (a check mark and `Current`, plus the only gear icon into
  Workspace settings); every other workspace shows one verb, `Open`, that
  replaces the workspace in this window (`⌘Enter` always opens a new window
  instead, and a row already open elsewhere says `In another window`). Open
  replacing a window with agents running here asks first, inline under the
  row, never in a modal: the primary keeps them going in a new window, the
  ghost alternative stops them and opens here. A closed `Disconnected` group
  lists workspaces removed from disk, each with a small `Reconnect`. With no other workspace the popover draws no empty row under the current one; a search that finds none says `No other workspaces match`. Settings
  opens on its home; only Workspace settings lives behind this popover,
  so the bar holds no second settings control.
- **Identity is pinned and mounted once.** Workspace identity stays at the left
  of the top bar on the board, inside sessions, and under studios. Exactly one
  switcher is live, and ⌘O opens its single anchored popover.
- **Theme is not in the bar.** It is set once, so the strip keeps live status:
  Now, Limits, spend and the bell. Settings > This Mac > General > Appearance holds
  the three-way choice, and the palette answers to **Theme** with **Theme: dark**,
  **Theme: light** and **Theme: system**. Both call `switchTheme({ to })` in
  `shared/lib/theme.ts`, the only writer. The swap stays one paint
  (`theme-switch-is-one-paint`). No shortcut is bound to it.
- The top bar never edits. Reporting a bug, the update
  and the version are about Goodboy itself, so they live at the foot of the
  places rail, above the signature. The setup checklist is a card on the Board.

## The rail foot

The foot is the app's corner, the last places of the places rail, from the top:
Settings (⌘,), Report (⌘I), the Update mark while an update waits, and the
signature. Settings, Report and Update are rail items with their word under the
icon (`ShellRailItem`), and none goes to a page of the workspace. Report says
"Report a bug, draft saved" in its name, with the draft dot, while a report is
half written. Before a workspace exists the rail is only this foot.

The signature (`app/components/ShellLeft/RailSignature/index.tsx`) is a 24px `BrandTile`
on the rail axis, below the last item: tile `#0b0b0d`, white dog, radius 0.28 of the
side, mark 0.76, with no ring, plate, border, glow or gradient, never inverted and
the same in light and dark. It is passive, not a control: no button, no hover, no
focus, no tooltip, `aria-hidden`. It is not a door to Help: the Guide and What's
new open from Help in the menu bar and from Search or run, and no mark in the rail
is lit while a Help tab is open. The rail shows no version line: it is in the Update
card, in Settings and in What's new. At the 700px minimum window the foot fits with
the Update mark above the signature.

`useRailFootEffects` (`app/components/ShellLeft/useRailFootEffects`) keeps what the
logo used to carry: the restart when idle (`useRestartWhenIdle`), the anchor the
update card opens beside, and the onboarding re-read when a secondary window takes
focus.

With an update, the Update mark
(`features/updater/components/UpdateRailMark.tsx`) is one more item above the
signature, and never takes its place: one place and one shape, so no dot, no pill
and no version line beside it. It is a rail item with the word
**Update**, in `primary` on `primary-subtle`. `updateMarkOf`
(`features/updater/updateMark.ts`) gives it by state:

| State          | Mark                                                                     | Card                                         |
| -------------- | ------------------------------------------------------------------------ | -------------------------------------------- |
| None           | No mark, the signature alone                                             | None                                         |
| Available      | Arrow, word Update                                                       | Later, Update now                            |
| Downloading    | Arrow with a ring that fills, the word is the percent (`updateProgress`) | The bar fills, the button is busy            |
| Ready          | Arrow, with a `primary-edge` ring                                        | Later, Restart now                           |
| Agents running | Same as Ready                                                            | Later, Restart now, Restart when they finish |
| Queued         | Same as Ready                                                            | Later, Cancel restart, Restart now           |
| Failed         | Alert glyph, `danger` on `danger-subtle`                                 | Later, Retry (nothing changed on the Mac)    |

The mark breathes three times when it first appears (`animate-arrival-breath`, the
`soft-pulse` keyframes with three iterations, under `motion-safe`) and then holds
still; with reduced motion only the tint shows. A click on the mark opens or closes
the update card (`toggleUpdateCard`). The card opens to the right of the rail,
aligned with the foot, through `useDropdownDirection` (side `right`, align `end`),
12px inside every window edge. The card, its copy, the automatic arrival and the
snooze are unchanged (`UpdateArrivalCard`, `updateCardCopy`, `updateSnoozeGate`).
The new version is in the mark's tooltip and in Settings. The rail foot owns the
card and the restart when idle (`useRailFootEffects`). The workspace launcher, which
has no rail, shows the update as the `UpdatePill` pill.

Pair an iPhone lives in Settings, iPhone (`goodboy:open-pair-device` lands on
`{ scope: 'app', section: 'iphone' }`) and in the palette. Keyboard shortcuts
lives in Settings, Shortcuts (⌘/). Neither is in the foot. Every studio keeps a
door you can see: the flow table in
`__tests__/surfaces/navigation-flows` gives each row that reaches a studio a
`door` of `visible` or `palette`, and `studio-doors.test.ts` fails when a studio
kind has no `visible` row, the Guide and What's new excepted: their door is
`palette` (with Help in the menu bar). Three links open the Guide on a chapter and Back
returns to the page you were on: the session hover card's "What do these marks
mean?" (Legend), Impact's Spend tab "How cost is counted" (Tokens and cost) and
the Storage worktree row's "What is a worktree?" (Words). They share
`features/settings/openGuideChapter.ts`, and an id the Guide no longer has
(a renamed chapter keeps its old id as an alias in `resolveGuideChapter.ts`)
opens What is Goodboy, never an empty page. The Guide shows one chapter per
page on the `guideChapter` reader frame, with Previous and Next; the Help search
(`shared/components/RailSearch.tsx`) lists chapters and points, Enter
opens the first hit and flashes its point, Escape clears it. The chapter
"Listens" holds one table of prefixes (`PrefixTable`, read from
`quick-actions/grammar.ts`): `$` means Scripts in the palette and the composer. The chapter
"Rail, Sessions and session pages" restates this shell in `guideChapters.ts`, and
`guideChapters.test.ts` pins its names against `COLUMN_DOORS`, the page
registry and `NEW_DRAWER_FORMS`, and pins the word budget; the Legend draws its session marks through
`sessionNodeOf`, so a new mark appears there without a second table. The addresses live in
`shared/lib/productLinks.ts`. Report a bug opens the report sheet.

**Help** is one page (`app/components/HelpStudio`) with two tabs, Guide and
What's new, and one search (`RailSearch`, "Search help") over both: a result
opens its tab and its chapter or release. A tab is a studio kind, `guide` or
`changelog`, so switching tabs is a `switchStudio` between the two and the tab
you read is the history entry; the band title reads "Guide" or "What's new". The
page's one other control is "Sponsor on GitHub", which leaves the app
(`SponsorLink`): beside Back to app in the band, or, when Help takes the whole
window on Home, at the end of the title row beside Close, with no strip of its
own (`DetachedStudio`). The page's band holds `Back to app` with the Esc chip at the top
left and there is no Close (`close: 'back'`, `StudioFrame/index.test.tsx` pins
it). Help in the menu bar and the palette open it on the Guide, and the palette rows open either
tab. The What's new tab is a rail
of releases grouped by minor, with an Older group below 0.4 (`ChangelogRail`),
and a reader beside it. `CatchUpReader` (`page="whatsNew"`) opens first and sums
up everything since the version you last read; `ReleaseReader`
(`page="release"`) shows one release. A release that is the pending update
shows `UpdateActions`, the same verbs as the update card, and never a confirm of
its own.

## Menu bar

On macOS the app has seven menus: the Goodboy menu (About, Check for Updates,
Settings, Services, Hide, Quit), File (New Session, New Chat, New Terminal,
New Workspace, Close), Edit, View (sidebar, Search or Run, zoom, Reload, full
screen), Go (Back, Forward, then the destinations in the order of
`DESTINATIONS`: Board, Tasks, Workflows, Chat, Impact, Monitoring,
Notifications, then after a separator the two right rail tools, Show or Hide
Terminal and Browser, which open the dock), Window and Help (Guide, What's New,
Keyboard Shortcuts, Report a Bug). One table lays all of them out
(`SECTIONS` in `src-tauri/src/app_menu.rs`); a row is either a native item
(About, Quit, Undo, Cut, Copy, Paste, Select All, Full Screen, Minimize, Zoom)
or a command with an id, a title-case label and an optional combo. The native
menu bar follows the macOS convention and is not bound to five rows. Every menu
the app draws itself (a `⋯`, a header menu, a popover of actions) holds five
rows at most. `menu-row-budget.test.ts` reads each hand written menu source and
reports one line per file with its row count: literal rows, the choices of a
radio group, and rows mapped from a constant list. Two menus in one file add
up, which is stricter than the rule. A menu whose rows come from data (a picker
over projects, people or branches, or rows built by `toMenuEntries`) is named
in that test with its reason. The history menu of the back and forward arrows
is such a list: it shows the last twelve stops of the history stack, so it is
named there as a list and not as a menu of fixed rows. The registry menus are
measured state by state in
`overflowRows.test.ts` and `overflowRows.drawer.test.tsx`. Right click menus
mirror the action catalog and are not bound.

One rule runs the bar: a command row emits one event, `goodboy://menu` with
`{ id }`, to the focused window, and `useMenuCommands` is the one listener
(mounted by `useAppShortcuts`). `runMenuCommand` reads the id. A registry
shortcut id (`session.new`, `app.close`, `search.open`) replays its combo
through the dispatcher, so a scoped owner keeps its place; any other id runs
its `MENU_ACTIONS` entry (`menuActions.ts`: Check for Updates, New Terminal,
New Workspace, the Go doors, Guide, What's New). An id with neither warns once
and does nothing. A new menu item therefore adds a row to the table and an id,
never an event or a listener. Every Go page opens through `openDestination`,
the same call as the column and the palette; Browser opens the dock through
`toggleBrowserDock` (Show or Hide Browser, a toggle like the rail button), Terminal through its shortcut, and New Terminal adds
a tab in the dock, or on the Terminal page while it is open (`openWorkspaceTerminal` switches the page to the new tab). The doors that need a workspace do nothing without one. `openDestination` does nothing when the
destination is the page the column already shows as current (Tasks, Workflows,
Chat, Impact, Monitoring, Notifications), read from the same
`selectColumnPlace` as the column. A Go pick on the open page therefore adds no
history entry and keeps the scope of an open Impact page.
`menuBar.parity.test.ts` reads the Rust table and fails when an id has no
registry entry or action, a combo differs from the registry's, a label is not
title case, a key has two owners, or the Go rows differ from `DESTINATIONS` in
order or in name (the two dock tools read Show or Hide and their name).

## Report sheet

One sheet files every report. `ReportSheetHost`
(`features/bug-report/components/ReportSheetHost`) floats it at the bottom of
the window, centred, with no overlay: the page under it stays live. Every door
lands there: ⌘I from anywhere, Report in the places rail foot
(`app/components/ShellLeft/ReportBugButton.tsx`), Report a bug in the
palette (it also answers bug, issue, feedback, crash and broken),
**Help > Report a Bug** in the macOS menu bar (`app_menu.rs` emits
`goodboy://menu` with `report.open` to the focused window; `useMenuCommands`
replays the shortcut), and Report this error on a
warning or error notification, which attaches that notification. Opening the sheet reads the screen you are on
before anything moves, so Settings stays open under it.

- **One line is the title.** The cursor starts there. ⇥ or Add detail opens a
  longer field, ⌘↵ sends, Esc closes, and the line and the detail stay in the
  `bugReportDraft` slice until the report is sent.
- **Every attached part is a chip.** Version and build, system, screen, CLI
  versions, and the notification or the error when there is one. A chip's ×
  leaves it out; the dashed chip puts it back.
- **What gets sent** opens the exact text that leaves, with the count of
  redactions and the list of what never leaves.
- **The button says where it goes.** With GitHub connected it is Send, and
  the issue is filed through `gh` under your account; the toast links it.
  While you type, an open issue that matches shows above the chips with Add
  mine there, which comments instead of filing. Without GitHub it is Open on
  GitHub: a prefilled link, and when the report does not fit the link the full
  text goes to the clipboard first.
- **Crash and startup failure.** The crash screen shows the same sheet inline
  under the error, with the error and our stack frames attached and the line
  set to `Crash: <kind>`. The startup error screen opens it under the error
  with Report this error. Neither needs the store. The three titles (Report this crash, Report this error, Report this freeze) have one source, `NAMES`, read by the sheet, the notification row, the crash screen and the startup screen.
- **After a crash the app could not show.** An uncaught window error or a
  panic leaves `~/.goodboy/last-crash.json`. The next launch shows one
  persistent toast with when and where: Goodboy closed unexpectedly last time
  after a panic, Goodboy hit an error last time when the window kept running.
  Report it opens the sheet as Report this crash or Report this error with the
  error and the last action names attached, and Dismiss
  deletes the record. `LastCrashBridge` claims the record, so only one window
  shows it.
- **A frozen window.** Each window calls `window_heartbeat` every 5 seconds
  (`useWindowHeartbeat`, mounted by `LastCrashBridge`) and says whether it is
  visible. A Rust thread (`window_heartbeat.rs`, release builds only) checks
  every 2 seconds. A window that showed itself and has been silent for 30
  seconds is written once to the same `last-crash.json` as kind `freeze`
  ("The window stopped answering for 47 seconds"), unless the record already
  holds a report that was not shown yet. A window that is hidden, minimized or
  closed is never counted, and a gap in which the machine slept is not
  counted either: the thread notices that its own tick, or the wall clock
  against the monotonic clock, jumped, and starts every window's count again.
  When the beats come back the reply says so, and the window offers the saved
  report at once, with the toast "Goodboy stopped answering" and Report this
  freeze; if the app was closed while frozen, the next launch offers it. Nothing leaves
  the computer before you press Report it. On Windows the monotonic clock may
  keep counting through a sleep, so only the thread's own tick catches it.

First-run setup is a full-screen wizard in one shell that never moves: a header
with the lockup (a 22 px `BrandTile` and the word), a labelled three-step
stepper (Agents, Workspace, First session) and Set up later at the right; one 600 px
column whose title starts at the same line on every step; and the form actions
inline at the end of the step, owned by the step (Back and the primary,
right-aligned, no divider; Skip on First session only). Steps crossfade in one grid cell (240 ms, 80 ms of
opacity with reduced motion); the actions are disabled while they do. Escape
goes through the escape stack: an open inner layer closes first, else setup
goes back one step; on Agents and on the first step of a resume it does
nothing, and it never ends setup. Set up later writes `onboarding.wizard =
later`; entering a step writes `onboarding.step`. A relaunch with setup still
open reopens at that step (`resumeStep` falls back to Workspace when the step
needs a workspace that is gone), in the main window only, on Home (see Home
below); the palette offers Resume setup while it is
paused. Step bodies render through `WizardStepBody({ step, nav, wizard })`, and
`nav` (`WizardNav` in `wizardSteps.ts`) carries `goNext`, `goBack`, `goTo`,
`finish`, `later` and `setBusy`. There is no splash step: the first step is
Agents, headed "Welcome to Goodboy" with the one sentence and the trust line,
and agent detection starts there. The boot splash is the tile, the name, a 160 px
determinate bar and the phase word on that same backdrop. The bar moves one
sixth per real `bootPhase` write (`BOOT_PHASE_ORDER`, `bootProgressPercent`),
never on a timer, and jumps under reduced motion. Settings, agent credentials and
workspaces load together, so the phase word moves to the first of the three still
loading and never steps back. The app shows before its data: once the launch
knows which workspace it opens, `showLaunchShell` sets `isShellReady` with that
workspace current and `boardReady` false, and `App` mounts the real top bar, the
places rail, the Board (`BoardSkeleton` lanes) and the tool rail, so the palette
and the workspace switch already work. The cards replace their skeletons in the one commit
that sets `boardReady`; no session empty state ("No sessions yet", "Add a folder
first") draws before it (`empty-before-loaded.test.ts`). The last session then
opens in place and its parts swap from their own skeletons; the idle loads come
last. A launch with no workspace to open mounts the launcher or the setup on
`ready`, as before. A failed launch, before or after the shell shows, puts the
launch error screen back (`AppBootSplash`, on `bootPhase === 'error'`), and Retry
hides the shell until the next workspace is known. The `boot-shell` scenes show
the three states. `BootSplashExit` crossfades the splash out over 200 ms on
top of the shell (same `BootStage`, so the tile does not move); there is no fixed
wait, and reduced motion removes the splash at once. The window opens hidden and
`useRevealWindow` shows it after the first paint (Rust shows it after 3 s if the
page never does), so a light theme never flashes dark. Before React, `index.html`
paints the same chrome and tile in both themes, and the native window background
is the dark chrome `#0d0e10` (`boot-shell-paints-the-chrome.test.ts` pins both
to `styles.css`). Agents lists one row per sign-in CLI (Claude,
Codex, Cursor, Gemini) with its real state: Ready with version and account, Not
signed in with Sign in, Not installed with the exact install command and Run,
Can't start with the CLI's output and Check again. Rows check again on window
focus, when a sign-in or install terminal ends and on Check now, one agent at a
time (`useAgentDetection`, `probeAgent`); an answer for an older check of the same
agent is dropped. The ready count comes from `readyAgents()`; Continue needs one
ready agent and saves the default agent (`agents.default`), which the new
workspace takes as its default provider. API key providers sit behind Use an API
key instead. Workspace is `NewWorkspaceForm` in first-run mode. Tools holds Code
and Tasks on one step that is not numbered: First session reaches it from its
Connect Linear or Jira row (`goTo` tools), and Back, Continue and Escape return
to First session (`numberedStepOf` keeps First session current in the
stepper). The host the first repository pushes to leads, the others fold under
Other code hosts, and with no repository Code says why while Tasks still works.
Continue with nothing connected is the skip; every form binds to the workspace
the step opened for.
Sentry, Slack and the rest live in Settings › Integrations. There is no
permissions question: every workspace starts on Full access. First session is
one input card: three starters that name the folder, the agent, Scout reads
only and the model as pills, and Start, which starts a Scout session from a
draft (`startSessionFromDraft`); setup is done only once that resolves, and a
failure keeps the prompt and reads Retry. With a task source connected, Pick up
an issue lists assigned issues and Draft the brief opens the session draft with
that issue picked. The draft carries the first folder, so the session lands in
it. The setup card on the Board (`features/onboarding/SetupCard`, drawn on the
board and the empty board until setup is finished or hidden) has the stepper's three
rows, counted by `setupProgress()` in `features/onboarding/setupProgress.ts`, the one
function the card reads ("Setup · 2 of 3"). About you is not counted: it is suggested under Next
once the first session is done. While setup is open or paused a row resumes
setup at its step. The first session ticks when an agent finishes a turn, not
when a session row exists. Old checklist ids map to the three on hydrate
(`savedWizardStepOf`): a saved Tools step resumes at First session, a saved
Welcome step at Agents, and a stored tools entry counts for nothing.

## Auto in the shell

Auto is described in [auto.md](../auto.md); this is where it sits. Auto is always
on: Settings has no Auto switch, and the **Experimental** marker sits on the
Auto start of the New menu. An Auto conversation is a row of the one **Runs**
tab of the session. The tree of an Auto agent, and of each
child of an Auto tree, is the Agents column of the run page (see The Lead page
in auto.md), never a second rail beside the chat. The chat of an Auto agent gets its delegation lines and its
tail through the `insertions` prop of `ChatView` (`useAutoChat`). The
plan drawer swaps its toolbar for `AutoPlanToolbar` when the plan belongs to an
Auto tree, and the Overview timeline hides the children of a tree and draws its
state from `autoFactsByAgentId`.

## Column doors

Settings (the foot door and ⌘,) always opens the last settings page (General
at first), with or without a workspace; Workspace settings opens only from the
gear on the current-workspace row of the workspace popover. Impact is a
destination, so it is the quiet last place on the places rail (`isReference`), not
a top bar icon; it opens its Overview
tab, while the spend figure in the top bar and the `Impact: Spend` palette entry
open its Spend tab. The **Providers menu** is not a door to the Providers and
models page: it changes things in place (`app/components/ProvidersMenu`, opened
from the Limits strip). Connections is the one home for
providers and usage; the menu holds no usage figure and sends there with
**Manage providers** (a door). It lists the same `ProviderPolicyList` as the
Models row When a provider is out, writing through the same
`setProviderPolicy`, then Connect for each CLI provider that is not connected,
then Manage providers. It reads the cached providers and never refreshes them
on open. What's new is a tab of Help and a palette row, so it earns no
door here. The connected tools have no glyph strip any more: Tasks' Source
filter is the tool door, and Connect a tool lives in Connections.

- **The release notice answers "have you read the notes for what you're
  running"**, not "has a new release been published". After an update, one
  notice names the installed version and opens its notes. It works offline. A
  fresh install shows none, and dismissing it marks that version as read.
- Opening any studio closes the others. A door that is current does nothing.
- **Before any workspace exists, the places rail keeps its foot**: Settings,
  the bug and the Goodboy signature. New session and the places belong to a
  workspace and wait for one. Settings then opens its home with only the
  App and Providers groups, and Providers opens on an account instead
  of on the workspace defaults. Precedent: VS Code keeps its status bar and
  Manage gear with no folder open.

## Shortcuts

There is one registry with three modifier planes: bare ⌘ for the app, ⌘⇧ for
the session, ⌘⌥ for the lens surfaces. A fourth, `pane`, holds plain keys a
surface answers while it is on screen: the diff's J and K (next and previous
file), [ and ] (the same), H and L, V, N, F, and / or T (focus the file
filter). Nobody writes a combo string by hand
outside the registry. So no two surfaces can claim the same chord, and no
shortcut can exist without being documented. That holds for per-OS combos
too. An entry carries its own combo for other systems where the plain mapping
would collide, like the terminal's new tab: ⌘T on macOS, Ctrl+Shift+T
elsewhere, where Ctrl+T belongs to the shell. Report a bug (`report.open`) is
⌘I on macOS and Ctrl+Shift+I elsewhere, because Ctrl+I is Tab in a terminal;
it fires from anywhere, the terminal included. Ask (`ask.open`) is ⌘L on
macOS and Ctrl+Shift+L elsewhere, where Ctrl+L clears a terminal. Reload
(`view.reload`, ⌘R) reloads where you are: `reloadWhereYouAre` picks one
surface registered with `useReloadSurface`. A surface with a native view (the
Browser pane and page) wins while the window page has no focus, because the
keyboard is in its webview and the key reached the page through the menu bar.
Then the surface that holds the last click or focus wins, then the main
surface on screen (the session, or the Browser page); with none, nothing
happens. Reload Goodboy (`app.reload`, ⌘⇧R) is the only window reload.
The plane is for the dispatcher.
A plain key (no ⌘, Ctrl or Alt) yields on its own: the dispatcher skips it
while a field, a select or the terminal has focus, while a modal dialog is
open, and when something below already claimed the event. A surface registers
its plain keys with `useShortcut` and an enabled flag, never with its own
window listener.
Every entry also names the task `group` it belongs to (General, Workspaces,
Navigate, Session, Views, Lists, Comments, Changes, Window; ids stay `review` and
`diff`), and Settings > This Mac > Keyboard shortcuts lists the
groups in that order, read top to bottom per column. An entry that works only in
one place carries a `scope` (Tasks and Notifications lists, the Branch page,
the terminal, a chat composer, an activity row, a workspace
open, a code or an explore session). The page prints the place under the group
name when the whole group shares it, or under the row when it does not. A scope
also lets two surfaces use the same plain key: J, K, R, S and E mean other
things in a list than on the Comments tab, and the registry test only asks the combos to
be unique inside one scope and never to shadow a global one. Entries that share a
`family` (only the nine workspace digits today) render as one row, "Go to
workspace 1 to 9" with ⌘1-9, while the registry keeps one entry per chord. A
family is only for chords that do the same thing to a different index: the
integration digits (⌘⌥1 to ⌘⌥6) open different lenses and keep a row each.
Two chords that do the very same thing share one row instead (`SHARED_ROWS` in
`shortcutRows.ts`): Show or hide Terminal lists ⌃\` and ⌘⌥T side by side, and
each keeps its own Change and Reset.
A few entries are keys a focused control answers, not global chords: Submit
(⌘↵, `composer.submit`, the one id behind every composer, editor and the
workspace switcher; `isSubmitChord` reads it and keeps the lenient match that
accepts Ctrl as well as ⌘), the two message keys `PromptField` reads (↵
`composer.send` and ⇧↵ `composer.newLine`, see docs/turns.md → One composer) and Open the run of an activity row (⇧↵, the only combo
without ⌘). The list keys (`list.next`, `list.previous`, `list.open`,
`list.openInTool`, `list.reply`, `list.star`, `list.dismiss`, `list.search`) are
the same kind: `useListKeys` matches them against the registry, so the rail
hints, the Shortcuts page and the guide read the same entries. It keeps its own
window listener because Enter must yield to a focused button (a row button of
the list excepted). The Branch page's Select every fixable comment (⌘A,
`review.selectAll`) sits on the same footing, and the registry test lets it
use ⌘A because the Branch page only answers it outside a text field. The selection keys (`selection.toggle`, `selection.all`, `selection.clear`, `selection.delete`) are the same kind: `useSelectionKeys` matches the first, second and fourth against the registry, and `SelectionBar` answers Esc through the escape stack; the registry test lets `selection.all` use ⌘A because the hook yields to a text field. They sit in the registry so the list and the tooltips name them. Up one level (⌘↑, `nav.up`) carries `yieldsToText`, so the registry test lets it use a combo a text field owns. Back one crumb in a session (Esc, `nav.crumbUp`) is the last rung of the one Esc ladder (`escapeLadder`), named in the registry so the Shortcuts page and the head back button's tooltip show it; the scoped Esc keys (`overlay.close`, `selection.clear`, `agent.stop`) answer first, which the registry test allows by name.
The control that owns each one handles its own key event and never registers
it with the dispatcher; the activity row matches through `eventMatches`, and so
does ⇧F10 (`menu.open`), which opens the context menu of the focused row.
**A shortcut is taught where it
is used.** A control that has one shows it: as a pill on hover in dense rows,
and as a glyph in parentheses in tooltips. Where the row is too tight, the
tooltip is the only place it shows. Off macOS, typing wins over the lens
plane. An AltGr character, or a Ctrl+Alt combo typed into a field or the
terminal, never fires a shortcut.

**Esc never leaves full screen on macOS.** A full-screen window keeps its Space
when Esc goes unhandled: the web layer still gets every Escape keydown first, so
popovers, the palette, drawers, studios and inline edits close or cancel as
usual, and only the leftover key stops before AppKit. `useKeepFullScreenOnEscape`
arms a last window listener on every Escape keydown, after every in-app handler,
and prevents the default so WebKit never hands the key back to the window. As a
second layer the window class (`src-tauri/src/fullscreen_escape.rs`) replaces
`cancelOperation:`, `keyDown:` and `toggleFullScreen:`, keeping any original
implementation for other keys, and drops an Esc in full screen. Leave full
screen with the green button, View > Exit Full Screen or Ctrl+⌘F.

**A number that has not loaded is a skeleton, never 0.** The Browser tool count
in the rail (`selectBrowserTabCount` is `null` until the tab rows land), and the
agent count and cost in the session hover card (`useSessionSummary` returns
`null` and `isCountsLoading` until the phase runs and the telemetry are in the
store) draw a skeleton labelled Loading. The palette (`PaletteSkeleton`), a lazy
studio (`StudioSkeleton`) and the artifact viewer in the reading drawer
(`ArtifactSkeleton`) show their shape while their chunk loads. The router keeps
`fallback={null}` only around the onboarding wizard, which draws nothing when it
is not needed.
