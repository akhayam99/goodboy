# The model and the rules that hold everywhere

> **Read this when** you decide how a surface is reached, what a door or a link does, what lights up, or how an undo or a follow toast behaves. **Not for** the palette ([palette.md](palette.md)) or addresses and history ([addresses.md](addresses.md)).

## The model

### Where things live

- **The board is home. Chat is a destination.** A workspace with no session selected
  shows a board of every session by stage (needs you, running, in review, building,
  done). Chat, diff, terminal and open in IDE are reached from the cards, never
  landed on; every capability stays one step away.
- **The Board frame.** The Board is the one list across sessions: no List view, no
  switch, no stored page view. Its title row, its **Filter** (`SessionFilterPopover`,
  "N hidden · Clear" through `HiddenByFilters`), the five lanes and the cards are in
  [features/board.md](../features/board.md). The filter writes the one
  `SessionViewPrefs` record; a view menu never changes data.
- **Board geometry.** Header and lanes share one frame centred in the pane, so the
  title starts on the first lane's edge. `boardLanesOf` picks how many lanes fit, and
  `laneWidthOf` is the one lane width, which the Needs you cards read too. A card's
  stage track is `stageTrackOf`, its one signal `boardSignalOf`.
- Repository state lives on the top bar's Repositories entry (`RepoEntry`), and New
  session is New on the places rail. The Board door works from every place, the
  draft included.
- **An archived session is read only until Restore.** Its Overview header holds
  Restore alone; notices, unassigned comments and Next are not drawn; the composer,
  new agents, workflows and mounts stay disabled with "Restore this session to
  continue". Nothing restores on its own, so a shelved session never spends.
- **Archive stops the live agents first.** With live work it asks once, inline,
  **Stop 2 agents and archive**; with none it archives at once with Undo. An agent
  that does not stop keeps the session where it was, and Undo brings it back with
  its agents reading Stopped (`archiveTask`, `archiveConfirmOf`).

### Three surfaces, three jobs

- **The top bar is now**: state, identity and movement. It never edits a record and
  holds no control for another container; every chip opens the home of its number
  ([shell.md](shell.md#top-bar)).
- **The places rail is access** ([surfaces.md](surfaces.md#the-places-rail)). It is
  on every workspace screen, Settings included, never changes level, and no page
  changes it. It holds no tool: Terminal and Browser are on the right rail
  ([session-tools.md](session-tools.md)). Monitoring has no rail place and no top bar
  icon: it opens from the Go menu, the palette and the Now chip, and its page has no
  band and no Close.
- **The ⌘K palette is transit** ([palette.md](palette.md)). There is no footer.
- **The test for a home.** A place you go to and read full width is a place; a tool
  you open beside your work, in the dock with Open full page, is a rail icon. Chat
  and Impact are places. Monitoring is a tool with no dock body yet and an address
  that is a page target per branch, so it waits off the rails.
- **No Work door, no `work` studio.** A Needs you card opens the run that waits
  (`attentionPlace`). A stored Work place opens the Board with no drawer
  (`withoutRemovedPages`), per window. ⌘K lists one "Lead: title" row per open Lead
  (`leadEntries`).
- Connections, after Chat, is the page of providers and integrations
  ([connections.md](connections.md)).

### One list names every destination

`DESTINATIONS` (`shared/navigation/destinations.ts`) owns, for Board, Tasks,
Workflows, Chat, Connections, Impact, Monitoring, Notifications, Terminal, Browser,
Settings, Guide and What's new, in one order: the name, the glyph, the shortcut, the
menu id, the former names, the scope (`app` or `workspace`), the home (`column`,
`rail`, `menu`, `topBar` or `foot`) and the short rail word (`railWord`, Connect).

- The places rail, its foot, the Go menu, the palette and the shortcut sheet all read
  it, so a destination has one word and one glyph. Settings, Guide and What's new
  have the `foot` home and the `app` scope; the rest are `workspace` pages. Moving a
  destination is a change of its `home` and its row.
- `openDestination` is the one way to open one, Board included: it replaces the open
  page and pushes only from a place, so Back lands where you were before the first
  page.
- A name changes in `NAMES` and the table follows. `menuBar.parity.test.ts` checks the
  Rust menu against it; the Go menu keeps a separator after Impact. The shortcut
  sheet keeps registry order, and `destinations.test.ts` checks its Navigate group
  follows the list.
- Board answers to Sessions in the palette, its page titled Board. Each session page
  has its own glyph: Runs `CONCEPT_ICONS.runs`, not the Workflows glyph, Artifacts
  `CONCEPT_ICONS.plans`. Connections draws the plug and answers to Providers and
  Integrations.

### One home per thing

A thing that must exist in state A and can exist in state B lives where it must, and
B gets no second copy.

- Workspace identity is always pinned at the left of the top bar, followed by the
  Repositories entry (`RepoEntry`): a branch icon alone while nothing needs a pull, a
  dot and "3 behind" or "Diverged" when a base branch moved on origin, a quiet "Check
  failed" when origin cannot be reached. Its facts come from `repoEntryFactsOf` (one
  row per repo that needs a look, drawn by `repoEntryCardOf`) and each row's from
  `repoRowFactsOf`; the background check is `useRepoDivergenceCheck` over
  `checkRepoDivergence`.
- Neither the column nor a studio header repeats the workspace name. A studio
  subtitle is a one-line purpose or the installed version, never the workspace.

### Stable controls

- **Pin the structure, flex the density.** A control keeps its position so people
  learn it; none appears or disappears when a count crosses a threshold, though a
  count may (a zero chip is noise). A control that does not apply stays visible and
  disabled, with the reason beside it. Two exceptions: connecting an integration
  group shifts the controls to its right (order fixed, not position), and the update
  control comes and goes with a pending update, an event.
- **Hidden is not gone.** Anything put away comes back without a hunt. The places
  rail never folds; page lists keep their own folds ([studios.md](studios.md)).
- **Navigation chrome is neutral at rest.** Selection is a muted fill, never an
  inversion. New session is the only emphasised column control. The rail signature
  is a quiet door to What's new whose only signal is a dot for unread notes; a
  pending update adds an Update mark above it.
- **Settings match the scope they edit.** Application settings are a full-page
  studio, workspace settings a scoped pane. Changes save instantly: no Save or
  Cancel footer, no settings surface stacked on another.

### One main slot, doors and links

- **One main slot.** Board, the session, the draft and every studio are pages in it,
  one at a time. Session-scoped editors layer over the session pane; anything that
  became a lens stays a lens. A session drawer parks while a studio is open, and
  Terminal and Browser stay docked beside any page but their own, belonging to the
  session or Board they were opened in
  ([surfaces.md](surfaces.md#the-dock-follows-the-page)).
- **A door replaces, a link stacks.** A door names a studio: a column door (Tasks,
  Chat, Connections, Workflows, Impact, Monitoring, Settings), the Goodboy line, the
  foot of the bell list, a ⌘K Go to row, the spend chip. A door over an open studio
  replaces it in the same entry (`switchStudio`), so five doors leave one entry. A
  link inside a studio's content (a notification opening Settings, a card opening
  Impact) stacks (`openStudio`), so Back returns to it; so do Help's tabs and a
  notification row with no session. Board is a door (`openDestination`). Events from
  the bars carry `door: true`.
- **One exit.** Close, Esc and Back leave a studio alike: they land on the entry
  below, and Forward brings it back. With nothing below, Close rewrites the top entry
  as the page without the studio. Esc closes a popover or confirmation inside first.
  An app page (Settings, Help, New workspace) shows Back to app; a workspace page
  (Tasks, Workflows, Chat, Connections, Impact, Terminal, Browser, Monitoring,
  Notifications) shows no exit control. Nothing has a Close button.

### One selected sign

Every page lights exactly one control, with `bg-selected`, `cursor-default` and
`aria-current="page"`: the open studio's door; New session while the draft is open;
Board on the board; the bell for Notifications; inside a session no door, since the
session row is the column's sign and the current page tab the tabs' sign.

- Help lights no rail control (its band names it); New workspace is a flow and
  lights nothing.
- Every control reads the sign from one place (`columnPlaceOf`, through
  `selectColumnPlace` and `useColumnPlace`), so no page leaves two lit. Under any
  page the session row is remembered, never current.
- A popover trigger that is not the page's own control (the Usage chips) is never
  selected and only reports `aria-expanded`; the bell is selected only while its
  page is open.
- A button's label, `aria-label` and tooltip name the same word; the hover hint adds
  only the shortcut. `__tests__/navigation/oneDoor.test.ts` pins the rule.

### Second entry points

A second entry point reuses the existing mount and never builds a parallel one. The
palette dispatches an event the owning component listens for, and the keyboard path
calls the same hook method as the button.

## The ⌘K palette

The one overlay that is transit, not a flow; the whole contract is in
[palette.md](palette.md).

## Addresses and history

Every view has an address (`Location`) recorded in one history per window and
workspace, owned by the navigation slice ([addresses.md](addresses.md)).

## Undo operations

- Reversible task removals act at once. The app-wide Undo stack keeps up to 50
  operations for the window, newest first.
- Each removal offers an Undo toast for 10 seconds; Cmd+Z (Ctrl+Z off macOS) undoes
  the last operation outside a text field or terminal. Dismissing the toast keeps
  the operation, and a failed Undo stays retryable.
- Session unlink snapshots every placement of one task, every branch included. A
  move (`Move to`, Remove from this branch, Link work to this branch) is one
  operation replacing the task's rows in one write, so branch to branch is one Undo,
  and it snapshots the session placement it may create.
- Undo compares the current placements with the expected result and restores the
  snapshot in one guarded transaction. A later re-link or changed row makes Undo do
  nothing and say why; other tasks and projects stay untouched. Stop tracking
  restores only the workspace task, never a session link.

## Follow toasts

An action that starts work, or creates something that lives elsewhere, offers Follow
once it returns.

- The toast is `info` (`success` means finished), its title past tense ("Run
  started"), its message only when it adds a fact. The action is `Follow`, or `Follow
the run` when the target is not what the title names; it pushes, so Back returns,
  and opens the target's drawer when the target is one.
- Pending stays the control's `isBusy` pulse, never a spinner. A failure never
  becomes a Follow toast: it goes to the log (`reportError`) or stays beside the
  open form.
- **On screen means no toast**: when the target is the current place (and its named
  drawer the open one), with no studio and no overlay drawer covering it
  (`data-drawer-mode="overlay"` on the drawer `aside`; a push drawer does not
  count). The same holds for the rebase start, the composer's `$`, `~` and `@` picks
  and a plain Deny; a session-long ban is a line on the permission card.

### One toast per start

1. The caller passes a `startKey` (a run or agent id) to `useFollowToast`.
2. The key marks the run or agent user-started for 5 seconds
   (`shared/lib/userStarts.ts`) and becomes the `dedupeKey` `follow:<startKey>`.
3. `WorkflowFollowToastBridge` skips a step start that carries the mark, so Approve or
   Run plan never raises a second toast, while a step the orchestrator starts keeps
   its one `Follow` toast.
4. A caller that starts work and then awaits it marks the key first
   (`markUserStart`), because the bridge hears the step start first.

`dedupeKey` is one part of a toast's identity with its kind, title and message: an
identical repeat folds into the first with a count, and a different title under the
same key is a second toast. The title reaches assistive tech through the toast card,
a polite `status` region for every non-warning toast. Code that cannot call a hook
builds the same params: `planRunToast` for Run plan, which marks the agent. Starts
that already land on their page raise nothing: the run header's Start run navigates
to the run page (`RunPrimaryAction`), so `WorkflowRunStartButton` toasts only for a
start that does not.
