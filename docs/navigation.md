# Navigation and information architecture

> **Read this when** deciding what surface exists and where it lives: pane,
> column, strip, breadcrumb. **Not for** spacing/scroll/overlay
> mechanics (`docs/styling.md`) or design intent and tone (`DESIGN.md`).

## The model

- **The board is home. Chat is a destination.** Open a workspace with no
  session selected and main shows a board of every session, grouped by stage
  (needs you / running / in review / building / done). You reach chat, diff,
  terminal and open-in-IDE from the cards. You never land on them. Every
  capability stays one step away.
- **The board frame.** The header has the pane title grade (`Board` alone, no
  total: each column carries its own count), with its actions on the right.
  The Ongoing row shows only while the workspace tracks a task. Header and columns sit in one
  centred frame with a maximum width, so a wide or zoomed-out window never
  stretches the board. Every column has one fixed width, and the board scrolls
  sideways when they do not fit. Empty columns show their header and one line naming
  what is missing. Done and Archived fold into a dock at the end of the board: one icon
  per column with its count, widening to name them on hover or focus. A click
  opens the column just before the dock, and its header button folds it back.
  The dock stays pinned to the right edge while the board scrolls, and the
  folded state is remembered per workspace, both folded by default. Folding
  Archived clears its selection; folding Done keeps it. Cards have one fixed height: a goal of up
  to two lines (the full goal in the tooltip) is the card's one button, and the
  lifecycle menu and the cost show next to the quick actions on hover or focus. Restoring
  an archived card uses the `restore` glyph.
- **An archived session is read-only until Restore.** Its overview shows an
  Archived chip with an inline Restore. The composer, new agents, workflows and
  project mounts stay disabled with "Restore this session to continue". Nothing
  restores on its own, so a shelved session never spends by itself.
- **Three surfaces, three jobs, no competition.** The top bar is now ("what is
  happening, where am I and what is it costing"). The left column is access and
  presence ("where do I go, what else is going on"): its doors and the sessions
  list. The ⌘K palette is transit ("where do I want to be"). There is no footer.
- **The top bar carries state, identity and movement.** Movement is Back,
  Forward and Search, clustered in the centre. It never holds a destination
  again, with one exception: Impact is an icon door beside the bell, because it
  reads like a figure, not a place you work in. The spend chip is state that
  opens the studio that owns that number, on Impact's Spend tab, and the Limits
  chips open the Providers menu. The bar never edits a record in place.
- **The column holds every door.** Board, Inbox, Chat and Workflows sit under
  New session, the Sessions list follows, Settings and the Goodboy row sit at
  the foot. Board is home and the first door (⌘⇧H). The column is on every
  screen with a workspace: the board, a session, the draft and every studio but
  Settings, which swaps the column's content (see Studios).
- **One home per thing.** Say a thing must exist in state A and can exist in
  state B. It lives where it must, and B gets no second copy. Workspace identity
  is always pinned at the left of the top bar. Neither the column nor a studio
  header shows the workspace name again. A studio subtitle is a one-line
  purpose or the installed version, never the workspace.
- **Pin the structure, flex the density.** A control keeps a fixed position so
  people can learn it. No control appears or disappears when a count crosses a
  threshold. The counts themselves may: a chip that reads zero is noise, not
  structure. Information may be conditional, a control may not: a control that
  does not apply stays visible and disabled, with the reason beside it. There are two exceptions. Integration groups sit in a row, so
  connecting one shifts the controls to its right. Their order is fixed, not
  their exact position. The update control comes and goes with a pending update,
  because an update is an event, not a count.
- **Hidden is not gone.** Anything the user can put away must come back without
  a hunt. ⌘B folds the column into its rail of doors, which keeps every
  destination; the full column, sessions included, peeks back when the pointer
  rests at the window edge. Peek floats the one column over the page instead of
  laying it out.
- **Navigation chrome is neutral at rest.** Selection shows as a muted fill,
  never an inversion. The app has no inverted navigation control. New session
  is the only emphasised column control. Doors, Board included, are neutral at
  rest, and so is the column's Goodboy row, with one exception: a downloaded
  update tints the row into a pill until you act on it. A ready update is an
  event, not a rest state.
- **Settings match the scope they edit.** Application settings is a full-page
  studio. Workspace settings is a scoped pane. Changes save instantly: no
  Save/Cancel footer, and no settings surface stacked on another.
- **One studio slot.** Workspace and app studios share the shell's single
  studio slot, one at a time. Scope decides the pattern. Session-scoped
  editors layer over the session pane. Studios take the slot. Anything that
  became a lens stays a lens.
- **A door replaces, a link stacks.** A door is a control that names a studio:
  a column door (Inbox, Chat, Workflows, Settings), the Impact icon, a ⌘K Go to
  row and the spend chip. Pressing a door while a studio is open replaces that studio in
  the same history entry (`switchStudio`), so five doors in a row leave one
  entry, not five. A link opened from inside a studio's content (a notification
  that opens Settings, a card that opens Impact) stacks (`openStudio`), so Back
  returns to where the link was. Events from the bars carry `door: true`.
- **One exit.** Close, Esc and Back leave a studio the same way: they land on
  the entry below it, and Forward brings the studio back. When nothing sits
  below, Close rewrites the top entry as the page without the studio. Esc is
  layered: it closes a popover or a confirmation inside the studio before the
  studio itself.
- **One selected sign.** The open studio's door, New session while the draft is
  open, or Board on the board, takes `bg-selected` with `cursor-default` and
  `aria-current="page"`, in the column, on the rail and on the Impact icon
  alike. Every door reads it from one place (`columnPlaceOf`, through
  `useColumnPlace`), so at most one door carries it; inside a session no door
  does, because the open session's row is the sign. A popover trigger (the
  Limits chips, the Goodboy row) is never selected: it only reports
  `aria-expanded`. A button's label, `aria-label` and tooltip name the same word
  (`Workflows`, `Chat`); the hover hint adds only the shortcut.
  `__tests__/navigation/oneDoor.test.ts` pins the rule.

A second entry point reuses the existing mount and never builds a parallel one.
The palette dispatches an event that the owning component listens for. The
keyboard path calls the same hook method as the button.

### The ⌘K palette

The palette is one overlay (`features/palette/`), the accepted exception to
no modals: it is transit, not a flow, and Escape or a click on the scrim
closes it. It has a mode slot (`PALETTE_MODES` in
`features/palette/paletteModes.ts`): each mode draws its own input row
(`PaletteInputRow`) and body, the overlay keeps the query and the scope, ⇥
moves to the next mode with the same text, and `openPalette({ mode, query })`
opens it on a mode. Commands is the first mode.

- **Scope first.** It opens on a scope chip that names the surface you can see:
  the focused commit row on the Commits tab, else the agent when the agent page
  is on screen (a stored selection under a studio or an artifact conversation
  does not count), else the run on the Runs page, else the pull request on the
  Branch page, else the session, else the workspace on the board and under any
  open app studio (`resolvePaletteScope`, which reads
  `resolveSessionSurfaceLayer`). A row offers itself with `useHeldPaletteScope`,
  and the palette reads it only while focus is inside that row
  (`heldPaletteScope.ts`). Backspace in an empty input removes the chip. The
  placeholder and the top bar pill say the same words: **Search or ask**.
- **Empty input in a session is ranked by state, not by registry order.** One
  fixed list of sections, empty ones hidden:
  1. **Next**: up to three rows from `deriveNextSteps`, the same model, handlers
     and outcome log as the session's next-step slot (`useSessionPalette` calls
     `useSessionSuggestions` and `useSuggestionActions`). Needs-you rows first.
     A step the slot confirms (Merge, Close worktree) confirms here too. Mount
     proposals stay in the slot. Push, Create pull request and Rebase live here:
     a mount target needs live git status, so the palette takes them from the
     model that already reads it.
  2. **For this session** (above it **For this agent**, **For this run** or
     **For this pull request** when that is the scope): up to eight verbs ranked
     by the session state (`paletteTiers.ts`), then **All actions for this
     session**, which opens the grouped level (Open, Act, Copy and export,
     Danger). The state is the one the column row, the board card and the Now
     chip show (`useSessionStageInfo`): archived, needs you, live, ready to ship
     (an open pull request, or a push, pull request, ready or merge step),
     finished, idle. Each state has a recipe of verb ids; a verb the recipe does
     not name follows in registry order, a Danger verb is never in the eight, and
     an archived session shows only restore and copy verbs. While an agent runs,
     **Message {agent}** and **Interrupt {agent}** join the list.
  3. **Runs**: only when the session has a run or a workflow exists. The run on
     screen, else the one that needs you, is live, or is queued, as a row with its
     state; its verbs in state order (Answer, Start run, Continue step, Start next
     step, Restart step, Stop run); **Start a run**, which opens a level of
     workflows ("from a workflow"); and **Open Runs**. Picking a workflow, here or
     from a typed `Start a run: Ship a fix` row, opens a confirm that names the
     session, the project, the model and the steps, and nothing starts until you
     confirm.
  4. **Recent**, agents of this session first; then **Go to** (Board inside a
     session, Inbox, Chat, Workflows, Impact, Notifications, What's new), **App**
     (New session, Settings, Switch theme, Connect a provider, Pair your iPhone,
     Report a bug) and **Help**.
     On the Board the first section is **Needs you**: the sessions the Now chip
     lists, each opening its `attentionPlace`. The session pages (Open Session,
     Questions, Artifacts and the rest), Run defaults, Impact: Spend, Start a new
     project and Open a folder stay out of the empty list and answer to typing.
     The order of the list is the one place the palette differs from a `⋯` menu:
     both list the same verbs (`menuParity.test.tsx`), `⋯` keeps its stable order.
- **Typing gives one ranked list, never regrouped.** A fuzzy subsequence match
  with bonuses for word starts, camel boundaries and runs, so `pay export`
  finds "Speed up the payout export" (`score.ts`); then frecency, uses halved
  every seven days and capped so it only reorders close matches
  (`frecency.ts`); then a boost for the scope's verbs (`rank.ts`). Matched
  letters are marked, and each row shows its shortcut or its kind on the right.
- **Every workspace.** Sessions of every workspace are listed
  (`listSessionTitlesAcrossWorkspaces`); one from another workspace names it
  and opens that workspace first.
- **Typing still finds everything.** The Next rows, the run verbs, the verbs of
  the session's pull request and the old names (`Stop workflow`, `Run workflow`,
  `Back to board`, `Open settings`) answer to a query wherever the state ranked
  them. A lone `Ask in Chat` row stays first for free text.
- **Verbs come from the action registry** (`features/actions/`) and follow its
  state rules. A verb whose `when` is false never shows. A blocked verb shows
  only when searched by name (every word a word prefix of its label), dimmed
  with its reason, and Enter does nothing. Delete and the other confirmed verbs
  swap the list for an InlineConfirm; Archive runs at once with Undo. The
  registry owns Review, Diff and Terminal of a session in scope, so the lens
  rows with the same names step aside.
- **Keys.** ↑↓ move, ↵ runs the row (an object row opens it), → opens every
  verb of an object row, grouped Open, Act, Copy and export, Danger, and ← or
  Backspace goes back. A verb with choices, such as Change model, opens them as
  a level. Copy worktree path copies at once when the session has one
  worktree; with several it opens them as a level (name, branch and path), and
  ⌘↵ copies every path, one per line. A preview pane describes the highlighted
  row.
- **An agent, a run or a pull request in scope keeps its session's verbs.** They
  follow under "For this session", ranked by the session state, so Copy
  worktree path stays one search away. A session verb with the same label as a
  scope verb steps aside.
- **Prefixes stay**: `@` agents, `#` sessions, `:` workspaces, `$` scripts,
  `>` actions, `?` help.

In the composer, `$` lists the scripts of the session's mounted projects
(`useSessionScripts`): saved scripts first, then the `package.json` and
`composer.json` scripts pinned for the project, by category. The Scripts lens
lists the same set. Scripts that are not pinned stay on the workspace Projects
page in Settings, where they are pinned. A row's sublabel names its package (the
manifest name, or `root`) and shows the script's body, not its invocation; the
trailing badge is `Running` or the package's short name (`web`, not
`package.json`) so twenty `dev` rows in a monorepo read apart. Manifests are
read from each mount the first time `$` is typed. With more than one mount a
row also names its project. An empty list says why: no project in the
session, no pinned script in the project, or no match for the filter. Enter runs the
row and opens its output in the right drawer; the composer text is cleared.

⌘F opens search, the palette's second mode: a local index over sessions,
messages, agents, artifacts, decisions, questions, issues, pull requests and
branches, with filters and a preview. A hit lands in context through the one
door, and ⌘G and ⇧⌘G then walk the matches in that view. A focused terminal
keeps ⌘F for its own scrollback. [search.md](search.md) owns the index, the
landing targets and the find rules.

## Addresses and history

Every view has an address, and one history per window and workspace records
them. The navigation slice (`store/slices/navigation/`) owns both.

- **A `Location` is where you are plus how the page was.** Its `place` is the
  board or a session view: lens, open agent, session studio and one target
  (artifact, run, issue, diff focus, terminal mount). Its `studio` is the app
  studio open over that place, if any. Its `focus` is the page state: the open
  drawer, selection, scroll and revealed rows. `locationKey` prints the text
  form used by tests and logs: `board`, `s/{session}`, `s/{session}/branch/comments`,
  `s/{session}/workflows/{run}`, `s/{session}/agents/agent/{agent}`,
  `s/{session}/branch/comments/t/{thread}` (a thread, with a fix run transcript in the drawer when one is open).
- **One door.** Every move goes through `navigate({ to, mode })`, `back()`,
  `forward()`, `up()` or `amendFocus({ patch })`. `sessionPlace`,
  `agentPlace` and `BOARD_PLACE` build the `to`. The per-session keys the
  surfaces render from (`activeLens`, `selectedAgentId`, `sessionStudio`, the
  focused target) are written only by the slice. A contract test
  (`__tests__/navigation/oneDoor.test.ts`) fails when `features/`, `app/` or
  `shared/` calls `setActiveLens`, `setCurrentSession`, `selectAgent` or
  `setSessionStudio`.
- **Aliases live in `canonicalLocation`, and only there.** An agent resolves
  to its home lens (an unknown agent to Agents), before it is recorded, so no
  view redirects after it mounts. The pull request and Review are two lenses
  and never alias each other: a door to the pull request lands on `pr`, a door
  to comments lands on `review`.
- **Push, amend, replace.** A new place pushes: board and session, session to
  session, lens, a child, a sibling from a switcher, a session studio. Pushing
  the place you are on replaces it. Page state amends the current entry and
  never adds one. Canonical rewrites replace. The stack keeps 50 entries and
  lives in memory. Each workspace has its own stack, so switching workspace
  finds that workspace's history again.
- **Back restores the entry as it was; a forward move arrives clean.** Before a
  push, the live view is captured into the current entry, so Back finds the
  same run, artifact or diff focus. A forward move (crumb, sidebar, palette,
  notification, Board) starts with an empty focus. A page row in the column
  navigates first and clears the run and artifact focus after, so the clear
  never reaches the entry it leaves (`SessionPages`).
- **Up goes to the parent.** When the previous entry is the parent, Up is Back.
  Otherwise it pushes the parent. Closing an app studio is Back to the entry
  below it, so Up from a studio and Close land in the same place.
- **Dead entries fall out.** An archived or deleted session removes its
  entries and collapses the duplicates left behind. An agent that is gone
  falls back to its home lens.
- **Keys.** ⌘[ and ⌘] (`nav.back`, `nav.forward`, app plane) and the mouse's
  back and forward buttons walk the stack.
- **A window comes back where it was.** `captureWindowLocation` reads the
  current entry, focus included, and `restoreLocation({ location })` replaces
  the top entry with it and applies it as a restore (a session that is gone
  falls back to the board, an agent that is gone to its lens). Cmd+R writes
  it into the reload intent in session storage. Each window also saves it as
  `window.layout.<window label>` in the settings table half a second after it
  moves (`useWindowLayout`), and forgets it when you close that window.
  After an update or an app restart, and on any launch with **Reopen last**
  on, the main window restores its own layout and reopens every other saved
  window with `#restore=<old label>`, one per workspace; each one reads its
  old layout and forgets it (`restoreLaunchLayout`). On a plain launch with
  Reopen last off, the launcher opens and the saved windows are forgotten.
  The history stack itself stays in memory: a restored window starts with one
  entry.

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
  `⋯` holds copy and rare actions. A task chip opens the task; its unlink
  control appears on pointer hover and keyboard focus, with no kebab.
  Put on a branch lives on the branch row. Link work is the single entry
  for linking work to a session or workspace.
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
  (creation pickers, property pickers, page chrome).
- **What each object offers.** A session: Open, Review, Diff, Terminal, Open in
  editor; Rename (inline, in the row that opened the menu), Start agent, Link
  work (L on the Overview); copy the title, worktree path, branch and pull request link; Archive with Undo and
  Delete with its confirm (Restore once archived). Several sessions: Copy
  titles, Archive N, Restore N, Delete N. An agent: Open agent, Show its
  changes; Message this agent, Interrupt while a turn runs, Close or Reopen,
  Change model (one submenu); copy the last reply and the name; Delete agent. A
  workflow run: Open run, View diff; Answer, Start run, Continue step, Restart
  step, Start the next step, Restore; Copy run summary; Stop run, Archive
  run and Delete run, each confirmed. An artifact: the viewer's verbs by kind and status,
  from the list row too, plus Delete on any stored artifact that is not already
  deleted (Undo, no confirm) and Delete permanently on a deleted one (confirmed). A plan part, an inbox record (with the tool verbs of
  an open record), a pull request, a worktree row of the Overview (`mount`), a
  project, the Diff of a branch (`diff`), a diff file, a commit on the rewrite
  page, a storage worktree, a script, a transcript message and a link in
  rendered text have their own kinds. One field says which available actions
  also get a visible control on their surface: `slot` (`primary`,
  `secondary`, `inline`, `nudge`, `notice`, `hover`, `section`, `chip`,
  `empty`, and `menu`, the default, for the menu alone). A surface reads its
  buttons from it (the artifact viewer header its primary and secondaries,
  the Branch header and the worktree row theirs), at
  most one primary and three secondaries; the menu, the right click and the
  palette ignore `slot` and list every available action.
  `useActionControls` renders those controls with the pending words on the
  control, the blocked reason on the line under the header and a failure with
  Retry under the control. `__tests__/actions/stateMatrix.test.ts` pins, per
  kind and per state, which verbs show, in which slot, and why a verb is
  blocked, and runs them on the real store; `kinds/*.matrix.test.ts` pins the
  same for the three UX5 kinds against the plan's state table.
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
  Branches and the Storage lists share `SelectionBar` (`packages/ui`). A checkbox shows on the
  row under the pointer and on every row once one is picked; modifier-click and
  the lasso stay. The bar floats at the bottom of the surface that owns the
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
- **Confirm and undo.** A verb that loses work confirms inside the menu with
  `InlineConfirm` (Delete, Delete permanently, Discard, Close run, Merge, Close pull request,
  Delete script, Close worktree, Remove from session, Abort rebase). Remove
  from session and a storage worktree's Remove keep their detailed confirm (the
  removal plan, the forced remove) in their own menu. A reversible verb runs at once with an Undo toast (Archive, Delete on an artifact,
  Close agent, Unlink, Stop tracking, Take off this branch). The toast lasts
  about 10 seconds and Cmd+Z undoes the latest operation outside a text field.
  Reversible removals never ask for confirmation. A draft verb on the Commits tab (Drop) needs neither.
- **Blocked verbs stay.** A verb that cannot run now stays in the menu, dimmed,
  with its reason under the label, and does nothing when chosen. A verb that
  does not apply to the state is not shown.
- **Where the webview menu stays.** Text selected inside the clicked element,
  editable fields, the composer and the terminal keep the native menu
  (`useNativeMenuPolicy`). A link in rendered text gets Open link and Copy
  link. Everywhere else the webview menu, and its Reload, is suppressed, and a
  blank area opens nothing.

## Surfaces

**Shell layout.** One strip of chrome sits above, and under it one left column
plus main. There is no footer. **There is one app layout and every surface fills
its slots.** The board, the session and the studios do not define their own
frames. A surface that needs a different frame changes the shared one instead of
forking a second (`app/shellArrangement`, which every shell mount, the app and
the mock scenes alike, reads). **Two navigation columns at once is not the IA.
The right drawer is context, never navigation.** A session draws one full-width
pane, and its navigation lives in the left column. The right drawer holds
reference material beside the page and closes with the pane that opened it.

**The column** (`app/components/SideColumn/`) is on every screen with a
workspace, in the same shape everywhere: the toggle on the traffic-light axis,
New session (⌘N, the only emphasised control, selected while the draft is open,
a primary dot and `Draft in progress` while a draft waits), the doors Board
(⌘⇧H), Inbox, Chat and Workflows as one 28px row each (icon and word, the
shortcut on hover), the Sessions list (`SessionNavSidebar`, its rows and header
belong to the sessions list), then at the foot Settings (⌘,), the Goodboy row
and a bug icon that opens the report sheet. Chat's door carries a running dot
or a new-reply dot. Before any workspace exists the column keeps only its app
half: Settings, the Goodboy row and the bug. The column is 240px by default and
resizes from 200 to 400 (`goodboy:left-sidebar-width:v3`, so an older saved
width resets once). Its first button or ⌘B folds it, on every screen, into the
rail; the choice is saved and peek never touches it.

**Classic bars.** Settings > App > General > Classic bars (setting
`shell.classicBars`, off by default) brings back the 0.20.0 frame: Board and
Chat in the top bar, the footer with its doors and integration glyphs, the
sessions sidebar only inside a session, studios covering it. It ships with
0.21.0 and leaves in a later release; the tests of exits, doors and restore run
on both arrangements while it exists.

A window is a strip, a set of columns, and a pane. Each owns one thing.

**The strip** is one row on the chrome, with no line under it: the edge of the
content sheet closes it. It renders **outside** the grid, so no column resize,
hide animation or overlay can move it.

**The columns** are one grid at saved widths, clamped when read.

- **A column has one reduced state, and it is never a narrower copy of
  itself.** The left column's one reduced state is the 44px rail of doors
  (`ColumnRail`): the toggle, New, Board, Inbox, Chat and Workflows as icons
  with their names and shortcuts in tooltips, then Settings, the bug and the
  Goodboy mark at the bottom. It works at rail width because it holds doors,
  not the list; the sessions list comes back through the peek. Hiding a column
  outright sets it and its handle to zero width and marks the aside `inert`: a
  zero-width column that still takes focus is a keyboard trap. The shell
  primitive can lay out more reduced states than the product uses. Which one a
  column gets is decided here, not by what the primitive offers.
- **The overlay slots sit inside the grid, not above it.** The peek spans the
  work row, so it can hover over main without taking layout space. The studio
  slot covers the content area only (`studioCoversLeft={false}`), as its own
  sheet, so the column stays live beside every studio; the peek is drawn after
  it, so a peeked column floats over a studio too. A studio never covers the
  top bar.

**The pane** is the work. It is the only surface that scrolls its own body,
mounts editors and takes a title.

**The projects section shows which projects a session has materialized.** It
lives in the session overview and always has the Add project action, even
before the first mount. Mounted projects show as dense rows. The empty section
is its header with a one-line hint: turns run in the session folder until you
add a project. Sessions are created lazily
on the workspace ([concepts.md](concepts.md) → Lazy sessions), and this section
is where a session's footprint grows. The session header has no second mount
control.

**Inside a session the sidebar stays the sessions list.** There is no second
mode. The sidebar lists the workspace's sessions in one list, and the open
session tells its own story in the main pane. Its five work pages nest under
its row: Overview, Branch, Runs, Agents and Artifacts. They are the same pages
as the first five rows of the trail's page menu, with the same count words from
one selector (`usePageSummaries`), so the two doors never disagree. The
nesting is not a mode: the list stays the list, the nested rows fold away when
another session opens, and `←` and `→` on the open row fold and open them. The
tools (Scripts, Terminal, Explore) and the linked records (Linear, GitLab,
Jira, Slack, GitHub issue) stay in the page menu and the palette. Rows and
chips inside the overview still route to the other surfaces. Board → session
is the full depth of navigation.

**A sidebar row says the name and the state, and the hover card and the board
card say the rest.** A row is one line of 28px: a 14px `WorkNode` and the
title, with the ticket key of a linked task in front of it when the goal starts
with `[KEY]` (`sessionRowTitle` strips the key from the title and returns it;
`SessionRowTitle` draws it in muted mono, the title truncates and the key never
does; the switcher row and the hover card title do the same, the board card
keeps its chip). It has no second line, no `ToneBar`, no marks, no age and
no cost. The node shows one of five signs, the first that matches
(`sessionNodeOf`, from `useSessionSummary`): needs you (`?`, the approval shield
or `!`, in the warning or danger tone, when the stage is attention), running
(the ring), done (the muted check, when the pull request is merged or all the
work is closed), idle (a 1px hollow ring, everything else) and archived (a
dashed ring, only under Show archived). Colour is never the only sign. The open
session is set in medium weight, and its pages nest under it. The row's
accessible description carries the stage word and its reason, so nothing is
mouse-only.

The rest is one rest away. After a 500ms rest on a row, or on keyboard focus
after the same delay, the hover card opens beside the column: the full title,
the stage word with its reason when the reason adds a fact, the run progress
(`Implement · 3 of 5`, counted from the steps that started, never estimated),
the pull request with its checks, the linked task chips, the project chips, the
agent count, the spend and the age, and one ghost action, **Open what needs
you**, when the session needs you. That action lands where the Now chip lands
(`attentionPlace`). Moving to another row swaps the card at once, with no second
wait. Esc and opening a session close it, and the pointer may move onto the
card. The row, the card and the board card all read `useSessionSummary`, so they
say the same things in the same words. The board card keeps the whole summary
and the session header keeps its chips.

**The user chooses the order of the list.** The Sessions header holds one `⋯`
menu: Sort (Needs you first then the session you opened last [default],
Alphabetical, Last activity, Created), Group (None [default], PR state, Stage,
Project), Filter by project (the same selection as the board's project filter)
and Show archived. The choices persist per workspace in the browser storage
(`goodboy:session-view:<workspace id>`, version 2); nothing goes to the
database. By default the sessions that need you sit on top, the one that has
waited longest first, and the rest follow `sessions.last_opened_at`, written
when a session opens (a session never opened falls back to its last activity).
A running session does not move, and a row moves only when you open a session
or a session starts needing you. With no grouping the first eight rows show and
the rest sit under **Show N more**, remembered per workspace. A session that
needs you and the open session are never folded. A grouped list shows every
group, finished groups start collapsed, and nothing folds. `⌘⇧[` and `⌘⇧]` walk
this same order and skip folded rows, so they match what you see.

**Two keys switch sessions without the list.** `⌃Tab` opens a list of the
recent sessions in last-opened order, the open one first. `Tab` and `⇧Tab`
move while `⌃` is held, releasing `⌃` opens the chosen session and Esc cancels.
A quick tap flips to the previous session and never draws the list. `⌥⌘↓`
lands on the next session that needs you, in the Now chip's order, on its
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
primary button. Projects, Next and Activity are peer sections in the pane body,
one `PANE_RHYTHM.stack` gap apart: the header passes `headerRhythm="section"`,
so the gap under it is the same. Space separates sections, never a
`<Divider />`, and a section never has a border. The Activity header holds two
controls, Filter and New. A section appears once its
fact exists (a plan, a workflow run, a PR on a project). Before that it is one
quiet action row (link an issue, start an agent, attach a workflow). So the
empty session reads as a young version of the same document, not a wall of
placeholders. Finished work collapses into one summary row per category. The
surface itself shows urgency, never a badge parked beside it.

**New session is a draft, not a session.** New, ⌘N, the board, the palette
and the checklist open the `New session` draft (the `session-draft` place,
address `new`). Nothing is written: no row in the database, the column or
the board. The trail and the title say `New session`, the title is faint and
cannot be renamed, and there is no `⋯`, no chip and no projects section. The
column's New session row stays selected while the draft is open. Each workspace
keeps one draft in memory (`store/slices/sessionDraft/`), never on disk:
leaving it keeps it intact, New brings it back, and the button shows a primary
dot with `Draft in progress` while a written draft waits. `Discard draft` in
the header empties it; Esc never does. Back returns to the draft like any
other place. **Start blank** in the header (`startBlankSession`) is the way
to start from the goal: it creates a session with no title and no goal slot
and lands on its normal Overview (`Untitled session`, `Add a goal`), where
the goal, projects and work are added from the usual controls. Nothing is
required first, and the draft stays for the next New.

The draft asks one question, "How do you want to start?", with three choices
on one row as tabs (`StartChoiceTabs`, `SegmentedTabs` `card` variant).

- **Pick up a task** shows the open issues of the connected trackers with a
  search field. Picking one and pressing **Pick up** proposes the brief under
  the list, as the issue brief flow in [concepts.md](concepts.md) describes.
  Use brief, Edit or Use issue text settles the title and goal and opens
  **How to work on it** (`HowToWorkOnIt`) underneath: the same Run a workflow
  or Ask an agent choice as the other two tabs, precompiled with that goal,
  Run a workflow preselected. Run a workflow is the same embedded
  `WorkflowBuilderView` as the Workflow tab (Orchestrated, Describe steps or Pick a workflow,
  the plan, guidance, Can use, Starts, when to ask, Spend cap), with the issue as
  its goal and its own draft under `kickoff-task:<workspace>`. When the issue
  maps to a project (`launchMountFor`, the Inbox rule: a GitHub or GitLab repo
  path, or a Sentry project linked or code-mapped to a project) a
  `LaunchMountRow` above the choice says which project the session works in
  and why, and lets you pick another or none. Start run, or Start on the
  agent side, links the issue, mounts that project, creates the session and
  starts the run or agent in one gesture (`startSessionFromDraft`, kind
  `task` with a `mount` and a `then`). Without a tracker
  it shows the connect links. The search, like the Inbox search, reads an issue
  code or link (`parseIssueCode`: `CAS-231`, a Sentry short id, `#482`,
  `owner/repo#482`, a tracker URL; anything else stays a local filter). When
  no loaded row has that exact identifier, `useWorkspaceIssueLookup` asks the
  right tracker once (300 ms after typing, cached two minutes): a key goes to
  Jira when it matches the Jira project, to Linear alone when the prefix
  matches a Linear team key (`linear_fetch_team_keys`, fetched once per
  connection and cached, so a recognized team no longer also fires a Jira
  call that was always going to 404), otherwise to Linear and Jira; `#N` goes
  to every GitHub or GitLab repo of the workspace's projects (four GitHub
  calls at a time); a short id resolves across the Sentry organization
  (`sentry_resolve_short_id`). While a lookup is in flight, the row names the
  trackers it asked (`Looking up CAS-231 in Linear and Jira`). Hits sit in a
  `Not in your inbox` group above the list (`InboxLookupGroup`) and open or
  pick up like any other issue, with a second line showing `Assigned to
<name>` for a Linear or Jira hit with a known assignee, the project/repo
  context otherwise; a miss is one row in that group that says why (not
  found or not visible, key rejected with `Sign in again`, missing
  permission, tracker not connected, no repo for `#N`), and a rate limit
  shows a live countdown and retries once on its own when it ends, alongside
  the manual `Retry`. The mobile companion resolves Linear, Sentry and
  GitLab issues through the same direct lookups instead of searching only
  the issues assigned to you. Issues can be starred (`StarToggle`, the same
  star as projects) from an Inbox row, a lookup hit or `s` on the selected
  row. Stars live per workspace (`workspace_starred_issues`, keyed by
  provider and external id; GitHub keys by `owner/repo#N`) with the last
  copy of identifier, title and state, so the `Starred` group draws before
  any tracker answers; a row not refreshed since app start opens the detail
  panel from that snapshot (`placeholderRecordOf`), not the tool's URL, and
  gets replaced once the refresh lands a real record. In the Inbox it sits
  under `Not in your inbox` and above the days, and a starred issue leaves
  the days; open ones come first, closed ones at the bottom with `Unstar
closed` and `Undo`, and one the tracker no longer returns reads `Can't
reach NW-230 anymore`. Pick up a task shows only the open starred issues,
  even ones a session already picked up. Opening the Inbox or Pick up a task
  refreshes the stars at most every five minutes (`refreshStarredIssues`):
  one request per tracker for Linear and Jira, one per project for GitLab,
  and one per issue for GitHub and Sentry, which have no batch endpoint for
  fetching by id.
- **Run a workflow** is the workflow builder itself (`WorkflowBuilderView`
  with a `kickoff` target), the same one Session > Workflows > Create opens:
  title, goal card with Add files and Polish, the Orchestrated / Describe steps /
  Pick a workflow switch, Can use, the plan preview with the orchestrator row or the
  editable steps, guidance, Starts, when to ask, Spend cap and Start run with
  its reason. Its goal field is the kickoff goal (`workflowGoal` in the
  draft), the only one on screen. Its draft lives under `kickoff:<workspace>`
  in `workflowDrafts`, so it survives leaving the kickoff, and Discard draft
  clears it with the rest. Start run runs `startSessionFromDraft` with
  kind `workflow-run`: the session is created first, then the builder saves
  the workflow and attaches the run to it in the same action, and the view
  lands on the run. A failure removes the half-created session and keeps the
  draft. Before a session exists the builder leaves out Use session goal, the
  title suggestion (the orchestrated title is generated after start, as in a
  session) and the worktree as the planner's working folder.
- **Ask an agent** (`AgentStart`) is the real chat composer's field: role,
  model and project sit below it as chips (`AgentStartFields`), opening the
  same role grid and model picker `Start agent` uses. The role defaults to
  Scout every time, never the last one picked, because a habitual Implementer
  writes code you did not ask for. Scout alone can start with an empty field
  ("Start Scout on the whole project", which reads the project and changes
  nothing); every other role needs a prompt first. The model chip reads Auto
  until pinned. The project chip only shows when the workspace has more than
  one repo project; with one it is preselected with no chip, with none the
  session starts with no project attached.

Only the selected tab's panel, and only its primary, shows. The tabs
preselect Pick up a task when a tracker has open issues and Run a workflow
otherwise, and they never remember the last choice. Opening the draft puts
focus on the selected tab.

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

- **The trail belongs to the page, not to the chrome, and it is mounted
  once.** `TrailBar` sits at the top of `SessionWorkspace`, above every layer
  (lens, child page, session studio) and outside every animation, in a 40px
  band (12 above, a 24px row, 4 below) on the same `PageColumn` as the title
  and body. It is never in the top bar and never a full-width strip. Changing
  lens, opening an agent or opening a session studio keeps the same DOM node;
  only the segments change. The layers under it fade in over 150ms with no
  scale. Panes under the band get one header grammar from `PaneShell`: title,
  optional tabs, 16 below, no crumb row of their own. A session studio (builder,
  merge request, Bitbucket) has no second title bar: its title is the crumb,
  and Esc or the parent crumb is Up.
- **The band has one right slot, and Ask holds it.** `TrailBar` takes an `end`
  node outside the `PageColumn`, at the right end of the band.
  `SessionWorkspace` puts `AskTrailButton` there: the question-bubble glyph
  (`CONCEPT_ICONS.ask`, never Chat's `MessageCircle`), the word **Ask** and a
  ⌘L key cap, pressed while the Ask drawer is open for that session. Its
  tooltip reads `Ask what is happening in this session ⌘L`. It toggles the
  drawer; ⌘L (`ask.open`, app plane) opens it or, when it is open, focuses its
  box. Only the visible session's button binds ⌘L.
- **Studios use the same `Trail`.** The `StudioFrame` band renders the studio
  name through the `Trail` primitive from `@goodboy/ui`. A studio body that
  goes deeper claims the band with `StudioTrail` (the workflow editor shows
  `Workflows > Ship a fix` with its save state and actions), so the app has one
  breadcrumb.
- **Every crumb has an icon, and depth compacts the trail.** Agents carry the
  agent glyph in their kind's colour, runs the run glyph, artifacts, questions
  and pull request modes their own. The last crumb and its parent always stay
  full. `Session` keeps its name through five crumbs. From five every other
  ancestor but the parent becomes an icon, and from six `Session` does too.
  When the band still has no room, ancestors turn
  to icons from the left, then the icons after `Session` fold into a `…` menu
  right after it; `Session` is the anchor and never folds. An icon crumb keeps
  its name as tooltip and accessible name. `compactTrail` in `@goodboy/ui` is
  the pure rule; the label closes with a 220ms width transition (120ms fade),
  and a new crumb enters from the right 60ms later. Under reduced motion only
  the opacity changes.
- **The trail starts at `Session`, and the session name is not a crumb.** The
  sidebar already shows the session identity. Repeating it in the trail spends
  a crumb on something the user is already looking at.
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
  `Session > {HomeLens} > {Agent}`. Selecting a sibling changes only the last
  crumb and the child region.
- **The trail shows the structure of the app, not the history of the
  session.** A parent comes from the object that is open, never from the
  surface the jump came from. Selecting an agent leaves the active lens where it
  was, so that lens only ever records where the user came from. The activity
  feed, the palette, a notification, a linked-work chip and a restored session
  are shortcuts into a place that already has a parent. None of them may
  rewrite it. History is what Back is for.
- **The Branch is one page with its tabs in the address.** A branch is shaped
  like a pull request: a header (title, `Draft · project · head → base ·
checks`, one primary by state, `⋯` for the rare pull request lifecycle) over
  the tabs `Comments · Files · Commits · Checks`
  (`s/{session}/branch/{tab}[:{mount}][/t/{thread}]`). A tab switch and a
  thread selection replace the entry, so Back never walks them. The trail is
  `Session > Branch ▾ > {thread or file}`, the same from
  every door; Up is the crumb to the left of the open one. `Branch ▾` lists the
  session branches and makes the picked one the active mount. `layers.ts` is
  gone. The requests `pr`, `review` and `files` (a mount present) are
  rewritten to the Branch address by `canonicalLocation`, so the palette, the
  shortcuts, a notification, a chip, a search hit and an Activity row all land
  on the same address; a saved place is rewritten the same way when it is
  restored. A GitLab or Bitbucket merge request keeps the `pr` page, a session
  without a branch keeps File versions.
- **A child hangs off the overview section that owns it**: a step under its
  run under Workflows, an ad-hoc agent under Agents, a resolver under its
  comment on the Branch (`s/{session}/review/t/{thread}/agent`). Back returns where
  you were, while the trail says where you are.
- **Segment menus.** Every segment that has siblings carries one `CrumbMenu`
  (the `Trail` primitive in `@goodboy/ui`), and the rule is one: its menu lists
  the siblings of what that segment names, plus at most two actions that belong
  to that thing. The page segment (depth one, or `Session` when it is alone)
  lists the session's pages with a count that names what it counts
  (`3 need you`, `2 running`), grouped as pages, Tools and Linked; `Session`
  has no menu once it has children. A run lists the session's runs (Running,
  Finished, a chained run indented under its own with `after ...`); a step
  lists every step of its run in order, the ones not started switched off; an
  agent lists the agents of the same home grouped Needs you, Running, Done,
  newest first; an artifact lists the session's artifacts by kind. Actions
  exist only where a real action backs them: `Start agent`, `Start a run`
  and `New artifact` (opens the kind picker) on their pages, `Stop this step`
  while a step runs and `Retry step` when it failed or is blocked
  (`recoverStuckStep`), `Show saved copy` and `Copy folder path` on the open
  artifact. An attempt offers `Resolve again` once no attempt on that comment
  is queued or running: it starts a new attempt with the Branch page's default
  instruction, through the same `useResolveAgain` hook Review uses.
- **The Diff ends on the branch it shows**, with its `+N -M`, and that segment
  lists the session's branches by repo with one state word each, the first
  that applies of `Rebase stopped` (or `Rebasing on main` while the rewriter
  works), `Merged`, `Gone on origin`, `Local only`, `Diverged from origin`,
  `Behind main by N` and `On origin` (`branchPriorityOf`), and `All branches in
Overview`. `Local only` and `Diverged from origin` read the branch's own
  remote copy (`branchPushStateOf`), never the base it was cut from. The Diff
  header reads the same word, so a stopped rebase never reads `On origin`
  next to Open terminal and Abort rebase. A
  branch whose pull request merged reads `Merged` even with no git ancestry
  (a squash merge), in the menu and in the Branch header alike
  (`isMountRequestMerged`). It never
  turns into an icon. A Diff opened without a branch lands on the active mount.
- **A fix run has no segment of its own.** Its transcript is a drawer on the
  Comments tab, so the trail reads Session, Branch, Comments.
- **Settings claims its studio band** with Settings, the scope and the App
  section. The scope segment lists App, the workspace, Providers & models and
  Tools; the section segment lists the App sections. Neither carries an
  action: Settings has no project scope, so there is no `Use workspace values`
  to offer. A segment without an action is plain text and has no hover state.
  The first segment of a studio has no menu because studios change from the
  column. It is a button only when that studio has a start to return to.
- **Every menu row has five slots**: lead, label with a faint second part,
  meta, a state that is always a word (from `agentStateWord`, the same reading
  `isAgentFinished` makes), and a check on the current row, which is there even
  when it is the only row. The last segment opens its menu from the whole
  segment and always shows the chevron; an ancestor goes up by its name and
  opens its menu from a chevron that is always visible, faint, and doubles as
  the separator: every segment but the last ends with the same chevron slot,
  whether it has a menu or not, so the gaps are equal. Name and chevron light
  up as one chip on hover. Page icons take the tone of their concept
  (`LENS_TONE`, linked tools keep their brand color). Widths are 300 (pages, scopes, sections), 380
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
  (24px icons) name their destination in the tooltip (`Back to Review ·
{session}  ⌘[`), sit at 40% with `Nothing to go back to` when the history is
  empty, and open the last 12 entries on right click or a 400ms hold. Board and
  Chat left the bar for the column (under Classic bars they come back here, in
  their old shape). Board, the column's first door, is pressed
  (`aria-current="page"`) on the board and does nothing; over a studio on the
  board it closes the studio; in a session it navigates to the board as a
  history entry. ⌘⇧H does the same. Chat is a door to the `chat` studio on a
  new chat; its row carries a running dot or a new-reply dot. The command
  center opens the palette and shows ⌘K; it never takes typing itself. In the palette,
  every search with text and no prefix starts with `Ask in Chat`, which opens
  a new chat with the query as its first message. Inside a session (the
  session or one of its agents in scope) `Ask about this session` comes first
  and `Ask in Chat` second (`askEntries`): it opens the Ask drawer and sends the
  query. A query that reads like a question (ends with `?` or has four words
  or more) has the first Ask row picked, a shorter one keeps the best match
  picked so Enter still jumps.
  Start session in a chat's Turn into work panel creates the session and
  navigates to `sessionPlace({ sessionId })`, the overview, as a new history
  entry after the chat's own; Back returns to the same chat because
  `captureLocation` keeps `appStudio`. Add to session navigates to that
  session and, once its agents load, replaces the entry with the latest
  top-level agent (`landOnSession.ts`) so the brief waits in that agent's
  composer draft (`agentDraft`); a session without an agent opens on its
  overview with nothing drafted.
- Right: the Now chip (needs you, running, scripts, each
  only when above zero), today's spend and the bell. There is no storage chip:
  a control that appears when a threshold is crossed breaks the rule above,
  and "Free 7 GB" read as free disk, not what can go. The "N GB can go" line
  lives on the Storage row of the Settings rail. Now opens one popover grouped by those
  three, and a group with no rows is not drawn. A script row moves to its
  session and opens that run's output in the right drawer. Spend opens Impact
  on its Spend tab; it is never merged with a count. Then `Limits`: one chip per connected plan provider (Claude, Codex,
  Gemini, Cursor), in the provider order, with providers that report nothing
  last. The order never follows state. At rest a chip is its glyph and a bar of
  the provider's most used window; the number shows from 80%, `Out` with the
  reset day at 100%, a clock marks data older than 30 minutes or a window that
  reset since, and a dashed track means no data. The card tooltip always
  carries every window, its percentage and its reset. A click on any chip, or
  on a provider under `+N`, opens the Providers menu anchored under the strip
  (`LimitsProvidersMenu`, the same `ProvidersMenuPanel` the classic footer
  opens): the policy list, Connect for each CLI provider that is missing, and
  Manage providers. Usage stays in the chip tooltip and in Settings >
  Providers & models. Without a workspace a chip still opens that usage page.
  The strip is a toolbar: arrow keys move between chips. With no provider
  connected the strip is one `Connect a provider` chip that pulses and opens
  the same menu, and nothing shows while providers are still being detected.
  A bar in the chrome is always a provider window; money is always a figure.
  Then the theme toggle, the Impact icon (a door to the Impact studio on its
  Overview tab, pressed while it is open, tooltip `Impact`) and the bell, which
  opens the notification popover.

The bar is an `@container/topbar` and degrades on its own width, never the
viewport, so app zoom takes the same path as a narrow window:

1. Below `chrome-wide` the command center narrows and says only `Search or
ask` (wide it adds `in {workspace}`), and
   Limits keeps two chips instead of four.
2. Below `chrome-labels` it becomes an icon with ⌘K, the signal words
   (`need you`, `running`, `scripts`, `today`) drop and Limits keeps
   one chip. Counts, dots, glyphs and the spend figure stay, and their
   tooltips carry the words.

The traffic lights, identity, the movement cluster, the command center, the
needs-you count, the spend figure, the first Limits chip, Impact and the bell
never hide. A Limits chip is
the provider glyph and two bars, with no card, label or number around it; the
percentage lives in its tooltip and its accessible name. A provider with no
figures yet draws no chip. The Limits chips past the ones that fit, and the
providers with no figures, are the only overflow: a `+N` chip takes the tone
of the worst hidden provider and lists them. No other control moves into an
overflow menu. `chrome-labels` sits below the 1024px minimum window, so words
only drop under zoom.

- Workspace identity opens an anchored popover that switches and creates
  workspaces. ⌘O opens that same popover, never a second one, and the palette
  lists workspaces as rows of its own. `Find a workspace or project` filters by
  workspace name and by project name. The current workspace sits in its own
  `This window` row (a check mark and `Current`, plus the only gear icon into
  Workspace settings); every other workspace shows one verb, `Open`, that
  replaces the workspace in this window (`⌘Enter` always opens a new window
  instead, and a row already open elsewhere says `In another window`). Open
  replacing a window with agents running here asks first, inline under the
  row, never in a modal: the primary keeps them going in a new window, the
  ghost alternative stops them and opens here. A closed `Disconnected` group
  lists workspaces removed from disk, each with a small `Reconnect`. Settings
  opens on its home; only Workspace settings lives behind this popover,
  so the bar holds no second settings control.
- **Identity is pinned and mounted once.** Workspace identity stays at the left
  of the top bar on the board, inside sessions, and under studios. Exactly one
  switcher is live, and ⌘O opens its single anchored popover.
- **Theme is in the bar, after the fourth round of removing it.** A dark room,
  a projector, a shared screen: the theme changes several times a day, and a
  detour through Settings is friction each time. The toggle sits after the
  Limits chips and before the bell, with no divider, alternates dark and light on a click,
  and turns Match system into an explicit choice the first time it is
  clicked. Below the 720px `chrome-narrow` width it leaves the bar; it is not
  in the never-hide list. The three-way choice (dark, light, Match system)
  stays in Settings > App > General and in the palette.
- The top bar never edits. Reporting a bug, the setup checklist, the update
  and the version are about Goodboy itself, so they live at the foot of the
  column: the Goodboy row and the bug icon beside it.

## The column foot

Settings (⌘,) sits above the Goodboy row; the bug icon sits right of the row
and opens the report sheet (⌘I), nothing else. On the rail the three keep their
place at the bottom: the Settings icon, the bug and the Goodboy mark, which
carries a dot while an update or setup waits.

The Goodboy row (`app/components/GoodboyChip`, variants `column`, `rail` and
the classic `footer`) holds everything about Goodboy itself, the way the Apple
menu or Linear's help menu does. Its label says one thing, in this order: an
update is ready, setup is unfinished (with its progress), or
"Goodboy | BETA v<version>" with the installed version. The classic footer
chip keeps only the mark and the version below the `chrome-labels` width. The version is
`APP_VERSION` (`shared/lib/appVersion.ts`), which the build stamps from
`apps/desktop/package.json` as `__APP_VERSION__`, so it never waits on Tauri
and shows in mock scenes too. The update pill is soft, enters once and holds
still. Its popover leads with Report a bug (with ⌘I, and Draft saved
when a draft waits), then the version and release notes, the update, the setup
checklist, What's new, keyboard shortcuts, Sponsor and Follow on X. The
addresses live in `shared/lib/productLinks.ts`. Report a bug closes the
popover and opens the report sheet. The popover opens by itself once, when the
first agent finishes a turn, and never while the setup wizard is open; the
checklist has no floating card. Only the pinned row does that (and reports the
update arrival); the copy inside a peeked column is quiet.

## Report sheet

One sheet files every report. `ReportSheetHost`
(`features/bug-report/components/ReportSheetHost`) floats it at the bottom of
the window, centred, with no overlay: the page under it stays live. Every door
lands there: ⌘I from anywhere, the bug icon at the column foot, Report a bug in
the Goodboy menu, Report a bug in the
palette (it also answers bug, issue, feedback, crash and broken),
**Help > Report a bug** in the macOS menu bar (`help_menu.rs`
emits `goodboy://report-open` to the focused window), and Report this on a
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

First-run setup is a full-screen wizard in one shell that never moves: a top
bar with a labelled stepper (Provider, Project, Code host, Tasks, First
session) and Skip setup, a body that starts at the same line on every step,
and the form actions inline at the end of the step (Back, Skip for now and
the primary, right-aligned, no divider). Steps crossfade in place (240 ms,
80 ms of opacity with reduced motion); the actions are disabled while they do. Welcome says what the five
steps take. Provider needs one usable route (a CLI login, a saved key or
OpenCode's free models). Project picks one folder, with or without version
control, names the workspace after its parent folder and finds the
repositories inside one. Code host is skipped by itself when no project is a
repository. Code host and Tasks can be skipped; Sentry, Slack and the rest
live in Settings › Integrations. There is no permissions question: every
workspace starts on Full access. The last step offers the same three ways as
a new session, with Ask an agent picked and three starters: Start Scout
starts the session from a Scout draft (`startSessionFromDraft`) with that
starter as its focus, and Scout running. Pick up a task and Run a workflow
close the wizard on the new session draft with that choice picked. Either
way the draft carries the project picked in the Project step, so the session
lands in it. With no
issue source at all, Pick up a task says so and leads back to Code host. The checklist has six
items (provider, project, code host, task manager, first session, profile); a
skipped code host or task manager reopens its own step, and the first session
ticks when an agent finishes a turn, not when a session row exists.

## Column doors

Settings (the foot door and ⌘,) always opens the last settings page (General
at first), with or without a workspace; Workspace settings opens only from the
gear on the current-workspace row of the workspace popover. Impact is a
destination, so it has a door, the icon beside the bell; it opens its Overview
tab, while the spend figure in the top bar and the `Impact: Spend` palette entry
open its Spend tab. The **Providers menu** is not a door to the Providers &
models page: it changes things in place (`app/components/ProvidersMenu`, opened
from the Limits strip). Settings > Providers & models is the one home for
providers and usage; the menu holds no usage figure and sends there with
**Manage providers** (a door). It lists the same `ProviderPolicyList` as the
Models row When a provider is out, writing through the same
`setProviderPolicy`, then Connect for each CLI provider that is not connected,
then Manage providers. It reads the cached providers and never refreshes them
on open. Changelog opens from the Goodboy menu and the palette, so it earns no
door. The connected tools have no glyph strip any more: the Inbox's Source
filter is the tool door, and Connect a tool lives in Settings > Integrations.

- **The release notice answers "have you read the notes for what you're
  running"**, not "has a new release been published". After an update, one
  notice names the installed version and opens its notes. It works offline. A
  fresh install shows none, and dismissing it marks that version as read.
- Opening any studio closes the others. A door that is current does nothing.
- **Before any workspace exists, the column keeps its app half**: Settings,
  the Goodboy row and the bug. New session, the doors and the sessions belong
  to a workspace and wait for one. Settings then opens its home with only the
  App and Providers & models groups, and Providers opens on an account instead
  of on the workspace defaults. Precedent: VS Code keeps its status bar and
  Manage gear with no folder open.
- **Under Classic bars the 0.20.0 footer comes back** (`AppFooter`): the
  connected integration glyphs and Link integration on the left, the Goodboy
  chip in the centre, Inbox, Workflows, Impact, Providers and Settings on the
  right. Its target is a pair, the place and the tool (`FooterTarget`), so a
  scoped tool glyph and Inbox never light together.

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
Navigate, Session, Views, Lists, Review, Diff, Window), and Settings > App > Shortcuts lists the
groups in that order, read top to bottom per column. An entry that works only in
one place carries a `scope` (the Inbox and Notifications lists, the Branch page,
the terminal, a chat composer, an activity row, a workspace
open, a code or an explore session). The page prints the place under the group
name when the whole group shares it, or under the row when it does not. A scope
also lets two surfaces use the same plain key: J, K, R, S and E mean other
things in a list than in Review, and the registry test only asks the combos to
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
use ⌘A because the Branch page only answers it outside a text field. The selection keys (`selection.toggle`, `selection.all`, `selection.clear`, `selection.delete`) are the same kind: `useSelectionKeys` matches the first, second and fourth against the registry, and `SelectionBar` answers Esc through the escape stack; the registry test lets `selection.all` use ⌘A because the hook yields to a text field. They sit in the registry so the list and the tooltips name them.
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

## Studios

Utility studios (Inbox, Chat, Workflows, Impact, Notifications, Changelog,
the guide, pairing, Add workspace) render in the shell's studio slot, which
covers the content area only, beside the column, as its own sheet with the
studio band on top. The column stays live, so another door or a session row is
one click away. **Settings is the one studio that swaps the column**: the
column's content cross-fades (160ms) to `‹ Back to app` (with its Esc hint),
`Search settings` and the settings groups, and the page fills the content area.
The band reads `Settings › App › General` and has no Close: Back to app, Esc
and Back land alike. On close, `StudioFrame` gives focus back to what opened
the studio, or to the studio's door when that is gone (the palette), unless
focus already sits outside the studio (`restoreStudioOpener`). With the column folded into the rail, Settings shows its
groups beside the page instead. The one exception is the workspace launcher,
which has no shell. There, Add workspace takes the whole window, and so do the
app studios: Settings (its corner gear, ⌘, or ⌘/ for shortcuts) and the guide.
The palette opens there too.
Studios are not part of the breadcrumb IA. They exit on close or Esc, and only
one is open at a time.

- **An open studio is a history entry.** Opening a studio, or switching from
  one studio to another, pushes an entry over the page underneath
  (`openStudio`). Reopening the same studio, a Settings scope change and the
  Inbox's provider and record update that entry (`amendStudio`). Back from
  Workflows reopens the Inbox with its record. Close and Esc fold every studio
  entry stacked on the same page into that page (`closeStudio`): closing means
  the side trip is over, Back means one step.
- **Navigating closes the studio.** A forward move to a place (another
  session, a lens, an agent, the board) arrives with no studio, whether it came
  from the palette, a needs-you row, a shortcut or a link inside the studio, so
  the destination always lands in front. Switching workspace closes it too.
- **One frame for every studio.** `StudioFrame` (`app/components/StudioFrame`)
  mounts only while a studio is open and stays mounted from Inbox to Workflows
  to Settings. It owns the 40px band (the studio's icon and name, the body's
  subtitle and accessory, Close, which Settings drops while it holds the
  column), the Esc layer and the motion: `studio-in` when
  it opens, `studio-out` when it closes, and on a switch only the band's name
  fades while the new body enters in 160ms. A studio body still renders
  `StudioShell`; inside the frame it only hands its chrome to the band. Until a
  body's chunk arrives, the frame shows one of three opaque skeletons: `list`
  (Inbox, Notifications, Add workspace, Impact), `rail`
  (Settings) or `grid` (Workflows, Changelog, the guide, pairing). With no studio
  open, no frame node exists, so nothing covers the page.
- **One Esc stack.** The frame, a body that holds Esc (the Inbox with a record
  open), the agent overlay and the delete confirm all register with
  `useEscapeLayer`, so Esc closes the topmost layer only. So does every
  popover built on `useDropdown` (`AnchoredPopover`, the pickers, the bell):
  it holds a layer while open, so Esc inside a studio closes the popover and
  the studio stays, and it gives focus back to its trigger. The image
  lightbox, the sidebar peek, a history drag, the quick actions popover and the
  artifact page's back-to-list Esc register the same way. A layer registered
  later sits above one registered earlier. A key handler on a focused field may
  claim Esc first with `preventDefault`, and the stack then leaves it alone.
  `useKeepFullScreenOnEscape` is the one raw Esc listener left, because it must
  see the key when no layer is open. A ratchet
  (`__tests__/regressions/escape-and-keys-use-the-stack.test.ts`) counts
  `'Escape'` literals and window key listeners per file and fails on growth.

- **Not every studio earns a door.** Notifications opens from the bell
  popover (its footer's Open all notifications) and from the palette's Go to
  group, never from the column, since the bell already shows the unread count.
  The popover never deletes history. That lives in the studio, behind its
  confirm. Reporting a bug is not a studio: it is the report sheet above.
- **Notifications have one row and one scope.** `NotificationRow` draws a
  group in the popover (`compact`, one line, eight rows at most, Unread or
  All) and in the studio (`cozy`, opens in place with the body, the older
  members and Report this). Both lead with a fixed unread slot that holds
  a primary dot on unread rows and stays empty on read ones, so every title
  keeps one left edge; unread titles are also bold and read rows recede. In the
  studio the time owns a fixed last column and Mark read and Dismiss swap in
  over it on hover, so the row never changes width. A **Filters** button in the
  list header opens the facets (`NotificationFiltersButton`, with the count of
  active filters) by view, severity and source, with counts that come from SQL
  (`countNotifications`), so they stay true past the loaded page; Load older
  pages with a cursor. Both surfaces default to this workspace: a row belongs to
  its own workspace, or its session's, and a row with neither is app-wide and
  shows in every workspace. Mark all read and Delete all act on that same scope.
  In the studio, rows are grouped by day (Today, Yesterday, This week, Older),
  J and K or the arrow keys move, Enter runs the row's action and E dismisses.
  The rail rows (`packages/ui` `FacetRail`), the list keys
  (`shared/hooks/useListKeys`) and the day grouping (`shared/utils/groupByDay`)
  are shared primitives. The inbox uses all three: its facets filter by view,
  type and source (one pick per section, a tool that did not load says so in
  its row) behind the same Filters button in the list header, so the inbox is
  the list and the record beside the column, never a third column; its
  one-line rows are grouped by the same days in time order, and
  J and K move the selection while the record follows beside the list. The
  inbox opens with its first row chosen, so those keys act at once; Enter opens
  the launch popover on that row (⌘↵ in the panel launches) or the session once
  one is linked, O opens the record in its tool, R focuses the reply box when
  the record has one (a Sentry issue has none: the rail drops Reply and R does
  nothing there, `recordCanReply`), S stars or unstars, / focuses the search, and Escape in
  the search leaves the field. Escape closes a record you picked before the
  studio, and closes the studio when the first row was only chosen for you.
- **A list that belongs to the page sits in the page.** Chat's list of chats,
  Changelog's releases and the guide's chapters are content beside their
  detail, not a second navigation column: `StudioRailLayout` with
  `placement="page"` draws the list on the page background with the resize
  edge as the only line. Chat's list opens at 288px.
- **Every studio list resizes.** `StudioRailLayout` (Settings when the column
  is folded, Guide, Chat, Changelog, Bitbucket) drags from its right edge
  between 220 and 420px, step 8px (32 with Shift) with the arrow keys, and goes
  back to its default (256 narrow, 288 standard) on a double click. Each studio
  keeps its own width
  (`goodboy:studio-rail-width:<studio>:v1`), and the rail skeleton opens at
  that width. `useResizableWidth` (`@goodboy/ui`) owns read, clamp and save
  for these rails, the session sidebar and the drawer: while the pointer
  moves the width lives in a CSS variable (the drawer writes its own style),
  so nothing renders and nothing is saved until the drag ends. Precedent: VS
  Code, Zed and Linear sidebars.
- **Settings opens on a page, never on a grid.** The Settings door, ⌘, and the
  palette's Settings land on the page opened last, held in memory only
  (`lastSettingsFocus`, slice `settings-last-page`): the first open after the
  app starts lands on General, and a remembered page that no longer exists
  (a workspace page with no workspace, a provider that was removed) falls
  back to General (`resolveSettingsFocus`). A link that names a page (a scope,
  a section, a provider or a tool) opens that page. `scope: 'home'` stays as
  the alias for "the last page" and `SettingsStudio` resolves it once, then
  amends the history entry to the concrete page. The rail is the only index,
  portaled into the swapped column (`SettingsColumnNav`) or drawn beside the
  page when the column is folded: its four groups (App, Workspace, Providers &
  models, Integrations) come from `settingsDirectory`, with the status line of a row shown only when
  something needs doing (no quiet hints). A provider row says only what is
  wrong (Update needed, Not signed in, Error) or Not connected, never an
  identity or usage; the closed Providers & models group says how many
  providers it holds ("2 providers") unless one of them needs attention. Every page is also a palette entry
  (`settingsPaletteEntries`, `Settings: Storage`, `Providers: Claude`), built from
  the same list, so ⌘K and the rail cannot disagree. `Search settings` in the
  column filters those same entries by name and former name, lists them in
  place of the groups, and opens the one picked on the same history entry; with
  no match it says `No settings match`. The status lines are read
  once per studio (`useSettingsStatus`, on the minute clock of `useNow`);
  opening Settings starts no loading of its own (no storage scan, no branch
  scan, no provider refresh). Without a workspace the Workspace and
  Integrations groups are left out. Precedent: the VS Code settings editor and
  Linear's settings sidebar.
- **Settings nests items in its rail.** The App items (General, Shortcuts,
  Backup, Storage, Security findings) always sit under the
  App row as indented
  rows, whichever scope is active, so switching scope never moves a row above
  the pointer. The Workspace pages (Projects, About you, New sessions, After
  merge, Review replies, Permissions) sit the same way under the
  Workspace row (`workspacePages.ts`, `SettingsRailPageGroup`). The panel
  shows one item at a time. Providers & models nests
  Models and one row per provider, and Integrations nests one row per tool. Those
  two lists open and close with `Reveal`, and the rail stays one mounted
  element across scopes: `SettingsStudio` portals each scope's nested list and
  detail into slots it owns, and keeps a closing scope mounted until its list
  has collapsed. Every settings panel enters with `nav-step-in`
  (`SETTINGS_PANE_ENTRY`). So no scope adds a second rail column. Every scope
  panel keeps the reading width. Precedent: the VS Code settings table of
  contents and Linear's settings sidebar.
- **Workspace settings is one page per area, each part in a card.** A
  workspace page carries the page title, the workspace name and one line of
  help; every part is a `Band` with one heading style (eyebrow, icon, hint
  under it) and help written under each field, never in a tooltip. Only the
  page on screen mounts, so Permissions and Review replies compute nothing
  while another page is open. The old anchors (`projects`, `profile`,
  `general`, `after-merge`, `review-replies`, `permissions`, `danger`) now
  pick a page (`workspacePageOf`); `dev-project` lands on Projects with the
  conversion open. The workspace is renamed from the Projects page. The
  attribution line lives on New sessions only, and Review replies links to it.
  Turning a plain folder into a dev project is an inline flow in the Projects
  page (`ConvertWorkspaceFlow`), never a dialog: linking a plain folder opens
  Settings there once the add workspace studio has closed. Skills stays
  hidden behind its feature flag. Precedent: GitHub repository settings and
  Linear's settings pages.
- **Restore defaults and copy from another workspace share one inline
  flow.** The page menu (⋯ in the title row) of every page that owns settings
  offers `Restore defaults` and `Copy from…`; under a separator, the menu of
  every workspace page (Projects included) offers `Copy all pages from…` and
  `Restore all workspace defaults` for every page at once. The flow opens under the title as a band, never as a
  popover: pick the workspace, then a preview grouped by page with a
  checkbox per page and the from and to values, then the action row (`Copy N
settings`, `Back`, `Cancel`). It ends on a status line with `Undo`. The
  preview is computed when the flow opens (`loadFlowSources`), not on every
  render. Which keys a page owns comes from `pageKeys` (`features/settings/
pageKeys.ts`), typed so a new override key does not compile until it has
  an owner; provider defaults belong to Providers & models and are never
  copied, and neither are projects, folders, integration accounts,
  permission history or `bootstrap.*` keys. Restoring writes `null`; every
  override change of one copy or restore is one `patchWorkspaceOverrides`
  through the queued workspace writer. A field whose value differs from the
  default shows a faint dot after its label (`Changed from default. Default:
X`) and a `Reset` in its own ⋯ menu (`WorkspaceFieldRow`). Precedent:
  JetBrains Copy to Project and VS Code's Modified marker with Reset Setting.
- **Storage is the one place for disk space, scoped by a picker.** App >
  Storage lists every worktree folder Goodboy made, grouped by repository,
  under three filters: To review, In use and Kept. Each part is a card
  (`Band`) under a plain section title: the summary, Worktrees (with `Scan
another repository` at its foot), Artifacts of deleted sessions, and
  Transcripts and app data. Branches is its own App page (`branches` in
  `appSections.ts`, `BranchesPage`): the scoped workspace's after-merge rule
  with a `Change` link, `Recently deleted` (restore or delete for good,
  loaded from `deleted_branches` on open, which also releases the refs of
  deletions older than 14 days), then the branch list, safe ones first with
  `Show all branches` and a `Made by` picker. A scope picker
  (`StorageScopePicker`, `Listbox`) sits in the page header row next to
  `Suggest cleanup after` and `Check again` (`StorageHeaderActions`); the
  Branches header has the same picker without `Removed workspaces`
  (`BranchesHeaderActions`). `openStorage` and the
  cleanup notifications always land on Storage. The picker lists the current
  window's workspace, every other workspace with its own weight, `Removed
workspaces` (folders whose owning workspace is gone or was never linked),
  and `All workspaces` with the machine total. The scope drives the summary
  numbers, the worktree list and the artifact list together
  (`storageScope`, `resolveStorageScope`); it defaults to the current
  window's workspace, or to all workspaces without one. A scope other than
  all drops App data out of the bar into its own line (`state.storageScope`
  never splits app data by workspace) and keeps a faint, clickable `All
workspaces: <total>, <can go> can go` line under the numbers. The
  workspace page's own Notice, and the `open-orphan-worktrees` notification
  action, both open Storage already scoped to that workspace
  (`openStorage({ scope })`); the machine-wide `open-storage` nudge opens it
  scoped to all. The only bulk action removes clean folders idle past
  "Suggest cleanup after"; a folder with changes, an operation in progress, a
  writer lease or no git registration never joins it and says why on its row.
  Outside Settings there is one nudge and never a modal: `evaluateStorageNudge`
  sends a `storage-reclaimable` notification (action `open-storage`) when that
  amount passes 10 GB, then stays quiet for 14 days and speaks again only after
  it grew by another 10 GB. The thresholds and the last nudge live in the
  settings table (`storage.suggestAfterDays`, `storage.lastNudgeAt`,
  `storage.lastNudgeBytes`). Sizes are measured one folder at a time after
  boot, never on the boot path. The worktree scan itself sends nothing.
  On the Branches page, `BranchesSection` lists local branches
  only, in the same scope, grouped by project. It scans only when it opens:
  one `git for-each-ref` per project (`project_branches`), with the merge
  test cached by both tips and fed each branch's merged pull request head
  (`listMergedRequestHeads`). The `Made by` picker shows all local branches
  (the default), `Made by Goodboy` (branch names from `session_worktrees` and
  `retained_worktree_paths`) or `Yours` (plus branches whose tip is authored
  by the repo's `user.email`, shown `By you`); protected branches never show.
  The list opens on `Safe to delete` (merged by merge commit or rebase,
  merged by its pull request with nothing after the merged head, or never
  used), and `Show all branches` adds the ones that need a look (`Merged,
then N new commits`, unmerged and gone on origin, local only for over 30
  days, or older than 90 days; never preselected) and the kept ones. Every
  branch row and every Recently deleted row sit on one grid
  (`BRANCH_TABLE_GRID`, each cell marked with its `data-cell` name): select, branch,
  session title, session state, origin state (`On origin` / `Local only` /
  `Gone on origin`), the status on one line with how it merged as a muted
  suffix and in its tooltip, the last commit's age and the action. A
  Recently deleted row puts the project, the days since, the short sha and
  the days left in the same columns. Delete on a merged branch acts at once
  and a toast carries `Undo`; an unmerged one confirms above the bulk bar,
  which counts the commits it takes. `Also delete N on origin` sits above
  the bar only for Goodboy's own pushed branches in repos where GitHub does
  not already delete merged branches. Deletes use the same
  compare-and-delete and 14-day restore as the after-merge rule. A branch another worktree
  holds reads Protected, so its folder goes first from Worktrees.
  In the space cluster, under Worktrees, "Artifacts from deleted sessions" lists plans, reports
  and wireframes whose session is gone, under To review and Kept, with Open,
  Keep (30 days or always) and Delete behind an InlineConfirm. Its one bulk
  action deletes the unused ones. Artifacts never trigger a nudge on their own.
- **Security findings is its own App page, workspace-scoped.** It scans the
  text Goodboy keeps for a workspace (saved scripts today; workflow steps,
  the profile, reply templates and permission rules are named in the design
  but not wired to a scan call yet) for known token shapes
  (`scanTextForSecrets`, packages/core), fingerprints each hit with sha256,
  and never stores the value (`security_findings` table,
  `recordSecurityFindings`). A save reconciles that subject's findings: new
  fingerprints open, missing ones resolve, and a finding marked "Not a
  secret" (`dismissSecurityFinding`) stays dismissed even if the exact same
  value is scanned again, until "Flag again" clears it. The page needs a
  workspace; without one it says so instead of scanning anything.
- **Settings rail tone is state, never decoration.** Each row carries its
  concept icon from `CONCEPT_ICONS`. One reader, `railSubtitles({ state,
workspaceId, nowMs })`, owns every row's subtitle and tone (it replaced three
  separate selectors read straight from `SettingsRail`). `useSettingsStatus`
  calls it once per studio and hands the result to the rail and the home, and
  a test mounts the home on the strict `invoke` mock to keep it free of
  commands and loads at render. A dot appears only
  when something needs doing: warning on Providers & models when a connected
  CLI is too old for a model it serves or no provider is connected
  (`selectProviderAttention`, with the reason as the row subtitle), info on
  General while an app update is ready, info on Storage with "N GB can go" as
  its subtitle once clean idle folders pass 10 GB (warning when the disk has
  under 10 GB free and at least 1 GB can go, `storageAttention`),
  warning on Security findings with "N open" once the current workspace has
  an undismissed finding (`selectSecurityFindingsAttention`), and warning on
  Workspace with "N folders not found" once one of its projects reads
  `missing` in `projectGitStatus` (otherwise the row just names the
  workspace). Integrations carries a faint inventory subtitle with no dot,
  "N of M connected" over the whole integration catalog
  (`connectedInventory`). No rail row is red: the destructive actions sit at the
  bottom of their page, Reset (Delete all data) at the end of Backup and
  Disconnect at the end of Projects, and turn red only in their inline
  confirm. Panel sections sit on bands (`Band`, eyebrow outside) with gap between
  them and no `Divider`. The workspace page is the exception: one
  column of eyebrow sections 24px apart. Its title is the workspace name,
  renamed in place. Projects group Starred ahead of All (never in both), each
  a 32px grid row (star, kind, name, description, a base-branch chip only
  when set by hand, a Folder-not-found flag) with Open in editor, Copy path
  and Remove link in a reserved column, dim at rest; clicking the name opens an
  inline editor below the row for the rest (description, base branch, After
  merge for repos, folder, facts, footer actions). New session defaults sit in a
  two-column grid with each help behind an info mark, followed by the
  `After a pull request merges` segmented control, and disconnecting is a
  ghost row at the bottom that asks with `InlineConfirm`. Onboarding keeps the
  comfortable rows.
- **Master-detail is not the dual-sidebar anti-pattern.** A narrow list rail
  beside a detail panel is fine. "no left panel and right panel at once" is
  about two sidebars on either side of the content, which the app does not do.
- **Disconnecting is scoped.** A connected integration studio can disconnect
  from its own header. That clears the workspace credential, never a
  system-level session. A workspace running on the system `gh` CLI has nothing
  workspace-scoped to clear, so it offers no disconnect and points to
  `gh auth logout`. The control depends on credential state alone, not on the
  git remote. So a leftover scoped personal API key on a non-GitHub workspace
  can still be cleared.
- **A code-host record keeps its verbs outside a session.** A GitLab merge
  request opened from the inbox approves, merges, closes and reopens through
  the workspace's GitLab host. A Bitbucket pull request shows its verbs too,
  blocked with the reason until Goodboy has resolved it for a session. A GitHub
  pull request opens read only: description, review state, branches and its
  comments, with Launch session as the primary and Open in GitHub for the rest.
  Merge
  always asks first, and so does every destructive verb. The mount reads
  through the workspace's first repo project, so a workspace with no repo
  project stops at an empty state.
- **Every record header has the same four places.** `RecordHeader` puts the
  tool glyph, the identifier and the state on the identity line, with Open in
  the tool, the `⋯` menu and, in the inbox, close at its end. Under the title
  sits one action row: one primary (Launch session, or Open session once one is
  linked) and at most two tool verbs picked by state. Before a session is
  linked, the inbox adds Link to a session beside Launch session: a searchable
  list of the workspace's sessions, inline, that links the record to the one
  you pick. Everything else lives in
  `⋯` in a fixed order: rare tool verbs, Refresh, Copy link, Remove link to session,
  then destructive verbs after a separator. Editable properties change from the
  control that shows them (the Jira state opens its transitions). Launch
  session opens a popover with the goal and the brief; Enter from the inbox list
  opens it, or opens the linked session.
- **Every record body has one order.** Under the header, facts sit as pills in
  fixed slots (person, weight, place, labels, measure, links, time), each with
  its field name in the tooltip and time as a relative age with the date in the
  tooltip; a fact the tool does not have leaves no pill. The body is one scroll
  with no tabs: Description (ten lines, then Show more), then the tool's own
  sections closed behind a one-line summary (Checks, Changes and Approvals on
  merge and pull requests, Stack trace open and Breadcrumbs on Sentry), then
  Conversation with its count. `RecordSections` owns the order, the fact
  registries in `shared/detail-fields` own the slots. A changed file opens its
  diff in a full-screen dialog.
- **One conversation, one composer, what the tool can do.** Every record's
  Conversation is `shared/components/Conversation`: messages without cards, a
  thread's replies under a neutral rail (the last three open, the rest behind
  Show earlier replies), a code anchor chip on review threads, and a resolved
  thread folded into one row. Each tool has a pure adapter next to its client
  that turns its comments into threads and declares its capabilities: Reply
  where the tool has threads, Quote where it is flat (the post quotes the
  message, and mentions the author on GitHub), Resolve only where the tool
  resolves, reactions only on Slack. The composer sits in the drawer's dock,
  only when the tool lets Goodboy write. Reply (or `r` on a focused message)
  puts a Replying to bar above it, Escape clears it, ⌘↵ sends. A sent message
  shows Sending in place, and a refused one stays with its text, Retry, Copy
  text and Discard.

## Lens surfaces

- **A lens shows one level. A studio is a rail plus a detail.** Inside a lens,
  selecting a card swaps the list for the detail, and the trail or Back is the
  way back. No lens keeps a rail beside its detail. Review is the one
  exception, because its work happens in bulk: the focused comment sits in a
  column to the right of the list, in the layer, and the list stays visible
  and selectable. A studio pairs a rail with
  a detail and has no back link. Completed and discarded groups sit behind
  header toggles that hide themselves at zero. So a session whose runs are all
  done shows an empty state, instead of opening the last completed run.
- **A step chat is one explicit click**, never an automatic redirect.
- **A lens-wide toggle is its own row**, never inside an empty state's action
  slot.
- **Reference beside the work opens in the right drawer, not a rail.** Popover
  = pick one thing in ten seconds; drawer = reference next to the work; page =
  the work. The session context and the Explore file preview open there.
  Creating or configuring stays in a popover, navigating stays in the sidebar,
  and an object you work on is a child page in the trail. See
  [The right drawer](#the-right-drawer).
- **The Branch page is where the session's code is discussed and ships.** The
  contract of its header and tabs is in [The Branch page](#the-branch-page).
  Comments is one flow: the list grouped by word (Needs you, Working, Ready,
  Couldn't fix, Open, and Done closed) under the run status line, and the
  focused comment beside it in the page itself, never in a drawer. A comment
  in a fix run reads one of five words (Working, Needs you, Ready, Couldn't
  fix, Done); a comment not yet in a fix run reads Open, a group of the list and
  not a sixth word. A thread in the address is
  `s/{session}/branch/comments/t/{thread}`. A comment nobody started shows `Fix` on hover (and `F`), which opens the launch panel
  in the right column in place of the thread; a checkbox on hover picks comments (`X` on the focused row,
  Cmd+A for every fixable comment, open or couldn't fix, Esc clears) and the bar `N selected ·
Fix N` opens the same panel, or `Accept N` for ready comments. With no fix run
  the line under the tabs says `Fix N open comments`; the Overview card and
  the board card open that same panel pre-filled. Bulk answers, Retry N and
  `N accepted · Undo` (Cmd+Z) are described in
  [Concepts](./concepts.md). Cmd+A is not in the shortcut table:
  the system reserves it. "Resolve" names the area, never a button. The page
  exists with or without a pull request: without one the primary is `Create PR`
  (the creation form replaces the tab body, trail `Session › Branch ▾ › New
pull request`) and Comments lists the session's notes. Every door to a pull
  request lands here: the worktree row chip, the board card badge, the context
  strip and the Checks chip. Everything Comments shows comes from one durable
  conversation model and everything it sends goes out through one publisher, so
  a restart finds the same rows in the same states, and no second path pushes a
  reply or closes a thread. `Write review` is a child state of Files (the diff
  to comment on, then Line comments, Verdict and Summary in one column, and the
  action row at the end); the mode lives in the store per session and drops
  back when the page closes.
- **The resolver stays on its comment.** A resolver exists for one comment, so its
  home is that comment, never the Agents lens, and it has no page of its own.
  The comment shows its agent in one line from the first paint (model, age, the
  state word, and while it drafts the last thing it said). Its transcript opens
  as a drawer of kind `transcript` on the Comments tab of its Branch, in the
  space on the right, so the list and the thread stay where they are: from the
  run status line (**Open transcript** opens the drawer in place), from `…` →
  Agent transcript on a thread, from the thread crumb menu, from a fix run row
  in Activity, from a notification, the agent-started toast and the palette.
  `fixRunTranscript({ sessionId, agentId, threadId })` builds the move (the
  Branch Comments place with that thread, and the drawer), and
  `canonicalLocation` rewrites every older address to it: an `agentPlace` for a
  resolver, and the former Fix run address (`lens: 'review'` with the resolver
  and a `thread` target, `.../review/t/{thread}/agent`), on a move and on a
  restore from history, which reopens the drawer. The thread is the one the
  address named, or the first thread of the attempt. The drawer takes the
  saved drawer width, like Ask, and reads, top to bottom: the fix run summary (`FixRunSummary`: while
  the run works, one status line, `Working · 2m 48s · Opus 5.5 · High`, and a
  question the run waits on; the comments the run covers, each a row with
  author, file and line and the first sentence, a link that keeps the drawer
  open on that comment, and the comments fixed together, opened filtered in
  Comments; after it ends, What it did, the run's final summary, never shown
  while it works; its commits with a note when a later rewrite folded one,
  nothing while the run works with none, `No commits yet` once it ended
  without any, decided by `fixRunCommitsViewOf` and never an unresolved
  placeholder), the transcript as one stream right under it, and a field to
  write to that agent. The scenes `resolve-transcript-drawer-multi` and
  `resolve-transcript-drawer-multi-done` show one run over four comments. The question card also
  stays in its thread. Accepting, replying, editing and Push live in Comments,
  never in the drawer. In Activity a fix run is one row, `Fix run · #318 · 9
comments`; the Needs you row for the pull request calls `openReview` with the
  destination `{ kind: 'threads', mountId, threadIds: [first comment that waits
on you] }`. Any other agent keeps its page, and its pane tab is part of the
  address: `agentPlace({ sessionId, agentId, pane })` asks for `brief` or
  `transcript`. Without a `pane` the pane picks its own tab (`agentOpenTab`: an
  open question opens on Brief, otherwise Transcript). The key `agentPane` is
  written only by the navigation slice, follows the page like the other
  targets, and comes back with Back and a window restore. Tab clicks inside
  the pane stay local and do not rewrite the address. The `threads` destination needs no
  mount and no pull request: Review focuses the first thread of the set it
  has, and the set stays in `reviewSelections[sessionId]`. The destination
  `{ kind: 'notes', threadIds }` does the same for diff notes and first sets
  the review source to the local notes, so it lands on your notes even with a
  pull request open. Back, or Up when
  Review is the entry below, returns to Review with that comment focused, and
  Up from a page reached any other way opens Review on that comment. There are
  no return pills: the Diff and a fix run transcript come back through Back.
- **The switcher and the palette list only destinations the session can
  use.** One function feeds both. Context is a drawer, not a destination: the
  palette offers **Show context** (⌘⌥C) and neither lists a Context page.
  Explore is always listed and
  browses the active working directory. Diff and the other branch lenses need a
  branch. Pull request is listed on every code host, GitHub included. A tool
  lens appears once that tool is connected.
- **A lens surface is reached from the overview or from the trail's
  destination switcher, never from a rail.** Rows and chips inside the
  overview route to it, by expanding in place or opening a side panel. Counts
  and dots are read-only signals on the row that routes there. Session
  lifecycle actions are not navigation and do not belong on those rows. A
  count on a row is a promise about that destination. It counts the items the
  destination lists. Every surface that routes to the same destination shows
  the same number from the same selector. A group of items with no home at the
  destination gets no badge pointing there.
- **The session list shows ALL sessions**, never filtered to running only. The
  user's own filter by project and the fold after eight rows hide nothing the
  user did not ask for: a session that needs you is never folded.
- **A blocked action is re-routed, never hidden.** A blocked workflow advance
  gives the reason on the CTA and opens an inline confirm before anything
  starts. With auto-run off, nothing advances without a click.

## Starting a project from nothing

The empty screen, the workspace launcher, the workspace switcher and the
command palette offer **Start a new project** and **Open a folder**, in that
order. The wizard's project step offers the same two. Settings, Workspace,
Projects names its form **Start a new project** too and opens the same form in
line. **Add workspace** names only the studio that groups projects. Start opens
one inline form (`NewProjectForm`), never a dialog: a name, a location (the
last parent folder, else the home folder, changed with the system picker) and
the four things the click does. A name that exists in the parent says so and
offers **Open it instead**. Create project makes the folder, a repository on
`main` with a first commit that holds `.gitignore` and nothing else, one
workspace and project named after it, and opens the first lap session.

The first lap session shows one banner under the crumb bar: where it works
(project folder, `main`), that nothing is published, and **Publish**. Publish
opens an inline panel: create a repository on your own GitHub account
(visibility is always an explicit pick) or use any HTTPS or SSH address. When
the project folder has changed files the primary action reads **Publish and
move my work**. When `main` appears on the remote, whoever pushed it, the
banner turns into the move card. A move in progress shows its own banner, and
a finished one leaves a report on the bootstrap session until it is dismissed.
The project git pill offers **Publish** on a repository with no remote.

## Creating a session

The new session form always lands on Overview. It offers no agent-kind picker
before the session exists: the kind is a choice made inside a session, not a
condition for having one. Its issue sources come from a curated allowlist, not
from every connected provider, because a connected code host does not mean an
issue picker. The section hides when none of the allowed sources is connected.
Creating a session picks no project either. The session is born on the
workspace with only a container directory, and projects are materialized when
the work reaches them ([concepts.md](concepts.md) → Lazy sessions).

## The right drawer

Every drawer is one primitive, `DrawerColumn` from `@goodboy/ui`, never a
split nested inside a pane. `AppShell` puts one beside the main area, and a
studio body puts one beside its list. It opens at 400px, resizes from 340 to
560px from a handle on its left edge, and keeps one saved width
(`goodboy:right-drawer-width:v1`, clamped on read and written once when a drag
ends) for every drawer. It is a
floating card: 8px from the top, right and bottom edges and from the column,
radius 10 (`rounded-frame`), `bg-subtle`, a hairline border. A drawer opens
beside the page: column and measure pages are centred, and the column slides
left to re-centre in the space left of the drawer (full tier work surfaces
keep their left edge and give up their right). When the main area minus the drawer's track
(insets counted) and the two gutters would leave it under 560px, the card lies
over the right of the main area with a shadow and no scrim, and the main stays
interactive; pushing, it has no shadow. Closed,
its track is 0px wide and `inert`. Opening and closing move the track in 180ms ease-out (none under reduced
motion), and the centred column slides with it while
the card slides 12px in; over the page it slides 16px in 200ms; a new kind in
an open drawer fades its content in 120ms. It never touches the sidebar
preference.

One drawer at a time, per window. The `drawer` store slice holds
`{ kind, sessionId, payload }`: `openDrawer`, `closeDrawer` and `toggleDrawer`
(pressing the trigger again closes it). **The open drawer is part of the
history entry's focus.** A forward move (crumb, sidebar, palette, a child such
as an agent) arrives with it closed; Back and Forward bring it back as it was;
Escape and its X close it in place. The one exception is the `ask` drawer: a
forward move that stays in its session keeps it open (`keepAskDrawer` in
`navigate`), so a chip in an answer changes the page beside it; leaving the
session closes it, and Back brings it back like any drawer. Another drawer
opened from the page replaces it. Focus then returns to the trigger. `app/components/DrawerHost` turns a `kind` into its content, framed
by `DrawerFrame` from `@goodboy/ui`: a 44px header (icon, title, count, at most
one action, close), one divider, a `ScrollFade` body and an optional dock. A
body that scrolls itself, such as a chat, passes `scroll="self"` and fills the
frame instead. A new kind adds a variant to `DrawerContent` and a case to the
host.

**An object that belongs to where you are opens in a drawer; the page changes
only by an explicit command.** A plan read from the planner that wrote it (the
row in its chat, in its Brief, or a plan row in Activity) stays on the agent
page: the address does not change, the page keeps its scroll, and the drawer
sits beside it. The same goes for every artifact kind read from its work: a
report or a wireframe row in Activity, and a report or wireframe chip in a
transcript, open the same `artifact-document` drawer (`DrawerHost` hands a
report or a wireframe to `ArtifactReadingDrawer`, which shows the report or
the wireframe stage, with Open in Artifacts and Expand). The palette and the
object menu's **Open** are transit and keep navigating; the Artifacts page
stays the library. Going to the Artifacts page from a drawer is a command of
its own, **Open in Artifacts** in the drawer header, and it is the only page
change. The `artifact-document` kind
carries `{ artifactId, revision }`; `revision` is `null` for the current
version and a number for an earlier one read from the revisions. It is the one
drawer that can expand: it opens at half the window (`sizing="half"` on
`DrawerColumn`, with no resize handle, capped so the page keeps 560px and the
drawer still pushes), **Expand** takes the whole column and
lies over the page (`sizing="full"`), and Expand toggles back. The choice is
kept per session in `documentDrawerExpanded` and is forgotten when the session
is archived. The header holds the title, `vN`, the state chip, **Run plan**,
Open in Artifacts, Expand and Close; Escape closes it. While the planner
revises the plan the body is dimmed and Run plan waits.

The `ask` kind carries no payload: the thread on screen lives in the `ask`
slice (`askThreadId` per session, `null` for a fresh thread). `AskDrawer`
(`features/session/ask/components/AskDrawer/`) uses `scroll="self"`: a
`ScrollFade` thread with the composer below it, never a dock. Its header is
**Ask**, the session title as the count, and **New**. The body starts with
**Right now** (no model call: `askRightNow` over `askDigestOf`, the five
comment words, running agents, open questions and the session cost) and three
suggested questions; once a thread has turns it folds to one row. Then
**Earlier** threads on a fresh thread, then the turns. An answer chip that
targets a page navigates (the drawer stays, see above); a chip that targets a
plan or another artifact opens it inside the drawer under **Back to answer**,
and Escape goes back before it closes. Buttons come only from verbs the action
registry offers right now (`askVerb`, `useAskActions`): **Answer question N**
prefills and focuses the answer field, **Review N ready** runs
`session.review`, **Tell {agent}…** prefills the agent's box and runs
`agent.message`. A verb with a confirm shows an `InlineConfirm` first. Nothing
runs in one click.

The `transcript` kind carries `{ agentId }` and shows one agent's conversation
beside the page, at the saved drawer width with its resize handle (sizing
`default`, like Ask, so it never resizes after it opens), without selecting
that agent: the page
under it keeps its address and its trail (`loadAgentTranscript` with
`isSelecting: false`). It reads, top to bottom, a lead (the fix run summary
for a resolver), the transcript, and a field to write to that agent, which
sends with `sendTurn` to that agent and keeps its draft in `agentDraft`. A
resolver's transcript always opens here, on the Comments tab of its Branch
(see The resolver stays on its comment).

The `context` kind carries `{ tab, view }`: `tab` is `goal`, `decisions` or
`summary`, in that order, and `view` is `current` or `versions` (the old
versions of that slot, inside the same drawer, with Restore; Escape leaves the
view before the drawer). The **Context** chip in the session header toggles it
on any page of the session, and so does ⌘⌥C; ⌘⌥G, ⌘⌥E and ⌘⌥U open it on Goal,
Decisions and Summary. The first open shows Summary, later ones the last tab
used in that session. The chip carries a quiet dot, never a count, when the
decisions ledger changed since the drawer was last seen
(`sessions.context_seen_at`, compared with the ledger rows in
`decisionChangesSince`: added, removed and reworded rows, leaving out what you
did yourself and what came and went unseen), and opens on Decisions then. The
drawer marks it seen when it opens, on any tab, and again when it closes. A
session never looked at starts its baseline the first time it loads, so the
rows it already had never read as new. The chip shows
a pulsing dot while the summarizer writes and a danger glyph when it failed,
with Retry in the drawer's **Context updates** row. The old addresses `s/{session}/context`
and `context/goal`, `context/decisions`, `context/summary` resolve in
`canonicalLocation` to the overview with this drawer open on the matching tab.
The drawer header has one action, **Copy context**, which copies Goal,
Decisions, Summary and Open questions in that order (`shareableContext`).

The drawer sits on the `subtle` panel surface, like every `DrawerFrame`.
**Context updates** (`ContextUpdates`, a `Collapsible`) sits above the tabs:
closed, it says `Updated 2 min ago`, `Queued`, `Updating…` or `Couldn't update`;
open, it lists the last round (`summarizerRounds`: when, how many turns or a
full pass, model and effort, tokens and cost, what changed as a comma list of
links to the tabs, every value on the same column), **Change model** (Settings, Providers & models, Models, scrolled to
Step summaries) and **Update now**. Update now queues a consolidation pass
through `requestContextUpdate`, behind any pass in flight and never beside it;
`summarizerPending` holds the turns waiting and whether a requested update is
queued, and the row reads only that queue state. The tabs are a
`SegmentedTabs` strip at its own width; the Decisions tab carries the count and
the change dot. The engine has one name, **Context**, in Activity, in the
drawer and in these docs.

Every tab reads as labelled blocks (`ContextBlock`: a `fill` band with an
eyebrow title, an icon and a count). A block shows its key line first and
folds the rest behind **Show N more** (`KeyLineList`); `summaryItems` splits a
body into items, one per top-level bullet with its sub-bullets, or one per
sentence for prose. Summary shows State, Next, Open questions (the session's
open questions, read only) and Learned, then any section the summarizer did not
name. Goal is one block with Edit and Versions in its header. Decisions shows
the changes block, then Active, then the folded Replaced and removed group,
split into Removed by you and Replaced with a search across both.

The Decisions tab reads the decisions ledger ([turns.md](turns.md#the-decisions-ledger)).
When something changed since the previous look (`sessionDecisionsBaseline`,
the `context_seen_at` captured when the drawer opened), it starts with
**Changed since you last looked**: one line per row, `+` added, `−` removed
(`Replaced by 7` or `Withdrawn`), a pencil for reworded, and a click scrolls to
the row and highlights it. Then **Active**, with its count: active decisions
newest first, each with its number, at most two lines of
text, its why as one muted line under the text when the row has one (clamped
to two lines, **Show more** when longer; older rows show nothing), and who
settled it (`Implementer · turn 9 · 1h`, `You · 2h`,
`replaces 5`). An added row also carries `New` until the next open. A row the summarizer reworded says `Reworded by Goodboy` with
**Show previous**. Clicking a row opens it (**Show more** on the text when it
was clamped, same toggle), revealing Edit (a reword of yours) and Remove.
Remove withdraws at once, with no confirm, so agents see it retired, but the
row stays where it was, struck through, with a per-row Undo, and the block
opens with `N changes on this visit · Undo all` while any are pending.
Leaving the drawer, by closing it or switching session, drops them into the
bottom group, **Replaced and removed**, split by a `Removed by you` /
`Replaced` filter with a search over both; only the rows you removed offer
Restore. Every closed row is struck through, points at the decision that
replaced it (`→ 7` scrolls there and highlights it), and quotes the reason.
The dock adds a decision of yours on Enter. While the summarizer writes, rows
stay readable and every edit waits. A row that arrives while the drawer is open
comes in with `Reveal` (200ms), and a reworded text fades in (180ms,
`animate-text-swap`); both are `motion-safe`, so reduced motion swaps at once.

In Activity, a `decisions_changed` row that carries `decisionChanges` is a
disclosure: the row toggles (`Show changes` / `Hide changes`, `aria-expanded`)
a diff under it, `+ D12`, `D3 → D12` with the reason, `− D5` with the
withdrawal reason, at most six lines, and **Open in Context**, which opens the
drawer on Decisions with those numbers in `payload.highlight` (highlighted for
2.4s, the closed group opened when one of them is there). The expanded row
adds the diff's fixed height (`decisionChangeDetail`) to its item before
`layoutTimelineRail`, so the rail and lanes run through it.

The `artifact` kind carries `{ artifactId, tab }`, with `tab` either `details`
or `chat`. The artifact shell opens it from its `Chat` and `Details` buttons;
the drawer header switches between the two. It also closes when the focused
artifact changes. While it is open, Escape closes the drawer before it takes the
artifact back to the list.

A studio covers the whole window grid, so it cannot use that column. The inbox
record opens in the same `DrawerColumn` inside the studio body
(`InboxStudioLayout`), with the same width, card and motion. Escape closes the
record before the studio.

`conversation` (payload `{ threadId }`) is the focused comment in Review. It
rides the drawer slot of the location, so Back from the Diff or from the
resolver's page finds the same comment focused, but it never opens the shell
drawer: `selectDrawerPanel` leaves it out, `DrawerHost` has no case for it, and
Review renders the comment in its own right column beside the list, with the
trail visible. The column reads its own width (`@container`): below 56rem the
list folds into an `N of M` counter with previous and next. This is the old
Review layout; the Branch page's Comments tab has its own, described under
Comments below.

`scriptRun` (payload `{ scriptKey, mountId }`) shows one script run's output.
`ScriptRunDrawer` reads the run from `scriptRuns`, where the one
output subscription per run lives, so closing the drawer loses nothing. The
header action is Stop while it runs and Run again after; the body is a status
line (state, time, project, branch), a `Command` disclosure closed by default,
and the log, which follows the tail until you scroll up and then offers
`Jump to latest`. Error lines carry a danger bar and an `err` prefix. The dock
says `Following output` while it runs and the exit, time and Copy output after.
A run records the mount it ran in, so a project mounted twice reopens on the
right branch.

`file-diff` (payload `{ source, path }`) peeks at a diff without leaving the
page. The source is a worktree (a file opened from the chat) or a commit (a
GitHub commit link clicked anywhere in a session; outside a session the link
opens in the browser). It shows unified and wrapped, and a worktree peek offers
`Open in Files`, which opens the Files tab of the Branch page on that mount with the file in focus.
There is no notes drawer: your notes are `Local` items in the Comments tab of
the Branch page, next to the provider comments, and a note without a branch
sits in `Unassigned notes` on the Session overview.

## The Branch page

One page per branch (`features/branch`) replaces the PR, Review and Diff
pages. Every diff in the app is still one `DiffView` (`features/diff`): the
Files tab, Write review, the Bitbucket pull request changes and the
`file-diff` drawer. Each one lists its files through `orderLikeTree`
(`features/diff/lib/changeTree.ts`), so the order is the tree's everywhere. The
Rust side runs git with `core.quotepath=false` and `parseUnifiedDiff` reads
quoted headers, so a name with accents is its own file.

**Header.** Title (`#318 Ledger export`, or the branch name without a pull
request), the line `Draft · project · head → base · ✓ N checks`, one primary
and `⋯`. The primary is the first that applies: `Rebase on main`
(`Open terminal` while a rebase is stopped, with `Abort rebase` beside it),
`Push N` (accepted threads, then unpushed commits), `Publish N replies` (the
fix is already on origin), `Retry N`, `Create PR`, `Ready for review`, `Merge`
(`branchPrimaryOf`). Push, Publish and Retry go through the existing publish
machinery: a frozen preview in line under the header (`PushBanner`, the only
one), drift and the result per thread. Only the header pushes: a thread has no
Push, Push again or Sync button. With an accepted thread opened in Comments the
primary reads `Push 1` (it counts threads) and pushes just that fix
(`preparePublication` with `isolated`, `isolatedPushOf` unchanged); the preview
names the tip commit, the earlier commits that go along, and the comments that
still need you. With none opened it reads `Push N` for every accepted thread.
`Publish N replies` and `Retry N` stay the header primary of their state. A blocked primary stays visible, disabled, with its
reason. `⋯` holds the rare lifecycle (Edit title and description, Request
review, Convert to draft, Close or Reopen, Open on GitHub, Copy link) and the
branch actions (Change base branch…, Open terminal, Open in editor, Copy
branch name, Copy patch).

**Comments.** A closed Description, then the list (`Needs you`, `Ready`,
`Done`, local notes included with a `Local` label) and the open thread with the
code around the commented line above it (`hunkAround`, linking to Files). The
properties (State, Origin with the code host link and Copy link, Attempts with
the transcript, Fix commit, Author) sit in a rail only when the pane is wide.
Every Branch tab uses the full pane width (`PaneShell width="full"`), and the
Comments tab reads the width of its own pane (`branchLayoutOf`, so a wide
sidebar or an open drawer narrows it): from 1280px a 300px list, the thread and
a 288px margin rail; from 900px the list and a wide thread, with the properties inline under
the thread; under 900px the list, then the thread with `‹ Comments` (Up). The
selected row stays selected on the way back. `branchLayout.test.ts` pins the
widths a 1024px window gets with a wide sidebar and an open drawer. Fix, Resolve without a reply and Stop live on the thread and its
properties; Fix launches from the list or the thread, never from Files.

**Files.** The branch against its base with the change tree on the left
(`ChangeTree`, 320px by default, from 900px of pane up; drag its right edge or use the arrow keys to resize it, never past 30% of the pane, saved as `goodboy:diff-tree-width`): folders first, then files, alphabetical,
and the diff follows the same order. A chain of folders with one child is one
row (`src/ledger/export`). A folder row holds a progress ring (empty, partial,
or filled with a check once every file in it is viewed, tooltip `3 of 5
viewed`), the path and, only while it is collapsed, its file count and its
`+N −N` in one muted tone (no green or red; an open folder shows none, its files
carry them); a file row holds a small
check when viewed (its name goes grey) or an amber dot when it changed after
it was viewed, the name (a rename shows `from <old path>` under it, a deleted
file is struck through), its open notes, `+N −N` and the status letter.
A long name is cut in the middle so its extension stays (the full path is the tooltip),
and one key hint line ends the tree (`? all keys` opens the full list).
`N of M viewed` and a 2px bar head the tree, and no longer sit in the toolbar.
Under the head a filter field (`T` focuses it, `Esc` clears it) matches a
subsequence of the path, `Unviewed` and `With notes` chips narrow it further,
and `Folders | Kind` (on the chips' line) regroups the tree under Source, Tests, Config and
Docs (each file then shows its folder beside the name). The filter narrows the
diff as well as the tree, `Showing n of N` with `Clear` says so, and a filter
that hides everything leaves `No files match` with `Clear` in both panes
(`filterFiles` in `changeTree.ts`). Generated files (lockfiles, `dist`, `build`,
`vendor`, minified and map files) sit in a closed `Generated` row at the bottom
in both groupings and at the end of the diff. Viewed marks are stored per session, mount and view, so two repos in one session
keep their own; marks saved before that are read until the mount saves its own.
Click a file and the
diff scrolls to it; scroll the diff and the tree highlights the file in view and
opens its folders. A click, `J`/`K`, next unviewed and `Viewed` call the diff's
scroller directly (`registerScroller` on `DiffView`); `focusPath` is only for a
link from another page such as `Open in Files`. The diff resets its mounted
batch, its observer and its place only when the list of paths changes, never on
a new array with the same paths, so marking a file viewed or a note changing
neither shortens the page nor drops an open composer. Folder row ids start with
`dir:`, so a folder and a file with the same path never share a key. The tree and the diff share one `useReviewState` (active
file, open folders, notes, `Viewed`), and a model in `features/diff/lib/changeTree.ts`
builds the rows. `Viewed`, notes on
lines and files, `Post open notes to the PR` and `Write review` (which swaps
the tab body for the review form with line drafts). It carries no Fix, Push,
Rewrite or `PR #N` control.

**Commits.** The home of history: the branch commits and the rewriter are one
surface (`CommitsHistory`), with `Refresh` and `Backups` at its top. Backups
(`Restore previous history`, `Restore branch`) and the result of a run (`Undo
rewrite`) live here. There is no Rewrite history page: the old `files/…/history`
address, the palette verb, a mount row's `Rewrite history` and an Activity
history row (which has no verb and no `⋯` of its own) all land on
`branch/commits`. **Checks.** The checks of the pull request.

The Branch page shows one branch. The trail carries the choice (see Segment
menus); there are no worktree tabs. Every rewrite takes the shown
mount's `mountId`, never the active mount. `Rebase on main` replays the
branch on origin with the history engine and runs no agent. The engine first
predicts the replay in memory; when it conflicts, the button reads
`Rebase on main · N conflicts`, and only then
the hidden History rewriter merges the edits in a throwaway copy. The branch
moves only after the engine checks the result, with a backup ref and a push
with lease.

The Commits tab draws the branch as a graph (`history_graph`): a grey main
trunk with its head node (`main is here now`, how many commits it gained,
`Start from today's main`), your branch leaving it at the real fork point, one
row per commit newest first, and `Your branch starts here` at the fork. Fact
chips over it say how many commits are yours and how many stay after Apply,
how far main moved, and how many are already online. The big list is always
the branch as it is (Now) and never reorders while you plan; beside it, After
Apply draws the planned result with a dashed lane, each node level with its
own row when the order allows. Under 760px of content the side graph becomes
a `Now | After Apply` toggle. Every action has one color (Keep green, Fold in
azure, Combine yellow, Move violet, Rename neutral, Remove red, Start from
today's main grey) used on the row's change mark, its node, a 2px edge, the
dot of its "what happens" line and its planned change. Drag a row between two
others to move it and drop it onto a row to fold it in (fixup, `Keep title`).
A folded row carries one always visible control, `Keep title · Keep both ·
Separate`: `Keep both` combines (squash) and `Separate` makes it its own commit
again, the same edit as `Separate` in its menu; its planned change keeps
`Keep title | Keep both`. The row buttons (icons) and the `⋯` menu sit in a
slot reserved at the end of the row, so they never cover the control; a folded
row shows only the menu. The drag is pointer events with our own hit testing
(`useHistoryDrag`), never HTML5 drag and drop: the window's native file drop
owns the drag session on macOS, and the composer's file drop needs it on. Keys
on a focused row: Alt with the arrows moves, C folds into the one below, S
combines keeping both messages, R or Enter renames, Delete or Backspace
removes, ⌘Z undoes the last edit. Hovering a row, a node in After Apply or a
planned change lights up the same commit in all three places; on a fold,
hovering any member or the node lights the whole group, the commit that takes
them in and every commit it takes in. Nothing touches
git while you edit: the plan is a draft saved per worktree in `history_plans`,
the planned changes are derived from it (each with its own `Undo`, plus
`Reset all`), and once the plan rests for a quarter of a second the engine
predicts it in memory with one `git merge-tree --stdin` process for every
commit and one `git fast-import` that writes the predicted commits (git 2.45
or newer; older git spawns one merge and one commit per step). A predicted
conflict shows on its row (`may conflict in webhook.ts`) and in a notice with
`Rewrite with an agent`. The action row sits at the end of the content
(`FormActions`, no dock): `Apply`, or `Apply here only` and `Apply and update
online` when the plan replaces commits that are already online, which also
shows the notice about the pull request and the push with lease. Apply never
rewrites the branch first. `history_plan_run` checks the worktree (right
branch, nothing uncommitted, head where the plan started), replays the whole
plan on a temporary git worktree outside your checkout, reports each step
while the page says `Trying your changes on a temporary copy. Your branch is
untouched until this finishes.`, checks the result (no conflict left, no merge
commit, the planned number of commits, and the same tree as the branch, or the
branch merged with today's main, except the files of removed commits), and
removes the copy on every exit. A stop names the step and why and says the
branch is exactly as it was. Only a passing check moves the branch, after a
backup ref: the files move first with a two-way `read-tree` that refuses to
overwrite local or untracked work (ignored files and folders included), then
the branch ref moves with a compare and swap while HEAD still points at that
branch, and nothing ever runs a hard reset on your checkout. The worktree and
branch the trial ran on travel with the run to the move and the push, and any
switch stops them. A rewrite interrupted by a crash is settled before the next
one checks the worktree; a record Goodboy cannot tie to its branch blocks
Apply with a notice instead of being guessed. Empty commits are
kept; only what the plan removes or folds disappears. Commits before the first change keep their shas, so an edit to local
commits never rewrites what is online. The push always carries
`--force-with-lease` on the online sha the plan already contains
(`history_remote_lease`), never a bare force or a sha read after the trial;
a push that lands during the trial stops the apply before anything moves; if
origin moved, nothing is pushed and the result offers `Bring them into the
plan`, which fetches the commits origin gained, replays them on top of the
rewrite in a copy and leaves `Push with lease` on the new origin sha. The
result section lists what changed in the action colors, says whether the
online copy was updated, what the check found, and the backup, with `Restore
it` and `Done`. Every move leaves a backup under `refs/goodboy/backup/`, in a
namespace made from the full branch name, kept 30 days; `Backups` in the page menu lists them with `Restore previous
history`, which moves the branch back and, on a branch with an upstream,
pushes it with a lease only when the online copy has nothing newer than that
backup, or is the last rewrite this page pushed and the online copy it replaced
was already in that backup; otherwise it stays restored here and the page says
nothing was pushed.
Backups made while restoring are kept past the 30 days. The newest 20 per
branch are kept, and an older one is dropped only while a branch, tag,
remote-tracking ref or another restore backup still contains its commit. The
newest backup of a branch is never pruned. Backups made before the current
naming never move: they show read-only as older backups under every branch
whose name matches, can't be restored from the page and are never pruned. History rewriter's writable directories
are its copy, that copy's own git admin folder, the object store and the
packed-refs lock file git takes when it clears a rebase marker. They confine
it only under an OS sandbox or permission check (Codex in `workspace-write`,
Claude outside `bypassPermissions`); in `bypassPermissions`, the default, the
kickoff's rules are what keep it inside the copy. Temporary copies left by a crash are removed when the
app starts. Each copy lives in a folder Goodboy reserves atomically under
`~/.goodboy/history-copies`, never in a temp folder a sandboxed agent can write, with an
owner file and a lock it holds while the copy is in use, and nothing deletes a
copy without both, so a second window never removes a copy in use. The owner
file records the copy's git admin folder when the copy is made; the rewriter's
roots and the cleanup use it only while it is `<common>/worktrees/<name>` and
its `gitdir` names exactly that reserved copy, never the copy's own `.git`.
Codex rewriter turns also lose write access to the temp folders. One line sits
above the code and replaces the old toolbar and its counts: `Comparing <base> ←
<branch> · All N commits ▾` on the left (the base is the mount's own base branch,
never a fixed `main`; a commit view reads `Commit abc1234`, the working tree
`Working tree`, `Staged only` or `Unstaged only`), and `Display ▾`, `Post notes`
and `Write review` on the right, because the view decides which files you see,
not what you do to the branch. `Display` holds `Unified | Split` and `Wrap long
lines` (on by default, saved as `goodboy:diff-wrap`; split always wraps). The
file count and the `+N -M` sums live in the change tree only. The diff scope has its own
keys, wired by `useDiffKeys` in `SessionDiffPane`, all in tree order (folders
first) and never while typing in a field: `J` and `K` go to the next and
previous file and skip the files of a closed folder, `[` and `]` are aliases;
`H` closes and `L` opens the folder of the file in view; `V` marks that file
viewed and goes to the next unviewed one; `N` goes to the next unviewed file,
wrapping to the first; `F` puts focus on the tree; `/` and `T` are one action
(`diff.focusFilter`, `T` is its alias) and focus the filter field, the one input
in the tree column that carries `data-diff-filter` (it opens the tree first when
it is folded); `⌘⇧B` shows or hides the tree (`⌘B` stays the column).
A line under the tree lists them once, from the registry (`keyHelp.ts`).

Big and narrow cases (`useNarrowPane`, `useTreePanel`, `lib/windowRows.ts`).
Past 120 visible rows the tree draws only the rows in view plus a margin (fixed
28px rows, 44px for a rename), so 512 files scroll as light as 20. A change
over 300 files starts with its deepest folders over 50 files closed (a parent of
a big folder stays open), and starts that way again when a different set of
files arrives, not on a reload of the same files. The diff keeps its own
progressive mounting; the patch parse stays on the main thread because a
512-file patch parses and becomes a tree in about 2ms (`largeChange.test.ts`
fails over 100ms, the point where a worker earns its cost). Under 900px of pane
(a 1024px window with the session sidebar open) the tree is a 44px strip with
the progress ring and `12/46`; click it, or `F`, and the tree opens over the
diff with no scrim; picking a file or `Esc` closes it. `⌘⇧B` on a wide pane
folds the tree to the same strip. While the diff loads the tree column shows
skeleton rows and `Loading files…`. An empty scope drops the tree, the strip
and the toolbar and shows one centred empty state on the page column
(`DiffEmptyState`): what is empty in plain words, the scope picker inline and,
when the other scope has files, one button that switches to it (`Show branch vs
main (6 files)`, `Show working tree (2 files)`; `alternate` on `useSessionDiff`
counts them). Files opens on the branch against its base when the working tree
is clean and the branch has commits ahead, unless the scope was picked in the
picker. The `brand-diff-large` scene is the 512-file case, `brand-diff-many`
the 40-file one, `brand-diff-empty` the clean branch and `brand-diff-edits-only`
the one that matches its base but has edits.

A jump is instant, not smooth: file bodies keep
`content-visibility` with estimated heights, so for a few frames the view
measures the picked header and snaps it back to the top until the heights
settle. The picked file stays the active one until you scroll, so `J` and `K`
start from it. Each file has a sticky header (status letter, path, `from <old path>` on a rename,
changes, comment count, a visible `Comment on file` button, `Viewed`, `⋯` with
Open in editor, Copy path, Comment on file); a viewed file collapses and opens again when you unmark it, from the
header or from anywhere else, and generated or binary files start collapsed.
`Comment on file` (the header button, the `⋯` entry, and a button on the file's
tree row on hover or keyboard focus) opens a composer under the header and
scrolls to it: on a branch with a GitHub or GitLab pull request it saves a
review draft on the whole file (a `pr_review_drafts` row with `line` 0, no
migration), sent with the next review as a GitHub `FILE` thread (pending
review, `addPullRequestReviewThread` with `subjectType: FILE`, then submit) or a
GitLab discussion with `position_type: file`; without a pull request it saves a
local note on the file (the same note a line gets, without an anchor). Either
one sits under the file header, counts in the header and the tree row, and the
note shows in Comments like a line note, with the file path and no line.
A file draft is stale, and skipped on submit, only when its file leaves the
pull request. Rows are a CSS grid with `role="grid"`, never a table. Click a line
number to comment, drag or shift-click to cover a range; the composer and the
threads sit under the last line of the range. ⌘Enter saves, Escape cancels.
`+ Add note` on a line saves the note with the project and branch of the active
mount (`diff_comments.project_id` and `branch`, m223). A note shows `Close note`
and `Delete` in the diff; Fix lives on the note's item in the Comments tab. While a fixer
works on a note, Close note and Delete are disabled with "A fixer is working on
this note". Close note goes through `closeResolvedNote`, the same path the
Comments tab uses. The Files tab shows only the notes of its own branch; a note
written before m223 is assigned to a branch only when a resolver run on a known
mount used it, and the rest wait in `Unassigned notes` on the Session overview,
each with `Move to` and `Discard`. `Move to` names the branch when the session
has one, and opens an inline row of branches (the active one first, one per
project and branch, no dialog) when it has several; the move goes through
`assignDiffComment(sessionId, noteId, mountId)`. `Discard` goes through
`discardDiffComments`: it deletes the rows at once and registers one
`undoable` ("Note discarded" or "N notes discarded"), whose Undo and ⌘Z
re-insert the same rows with the same ids (`restoreDiffComment`); a status
`discarded` would need a migration because `diff_comments.status` is a CHECK
list. With two or more notes the section header has `Discard all`. `Post notes` in the toolbar moves the open notes
of the branch into a review draft. Write review puts
its form under the last file: the line comments with Edit and Delete on hover (Delete offers Undo), the verdict,
the summary, and one primary that says the verdict (`Approve`,
`Request changes`, `Submit comments`), ⌘↵ from the summary. The form's `⋯`
in the diff toolbar holds Discard review, which confirms. The actions are
the `writeReview` kind of the action registry. Files mount in batches of 20 as the
browser idles, so a large diff stays responsive.

## The Scripts lens

`ScriptsPanel` is one `PaneShell` (`Scripts`, meta `N projects · N running`,
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
word, one Run or Stop button and a `⋯` menu (saved: Edit, Duplicate, Delete
with an inline confirm; manifest: Save as script, Copy command, both using
the invocation). "Save as script" from a workspace package writes a command
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

Every row also has a pin, always visible. A pin belongs to the project, not
the worktree: its id is the source, the folder and the name
(`scriptPinId`, a saved script by its id), stored as a JSON list in the app
setting `scripts.pinned.<projectId>` (`toggleScriptPin`, loaded by
`loadScriptPins` through `useScriptPins`). Pinned scripts of the mounted
projects sit in a `Pinned` strip at the top of the lens, one click runs one in
its group's worktree, and the palette lists them under `$` with the project
name (`scriptPinEntries`, run through `runPinnedScript`; saved scripts show
their project name too). On the workspace Projects page every row has a
`Scripts` fold (`ProjectScriptsFold`, closed by default) that reads the
project folder only when it opens (`loadProjectRootScripts`, kept in memory
by root path) and says `Scripts on <base>`, with the same pin; a project with
no package.json or composer.json says so.

## Undo operations

Reversible task removals act immediately. The app-wide Undo stack keeps up to
50 operations for the current app window, newest first. Each removal offers
an Undo toast for 10 seconds. Cmd+Z (Ctrl+Z off macOS) undoes the last app
operation when focus is outside a text field or terminal. Dismissing the
toast does not discard the operation. An Undo that fails stays retryable.

Session unlink snapshots all placements of one task, including every branch.
Take off snapshots the session placement it may create too. Undo compares the
current placements with the operation's expected result and restores the
snapshot in one guarded database transaction. A later re-link or changed row
makes Undo do nothing and say why. Other tasks and projects stay untouched.
Stop tracking restores only the workspace task; it changes no session link.
