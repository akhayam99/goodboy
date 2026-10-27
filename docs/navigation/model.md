# The model and the rules that hold everywhere

> **Read this when** you decide how a surface is reached, what the back and forward keys do, or how an undo or a follow toast behaves. **Not for** spacing, scroll and overlay mechanics ([styling.md](../styling.md)) or design intent and tone ([DESIGN.md](../../DESIGN.md)). The other pages are listed in [navigation.md](../navigation.md).

## The model

- **The board is home. Chat is a destination.** Open a workspace with no
  session selected and main shows a board of every session, grouped by stage
  (needs you / running / in review / building / done). You reach chat, diff,
  terminal and open-in-IDE from the cards. You never land on them. Every
  capability stays one step away.
- **The Sessions page frame.** The header is one 44px row, no band above it,
  with the pane title grade (`Sessions` alone, no total: each lane carries its
  own count), then on the right: "N hidden · Clear" while a filter hides
  sessions (`HiddenByFilters`, one place for Board and List), the **Board** and
  **List** switch
  (`SessionViewPrefs.pageView`, kept per workspace in the session view prefs,
  a version 3 record without it reads Board), and **Filter sessions**
  (`SessionFilterPopover`). Its icon carries one primary 6px dot while a filter
  is on. On the Board the filter holds Sort and Project; the List adds Status
  and Show archived (no Group: the List always groups by stage). Repository state is
  not here: it lives on the Repositories entry of the top bar (`RepoEntry`).
  New session is not
  here: it is the first row of the column. Nothing else sits on that line, and
  no row sits under it. The List is one `ListGrid` with 32px
  rows on the 960 list measure: state node 28 (glyph 16, so the title sits 24
  after it), title led by its issue key in mono when there is one, project 128,
  signal 96, updated 56, right aligned. It groups by the board lanes, in lane
  order (`listStageGroupsOf`: Building, Running, Needs you, In review, Done,
  then Archived under Show archived), each group labelled by `stageWord` with
  its count from two, an empty group not drawn, and no Inactive group: an
  inactive session sits in its stage with its age in the last column. Each
  group label carries one 6px dot in its stage tone, the tone of the Board lane
  (`stageTrackOf` through `ListStageGroup.tone`, drawn by `ListGridGroup`
  `mark` before the name, over the node column, static); a row keeps only its state node and no
  track (the Board cards keep theirs). The list follows the filter's
  sort and Status, and a row opens its session. Header and lanes share one frame centred in the pane, so the
  title's left edge is the first lane's left edge and the actions' right edge is
  the last lane's right edge.
  There are six lanes in pipeline order (building, running, needs you, in
  review, done, archived), each from 13rem to 20rem wide with 0.75rem gaps, and
  the frame stops at six lanes of 20rem, so a wide or zoomed-out window never
  stretches the board. `boardLanesOf` decides by the frame's width in those rem
  values times the root font size (`BOARD_LANE_MIN_REM` and `BOARD_LANE_GAP_REM`
  in `paneRhythm.ts`, the same numbers the lane classes use; 15px root): six
  lanes from 1226px; from 1020px five lanes with Done above Archived in the
  fifth, each half with its own header, count, empty line and scroll; below
  that the five lanes scroll sideways, the title row stays, and the scroller
  opens at its end so Done and Archived are on screen. Every lane always renders
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
  tooltip) is the card's one button, the quick action sits at its right, the
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
  `restore` glyph. The Sessions door works from every place, the New session
  draft included.
- **An archived session is read-only until Restore.** Its Overview header holds
  Restore alone (no Archived chip, no New), and the notices, unassigned notes and
  Next are not drawn. The composer, new agents, workflows and
  project mounts stay disabled with "Restore this session to continue". Nothing
  restores on its own, so a shelved session never spends by itself.
- **Three surfaces, three jobs, no competition.** The top bar is now ("what is
  happening, where am I and what is it costing"). The left column is access and
  presence ("where do I go, what else is going on"): its doors and the sessions
  list. The ⌘K palette is transit ("where do I want to be"). There is no footer.
- **The top bar carries state, identity and movement.** Movement is Back,
  Forward and Search, clustered in the centre. It never holds a destination.
  The spend chip is state that opens the studio that owns that number, on
  Impact's Spend tab, and the Limits chips open the Providers menu. The bar
  never edits a record in place.
- **The column holds every door and never changes level.** New session comes first, then the doors Sessions (the board, ⌘⇧H),
  Tasks, Chat, Workflows, Terminal, Impact and Monitoring; Chat and Terminal each end in a plus
  (New chat, New terminal) that is always visible. No separator: the Pinned and
  Sessions lists follow, and Settings and the Goodboy row sit at the foot. A
  door's trailing slot is a 6px dot (running, unread, warning); the count is in
  its tooltip and accessible name, never a colored number. Sessions is the one
  exception: it carries the number of sessions that need you, a dot for one and a
  pill from two, amber or red, named "Sessions, 2 need you: Checks failing, 1
  question for you" (`doorSignalOf`). It reads `useNowSessions().attention`, which
  is `useWorkspaceAttention` over every session of the workspace, whatever the
  project filter, and the first segment of the Now chip reads it too. The palette's
  Needs you rows read the attention group of `useStageGroupedSessions`.
  Monitoring is the door after Impact, its page has no band and no Close, and
  it is the one way to the page in the chrome: the top bar holds no Monitoring
  icon. A pinned port that is down puts the warning dot on it, named "Monitoring,
  pinned port :5173 is down" (`monitoringSignal` lists the down pins,
  `doorSignalOf` names them). Inside a session the column stays the same and marks the open
  session's row; the session's own levels live in the session rail at the left
  of the page (see Session rail). The column is on every screen with a workspace: the board, a
  session, the draft and every studio but Settings, which swaps the column's
  content (see Studios).
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
  a hunt. ⌘B folds the column into its rail of doors, which keeps every
  destination; the full column, sessions included, peeks back when the pointer
  rests at the window edge. Peek floats the one column over the page instead of
  laying it out.
- **Navigation chrome is neutral at rest.** Selection shows as a muted fill,
  never an inversion. The app has no inverted navigation control. New session
  is the only emphasised column control. Doors, Board included, are neutral at
  rest, and so is the column's Goodboy row, with one exception: a pending
  update adds a version pill to the row until you act on it. An update is an
  event, not a rest state.
- **Settings match the scope they edit.** Application settings is a full-page
  studio. Workspace settings is a scoped pane. Changes save instantly: no
  Save/Cancel footer, and no settings surface stacked on another.
- **One studio slot.** Workspace and app studios share the shell's single
  studio slot, one at a time. Scope decides the pattern. Session-scoped
  editors layer over the session pane. Studios take the slot. Anything that
  became a lens stays a lens.
- **A door replaces, a link stacks.** A door is a control that names a studio:
  a column door (Tasks, Chat, Workflows, Terminal, Monitoring, Settings), a ⌘K Go to
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
  `aria-current="page"`, in the column and on the rail alike. Every door reads it from one place (`columnPlaceOf`, through
  `useColumnPlace`), so at most one door carries it; inside a session no door
  does: the open session's row is the column's sign and the current page row is
  the session rail's (see Session rail), one sign per navigation column. A popover trigger (the
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
opens it on a mode. Commands is the first mode. Its repo rows
(`sources/repoEntries.ts`) pull the base branch of the linked repos through
`checkout_update_base`; each row and each toast line names the branch it
updates and where the checkout stays. Inside a session, New terminal reads
"New terminal in this session" and opens a fresh tab in the session terminal
drawer instead of the Terminal page.

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
     step, Restart step, Stop run); and **Open Runs**. ⌘K also offers **Start from** each
     preset (`startRunFromPresetEntries`), which opens the Start a run field
     with `~` and the preset name.
  4. **Recent**, agents of this session first; then four fixed groups, each
     entry in the one its `kind` names (`EMPTY_SECTION_KINDS` in
     `commandList.ts`): **Go to** (`goto`: Sessions, Tasks, Chat, Workflows,
     Terminal, Impact, Monitoring, Notifications, Settings), **Create**
     (`create`: New session, New chat, New terminal, New workspace), **App**
     (`action`: Resume setup while setup is unfinished in the main window,
     Theme: dark, Theme: light and Theme: system, Check for updates, Connect a provider, Reset chat, the column
     fold) and **Help** (`help`: Guide, What's new, Keyboard shortcuts, Report a
     bug). New workspace answers to its former names, Open a folder and Start a
     new project (`formerNamesOf` in `shared/utils/names.ts`). Pair an iPhone and one
     **Guide: {chapter}** entry per `GUIDE_CHAPTERS` row (opens it through
     `openGuideChapter`, also while the Guide is open) are typed only. Pair an
     iPhone answers to Pair your iPhone and the other former names of the page.
     Check for updates opens Settings > Updates and runs the updater check only
     in a status the menu item also checks. Palette and menu bar share one
     function, `checkForUpdatesNow` in `features/updater`.
     The overlay is a compact window: 640px wide (search 720px), a 48px input row,
     28px rows, a list capped at 320px that scrolls, a 320px minimum height
     (`PALETTE_MIN_HEIGHT_PX`), and a key chip with a minimum width so a glyph
     like the Terminal one is never clipped.
     On the Board the first section is **Needs you**: the sessions the
     Sessions door dot counts (`useNowSessions`), each opening its `attentionPlace`. The session pages (Open Overview,
     Questions, Artifacts and the rest), Run defaults and Impact: Spend stay out
     of the empty list and answer to typing.
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
  them. A lone `Ask in chat` row stays first for free text.
- **Verbs come from the action registry** (`features/actions/`) and follow its
  state rules. A verb whose `when` is false never shows. A blocked verb shows
  only when searched by name (every word a word prefix of its label), dimmed
  with its reason, and Enter does nothing. Delete and the other confirmed verbs
  swap the list for an InlineConfirm; Archive runs at once with Undo. The
  registry owns Comments, Files and Open in terminal of a session in scope, so the lens
  rows with the same names step aside. The lens rows read their labels from
  the shortcut registry, which reads `NAMES` (`Overview`, `Comments`, `Files`,
  `Pull request`), so the palette, the page menu and the shortcut sheet cannot
  disagree; `Review`, `Diff` and `Session` still answer to a query as former
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
lists the same set in two bands per project: **Services** (category `dev`, or a
script named `start`, `serve`, `watch` or `preview`, decided by `isService`) and
**Tasks** (the rest), each with a count from two, on one grid: glyph, name,
a fixed meta cell and one **Run** or **Stop** glyph. A running service row shows
the last output line, its uptime (CPU and memory, the monitor snapshot for the
run's pid polled only while the lens is open, in the tooltip) and its port as a
link once a listener owned by the run exists; an idle one shows its expected
port as a chip, or `:5005 in use` in warning when another worktree holds it.
A task row shows a result glyph, its duration and age in gray, and the last
line of a failure. **Pin**, **Restart** and the rest are in the row's right
click menu. A project with nothing pinned shows a dimmed **Suggested** band (its
root `dev`, `build`, `test`, `lint` and `typecheck`, first match each) with a
**Pin** on every row. Scripts that are not pinned stay on the workspace Folders
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
keeps ⌘F for its own scrollback. [search.md](../search.md) owns the index, the
landing targets and the find rules.

## Addresses and history

Every view has an address, and one history per window and workspace records
them. The navigation slice (`store/slices/navigation/`) owns both.

- **A `Location` is where you are plus how the page was.** Its `place` is the
  board or a session view: lens, open agent and one target
  (artifact, run, issue, diff focus, Explore project). Its `studio` is the app
  studio open over that place, if any. Its `focus` is the page state: the open
  drawer, selection, scroll and revealed rows. `locationKey` prints the text
  form used by tests and logs: `board`, `s/{session}`, `s/{session}/branch/comments`,
  `s/{session}/branch/pr` (the Overview section, see below),
  `s/{session}/workflows/{run}`, `s/{session}/agents/agent/{agent}`,
  `s/{session}/branch/comments/t/{thread}` (a thread, with a fix run transcript in the drawer when one is open).
- **One door.** Every move goes through `navigate({ to, mode })`, `back()`,
  `forward()`, `up()` or `amendFocus({ patch })`. `sessionPlace`,
  `agentPlace` and `BOARD_PLACE` build the `to`. The per-session keys the
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
  notification, Board) starts with an empty focus. A page row in the column
  navigates first and clears the run and artifact focus after, so the clear
  never reaches the entry it leaves (`SessionPages`).
- **Up goes to the parent.** When the previous entry is the parent, Up is Back.
  Otherwise it pushes the parent (`upTo({ to })`, which `up()` and every crumb
  call). Closing an app studio is Back to the entry below it, so Up from a
  studio and Close land in the same place. `upTrailOf` walks `parentPlace`
  from a place up to its session and `crumbOf` names each step: the session
  title, the page, then the item's kind (Run, Agent, Artifact, Issue, Branch,
  File, Thread).
- **Dead entries fall out.** An archived or deleted session removes its
  entries and collapses the duplicates left behind. An agent that is gone
  falls back to its home lens.
- **Keys.** ⌘[ and ⌘] (`nav.back`, `nav.forward`, app plane) and the mouse's
  back and forward buttons walk the stack. ⌘↑ (`nav.up`, `goUp`) is Up; on a
  session's Overview, which has no parent, it goes to the board, while ⌘W
  there keeps walking history. In a studio, ⌘↑ runs the parent crumb of the
  `StudioTrail` on screen (`studioUpSlot`), so Impact › Spend › a provider goes
  to Spend and a full Tasks record goes to the list; a studio with no trail
  parent closes. ⌘↑ yields to a text field, where it moves the caret to the top.
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
A move (`Move to`, Take off, Put on a branch) is one operation: it replaces the
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
drawer covers it (`data-drawer-mode="overlay"` on the drawer `aside`), the
toast keeps its title and drops the action. A push drawer leaves the page
visible, so it does not count as covering.

A user start raises one toast. The caller passes a `startKey` (a run id or an
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
