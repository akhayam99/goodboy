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
  its tooltip and accessible name, never a colored number. Sessions carries the
  warning dot while sessions need you, named "Sessions, 2 need you: Checks
  failing, 1 question for you" (`doorSignalOf`, `needsYouReasonsOf`). It reads
  `useNowSessions`, the attention group of the same `useStageGroupedSessions`
  the board lanes use, and the palette's Needs you rows read it too.
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
  placeholder and the top bar pill say the same words: **Search or ask**.
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
     step, Restart step, Stop run); **Run a workflow**, which opens a level of
     workflows ("from a workflow"); and **Open Runs**. Picking a workflow, here or
     from a typed `Run a workflow: Ship a fix` row, opens a confirm that names the
     session, the project, the model and the steps, and nothing starts until you
     confirm.
  4. **Recent**, agents of this session first; then four fixed groups, each
     entry in the one its `kind` names (`EMPTY_SECTION_KINDS` in
     `commandList.ts`): **Go to** (`goto`: Sessions, Tasks, Chat, Workflows,
     Terminal, Impact, Monitoring, Notifications, Settings), **Create**
     (`create`: New session, New chat, New terminal, New workspace), **App**
     (`action`: Resume setup while setup is unfinished in the main window,
     Switch theme, Check for updates, Connect a provider, Reset chat, the column
     fold) and **Help** (`help`: Guide, What's new, Keyboard shortcuts, Report a
     bug). New workspace answers to its former names, Open a folder and Start a
     new project (`formerNamesOf` in `shared/names.ts`). Pair an iPhone and one
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
keeps ⌘F for its own scrollback. [search.md](search.md) owns the index, the
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
  click. Back to an address with no mount does not move the write destination.
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
  (creation pickers, property pickers, page chrome).
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
  changes; Message this agent, Interrupt while a turn runs, Close or Reopen,
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
  (`shared/hostIconOf`) and its `ariaLabel` the spoken `Open on GitHub`, which
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
  `aria-live="polite"` dock announces `n selected`. Under the sidebar list a
  quiet line reads "Shift click for a range, Option click to add one" while
  nothing is selected. The chat rows, Review, Branches and the Storage lists
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
run pages (the preset run level and the orchestrated document) hold **Pause
run** and **Stop run** (asks first) as visible words in their header while the
run lives (`RunLiveVerbs`, the `workflowRun` registry's own `when`: Pause while
a step is in flight and the run is not paused, Stop while the run is closable),
then the run `⋯`; the verbs of `runPrimaryOf`
(**Review plan**, **Answer**, **Continue the run**, **Retry**,
**Raise limit**, **Decide next step**, **Start step 2**, **Start run**)
sit on the run tail (a paused run's tail only says Paused by you, since
Resume run sits in the header), and an archived run shows **Restore** as its one header
primary. The `⋯` holds View diff, Step routing (orchestrated), Autonomy, Skip
step N, Save as preset, Copy run summary, Archive run and Delete run, never
**Approve plan**, **Pause run**, **Resume run** or **Stop run**. After Pause
run the header shows **Resume run** in its place (`workflowRun.resume`, while
`isRunPaused`), and Stop run stays. A failed Pause, Resume or Stop leaves the
run as it was, reports the error and keeps the word, so pressing it again is
the retry.
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
  (`ColumnRail`): on the workspace level the toggle, New, Sessions, Tasks, Chat, Workflows and Terminal as icons
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
  (`FoldLayers`, [styling.md](styling.md#the-window-grid)): the width eases, the
  words fade, and the 44px rail's icons sit on the open rows' lines.
- **The main sidebar never folds by itself; a pane folds by its tier.** Only
  its toggle folds the column: the one toggle sits in the top bar, left of Back
  and Forward (`ColumnToggleButton` in `AppTopBar`, ⌘B), and no pane and no
  window width folds it. `shellFoldsOf` (read through `useShellFolds`) reads the
  open pane's tier: a reader tier pane (720: a file, a diff, a document, New)
  folds the session rail to its 44px icons while it is open; a side tier pane
  (416: Ask, Terminal, Explore, Context, Agents, Scripts and the transcripts
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
([concepts.md](concepts.md) → Lazy sessions), and this group is where a
session's footprint grows. What a worktree asks the user to decide shows in the
Overview notices slot ([mounts.md](mounts.md#worktree-rows-and-the-overview-notices)).

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
  toggle at the left and two icon buttons at the right, no `⋯`
  (`SessionLevel/SessionLevelActions`): **Pin session**, a toggle that shows
  pressed while on and runs its registry action (`session.pin` / `unpin`; a
  failure keeps the old state and shows under the row with Retry,
  `ActionStatusLine`), and
  **Refresh session** (⌘⇧R, `useSessionRefresh`, the same call as the key and
  the palette). Autopilot has no rail control: Turn on Autopilot and Turn off
  Autopilot (`session.autopilotOn` / `Off`) stay in the sidebar row's right
  click menu and the palette. An archived session shows none of them. The foot
  (`SessionLevel/SessionLevelFoot`) is one row: the session spend at the left
  (`SessionCostChip`, over `sessionSpendByAgent` and
  `sessionSpendPresentation`, the one source of the number): `$3.47`, or the
  compact `$3.47 / $10` once a limit is set (`compactLabel`, a whole limit
  without its cents), with the full sentence ("$3.47 spent of the $10.00 limit
  in this session", `sentence`) in the tooltip and `Spend $3.47 of $10.00
limit` as its name; the warning tone from 80 percent and danger past it, the
  pause glyph and `Paused, …` in the tooltip when a pausing limit stopped the
  session, and `Set a limit` in faint gray while nothing is spent and no limit
  is set. A click opens the session spend popover (the limit editor, the
  agents and the context cost, Open in Impact); **Raise limit** on a paused
  run opens it on the editor from any session level: off the session level an
  edit host in `SessionFrame` opens it at the rail foot (`sessionSpendLines`).
  At the right of the same row sit two `sm` icon buttons, no text and no
  ellipsis, each with a tooltip that names it and its key: **Archive session**
  (the archive icon, ⌘⇧A, the registry `session.archive`; **Restore session**
  with the restore icon on an archived session) in gray, and **Delete session**
  (the trash icon, ⌘⇧⌫) in the danger tone. Archive asks first: the registry
  verb carries a confirm (`archiveConfirmOf`, "Archive session?", saying how
  many agents are still running in the session when any run, from
  `runningAgentCountOf`, and that they keep running after the archive), so the foot, the sidebar row's right click menu, the
  palette and ⌘⇧A (`SessionArchiveBridge` triggers the same verb and anchors
  its confirm at the window corner) all ask the same way, and Undo on the toast
  still restores it. Restore never asks. Delete opens `DeleteSessionConfirm`
  anchored to the button (end aligned, the `ConfirmPopover` default, flipped
  above it and kept inside the window by `useDropdownDirection`). Rename has no rail
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
  state dot, a shape glyph (Plan or One agent), the title, where it came from
  ("Was a preset run · Fix a layout", "Was an orchestrated run", "Was an Auto
  conversation", "Was an agent · Scout"), its state word, progress, cost and
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
  verbs (`session.startRun`) and ⌘K **Start a run from** a preset
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
  state table in DESIGN-SYSTEM.md), the title,
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
  chip, `Failed` with the cause in the row tooltip. When Auto has the rest the
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
  and the stopped-rebase prompt `RebaseConflictPrompt` sits under it); then
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
  is described in [features/overview.md](features/overview.md#changes); an
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
  ([The orchestrated document](workflows.md#the-orchestrated-document)).
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

The tools (Ask, Terminal, Explore, Context, Agents, Scripts) are panes, not pages:
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
you rows land (`attentionPlace`). Moving to another row swaps the card at once, with no second
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
stays up whatever the threshold. The threshold and
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
under Pinned. Pins are stored per workspace in the `settings` table (key
`sessions.pinned.<workspace id>`, a JSON list of `{ id, at }`), written by
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
lands on the landing tab of that branch (`branchLandingTabOf`), never on the
tab, thread or diff focus of the branch it leaves.

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
[keyboard.md](keyboard.md)), the board, the palette
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
once. Text in **Start a run** counts as written: while no session exists the
draft holds it as `workflowGoal` (`useStartRun` reads and writes it, and a
door that fills the page writes it: `openNewRunDraft`, `pickIssue`). With text Esc
raises `Keep this draft?` under the field, inline and without a modal, in the
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

The draft asks no question first (`SessionKickoff`): **Folders** (`KickoffProjects`
over the shared `ProjectPicker`) sits above the **Start a run** field
(`StartRun` with `sessionId` null), and **Start blank** sits in the page
header. Folders is optional, a searchable multiple `Listbox` with the picked
projects as removable chips under it, in two groups (`projectPickerGroups`):
"Suggested" holds at most five (the most recently used, then starred ones) and
"All folders" lists the rest by name with the base branch at the right. The
trigger reads `Add folder` with or without a pick (`emptyValueLabel`). The
draft keeps them as `projectIds`; the first is the session's project and the
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

One thin icon column at the right edge of the session content, between the
page and the open drawer, the same on every rail level and in this order:
**Ask** (⌘L), **Terminal** (⌘⌥T), **Explore** (⌘⌥X), **Context** (⌘⌥C),
**Agents** (⌘⌥L) and **Scripts** (⌘⌥S) (`SESSION_TOOLS`). `SessionTools`
(`features/session/components/SessionTools`) is mounted by `SessionFrame`
after the page, 44px wide on the sheet background, its buttons starting on the
rail top row's line. Each tool is a 32px `IconButton`
(`SessionToolButton`): icon only, its word and chord in a left tooltip and in
its accessible name ("Context, Decisions changed since you last looked" while
a dot shows), `aria-pressed` with the `bg-selected` fill while its drawer is
open (`openPaneOf`). The Context dot stays on the icon's corner: info while the
summary runs, danger when it failed, primary when the context changed since
you looked. The column is a `toolbar` (`aria-orientation="vertical"`, named
Session tools) with one tab stop; Up, Down, Home and End move it
(`toolbarIndexAfter`). There is no menu, so a page header never shows a second
`⋯`. With a side pane in push mode the column sits right before the drawer;
when the window is too narrow for the pane to push (about 1100px with the
sidebar open), the pane floats over the page with the scrim and covers the
column, as it covers the rest of the page, until Esc or its close returns it;
the tool chords keep working. The line between the two is one rule,
`drawerLayoutOf` with `DRAWER_PUSH_RESERVE` ([styling.md](styling.md)).
Folding the rail leaves the column in place, and a drill never moves it.

- **Agents holds what a run or Auto spawned** (drawer kind `spawned`,
  `app/components/SpawnedPanel`), in place of the old level 2 of the session
  rail. Its body follows the page (`useSpawnedFocus`): on a preset run (from
  Runs, Now, What was done or a link to a step, read through
  `presetRunFocusOf`) it shows the run's identity row (the state dot and the
  title, which renames inline on click), the run's agents as a tree, **Add
  step** and the foot "Limit $3.00 · $1.12 spent" (`RunSpendFoot`); on an Auto
  agent or one of its children it shows Auto and its children as a tree, "No
  agents started yet" while Auto has none, and the limit foot
  (`AutoLimitFoot`). With nothing selected, or after **All launches**, it
  lists every live and recent launch of the session newest first
  (`launchesOf`: preset runs that are not archived and Auto roots), each with
  its agents under it; picking a launch opens it in the center and keeps the
  panel open (`openSpawned` passes the panel as the navigation's drawer). The
  tree is drawn on the Activity rail, in the Activity orientation: a **Now**
  marker on top (`SpawnedNowRow`), the spine running down to the oldest
  launch, and inside each launch the children above their parent, newest on
  top, each joined to its parent's lane by the same branch curve
  (`spawnedRailOf` lays the rows out with `layoutTimelineRail`, `SpawnedRailCell`
  draws them with `TimelineRail`; a queued child dashes its lane). The DOM keeps
  each launch parent first for assistive tech and reverses it on screen
  (`flex-col-reverse` on `[data-spawned-launch]`); every reader of the screen
  order goes through `spawnedTreeItemsOf`. A focused Auto launch is the same
  `SpawnedAutoGroup` as the list, so it reads the same way: Now, the newest
  child, down to the oldest, Auto at the foot, then the limit foot. A child
  that starts while you read lower in the list moves in at the top and the rows
  you read stay where they are (`useSpawnedScrollHold` keeps the first visible
  row's offset across the change; at the top, on Now, the new row simply shows).
  Focus stays on its row. The run page's step tree (`OrchestratedChecklist`)
  stays top down, the first step on top. A row is one 28px line: the
  state node on the rail, role glyph (the noun in its tooltip), title, the
  active time (`DelegationClock`, the clock every work row reads). An Auto
  root is titled by the ask it started with, loaded with the tree view, not
  its transcript (`autoRootTitleOf`, the same title as the Auto agents list) and a child by `autoChildLabelsOf`
  ([auto.md](auto.md#the-chat)). Every Auto parent folds on its row (chevron,
  Right opens, Left folds, `foldSpawnedRowsOf`): a tree live when it first
  loads opens, a settled one folds, and a folded row keeps its state and says
  its count of children ("3 agents"); settled sub agents of a run fold into one
  row like the run page's (`useFoldedRunTree`). The rows are a `tree` with
  `treeitem`s and `aria-level` (`SpawnedTree`): one tab stop on the newest
  root, Up and Down and Home and End in screen order, Left to the parent
  (below), Right to the nearest child (above) or to open a fold, Enter or
  Space to open (`treeKeyTargetOf`).
- **A row opens its transcript in the drawer.** A run agent opens the
  `run-step` drawer, an Auto child the `auto-child` drawer, both with `from:
'spawned'`, so Agents stays lit (`openPaneOf`) and the drawer shows **Back
  to agents**; the Auto row and a run head open their page in the center. The
  drawer pushes the page or lies over it by the one drawer rule, with the
  scrim, Esc and focus trapped and returned (`DrawerColumn`, `DrawerFrame`).
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
  `back`, carried by the payload's `from`). `openExplorePane` takes the
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
  the crumb, the title and the body share one x ([frame map](./styling.md#the-frame-map)).
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
- **Theme is in the bar.** A 28px square `ThemeToggle` sits between spend and
  the bell, because the owner switches often: Sun in light, Moon in dark,
  Monitor while following the system. The tooltip names the state and the
  action (`Dark theme. Switch to light`, `Matching system (dark). Switch to
light`) and a click writes the explicit opposite of what shows. Settings >
  App > General keeps the three-way choice and the palette keeps its entry;
  all three call `switchTheme({ to })` in `shared/lib/theme.ts`, the only
  writer. The swap stays one paint (`theme-switch-is-one-paint`). No shortcut
  is bound to it.
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

Auto is described in [auto.md](auto.md); this is where it sits. Auto is always
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

## Studios

Utility studios (Tasks, Chat, Workflows, Terminal, Impact, Notifications, Changelog,
the guide, Add workspace) render in the shell's studio slot, which
covers the content area only, beside the column, as its own sheet; the page
title is its one header (no title band). The column stays live, so another door or a session row is
one click away. **Settings is the one studio that takes the column**, in
both sidebar states: `shellArrangement` takes `isSettingsOpen` and returns
`leftSlot: 'column'` with no peek, so a folded sidebar shows the column at its
saved width while Settings is open and the rail returns when it closes. The
stored collapse is never written (`leftSidebarCollapsed` reports it as it is,
`isLeftRail` says what is drawn), and ⌘B waits. The column's content
cross-fades (160ms) to `‹ Back to app` (with its Esc hint), `Search settings`
and the settings groups, on the chrome like the sessions list, and the page
fills the content area as the one sheet. There is no band, no crumb and no
second sheet: `StudioFrame` draws no band (`hasBand={false}`), `SettingsStudio`
draws no `StudioTrail` and no `StudioRailLayout`, and the page's title row sits
where Overview's does (`UnderTrailContext` drops the 12px a bare page adds, and
the 40px a band would take is the top padding). There is no Close: Back to app,
Esc and Back land alike. A session key (⌃Tab, ⌥⌘↓, ⌘⇧[) is a forward move and
closes Settings on its way. On close, `StudioFrame` gives focus back to what
opened the studio, or to the studio's door when that is gone (the palette),
unless focus already sits outside the studio (`restoreStudioOpener`). The
exception is Home, which has no column to give. On Home, New workspace swaps
the list for the form in place, and the app studios take the whole window:
Settings (its corner gear, ⌘, or ⌘/ for shortcuts) and the guide. The palette
opens there too.
Studios are not part of the breadcrumb IA. They exit on close or Esc, and only
one is open at a time.

- **An open studio is a history entry.** Opening a studio, or switching from
  one studio to another, pushes an entry over the page underneath
  (`openStudio`). Reopening the same studio, a Settings scope change and the
  Tasks' provider and record update that entry (`amendStudio`). Back from
  Workflows reopens Tasks with its record. Close and Esc fold every studio
  entry stacked on the same page into that page (`closeStudio`): closing means
  the side trip is over, Back means one step.
- **Navigating closes the studio.** A forward move to a place (another
  session, a lens, an agent, the board) arrives with no studio, whether it came
  from the palette, a needs-you row, a shortcut or a link inside the studio, so
  the destination always lands in front. Switching workspace closes it too.
- **One frame for every studio.** `StudioFrame` (`app/components/StudioFrame`)
  mounts only while a studio is open and stays mounted from Tasks to Workflows
  to Settings. It owns the 40px band (the studio's icon and name, the body's
  subtitle, Close; Settings in the default shell has no band at all,
  so `hasBand` is off and its skeleton has no rail), the Esc layer and the motion: `studio-in` when
  it opens, `studio-out` when it closes, and on a switch only the band's name
  fades while the new body enters in 160ms. A studio body still renders
  `StudioShell`; inside the frame it only hands its chrome to the band. Until a
  body's chunk arrives, the frame shows the opaque skeleton of that page
  (`STUDIO_META[kind].skeleton`, drawn through `PageSkeleton` on the page's header
  inset and measure): `rows` (Tasks, Workflows, Monitoring, Notifications, Settings,
  Add workspace), `prose` (the guide, What's new), `room` (Chat), `terminal` and
  `cards` (Impact), with a rail skeleton where the page has a rail. With no
  studio open, no frame node exists, so nothing covers the page.
- **One title per page; the band holds no title.** `StudioBand` never draws a
  crumb title, an icon or a subtitle; the page `h1` is the one title.
  `STUDIO_META[kind].close` places Close: `none` for the sidebar door pages
  (Tasks, Chat, Workflows, Terminal, Impact, Monitoring: no band, no Close, the
  top bar Back and Escape leave them), `header` for Notifications, the guide and
  What's new (`StudioFrame` passes Close through `PaneActionsContext`, so it is the last
  action of the page title row, and the band holds it only until a page header
  claims it), `band` for the rest (Settings over the window, Add workspace),
  whose 40px band holds only Close
  inside a `PageColumn` of the studio's tier. A band also appears when the body
  claims it with a `StudioTrail` or passes a header accessory. While it draws a
  band, the frame hands its body `UnderTrailContext`, so a studio title does not
  add the 12px a bare page adds; a bandless page sits on the 12px header inset
  (`frameGeometryOf`), like a session page. The provider wraps the body whether
  or not the band is drawn, only its value changes: a trail that claims the
  band must not remount the page that drew it (Tasks Open full lost its record
  that way). The frame root carries
  `data-studio-title` for the journey tests.
- **Every studio draws the grid's title row.** Each studio has one
  `h1` in the same 32px row as every page (`PaneTitleRow`, fixed `h-8`, the actions
  at its right, a long title truncates and never wraps the row): Tasks the view's name,
  Workflows `Workflows` with its tab strip under the title and `New workflow` as the
  one primary at the right end of the tab row, Impact `Impact` with the period selector in the row and a meta line
  under it (the band keeps the crumb and Close only), the guide `Guide`, What's new and
  Notifications through `PaneShell`, and the Chat thread's title as the same `h1`
  (`ChatHeader`). Exactly one `h1` per studio scene.
- **One Terminal studio for every terminal.** The Terminal door (⌃`, `terminal.studio`)
opens `StudioPlace` `{ kind: 'terminal'; terminalId; sessionId; worktree }`in`TerminalStudio`:
`StudioShell`plus`StudioRailLayout surface="terminal"`. The rail does not fold, and its first
child is `New terminal`, a split secondary control: the button opens a tab in the selected
worktree, the chevron opens the picker. The picker (`NewTerminalMenu`, `terminalPickerClusters`)
opens to the right of the chevron (`useDropdown` `side: 'right'`) in clusters: `Workspace folder`first, then one cluster per session with attached worktrees, headed by the session title alone
(issue chips and diff stat stay off this page, cut C3); a row is the project, the branch, the short
worktree chip and the path on one line, and`Open project`opens the project settings. The
`Workspace folder` row is named by the folder (`harborline`), since the cluster title says the
rest; a worktree path keeps its project folder and its `gb-` folder whole (`pathTail`), and the
head of the path truncates first.
With no terminal at all the page has no rail: the empty state owns the single`New terminal`.
The rail is one `ListGrid`named`Terminals`with one`ListGridGroup`per session that has
terminals: the session title, a visible arrow button (`Open session`) beside it and the number of terminals in
the last column; the`Workspace folder` group comes last and has no action. Inside a group, one
28px row per worktree (`terminalWorktrees.ts`, key `<sessionId>#m:<mountId>`, or `#p:<cwd>`when
no mount matches) on the shared columns: branch or folder icon, project and branch, the first
port (hidden on the selected row, whose ports sit at the tab strip's right edge) and a running
dot while a shell runs a process; the folder path and every port live in the row tooltip, never
on screen (`TerminalWorktreeRow`). Selecting a row shows its terminals as tabs
(`TerminalTabStrip`) with a `+`that adds a tab in that worktree. There is no terminal header:
the tab strip's right end carries `TerminalStripActions`, a `⋯`with`Open session`and`Copy worktree path`(or`Copy folder path`) from the `terminalTab` kind of the action registry, a single word when only one applies. A new terminal is
always a tab of its worktree, titled`shell`, then `shell 2` (`nextTerminalTitle`); a tab is
renamed by double click, Enter saves, Esc cancels. When the shell exits, whatever the code, the
tab closes and the studio selects a neighbour of the same worktree: the watch lives in the
terminal slice (`watchTerminalExits`, started by `reattachTerminalTabs`), so it works with the
page closed. Only a terminal that failed to start stays, as a `failed`chip with a restart
button, and it is never opened again on its own. The close x is 28px, always visible: an idle
shell closes at once, a busy one asks in a`ConfirmPopover` (`Keep`, danger `Close`). The detail
is a location row (the cwd trimmed to the workspace folder, middle truncated, and the `cd`menu, only while the shell is idle), the tab strip, then the shell. A terminal id is`<sessionId>::t<n>`for a session and`ws:<workspaceId>::t<n>` for the workspace
(`terminalOwner.ts`). A session has no Terminal page of its own: the session terminal lens is
gone, and a saved location that still names it lands on the session overview
(`withoutRemovedPages`). `⌘T` (`terminal.newTab`) adds a tab to the selected worktree while one
has focus. ⌘K has `Terminal` (`goto:terminal`), `New terminal` (`action:new-terminal`, the
workspace folder) and, in a session with worktrees, `Open <repo · branch> in terminal`
(`session.openWorktreeTerminal`, one choice per worktree).
- **A session terminal opens in a right drawer.** `openSessionTerminal` adds a session terminal at
  the worktree (or reuses a running one there, never when it carries a `prefill`) and opens the `terminal` drawer over the session
  (`DrawerContent` `{ kind: 'terminal'; payload: { terminalId } }`, `TerminalDrawer` in
  `DrawerHost`, side sizing, resizable like the others). The mount row and diff `Open terminal`,
  the rebase banners (`openMountTerminal`), the session row menu, ⌘K `Open <repo · branch> in
terminal` and `⌘⌥T` (`session.terminal`, toggles the drawer on the active worktree) all go
  through it. The header holds the project name, the short worktree chip (it truncates before the
  buttons), two icon buttons (`Open on Terminal page` and `Close`, the text in the tooltip and the
  `aria-label`) and the same tab strip as the page: drawer and page show the same tabs of the same
  worktree. Closing the drawer never kills the shell: the tabs stay in the Terminal list under the
  session's group, and the drawer closes by itself when its worktree has no terminal left.
  `Open on Terminal page` closes the drawer and selects the same tab on the page; the pane
  remounts on the same pty and replays its scrollback. The page group title is the session title,
  cut at the end, never in the middle; the group's `aria-label` keeps the full
  title.
- **One Esc stack.** The frame, a body that holds Esc (Tasks with a record
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
  members and Report this). Both lead with the severity glyph alone: unread is
  the title weight (500 in foreground), read rows recede, and no second leading
  dot. In the studio the time owns the third column and a fixed fourth column
  holds the hover controls (`NotificationRowActions`): the registry's hover
  action (Mark read, one click) and the `⋯` menu of the `notification` kind
  (Open, Mark read or unread, Report this, Copy text, Delete), also opened by
  right click. They show on hover and keyboard focus, never change the row's
  width, and the opened row keeps only the notification's own action (Retry) as
  a button under it. A failed write shows a "Couldn't finish that" toast and
  leaves the row as it was (`runVerb`). The facets (view, severity,
  source and, with more than one workspace, the workspace scope) are a page rail docked beside the list, in
  Chat's frame (`StudioRailLayout`, `placement="page"`, surface `notifications`,
  288px), with counts that come from SQL (`countNotifications`), so they stay
  true past the loaded page; a facet count shows from two, a zero facet is dimmed
  with no number. The rail holds no key legend: the keys are in the tooltips and
  the Keyboard chapter of the Guide. Load older pages with a cursor. The page has
  no subtitle and the day groups no count. The title is
  Notifications whichever view is picked. Both surfaces default to this workspace: a row belongs to
  its own workspace, or its session's, and a row with neither is app-wide and
  shows in every workspace. Mark all read and Delete all act on that same scope.
  The studio header draws them through `NotificationsHeaderActions`: the shared `FilterButton`
  only while the rail is folded, then the ghost `Mark all read` (only while something is unread), then the `⋯` menu of the
  `notifications` kind of the action registry (Mark all read, which names the scope, and Delete all). Delete all
  opens a `ConfirmPopover` anchored to the `⋯`, aligned to its end edge, titled with the scope's count ("Delete 7 notifications?") and naming the
  workspace or "every workspace"; it never swaps the title row. The title row's meta reads the
  count and the unread count ("6 notifications · 4 unread"). A row's Delete acts
  at once and pushes "Notification deleted" with Undo (`dismissNotificationGroup`
  re-inserts the rows through `insertNotification`; ⌘Z works too).
  In the studio, rows are grouped by day (Today, Yesterday, This week, Older),
  J and K or the arrow keys move, Enter runs the row's action and E deletes. The
  cursor never marks a row read: a group is read when it opens (a click or
  Enter) or from its own Mark read.
  The rail rows (`packages/ui` `FacetRail`), the list keys
  (`shared/hooks/useListKeys`) and the day grouping (`shared/utils/groupByDay`)
  are shared primitives. Tasks uses the rows and the list keys but not the day
  grouping or a rail: its facets (source, show, type, project) sit in one Filter
  menu of the header, next to the For me and All switch, the search, the grouping button (`Group: Source`) and
  `⋯` (Refresh, Manage tools: the `taskList` kind of the action registry), and its rows are one `ListGrid` with a group per
  source, status or project (`taskGroupsOf`), the total on the label (`taskGroupTotalsOf`, starred rows included), five rows each until Show all, and
  each group is its own listbox of options. J and K move a cursor through the
  rows on screen, and the record follows in the pane only once one is open.
  Tasks opens with a quiet cursor on its first row (`data-cursor`,
  `aria-selected="false"`) and no pane, so those keys act at once and nothing
  opens by itself; a click, Enter or a record asked for on open
  (`initialRecordKey`) opens the pane (`aria-selected="true"`, `bg-selected`).
  Enter on the row the pane already shows opens its launch popover (⌘↵ in the
  panel launches) or the session once one is linked, O opens the record in its
  tool, R opens the record and focuses the reply box when the record has one (a
  Sentry issue has none, so R does nothing there, `recordCanReply`), S stars or
  unstars, / focuses the search, and Escape in the search leaves the field.
  Escape closes the pane, or the full page, first and keeps the cursor; a second
  Escape closes the studio.
- **A list that belongs to the page sits in the page.** Chat's list of chats,
  Changelog's releases and the guide's chapters are content beside their
  detail, not a second navigation column: `StudioRailLayout` with
  `placement="page"` draws the list on the page background with the resize
  edge as the only line. Tasks' and Notifications' filters are the same frame. Every page rail opens at
  288px (`standard`); the skeleton reads the same constant.
- **A page rail folds, and folds itself when there is no room.** A page may pass
  `onCollapsedChange`: the rail's first row then holds a fold control (tooltip
  "Fold the rail" with ⌥⌘B), a folded rail leaves a 44px strip with "Show the
  rail" at the same height (none while the pane is too narrow to dock,
  `canUnfold`), and `useStudioRailFold` remembers the choice per surface
  (`goodboy:studio-rail-folded:<studio>:v1`). Chat, Terminal, the Guide, the
  changelog, Settings in its studio frame and Notifications fold this way.
  **⌥⌘B** (`innerColumn.toggle`) folds the inner column of the page you are
  on: each foldable column registers with `useInnerColumn` while its page
  shows (the session rail while no studio covers it, a page rail through
  `StudioRailLayout`), the key toggles the last one registered
  (`innerColumnStore.toggleCurrent`), the palette lists it under that
  column's name (Fold the chat list, Show the session rail) and leaves it out
  on a page with none, where the key does nothing. Under a pane of 880px the rail
  folds without saving anything and docks again when the pane widens. A folded
  rail leaves the shared `FilterButton` (28px tall, the lines icon with the
  count of active filters; docking the rail again is the Show the rail strip
  at the rail edge or ⌥⌘B, never a header button) in the title row, opening the same facets in a popover. The search field of
  Tasks moves into the title row with it.
- **Every studio list resizes.** `StudioRailLayout` (Settings in the legacy
  layout, Guide, Chat, Changelog, Bitbucket, Tasks, Notifications) drags from
  its right edge between 220 and 420px (a page may pass `min` and `max`), step
  8px (32 with Shift) with the arrow keys, and goes
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
  portaled into the column (`SettingsColumnNav`, `Back to app` first, then
  `Search settings`, then the groups) in both sidebar states, or drawn beside
  the page on Home: its four groups (App, Workspace, Providers and
  models, Integrations) come from `settingsDirectory`. Every row is one 28px
  line of one grammar (`SettingsNavRow`): a group row carries its icon, a page
  row is nested by `PANE_RHYTHM.navRail.nest`, and a row has no second line,
  no count and no identity. A row that needs something shows a 6px dot at its
  end, named for assistive tech by the sentence that used to sit under it
  (Update needed, Signed out, Can't check, Not confirmed, Refused your runs, Error, Claude is about to run out); a quiet
  row shows nothing. The sentence lives on the page: a provider about to run
  out or out opens on a notice at the top of its page (`ProviderAttentionNotice`,
  the usage notice that used to close the Usage band). Every page is also a palette entry
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
- **Settings nests items in its rail.** The App items (General, Updates,
  Keyboard shortcuts, Storage, Backup and reset, iPhone) always sit under the
  App row as indented
  rows, whichever scope is active, so switching scope never moves a row above
  the pointer. The Workspace pages (Folders, About you, New sessions,
  Branches, Replies and commits, Permissions) sit the same way under the
  Workspace row (`workspacePages.ts`, `SettingsRailPageGroup`). The panel
  shows one item at a time. Providers and models nests
  Models and one row per provider, and Integrations nests one row per tool. Those
  two lists open and close with `Reveal`, and the rail stays one mounted
  element across scopes: `SettingsStudio` portals each scope's nested list and
  detail into slots it owns, and keeps a closing scope mounted until its list
  has collapsed. Every settings panel enters with `nav-step-in`
  (`SETTINGS_PANE_ENTRY`). So no scope adds a second rail column. Every scope
  panel keeps the reading width. Precedent: the VS Code settings table of
  contents and Linear's settings sidebar.
- **Providers and models names its scope in the page header.** Every page of
  the scope (Models and each provider) carries the scope as the meta line of
  its title: the workspace name when one is open, `All workspaces` when there
  is none (`ProviderSettingsScope` passes `scopeLabel`). The legacy trail
  reads `Workspace` and `Providers and models` without a name, so the name
  appears once per page.
- **Workspace settings is one page per area, each part in a card.** A
  workspace page carries the page title and one line of
  help; every part is a `Band` with one heading style (eyebrow, icon, hint
  under it) and help written under each field, never in a tooltip. Only the
  page on screen mounts, so Permissions and Replies and commits compute nothing
  while another page is open. The old anchors (`projects`, `profile`,
  `general`, `after-merge`, `review-replies`, `permissions`, `danger`) now
  pick a page (`workspacePageOf`); `track-with-git` (and the old
  `dev-project`) lands on Folders with the first commit review of the first
  plain code folder open. The workspace is renamed from the `Name` field of the
  Folders page, and its name is written once on that page, in the top bar
  (the disconnect row says `Disconnect this workspace`). The attribution line
  lives on New sessions only, and Replies and commits links to it. Replies
  and commits holds the reply voice and templates, `Mark thread as resolved`
  and the commit style (`review-replies` stays its page id and anchor); Run
  defaults live under Workflows.
  Tracking a plain folder with git is an inline flow in the Git repository band of the
  Folders page (`TrackWithGitFlow`, `FolderGitBand`), never a dialog: the
  first commit review, then `Publish to GitHub` through the same publish form
  as the first lap (`PublishPanel`). Creating a workspace never opens this
  band by itself: the pick row already offers **Track it with git** for a Code
  folder. A documents folder gets no row in the band.
  The **Plain folders** band (`FolderFacesBand`) lists each plain folder with
  the switch Code project or Documents (`setFolderPurpose`; when the write
  fails the old face stays, with the error beside it), one line of what the
  face means, and its saved versions: the size against the cap
  (`folderHistorySize`) with Review in Storage, or a failed first copy with
  Retry. Every window reads the faces again on focus (`useFolderFacesOnFocus`,
  in the top bar watch and on Home). Skills stays
  hidden behind its feature flag. Precedent: GitHub repository settings and
  Linear's settings pages.
- **Restore defaults and copy from another workspace share one inline
  flow.** The page menu (⋯ in the title row) of every page that owns settings
  offers `Restore defaults` and `Copy from…`; under a separator, the menu of
  every workspace page (Folders included) offers `Copy all pages from…` and
  `Restore all workspace defaults` for every page at once. The flow opens under the title as a band, never as a
  popover: pick the workspace, then a preview grouped by page with a
  checkbox per page and the from and to values, then the action row (`Copy N
settings`, `Back`, `Cancel`). It ends on a status line with `Undo`. The
  preview is computed when the flow opens (`loadFlowSources`), not on every
  render. Which keys a page owns comes from `pageKeys` (`features/settings/
pageKeys.ts`), typed so a new override key does not compile until it has
  an owner; provider defaults belong to Providers and models and are never
  copied, and neither are projects, folders, integration accounts,
  permission history or `bootstrap.*` keys. Restoring writes `null`; every
  override change of one copy or restore is one `patchWorkspaceOverrides`
  through the queued workspace writer. A field whose value differs from the
  default shows a small Reset button after its label (tooltip `Reset to
default`, hidden while the value is the default, `WorkspaceFieldRow`). Precedent:
  JetBrains Copy to Project and VS Code's Modified marker with Reset Setting.
- **Storage is the one place for disk space, scoped by a picker.** App >
  Storage lists every worktree folder Goodboy made, grouped by repository,
  under three filters: To review, In use and Kept. Each part is a card
  (`Band`) under a plain section title: Worktrees (with `Scan
another repository` at its foot), Artifacts of deleted sessions, and
  Transcripts and app data. There is no summary band: the page meta line
  reads `<total> on this Mac`, or `<total> in <workspace>` under a scope, from
  one function (`storageTotalBytes` and `storageMetaOf` through
  `useStorageMeta`), and adds `Low space: N GB free on this disk` under 10 GB
  free. The Worktrees header holds the three filters and `Remove N safe
folders · size` (`WorktreeRemoveButton`), with the sentence on idle days as
  its help line, and the folder `...` menu shows on hover and focus. `Prune`
  is a secondary button that confirms. Branches is a Workspace page
  (`branches`, `BranchesPage`): the workspace's After merge rule first, then
  the branch list under one select (`Safe to delete`, `Needs a look`, `All`),
  then a `Recently deleted` fold row (restore or delete for good, loaded from
  `deleted_branches` on open, which also releases the refs of deletions older
  than 14 days). The page meta line reads `N safe to delete · M need a look`
  (`branchesMetaOf` through `useBranchesMeta`). A scope picker
  (`StorageScopePicker`, `Listbox`) sits in the page header row next to
  `Suggest cleanup after` and `Check again` (`StorageHeaderActions`); the
  Branches header has the same picker without `Removed workspaces`
  (`BranchesHeaderActions`). `openStorage` and the
  cleanup notifications always land on Storage. The picker lists the current
  window's workspace, every other workspace with its own weight, `Removed
workspaces` (folders whose owning workspace is gone or was never linked),
  and `All workspaces` with the machine total. The scope drives the total, the
  worktree list and the artifact list together
  (`storageScope`, `resolveStorageScope`); it defaults to the current
  window's workspace, or to all workspaces without one. A scope other than
  all leaves App data out of the total (`state.storageScope`
  never splits app data by workspace). The
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
  only, in the same scope, in one list. It scans only when it opens:
  one `git for-each-ref` per project (`project_branches`), with the merge
  test cached by both tips and fed each branch's merged pull request head
  (`listMergedRequestHeads`); protected branches never show. One select
  (`Safe to delete`, the default, `Needs a look`, `All`) filters the list.
  Safe to delete means merged by merge commit or rebase, merged by its pull
  request with nothing after the merged head, or never used. Needs a look
  means `Merged, then N new commits`, unmerged and gone on origin, local only
  for over 30 days, or older than 90 days; never preselected. Every branch
  row and every Recently deleted row sit on one grid (`BRANCH_TABLE_GRID`,
  each cell marked with its `data-cell` name): select, branch with its
  session title under it, folder, state chip (`Merged`, `No commits` or the
  full verdict, with how it merged and where it lives in its tooltip), the
  last commit's age and the action cell (`row-actions`, shown on hover and
  focus). Delete reads the `branch` kind (`branch.delete`), from the cell and
  from right click. A Recently deleted row shows the sha under the branch,
  the days left as the chip and Restore plus delete for good in the action
  cell. Delete on a merged branch acts at once
  and a toast carries `Undo`; an unmerged one confirms in a popover beside its button, and the bulk bar
  counts the commits it takes. `Also delete N on origin` sits above
  the bar only for Goodboy's own pushed branches in repos where GitHub does
  not already delete merged branches. Deletes use the same
  compare-and-delete and 14-day restore as the after-merge rule. A branch another worktree
  holds reads Protected, so its folder goes first from Worktrees.
  In the space cluster, under Worktrees, "Artifacts from deleted sessions" lists plans, reports
  and wireframes whose session is gone, under To review and Kept, with Open,
  Keep (30 days or always) and Delete, which asks in a `ConfirmPopover` beside its button. Its one bulk
  action deletes the unused ones. Artifacts never trigger a nudge on their own.
- **Security findings is a section at the end of the Storage page,
  workspace-scoped** (`SecurityFindingsSection`; the old `security-findings`
  address lands on Storage, and its warning dot sits on Storage). It scans the
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
workspaceId, nowMs })`, owns every row's attention sentence and tone (it replaced three
  separate selectors read straight from `SettingsRail`). `useSettingsStatus`
  calls it once per studio and hands the result to the rail and the home, and
  a test mounts the home on the strict `invoke` mock to keep it free of
  commands and loads at render. A dot appears only
  when something needs doing: warning on Providers and models when a connected
  CLI is too old for a model it serves or no provider is connected
  (`selectProviderAttention`, with the reason as the dot's label), info on
  Updates while an app update is ready (`updatesText`), info on Storage with "N GB can go" as
  its label once clean idle folders pass 10 GB (warning when the disk has
  under 10 GB free and at least 1 GB can go, `storageAttention`),
  warning on Storage with "N open" once the current workspace has
  an undismissed finding (`selectSecurityFindingsAttention`; Storage shows the
  worse of its two dots, `appAttention`), and warning on
  Workspace with "N folders not found" once one of its projects reads
  `missing` in `projectGitStatus` (otherwise the row just names the
  workspace). A dot means only "needs you": a tool whose health is bad shows a
  warning or danger dot named by its reason (`toolAttention`), and a connected,
  healthy provider or tool shows none (no green dot for connected). No rail row is red: the destructive actions sit at the
  bottom of their page, Reset (Delete all data) at the end of Backup and
  Disconnect at the end of Folders, and turn red only in their inline
  confirm. Panel sections sit on bands (`Band`, eyebrow outside) with gap between
  them and no `Divider`. The workspace page is the exception: one
  column of eyebrow sections 24px apart. Its title is the workspace name,
  renamed in place. One `Terminal folder` row sits above the projects: the
  computed folder (`workspaceFolder`) with `Change` (the folder dialog) and,
  when overridden, `Use the default` (`setTerminalWorkspaceFolder`). Folders
  group `Starred` ahead of `Other folders` (never in both; one `Folders`
  heading with `Star the ones you use most.` while nothing is starred), 16px
  apart with no divider, each a `SectionHeader` with its count and, for
  Starred, `Agents and pickers list these first.`; Starred is never folded and
  `Show N more` stays under Other folders. Each project is a 32px row on the
  group grid (star, kind, name, description, a base-branch chip only when set
  by hand, a Folder-not-found flag) with Open in editor, Copy path and Remove
  link in a reserved column, dim at rest. The star shows at rest only on
  starred rows (filled, warning tone) and stays visible at rest in
  `text-faint-foreground` on the others, in the same 24px slot (`StarToggle`). Clicking the name
  opens an inline editor card below the row for the rest (description, base
  branch, After merge for repos, folder, scripts, facts, footer actions); the
  card starts at the name column (`grid-cols-subgrid`) so its content sits 12px
  right of the name. `starredProjectsFirst({ projects, inside })` is the one
  order: starred first, then the rest, by `name` in Settings and by `recency`
  in pickers (`groupProjects` calls it). A project picker (the session Add
  folder list, the Sessions folder filter) with a starred project and six or
  more projects shows the same two headings and a small filled star on starred
  rows (`shouldGroupStarred`); a search flattens them. New session defaults sit in a
  two-column grid with each help behind an info mark, followed by the
  `After a pull request merges` segmented control, and disconnecting is a
  ghost row at the bottom that asks in a `ConfirmPopover` beside its button. Onboarding keeps the
  comfortable rows.
- **Master-detail is not the dual-sidebar anti-pattern.** A narrow list rail
  beside a detail panel is fine. "no left panel and right panel at once" is
  about two sidebars on either side of the content, which the app does not do:
  the column and the session rail both sit on the left.
- **Disconnecting is scoped.** A connected integration studio can disconnect
  from its own header. That clears the workspace credential, never a
  system-level session. A workspace running on the system `gh` CLI has nothing
  workspace-scoped to clear, so it offers no disconnect and points to
  `gh auth logout`. The control depends on credential state alone, not on the
  git remote. So a leftover scoped personal API key on a non-GitHub workspace
  can still be cleared.
- **A code-host record keeps its verbs outside a session.** A GitLab merge
  request opened from Tasks approves, merges, closes and reopens through
  the workspace's GitLab host. A Bitbucket pull request shows its verbs too,
  blocked with the reason until Goodboy has resolved it for a session. A GitHub
  pull request opens read only: description, review state, branches and its
  comments, with Start from #318 as the primary (Review pull request when its
  review is requested of you) and Open in GitHub for the rest.
  Merge
  always asks first, and so does every destructive verb. The mount reads
  through the workspace's first repo project, so a workspace with no repo
  project stops at an empty state.
- **Every record header has the same four places.** `RecordHeader` puts the
  tool glyph, the identifier and the state on the identity line, with Open in
  the tool, the `⋯` menu and, in Tasks, close at its end. Under the title
  sits one action row: one primary (Start session, Review pull request, or
  Open session once one is linked) and at most two tool verbs picked by state.
  Before a session is linked, Tasks adds Link to a session under the properties
  (`RecordFrame.link`): a searchable list of the workspace's sessions that links
  the record to the one you pick. Everything else lives in
  `⋯` in a fixed order: rare tool verbs, Refresh, Copy link, Remove link to session,
  then destructive verbs after a separator. Editable properties change from the
  control that shows them (the Jira state opens its transitions). Start has
  one verb and the result follows the record (`startFromRecord`): an issue or
  an error opens the New session draft with the issue picked and its brief
  being written; a pull request waiting on you starts a PR reviewer and lands
  on the Pull request tab; a Slack thread, a merge request, a Bitbucket pull
  request or a pull request of yours opens a popover with the goal and the
  brief. Enter from the Tasks list does the same, or opens the linked session.
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

- **One header grid for every page.** A 40px band (the crumb at the column's left,
  Ask or Close at its right edge), then one 32px title row directly under it with the
  page's only `h1` (`text-title`) and its actions at the right, the optional meta line
  4px under the row, and the tabs on their own row under the meta line. The title's
  centre is 56px under the pane top and its left edge is the column's content edge on
  every page, studio and sub-page, the Board included (it keeps an empty 40px band
  above its title). The row is fixed (`h-8`, centred, never wraps, a long title
  truncates), no glyph ever indents the title, and the crumb names the structure while
  the `h1` names the object. `frameGeometryOf` (`packages/ui`) is that table.
- **A first-lap session says where it works in one notice.** Before main is on the
  remote the Overview notices slot holds one row, `Not published yet` with Publish
  (`LapPublishNotice`; Retry when the remote did not answer, `Checking the remote`
  while it is read). `FirstLapBanner` keeps only the move card, the move in progress
  and the move report, as a `Notice` in the page banner slot (`PaneBannerContext`).
- **Questions is a list, like Artifacts.** One `ListGrid` (`parts/QuestionsGrid`) with two
  groups, **Needs you** then **Answered**, each counted from two; the grouping is
  `questionGroupsOf` in `questionsLensModel` (a question an agent is answering stays under
  Needs you and says so in gray). A row reads the question, the answer in gray, the
  asker's role and the age; a blocking ask is one warning dot in the leading cell. The row
  opens the question in the drawer (`question` drawer kind, `QuestionDrawer`), titled with
  the asker's role and the age (`questionMetaOf`, the same function as the row) while the
  card carries the question itself. The role in that title is a link to the asker
  (`openAsker`, `features/session/openAsker.ts`): an agent you started opens its
  conversation scrolled to the question, a step of a preset run opens that step on
  the run page, a step of an orchestrated run opens the run with the step in the
  pane (drawer `run-step`). A deleted asker keeps its role with no link. A row's
  right click menu is the registry kind `question` (`features/actions/kinds/question.ts`):
  **Open question** and **Open the agent** (the same `openAsker`, hidden for a
  deleted asker); the card answers, skips, dismisses and undoes; answering moves the drawer to the next
  waiting question. Opened from Ask (a question chip, **Answer question N**), the drawer
  carries **Back to Ask**. The shared `EmptyState` shows only when the session has no
  question at all. Inside the asker's own conversation a question card shows only the question
  (and Blocking as a dot and a word).
- **A lens shows one level. A studio is a rail plus a detail.** Inside a lens,
  selecting a card swaps the list for the detail, and the trail or Back is the
  way back. No lens keeps a rail beside its detail. Review is the one
  exception, because its work happens in bulk: the open comment sits in the
  drawer beside the list, and the list stays visible
  and selectable. A studio pairs a rail with
  a detail and has no back link. Completed and discarded groups sit behind
  header toggles that hide themselves at zero. So a session whose runs are all
  done shows an empty state, instead of opening the last completed run.
- **The Overview is one column: goal, notices, Needs you, Next, Activity.**
  The goal reads as prose (`GoalTeaser`, it opens the Context drawer on its
  Goal), with one gray provenance line under it only when it came from chat
  (`From chat: <title>`, one label whether the chat started or fed the
  session, the others behind `+N more`). The notices slot (`OverviewNotices`) holds what a worktree
  asks the user to decide ([mounts.md](mounts.md#worktree-rows-and-the-overview-notices)):
  a closed worktree with Reopen, Restore branch or Remove, a failed action with
  `Retry`, a stopped rebase, foreign commits, a branch drift decision (a mount
  follows a branch renamed or switched in its worktree on the next status read
  and logs it as a `Branch` activity row; only a mismatch it cannot follow is a
  `warning` `Notice` with `Use this branch here`, `Keep both branches` and
  `Not now`) and the first lap Publish. Needs you follows, then Next (up to
  three rows, the first one's verb the only filled button on the page), then
  Activity. Projects, Linked work, Artifacts and Add folder live on the
  session rail's session level. Next and Unassigned notes open with `SectionHeader`
  at level 2, and Needs you opens with the same eyebrow on the quiet notice
  surface (no tone bar). Needs you is the one home of a waiting ask on the page:
  its row reads the question with the run or agent in gray after it, no totals
  or repeat counts, and the Activity row keeps only its `?` marker (no amber
  tint, no Needs you word). The page sits on the 960 column of the other session
  pages (`PAGE_MEASURE.overview`). Activity rows carry
  no cost (it is in the duration tooltip and the spend popover), the model line
  holds the effort (`Sonnet 5.5 · Medium`), the day label has no rule and an
  empty Activity reads `Nothing ran yet`. A Next button carries its label only
  and the menu column leaves when no row has a menu. The Activity header holds
  no spend: the session spend lives once, at the session rail foot.
  `Mark all seen` is a ghost button in the Activity header and shows only
  while an agent is unseen; a waiting question is answered from its Needs you row, never from a
  second `Answer` on the timeline row.
- **The focused issue page says where the issue lives.** The issue is an
  address (`external-task` target, `focusedExternalTask`): a card opens it
  through `openExternalTaskLens`, so the session trail ends in Issue, its lens
  crumb returns to the list and Back does too. The page draws no back button of
  its own. `Unlink from session` sits in the record's `⋯`, asks first and
  leaves an Undo toast; once the unlink lands, the address is replaced by the
  lens list, unless the user already moved on. A `Placed on` property in the Links group shows
  `This session` or the branches; its value (`TaskPlacementMenu`) opens the
  same `Move to` menu as the linked task row, `This session` and one entry per open
  branch of the issue's project (`project · branch`, middle cut), the current
  placement checked. `IntegrationPane` hands both to every tracker through
  `RecordFrameContext` (`sessionVerbs`, `linkFacts`), so the loading and error
  states show the placement too.
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
  Comments is one flow: the list grouped by delivery (Needs you, Working,
  Ready to push, Open, Done and Left open on its host, the last two closed)
  under the run status line, across the page, and the open comment in the drawer beside it
  (kind `conversation`, side tier), the same pattern as a check opening the Debugger. A comment reads one word (Question for you, Fix ready,
  Push failed, Failed, Working, Applied, Replied, Done, Left open, Open), all from `RESOLVE_WORD_LABEL`
  in `commentProjection.ts` (Applied is a fix on the branch whose reply is not sent, Replied is a
  thread delivered and resolved on the host), and `reviewTally` is the one count behind every number of them.
  The action that takes a fix is `Apply fix` in the comment drawer and `Apply N fixes` in the
  selection bar and the drawer; group labels carry their count and no verbs. A fix run is one agent and one transcript for all its comments: answers, retries and
  hints continue that run, only a model the owner picks starts a new one, and a finished turn
  without a result for a comment reads Failed with Retry, never a question. A thread in the address is
  `s/{session}/branch/comments/t/{thread}`. A comment nobody started has `Fix` in its drawer (and `F`), which opens the **Fix comments** drawer
  (kind `fix-comments`, side tier) with that comment checked; a checkbox on hover picks comments (`X` on the focused row,
  Cmd+A for every fixable comment, open or couldn't fix, Esc clears) and the bar `N selected ·
Fix N` opens the same panel, or `Apply N fixes` for comments with a fix ready. With no fix run
  the line under the tabs says `Fix N`; the Overview card and
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
  run status line (**Open transcript** opens the drawer in place and is gone while that run's drawer is open), from `…` →
  Agent transcript on a thread, from the thread crumb menu, from a fix run row
  in Activity, from a notification, the agent-started toast and the palette.
  `fixRunTranscript({ sessionId, agentId, threadId })` builds the move (the
  Branch Comments place with that thread, and the drawer), and
  `canonicalLocation` rewrites every older address to it: an `agentPlace` for a
  resolver, and the former Fix run address (`lens: 'review'` with the resolver
  and a `thread` target, `.../review/t/{thread}/agent`), on a move and on a
  restore from history, which reopens the drawer. The thread is the one the
  address named, or the first thread of the attempt. The drawer takes the
  saved drawer width, like Ask, and holds two tabs under its title, a
  `SegmentedTabs`: Fix and
  Transcript (`FixRunTranscriptDrawer` in `app/components`, which hands
  `AgentTranscriptDrawer` a `lead`; a drawer without a `lead` has no tabs).
  The transcript pane shows only the steps of each turn while the agent's
  conversation is the page beside it, and the whole record otherwise (a fix
  run, an agent opened from another page), so it never repeats the page.
  Fix is the fix run summary at full height with its own scroll
  (`FixRunSummary`: one status line that says each shared fact once, `Working ·
2m 48s · Opus 5.5 · High` while it works and `Done · 8m · 8 fix ready · Opus 5.5
· High` once it ended, and a question the run waits on; the comments the run
  covers, each a row with author, file and line and the first sentence, a link
  that keeps the drawer open on that comment, and the comments fixed together,
  opened filtered in Comments. A state chip sits on a row only while the
  comments differ, in one aligned column; when every row shares one state it is
  in the status line and not on the rows. After it ends, What it did, the run's
  final summary, never shown while it works, and its commits as `sha message`
  rows (no label in front), with a note when a later rewrite folded one, nothing
  while the run works with none, `No commits yet` once it ended without any,
  decided by `fixRunCommitsViewOf` and never an unresolved placeholder. Covers is
  the one filled section; What it did and Commits are quiet labels, not equal
  sections. The count of comments in the drawer and in the run banner comes from
  `fixRunThreadIdsOf`, one agent per launch). Transcript is the transcript as one stream and the
  field to write to that agent; the field is never shown on Fix. The first
  message, the raw brief, is one closed card (`BriefCard`, label from
  `FIX_RUN_COPY.briefCard`, `4 comments from #318`) that opens on click. Only the
  shown tab is mounted. The tab follows the run until the user picks one
  (`useDrawerTabs`): Transcript while the run works, Fix once `fixRunStatusOf`
  says ended or while a resolver question row waits (`fixRunAskingOf`, the
  same rows the summary lists). A pick holds for that drawer instance through
  every later state change; a new drawer starts unpicked. A dot sits on the tab
  that is not shown: on Transcript when its event count grew since it was last
  shown (`New activity`), on Fix, in the warning tone, when the count of waiting questions grew since Fix
  was last shown (`Question waiting`). Arrow keys move between the tabs, the
  `SegmentedTabs` behavior; no global shortcut exists. The scenes
  `resolve-transcript-drawer-multi` and `resolve-transcript-drawer-multi-done`
  show one run over four comments, working and finished. The question card also
  stays in its thread. Accepting, replying, editing and Push live in Comments,
  never in the drawer. In Activity a fix run is one row, `Fix run · #318 · 9
comments`; the Needs you row for the pull request calls `openReview` with the
  destination `{ kind: 'threads', mountId, threadIds: [first comment that waits
on you] }`. Any other agent keeps its page, one conversation with no tabs
  (`AgentDetailPane`): every door lands on it, and the `pane` an address may
  still carry (`agentPlace({ sessionId, agentId, pane })`, kept in the place as
  the target `{ kind: 'agent', pane }` and in `agentPane`) changes nothing on
  the page. The full record opens beside it in the `transcript` drawer, from
  **View transcript**, from "Open in transcript" under a turn's summary line,
  and from a delegation line's **See more** for a child agent. The `threads` destination needs no
  mount and no pull request: Review focuses the first thread of the set it
  has, and the set stays in `reviewSelections[sessionId]`. The destination
  `{ kind: 'notes', threadIds }`, like a `threads` set made only of notes,
  lands on the first note (`noteLandingPlace`): the Files section at its card,
  scrolled to it, when the branch has no pull request, and its thread in
  Comments when it has one. No drawer opens. Back, or Up when
  Review is the entry below, returns to Review with that comment focused, and
  Up from a page reached any other way opens Review on that comment. There are
  no return pills: the Diff and a fix run transcript come back through Back.
- **The switcher and the palette list only destinations the session can
  use.** One function feeds both. Context is a drawer, not a destination: the
  palette offers **Show context** (⌘⌥C) and neither lists a Context page.
  Explore is always listed, opens as a pane (see The session tools), and
  browses one project of the session at a time as a tree (`role="tree"`). It
  draws the shared page header (`PaneShell` `page="explore"` inside the
  drawer's `DrawerFrame isHeaderless`, which keeps Esc and focus): the title
  with no glyph, counts on the meta line (`exploreMetaOf`: `3 folders · 4 files`
  for the root, `7 files changed` in the Changed view, nothing while the root
  loads or is empty), then Refresh and Close at the right of the title row. A
  project chip on the row under the meta (`ExploreProjectChip`) names the
  folder, `ledger-core · hl/ledger-rounding`, and with two or more mounts opens
  a menu grouped by
  project; a first-lap session reads `ledger-core, project folder` and a
  session without a project reads `Session scratch folder`. Picking a row is
  view only: it sets `exploreMountPath` in the session-view slice and never
  calls `switchBranchMount` or `setSessionActiveMount`, and an agent run never
  moves it. Until you pick, Explore follows the write destination
  (`selectExploreMount` in `features/explore`, built on
  `resolveWriteDestination`). A pick whose worktree lost its files reads
  "This worktree is gone", and a session with nothing to browse reads "No
  folder to browse" with one action, Add folder (`DrawerHost` hands it
  in as `noFolderAction`, so `features/explore` does not import the session
  feature). Every empty state is an
  `EmptyState` at page size: a title, one line that says what fills it and at
  most one action ("This folder is empty", "No changes against main", "Couldn't
  read this session folder" with Retry). The `mount.browseFiles` action (Browse files) opens the
  Explore pane on a given mount (`openExplorePane`). An `explore` target in a
  stored place (`s/{session}/explore/{mount}`) still parses and lands on the
  Overview with the pane open. Rows are 40px
  high with no gap (`EXPLORE_ROW_PX`): a type glyph, the name with its
  extension kept, a slot for change marks, the size and the age. The size
  hides under a 520px column and the age under 440px.
  A 16px slot before the size carries the change marks. Changed means what the
  Files tab means: against the base branch, with uncommitted and untracked
  work (`worktree_changed_files`, whose `entries` give each path a status:
  added, modified, deleted or renamed, untracked files count as added). A
  changed file shows the diff's letter (`M`, `A`, `R`; `D` in the Changed
  filter) in the diff's tone, named for assistive tech by the word
  ("Modified"); names are never tinted. A closed folder holding changes shows a
  6px dot, filled with `text-muted-foreground` and a 1px ring so it is never
  mistaken for the diff tree's warning dot (changed since viewed), with the
  tooltip "3 changed files"; an open folder shows none. The mark comes from
  `useExploreChanges`, which shares one request per mount and revision with
  `useMountDiffStats` (same 30s tick, turn finished and focus signals, no second
  timer). The header's `All files | Changed 7` tabs show only for a mount whose
  git answers and that has changes (or while you are in Changed). Changed
  filters the same tree to the changed paths and their folders, all open, with
  deleted files as faint struck rows that do not open; with nothing left it
  says "No changes against main". A changed file's drawer offers
  `Preview | Changes` in its toolbar: Changes is the file's diff in the peek
  presentation with a ghost Open in Files that opens the Files tab on the file. The folders you opened
  are kept per session and project in the session-view slice (`exploreExpanded`,
  keyed by session, mount path and folder) and open again when you come back,
  and a file opened from elsewhere opens the folders above it. The file drawer
  key holds the project (`explore-file:{mount}:{path}`), so the same relative
  path in a second project replaces the drawer instead of closing it. The tree has one tab stop; Up and Down move, Right
  opens a folder or enters it, Left closes it or goes to its parent, Home and
  End jump, Enter and Space open the preview of a file or toggle a folder. Above
  120 rows it draws only the rows near the scroll position (`shared/utils/windowRows.ts`, the
  diff tree's math). A row's verbs come from the `exploreFile` kind, in the
  row's `⋯` visible at rest (`ExploreFileMenu`) and its right click menu: Ask
  an agent (files), Open in editor or Open, Show in Finder and Copy path. A folder
  offers Open only when an editor can take it (a repository with an editor),
  and a linked folder is listed as a folder; the Rust containment check on
  read and open stays. A file opens in a reader drawer whose header reads like
  the diff drawer's: the type glyph, the file name, the one labelled open
  button (`openActionOf`), then 28px ghost buttons for Copy path, Wrap lines
  (code only, `aria-pressed`) and Close. A second row of `Preview | Source`
  tabs shows only for Markdown and SVG, which open as Preview. The open
  failure line and its Choose editor link sit under the header. The body starts
  with the relative path in `text-code`, the folders cut first so the file name
  stays whole, then the size and age faint; there is no divider and no button
  in the body. Code and Source render in `SourceView`: a `bg-muted` well that
  scrolls both ways, a gutter of line numbers drawn by a CSS counter so a copy
  never holds them, and colours from the shared highlighter. Wrap is off for
  code and on for prose, and the code choice is kept in
  `goodboy:explore-wrap:v1`. Past 5,000 lines or a line over 1,000 characters
  the text stays plain and one line says so. A file that is not an image or a
  PDF and is not text says "This file is binary. Open it in the app that owns it."
  Diff and the other branch lenses need a
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
- **The Agent page always has its header.** Every agent page (the planner,
  Scribe, a missing or loading agent) renders one header row: role chip, title,
  provider mark, View transcript, overflow. The composer model chip always names
  the model the next turn will use, with its provider mark, never a bare
  `Model` word. Each turn footer shows the model chip, the duration and the
  cost; tokens, cache share and context window sit in its detail popover. The
  live tail phrase is present tense in sentence case (`Collecting the output`).
  The transcript pane's usage footer drops the turn count when the agent has no
  turn of its own to count, instead of reading `0 turns`.
- **An Artifacts row is the button, with one verb at most.** A row keeps a
  visible verb only where it is its own: the state-driven primary (`Run plan`,
  `Approve`) on a Needs you row, `Stop` on a running generation, `Restore` in
  Recently deleted; the column leaves when no row has one. Every other verb
  (Edit, Open in browser, Copy source, Delete, Delete permanently) lives on
  right click and in the opened artifact. No kind column (the glyph says it);
  the state cell shows only what the group does not say, as one glyph and word
  with the progress (`part 2 of 4`) in its tooltip. An artifact page header
  draws no state chip: the state leads the gray meta line. A report shows its
  title only in the document, the header keeps a hidden `h1`.

## Home

Home is the one page of a window with no workspace open: workspaces exist and
none is open here, or there is no workspace at all. `App.tsx` renders it
whenever `currentWorkspace` is null, in every window. It has no app chrome, so
it carries the lockup itself: the 40px `BrandTile`, the word and the version
([brand.md](brand.md)). Under it:

- **Workspaces.** One row per workspace, most recent first (`WorkspaceRow`):
  the identity tile, the name, the folder count (`folderCountLabel`, "3
  folders") and the folders' common parent (`workspaceFolderPath`, the home
  folder as `~`); a workspace of one plain folder says its face instead of
  "1 folder" ("Documents", "Code, no git yet": `workspaceFaceLabel`, which
  falls back to `folderCountLabel`), Open in a new window, Disconnect behind an
  inline confirm, and
  when it was last opened. A click opens it here, or in a new window while
  agents run here. The search field shows from five workspaces on.
- **New workspace** (⌘N on Home, `home.newWorkspace`) fires
  `goodboy:add-workspace` through `openNewWorkspace`, like the switcher, the
  palette, the Goodboy menu and the menu bar. On Home the `addWorkspace` place
  swaps the list for `NewWorkspaceForm` in place, the lockup stays put, Cancel
  or Escape goes back, and Create opens the new workspace and lands in it,
  whatever the folders are: a plain Code folder was already offered git on its
  pick row.
- **No workspace yet.** A card that says how a workspace starts, with New
  workspace and, while setup is unfinished in the main window, "Setup paused at
  Workspace · 1 of 4 done" and **Resume setup** (`useSetupResume`, counted by
  `setupProgress`).
- **Reopen the last workspace on launch**, a switch.

Setup mounts over Home and opens in the main window only. The app layers keep
one key across Home and the shell, so the setup wizard is not remounted when
the first workspace opens under it.

## Starting a project from nothing

Every door that creates or adds folders opens one inline form,
`NewWorkspaceForm` (`shared/components/NewWorkspaceForm/`), never a dialog. It
runs in three modes: `first-run` (the setup Workspace step, title "Your first
workspace"), `new` (the New workspace studio and Home) and
`add` (the empty board and Settings, Workspace, folders, which add folders to
the workspace they name by id). The form owns its action row.

- **Pick or drop a folder.** Choose folder (Cmd+O) or a drop on the drop area
  only reads: `validate_git_repo`, `scan_child_repos` and the move preview fill
  a draft in memory (`useWorkspaceDraft`). Each read carries a pick number and a
  late answer for an older pick is dropped. A repository shows Git and its
  default branch; a subfolder of one snaps to its root and says so; a folder of
  repositories lists them checked; a plain folder offers git init on Create; a
  folder that cannot be read says why (macOS privacy opens Privacy settings
  through `open_privacy_settings`) and keeps Create off with the reason.
- **Name.** The workspace takes the picked folder's name through
  `nameFromFolder` and is edited in place; Escape while editing restores it.
- **A folder another workspace holds** asks Move it here or Leave it out; Create
  stays off until one is chosen, and Move is off while agents run there. The
  move happens on Create, never on the click.
- **Start from scratch** (the old Start a new project) asks a folder name and a
  location (the last parent folder, else the home folder, changed with the
  system picker). Create makes the folder, a repository on `main` with a first
  commit that holds `.gitignore` and nothing else, and the workspace named
  after it. Outside setup it then opens the first lap session; in setup it goes
  on to the next step.
- **Create** calls `createWorkspaceWithFolders` once, with a workspace id the
  draft made before the write; Retry reuses it. Nothing is written before
  Create. The New workspace studio never reopens setup.

The first lap session shows one notice under the goal of its Overview,
`Not published yet`, with **Publish**. Publish
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

Every start of work from a task says **Start from** and the identifier
(`startFromLabel`): **Start from HBL-412** in Tasks and in the draft,
**Start from #318** in the one-step panel, **Start work from chat** in Chat.
**Review pull request** is the one exception, because the review is the work.
The retired phrases are in `retiredNames.ts`.

## The right drawer

Every drawer is one primitive, `DrawerColumn` from `@goodboy/ui`, never a
split nested inside a pane. `AppShell` puts one beside the page container, and
a studio body puts one beside its list.

**Two containers, never a panel inside the content.** The page container is the
sheet (its `bg-background`, its 1px `frame-edge` border, `data-container="page"`)
and the drawer container is its sibling (`data-container="drawer"`), each with
its own size, drawn from the same top to the same bottom. With no drawer the
page container is today's sheet: rounded on the left where the chrome wraps it,
flush with the window's right edge. While a drawer pushes, the page container
rounds all four corners (`rounded-frame`), the drawer container stands 8px to
its right (the resize handle sits in that gap) and 8px from the window's right
edge, with the same edge and radius, and the pair keeps an 8px inset above the
window's bottom edge. The drawer container is one step quieter than the page
(`bg-drawer`, recessed between chrome and background in both themes): it reads
as secondary, never louder, never tinted, and never a border to fake the
difference. `AppShell` hosts it through `DrawerColumn`'s `frame="sheet"`. The
Tasks and Chat studios do the same inside the studio slot: their body registers
its drawer with the `StudioFrame` (`useStudioDrawer`), the frame draws one
`DrawerColumn` with `frame="sheet"` around the band and the body, so the band and
the list are the page container and the drawer container stands beside them from
the slot's top to its bottom; the slot's own sheet steps aside
(`data-studio-sheet-owner`). A studio body with no hosting frame (a studio that
covers the left column) keeps `frame="none"`, which draws only the drawer
container as a card inset 8px on its right, top and bottom.

**Two tiers, one width each.** A side drawer (Ask, Context, a fix run or agent
transcript, script output, a plan part, an artifact) opens at 400px, resizes
from 384 to 560px and keeps `goodboy:right-drawer-width:v1`. A reader drawer
(the plan, report and wireframe document, an Explore file, a file diff) opens at
720px, resizes from 480 to `min(1000, room)` while it pushes and to
`min(1000, page - 16)` over the page, and keeps its own
`goodboy:reader-drawer-width:v1`. Both are clamped on read and written once when a
drag ends; a double click on the handle resets to the tier default (400 or 720);
the two saved widths never bleed. There is no third tier: no drawer expands over
the whole column, the reader tier is the large one. `selectDrawerSizing` picks
the tier from the drawer kind. The pure rule lives in `drawerLayoutOf` (`drawerGeometry.ts`).

**One push rule.** `room = main - 16 - 48 - 560`: the pane (the `DrawerColumn`'s
own width) minus the drawer's two 8px insets, the page's gutters and the 560px
the page keeps. The drawer pushes only while the page container keeps 560 plus
its 48px of gutters and `room` covers the drawer's saved width; it is never
squeezed. Otherwise it lies over the page at `min(saved, main - 16)`. The mode reads the committed width, never a drag in progress,
and while it pushes the handle stops at `min(tier max, room)`, so a drag never
flips the mode. Once a drawer pushes at some width it pushes at every wider one.
The column and measure pages are centred, and the column slides left to
re-centre in the space left of the drawer (full tier work surfaces keep their
left edge and give up their right).

**The thresholds are fixed.** The default side drawer (400) pushes from a 1024
column and the default reader (720) from a 1344 column; below that they lie over
the page. `drawerGeometry.test.ts` pins both numbers and
`regressions/drawer-rule.test.ts` fails a drawer that measures the window, reads
a breakpoint or calls `drawerLayoutOf` outside `DrawerColumn`, so every
width-dependent drawer (fix run, CI fix, terminal, the rest of `DrawerHost`)
goes through `DrawerColumn`. A drawer that must never push, such as the New
drawer, passes `placement="overlay"` (`drawerPlacement` on `AppShell`): it lies
over the page at its saved width at every column width. `selectDrawerPlacement`
(`store/slices/drawer/`) returns `overlay` for the New drawer and `auto` for every
other kind; the New drawer uses the `reader` tier, so it keeps the reader's saved width. Crossing the threshold
with a drawer open swaps the mode in place and keeps focus in the drawer; if
focus was on the page it moves into the drawer, never to the body.

**Over the page, the drawer container runs the full height of the sheet.** It
has no inset: flush with the sheet's top, bottom and right edges, left corners
rounded (`rounded-l-frame`), a left border only, `shadow-xl`, the same
`bg-drawer`; the page container goes back to its resting sheet shape under it. A scrim
(`bg-scrim`, 120ms fade, none under reduced motion) covers the page below the
card, and the page is `inert`, so nothing under it takes a click, a Tab or a
screen reader. A click on the scrim asks the top layer of the escape stack
(`dismissTopEscapeLayer` in `packages/ui/src/escape.ts`), so an editor or an
unsent draft inside the drawer answers first, exactly as it does to Esc.
Pushing has no scrim and nothing is inert. Closed, the
aside is 0px wide and `inert`. Opening and closing ease the track's width in
220ms (`FOLD_MS`, none under reduced motion) with its right edge fixed, and the
centred column slides with it: the card grows leftward from the window edge,
its content held at its final width on that edge so nothing reflows, and the
content fades in once there is room; over the page it slides in 200ms; a new kind in
an open drawer fades its content in 120ms. It never writes the sidebar
preference: a pane folds nothing but the session rail, and only a reader tier
pane does that (`shellFoldsOf`, see Surfaces).

**Closing never moves the page behind a drawer.** `DrawerColumn` remembers the
last mode the drawer was open in (`useDrawerExit`). Closed from pushing, the
aside stays in the flow, its width eases to 0 in 220ms and the card keeps a
frozen copy of its content that fades in 120ms (`drawer-content-out`); with
nothing laid out or under reduced motion it closes at once. Closed from
over the page, the aside stays out of the flow with no width transition, so the
page keeps its width at every frame, and the card and scrim stay mounted for
`DRAWER_EXIT_MS` (160ms) while they fade and slide 8px right (`drawer-overlay-out`;
only the fade, `drawer-fade-out`, under reduced motion). The exit card is a
frozen copy of the DOM the drawer had, so its escape layers, focus and handlers
are gone the moment it closes (a drawer that holds a `canvas`, `iframe`, `video`, `audio` or `webview`, or more than `DRAWER_EXIT_MAX_ELEMENTS` (2000) elements, is not copied and closes at once with no exit; the copy is taken during the render that closes the drawer, before React commits it, because a host that reads the same store, such as `DrawerHost`, empties itself in that same commit): the aside, the card and the scrim are `inert` or
`pointer-events-none`, the page is not `inert`, and a click on the page behind
works at once. Reopening during the exit cancels it and shows the drawer as it
stands, without playing the entry again.

**A drawer's up is its back row, never a trail.** A drawer is page state, not
an address, so it draws no breadcrumb. A drawer opened from another drawer shows
one quiet back row under its header (`DrawerBackLink` from `@goodboy/ui`, the row
`DrawerFrame`'s `back` draws), naming where it returns: **Back to agents**,
**Back to files**, **Back to scripts**. The run step drawer has no `DrawerFrame`
and draws the same `DrawerBackLink` above its transcript; **Back to agents**
reopens the Agents drawer on the run it came from.

One drawer at a time, per window. The `drawer` store slice holds
`{ kind, sessionId, payload }`: `openDrawer`, `closeDrawer` and `toggleDrawer`
(pressing the trigger again closes it). **The open drawer is part of the
history entry's focus.** A forward move (crumb, sidebar, palette, a child such
as an agent) arrives with it closed; Back and Forward bring it back as it was;
Escape and its X close it in place. The one exception is the `ask` drawer: a
forward move that stays in its session keeps it open (`keepAskDrawer` in
`navigate`), so a chip in an answer changes the page beside it; leaving the
session closes it, and Back brings it back like any drawer. Another drawer
opened from the page replaces it. `app/components/DrawerHost` turns a `kind` into its content, framed
by `DrawerFrame` from `@goodboy/ui`: a header whose 28px row is centred on the band (icon, title, count, at most
one labelled action, close), one divider, a `ScrollFade` body and an optional
`dock`. A body that scrolls itself, such as a chat, passes `scroll="self"` and
fills the frame instead. A new kind adds a variant to `DrawerContent` and a
case to the host.

**Header grammar.** The close control always reads `Close`, in every drawer: the
region is already named by its title (`<section aria-label={title}>`), so no
drawer repeats its own name in the label. The one exception is the Context
drawer in its versions view, whose control reads `Back to current` and goes
back to the current view instead of closing. The Close button is a 28px target
(`size-7`) with the 14px glyph, and so is every utility in the header (copy,
open on its page); a header holds at most one labelled button (Stop,
Run again, Open in Files, New) and utilities share one icon tone. The count slot
is for a count or a version, never for the session title: Ask's header reads
`Ask`.

**One dock, one padding.** The `dock` slot is `px-4 py-3` and holds the one
control that belongs under the body: the Ask composer, the reply field of an
agent transcript, the script run's status line. No drawer pads its own
composer; `TranscriptReplyDock` only measures it for the toast lift.

**Focus and Esc.** A drawer's first control takes focus when it opens, pushing
or over the page: the composer when the dock holds a text field (Ask and a
transcript that can be written to), the drawer panel itself (`DrawerFrame`
section, `tabIndex` -1, no ring) otherwise, never the `Close` button, whose
tooltip and ring would cover the top bar and the first action, and whatever
the body focused itself first (an editor, the composer's own focus) is left
alone. Closing hands focus back to the control that opened it; when a shortcut
opened the drawer from the page body (`⌘L`, `F`), the target is the last real
control that had focus (`lastFocusedElement` in `packages/ui`, updated on
`focusin`, never the body). Esc answers in two steps: while a text field in the
drawer is focused and not empty, the first Esc only blurs it, the draft stays;
the second Esc (or the first, with an empty field or no field focused) closes.
A click on the scrim asks the same top layer of the escape stack
(`dismissTopEscapeLayer`) and keeps focus where it was while pressed, so it
follows the same two steps. There is one Esc listener, the stack; a drawer
never adds a second one.

**The Ask draft survives.** `askDrafts` in the `ask` slice holds the text of the
composer per thread (`threadId`, or `${sessionId}:new` for a thread that does
not exist yet), in memory only: closing the drawer with Esc, the scrim or `⌘L`
and opening it again finds the draft, a send that lands clears it, and a send
that fails puts it back.

**A toast never covers a drawer.** The stack is 360px wide with its dismiss
button pinned to the card's top right corner (a 28px target that does not move
with the width of the action) and the action on its own row. Beside a pushing
drawer the stack's right edge is the drawer card's left edge minus the 12px
gutter (`toastRightOf({ mode, drawerWidth })`, measured from
`[data-drawer-card]` while a toast is on screen); over an overlay drawer it
stays at the right edge and above the scrim. It still lifts above the Ask
composer and the transcript reply field (`useToastLift`).

**Floating surfaces are one surface.** Menus, popovers, the hover card, the
session switcher, the update card and the delete confirm are all
`FLOATING_SURFACE` from `@goodboy/ui` (rounded-lg, border, `bg-floating`,
`shadow-lg`), with no per-site border, fill or shadow. Their widths come from
one scale: menus 240 (never under 200), popovers 320 and 384, toast 360, hover
card 320, session switcher 420. `regressions/popover-widths.test.ts` counts the
off-scale widths a floating surface declares per file and never lets one
grow.

**The update card is never clipped.** It is a `Popover` in the popover layer, anchored above the Goodboy row with 12px to the window edge, 300px wide and never wider than `min(384px, window - 24px)`: a title, one line and the verbs of its state ([release.md](release.md#auto-update)), no bullets. It stays away while its row is inert, as when Settings covers the column (`useIsAnchorInert`), and comes back with the row. A `fixed` card inside the sidebar would resolve against the sidebar, which has a transform and `overflow-hidden`.

**An object that belongs to where you are opens in a drawer; the page changes
only by an explicit command.** A plan read from the planner that wrote it (the
row in its chat, in its Brief, or a plan row in Activity) stays on the agent
page: the address does not change, the page keeps its scroll, and the drawer
sits beside it. The same goes for every artifact kind read from its work: a
report or a wireframe row in Activity, and a report or wireframe chip in a
transcript, open the same `artifact-document` drawer (`DrawerHost` hands a
report or a wireframe to `ArtifactReadingDrawer`, which shows the report or
the wireframe stage, with Open in Artifacts as its one header action). **A plan always opens
in the drawer** (`openPlanDrawer`): the object menu's **Open**, the plan view
inside Ask, a plan row in the palette, a plan hit in search and the plan chip in
a chat open it over the page you are on, unless you are already on the
Artifacts page, where they select the plan. From another session they land on
that session with the drawer open (`openPlanAnywhere`). Reports and wireframes
are transit from the palette and from search and keep navigating; the Artifacts
page stays the library. Going to
the Artifacts page from a drawer is a command of its own, **Open in Artifacts**
in the drawer header, and it is the only page change. The `artifact-document` kind
carries `{ artifactId, revision }`; `revision` is `null` for the current
version and a number for an earlier one read from the revisions. It is the one
drawer in the reader tier: it opens at 720px and you drag its edge from 480
to 1000 (a double click resets it to 720), so there is no Expand. The body
stays on the 720 reading measure whatever the width. The header holds the
title, **Open in Artifacts** and **Copy markdown** as two 28px icon buttons,
and Close; the second row holds the state chip, `vN`, the parts, **Edit** and
**Run plan**. **Copy markdown** is absent when the plan has no copy action.
Escape closes it. While the planner
revises the plan the body is dimmed and Run plan waits.

The `ask` kind carries no payload: the thread on screen lives in the `ask`
slice (`askThreadId` per session, `null` for a fresh thread). `AskDrawer`
(`features/session/ask/components/AskDrawer/`) puts the thread in the frame's
`ScrollFade` and the composer in its `dock`. Its header is **Ask** and a **Reset chat**
icon button (⌘N while focus is inside the panel, also in ⌘K), with no session
title. Reset starts a clean thread (`newAskThread`, `askThreadId` back to `null`,
the next question makes a new chat id) and the old thread stays under **Earlier**,
so nothing is lost and no Undo is needed. It waits while a reply streams. The body starts with
**Right now** (no model call: `askRightNow` over `askDigestOf`, the five
comment words, running agents, open questions and the session cost) and three
suggested questions; each line's mark is a `LineMark` (one text line tall), so
it centres on the first line of text even when the line wraps; once a thread has
turns it folds to one row. Then
**Earlier** threads on a fresh thread, then the turns. An answer chip that
targets a page navigates (the drawer stays, see above), except a question: it
opens the Questions page and the question in the drawer under **Back to Ask**
(`question` drawer, `from: 'ask'`); a chip that targets a
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
versions of that slot, inside the same drawer, with Restore; Escape and the
header's **Back to current** leave the view before the drawer). The **Context** chip in the session header toggles it
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
links to the tabs, every value on the same column), **Change model** (Settings, Providers and models, Models, scrolled to
Step summaries) and **Update now**. Update now queues a consolidation pass
through `requestContextUpdate`, behind any pass in flight and never beside it;
`summarizerPending` holds the turns waiting and whether a requested update is
queued, and the row reads only that queue state, as the pane's first gray line
(no label). The pane is one scroll with Goal, Decisions, Summary and Learned as
sections (`ContextSection`, no tabs); opening it on a section scrolls there. The
count lives on the Active group and the change signal on its own group. The engine has one name, **Context**, in Activity, in the
drawer and in these docs.

Every section reads as labelled blocks (`ContextBlock`: a flat group with an
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
the row and highlights it. The label never wraps: when label, count and action do not fit
the drawer width, **Mark as read** drops to its own right-aligned line (`ContextBlock`). **Mark as read** in its header fades the block, moves
the marker to the moment of the click (`markContextRead`, saved before the state changes) and clears the
tab dot; a later change brings the block back. Then **Active**, with its count: active decisions
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
withdrawal reason, at most six lines, and **Open in Context**. Each decision is
a three-column grid (sign, id, text): the text wraps whole beside the hanging
id, and the reason or note sits on its own line under it, never truncated.
**Open in Context** opens the
drawer on Decisions with those numbers in `payload.highlight` (highlighted for
2.4s, the closed group opened when one of them is there). The expanded row
adds the diff's height to its item before `layoutTimelineRail`, so the rail and
lanes run through it. `DecisionChangesDetail` measures itself (a layout effect
and a `ResizeObserver`) and reports `{ rowId, height }` to `useTimelineRows`,
which keeps it per row id and uses it over `decisionChangeDetail`'s line
estimate, which stays as the first-frame value. `Reveal`'s grid element is
`min-w-0`, so no body, of any list, widens its column.

The `artifact` kind carries `{ artifactId, tab }`, with `tab` either `details`
or `chat`. The artifact shell opens it from its one `Details` button, on the
tab last used; the drawer header switches between the two. It also closes when the focused
artifact changes. While it is open, Escape closes the drawer before it takes the
artifact back to the list.

A studio covers the whole window grid, so it cannot use that column. A Tasks
record opens in the studio's `DrawerColumn` beside the list on the reader tier
(`InboxStudioLayout` passes `sizing: 'reader'` through `useStudioDrawer`), with
the same card and motion; a window too narrow for the list and the pane lifts
the pane over the list. Open full in the pane header puts the record at the 720
measure in place of the list (`TaskFullPage`), which claims the studio band with the trail
Tasks › its key (`StudioTrail`); the Tasks crumb returns to the list.
Escape closes the record before the studio.

`conversation` (payload `{ threadId }`) is the open comment on the Comments tab, side tier.
It rides the drawer slot of the location next to the address
`s/{session}/branch/comments/t/{thread}` (`placeWithThread` keeps both, `openReviewComment`
writes both), so Back, a refresh of the list and a window reload find the same comment open.
`DrawerHost` renders only a slot for it (`ReviewCommentDrawerHost`); `ReviewFlow` portals the
`DrawerFrame` into that slot, so the drawer shares the page's diff, filters, verb controller and
keys. Its title is the file and line, its meta the author, age and state word, `N of M` its
position in the shown list; a later answer for a comment it already left is dropped because the
content is keyed by thread.

`scriptRun` (payload `{ scriptKey, mountId }`) shows one script run's output.
`ScriptRunDrawer` reads the run from `scriptRuns`, where the one
output subscription per run lives, so closing the drawer loses nothing. The
header action is Stop while it runs and Run again after (when it cannot run, a
tooltip says why, never a native title); the body is a status
line (state, time, project, branch), a `Command` disclosure closed by default,
and the log, which follows the tail until you scroll up and then offers
`Jump to latest`. Error lines carry a danger bar and an `err` prefix, and a long token (a path, a
hash) wraps at the edge instead of breaking every word. The dock
says `Following output` while it runs and the exit, time and Copy output after.
A run records the mount it ran in, so a project mounted twice reopens on the
right branch.

`file-diff` (payload `{ source, path }`) peeks at a diff without leaving the
page. The source is a worktree (a file opened from the chat) or a commit (a
GitHub commit link clicked anywhere in a session; outside a session the link
opens in the browser). It shows unified and wrapped, and a worktree peek offers
`Open in Files`, which opens the Files tab of the Branch page on that mount with the file in focus.
There is no drawer for notes: a note lives on its line in Files and as a row in
Comments, and `Fix comments` (kind `fix-comments`) is the one fix action. A note
without a branch sits in `Unassigned notes` on the Session overview.

## The Branch page

One page per branch (`features/branch`) replaces the PR, Review and Diff
pages. Every diff in the app is still one `DiffView` (`features/diff`): the
Files tab, Write review, the Bitbucket pull request changes and the
`file-diff` drawer. Each one lists its files through `orderLikeTree`
(`features/diff/lib/changeTree.ts`), so the order is the tree's everywhere. The
Rust side runs git with `core.quotepath=false` and `parseUnifiedDiff` reads
quoted headers, so a name with accents is its own file.

**Frame.** The Branch page is the center of the Projects tree (Session
rail): one detail with no rail of its own. Its sections are the pages under
the current branch row of the tree (`SessionLevel/WorktreeEntries`); the page
publishes its counts once (`worktreeEntryFactsBus`, read by the folded rail)
and the tree computes the same facts for its rows (`worktreeEntryFactsOf`). A host
with no session rail (a scene, a test) shows the page alone. The
header, the banners and every section body sit on the 960px column of the
detail; nothing moves from one section to the next.

**Header.** One row: the title, the one h1 (the pull request's title, or the branch name
without a pull request; on a pull request you can edit, click it or press `E` on
the Pull request entry and it becomes an input in the same 32px row, `Enter` saves
to the host, `Esc` cancels, a failure is an inline notice with Retry), one primary and `⋯`. No
state chip and no meta line: the state, the number, the author, the base and the readiness are
the Pull request property block, the commit count is the Commits entry, and a blocked primary
says its reason in its tooltip. **There is no branch switcher in the header or
the rail**: the branches of the session are the rows of the Projects tree
(`SessionLevel/ProjectTree`), and choosing one makes it the active mount and
replaces the address with the landing tab of that branch (`switchBranchMount`,
also what the trail menu and the sidebar rows run), so the crumb, the header
and the body follow together and nothing of the branch it leaves carries over.
A new branch is the `+` on its folder row (`project.newBranch`), which opens
the new branch form (`forkMount` lands on the new worktree on its landing tab);
a folder project cannot fork and shows none.

The header holds at most one secondary and one primary (`branchActionsOf`). The secondary is
the first push that applies: `Push N fixes` (every accepted thread, then unpushed commits), `Publish N
replies` (the fix is already on origin), `Retry N`; a merged or closed request has none. The
primary follows the state: `Mark ready for review` on a draft, `Merge` on an open or approved
request, `Reopen` on a closed one (where the host allows it), none on a merged or queued one and none
without a pull request, where the create form owns `Create pull request`. A stopped rebase
shows `Continue rebase` as the primary, with `Abort rebase` in `⋯`, in the rebase banner and on
the worktree status line; `Rebase` lives on the worktree status line only, never in the header
or a property. `Merge` is a filled primary only when the pull request is
ready; while comments need you or a fix run is live it turns secondary, never disabled,
and while a check fails, a review is missing or the branch conflicts it is disabled. The
label names its blocker (`Merge · 2 failing`, `Merge · needs review`, `Merge · 4 unresolved`,
`readiness.labelBlocker`) and the Readiness property says it once (`Blocked by lint`).
One rule decides all three (`evaluatePrMergeReadiness`, `features/review`): its
blockers are a merged, closed, queued or draft pull request, conflicts, checks
unknown, failing or running, changes requested, a review required and a write
already running; its caveats are comments that need you and a live fix run. The
companion's `mergePr` asks the same function and refuses on a caveat too. Its
confirm is an inline panel with a method picker (`ActionConfirm.choice`,
`ChoiceCards`): `Squash and merge` (`One commit on main`), `Merge commit` and
`Rebase and merge`, the default squash when the repository allows it, and a
method the repository forbids shown disabled with its reason
(`Turned off in payments-api`). Merging raises one plain `info` toast with no
Follow. Push, Publish and Retry go through the existing publish
machinery: a frozen preview in line under the header (`PushBanner`, the only
push one), drift and the result per thread. Under it sits the rebase job banner
(`JobBanner`, `features/history/JobBanner`): one strip for a rebase
on main, on every tab of the page, which replaces the red line that used to
tell a stop. It reads the run of the branch (`historyRuns`), never local state,
and its stops carry only the actions that exist today (Dismiss, Refresh, Open
terminal, Open providers, Check again, Undo rewrite, See what it did). A failed push after
a rebase offers `Fix with agent` (the primary: an Implementer on that worktree briefed with the
command and git output, `fixPushWithAgent`; it commits the fix and never pushes, Goodboy then
pushes again with the same lease, `settlePushFix`, and the banner follows it with a link to its
transcript), `Open terminal here` (the session terminal drawer at the worktree with the exact
push typed at the prompt and not run, `openSessionTerminal` with `prefill`) and `Retry push`.
The same two actions sit beside Retry on the inline failure line of the header Push and Force
push (`PushFailureActions`, shown when the failed action's error is a push failure (`pushFailedError`)): the
agent is `fixBranchPushWithAgent`, its finish runs `settleBranchPushFix` (plain push, or force push
with the lease read before the agent started and the commits the confirm named), and the terminal
is `prefillBranchPushTerminal` (`git push`, or `--force-with-lease` pinned to the remote sha the
confirm showed, `PushFailedError.confirmedRemoteSha`; when the online copy moved since, nothing is
typed and the header says `The online copy changed. Check again before force pushing.`, and a
prefill always opens a new terminal tab). A retry that pushed clears the failure line
(`settledBranchPushes`).
Only the header pushes everything: a thread has no
Push, Push again or Sync button. The header reads `Push N fixes` (N counts every
accepted thread, the opened one never narrows it) and one click prepares the
preview. A clean preview (no blocker, no drift, a publication, no earlier commit
that is not a fix) pushes at once: the button shows `Pushing N fixes` and the
outcome is one dismissible line under the header (`Pushed 6 commits to origin and
posted 6 replies on GitHub.`). Any other preview opens the panel (`PushBanner`),
which holds the only `Push`; the header button stays as its toggle
(`aria-expanded`, a second click closes the panel and cancels the prepared
publication) and never pushes while the panel is open. A `stale` answer reopens
the panel with one line above it saying what changed (`driftSentence`). An accepted
thread opened in Comments offers `Push only this one` in its action bar
(`preparePublication` with `isolated`, `isolatedPushOf` unchanged); the panel
lists every commit that goes out, oldest first, with `Not a fix` on the earlier
ones, under a title that counts them all (`pushCommitCount`). `Push only this
one` is not shown while the panel is open, so one Push is visible at a time. A preview that is
left (page unmounted, navigation, Cancel, a `missing` answer) is closed as
cancelled in the database; `missing` says `The push was already handled or
cancelled. Nothing changed.` in the outcome line. `Publish N replies` and `Retry N` stay the header primary of their state. A blocked primary stays visible, disabled, with its
reason. `⋯` holds the rare lifecycle (Edit title and description, Request
review, Convert to draft, Close or Reopen, Open with the host logo, named Open on GitHub, Copy link) and the
branch actions (Change base branch…, Open terminal, Open in editor, Copy
branch name, Copy patch); a queued request with auto-merge adds `Cancel auto-merge`.

**Sections and landing.** The worktree level lists the entries the state has, in this order
(`branchTabsOf({ state, hasComments })`, `features/branch/branchTabs.ts`): with no
pull request and no comment `Pull request`, `Files`, `Commits`; with a local note or a thread
and still no pull request `Comments` joins them; Draft, Open, Approved, Queued, Merged and
Closed show all five, `Pull request`, `Comments`, `Files`, `Commits`, `Checks`. The first is
labelled with the host's noun (`Pull request`, `Merge request` on GitLab; its key is ⌥⌘1,
Comments ⌥⌘R, Files ⌥⌘F, shown in the row's tooltip) and Checks never appears without a pull
request. A row is 28px with an icon, the label and one fixed right-aligned slot
(`worktreeEntryFactsOf`; empty until a count is known, the fact in the tooltip), then a chevron
column that only Files fills. The current row carries `aria-current="page"`,
Up and Down move between rows while the list has focus, and a pick replaces the address. Merged and
Closed make the page read only (`isBranchReadOnly`): Commits shows its list without editing or Rebase. Every door that means "go to the
branch" lands through one pure rule (`branchLandingTabOf`,
`features/branch/branchLandingTab.ts`): an explicit section in the place wins, else
`Pull request` when the active mount has a pull request, else `Files`; then the door resolver
above drops a section the state lacks. The
sidebar's Branch row, the Branch crumb, `⌥⌘1`, a mount's `Open PR`, the Board's
pull request chip, an approved or changes-requested mark and a mount's
`Create PR` land on `Overview`; a comment, a thread, a fix run, a note, ⌥⌘R
(`Open Comments`) and a draft comments chip name `Comments` themselves (with no pull
request and no comment they land on `Files`), `Files`
and `Commits` doors name theirs, and a CI failure names `Checks` (with no pull request,
`Overview`). The chosen section
is stored per session and is read through `branchTabOf` (`useBranchTab` in a
component), never from `branchTab[sessionId]` directly, so a section is only
remembered once the person has chosen one; the page shows the section the state has
when the stored one is gone, without writing history.

**Pull request.** The pull request itself, on the 960px column
(`features/branch/components/PullRequestTab`), one column in every state: the property block
first, then the description and the Activity. The property block (`PullRequestProperties`) is a
grid, label 96 and value, in three groups 12px apart with no labels in caps: State (`State`
with the state chip from `PULL_REQUEST_PRESENTATION` and the number, `#318` or `MR !42`, from
`pullRequestNumberLabel`; `Base` as `→ main`; `Checks`, one line that opens the Checks entry;
`Readiness`, the word and reason of `evaluatePrMergeReadiness`, plus the queue line of a queued
request), People (`Author`, `Reviewers` with `Request review`) and Links (`Linked issues`).
There is no Rebase in it: the worktree status line owns it. The description renders as markdown with `Edit` beside its heading
(a click on the text also opens it; the editor is a textarea with Write and
Preview, `Save` and `Cancel` at its end, a failure keeps the draft and offers
Retry; an empty description reads `No description yet` with `Add description`)
and the Activity, oldest first: who opened it, the pushes grouped by day, the
reviews, one line `4 comments on files, 2 need you` that opens Comments, one line
for the checks that opens Checks, your edits of this session and the merge. Rows
that open something carry `ROW_INTERACTIVE`. Reviewers draw a glyph and a word each (`+`
opens the picker that searches the host's collaborators), Checks reads `4 passed · 1 failing`
(`Checks unknown` when the read failed), Linked issues carry their relation (`Closes #412`;
`Link issue` opens the popover). Without a pull request the section is the create
form alone, with no block above it (the Pull request entry reads `None`), and it
fills the same grid: one input card (the title from the session goal as a large
borderless field, the description growing from 6 to 16 lines, and in the card's
bottom row `Write with Scribe` with its routing and a faint `Markdown`), then
the settings as labelled properties in the side column (`Into`; `Opens as` with
`Ready for review | Draft` only where the host can set a draft; `Reviewers` only
where it can request them, requested right after creation; `Closes` with the
linked issues as chips; the changelog entry under `More options` when Scribe
wrote one) and the actions inline at the end, right aligned, with no bar:
`Discard text` (with Undo) and `Create pull request`, which reads `Create draft
pull request` with Draft. Scribe's job shows inside the card (skeleton lines
while it writes, a running dot with the seconds and `Stop`, a danger notice with
`Retry` when it failed); creating shows `Pushed <branch>` and `Opening the pull
request` in the same row, and a failure keeps the text under a danger notice
with `Details`. Creating it raises a `Follow` toast ("Pull request #318 opened")
only when the page is not already on screen. Every write goes through the
host-neutral `PullRequestPort` (`packages/core/src/review-source`), a facet of
the review source built per host in
`store/slices/review-source/pullRequestPortFor.ts`; the page reads the
capability table (`REVIEW_SOURCE_CAPABILITIES`) and never the host. A control
the host forbids on an object that exists is shown disabled with its reason
(`Bitbucket has no draft pull requests`, `Turned off in payments-api`, `Set by the
project`), and a concept the host does not have is left out. GitLab uses the same
page with its own calls and words (the chip and the form read `merge request`, the header
`MR !42`, `Open on GitLab`): `gitlabPullRequestPort` reads and writes through
Tauri commands that hold the stored token, `Mark ready` and `Convert to draft`
change the `Draft:` prefix of the title, Merge lists the ways the project
allows, and a token without the `api` scope reads `Goodboy can't read this merge
request` with `Open GitLab settings`. A branch with no merge request shows the
same create form with `Create merge request`, the same Scribe job and no
reviewers. Bitbucket uses the same page through its own adapter
(`bitbucketPullRequestPort`, built by `bitbucketPortOf` from the mount's
request): merge offers its three strategies, `Close` declines, and the draft and
reopen controls are left out. `E` edits the title in scope
`pullRequest`, live only on this section.

**Comments.** The section header holds a segmented control `All 9 · Notes 3 · On GitHub 6`
(only while both notes and host threads exist) and `Open · Resolved` (only while there are
comments), with `Fix N comments` at its right, the one fix action. The list (`Needs you`,
`Working`, `Ready to push`, `Open`, `Left open on GitHub`; `Done` shows under
`Resolved`) lists your notes and the pull request threads together, each row with
the author and its age, its `path:line`, the first line of the body and a `Note` chip only
while the list mixes sources. A note keeps `Post to GitHub` (it moves the note into
the pull request's review draft and closes it) and `Delete` under its thread, and a
note shows even while the host is still loading or failed to load. The open thread has the code
around the commented line above it (`hunkAround`, linking to Files), all inside the comment drawer. Comments exists when a pull
request exists or at least one comment exists, a local note or a thread open or resolved; its count is
the notes alone while there is no pull request. The
properties (Origin, Attempts, Fix commit) sit inline under the thread at every width, never in a margin rail. The
actions of the comment sit at the end of the drawer content through `FormActions` (`CommentDrawerActions`), never in a bar pinned to the page bottom; the `⋯` in the drawer header holds the transcript, Resolve without a reply, Open on the host and Copy link, and shows only with two or more of them (one rare verb shows as a quiet button instead).
Every Branch section sits on the 960px column (`PaneShell width="column"`, bodies in
`PageColumn width="column"`), the header and Ask included, so nothing
moves from one section to the next, except that Files gives up the width of its file rail
on the right and the column re-centres in what is left. The Comments section is one full-width
list at every pane width, with no back link; the open comment is the drawer, and the last row
opened stays marked after the drawer closes. The entry slots read nothing until the data arrives and nothing at zero:
Pull request `Draft`, `Merged` or `Closed`; Comments the count that needs you; Files the
count; Commits `↑2` (tooltip `2 not pushed`, `notPushedCountOf`); Checks the failing or
running count (`worktreeEntryFactsOf`; the comment
source tabs drop a zero badge the same way). All three arrive without a visit: `BranchPage` loads
the mount's history draft (`loadHistoryDraft`) once when the page opens and the
draft is not there yet, so the Commits count is a number on the Comments section too. `Fix N comments`, in the Branch header on the Comments section, is the one fix launch.

**Files.** The branch against its base, with the changed file list in a rail on the
right of the Branch page, dedicated to the diff (`FileRail` in `features/diff/components`).
`BranchPage` draws an empty slot (`data-slot="diff-file-rail"`) after the page column only
while Files is the entry and hands it, with the page element, to `SessionDiffPane` through
`DiffRailContext` (`features/diff/diffRailHost.ts`); `SessionDiffPane` portals the rail with
`ChangeTree` into it, so the tree and the diff still share one `useReviewState` and the keys
stay in `useDiffKeys`. Without a slot (a test, a scene of the pane alone) the rail sits beside
the diff inside the pane. The rail runs the full height of the page, beside the header and the
diff, so the column re-centres in the space left of it the way it slides for a right drawer.
It opens at 320px, its left edge resizes it from 260 to 560 (`Resize the file list`, a double
click resets it) and the width is kept in `goodboy:diff-file-rail-width:v1`. `Fold the file
list` in its head folds it and `goodboy:diff-file-rail-folded:v1` remembers that; folded, the
diff toolbar ends in `Files N`, which opens it again, and `F` or `/` open it too (`useFileRail`).
The rail belongs to the page, not to the drawer slot: a side or reader drawer pushes or lies
over the whole page (rail included) by the push rule of Drawers below. The rail docks while
the page is 880px or wider (560 for the diff plus the rail); a narrower page (a pushing drawer,
a small window) folds it without writing the saved choice, and `Files N`, `F` or `/` then open it
over the right edge of the diff (`data-file-rail="overlay"`) until a pick, `Esc` or Fold
closes it. Folding and opening move like the session rail (`FileRail` over `useFoldPhase`,
the page as its frame): the width eases on the 220ms fold token while the list, held at its
final width, fades out (`fold-label-out`) or in (`fold-label-in`); a switch between docked and
overlay (the page crossing 880px) remounts the rail in place, with no move. The rail head reads `Next unviewed N`, the keyboard button and Fold, then the
filter field (`/`) with the filter menu beside it (scope and grouping), then the tree;
each file row keeps its viewed mark.
The toolbar on the column (36 high, the diff scrolls under it) reads `Compared with main · All 5 commits ⌄`,
then `Display ⌄`. Folders first, then files, alphabetical,
and the diff follows the same order. A chain of folders with one child is one
row (`src/ledger/export`). A folder row holds a progress ring (empty, partial,
or filled with a check once every file in it is viewed, tooltip `3 of 5
viewed`), the path and, only while it is collapsed, its file count and its
`+N −N` in one muted tone (no green or red; an open folder shows none, its files
carry them); a file row (28 high, 8 per level with a 1px guide) leads with the viewed
toggle (a checkbox button, `Viewed: <name>`; an amber dot when the file changed after
it was viewed; none on a merged or closed pull request), then the name (a rename shows
`from <old path>` under it, a deleted file is struck through), a comment count chip whose
tooltip names the kinds (`2 notes, 1 on GitHub`), `+N −N` only at a rail of 300 or more, and
the status letter. `+N` and `−N` sit in two fixed right-aligned columns (`Delta`), and a closed
folder keeps the status letter's slot empty, so every count lines up down the list. A name too long for the rail keeps its first six characters and its last
six with the extension chain (`Statem…ceCard.test.tsx`, `cutFileName`); the full name stays
for a screen reader. A file or folder row has no tooltip: the full path is in the file header of the diff. The tree is a `tree`: Up and Down move
its cursor, Home and End go to the ends, Right and Left open, close and climb, `Enter` jumps
the diff and keeps focus in the tree, `Space` toggles viewed (or folds a folder) and `Esc`
returns to the diff (and closes a rail that lies over it). A keyboard button beside
`Next unviewed` at the head of the rail carries the key hint in its tooltip and opens the full list.
Under the head a filter field (`/` and `T` focus it, `Esc` clears it) matches a
subsequence of the path, and one filter menu beside the field (`Filter and group files`,
tinted while a scope is on) holds `Show: All | Unviewed N | Commented N`, which narrows it
further, and `Group: Folders | Kind`, which regroups the tree under Source, Tests, Config and
Docs (each file then shows its folder beside the name). The filter narrows the
diff as well as the tree, `Showing n of N` with `Clear` says so, and a filter
that hides everything leaves `No files match` with `Clear` in both panes
(`filterFiles` in `changeTree.ts`). Generated files (lockfiles, `dist`, `build`,
`vendor`, minified and map files) sit in a closed `Generated` row at the bottom
in both groupings and at the end of the diff. Viewed marks are stored per session, mount and view, so two repos in one session
keep their own; marks saved before that are read until the mount saves its own.
Click a file and the
diff scrolls to it; scroll the diff and the tree highlights the file in view but
never opens a folder: when that file sits in a closed folder, the outermost
closed folder shows a small primary dot (`contains the file in view`). The tree scrolls
only when the file in view changes, and only far enough to show its row; a refresh of the
diff data never moves it again. Folds are
remembered per session and project in `localStorage`
(`goodboy:diff-folds:v1:<session>:<mount>`, only your changes from the default,
at most 500 entries, in `useFoldState`), so closing and reopening the page, a
new file or another view never undoes them. A click in the tree, next unviewed,
`Viewed` and a link from another page open the folders above their file; `J`/`K`
walk every file in diff order, also those in closed folders, and leave the folds
as they are. A click, `J`/`K`, next unviewed and `Viewed` call the diff's
scroller directly (`registerScroller` on `DiffView`); `focusPath` is only for a
link from another page such as `Open in Files`. A refresh keeps the tree and
the diff on screen (`isRefreshing` on `useSessionDiff`); skeletons show only
on the first load and when the scope changes. The diff resets its mounted
batch, its observer and its place only when the list of paths changes, never on
a new array with the same paths, so marking a file viewed or a note changing
neither shortens the page nor drops an open composer. Folder row ids start with
`dir:`, so a folder and a file with the same path never share a key. The tree and the diff share one `useReviewState` (active
file, open folders, notes, `Viewed`), and a model in `features/diff/lib/changeTree.ts`
builds the rows. The file cards sit 8 apart on the 960 column (never the pane's width); a
card header is 44 high on the panel surface and holds the fold chevron, the status square,
the path (folders faint, the name whole, cut from the left, with a real tooltip) and
`+N −N`, then `Viewed` (a checkbox with the word; checked folds the file, tooltip
`Changed since you viewed it` when it went stale), the `Comment` word (tooltip with the count
of both kinds) and one `⋯` from the `diffFile` kind of the action registry with `Open in editor`,
`Show whole file` and `Copy path`. When only one of them applies (a peek with no editor and no
whole file) the header draws that one as a quiet word instead of a `⋯` of one item
(`ObjectMenuOrVerb`). A right click on the header lists the same actions.
`Show whole file` opens a right drawer (`FileWholeDrawer`) with the full file and the change
marked, loaded for the same view as the page (branch, working tree or commit). The drawer starts
in the page's Display layout and has its own Unified and Split toggle in its header: it is local
state and never changes the page's Display setting. A merged or closed pull request hides Viewed, Comment, Reply and
the other writes. Split needs a column content of 880 or more, otherwise `Display` says
`Split needs a wider window`. The write review form is not on this toolbar: it opens from the
pull request's `Write review` action and swaps the tab body for the review form with line
drafts. The section carries no Fix, Push, Rewrite or `PR #N` control of its own.

**Commits.** The branch graph updates immediately when a commit is moved,
folded, renamed or removed. Undo and Redo icon buttons sit in the Commits
header. The same actions use ⌘Z and ⌘⇧Z while the page is open;
text fields keep their own undo. Leaving the page clears the edit stack but
keeps its backup refs. The graph fills the page column at every width.
There is no preview column, saved edit plan or Apply step for manual edits.
The existing Force push action updates the online branch separately. While the branch is behind its base, `Rebase on main` takes the secondary slot and Force push moves to `Branch actions`.

Each live edit takes the shown mount, branch, worktree and expected head
(`changeLiveHistory`). The Git command (`history_live_edit`) holds a writer
lease across replay and branch movement, saves a backup before replay and
checks the result on a temporary copy. An agent reservation blocks inline,
and a busy row disables further edits without a queue. A conflict leaves the
branch, index and files unchanged, names the error inline and offers Rewrite
with an agent or Undo to dismiss the failed edit. Dirty files use the stash
consent and recovery flow. Undo and Redo restore a backup with an expected
head check; failures retain the stack and the captured retry target. None
of these operations pushes to GitHub, GitLab or Bitbucket.

Previous versions (`Previous versions n` under the graph, the `Previous versions` drawer, `Reset branch to this version`) live here. There is no
Rewrite history page: the old history address, the palette verb and Activity
history rows land on `branch/commits`. **Checks.** The checks of the pull request. A GitLab or Bitbucket
session reads them through the same five states once its host's
`canReadChecks` is on (GitLab: the jobs of the head pipeline, a job allowed to
fail counts as skipped; Bitbucket: its commit statuses; a token that cannot read pipelines gets the denied
notice with `Open GitLab settings`); while it is off the tab says Goodboy does
not show that host's checks yet (`checksViewOf`).

The Branch page shows one branch. The trail carries the choice (see Segment
menus); there are no worktree tabs. Every rewrite takes the shown
mount's `mountId`, never the active mount. `Rebase on main` replays the
branch on origin with the history engine and runs no agent. The engine first
predicts the replay in memory; when it conflicts, the button reads
`Rebase on main · N conflicts`. A conflict stops the rebase with the branch as
it was and asks inline (`RebaseConflictPrompt`): **Resolve with Auto**, **Open
terminal here** or **Abort rebase**; no agent starts by itself. A clean rebase
moves the branch only after the engine checks the result, with a backup ref and
a push with lease.

The Commits tab draws the branch as a graph (`history_graph`): a grey main
trunk, your branch leaving it at the real fork point, one
row per commit newest first, and the base row at the fork. There
is no row of fact chips over it: the graph already says how many commits are
yours, how far main moved and what is online. At rest the section is one
column (`grid-cols-1`) on a 72px lane (trunk at x 20, lane at x 52): one row
per commit (title, then sha, author and age in
`text-meta`, a faint `Not pushed` chip only on a commit that is not on the
online copy, the grip a faint mark of a row that drags), then the base row.

**The base row** (`HistoryBaseRow`) is the action point for the base. Behind the
base it reads `Based on main 9d4b1f7`; how far behind and `Rebase` live on the worktree
status line. The base chip (`branch → main`, a
searchable listbox of the repository's branches) picks another base; the button
then reads `Rebase onto <branch>`. The button asks in a `ConfirmPopover` anchored
to it and runs the rebase command (`rebaseBranch`, with `ontoBranch` for another
base) with a version of the current history kept. The Activity rebase suggestion
(`Open rebase`) opens this page on the mount it names, scrolled to the row with
the button focused (`HISTORY_FOCUS_BASE_EVENT`).
The page header has one `...` button (`HistoryKeysHint`, an anchored popover)
with `How to edit commits` (the Guide chapter Commits) and the keys of the
focused row (`useHistoryKeys/historyKeys.ts`); no teaching line sits under the
list. Each row's `...` menu lives in a fixed cell that shows on hover and
focus (`row-actions`, `HistoryRowActions`), and `Previous versions` is a fold
row with its count at the end (`HistoryVersionsLink`). The registry verb for
`mount.rewriteHistory` and `diff.rewriteHistory` reads `Edit commits`. There is no
preview or Apply step. The graph shows the live branch. Drag a row between
two others to move it, or onto another to fold it in. Focused-row keys are
Alt with arrows to move, C to fold, S to combine both messages, R or Enter to
rename, and Delete or Backspace to remove. Row titles and accessible names
read the refreshed commits after each successful edit.

The move refuses to overwrite local or untracked work. Files move with a
two-way read-tree, then the branch ref moves with compare-and-swap. Undo
and Redo use the same guarded move, writing a reciprocal backup first.
A changed branch or head stops the operation. Resolve-thread commit
references follow successful edits and return with Undo and Redo. A failed
metadata update leaves the recovery refs available and shows an error.
Empty commits stay; only removed or folded commits disappear. Commits before
the first edit keep their shas.

Every move leaves a backup under `refs/goodboy/backup/`, in a namespace made
from the full branch name. Live edits, Undo and Redo keep their backups for 30 days; they do not count
toward the retained-backup cap. Restoring an older version
uses the retained policy: the newest 20 per branch are kept, and an older one
is dropped only while another retained ref contains its commit. The newest backup is
never pruned. Older backups from the former naming remain read-only.

`Previous versions n` under the graph (and `Previous versions…` in the page menu) opens the `Previous versions` drawer (kind `history-versions`, side tier). Each version shows when, why (`Before a rebase`, `Before a fold or drop`, `Before a reword or edit`, worked out by `history_backup_facts`), the commit count, the difference with now and an expandable commit list. `Reset branch to this version` (danger, anchored confirm) moves the branch back and the drawer offers `Undo` right after.

History rewriter's writable directories
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
above the code and replaces the old toolbar and its counts: `Compared with <base> ·
All N commits ⌄` on the left (the base is the mount's own base branch,
never a fixed `main`; a commit view reads `Commit abc1234`, the working tree
`Working tree`, `Staged only` or `Unstaged only`), and `Display ⌄`
on the right, because the view decides which files you see,
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
in the tree rail that carries `data-diff-filter` (it opens the rail first when
it is hidden behind `Sections`). The rail has no fold key. A line under the tree lists them once, from the registry (`keyHelp.ts`).

Big and folded cases (`shared/utils/windowRows.ts`).
Past 120 visible rows the tree draws only the rows in view plus a margin (fixed
28px rows, 44px for a rename), so 512 files scroll as light as 20. A change
over 300 files starts with its deepest folders over 50 files closed (a parent of
a big folder stays open), and starts that way again when a different set of
files arrives, not on a reload of the same files. The diff keeps its own
progressive mounting; the patch parse stays on the main thread because a
512-file patch parses and becomes a tree in about 2ms (`largeChange.test.ts`
fails over 100ms, the point where a worker earns its cost). While the diff loads the rail shows skeleton rows and
`Loading files…`. An empty scope drops the tree and the toolbar and shows one centred empty state on the page column
(`DiffEmptyState`): what is empty in plain words, the scope picker inline and,
when the other scope has files, one button that switches to it (`Show branch vs
main (6 files)`, `Show working tree (2 files)`; `alternate` on `useSessionDiff`
counts them). Files opens on the branch against its base when the working tree
is clean and the branch has commits ahead, unless the scope was picked in the
picker. The `brand-diff-large` scene is the 512-file case, `brand-diff-many`
the 40-file one, `brand-diff-empty` the clean branch and `brand-diff-edits-only`
the one that matches its base but has edits.

A jump is instant, not smooth: file bodies keep
`content-visibility` with a height estimated from their rows
(`bodyEstimatePx`, see docs/traps.md "Diff file body height"), so for a few frames the view
measures the picked header and snaps it back to the top until the heights
settle. While you read, `useScrollAnchor` keeps the file under you still when
a body above it renders and changes height; it stands down during that snap.
The picked file stays the active one until you scroll, so `J` and `K`
start from it. Each file has a sticky header (status letter, path, `from <old path>` on a rename,
changes, comment count, a visible `Comment on file` button, `Viewed`, `⋯` with
Open in editor, Copy path, Comment on file); a viewed file collapses and opens again when you unmark it, from the
header or from anywhere else, and generated or binary files start collapsed.
`Comment` (the header button, with the count of both kinds; the tree rows carry no comment
button) opens a composer under the header and scrolls to it. It always saves a local note on the file (the same note a line
gets, without an anchor), with a pull request or without one; the composer reads
`Note on this file` and `Add note` in both cases. The note sits under the file
header, counts in the header and the tree row, and lists in Comments
with the file path and no line. Reaching the pull request is explicit: `Post to GitHub` under the note
in Comments turns a file note into a `pr_review_drafts` row
with `line` 0 (no migration), sent with the next review as a GitHub `FILE`
thread (pending review, `addPullRequestReviewThread` with `subjectType: FILE`,
then submit) or a GitLab discussion with `position_type: file`. A file draft
written before 0.23 stays in the review draft, shows under its file header, and
is stale, and skipped on submit, only when its file leaves the pull request.
Rows are a CSS grid with `role="grid"`, never a table. Click a line
number to comment, drag or shift-click to cover a range; the composer and the
threads sit under the last line of the range. ⌘Enter saves, Escape cancels.
`+ Add note` on a line saves the note with the project and branch of the active
mount (`diff_comments.project_id` and `branch`, m223). A note shows `Edit`,
`Close note` and `Delete` in the diff (`Edit` rewrites the text through
`updateDiffCommentBody`; Delete acts at once and offers Undo, which posts the same note again); the one fix action is `Fix comments` in the toolbar. While a fixer
works on a note, Edit, Close note and Delete are disabled with "A fixer is working on
this note". Close note goes through `closeResolvedNote`, the same path
Comments uses. The Files tab shows only the notes of its own branch; a note
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
list. With two or more notes the section header has `Discard all`. Write review puts
its form under the last file: the line comments with Edit and Delete visible at rest (Delete offers Undo), the verdict,
the summary, and one primary that says the verdict (`Approve`,
`Request changes`, `Submit comments`), ⌘↵ from the summary. The form's `⋯`
in the diff toolbar holds Discard review, which confirms. The actions are
the `writeReview` kind of the action registry. Files mount in batches of 20 as the
browser idles, so a large diff stays responsive.

**Notes and host threads in Files.** The diff draws both kinds of thread under their line, in one
card shell (`CommentThread`), told apart by words and glyph, never by colour alone. A
note is the `You` tile, the chip `Note`, its state and its age, with `Edit`, `Close note` and
`Delete`; a host thread is the host's glyph, the author's avatar and name, the chip `On GitHub`
(`On GitLab`, `On Bitbucket`), `Open` or `Resolved`, `3 replies` with the replies listed, and
`Reply` (an inline composer posting through the reply verb, only where the host can
take a reply), `Resolve` (only where it can resolve) and `Open in Comments`. A thread
carries an outcome slot after its kind chip, which `Fix comments` fills with the state of a fix.
Outdated host threads stay out of the diff and read `Outdated` in Comments. Threads of every host
with threads show, not only GitHub's (`useDiffReviewThreads`). There is no
Notes drawer: a note's home is its line, and Comments lists every thread. The doors that used to land
a note in a drawer land on the note: Files at its card (the card scrolls into view and takes focus) when
the branch has no pull request, its thread in Comments when it has one (`openReviewTarget` for a
`notes` destination, `reviewRequest` for a compose request, `Open in Files` from a thread).
Opening the run transcript of a note keeps its drawer beside Files.

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
