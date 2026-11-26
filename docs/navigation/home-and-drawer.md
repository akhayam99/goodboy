# Home, creation and the right drawer

> **Read this when** you change Home, the way a project or a session is created, or what goes in the right drawer. **Not for** spacing, scroll and overlay mechanics ([styling.md](../styling.md)) or design intent and tone ([DESIGN.md](../../DESIGN.md)). The other pages are listed in [navigation.md](../navigation.md).

## Home

Home is the one page of a window with no workspace open: workspaces exist and
none is open here, or there is no workspace at all. `App.tsx` renders it
whenever `currentWorkspace` is null, in every window. It has no app chrome, so
it carries the lockup itself: the 40px `BrandTile`, the word and the version
([brand.md](../brand.md)). Under it:

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
  `goodboy:add-workspace` through `openNewWorkspace`, like the switcher,
  Search or run and the menu bar. On Home the `addWorkspace` place
  swaps the list for `NewWorkspaceForm` in place, the lockup stays put, Cancel
  or Escape goes back, and Create opens the new workspace and lands in it,
  whatever the folders are: a plain Code folder was already offered git on its
  pick row.
- **No workspace yet.** A card that says how a workspace starts, with New
  workspace and, while setup is unfinished in the main window, "Setup paused at
  Workspace · 1 of 3 done" and **Resume setup** (`useSetupResume`, counted by
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
  late answer for an older pick is dropped. The pick number is taken before the
  folder dialog opens (`isPicking` keeps Choose folder busy), so a folder that
  answers after a newer pick, Start from scratch, Back or closing the form is
  dropped too. A repository shows Git and its
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
the work reaches them ([concepts.md](../concepts.md) → Lazy sessions).

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
flush with the window's right edge. Wherever the tool rail is there (every page
of the app) the page container rounds all four corners (`rounded-frame`) and the
drawer container stands 12px to its right (the resize handle sits in that gap),
flush with the window's right edge and rounded on its two left corners, and the
pair keeps a 12px inset above the window's bottom edge. `DRAWER_GUTTER` in
`packages/ui/src/drawerGeometry.ts` takes its value from `SHELL_GUTTER_PX`.

**The rail is the anchor.** The drawer container holds the dock and the rail
on one surface. `DrawerDockBox` puts the rail last (`data-drawer-edge`, fed
through `DrawerEdgeContext`), pinned to the window's right edge. Closed, the
container is the rail alone, 56px wide, 44px and icons only under a 1100px
window, the name in the tooltip (`TOOL_RAIL_WIDTH_PX`). Terminal,
Browser, Scripts, Ask and Monitor each toggle their panel to its left
(`RAIL_TOOLS`, `toggleRailTool`). Scripts and Ask are disabled without a
session. The rail stays still while a panel opens, closes or resizes, so its
button stays under the pointer. Monitor opens `MonitoringDrawer`, a workspace
tool panel with Open full page, and is not restored on reload
(`UNSAVED_DRAWER_KINDS`).

**Two panels, one order.** Left to right the frame reads: places rail, page
content, detail panel, tool dock, tool rail. The tool dock (Terminal, Browser,
Monitor) lives in the drawer container, attached to the rail with no gap,
line or radius between them, on the rail's `bg-drawer` surface, so rail and dock read as one
surface running to the window edge. The resize handle stays in the gap between
the detail panel (or the page) and the dock container. A detail panel (an
artifact, Scripts, Ask, a plan part, a check analysis, a transcript, a reader,
every other kind) is its own container between the page
and the dock: `data-container="detail"`, `rounded-frame`, `frame-edge` border,
on the page's `bg-background`, 12px from the page and 12px from the drawer
container, with its own resize handle in the left gutter. Both can be open at
once. `DrawerColumn` takes the dock as `drawer` and the detail as `detail`
(`detailSizing`, `detailKind`, `isDetailParked`). One solver, `dockLayoutOf`
in `dockLayout.ts`, lays out every combination, the detail included as a lane:
it pushes at the saved widths, then shrinks toward the minimums (browser,
reader, then side), and only then lets the detail alone lie over the page while
the tools keep pushing (`isDetailOver`, `data-detail-over` on the aside). When
even the tools cannot push, every panel lies over the page. `panelAsideWidthOf`
is the aside: the detail plus its gutter while it pushes, then the dock plus
the rail plus their gutter. A `DrawerFrame` paints `bg-panel-surface`, the surface its container
names (`panel-on-page` for the detail, `panel-on-rail` for the dock), and its
pinned header frosts the same surface (`sticky-surface-panel`).

The drawer container is one step quieter than the page
(`bg-drawer`, recessed between chrome and background in both themes): it reads
as secondary, never louder, never tinted, and never a border to fake the
difference. `AppShell` hosts it through `DrawerColumn`'s `frame="sheet"`. The
Tasks and Chat studios do the same inside the main slot: their body registers
its drawer with the `StudioFrame` (`useStudioDrawer`), the frame draws one
`DrawerColumn` with `frame="sheet"` around the band and the body, so the band and
the list are the page container and the drawer container stands beside them from
the slot's top to its bottom; the shell's own sheet steps aside
(`data-studio-sheet-owner`) while the studio is open. A studio body with no
hosting frame (a mock scene that draws the studio alone) keeps `frame="none"`,
which draws the drawer container with a 12px top and bottom inset while it
pushes, and keeps its right edge flush.

**Three tiers, one width per panel.** A side drawer (Ask, Context, a fix run or
agent transcript, script output, a plan part, an artifact) opens at 400px and
resizes from 384 to 560px. A reader drawer (the plan, report and wireframe
document, an Explore file, a file diff) opens at 720px and resizes from 480 to
`min(1000, room)` while it pushes and to the room left after two shell gutters
and the rail, capped at 1000px, over the page. The browser pane has the third
tier: it opens at 720px and resizes from 480 to `room` while it pushes, with no
1000 cap, so on a wide window it takes everything the session column does not
need. A tool keeps its width on the session grid (below). A detail keeps its
width per kind everywhere, `goodboy:detail-width:<kind>:v1` (`detailWidthKeyOf`,
`useDetailWidth`; a studio's own panel uses `studio-<kind>`), so dragging Ask
wider never moves Context, Scripts, an artifact or a Terminal. An artifact and
an artifact document keep one width per artifact, `<kind>:<artifactId>`
(`detailWidthIdOf`), so widening one report never widens another. While a
detail closes it keeps the width it showed, so it never jumps on its way out.
A kind with no
width of its own starts at its tier default. Each width is clamped on read and written once when a drag ends;
a double click on the handle resets that kind to the tier default (400 or 720).
No drawer expands over the whole column. `drawerSizingOf` reads the tier from
the kind table. The pure rule lives in `drawerLayoutOf` (`drawerGeometry.ts`).

**One push rule.** The drawer uses the content width after both rails and the
reserve of its tier, as defined in [styling.md](../styling.md). Every tier
shrinks before it covers: it pushes at `min(saved, room)` while the room holds
the tier minimum, keeps the saved width for when the window grows, and overlays
only below that minimum. At 1280 a plan pushes at 536, at 1440 at 696. The page
keeps its 464 (560 beside a reader); it never goes lower. The mode reads the
committed width; a drag stops at the available room and never flips the mode.
The centred column slides left into the space beside the drawer; a full-tier
work surface keeps its left edge. `drawerGeometry.test.ts` pins the thresholds;
`regressions/drawer-rule.test.ts` fails a drawer that measures the window, reads
a breakpoint or calls `drawerLayoutOf` or `dockLayoutOf` outside `DrawerColumn`
and the two geometry files, so every
width-dependent drawer (fix run, CI fix, terminal, the rest of `DrawerHost`)
goes through `DrawerColumn`. A drawer that must never push, such as the New
drawer, passes `placement="overlay"` (`drawerPlacement` on `AppShell`): it lies
over the page at its saved width at every column width. `selectDrawerPlacement`
(`store/slices/drawer/`) returns `overlay` for the New drawer and `auto` for every
other kind; the New drawer uses the `reader` tier, so it keeps the reader's saved width. Crossing the threshold
with a drawer open swaps the mode in place and keeps focus in the drawer; if
focus was on the page it moves into the drawer, never to the body.

**Over the page, the drawer container runs the full height of the sheet.**
When even the tools cannot push, every open panel lies over the page from the
right edge together, detail and dock, and the rail stays live. A detail that
floats alone beside pushing tools lies over the page's right edge, left of the
dock, with the same `shadow-xl` (`DrawerDetailGroup` with `isOverPage`). The dock
reveals to the left of the stationary rail through a clip
(`animate-drawer-dock-in`, `duration-base`) and clips back toward it on close
(`animate-drawer-dock-out`, `duration-quick`). These keyframes live in
`apps/desktop/src/styles.css`. Once the exit ends, `useSnapAfterFloat` lands the
aside in the flow at its closed width with no width transition. The
container has no inset: flush with the sheet's top, bottom and right edges, left corners
rounded (`rounded-l-frame`), `shadow-xl` under the whole container (panel and
rail), the same `bg-drawer`; a spacer of the closed width keeps the page where
it was under it (`data-drawer-spacer`). **A floating panel is never modal.**
There is no veil and the page is never `inert`: a click on the page goes to the
page and leaves the panel open, F6 still walks page, detail and tools, and Esc
or the X closes the panel. `regressions/drawer-rule.test.ts` fails a scrim or an
`inert` page in `DrawerColumn`. The floating aside is no overlay for the keys
(`OVERLAY_SELECTOR` leaves it out), so Esc, ⌘W in a terminal and ⌘⇧W still
reach the panels. In the smallest window (1024 by 700) a narrow panel pushes
beside the icon rail and the Browser lies over the page, left of the rail at the
edge. A focused web page keeps a bare Esc (only ⌘ chords leave it, see
[browser.md](../browser.md)), so that Browser closes with ⌘⇧W (File, Close the
Drawer, in the menu bar) or Esc once the keyboard is outside the page
(`DrawerColumnNarrowWindow.test.tsx`).
Closed, the
aside is `DRAWER_GUTTER` plus the rail (0px with no rail) and the rail stays
live; only the panel is `inert`. Opening and closing ease the track's width in
220ms (`DURATION_BASE_MS`, none under reduced motion) with its right edge fixed, and the
centred column slides with it: the card grows leftward from the window edge,
its content held at its final width on that edge so nothing reflows, and the
content fades in once there is room; over the page it slides in 200ms; a new kind in
an open drawer fades its content in 120ms. The detail panel's group
(`data-detail-group`) eases its own width with the same token while the aside
eases the sum, so the page content slides as either panel opens or closes and
the rail stays pinned to the window edge; the motion is a `transition-[width]`
(`duration-200 ease-enter`) behind `motion-safe`, so reduced motion is instant.

**Closing never moves the page behind a drawer.** `DrawerColumn` remembers the
last mode the drawer was open in (`useDrawerExit`). Closed from pushing, the
aside stays in the flow, its width eases to the closed width in 220ms and the
panel keeps a frozen copy of its content that fades in 120ms (`drawer-content-out`);
with nothing laid out or under reduced motion it closes at once. Closed from
over the page, the aside stays out of the flow with no width transition and its
spacer holds the closed width, so the page keeps its width at every frame, and
the panel stays mounted for
`DRAWER_EXIT_MS` (160ms) while it fades and slides 8px right (`drawer-overlay-out`;
only the fade, `drawer-fade-out`, under reduced motion). The exit card is a
frozen copy of the DOM the drawer had, so its escape layers, focus and handlers
are gone the moment it closes (the rail is not part of the copy and never animates; a drawer that holds a `canvas`, `iframe`, `video`, `audio` or `webview`, or more than `DRAWER_EXIT_MAX_ELEMENTS` (2000) elements, is not copied and closes at once with no exit; the copy is taken during the render that closes the drawer, before React commits it, because a host that reads the same store, such as `DrawerHost`, empties itself in that same commit): the aside and the card are `inert` or
`pointer-events-none`, and a click on the page behind
works at once. Reopening during the exit cancels it and shows the drawer as it
stands, without playing the entry again.

**A drawer's up is its back chip, never a trail.** A drawer is page state, not
an address, so it draws no breadcrumb. The drawer that the open one replaced
waits in a back chip that leads the header row (`DrawerFrame` draws
`DrawerBackChip` from what `DrawerHost` hands it through
`DrawerBackChipContext`): an arrow, the kind and the title, such as
**Plan · Add tax to the checkout total** or **Terminal**, at most half the
header wide, the title truncating first (`app/hooks/useSlotBackChip`,
`slotChipLabelOf`). A click opens it and puts the current one in the chip.
While the chip shows, the head draws no back row; without one, a drawer opened
from another drawer keeps its quiet back row (`DrawerBackLink`, the row
`DrawerFrame`'s `back` draws), such as **Back to scripts** on a script run.

Two slots per window. The `drawer`
store slice holds `drawer` and `drawerBack`, each `{ kind, sessionId, payload }`
or null; only Terminal and Browser, the workspace tools, may carry
`sessionId: null`. When one of the two is a workspace tool and the other is
not (`isPairedSlot`), both are on screen: the tool in the dock
(`selectDockDrawer`) and the other in the detail panel (`selectDetailDrawer`,
its session only), with no chip. Opening a panel of either class then replaces
only the panel of its class (`slotAfterOpen`), each panel's X closes only itself
(`closeDrawerEntry`), and a rail button toggles only its own panel
(`toggleDrawer`, `toggleTerminalDock`, `toggleBrowserDock`, `togglePane`).
`DrawerHost` renders one slot (`slot="dock"` or `slot="detail"`; with no slot,
the top of the store, for scenes that draw one panel), or the grid cell its
`DockCellContext` names. Escape and ⌘⇧W close the
newer of the two. When both slots hold the same class, the rules below apply. `openDrawer` puts the request in the slot and what it replaced in
`drawerBack` (`slotAfterOpen`), so a third open drops the oldest from the slot
(a tool still waits in the grid, below); reopening the
drawer in the slot, an artifact on another tab included (`slotKey`), keeps the
chip; a drawer of another session clears it, unless one of the two is a
workspace tool (`sharesSlot`). A second Terminal replaces the first in the
slot and keeps the chip as it was, so hiding Terminal hides the dock and never
brings back an older terminal. Archiving or deleting a session drops a
Terminal or Browser dock opened on it from the slot and the chip
(`slotAfterSessionGone`). `closeDrawer` brings `drawerBack`
back and empties it, so Escape, the X, the trigger pressed again
(`toggleDrawer`), a crashed drawer's leave and ⌘⇧W all walk the same two steps.
`clearDrawer` empties both at once, for a caller whose work moved elsewhere (a
plan approved onto the run page, View transcript,
Write title and goal from linked work); the chip does not come back after it.
A tool keeps its state while it waits: Terminal keeps its shell, Explore its
open folders. A second window has its own store, so its own slot.

**The slice holds a grid of tools beside the slot.** `drawerGrid` keeps every
open tool in at most two columns of two (`DOCK_GRID_CAP` in `packages/ui`, the
dock solver's own cap), the order of use, and the focus: the page, the detail
or one tool. A new tool opens in a new column next to the rail while one is
free, otherwise under the column with fewer panels, the one without Browser
first; a fifth takes the place of the least recently used (`gridAfterOpen`).
There is one panel per kind, so a second Terminal takes the first one's place.
The dock in the slot is always the latest tool of the grid (`settledSlot`): a
tool the slot dropped waits in the grid and comes back when the panel beside
it closes, and closing a tool takes it out of the grid. `focusDrawerPanel`
names the page or the panel's entry, and an entry already replaced or closed
changes nothing. Archiving or deleting a session takes its tools out of the
grid, and `clearDrawer` empties it with the slot. `panelsOf` hands the frame
the dock, the detail, the grid's columns and the focus.

**The frame draws the whole grid.** `useShellRight` reads `shellPanelsOf` (the
grid without the tool whose page is open, the detail only with no studio) and
hands `AppShell` a `dockGrid`: the columns by kind and sizing, the focus as a
key (`page`, `detail` or the tool's kind, `panelFocusKeyOf`) and two writes.
`DockGrid` draws the one `<DrawerHost slot="dock" />` of App once per cell
inside `DockCellContext`, and the host renders that cell's tool
(`selectGridTool`); a studio that hosts the dock gets the same grid through
`ShellDockContext`. One tool keeps the single dock card of before. Two or more
go through `dockLayoutOf` inside `DrawerColumn`: every pane is its own card,
12px apart, in the order page, detail, grid, rail, and the rail stays last
in the dock box on the window edge whether the grid pushes or lies over the
page. Each column has its handle on its left edge. It takes the width the
session saved for its lead tool (`drawerGrid.widths`), else the width its lead
tier had before the update. Two stacked panels start at the solver's share,
50/50 or 58/42 with Browser on top, and a handle between them
(`DockRowHandle`) moves the line: each panel keeps at least 160px, the arrows
step it, a double click goes back to the start. The drag previews on the grid
itself and writes once at the release (`resizeDockRow`, the share under the
pair's kinds in `drawerGrid.splits`); a write for a pair no longer stacked
that way changes nothing.
With two panels or more on screen the focused one draws a `focus-ring` border.
A click or a focus inside a panel or the page names it (`focusShellPanel`,
which writes only when the key changes). F6 and ⇧F6 (`panel.focusNext`,
`panel.focusPrevious`) walk page, detail, then the tools column by column, top
to bottom, and move the keyboard into the panel (`stepPanelFocus`,
`panelFocusRingOf`). ⌘⇧W closes the focused panel (`focusedShellPanelOf`); with
the page focused it closes the top of the slot as before. ``⌃` `` focuses an
open Terminal that is not focused and closes a focused one; the rail button
still opens and closes. A rail button is pressed while its tool is anywhere in
the grid, and a second click closes it (`toggleTerminalDock`,
`toggleBrowserDock`, `toggleDrawer` read `selectGridTool`). When exactly two
tools are open and both shapes push (side by side and stacked), each head
shows a key that turns the pair (`DockPairTurnContext` in `DrawerFrame`,
`turnDockPair` with `turnedDockColumnsOf`); the write names the panel it came
from and does nothing once that panel left the grid. When the page would lose
its minimum side by side the solver stacks the pair and the key hides.
Browser and Terminal share the grid like any tool: a handle drag hides the
Browser page under its cover and places it once at the release
([browser.md](../browser.md#the-pane)), and a Terminal sends only its newest
size, one at a time ([keyboard.md](../features/keyboard.md)).
**The open drawer is part of the
history entry's focus; the chip is not.** A forward move (crumb, places rail, Sessions, Search or run, a child such
as an agent) arrives with it closed; Back and Forward bring it back as it was;
Escape and its X close it in place. The exception is a tool (Ask, Context, Explore,
Scripts, Agents): a forward move that stays in its session keeps it open
(`keepToolDrawer` in `navigate`), so a chip in an answer changes the page beside
it. Terminal, Browser and Monitor belong to the place they were opened in: a
session keeps them on every move inside it and on Back to an entry that had no
drawer (`keptTool`), and leaving it parks them with its grid until you come
back; the Board and the draft keep their own (`dockAfterPlace` in
`applyLocation`). A
tool in the chip stays too: over a reader it comes back into the slot,
under a tool it stays in the chip (`backAfterPlace` in `applyLocation`). Leaving
the session empties both of its session tools, and Back brings the drawer back
like any drawer. A
studio over the session parks a session drawer instead: the slot and the chip keep
it, it stays mounted in the detail slot but hidden and inert (`isDetailParked`
from `useShellRight`), no close key reaches it
(`selectDrawerPanel` is null under a studio), and it shows again, as it was,
when the studio closes. A workspace tool shows beside any studio but its own
page; under its own page it is kept in the store and not mounted. On Tasks,
Chat and Workflows the page's own panel and the dock stay open together: the
page hosts both in its `DrawerColumn`, its panel in the `detail` slot and the
dock, handed down by `AppShell` through `ShellDockContext` when `isDockInStudio`,
in the dock slot beside the rail. Its own key on the studio leaves every studio stacked
over the session and shows it. A reader, an item or a
form never stays, in the slot or in the chip. `app/components/DrawerHost` turns a `kind` into its content, framed
by `DrawerFrame` from `@goodboy/ui`: a header whose 28px row is centred on the band (icon, title, count, at most
one labelled action, close), one divider, a `ScrollFade` body and an optional
`dock`. A body that scrolls itself, such as a chat, passes `scroll="self"` and
fills the frame instead. A new kind adds a variant to `DrawerContent`, a
case to the host and a row to `DRAWER_KINDS` (`store/slices/drawer/drawerKinds.ts`):
its surface (tool, item, reader or form), its tier and the tool pane it lights.
The build fails on a kind with no row, and `drawerKinds.test.ts` matches the rows
to the kinds written in `state.ts`.

The session has no column of its own to fold: a drawer pushes the page while the content
keeps room for the push rule and overlays it when it cannot.

**Header grammar.** The close control always reads `Close`, in every drawer: the
region is already named by its title (`<section aria-label={title}>`), so no
drawer repeats its own name in the label. The one exception is the Context
drawer in its versions view keeps a Close too: the way back to the current view is
the `DrawerFrame` back link under the title (`Back to Summary`), and Escape takes
the same step. A back link is always the arrow (`ArrowLeft`) and steps back; an X
never does. A `DrawerFrame` has no label of its own for the X. The Close button is a 28px target
(`size-7`) with the 14px glyph, and so is every utility in the header (copy,
open on its page); a header holds at most one labelled button (Stop,
Run again, New) and utilities share one icon tone. The count slot
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
A click on the page never closes a drawer. There is one Esc listener, the
stack; a drawer never adds a second one.

**The Ask draft survives.** `askDrafts` in the `ask` slice holds the text of the
composer per thread (`threadId`, or `${sessionId}:new` for a thread that does
not exist yet), in memory only: closing the drawer with Esc, the X or `⌘L`
and opening it again finds the draft, a send that lands clears it, and a send
that fails puts it back.

**A toast never covers a drawer.** The stack is 360px wide with its dismiss
button pinned to the card's top right corner (a 28px target that does not move
with the width of the action) and the action on its own row. Beside a pushing
drawer the stack's right edge is the drawer card's left edge minus the 12px
gutter (`toastRightOf({ mode, drawerWidth, hasNativeView })`, measured from
`[data-drawer-card]` while a toast is on screen); over an overlay drawer it
stays at the right edge above it, except over the browser pane,
whose page draws above every toast, so the stack keeps left of it there too
([browser.md](../browser.md#the-pane)). It still lifts above the Ask
composer and the transcript reply field (`useToastLift`).

**Floating surfaces are one surface.** Menus, popovers, the hover card,
Sessions, the update card and the delete confirm are all
`FLOATING_SURFACE` from `@goodboy/ui` (rounded-lg, `floating-edge`, `bg-floating`,
`shadow-lg`), with no per-site border, fill or shadow. Their widths come from
one scale (`POPOVER_WIDTH_PX`): menus 240 (never under 200), popovers 320 and
384, Sessions 500, toast 360, hover card 320. Every one keeps `SHELL_GUTTER_PX`
from each window edge and caps its height at the room left
([styling.md](../styling.md#a-dialog-is-the-last-resort-not-the-default)).
`regressions/popover-widths.test.ts` counts the off-scale widths a floating
surface declares per file and never lets one grow.

**The update card is never clipped.** It is a `Popover` in the popover layer, 300px wide and never wider than `min(384px, window - 24px)`: a title, one line and the verbs of its state ([release.md](../release.md#auto-update)), no bullets. On the places rail it opens to the right of the Update mark, 8px from it, bottom aligned and 12px from the window edge (`isBesideAnchor`, `useFloatingPlace`); elsewhere it opens from its anchor with the same 12px. It stays away while its anchor is inert (`useIsAnchorInert`) and comes back with it.

**An artifact opens by one rule, from every entrance** (`openArtifactAnywhere`,
`features/plans/`). An artifact of the session you are on opens in the
`artifact-document` drawer beside the page: a plan read from the planner that
wrote it, a plan, report or wireframe row in Activity, a chip in a transcript,
the object menu's **Open** and the palette on a session page. The address does
not change and the page keeps its scroll. From any other page (a Search hit
opened from the Board, from Tasks or from another session) it goes to that
artifact's page on the Artifacts tab, with the artifact selected. On the
Artifacts tab itself a click selects it. `DrawerHost` hands a report or a
wireframe to `ArtifactReadingDrawer`, which shows the report or the wireframe
stage, with **Open full page** as its one header action. Opening another
artifact while one is in the panel replaces it and leaves the back chip to
return to the first; an artifact that was deleted opens the gone state
(`GoneObject`) in the panel, with Close. A pull request opens its
**Conversation** tab from every entrance (Activity, Search, the object menu);
only a search hit that found a comment opens **Comments**. The labels name the
place: **Open in Context**, **Open in Questions**, **Open in Runs**, **Open
pull request**. When Search opens an artifact in the panel, find in view
(`startViewFind`, `scope: 'panel'`) reads the panel body only (`FindSession`
looks inside `[data-drawer-card] [data-find-root]`); anywhere else it reads the
page. Going to
the Artifacts page from a drawer is a command of its own, **Open full page**
(`DrawerFrame` `page`, tooltip Open in Artifacts) in the drawer header. **Open
full page** is the one name for panel to page; **Open page** and **Open full**
are retired (`retired/open.ts`). The `artifact-document` kind
carries `{ artifactId, revision }`; `revision` is `null` for the current
version and a number for an earlier one read from the revisions. It is the one
drawer in the reader tier: it opens at 720px and you drag its edge from 480
to 1000 (a double click resets it to 720), so there is no Expand. The body
stays on the 720 reading measure whatever the width. The header holds the
title, **Copy markdown** and **Open full page** as two 28px icon buttons,
and Close; the second row holds the state chip, `vN`, the parts, **Edit** and
**Run plan**. **Copy markdown** is absent when the plan has no copy action.
Escape closes it. While the planner
revises the plan the body is dimmed and Run plan waits.

Ask is no drawer kind: it is the Ask pane of the session
([session-rail.md](session-rail.md)). The thread on screen lives in the `ask`
slice (`askThreadId` per session, `null` for a fresh thread). `AskPaneBody`
(`features/session/ask/components/AskPane/`) puts the thread in the frame's
`ScrollFade` and the composer in its `dock`. The question bubble
(`UserMessageBubble`) and the Start work button
(`StartWorkFromChatButton`, **Start work from this** in Ask) are the Chat ones, drawn from `shared/components`;
the composer is the same `MessageComposer` (`shared/components`) that
`ChatComposer` wraps, without images, with its model picker in the `model`
slot beside Send. Start work on a
finished answer adds a brief drafted from the thread to this session and opens
Start a run there (`startWorkFromAsk`), with no new session. The questions stay
in the session's `ask` threads and are never listed in the Chat door. Its header is **Ask** and a
**New question** icon button (⌘N while focus is inside the panel, also in ⌘K), with
no session title and no scope chip. The thread follows the end of a reply only while you sit at the bottom
(`useAskFollow`). The rail icon has its own glyph
(`CONCEPT_ICONS.ask`, apart from the Chat door) and reads **Ask this session**
with ⌘L on hover. Reset starts a clean thread (`newAskThread`, `askThreadId` back to `null`,
the next question makes a new chat id) and the old thread stays under **Earlier**,
so nothing is lost and no Undo is needed. It waits while a reply streams. The body starts with
**Right now** (no model call: `askRightNow` over `askDigestOf`, the five
comment words, running agents, open questions and the session cost) and three
suggested questions, under a line that says what Ask is (`Ask this session`); each line's mark is one text line tall, so
it centres on the first line of text even when the line wraps; once a thread has
turns it folds to one row. Then
**Earlier** threads on a fresh thread, then the turns. An answer chip that
targets a page navigates (the drawer stays, see above), except a question: it
opens the question on its address (`openQuestion`), the drawer under **Back to Ask**
(`question` drawer, `from: 'ask'`; Back goes through the history); a chip that targets a
plan or another artifact opens it inside the drawer under **Back to answer**,
and Escape goes back before it closes. Buttons come only from verbs the action
registry offers right now (`askVerb`, `useAskActions`): **Answer: {the question}**
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

The `context` kind carries `{ section, view }`: `section` is `goal`, `decisions`,
`summary` or `explanations` and says which card the pane scrolls to, and `view` is
`current` or `versions` (the old versions of that slot, inside the same drawer,
with Restore; Escape and the **Back to** link under the title leave the view before the
drawer, and Close closes it). The **Context** tool in the session tools toggles it on any page of the
session; ⌘⌥C opens the Context tab instead, and a restored Context panel opens
as that tab (`withoutRemovedPages`). The drawer opens on Goal,
every time, unless the caller names a section (the Activity row of a decision
change opens Decisions). The chip carries a quiet dot, never a count, while the
decisions ledger holds a change you have not marked as read
(`sessions.context_seen_at`, compared with the ledger rows in
`decisionChangesSince`: added, removed and reworded rows, leaving out what you
did yourself and what came and went unseen). Opening or closing the drawer does
not mark anything as read: only **Mark as read** does (`markContextRead`). A
session never looked at starts its baseline the first time it loads, so the
rows it already had never read as new. The last read is taken again from the database
when the drawer opens and when the window gets focus (`loadSessionContextSeen`, called
from `useViewedOnReturn`), and only ever moves forward, so **Mark as read** in one window
clears the marks and the tool dot in the other. The chip shows
a pulsing dot while the summarizer writes and a danger glyph when it failed,
with Retry in the drawer's **Context updates** row. The old addresses `s/{session}/context`
and `context/goal`, `context/decisions`, `context/summary`, and a saved drawer that
carries `tab` instead of `section` (`learned` reads `explanations`), are mapped by
`withoutRemovedPages` to the overview with this drawer open on the matching section;
the four lens kinds `context`, `goal`, `decisions` and `last_output_summary` no longer exist.
The drawer header has one action, **Copy context**, which copies Goal,
Decisions, Summary and Open questions in that order (`shareableContext`).

The drawer sits on the `subtle` panel surface, like every `DrawerFrame`.
The pane is one scroll with Goal, Decisions, Summary and Explanations as
sections (`ContextSection`, no tabs); opening it on a section scrolls there. Each
card has one `⋯` menu, **Edit**, **Versions** and **Change visibility**
(`SlotSourceActions`), and no eye or second button. **Context updates**
(`ContextUpdates`, a head row whose toggle and action slot share one centre line;
the Context tab puts **Copy context** in that slot) sits above the cards and says `Updated 2 min ago`,
`Queued`, `Updating…` or `Couldn't update`; open, it lists the last round
(`summarizerRounds`: when, how many turns or a full pass, model and effort, tokens
and cost, what changed as a comma list of links to the cards, every value on the same
column), **Change model** (Settings, This workspace, Models, scrolled to Step summaries)
and **Update now**. Update now queues a consolidation pass through
`requestContextUpdate`, behind any pass in flight and never beside it;
`summarizerPending` holds the turns waiting and whether a requested update is queued.
The State of the summary heads the tab, above Projects and Linked, as a status box built
like the pull request merge box (`SummaryStatus`): a glyph, a count of blockers or of steps
left (`summaryStatusWordOf`, never a run state word), the first State sentence, one row per
blocker and the other State lines. It is hidden while slots load, fail or show Versions.

Every card reads as labelled blocks (`ContextBlock`: a flat group with an
eyebrow title, an icon and a count). Goal shows its key line first and
folds the rest behind **Show N more** (`KeyLineList` through `ContextExpander`). A Summary
group is a list (`SummaryBlock`): Next an ordered list of steps with the first one tinted,
Learned and the rest a list of facts. Each shows three and folds the rest behind one
**Show all N** in its head (`aria-expanded`); `summaryItems` splits a
body into items, one per top-level bullet with its sub-bullets, or one per
sentence for prose. Summary shows Next and Learned, then any section the summarizer did not
name; State lives in the status box; Open questions are left out
because Needs you already says them, and **Edit** on the card still shows the whole
document. Goal is one block with the card menu in its header, also while it is empty,
loading or being edited (Edit and Versions are off while a draft is open).

The Decisions card reads the decisions ledger ([turns.md](../turns.md#the-decisions-ledger))
as one list. A row that changed since you last read (`selectContextBaseline`: the
`sessionDecisionsBaseline` captured when the drawer opened, else `context_seen_at`, so a
restored drawer, an old address or a search hit shows the marks too) sorts first and carries its own
mark: `Added`, `Replaced by 7`, `Withdrawn` or `Reworded` (`decisionChangeLabelOf`),
and a replaced or withdrawn row stays struck through until you read it. **Mark as
read** in the card header (`MarkContextRead`) moves the marker to the moment of the
click (`markContextRead`, saved before the state changes, so a failure keeps the marks
and reports the error) and clears the marks and the tool dot; a later change brings
them back. Active decisions sort newest first, each with its number, at most two lines of
text, its why as one muted line under the text when the row has one (clamped
to two lines, **Show more** when longer; older rows show nothing), and who
settled it (`Implementer · turn 9 · 1h`, `You · 2h`,
`replaces 5`). A row the summarizer reworded says `Goodboy` and its age with
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

A studio's own panel is not the session drawer. A Tasks
record opens in the studio's `DrawerColumn` beside the list on the reader tier
(`InboxStudioLayout` passes `sizing: 'reader'` through `useStudioDrawer`), with
the same card and motion; a window too narrow for the list and the pane lifts
the pane over the list. Open in the pane header puts the record at the 720
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
`Scroll to latest`. Error lines carry a danger bar and an `err` prefix, and a long token (a path, a
hash) wraps at the edge instead of breaking every word. The status row under the log
says `Following output` while it runs and the exit, time and Copy output after.
`Add to message` sits next to it, while the run is live too, and
hands the log to the session's agent: it queues a text attachment titled
`Output of <script>, <exit>, <project> on <branch>` (`outputHandoffOf`), opens
the session when it is not on screen, and the composer takes it as a chip,
focuses itself and sends nothing, so a running agent is never interrupted. The
same verb is in the right click menu of a Task or Service row (disabled with
`No output yet` until the run printed something), in the terminal's `⋯` menu as
`Send last output`, and as a floating button on a terminal selection. The text
is redacted with `redactSecrets` first and capped to its last 24,000 characters
with a `[truncated: ...]` line on top. An archived session, or one with no
agent, hides the verb. The queue is the `outputHandoffs` store key, per agent;
the composer drops a handoff that lands after it moved to another agent and
keeps it queued for the right one.
A run records the mount it ran in, so a project mounted twice reopens on the
right branch.

`file-diff` (payload `{ source, path }`) peeks at a diff without leaving the
page. The source is a worktree (a file opened from the chat) or a commit (a
GitHub commit link clicked anywhere in a session; outside a session the link
opens in the browser). It shows unified and wrapped, and a worktree peek offers
the Open full page arrow, which opens the Changes tab of the Branch page on that mount with the file in
focus. A changed file in the Explore drawer offers the same arrow, and its `⋯` menu no longer
holds `Open in Files`.
`identifier-peek` (payload `{ worktreePath, word, selected }`, reader width) is
where every result of the identifier popover in a diff opens; the page behind it
does not move. See [session-rail.md](./session-rail.md) for what it shows.
There is no drawer for notes: a note lives on its line in Changes and as a row in
Comments, and `Fix comments` (kind `fix-comments`) is the one fix action. A note
without a branch sits in `Unassigned comments` on the Session overview.

### The grid saved on the session

Each session remembers its dock grid: the panels, the columns, the width of
each tool's column, the height of two stacked panels and the focus. The
heights sit in an optional `splits` field of version 1: a row without it
reads, and an older build reads a row with it and leaves it out. It lives in `session_dock_grids` (m244), one
row per session, deleted with it. The Board and the draft keep a grid of
their own in the window; they save nothing.

- `useSessionDockGrid` (started by `useWindowLayout`) runs
  `watchSessionDockGrid`. It keys on `currentSessionId`.
- Entering a session reads its row (`recallDockGrid`). A row puts its grid in
  place of the open tools (`slotWithGrid`), and a tool of a session that no
  longer exists drops out. Before the row answers, the session shows the grid
  it was left with in this window (`parkedDockGrids`, dropped when the session
  is archived), or no tool. That swap is not a change, so it writes nothing:
  `watchSessionDockGrid` skips a grid that arrives with a new `dockScope`, and
  a window that only passes through a session never writes its row. A Terminal whose tab is gone
  closes itself (`TerminalDrawer`), and the next save leaves it out.
- A row this window has not saved since it loaded comes back without the
  `UNSAVED_DRAWER_KINDS` (`appliedDockGrid`), so Monitor stays closed after a
  reload or a restart. A row it saved in this run brings Monitor back with the
  session (`isSavedThisRun`).
- A change on a session waits 300ms, then `rememberDockGrid` writes it. The
  write names the session the change was made on. Leaving the session writes
  the waiting change at once, still on that session.
- A column handle writes the width on the grid (`resizeDockColumn`), not in
  the shared `goodboy:*-drawer-width:v1` keys. A double click writes the tier
  default. A column with no saved width starts at its tier default; the old
  shared keys stopped seeding it in 0.42.0
  ([versioning.md](../versioning.md#retired-state)). A detail keeps its width
  per kind, so a drag on Ask never changes where a Terminal starts.
- The face of the session (Overview or Desk) rides in the same row as an
  optional `face` field of version 1, written only for the Desk. A change of
  face waits 300ms and saves the row like a change of grid. Entering a session
  reads it back (`recallSessionFace`), a face picked while that read was out
  wins, even one picked away and back (`faceSelections` counts every pick),
  and a session that is not open reads its face the same way. Sessions in the
  top bar reads it for each row whose face the window does not know yet, so a
  row says Desk only for a session that saved it (`useSavedSessionFace`). A move, a reset
  or an undo writes the face with the grid. A row without the field reads as
  Overview, and an older build leaves it out.

| Write or read   | What happens                                                                                                                                                                                                             |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Target          | The session the change was made on, read when it happened.                                                                                                                                                               |
| State change    | The live grid moves at once; the row changes only when the write lands.                                                                                                                                                  |
| Failed save     | The row keeps the grid before it, and `reportError` shows the error on the session. Opening the session again brings that grid back.                                                                                     |
| Retry           | The next change writes the whole grid again.                                                                                                                                                                             |
| Late read       | A row that answers after the window left the session, or after the user opened or closed a tool, is dropped (`dockGridRecalls`).                                                                                         |
| Order           | The writes and the read of one session queue in call order (`dockGridWrites`).                                                                                                                                           |
| Second window   | The last write wins: a write older than the row (`updated_at`) changes nothing. A window that takes the focus writes its waiting change, then reads the row again, so it shows the newer grid and never one panel twice. |
| Deleted session | The row goes with the session; a write for it writes nothing.                                                                                                                                                            |

A move and a reset write the row first and change the grid only after the
write lands (`moveDockPanel`, `resetDockGrid`, through `committedDockGrid`
and `commitAfterConfirm`). Each names the session it writes and holds a
latest-only claim (`dockGridMoves`) that a newer move and a session switch
(`watchSessionDockGrid`) cancel, so a move that lands late changes nothing;
nor does one whose panel already left the grid.
A failed write leaves the panels where they were and `reportError` says
`Couldn't move the panel` or `Couldn't reset the panel layout`. A reset puts
every tool back where it opens and drops the saved widths and heights; its
toast `Panel layout reset` has Undo, which writes the layout before it back
and changes nothing once the panels moved again. On the Board, with no
session, the grid changes and nothing is saved.

Every panel of the dock (Terminal, Browser, Scripts, Ask, Monitor) opens with
the same 40px head (`DockPanelHead` from `@goodboy/ui`, drawn by `DrawerFrame`
with `isDock`): title or tab strip, at most two actions, a menu, Close in the
same place. There is no grip icon. With two panels or more the whole head is
the drag handle and shows a grab cursor (`DockDragContext` from `DockGrid`,
read by `useDockGrip` in `DockPanelHead`, `useDockDrag`); the empty area moves
the whole cell. In a tabbed cell the tab strip takes the title's place in the
head (focus follows the selected tab when the head remounts), and each tab
segment is its own handle for that panel alone (`DockDragSource.onStartPanel`);
a tabbed cell does not move until the move works on the tabs together. A head that is not a
`DockPanelHead` fails `panel-head.test.ts`. The Browser keeps Back, Forward,
Reload, the address and the rest as the first row of its body
(`BrowserAddressRow`), the Terminal its folder picker and worktree strip, and
Monitor its Pin a port action as a pin icon in the head. Branch names that may
share a prefix cut in the middle and keep their last 12 characters
(`midTruncate`, `MidTruncate` in the Scripts groups). A
press becomes a drag after 4px, so a click stays a click, and a press on a
control inside the head, or inside a layer the head portals out (a menu, the
address suggestions), never starts one; Esc cancels through the escape stack and the
pointer up drops. While it drags, `DockDropZones` draws the zones over every
other panel (left, right, above, swap, below) and a strip on the page's edge
(beside the page); a zone that would leave the page worse than now, by the
solver with the real widths (`canDrop` from `useDockGrid`, `dockMoveFits`),
reads `No room` and drops nothing. The zones redraw from a small store at most
once a frame (`dockDragStore`), so the panels themselves render only when the
drag starts and ends. The drag sets `SPLIT_DRAG_ATTRIBUTE` to
`move`, so the Browser page hides under its cover like under a handle drag,
and a drop goes through `moveDockPanel`. From the keyboard, ⌘K lists
`Move Terminal panel…` for each tool when two or more are open
(`dockPanelEntries`); its step holds only the moves that never leave the page
worse than now (`dockMovesOf`, asking the mounted grid's `canDrop` through
`dockFitProbe`: no new float, no new fold, no detail newly over the page). `Reset panel layout` sits in ⌘K while
the layout differs from where the tools open (`gridAtRest`), and in View
(`menu.resetPanels`).

`watchSessionDockGrid.test.ts`, `storedDockGrid.test.ts`,
`session-dock-grid.test.ts` and `restore-previous-build.test.ts` cover each
row.
