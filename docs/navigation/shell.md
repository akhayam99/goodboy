# The shell

> **Read this when** you change the frame of the window: a context menu, a surface, the top bar, the column foot, the menu bar, the report sheet, the column doors or a shortcut. **Not for** spacing, scroll and overlay mechanics ([styling.md](../styling.md)) or design intent and tone ([DESIGN.md](../../DESIGN.md)). The other pages are listed in [navigation.md](../navigation.md).

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
  it, and Unlink, Move to and Take off this branch sit in its right click
  menu (Shift+F10), with no kebab and no hover control.
  Putting work on a branch is `Link work to this branch` (`mount.putTaskOnBranch`), on the
  Overview branch row and in the Projects tree row menu. Link work is the single entry
  for linking work to a session or workspace. Moving a task is one verb,
  `Move to`: in the linked row's menu (Shift+F10), in the focused issue's
  `Linked to` row and in the palette.
- **The sidebar session row.** Its right click (and Shift+F10) opens the
  session kind's menu, the full set of session verbs: Open, the lenses, Rename,
  Pin session or Unpin session, **Refresh session** (`session.refresh`, the
  same `refreshSession` the `⌘⇧R` shortcut runs, blocked while a refresh is in
  flight), Autopilot, Start a run, Link work, the copies, Archive and Delete,
  whose confirm still asks first. The palette lists the same verbs. The row is
  `select-none`, like every row that carries `ROW_HOVER` or `ROW_INTERACTIVE`
  (`SelectableRow`, `InteractiveRow`, `ListGridRow`, the Board card): see
  Where the webview menu stays.
- **One order.** The registry and right click list Open, Act, Copy, then
  lifecycle and destructive verbs, with a rule between groups. Menus and
  visible controls use the same definitions and availability rules.
- **No verb that does nothing.** A surface tells the registry what it shows
  through `env.viewing` (`useActionEnv`, `ObjectOverflowMenu` and
  `useObjectMenuTrigger` take `viewing`): the artifact viewer its artifact,
  the agent header its agent, the run page its run. Open, Open agent and Open
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
- **What each object offers.** A session: Open, Comments, Files, Open in terminal
  (one choice per worktree), Open in
  editor; Rename (inline, in the row that opened the menu), Turn on Autopilot or
  Turn off Autopilot (the session's autorun, the default of a run started
  without its own setting and of agents outside a workflow; the Runs page
  header has no switch), Start a run, Link
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
  Let Auto take it from here on an old standalone agent of a standard role,
  Detach from Auto on an agent that was moved, Change model (one submenu); copy the last reply
  and the name; Delete agent. A
  workflow run: Open run, View diff; Answer, Start run, Continue step, Restart
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
  Retry under the control. A button reads `pendingId` through
  `actionButtonStateOf` (busy, `pendingLabel` while it runs, disabled), and a
  run ignores a press while another run is in flight. An action that mutates
  defines `pendingLabel` and `doneLabel`; when it finishes `ActionStatusLine`
  shows the `doneLabel` sentence with a dismiss button until the next action,
  and a run that returns `'unchanged'` (a rebase that stopped or went to the
  history rewriter) shows no sentence. `kinds/mutationFeedback.test.ts` fails
  a new async diff or pull request action that lacks either word. `__tests__/actions/stateMatrix.test.ts` pins, per
  kind and per state, which verbs show, in which slot, and why a verb is
  blocked, and runs them on the real store; `kinds/*.matrix.test.ts` pins the
  same for the three UX5 kinds against the plan's state table.
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
  inside the window. Shift+F10 (`menu.open`) and the Menu key open it on the
  focused row, and Control-click is a right click. The arrows, Home and End
  move, typing jumps to the first match, Enter runs, ArrowRight opens the one
  submenu level, Escape closes and gives focus back. The row the menu acts on
  keeps a primary outline (`data-menu-open`) while the menu is open.
- **Selection, like Finder.** A right click on a row that is part of a
  multi-selection acts on the whole selection (the several sessions kind, and
  the several chats kind in the chat list). On an unselected row it clears the
  selection and acts on that row alone.
- **One selection bar.** The Board, the session list, the chat list, Review,
  Branches and the Storage lists share `SelectionBar` (`packages/ui`). The
  sidebar session rows and the Board cards draw no checkbox at all: a row is
  its optional ticket key, its title, then its state node at the right (the node
  never hides), and the selection is the modifier click (Shift for a range,
  Option, Command or Control to add or remove one), Shift+Enter, Alt+Enter and
  Alt+Space on the focused row, Shift+Arrow in the sidebar, X on the hovered or
  focused one, Command A, and **Select** in the row menu (`session.select`,
  shown only when the menu is opened from a row or card, through
  `viewing: { kind: 'selection' }`, and delivered to that row by
  `requestSelect` and `useSelectRequest` like Rename). The sidebar lists are
  listboxes (`aria-multiselectable`, each row an option with `aria-selected`,
  the rows of a list falling back to buttons with `aria-pressed` while a rename
  field sits in it, since a text field is not allowed in a listbox); a Board
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
  Delete script, Close branch, Remove from session, Abort rebase, Restore a
  backup). The Branch header's Merge asks "Merge #318 into main?" and Close
  asks "Close #318 without merging?" beside their buttons. Deleting a diff note
  acts at once with Undo, which posts the same note again; a pull request
  review draft asks in a popover. Remove
  from session and a storage worktree's Remove keep their detailed confirm (the
  removal plan, the forced remove) in their own menu. A reversible verb runs at once with an Undo toast (Archive, Delete on an artifact,
  Close agent, Unlink, Stop tracking, Take off this branch). The toast lasts
  about 10 seconds and Cmd+Z undoes the latest operation outside a text field.
  Reversible removals never ask for confirmation. Removing a commit on the Commits tab acts immediately with Undo.
- **Blocked verbs stay.** A verb that cannot run now stays in the menu, dimmed,
  with its reason under the label, and does nothing when chosen. A verb that
  does not apply to the state is not shown.
- **Where the webview menu stays.** Every object row answers right click with
  its object menu from `features/actions`, never the webview one. A row whose
  object has verbs elsewhere gets that object's kind and the same verbs: a
  changed file in the tree takes `diffFile` like the diff file header, a review
  or fix comment row `reviewComment`, a Context question card `question`, a
  check run `checkRun`, a decision change `decision`, a workspace in the
  switcher `workspace`, an issue to start from `issueCandidate`, and a central
  branch row the rail branch's `mount` target from `useMountMenuTarget` (one
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

**Shell layout.** One strip of chrome sits above, and under it one left column
plus main. There is no footer. **There is one app layout and every surface fills
its slots.** The board, the session and the studios do not define their own
frames. A surface that needs a different frame changes the shared one instead of
forking a second (`app/shellArrangement`, which every shell mount, the app and
the mock scenes alike, reads). **The column never changes; a session adds one
rail of its own.** The column is the workspace's navigation and looks the same
on every screen. Inside a session the session rail (see Session rail) sits at
the left of the page, inside the content sheet on the page background, and
holds the levels that drill (session, run, Auto). No other surface
adds a navigation column: filters or a list that belong to a page sit beside
the detail as a page rail. The right drawer is context, never navigation. The
right drawer holds reference material beside the page and closes with the pane
that opened it.

**The column** (`app/components/SideColumn/`) is on every screen with a
workspace, in the same shape everywhere: the toggle on the traffic-light axis,
the doors Board
(⌘⇧H), Tasks, Chat, Workflows and Terminal (⌃`) as one 28px row each (row icon and word in
`text-ui`, the sidebar's one row role; the shortcut in the tooltip, nothing appears on hover); Chat ends in a plus (`DoorCreateButton`, New chat, ⌘⇧N, always a
new chat, never the last one) and Terminal in a plus (New terminal in the workspace folder),
both always visible; one separator
(`h-px bg-border-soft`) with the same gap above and below; the Sessions list
(`SessionNavSidebar`), whose first row is New session (`NewSessionRow`, ⌘N, shaped like a
session row, selected while the draft is open, a primary dot and `Draft in progress` while a
draft waits) and whose group headers carry no top margin: the list's one gap (`listGap`, equal to the
doors' gap) spaces the groups; then at the foot Settings (⌘,), the Goodboy row
and a bug icon that opens the report sheet. Every door row has one trailing grid
(`ColumnDoorRow`): a 20px signal slot right aligned, then a 24px action slot reserved on every
row (the plus sits in it on Chat and Terminal). A running door draws no dot: what runs is in its
tooltip and accessible name, so unread (primary) and running never share a hue in one column; a
dot means attention without a number. Chat with none running shows a primary dot for a new reply.
The folded column draws the same marks, and its New session icon is as neutral as the open row.
Terminal counts the terminal tabs still alive, all owners, and Monitoring counts the pinned ports
and the ports Goodboy started that are in use; a pinned port that is down swaps Monitoring's count
for a warning dot and names the port (`Monitoring, pinned port :5173 is down`). The door's accessible name carries the fact (`Chat, unread`, `Terminal, 2 running`,
`Monitoring, 3 in use`), and all read the store (`useDoorSignals`). While the Monitoring page is closed,
`useMonitoringSignalRefresh` rescans only the pinned, learned and Goodboy-run ports every 30 seconds
(`monitor_snapshot` with a port list, merged into the snapshot), only while the window is visible and
the snapshot is older than 15 seconds, and never beside another scan. The collapsed rail shows a dot
(no number) on those two doors, with the fact in the tooltip. Before any workspace exists the column keeps only its app
half: Settings, the Goodboy row and the bug. The column is 240px by default and
resizes from 200 to 400 (`goodboy:left-sidebar-width:v3`, so an older saved
width resets once). Its first button or ⌘B folds it, on every screen, into the
rail; the choice is saved and peek never touches it. Settings is the one
exception: it opens at the column's width over a folded sidebar, and ⌘B waits
until Back to app (see Studios).

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
(**Review plan**, **Approve plan**, **Continue the run**, **Retry**, **Decide
next step**, **Start step 2**, **Start run**, **Restore**), else **Pause run**
or, once paused, **Resume run** in the same place (`RunLiveVerbs`, the
`workflowRun` registry's own `when`). The tail says the state and keeps only
its own step verbs. The `⋯` follows See, Steer, Settings, Copy, End: View
diff, Skip step N (and Pause or Resume run while the header holds another
primary), Step routing (orchestrated), Save as preset, Copy
run summary, **Stop run** (asks first), Archive run and Delete run, never
**Approve plan**. A failed Pause, Resume or Stop leaves the run as it was,
reports the error and keeps the word, so pressing it again is the retry.
The title is the only h1 of the page; the trail says `Session > Runs > Run`, the
Runs crumb or Esc goes back to the list, and no chevron on the page does.
Scripts reads `[search] [New script]`. A page with no actions draws no `...`.

A window is a strip, a set of columns, and a pane. Each owns one thing.

**The strip** is one row on the chrome, with no line under it: the edge of the
content sheet closes it. It renders **outside** the grid, so no column resize,
hide animation or overlay can move it.

**The columns** are one grid at saved widths, clamped when read.

- **A column has one reduced state, and it is never a narrower copy of
  itself.** The left column's one reduced state is the 44px rail
  (`ColumnRail`): on the workspace level the toggle, New, Sessions, Tasks, Workflows, Chat and Terminal as icons
  with their names and shortcuts in tooltips, then the open session and the
  pinned sessions as 28px node buttons (see the rail paragraph below; a pin that
  does not own the flyout opens the facts-only session hover card after a
  500 ms rest, not a one line label), then
  Settings, the bug and the Goodboy mark at the bottom. It works at rail width
  because it holds doors and a few marks, not the list; the sessions list comes
  back through the peek. The session rail has the same one reduced state: its
  own toggle folds it to a 44px strip of the current level's icons
  (`SessionRailIcons`), remembered apart from the column
  (`goodboy:session-rail-collapsed:v1`). Hiding a column
  outright sets it and its handle to zero width and marks the aside `inert`: a
  zero-width column that still takes focus is a keyboard trap. The shell
  primitive can lay out more reduced states than the product uses. Which one a
  column gets is decided here, not by what the primitive offers. Folding and
  unfolding either column is one move that keeps every icon in place
  (`FoldLayers`, [styling.md](../styling.md#the-window-grid)): the width eases, the
  words fade, and the 44px rail's icons sit on the open rows' lines.
- **The main sidebar never folds by itself; a pane folds by its tier.** Only
  its toggle folds the column: the one toggle sits in the top bar, left of Back
  and Forward (`ColumnToggleButton` in `AppTopBar`, ⌘B), and no pane and no
  window width folds it. `shellFoldsOf` (read through `useShellFolds`) reads the
  open pane's tier: a reader tier pane (720: a file, a diff, a document, New)
  folds the session rail to its 44px icons while it is open; a side tier pane
  (416: Explore, Context, Ask, Agents, Scripts, Terminal and the transcripts
  Agents opens) folds nothing. The saved
  choices are untouched, and the rail toggle opens a rail folded this way for
  as long as the pane stays open. The session rail keeps its own toggle at the
  left of its top row.
- **The overlay slots sit inside the grid, not above it.** The peek spans the
  work row, so it can hover over main without taking layout space. The studio
  slot covers the content area only (`studioCoversLeft={false}`), as its own
  sheet, so the column stays live beside every studio; the peek is drawn after
  it, so a peeked column floats over a studio too. A studio never covers the
  top bar.

**The pane** is the work. It is the only surface that scrolls its own body,
mounts editors and takes a title.

**The Projects card of the session level shows which projects a session has
materialized.** It lives in the session rail, not on the Overview, and always has
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
it is a signal that links there.

On macOS the window has no native title bar: the traffic lights sit inside the
top bar, which carries a 78px inset (12px in full screen and on other systems).
The bar is a deep drag region: any spot that is not a control moves the window,
and a double click zooms it. Controls never drag.

The bar is one three-column grid, `minmax(0,1fr) auto minmax(max-content,1fr)`,
with each zone pinned to its own track (`col-start-1/2/3`), so an item that
drops never lets another zone slide into its column. When the right zone
outgrows its half, the command center slides off the midpoint instead of being
covered.

- Left: workspace identity. It has a 200px limit and truncates, with the full
  name in its tooltip. The sidebar toggle lives in the column, not here.
- Centre: the movement cluster, then the command center. `Back` and `Forward`
  (24px icons) name their destination in the tooltip (`Back to Comments`,
  the session on a second line, `⌘[`), sit at 40% with `Nothing to go back to` when the history is
  empty, and open the last 12 entries on right click or a 400ms hold. Board and
  Chat left the bar for the column. Board, the column's first door, is pressed
  (`aria-current="page"`) on the board and does nothing; over a studio on the
  board it closes the studio; in a session it navigates to the board as a
  history entry. ⌘⇧H does the same. Chat is a door to the `chat` studio on the
  chat you had open last in this workspace (`lastChatByWorkspace`, memory only,
  `selectChatDoor`), else the most recent chat by activity, else a new chat; after
  you press New chat it opens a new one until you pick a chat again. The column
  door, the top bar button and the palette entry share that rule. A chat with no message is one centred stage (the glyph, **Ask about {workspace}**, one sentence, the composer and up to three suggestions); the first message docks the composer at the bottom. Archiving or
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
- Left of Back and Forward: the main sidebar toggle (`ColumnToggleButton`, ⌘B), the one
  toggle of the column; the column itself has no toggle row.
- Right, in this order: the Now chip (running, scripts, each
  only when above zero, from `deriveSessionStage` through `useNowSessions`, so a running
  session that needs you is not counted as running; its dots are static, and its tooltip
  names the unit: "2 sessions running, 1 script running"), Limits,
  today's spend (hidden until the first cent today) and the bell (a 6px dot at its corner,
  primary when unread, warning when an unread item carries an action; the count is the Unread
  tab badge in its popover). There is no storage chip:
  a control that appears when a threshold is crossed breaks the rule above,
  and "Free 7 GB" read as free disk, not what can go. The "N GB can go" line
  lives on the Storage row of the Settings rail. Now opens one popover grouped by those
  two, and a group with no rows is not drawn. Sessions that need you are not in
  the bar: the Sessions door of the column carries their warning dot. A script row moves to its
  session and opens that run's output in the right drawer. A running session
  row opens the session hover card (facts only) after the pointer rests, the
  same card the sidebar shows. `Limits`: one chip per connected plan provider (Claude, Codex,
  Gemini, Cursor), in the provider order, with providers that report nothing
  last. The order never follows state. At rest a chip is its glyph and one bar of
  the provider's tighter window; the percent shows in tabular gray above 70%, `Out` with the
  reset day at 100%, a clock marks data older than 30 minutes or a window that
  reset since, and a dashed track means no data. The chip's fact card
  (`LimitsTooltip` around `limitsCardOf`) always carries every window as a row
  with its percentage and its reset, the free Codex resets as a row when Codex
  is out, and the update age in the footnote. A click on any chip, or
  on a provider under `+N`, opens the Providers menu anchored under the strip
  (`LimitsProvidersMenu` and its `ProvidersMenuPanel`): the policy list, Connect for each CLI provider that is missing, and
  Manage providers. Usage stays in the chip tooltip and in Settings >
  Providers and models. Without a workspace a chip still opens that usage page.
  The strip is a toolbar: arrow keys move between chips. With no provider
  connected the strip is one `Connect a provider` chip that pulses and opens
  the same menu, and nothing shows while providers are still being detected.
  A bar in the chrome is always a provider window; money is always a figure.
  Then Spend: the figure with `today`, named `Spend
today. Open Impact`, opening the Impact studio on its Spend tab (it is never
  merged with a count). Impact itself is the last sidebar door, a page like
  Tasks with no band and no Close, and ⌘K reaches every tab. The bar holds no
  Impact icon. Last the bell, which opens the
  notification popover.

The bar is an `@container/topbar` and degrades on its own width, never the
viewport, so app zoom takes the same path as a narrow window:

1. Below `chrome-wide` the command center narrows (its label is `Search`
   at every width; the workspace name lives in its tooltip) and
   Limits keeps two chips instead of four.
2. Below `chrome-labels` it becomes an icon with ⌘K, the signal words
   (`running`, `scripts`, `today`) drop and Limits keeps
   one chip. Counts, dots, glyphs and the spend figure stay, and their
   tooltips carry the words.

The traffic lights, identity, the movement cluster, the command center, the
spend figure, the first Limits chip and the bell
never hide. A Limits chip is
the provider glyph and one bar, the percent beside it only above 70%; every
window lives in its tooltip and its accessible name. A provider with no
figures yet draws no chip. The Limits chips past the ones that fit, and the
providers with no figures, are the only overflow: a `+N providers` chip (`+1
provider`, never a bare number; with no chip shown it reads `Limits`) takes the
tone of the worst hidden provider and lists them. It stays visible at every bar width. No other control moves into an
overflow menu. `chrome-labels` sits below the 1024px minimum window, so words
only drop under zoom.

- Workspace identity opens an anchored popover that switches and creates
  workspaces. ⌘O opens that same popover, never a second one, and the palette
  lists workspaces as rows of its own. `Find a workspace or folder` filters by
  workspace name and by folder path. The current workspace row carries its
  folder count (`folderCountLabel`, "3 folders"), **Add folder** (the folder
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
  Now, Limits, spend and the bell. Settings > App > General > Appearance holds
  the three-way choice, and the palette answers to **Theme** with **Theme: dark**,
  **Theme: light** and **Theme: system**. Both call `switchTheme({ to })` in
  `shared/lib/theme.ts`, the only writer. The swap stays one paint
  (`theme-switch-is-one-paint`). No shortcut is bound to it.
- The top bar never edits. Reporting a bug, the setup checklist, the update
  and the version are about Goodboy itself, so they live at the foot of the
  column: the Goodboy row and the bug icon beside it.

## The column foot

Settings (⌘,) sits above the Goodboy row; the bug icon sits right of the row
and opens the report sheet (⌘I), nothing else. On the rail the three keep their
place at the bottom: the Settings icon, the bug and the Goodboy mark, which
carries a dot while an update or setup waits.

The Goodboy row (`app/components/GoodboyChip`, variants `column` and `rail`) holds everything about Goodboy itself, the way the Apple
menu or Linear's help menu does. Its label says one thing, in this order: an
update is pending (the bare lockup, then the version pill), setup is unfinished
(with its progress), or the brand lockup with the installed version. The lockup
(`GoodboyChip/BrandLockup.tsx`) is one dark chip holding only the dog mark and
"Goodboy", the same in light and dark; "Beta" and "v<version>" sit after it in
theme text. The popover header and the rail mark draw the same lockup. The version is
`APP_VERSION` (`shared/lib/appVersion.ts`), which the build stamps from
`apps/desktop/package.json` as `__APP_VERSION__`, so it never waits on Tauri
and shows in mock scenes too. The update pill (`features/updater/components/UpdatePill`)
is soft, enters once and holds still. It is its own button beside the lockup and
shows only the new version and a state icon; the state ("is ready", "did not
install") lives in its tooltip and accessible name. It stays on one line at
every column width: when the lockup and the pill have under 168px, the lockup
drops to the dog mark (a container query on the row), and only a version too
long for the row truncates.
`validate-scenes.mjs --only update-pill` pins this at 200, 240 and 400px. The
pill opens the update card; the column menu holds no update. On the rail, which
has no room for a pill, the menu's first row is the same pill label and opens
the same card (`railUpdate` in `GoodboyChip/index.tsx`). The popover header is the
lockup and "<version> · Beta", and the version opens What's new. Below it sit the
setup checklist while setup is unfinished, then two labelled groups on the shared
`MenuList` rows of `@goodboy/ui`: **Help** (Guide, What's new, Keyboard shortcuts
with ⌘/, Report a bug last with ⌘I, and Draft saved when a draft waits) and
**Goodboy** (`NAMES.pairIphone`, Sponsor on GitHub and Follow on X, the last two
with the external mark). There is no paragraph under the groups. Guide opens the
guide studio and Pair an iPhone opens Settings on its iPhone page (`goodboy:open-pair-device` lands on
`{ scope: 'app', section: 'iphone' }`), so neither waits behind the palette. Every
studio keeps a door you can see: the flow table in
`__tests__/surfaces/navigation-flows` gives each row that reaches a studio a
`door` of `visible` or `palette`, and `studio-doors.test.ts` fails when a studio
kind has no `visible` row. Three links open the Guide on a chapter and Back
returns to the page you were on: the session hover card's "What do these marks
mean?" (Legend), Impact's Spend tab "How cost is counted" (Tokens and cost) and
the Storage worktree row's "What is a worktree?" (Words). They share
`features/settings/openGuideChapter.ts`, and an id the Guide no longer has
(a renamed chapter keeps its old id as an alias in `resolveGuideChapter.ts`)
opens What is Goodboy, never an empty page. The Guide shows one chapter per
page on the `guideChapter` reader frame, with Previous and Next; its rail
search (`shared/components/RailSearch.tsx`) lists chapters and points, Enter
opens the first hit and flashes its point, Escape clears it. The chapter
"Sidebar and session rail" restates this shell in `guideChapters.ts`, and
`guideChapters.test.ts` pins its names against `COLUMN_DOORS`, the page
registry and `NEW_DRAWER_FORMS`, and pins the word budget; the Legend draws its session marks through
`sessionNodeOf`, so a new mark appears there without a second table. The addresses live in
`shared/lib/productLinks.ts`. Report a bug closes the
popover and opens the report sheet. The popover opens by itself once, when the
first agent finishes a turn, and never while the setup wizard is open; the
checklist has no floating card. Only the pinned row does that (and reports the
update arrival); the copy inside a peeked column is quiet.

**What's new** is the changelog studio (`ChangelogStudio`): a rail of releases
grouped by minor, with an Older group below 0.4 (`ChangelogRail`, filtered by
`RailSearch`), and a reader beside it. `CatchUpReader` (`page="whatsNew"`)
opens first and sums up everything since the version you last read;
`ReleaseReader` (`page="release"`) shows one release. Close is the last action
of the reader's title row (`close: 'header'`), and only when no page header
renders does the studio fall back to a Close in its band
(`StudioFrame/index.test.tsx` pins both). A release that is the pending update
shows `UpdateActions`, the same verbs as the update card, and never a confirm of
its own.

## Menu bar

On macOS the app has seven menus: the Goodboy menu (About, Check for Updates,
Settings, Services, Hide, Quit), File (New Session, New Chat, New Terminal,
New Workspace, Close), Edit, View (sidebar, Command Palette, zoom, Reload, full
screen), Go (Back, Forward, Sessions, Tasks, Chat, Workflows, Terminal,
Impact, Notifications, Monitoring), Window and Help (Guide, What's New,
Keyboard Shortcuts, Report a Bug). One table lays all of them out
(`SECTIONS` in `src-tauri/src/app_menu.rs`); a row is either a native item
(About, Quit, Undo, Cut, Copy, Paste, Select All, Full Screen, Minimize, Zoom)
or a command with an id, a title-case label and an optional combo.

One rule runs the bar: a command row emits one event, `goodboy://menu` with
`{ id }`, to the focused window, and `useMenuCommands` is the one listener
(mounted by `useAppShortcuts`). `runMenuCommand` reads the id. A registry
shortcut id (`session.new`, `app.close`, `search.open`) replays its combo
through the dispatcher, so a scoped owner keeps its place; any other id runs
its `MENU_ACTIONS` entry (`menuActions.ts`: Check for Updates, New Terminal,
New Workspace, the Go doors, Guide, What's New). An id with neither warns once
and does nothing. A new menu item therefore adds a row to the table and an id,
never an event or a listener. The menu labels the registry's Board as
Sessions (`session.board`), and the Go doors that need a workspace do nothing
without one. `menuBar.parity.test.ts` reads the Rust table and fails when an id
has no registry entry or action, a combo differs from the registry's, a label
is not title case, or a key has two owners.

## Report sheet

One sheet files every report. `ReportSheetHost`
(`features/bug-report/components/ReportSheetHost`) floats it at the bottom of
the window, centred, with no overlay: the page under it stays live. Every door
lands there: ⌘I from anywhere, the bug icon at the column foot, Report a bug in
the Goodboy menu, Report a bug in the
palette (it also answers bug, issue, feedback, crash and broken),
**Help > Report a Bug** in the macOS menu bar (`app_menu.rs` emits
`goodboy://menu` with `report.open` to the focused window; `useMenuCommands`
replays the shortcut), and Report this on a
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
  with Report this. Neither needs the store.
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
with the lockup (a 22 px `BrandTile` and the word, absent on Welcome, where the
hero is the lockup), a labelled four-step stepper (Agents, Workspace, Tools
marked Optional, First session) and Set up later at the right; one 600 px
column whose title starts at the same line on every step; and the form actions
inline at the end of the step, owned by the step (Back and the primary,
right-aligned, no divider; Skip on First session only). Steps crossfade in one grid cell (240 ms, 80 ms of
opacity with reduced motion); the actions are disabled while they do. Escape
goes through the escape stack: an open inner layer closes first, else setup
goes back one step; on Welcome and on the first step of a resume it does
nothing, and it never ends setup. Set up later writes `onboarding.wizard =
later`; entering a step writes `onboarding.step`. A relaunch with setup still
open reopens at that step (`resumeStep` falls back to Workspace when the step
needs a workspace that is gone), in the main window only, on Home (see Home
below); the Goodboy menu offers Resume setup while it is
paused. Step bodies render through `WizardStepBody({ step, nav, wizard })`, and
`nav` (`WizardNav` in `wizardSteps.ts`) carries `goNext`, `goBack`, `goTo`,
`finish`, `later` and `setBusy`. Welcome is the cover: the boot splash's 84 px
black tile stays on its pixel with no morph (`useSplashAnchor` puts the tile's
centre `SPLASH_TILE_CENTER_ABOVE_MIDDLE_PX` above the window middle, the spot
`BootSplash` draws it), the splash name fades out, the 6% cover backdrop
(`bg-backdrop-cover`, `--app-backdrop-cover-strength`) shows behind it, and
agent detection starts there. The boot splash is the tile, the name, a 160 px
determinate bar and the phase word on that same backdrop. The bar moves one
sixth per real `bootPhase` write (`BOOT_PHASE_ORDER`, `bootProgressPercent`),
never on a timer, and jumps under reduced motion. On `ready` the bar fills for
200 ms, then `App` mounts the app or Welcome underneath and `BootSplashExit`
crossfades the splash out over 200 ms on top of it (same `BootStage`, so the tile
does not move); reduced motion skips both waits. The window opens hidden and
`useRevealWindow` shows it after the first paint (Rust shows it after 3 s if the
page never does), so a light theme never flashes dark. Before React, `index.html`
paints the same chrome, 6% backdrop and tile in both themes, and the native
window background is the dark chrome `#0e1012`
(`boot-shell-paints-the-chrome.test.ts` pins both to `styles.css`). The sidebar
and app shell stay at 3%. Agents lists one row per sign-in CLI (Claude,
Codex, Cursor, Gemini) with its real state: Ready with version and account, Not
signed in with Sign in, Not installed with the exact install command and Run,
Can't start with the CLI's output and Check again. Rows check again on window
focus, when a sign-in or install terminal ends and on Check now, one agent at a
time (`useAgentDetection`, `probeAgent`); an answer for an older check of the same
agent is dropped. The ready count comes from `readyAgents()`; Continue needs one
ready agent and saves the default agent (`agents.default`), which the new
workspace takes as its default provider. API key providers sit behind Use an API
key instead. Workspace is `NewWorkspaceForm` in first-run mode. Tools holds Code
and Tasks on one step and never leaves the stepper: the host the first
repository pushes to leads, the others fold under Other code hosts, and with no
repository Code says why while Tasks still works. Continue with nothing
connected is the skip; every form binds to the workspace the step opened for.
Sentry, Slack and the rest live in Settings › Integrations. There is no
permissions question: every workspace starts on Full access. First session is
one input card: three starters that name the folder, the agent, Scout reads
only and the model as pills, and Start, which starts a Scout session from a
draft (`startSessionFromDraft`); setup is done only once that resolves, and a
failure keeps the prompt and reads Retry. With a task source connected, Pick up
an issue lists assigned issues and Draft the brief opens the session draft with
that issue picked. The draft carries the first folder, so the session lands in
it. The checklist in the
Goodboy menu has the stepper's four rows, counted by `setupProgress()` in
`features/onboarding/setupProgress.ts`, the one function the chip and the menu
read ("Setup · 2 of 4"). About you is not counted: it is suggested under Next
once the first session is done. While setup is open or paused a row resumes
setup at its step; once setup is done Tools reopens its own step. Tools ticks
when the user moves past it or connects a code host or task source, and the
first session ticks when an agent finishes a turn, not when a session row
exists. Old checklist ids map to the four on hydrate.

## Auto in the shell

Auto is described in [auto.md](../auto.md); this is where it sits. Auto is always
on: Settings has no Auto switch, and the **Experimental** marker sits on the
Auto start of the New menu. An Auto conversation is a row of the one **Runs**
entry of the session rail. The tree of an Auto agent, and of each
child of an Auto tree, is the Agents panel of the session tools (see The session
tools), never a second rail beside the chat. The chat of an Auto agent gets its delegation lines and its
tail through the `insertions` prop of `ChatView` (`useAutoChat`). The
plan drawer swaps its toolbar for `AutoPlanToolbar` when the plan belongs to an
Auto tree, and the Overview timeline hides the children of a tree and draws its
state from `autoFactsByAgentId`.

## Column doors

Settings (the foot door and ⌘,) always opens the last settings page (General
at first), with or without a workspace; Workspace settings opens only from the
gear on the current-workspace row of the workspace popover. Impact is a
destination, so it has a door, the icon beside the bell; it opens its Overview
tab, while the spend figure in the top bar and the `Impact: Spend` palette entry
open its Spend tab. The **Providers menu** is not a door to the Providers and
models page: it changes things in place (`app/components/ProvidersMenu`, opened
from the Limits strip). Settings > Providers and models is the one home for
providers and usage; the menu holds no usage figure and sends there with
**Manage providers** (a door). It lists the same `ProviderPolicyList` as the
Models row When a provider is out, writing through the same
`setProviderPolicy`, then Connect for each CLI provider that is not connected,
then Manage providers. It reads the cached providers and never refreshes them
on open. Changelog opens from the Goodboy menu and the palette, so it earns no
door. The connected tools have no glyph strip any more: Tasks' Source
filter is the tool door, and Connect a tool lives in Settings > Integrations.

- **The release notice answers "have you read the notes for what you're
  running"**, not "has a new release been published". After an update, one
  notice names the installed version and opens its notes. It works offline. A
  fresh install shows none, and dismissing it marks that version as read.
- Opening any studio closes the others. A door that is current does nothing.
- **Before any workspace exists, the column keeps its app half**: Settings,
  the Goodboy row and the bug. New session, the doors and the sessions belong
  to a workspace and wait for one. Settings then opens its home with only the
  App and Providers and models groups, and Providers opens on an account instead
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
macOS and Ctrl+Shift+L elsewhere, where Ctrl+L clears a terminal. Refresh session
(`session.refresh`, ⌘⇧R) sits on the session plane beside Archive (⌘⇧A) and
Delete (⌘⇧⌫), because it acts on the open session; ⌘R stays the app reload.
The plane is for the dispatcher.
A plain key (no ⌘, Ctrl or Alt) yields on its own: the dispatcher skips it
while a field, a select or the terminal has focus, while a modal dialog is
open, and when something below already claimed the event. A surface registers
its plain keys with `useShortcut` and an enabled flag, never with its own
window listener.
Every entry also names the task `group` it belongs to (General, Workspaces,
Navigate, Session, Views, Lists, Comments, Files, Window; ids stay `review` and
`diff`), and Settings > App > Keyboard shortcuts lists the
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
use ⌘A because the Branch page only answers it outside a text field. The selection keys (`selection.toggle`, `selection.all`, `selection.clear`, `selection.delete`) are the same kind: `useSelectionKeys` matches the first, second and fourth against the registry, and `SelectionBar` answers Esc through the escape stack; the registry test lets `selection.all` use ⌘A because the hook yields to a text field. They sit in the registry so the list and the tooltips name them. Up one level (⌘↑, `nav.up`) carries `yieldsToText`, so the registry test lets it use a combo a text field owns.
The control that owns each one handles its own key event and never registers
it with the dispatcher; the activity row matches through `eventMatches`, and so
does Shift+F10 (`menu.open`), which opens the context menu of the focused row.
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
