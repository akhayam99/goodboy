# The model and the rules that hold everywhere

> **Read this when** you decide how a surface is reached, what the back and forward keys do, or how an undo or a follow toast behaves. **Not for** spacing, scroll and overlay mechanics ([styling.md](../styling.md)) or design intent and tone ([DESIGN.md](../../DESIGN.md)). The other pages are listed in [navigation.md](../navigation.md).

## The model

- **The board is home. Chat is a destination.** Open a workspace with no
  session selected and main shows a board of every session, grouped by stage
  (needs you / running / in review / building / done). You reach chat, diff,
  terminal and open-in-IDE from the cards. You never land on them. Every
  capability stays one step away.
- **The Board frame.** The header is one 44px row, no band above it,
  with the pane title grade (`Sessions` alone, no total: each lane carries its
  own count), then the tool row under it: **Filter sessions**
  (`SessionFilterPopover`, a `FilterButton`), then "N hidden · Clear" while a
  filter hides sessions (`HiddenByFilters`). The page is the Board only: there
  is no List view, no switch and no stored page view, and the column is the
  list. A stored `pageView` in an older prefs record is ignored. The filter
  button shows how many filters are on as a count. The page filter holds Sort and Projects;
  the column filter holds Sort, Project, Status and Show archived (Group stays
  in the column). Both are the one `SessionFilterPopover` over the one
  `SessionViewPrefs` record, so a choice made in one is the choice in the other,
  and a view menu never changes data. **Mark all as read** is the foot button of
  the filter popover and the palette command **Mark all sessions as read**.
  Repository state is not here: it lives on the Repositories entry of the top
  bar (`RepoEntry`). New session is not
  here: it is the first row of the column. Nothing else sits on that line, and
  no row sits under it. Header and lanes share one frame centred in the pane, so the
  title's left edge is the first lane's left edge and the actions' right edge is
  the last lane's right edge.
  There are five lanes in pipeline order (building, running, in review, done,
  archived), each from 12.25rem to 20rem wide (`BOARD_LANE_MAX_REM`) with
  0.75rem gaps, so a wide or zoomed-out window never stretches a lane.
  `boardLanesOf` decides by the frame's width in those rem values times the
  root font size (`BOARD_LANE_MIN_REM` and `BOARD_LANE_GAP_REM` in
  `paneRhythm.ts`; 15px root): five lanes from 964px; from 769px four lanes
  with Done above Archived in the fourth, each half with its own header, count,
  empty line and scroll; below that the four lanes scroll sideways, the title
  row stays, and the scroller opens at its end so Done and Archived are on
  screen. While scrolling, the lanes narrow down to 11rem (`scrollLaneRemOf`,
  `BOARD_LANE_SCROLL_MIN_REM`) so the last three lanes and the 32px edge fade
  (`BOARD_LANE_FADE_PX`) fit. `laneWidthOf` is the one lane width; the Needs
  you cards above the lanes read it too, so a card is always one lane wide. Every lane always renders
  its header and, when empty, one line naming what is missing; Archived shows
  Loading until its list answers, and it is the list the sidebar shows under
  Show archived. There is no dock and no collapse: Done and Archived are never
  folded, and no lane caps its cards. Selection covers every lane in lane order:
  Select all, Shift ranges and the lasso run across Done and Archived too. Lane
  labels are sentence case in the neutral grade with the count in gray, never
  the stage color. Cards are a fixed 96px with the stage track inside their
  left padding (`ToneBar` card density, tone from `stageTrackOf`, the one
  function the List rows read too: building neutral, running info and
  breathing, needs you warning, in review success, done merged, archived
  neutral and still; it steps under the selection box while one shows): a goal
  of up to two lines (the full goal in the
  tooltip) is the card's one button, the quick action sits at its right (or,
  when it answers the reason the signal names, `signalActionOf`, the signal
  itself is the button and no icon shows), the
  lifecycle menu is the right click and Shift F10, and the bottom line holds the project
  in gray (`projectLineOf`, "payments-api +1" for several) and one signal at the
  right (`boardSignalOf`, the same one the List row shows): an open question,
  else a failed check, else the pull request token in its state color (a click
  opens the pull request), else a running dot with the count of running agents
  (`runningAgentCountOf`), else nothing while GitHub has not answered (no
  skeleton per card) and the offline cloud when it could not be reached. The question and
  running glyphs carry their number from two on; one is the glyph alone, since
  the state node already says it. An archived card shows
  only its pull request. Age, issue chips, agent count, cost, the pin, Auto and
  draft review comments live in the session hover card, which opens on the
  board with facts only (no buttons). Restoring an archived card uses the
  `restore` glyph. The Board door works from every place, the New session
  draft included.
- **An archived session is read-only until Restore.** Its Overview header holds
  Restore alone (no Archived chip, no New), and the notices, unassigned comments and
  Next are not drawn. The composer, new agents, workflows and
  project mounts stay disabled with "Restore this session to continue". Nothing
  restores on its own, so a shelved session never spends by itself. Archive
  stops the session's live agents first: with live work the button asks once,
  inline, **Stop 2 agents and archive**, and with none it archives at once with
  Undo. An agent that does not stop keeps the session where it was. Undo brings
  the session back with its agents reading Stopped (`archiveTask`,
  `archiveConfirmOf`).
- **Three surfaces, three jobs, no competition.** The top bar is now ("what is
  happening, where am I and what is it costing"). The places rail is access
  ("where do I go"): New and the six places; sessions open from the top bar
  popover or the Board.
  The ⌘K palette is transit ("where do I want to be"). There is no footer.
- **The top bar carries state, identity and movement.** Movement is Back,
  Forward and Search or run, clustered in the centre. Sessions opens the
  session picker on the left, before the workspace identity and Repositories.
  Every chip opens the home of the number it shows: the Now chip
  ends on Monitoring, the Spend chip opens Impact on its Spend tab (the bar
  holds no Impact icon), and the Usage chips open the Providers menu. It holds
  no control for another container. The bar never edits a record in place.
- **The places rail holds every place and never changes level.** New comes first, then Board (the board, ⌘⇧H),
  Tasks, Workflows, Chat, Connect and Impact, Impact quiet and last; Settings and the bug sit at
  the foot, with the Goodboy signature under them, the app's corner. It carries two marks only (`railMarkOf`):
  Board carries the number of sessions that need you as a warning count on its glyph, and Tasks
  a dot for new tasks; the reasons are in the accessible name. Board is named "Board, 2
  sessions need you: Checks failing, 1 question for you" (`doorSignalOf`). It reads `useNowSessions().attention`, which
  is `useWorkspaceAttention` over every session of the workspace, whatever the
  project filter. The Now chip does not show it. The palette's
  Needs you rows, the Now chip's idle word and the screen reader line read the
  same counted sessions (`useNowSessions().needsYou`), longest waiting first.
  Connections, after Chat at full weight, is the page of the providers on this Mac and the
  integrations of the workspace (`features/connections`); it has no shortcut and answers to
  Providers and Integrations in ⌘K. Its index shows a tile per set up provider and integration
  in a fixed order (`connectionGroups`), and a low Not set up row under each group with the verb
  that sets it up. Health changes a tile's word and border, never its place. The tile word, the
  word in a provider page's head and the header counts all come from
  `connectionStateOf`, which takes a tool's word from `toolStateOf`, the same word the tool
  page's head shows. The key check of each tool lives
  in memory in the store, one entry per key with its time (`integrationKeyChecks`, written by
  `checkIntegrationKey`, latest only); the index checks every key of the workspace at most once a
  minute unless its refresh forces it (`checkTools`), and a failed read keeps the last answer and
  shows the error on the refresh button. That error is the newest check of the workspace it
  names (`toolCheckErrors`, latest only per workspace): Refresh clears it once the check answers,
  and a late check of another workspace never shows. Only workspace bindings count as connected
  tools on the index and the door (`workspaceBindingsOf`), as on the tool page. GitHub has no key: its tile and page read the time of the
  last gh check that answered (`githubCheckedAt`), and whether it is connected comes from
  `isGithubConnected` alone. A tile, or a Not set up row, pushes its detail page
  through `openConnection`: studio focus `{ kind: 'provider', provider }` (with the install or
  sign in step) or `{ kind: 'tool', tool }` (`IntegrationDetail`), under the trail Connections >
  Claude or Connections > GitLab; the trail and Esc go back up to the index at the scroll it had
  (`useScrollMemory`), and the door always lands on the index. The tool page says what the tool
  does in the workspace, one row per use with its count and a link to Tasks: the counts are the
  open records Tasks last loaded (`toolUseCountsOf`, read through `selectToolUseCount`), nothing
  shows before Tasks loaded them, and a tool whose key is missing reads Paused. A missing or bad
  key is replaced in place (`replaceIntegrationKey`): the host checks the new key first, the
  keychain slot of the binding is rewritten, and the binding itself is kept; a key check asked
  while the new key was checked is dropped once it is saved. Connections is the
  one home of providers and integrations: Settings has no providers or tools scope
  (`SettingsStudioScope` is home, app, workspace), and every link to a provider or a tool, from a
  notification, an error, the usage chips or ⌘K (`connectionPaletteEntries`), opens its page
  through `openConnection`, as a link that stacks. An old link keeps working: an
  `goodboy:open-settings` event on scope providers or tools opens Connections
  (`settingsOverlayFromEvent`), a stored notification action does too (`mapRecoveryAction`), a
  restored window on a provider or tool page lands on its Connections page
  (`withoutRemovedPages`), and a remembered Settings page there lands on App, General, or on
  This workspace, Models for the old Models page (`resolveSettingsFocus`). The Settings rail
  has no row to Connections: Search settings answers Providers and Integrations with Go to
  Connections (`settingsPaletteEntries`). `settings-has-no-connection-scopes.test.ts` keeps any new code from opening Settings on those
  scopes. The one place they stay is the saved window layout: it stores a Connections page as
  the Settings provider or tools page 0.36 opens (`storedStudioOf`), and restore folds it back.
  There is no Work door and no `work` studio: the Board is the one list across sessions, and a
  Needs you card opens the run that waits (`attentionPlace`). A stored Work place, whatever the
  old Work switch row says, opens the Board with no drawer (`withoutRemovedPages`), in each window
  on its own. ⌘K lists one "Lead: title" row per open Lead (`leadEntries`).
  Monitoring has no place on the rail; its page has no band and no Close, and
  it opens from the Go menu, the palette and the Now chip: the top bar holds no
  Monitoring icon. The rail holds no tool: Terminal and Browser live on the
  right rail (see The session tools).
  The test for a home: a place you go to and read full width is a place; a tool
  you open beside your work, in the dock with Open full page, is a rail icon.
  Chat (a conversation list and its transcript) and Impact (a report of tiles
  and tables) are places. Monitoring (ports and processes) is a tool used
  beside Terminal, but it has no dock body yet and its address is a page
  target per branch, so it waits off the rails until a dock body exists.
  Inside a session the rail stays the same and keeps the Board lit, since the
  session is a child of the Board (`railPlaceOf`); the session's own pages are
  the page tabs under its title (see Session page tabs). The rail is on every
  screen with a workspace: the board, a session, the draft and every studio,
  Settings included. No page changes it: Settings is a page with its own scopes
  rail beside the live places rail (see Studios).
- **One list names every destination.** `DESTINATIONS`
  (`shared/navigation/destinations.ts`) owns the name, the glyph, the shortcut,
  the menu id, the former names, the scope (`app` or `workspace`) and the home
  (`column`, `rail`, `menu`, `topBar` or `foot`) of Board, Tasks, Workflows, Chat,
  Connections, Impact, Monitoring, Notifications, Terminal, Browser, Settings,
  Guide and What's new, in one order, and the short rail word where the name is
  too long (`railWord`, Connect). The places rail, its foot, the Go menu, the
  palette rows and the
  shortcut sheet all read it, so a destination has one word and one glyph in
  every place. Settings, Guide and What's new have the `foot` home and the `app`
  scope; the ten others are `workspace` pages. `openDestination` is the one way
  to open one, Board included: it replaces the open page and pushes only from a
  place, whichever channel asked, so Back lands where you were before the first
  page. A name changes in `NAMES` and the table moves with it; the Rust menu is
  checked against the table by `menuBar.parity.test.ts`, and the Go menu keeps
  a separator after Impact between the pages and the tools. The shortcut sheet
  keeps its registry order, and `destinations.test.ts` checks that the keyed
  destinations in its Navigate group follow the order of the list. Board answers
  to Sessions in the palette and its page is titled Board. Each session page has
  its own glyph: Runs draws `CONCEPT_ICONS.runs`, not the Workflows door glyph,
  Connections answers to Providers and Integrations and draws the plug,
  and Artifacts keeps `CONCEPT_ICONS.plans`. Moving a destination to another
  home is a change of its `home` and its row in the table, nothing else.
- **One home per thing.** Say a thing must exist in state A and can exist in
  state B. It lives where it must, and B gets no second copy. Workspace identity
  is always pinned at the left of the top bar, followed by the Repositories
  entry (`RepoEntry`): a branch icon alone while nothing needs a pull, a dot
  and "3 behind" or "Diverged" when a base branch moved on origin, a quiet
  "Check failed" when origin cannot be reached. Its facts come from
  `repoEntryFactsOf` (one row per repo that needs a look, drawn as a fact card
  by `repoEntryCardOf`; the summary is the card state when no repo
  needs a look) and each row's from `repoRowFactsOf`; the background
  check is `useRepoDivergenceCheck` over `checkRepoDivergence`. Neither the column nor a studio
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
  a hunt. The places rail stays visible and never folds. Page lists keep
  their own fold controls (see [Studios](studios.md)).
- **Navigation chrome is neutral at rest.** Selection shows as a muted fill,
  never an inversion. The app has no inverted navigation control. New session
  is the only emphasised column control. Doors, Board included, are neutral at
  rest, and the rail signature is a quiet door to What's new whose only signal is a
  small dot while a release has unread notes. A pending update adds an Update mark
  above the signature until you act on it. An update is an event, not a rest state.
- **Settings match the scope they edit.** Application settings is a full-page
  studio. Workspace settings is a scoped pane. Changes save instantly: no
  Save/Cancel footer, and no settings surface stacked on another.
- **One main slot.** Board, the session, the draft and every studio are pages
  in the one main slot, one at a time: a studio replaces the page in the sheet.
  Scope decides the pattern. Session-scoped editors layer over the session
  pane. Anything that became a lens stays a lens. A session drawer parks while
  a studio is open and the sheet takes its width; Terminal and Browser stay
  docked beside any page but their own, and belong to the session or the Board
  they were opened in (see
  [shell.md](./shell.md), The dock follows the page).
- **A door replaces, a link stacks.** A door is a control that names a studio:
  a column door (Tasks, Chat, Connections, Workflows, Impact, Monitoring, Settings), the Goodboy
  line, the foot of the bell list, a ⌘K Go to
  row and the spend chip. Pressing a door while a studio is open replaces that studio in
  the same history entry (`switchStudio`), so five doors in a row leave one
  entry, not five. A link opened from inside a studio's content (a notification
  that opens Settings, a card that opens Impact) stacks (`openStudio`), so Back
  returns to where the link was. The tabs of Help (Guide, What's new) stack
  too. A notification row with no session is a link too: it stacks the
  Notifications page, and only the foot of the list is a door. Board is a door
  as well: opened over a studio it replaces that studio's entry
  (`openDestination`), so Back from the board returns to the page below the
  studio. Events from the bars carry `door: true`.
- **One exit.** Close, Esc and Back leave a studio the same way: they land on
  the entry below it, and Forward brings the studio back. When nothing sits
  below, Close rewrites the top entry as the page without the studio. Esc is
  layered: it closes a popover or a confirmation inside the studio before the
  studio itself. The exit follows the scope. An app page (Settings, Help, New
  workspace) shows Back to app in its band and answers to Esc. A workspace page
  (Tasks, Workflows, Chat, Connections, Impact, Terminal, Browser, Monitoring, Notifications)
  shows no exit control: it leaves by another door, Back or Esc. Nothing has a
  Close button.
- **One selected sign.** Every page lights exactly one control, with
  `bg-selected`, `cursor-default` and `aria-current="page"`, in the column and
  on the rail alike: the open studio's door; New session while the draft is
  open; Board on the board; the bell for Notifications. Help, either tab (`place`
  `help`), lights no rail control: the page's own band names it. New workspace is a flow and lights
  nothing. Every control reads it from one place (`columnPlaceOf`, through `selectColumnPlace` and
  `useColumnPlace`), so no page leaves two lit. Inside a session no door does:
  the open session's row is the column's sign and the current page row is the
  page tabs' (see Session page tabs), one sign per navigation surface. Under any
  page the session row is remembered, never current. A popover trigger that is
  not the page's own control (the Usage chips) is never selected: it only
  reports `aria-expanded`; the bell is selected only while its page is open, and
  an open popover shows its own `bg-muted` over that. A button's label, `aria-label` and tooltip name the same word
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
opens it on a mode. Commands is the first mode. Its repo rows
(`sources/repoEntries.ts`) pull the base branch of the linked repos through
`checkout_update_base`; each row and each toast line names the branch it
updates and where the checkout stays. New terminal opens a fresh tab
in the Terminal dock, or on the Terminal page while it is open; inside a session it reads "New terminal in this session"
and the tab opens on the session's folder.

- **Scope first.** It opens on a scope chip that names the surface you can see:
  the focused commit row on the Commits tab, else the focused row of the Explore
  tree (a file or a folder, with its Open, Show in Finder, Ask and Copy path), else the agent when the agent page
  is on screen (a stored selection under a studio or an artifact conversation
  does not count), else the run on the Runs page, else the pull request on the
  Branch page, else the session, else the workspace on the board and under any
  open app studio (`resolvePaletteScope`, which reads
  `resolveSessionSurfaceLayer`). A row offers itself with `useHeldPaletteScope`,
  and the palette reads it only while focus is inside that row
  (`heldPaletteScope.ts`). Backspace in an empty input removes the chip. The
  placeholder and the top bar pill say the same words: **Search or run**
  (`NAMES.searchOrRun`); **Search** stays the name of ⌘F.
- **Empty input in a session is ranked by state, not by registry order.** One
  fixed list of sections, empty ones hidden:
  1. **Next**: up to three rows from `deriveNextSteps`, the same model, handlers
     and outcome log as the session's next-step slot (`useSessionPalette` calls
     `useSessionSuggestions` and `useSuggestionActions`). Needs-you rows first.
     A step the slot confirms (Merge, Close branch) confirms here too. Mount
     proposals stay in the slot. Push, Create pull request and Rebase (the step reads `Open rebase` and lands on the Commits base row) live here:
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
     step, Retry step, Stop run); and **Open Runs**. ⌘K also offers **Start from** each
     preset (`startRunFromPresetEntries`), which opens the Start a run field
     with `~` and the preset name.
  4. **Recent**, agents of this session first; then four fixed groups, each
     entry in the one its `kind` names (`EMPTY_SECTION_KINDS` in
     `commandList.ts`): **Go to** (`goto`: one row per page destination of
     `DESTINATIONS`, in its order, Board, Tasks, Workflows, Chat, Impact, Monitoring, Notifications, Terminal and Browser (these two open the dock),
     then the Impact Spend page, and Settings, whose row
     is also a `goto` entry; Board answers to its former name Sessions), **Create**
     (`create`: New session, New chat, New terminal, New workspace), **App**
     (`action`: Resume setup while setup is unfinished in the main window,
     Theme: dark, Theme: light and Theme: system, Check for updates, Connect a provider, New question, the column
     fold) and **Help** (`help`: Guide, What's new, Keyboard shortcuts, Report a
     bug). New workspace answers to its former names, Open a folder and Start a
     new project (`formerNamesOf` in `shared/utils/names.ts`). Pair an iPhone and one
     **Guide: {chapter}** entry per `GUIDE_CHAPTERS` row (opens it through
     `openGuideChapter`, also while the Guide is open) are typed only. Pair an
     iPhone answers to Pair your iPhone and the other former names of the page.
     Check for updates opens the Updates band of Settings > General and runs the updater check only
     in a status the menu item also checks. Palette and menu bar share one
     function, `checkForUpdatesNow` in `features/updater`.
     The overlay is a compact window: 640px wide (search 720px), a 48px input row,
     28px rows, a list capped at 320px that scrolls, a 320px minimum height
     (`PALETTE_MIN_HEIGHT_PX`), and a key chip with a minimum width so a glyph
     like the Terminal one is never clipped.
     On the Board the first section is **Needs you**: the sessions the
     Board door dot counts (`useNowSessions`), each opening its `attentionPlace`. The bell, the toast and the
     Notifications page open through it too: a notification keeps a reason and a mount in its stored action
     (`open-place`, no migration), and a build that does not know the kind reads no action. The session pages (Open Overview,
     Questions, Artifacts and the rest) and Impact: Spend stay out
     of the empty list and answer to typing.
     The order of the list is the one place the palette differs from a `⋯` menu:
     both list the same verbs (`menuParity.test.tsx`, which counts the verbs
     inside the **Go to** submenu), `⋯` keeps its stable order.
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
  them. A lone `Ask in chat` row stays first for free text.
- **Verbs come from the action registry** (`features/actions/`) and follow its
  state rules. A verb whose `when` is false never shows. A blocked verb shows
  only when searched by name (every word a word prefix of its label), dimmed
  with its reason, and Enter does nothing. Delete and the other confirmed verbs
  swap the list for an InlineConfirm; Archive runs at once with Undo. The
  registry owns Comments, Changes and Open in terminal of a session in scope, so the lens
  rows with the same names step aside. The lens rows read their labels from
  the shortcut registry, which reads `NAMES` (`Overview`, `Comments`, `Changes`,
  `Pull request`), so the palette, the page menu and the shortcut sheet cannot
  disagree; `Review`, `Files`, `Diff` and `Session` still answer to a query as former
  names.
- **Keys.** ↑↓ move, ↵ runs the row (an object row opens it), → opens every
  verb of an object row, grouped Open, Act, Copy and export, Danger, and ← or
  Backspace goes back. A verb with choices, such as Change model, opens them as
  a level. Copy worktree path copies at once when the session has one
  worktree; with several it opens them as a level (name, branch and path), and
  ⌘↵ copies every path, one per line. A preview pane shows only for a row with
  facts of its own (a session, an agent, an artifact, a blocked verb or one that
  asks first); a plain command takes the full width, and the hint line says
  ↵ Run or ↵ Open.
- **An agent, a run or a pull request in scope keeps its session's verbs.** They
  follow under "For this session", ranked by the session state, so Copy
  worktree path stays one search away. A session verb with the same label as a
  scope verb steps aside.
- **Prefixes stay**: `@` agents, `#` sessions, `:` workspaces, `$` scripts,
  `>` actions, `?` help.

In the composer, `$` lists the scripts of the session's mounted projects
(`useSessionScripts`): saved scripts first, then the `package.json` and
`composer.json` scripts pinned for the project, by category. The Scripts pane
lists the same set in one region per mount, `Scripts of <project> · <branch>`:
Services first (category `dev`, or a script named `start`, `serve`, `watch` or
`preview`, decided by `isService`), then Commands, with no band labels, on one
grid: glyph, name with its invocation in mono, a fixed meta cell and one
**Run** or **Stop** glyph. **Start all services** sits on the mount header, and
**Open in terminal** in the row menu opens `openScriptInTerminal` in that
mount's worktree with the command prefilled. A script from the palette runs on
`resolveScriptMount`: the mount named by the caller, else `selectPlaceMount`
(the branch page in `diffMountPath`, the selected agent's or run's mount), else
the only attached mount of the project, else a second palette step lists the
candidates, the mount of the latest run first. The terminal chord and Ctrl+`open on`selectPlaceMount`before the remembered scope. A running service row shows
the last output line, its uptime (CPU and memory, the monitor snapshot for the
run's pid polled only while the lens is open, in the tooltip) and its port as a
link once a listener owned by the run exists; an idle one shows its expected
port as a chip, or`:5005 in use`in warning when another worktree holds it.
A task row shows a result glyph, its duration and age in gray, and the last
line of a failure. **Pin**, **Restart** and the rest are in the row's right
click menu. A project with nothing pinned shows a dimmed **Suggested** band (its
root`dev`, `build`, `test`, `lint`and`typecheck`, first match each) with a
**Run** on every row (a Run leaves its last result on the row, a running row swaps Run for **Stop**
and opens its output, and a row with a result stays after another script is pinned) and a quiet **Pin**. Scripts that are not pinned stay on the workspace Projects
page in Settings, where they are pinned. A row's sublabel names its package (the
manifest name, or `root`) and shows the script's body, not its invocation; the
trailing badge is `Running` or the package's short name (`web`, not
`package.json`) so twenty `dev`rows in a monorepo read apart. Manifests are
read from each mount the first time`$` is typed. With more than one mount a
row also names its project. An empty list says why: no project in the
session, no pinned script in the project, or no match for the filter. Enter runs the
row and opens its output in the right drawer; the composer text is cleared.

⌘F opens search, the palette's second mode: a local index over sessions,
messages, agents, artifacts, decisions, questions, issues, pull requests and
branches, with filters and a preview. A hit lands in context through the one
door, and ⌘G and ⇧⌘G then walk the matches in that view. A focused terminal
keeps ⌘F for its own scrollback. [search.md](../search.md) owns the index, the
landing targets and the find rules.

## Addresses and history

Every view has an address, and one history per window and workspace records
them. The navigation slice (`store/slices/navigation/`) owns both.

- **A `Location` is where you are plus how the page was.** Its `place` is the
  board or a session view: lens, open agent and one target
  (artifact, run, issue, diff focus, Branch section, thread). Its `studio` is the app
  studio open over that place, if any. Its `focus` is the page state: the open
  drawer and the scroll. An address carries only what a screen reads: a window
  saved by an older build with an agent tab, an Explore folder, the Explore or
  Scripts lens, a selection or revealed rows still loads, and
  `withoutRemovedPages` folds those parts to their new home (see Stored places below), and an
  unknown lens opens the session Overview, never a blank page. `locationKey` prints the text
  form used by tests and logs: `board`, `s/{session}`, `s/{session}/branch/comments`,
  `s/{session}/branch/pr` (the Overview section, see below),
  `s/{session}/workflows/{run}`, `s/{session}/agents/agent/{agent}`,
  `s/{session}/branch/comments/t/{thread}` (a thread, with a fix run transcript in the drawer when one is open),
  `s/{session}/questions/q/{question}` (a question open over Questions).
- **An open item is named by the address, and the panel is not a second holder.**
  A question (`question` target, `questionPlace`) and a thread (the `threadId` of the
  Branch target) are items: the address names them while their panel is open, and
  `captureLocation` reads that from the one open drawer, so closing it with Esc, the X
  or ⌘W, or pressing a tool over it, clears the address too and a reload or a saved
  window reopens the same item. An item is not depth: Up from an open thread or
  question leaves the page, it does not stop on the list first. Close on a question
  goes back through the history to where it was opened from (`closeQuestion`).
- **One door.** Every move goes through `navigate({ to, mode })`, `back()`,
  `forward()`, `up()` or `amendFocus({ patch })`. `sessionPlace`,
  `agentPlace` and `BOARD_PLACE` build the `to`. A move lands exactly where
  its `to` says: a place with no target is the list (Runs, Artifacts), never
  the run or artifact shown before, so every caller that means an object
  passes it as the target, and opening a row is a move that Back undoes
  (`openArtifactPage`, `openGithubIssue`). The Runs and Artifacts lists write
  the row they open into `focus.returnRows` (its id) and `focus.scroll` (its
  index) with `amendFocus` first (`useRowReturn`), so Back scrolls to that row
  again even when a new row landed above it; the index is only the fallback
  for a place saved before ids were kept. Runs unfolds Earlier or Finished when
  the row sits there. A reload keeps a
  session it can still show, archived ones included (`selectSessionById` in
  `restoreLocation`). A workspace load empties the archived list, so when the
  saved session is not among the open ones `restoreLocation` awaits
  `loadArchivedSessions` first; a reload on an open session reads no archive.
  The Scripts drawer carries its project in its
  payload, so a reload keeps that scope too. A write in the background, such as
  a run starting, never moves the page. The per-session keys the
  surfaces render from (`activeLens`, `selectedAgentId`, the
  focused target) are written only by the slice. A contract test
  (`__tests__/navigation/oneDoor.test.ts`) fails when `features/`, `app/` or
  `shared/` calls `setActiveLens`, `setCurrentSession` or `selectAgent`. A session has no
  studio of its own: the New drawer replaced the session studio, so a place
  carries a lens, an agent and a target, and only the app studio (`Location.studio`)
  covers a page.
- **Aliases live in `canonicalLocation`, and only there.** An agent resolves
  to its home lens (an unknown agent to Agents), before it is recorded, so no
  view redirects after it mounts. The pull request and Comments are two lenses
  and never alias each other: a door to the pull request lands on `pr`, a door
  to comments lands on `review`. On a code-host branch both are rewritten to a
  Branch section. The Branch sections are addresses and have one registry,
  `BRANCH_TAB_REGISTRY` in `features/branch/branchTabs.ts` (id, label, address
  token, shortcut, availability), with `branchTabsOf({ state, hasComments })`
  returning the sections the page shows in order (see The Branch page below).
  One resolver decides every door, `unavailableBranchTab` in
  `canonicalLocation.ts` through `resolveBranchTab`: a section the state does not
  have is replaced before the place is recorded, `comments` with no pull request
  and no comment by `files`, `checks` with no pull request by `pr`; every other
  address stays. `BranchTab` includes `pr`; while `pr` is not available the `pr`
  address parses and prints but lands on `comments` (a review being written still
  lands on `files`), so a pasted or restored `pr` address never errors.
- **An address carries its own mount.** `canonicalLocation` rewrites aliases
  and never fills a missing mount: a Branch address with `mountPath: null`
  stays `null`, and the page shows the active mount when it renders. A caller
  that acts on a mount passes it (`branchPlace({ mountPath })`,
  `lensPlace({ mountPath })`); a page door that means "the mount on screen"
  leaves it out and `lensPlace` reads it once, through `doorMountPath`, at the
  click. Back and a reload never move the write destination, with or without a
  mount in the address: the page shows the mount the address names and a write
  confirm names its repository.
  A Branch address also carries `mountId`, null when no mount is known.
  `branchPlace` leaves it null; `navigate`, Back, Forward and a restore pass
  every address through `withKnownMount`, which fills the id from the path,
  moves a stale path to the folder of its id, and makes an id no mount has
  unavailable (no mount, no focus) instead of taking the mount now at its old
  path. Only an address without an id falls back to `mountPath`. The open page
  keeps its id in `diffMountId`, so `captureLocation` saves the page by id and
  with the current folder of that id even after its worktree moved. `trackOf` in `features/track/`
  reads one mount's github state, selected pull request, terminals and agents by
  `mountId`.
  `docs/typescript/state-writes.md` has the rule; the rows of
  `__tests__/surfaces/navigation-flows/target-identity.rows.tsx` hold the
  journeys.
- **Push, amend, replace.** A new place pushes: board and session, session to
  session, lens, a child, a sibling from a switcher. Pushing
  the place you are on replaces it. Page state amends the current entry and
  never adds one. Canonical rewrites replace. The stack keeps 50 entries and
  lives in memory. Each workspace has its own stack, so switching workspace
  finds that workspace's history again.
- **Back restores the entry as it was; a forward move arrives clean.** Before a
  push, the live view is captured into the current entry, so Back finds the
  same run, artifact or diff focus. A forward move (crumb, sidebar, palette,
  notification, Board) starts with an empty focus. A page tab navigates first
  and clears the run and artifact focus after, so the clear never reaches the
  entry it leaves (`openSessionPage`).
- **Up goes to the parent.** When the previous entry is the parent, Up is Back.
  Otherwise it pushes the parent (`upTo({ to })`, which `up()` and every crumb
  call). Closing an app studio is Back to the entry below it, so Up from a
  studio and Close land in the same place. `crumbsOf` walks `parentPlace` up to
  the session and names every step for the session crumbs, the first one reading
  `Overview` (`Overview › Runs › {run}`,
  `Overview › Runs › {parent agent} › {agent}`, `Overview › Artifacts › {artifact}`,
  `Overview › {branch}`); a sub agent's parent is the agent that spawned it.
- **A face is not an entry.** Overview and Desk are two faces of one place, the
  session Overview, so the address never names a face. The face lives per
  session in `sessionFace` and is saved with the dock grid (see
  [home-and-drawer.md](./home-and-drawer.md), The grid saved on the session).
  A tool opened on the Overview turns it to the Desk in place, and closing the
  last tool turns it back; neither pushes an entry (`switchSessionFace`). Back,
  Forward, the crumbs and Esc never change a face, and ⌘↑ from the Desk goes
  to the board, as from any tab.
- **An Auto run keeps one frame.** The run page and the page of every agent
  under it draw the Agents rail in the frame's left slot (`LeadPage`,
  `RunAgentsRail`). The marked row is the agent in the address, so a reload,
  Back and Forward restore it; a row opens that agent's page in the centre and
  the rail keeps its scroll. The agent's parent crumb is the agent that spawned
  it, up to the run (`parentPlace`), and Esc walks the same way.
- **Two Backs, and they differ.** The crumbs, Esc and ⌘↑ follow `parentPlace`: it
  only points inside the session, never at a list outside it, and it reads
  the same after a reload, in a second window and from a link. History Back
  (⌘[) walks this window's stack of 50 and is empty after a reload. A top
  agent (a root agent at `s/{session}/workflows/agent/{agent}`, the one page
  `canonicalAgent` resolves for every door) goes back to Runs, the list that holds
  it, so its crumbs read `Overview › Runs › {run}` like a workflow run; when an up
  lands on the Overview, `upTo` writes the agent it left into
  `focus.returnRows['board.lead']` so the board brings its row into view; opened from the Runs tab of a pull request it goes
  back to that tab, read from `focus.runGroup`, which the window layout saves.
  A session tab (Overview, Runs, Artifacts, Questions, Context) is the top of
  its session and has no crumbs; a file open in a branchless session's Changes
  goes back to Changes, then to the Overview.
- **Changes is a place of a branch.** On a session with a branch,
  `canonicalLocation` turns a `files` place into the Branch page Changes tab
  (`branchPlace` with `tab: 'files'`), on the place's mount or else the branch you
  looked at last (`doorMountPath`), keeping its file focus; the pull request row
  of the Projects block, the board door, the palette and the chord all land there. A
  folder session keeps `FilesPane` on its `files` place. A stored `diff` target
  with `page: 'history'` still opens the pull request's Commits.
- **Stored places.** One fold, `withoutRemovedPages`, maps every place an older
  build saved to its new home, and `PLACE_ROWS` (`placeRows.ts`) names the
  `focus.returnRows` keys that carry what a place needs without a new stored
  kind:

  | Stored                                                           | Opens as                                                                   |
  | ---------------------------------------------------------------- | -------------------------------------------------------------------------- |
  | Overview, Runs, Artifacts, Questions                             | the same place                                                             |
  | Changes page                                                     | the Branch page Changes tab, on its branch                                 |
  | Context panel, any section, or the Goal, Decisions, Summary lens | the Context tab, `context.section` = that section (`history` for versions) |
  | Ask panel                                                        | unchanged, the Ask panel                                                   |
  | An address of the old Agents drawer or Agents page               | Runs, `runs.filter` = `running`                                            |
  | Scripts panel, a script run                                      | unchanged, the Scripts drawer                                              |
  | An address of the old Explore drawer or page                     | the Changes tab, `changes.mode` = `all`                                    |
  | A file opened from the old Explore tree                          | the Changes tab on that file, `changes.mode` = `all`                       |
  | A file opened from a link, a reading panel                       | unchanged                                                                  |
  | The old Log panel                                                | the session Overview, with its last three rows and Open activity           |
  | An unknown lens                                                  | the session Overview                                                       |

  The previous release must open every place this build saves: it folds a
  stored Context tab to its Context panel and opens a stored Changes tab as
  that branch's diff on its pull request page, and a saved Connections page
  opens as its Settings page. `storedPlaces.test.ts` runs
  every row through a frozen copy of that fold
  (`testing/opensInPreviousRelease.ts`), and `navigationContract.test.ts`
  holds the two Backs, the reload and the two windows.

- **Dead entries fall out.** An archived or deleted session removes its
  entries and collapses the duplicates left behind. An agent that is gone
  falls back to its home lens.
- **Keys.** ⌘[ and ⌘] (`nav.back`, `nav.forward`, app plane) and the mouse's
  back and forward buttons walk the stack. ⌘↑ (`nav.up`, `goUp`) is Up; on a
  session tab, which has no parent, it goes to the board, while ⌘W
  there keeps walking history. In a studio, ⌘↑ runs the parent crumb of the
  `StudioTrail` on screen (`studioUpSlot`), so Impact › Spend › a provider goes
  to Spend and a full Tasks record goes to the list; a studio with no trail
  parent closes. ⌘↑ yields to a text field, where it moves the caret to the top.
- **A window comes back where it was.** `captureWindowLocation` reads the
  current entry, focus included, and `restoreLocation({ location })` replaces
  the top entry with it and applies it as a restore (a session that is gone
  falls back to the board, an agent that is gone to its lens). Reload Goodboy (Cmd+Shift+R) writes
  it into the reload intent in session storage. Each window also saves it as
  `window.layout.<window label>` in the settings table half a second after it
  moves (`useWindowLayout`), and forgets it when you close that window.
  After an update or an app restart, and on any launch with **Reopen last**
  on, the main window restores its own layout and reopens every other saved
  window with `#restore=<old label>`, one per workspace; each one reads its
  old layout and forgets it (`restoreLaunchLayout`). On a plain launch with
  Reopen last off, Home opens and the saved windows are forgotten.
  The history stack itself stays in memory: a restored window starts with one
  entry.

## Undo operations

Reversible task removals act immediately. The app-wide Undo stack keeps up to
50 operations for the current app window, newest first. Each removal offers
an Undo toast for 10 seconds. Cmd+Z (Ctrl+Z off macOS) undoes the last app
operation when focus is outside a text field or terminal. Dismissing the
toast does not discard the operation. An Undo that fails stays retryable.

Session unlink snapshots all placements of one task, including every branch.
A move (`Move to`, Remove from this branch, Link work to this branch) is one operation: it replaces the
rows of that task in one write, so branch to branch is one Undo, and it
snapshots the session placement it may create too. Undo compares the
current placements with the operation's expected result and restores the
snapshot in one guarded database transaction. A later re-link or changed row
makes Undo do nothing and say why. Other tasks and projects stay untouched.
Stop tracking restores only the workspace task; it changes no session link.

## Follow toasts

An action that starts work, or creates something that lives somewhere else,
offers Follow once it returns. The toast is `info` (`success` means finished),
its title is past tense ("Run started", "Session started", "Agent started"),
and its one-line message appears only when it adds a fact the title lacks. The
one action is `Follow`, or `Follow the run` when the target is not the thing
the title names. It navigates as a push, so Back returns to where the user
was, and it opens the target's drawer when the target is a drawer. Pending
stays the control's `isBusy` pulse, never a spinner, and a failure never
becomes a Follow toast: it lands in the log (`reportError`) or stays beside the
form that was still open.

On screen is the exception: when the target place is the current place (and
its named drawer is the open one), no studio covers the page and no overlay
drawer covers it (`data-drawer-mode="overlay"` on the drawer `aside`), there is
no toast at all: a start you caused and can see announces nothing. A push drawer
leaves the page visible, so it does not count as covering. The same holds for
the rebase start, the composer's `$`, `~` and `@` picks and a plain Deny; a
session-long ban is the explicit overflow action and is a line on the
permission card, not a toast.

A user start that happens out of sight raises one toast. The caller passes a `startKey` (a run id or an
agent id) to `useFollowToast`; the key marks the run or agent as user-started
for 5 seconds (`shared/lib/userStarts.ts`) and becomes the toast's `dedupeKey`
`follow:<startKey>`. `WorkflowFollowToastBridge` skips a step start whose run
or agent carries the mark, so Approve or Run plan never raises a second toast,
while a step the orchestrator starts on its own keeps its one `Follow` toast.
The mark is what keeps the bridge quiet. `dedupeKey` is one part of a toast's
identity beside its kind, title and message: an identical repeat folds into
the first toast (with a count) and a different title under the same key is a
second toast. A caller that starts work and then awaits it marks the key before
it awaits (`markUserStart`), because the bridge hears the step start first.

The title reaches assistive tech through the toast card itself, which is a
polite `status` region for every non-warning toast. Code that cannot call a
hook builds the same params: `planRunToast` returns the Follow params for Run
plan and marks the agent. Starts that already land on their page raise nothing
new: the Start run primary of the run header navigates to the run page
(`RunPrimaryAction`), so `WorkflowRunStartButton` toasts only for a start that
does not.
