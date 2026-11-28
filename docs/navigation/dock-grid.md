# The dock grid

> **Read this when** you change how open tools are laid out in the dock, how a panel is resized, focused, dragged or turned, or how a session saves and restores its grid. **Not for** the drawer slots ([right-drawer.md](right-drawer.md)) or the rail buttons ([session-tools.md](session-tools.md)).

## The grid beside the slot

`drawerGrid` in the `drawer` slice keeps every open tool in at most four columns of
two (`DOCK_GRID_CAP` in `packages/ui`, the solver's cap), the order of use, and the
focus (the page, the detail or one tool).

- The tools are Terminal, Browser, Monitor, Scripts and Ask (`WORKSPACE_TOOL_KINDS`),
  so all five fit; one panel per kind, so a second Terminal takes the first's place.
- A column-kind tool (Terminal, Browser) opens in a new column next to the rail; a
  row-kind tool (Monitor, Scripts, Ask) stacks in one shared column, taking a new
  column when it is full. With every column full a tool opens under the column with
  fewer panels, the one without Browser first; a ninth replaces the least recently
  used (`gridAfterOpen`).
- The dock in the slot is always the grid's latest tool (`settledSlot`): a tool the
  slot dropped waits in the grid and returns when the panel beside it closes, and
  closing a tool removes it from the grid.
- `focusDrawerPanel` names the page or a panel's entry; a replaced or closed entry
  changes nothing.
- Archiving or deleting a session removes its tools, and `clearDrawer` empties the
  grid with the slot. `panelsOf` hands the frame the dock, the detail, the columns and
  the focus.

## The frame draws the whole grid

`useShellRight` reads `shellPanelsOf` (the grid without the tool whose page is open,
the detail only with no studio) and hands `AppShell` a `dockGrid`: the columns by
kind and sizing, the focus as a key (`page`, `detail` or the tool's kind,
`panelFocusKeyOf`) and two writes.

- `DockGrid` draws App's one `<DrawerHost slot="dock" />` once per cell inside
  `DockCellContext`, and the host renders that cell's tool (`selectGridTool`). A
  studio hosting the dock gets the same grid through `ShellDockContext`.
- One tool keeps the single dock card. Two or more go through `dockLayoutOf` in
  `DrawerColumn`: every pane its own card, 12px apart, ordered page, detail, grid,
  rail, with the rail last on the window edge whether the grid pushes or lies over
  the page.

### Sizes

- Each column's handle is on its left edge. A column takes the width the session
  saved for its lead tool (`drawerGrid.widths`), else its lead tier's earlier width.
- Two stacked panels start at the solver's share (50/50, or 58/42 with Browser on
  top), and a handle between them (`DockRowHandle`) moves the line: each keeps at
  least 160px, the arrows step it, a double click resets it. The drag previews on
  the grid and writes once at release (`resizeDockRow`, the share under the pair's
  kinds in `drawerGrid.splits`); a write for a pair no longer stacked that way
  changes nothing.
- A handle drag hides the Browser page under its cover and places it at release
  ([browser.md](../browser.md#the-pane)), and a Terminal sends only its newest size,
  one at a time ([keyboard.md](../features/keyboard.md)).

### Focus

- With two panels or more the focused one draws a `focus-ring` border. A click or a
  focus inside a panel or the page names it (`focusShellPanel`, writing only on a
  change).
- F6 and ⇧F6 (`panel.focusNext`, `panel.focusPrevious`) walk page, detail, then the
  tools column by column, top to bottom, moving the keyboard in (`stepPanelFocus`,
  `panelFocusRingOf`).
- ⌘⇧W closes the focused panel (`focusedShellPanelOf`); with the page focused, the
  top of the slot.
- ``⌃` `` focuses an open, unfocused Terminal and closes a focused one; the rail
  button still opens and closes.
- A rail button is pressed while its tool is anywhere in the grid, and a second
  click closes it (`toggleTerminalDock`, `toggleBrowserDock`, `toggleDrawer` read
  `selectGridTool`).
- **Arranging panels.** A head carries no key that turns a pair. Panels are arranged by
  dragging (`moveDockPanel`). When side by side would cost the page its minimum, the
  solver stacks the pair.

## Panel heads and moving panels

Every dock panel opens with the same 40px head (`DockPanelHead` from `@goodboy/ui`,
drawn by `DrawerFrame` with `isDock`): title or tab strip, at most two actions, a
menu, Close in the same place, no grip icon. A head that is not a `DockPanelHead`
fails `panel-head.test.ts`. The Browser keeps Back, Forward, Reload and the address
as its body's first row (`BrowserAddressRow`), the Terminal its folder chip, shell tabs
and Scripts menu as one row (`DockToolRow`, 36px), and Monitor its Pin a port action as
a pin icon in the head with its summary beside the title and its search as one
`DockToolRow`. A panel has at most one tool row under its head, and a merged slot adds
none: its tabs are the head's.

- **Tabbed cells.** The tab strip takes the title's place (focus follows the
  selected tab when the head remounts), and each tab segment is its own handle for
  that panel (`DockDragSource.onStartPanel`).
  - `DockGridCell.tabs` carries the keys, the active key and the member cells;
    `dockMergedCellOf` folds them into the one pane the solver places.
  - `cellTabsOf` is the one function for the tab count, the strip, the activity
    dots and the shown tab (`data-dock-tab-count`).
  - The shown tab is the focused one, then the last picked, then the cell's
    `active` key; a new `active` from the spec wins. A key that left the grid drops
    out, and a select for it does nothing.
  - The cell's width is saved under its own key, never a member's.
- **Dragging.** With two panels or more the whole head is the handle, with a grab
  cursor (`DockDragContext` from `DockGrid`, `useDockGrip`, `useDockDrag`); the empty
  area moves the whole cell, tabs together. A cell the solver folded for lack of room
  (`isDerived`) drags too, but only the tab you grab: a tab segment moves that tool, and
  the empty head moves the tab shown. The tab leaves the cell as one panel, the solver
  solves the rest again, and a `Merge` on its own cell is never drawn. The ghost and the
  committed move read the same layout (`dockLayoutAfterMove`), so a torn tab lands where
  its pill says (`dockFoldedTear.test.ts`).
  1. A press becomes a drag after 4px, so a click stays a click (the pointer is
     captured only past the 4px, since an early capture sends the click of a tab
     segment to the head and the merged tools cannot be switched); a press on a control
     in the head, or in a layer it portals out (a menu, the address suggestions),
     never starts one.
  2. While dragging, `DockDropZones` draws one floating pill per target (`Place left` and
     `Place right` at the dock edges, `Merge`, `Place above` and `Place below` on the panel under
     the pointer) and one soft outline of the landing slot (`dockGhostOf`). The page is not dimmed.
     A pill is drawn only when the committed layout does what its words say (`dockCardHonestOf`: a
     Place pill leaves the panel alone in that spot, a Merge pill makes it a tab there), and no two
     hit areas overlap (`dockCardsClipOf`). A pill that would change nothing, or that the solver with
     the real widths refuses (`canDrop` from `useDockGrid`, `dockMoveFits`), is not drawn. A pill
     sits at the anchor of its zone (`DockDropZone.anchor`): an above pill sits under the panel head,
     never over its title, and the side pills move to 34% of the height under 440px. A pill never
     straddles the outline (`dockPillPlaceOf`). The pill under the pointer turns solid and the others
     step back; a target takes 80 ms of hover before the outline moves. The outline of a `Merge` is the target panel itself, and the merge keeps the tabs the solver had folded into that panel (`keeps` on the `tab` target), so the result matches the pill's words. The fold line sits inside the outline of the hovered target, and only when something folds. The overlay redraws from a small store at most once a
     frame (`dockDragStore`), so panels render only at drag start and end.
  3. The drag sets `SPLIT_DRAG_ATTRIBUTE` to `move`, so the Browser page hides under
     its cover.
  4. Esc cancels through the escape stack; pointer up drops through `moveDockPanel`.
- **Lifting with the keyboard.** Tab reaches a head (`Move {title}`, a focusable group). Enter or
  Space lifts the cell, or the shown tab of a folded cell; Shift Enter on a tab segment lifts
  that tool alone (`DockDragSource.onLift`, `useDockDrag.lift`). The pills show as in a pointer
  drag, the arrows walk the pills in screen order (`dockZoneStepOf`), Enter drops on the chosen
  card and chooses nothing before one is chosen, Esc cancels (`registerEscapeLayer`), and so
  does the focus leaving the grid. A polite live region says the lift, each card with its place
  in the list and what folds, the drop and the cancel (`data-dock-status`, `data-dock-note`).
  After a drop the focus goes to the head of the moved panel (`focusPanelHead`, through
  `DockGridMove.isKeyboard`).
- **From the palette**, ⌘K lists `Move Terminal panel…` per tool when two or more
  are open (`dockPanelEntries`), with only the moves that never leave the page worse
  (`dockMovesOf`, asking the mounted grid's `canDrop` through `dockFitProbe`: no new
  float, no new fold, no detail newly over the page). `Reset panel layout` is in ⌘K
  while the layout differs from where the tools open (`gridAtRest`), and in View
  (`menu.resetPanels`).

## The grid saved on the session

The window owns which tools are open: the grid stays open from Home to the Board
to a session and back, and no place opens or closes a tool. Each session
remembers the layout of its grid (columns, each tool column's width, the height of
two stacked panels in an optional `splits` field, the tab choice, the focus) in
`session_dock_grids` (m244), one row per session, deleted with it. The Board, Home
and the draft keep the window's grid and save nothing. The row is version 2 since
Scripts and Ask joined; a version 1 row is no longer read and its session opens with the default layout, and a
build that knows only version 1 shows the default layout.

- `useSessionDockGrid` (started by `useWindowLayout`) runs `watchSessionDockGrid`,
  keyed on `currentSessionId`.
- **Changing place** keeps the grid (`dockAfterPlace`) and binds each panel to the
  place entered (`reboundDockGrid`): a session id inside a session, none on Home, the
  Board and the draft. A Terminal stays when its tab is a shell of the workspace or of
  the session entered; otherwise it shows the workspace shell, or closes when the
  workspace has none. A panel of a session that no longer exists drops out
  (`slotWithGrid`).
- **Entering a session** reads its row (`recallDockGrid`) and lays the saved sizes,
  splits, columns and tab choice onto the tools already open (`layoutOntoGrid`). The row
  never opens a tool and never closes one, so a row saved with other tools changes
  nothing but the layout. That swap is not a change: `watchSessionDockGrid` skips a
  grid arriving with a new `dockScope`, so a window passing through never writes the
  row. A Terminal whose tab is gone closes itself (`TerminalDrawer`) and the next save
  leaves it out.
- **A change** waits 300ms, then `rememberDockGrid` writes it, naming the session it
  was made on; leaving the session writes the waiting change at once, still on it.
- A column handle writes the width on the grid (`resizeDockColumn`), not the old
  shared `goodboy:*-drawer-width:v1` keys, which stopped seeding a column in 0.42.0
  ([versioning.md](../versioning.md#retired-state)). A double click writes the tier
  default, and a column with no saved width starts there. A detail keeps its width
  per kind, so a drag on Ask never moves a Terminal.
- **No face is saved.** The row has no `face` and no `detail`: a
  row an older build wrote with them reads as a plain layout, and the next save leaves
  them out. An older build reads a row without them as the Overview.

| Write or read   | What happens                                                                                                                                                                                                 |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Target          | The session the change was made on, read when it happened.                                                                                                                                                   |
| State change    | The live grid moves at once; the row changes only when the write lands.                                                                                                                                      |
| Failed save     | The row keeps the grid before it, and `reportError` shows the error on the session. Opening the session again brings that grid back.                                                                         |
| Retry           | The next change writes the whole grid again.                                                                                                                                                                 |
| Late read       | A row that answers after the window left the session, or after the user opened or closed a tool, is dropped (`dockGridRecalls`).                                                                             |
| Order           | The writes and the read of one session queue in call order (`dockGridWrites`).                                                                                                                               |
| Second window   | The last write wins: a write older than the row (`updated_at`) changes nothing. A window taking focus writes its waiting change, then rereads the row, so it shows the newer grid and never one panel twice. |
| Deleted session | The row goes with the session; a write for it writes nothing.                                                                                                                                                |

### Move and reset

A move and a reset write the row first and change the grid only after the write
lands (`moveDockPanel`, `resetDockGrid`, through `committedDockGrid` and
`commitAfterConfirm`).

- Each names its session and holds a latest-only claim (`dockGridMoves`) that a newer
  move and a session switch (`watchSessionDockGrid`) cancel, so a late move changes
  nothing, nor one whose panel already left.
- A failed write leaves the panels and `reportError` says `Couldn't move the panel`
  or `Couldn't reset the panel layout`.
- A reset puts every tool back where it opens and drops the saved widths and
  heights; its toast `Panel layout reset` has Undo, which writes the earlier layout
  back and changes nothing once the panels moved again.
- On the Board, with no session, the grid changes and nothing is saved.

`watchSessionDockGrid.test.ts`, `storedDockGrid.test.ts`, `session-dock-grid.test.ts`
and `restore-previous-build.test.ts` cover each row.
