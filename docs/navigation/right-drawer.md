# The right drawer

> **Read this when** you change the drawer containers, a drawer's width or tier, when it pushes or lies over the page, its two slots, its header, focus and Esc, or a floating surface near it. **Not for** the grid of open tools ([dock-grid.md](dock-grid.md)), what one kind shows ([drawer-kinds.md](drawer-kinds.md)) or a parked drawer ([surfaces.md](surfaces.md#the-dock-follows-the-page)).

Every drawer is one primitive, `DrawerColumn` from `@goodboy/ui`, never a split
inside a pane. `AppShell` puts one beside the page container, and a studio body one
beside its list. A drawer pushes the page while the push rule leaves room and lies
over it when it cannot.

## Containers

- **Two containers, never a panel inside the content.** The page container is the
  sheet (`bg-background`, its 1px `frame-edge` border, `data-container="page"`); the
  drawer container is its sibling (`data-container="drawer"`), each with its own
  size, from the same top to the same bottom.
- With no drawer the page container is the plain sheet, rounded on the left and
  flush with the window's right edge. Wherever the tool rail is (every page) the
  page container rounds all four corners (`rounded-frame`) and the drawer container
  stands 12px to its right (the resize handle in the gap), flush right and rounded on
  its left corners; the pair keeps a 12px inset above the bottom edge.
  `DRAWER_GUTTER` in `packages/ui/src/drawerGeometry.ts` takes `SHELL_GUTTER_PX`.
- The drawer container is one step quieter than the page (`bg-drawer`, between
  chrome and background in both themes): never louder, never tinted, never a border
  to fake the difference.

### The rail is the anchor

The drawer container holds the dock and the rail on one surface. `DrawerDockBox`
puts the rail last (`data-drawer-edge`, through `DrawerEdgeContext`), pinned to the
window's right edge. Closed, the container is the rail alone (`TOOL_RAIL_WIDTH_PX`,
[session-tools.md](session-tools.md)). The rail stays still while a panel opens,
closes or resizes, so its button stays under the pointer.

### Two panels, one order

Left to right: places rail, page content, detail panel, tool dock, tool rail.

- **The tool dock** (Terminal, Browser, Monitor) is attached to the rail with no
  gap, line or radius, on the rail's `bg-drawer`, one surface to the window edge.
  The resize handle sits between the detail (or the page) and the dock.
- **A detail panel** (an artifact, Scripts, Ask, a plan part, a check analysis, a
  transcript, a reader, every other kind) is its own container between page and
  dock: `data-container="detail"`, `rounded-frame`, `frame-edge`, on the page's
  `bg-background`, 12px from page and drawer container, with its own handle.
- Both can be open at once. `DrawerColumn` takes the dock as `drawer` and the detail
  as `detail` (`detailSizing`, `detailKind`, `isDetailParked`).
- A `DrawerFrame` paints `bg-panel-surface`, the surface its container names
  (`panel-on-page`, `panel-on-rail`), and its pinned header frosts it
  (`sticky-surface-panel`).

One solver, `dockLayoutOf` in `dockLayout.ts`, lays out every combination, the
detail as a lane:

1. push at the saved widths;
2. shrink toward the minimums (browser, reader, then side);
3. let the detail alone lie over the page while the tools keep pushing
   (`isDetailOver`, `data-detail-over`);
4. when even the tools cannot push, every panel lies over the page.

`panelAsideWidthOf` is the aside: the detail plus its gutter while it pushes, then
the dock, the rail and their gutter.

### Studios host the same container

`AppShell` hosts the drawer with `frame="sheet"`. Tasks and Chat register their
drawer with the `StudioFrame` (`useStudioDrawer`), which draws one `DrawerColumn`
with `frame="sheet"` around the band and the body, so the band and the list are the
page container; the shell's own sheet steps aside (`data-studio-sheet-owner`). A
studio body with no hosting frame (a mock scene) keeps `frame="none"`: a 12px top
and bottom inset while it pushes, the right edge flush.

## Widths

| Tier    | Kinds                                                                                | Opens at | Resizes                                                                                                       |
| ------- | ------------------------------------------------------------------------------------ | -------- | ------------------------------------------------------------------------------------------------------------- |
| side    | Ask, Context, a fix run or agent transcript, script output, a plan part, an artifact | 400px    | 384 to 560px                                                                                                  |
| reader  | the plan, report and wireframe document, an Explore file, a file diff                | 720px    | 480 to `min(1000, room)` pushing; over the page, the room left after two gutters and the rail, capped at 1000 |
| browser | the browser pane                                                                     | 720px    | 480 to `room` pushing, no 1000 cap                                                                            |

- A tool keeps its width on the session grid ([dock-grid.md](dock-grid.md)).
- A detail keeps its width per kind everywhere, `goodboy:detail-width:<kind>:v1`
  (`detailWidthKeyOf`, `useDetailWidth`; a studio's own panel uses
  `studio-<kind>`), so widening Ask never moves Context or a Terminal. An artifact
  and an artifact document keep one width per artifact, `<kind>:<artifactId>`
  (`detailWidthIdOf`).
- A closing detail keeps the width it showed. A kind with no width starts at its
  tier default. A width is clamped on read and written once when a drag ends; a
  double click resets the kind to the tier default (400 or 720). No drawer expands
  over the whole column.
- `drawerSizingOf` reads the tier from the kind table; the pure rule is
  `drawerLayoutOf` (`drawerGeometry.ts`).

### One push rule

The drawer uses the content width after both rails and its tier's reserve
([styling.md](../styling.md)).

- Every tier shrinks before it covers: it pushes at `min(saved, room)` while the
  room holds the tier minimum, keeps the saved width for when the window grows, and
  lies over the page only below that. At 1280 a plan pushes at 536, at 1440 at 696.
- The page keeps 464 (560 beside a reader), never less.
- The mode reads the committed width; a drag stops at the room and never flips the
  mode.
- The centred column slides left beside the drawer; a full-tier work surface keeps
  its left edge.
- A drawer that must never push, the New drawer, passes `placement="overlay"`
  (`drawerPlacement` on `AppShell`) and lies over the page at its saved width.
  `selectDrawerPlacement` (`store/slices/drawer/`) returns `overlay` for it and
  `auto` for every other kind; it uses the `reader` tier and keeps the reader width.
- Crossing the threshold with a drawer open swaps the mode in place and keeps focus
  in the drawer; focus on the page moves into the drawer, never to the body.

## Over the page and closing

When even the tools cannot push, every open panel lies over the page from the right
edge together, and the rail stays live.

- A detail floating alone beside pushing tools lies over the page's right edge,
  left of the dock, with the same `shadow-xl` (`DrawerDetailGroup` `isOverPage`).
- The container has no inset: flush with the sheet's top, bottom and right, left
  corners rounded (`rounded-l-frame`), `shadow-xl` under panel and rail, the same
  `bg-drawer`. A spacer of the closed width keeps the page in place
  (`data-drawer-spacer`).
- **A floating panel is never modal.** No veil, never an `inert` page: a click on
  the page goes to the page and leaves the panel open, F6 still walks page, detail
  and tools, and Esc or the X closes the panel. The floating aside is not an overlay
  for the keys (`OVERLAY_SELECTOR` leaves it out), so Esc, ⌘W in a terminal and ⌘⇧W
  still reach the panels.
- In the smallest window (1024 by 700) a narrow panel pushes beside the icon rail
  and the Browser lies over the page. A focused web page keeps a bare Esc
  ([browser.md](../browser.md)), so that Browser closes with ⌘⇧W or Esc outside the
  page (`DrawerColumnNarrowWindow.test.tsx`).

### Motion

- Closed, the aside is `DRAWER_GUTTER` plus the rail (0px with no rail); only the
  panel is `inert`.
- Opening and closing ease the track's width in 220ms (`DURATION_BASE_MS`, none
  under reduced motion), right edge fixed: the card grows leftward, its content held
  at its final width so nothing reflows, and fades in once there is room. Over the
  page it slides in 200ms; a new kind in an open drawer fades in 120ms.
- The dock reveals left of the still rail through a clip (`animate-drawer-dock-in`,
  `duration-base`) and clips back on close (`animate-drawer-dock-out`,
  `duration-quick`), keyframes in `apps/desktop/src/styles.css`.
  `useSnapAfterFloat` then lands the aside in the flow at its closed width with no
  transition.
- The detail group (`data-detail-group`) eases its own width while the aside eases
  the sum (`transition-[width]`, `duration-200 ease-enter`, behind `motion-safe`).

### Closing never moves the page

`DrawerColumn` remembers the last open mode (`useDrawerExit`).

- **Closed from pushing**, the aside stays in the flow, eases to the closed width in
  220ms, and the panel keeps a frozen copy of its content (`drawer-content-out`,
  120ms). With nothing laid out or under reduced motion it closes at once.
- **Closed from over the page**, the aside stays out of the flow with no width
  transition, its spacer holding the closed width, and the panel stays mounted for
  `DRAWER_EXIT_MS` (160ms) while it fades and slides 8px right (`drawer-overlay-out`;
  only `drawer-fade-out` under reduced motion).
- The exit card is a frozen DOM copy, so its escape layers, focus and handlers are
  gone the moment it closes; the aside and card are `inert` or
  `pointer-events-none`, so a click behind works at once. The copy is taken during
  the render that closes the drawer, before React commits it, because a host that
  reads the same store (`DrawerHost`) empties itself in that commit. The rail is not
  copied and never animates.
- A drawer holding a `canvas`, `iframe`, `video`, `audio` or `webview`, or more than
  `DRAWER_EXIT_MAX_ELEMENTS` (2000) elements, closes at once with no exit.
- Reopening during the exit cancels it and shows the drawer as it stands.

## Slots

### A drawer keeps no trail

A drawer is page state, not an address, so it draws no breadcrumb and no back
button for the drawer it replaced. A dock head shows its tab strip and Close, never
a leftover back button. A drawer reached from another keeps its quiet back row
(`DrawerBackLink`, `DrawerFrame`'s `back`) only when it steps inside one panel or
opens a named place, such as **Back to answer** inside Ask, **Back to scripts** on a
script run or **Back to comment** on Fix comments.

### Two slots per window

The `drawer` slice holds `drawer` and `drawerBack`, each `{ kind, sessionId,
payload }` or null. Only Terminal and Browser, the workspace tools, may carry
`sessionId: null`. A second window has its own store and slot.

`drawerBack` holds only the other half of a pair on screen: a workspace tool beside
a reader, or the agent beside the pull request on the Desk (`heldBack`, applied in
`settledSlot`). Anything else the slot replaced is gone, and a tool still waits in
the grid.

**Different classes are both on screen.** When one is a workspace tool and the other
is not (`isPairedSlot`), the tool shows in the dock (`selectDockDrawer`) and the
other in the detail (`selectDetailDrawer`, its session only).

- An open replaces only the panel of its class (`slotAfterOpen`); each X closes only
  itself (`closeDrawerEntry`); a rail button toggles only its own panel
  (`toggleDrawer`, `toggleTerminalDock`, `toggleBrowserDock`, `togglePane`).
- Escape and ⌘⇧W close the newer of the two.
- `DrawerHost` renders one slot (`slot="dock"` or `slot="detail"`; with no slot, the
  top of the store, for scenes), or the grid cell its `DockCellContext` names.

**The same class shares the slot.**

1. `openDrawer` puts the request in the slot and drops what it replaced.
2. Reopening the drawer in the slot, an artifact on another tab included
   (`slotKey`), keeps the slot as it is. A drawer of another session clears the
   other half, unless one of the two is a workspace tool (`sharesSlot`).
3. A second Terminal replaces the first, so hiding Terminal never brings back an
   older terminal.
4. `closeDrawer` closes the top; the other half of a pair stays shown.
5. `clearDrawer` empties both, for a caller whose work moved elsewhere (a plan
   approved onto the run page, View transcript, Write title and goal from linked
   work).

Archiving or deleting a session drops its Terminal or Browser dock from the slot
(`slotAfterSessionGone`). A waiting tool keeps its state: Terminal its shell,
Explore its open folders.

### The drawer is part of the entry's focus

- A forward move (crumb, places rail, Sessions, Search or run, a child such as an
  agent) arrives with the drawer closed; Back and Forward bring it back; Escape and
  the X close it in place.
- A tool (Ask, Context, Explore, Scripts, Agents) stays open on a forward move that
  stays in its session (`keepToolDrawer` in `navigate`), so a chip in an answer
  changes the page beside it.
- Terminal, Browser and Monitor belong to their place
  ([surfaces.md](surfaces.md#the-dock-follows-the-page)): kept on Back to an entry
  with no drawer (`keptTool`), parked with the grid when you leave, and the Board and
  the draft keep their own (`dockAfterPlace` in `applyLocation`).
- A tool beside a reader stays too (`backAfterPlace`). Leaving the session empties
  both of its session tools; Back brings the drawer back.
- A reader, an item or a form never stays. A studio over the session parks a session
  drawer in the detail slot (`isDetailParked` from `useShellRight`).

### Kinds and the host

`app/components/DrawerHost` turns a `kind` into content framed by `DrawerFrame`: a
header whose 28px row is centred on the band (icon, title, count, at most one
labelled action, close), one divider, a `ScrollFade` body and an optional `dock`. A
body that scrolls itself (a chat) passes `scroll="self"`.

A new kind adds a variant to `DrawerContent`, a case to the host, and a row to
`DRAWER_KINDS` (`store/slices/drawer/drawerKinds.ts`): its surface (tool, item,
reader or form), its tier and the tool pane it lights. The build fails on a kind
with no row, and `drawerKinds.test.ts` matches the rows to the kinds in `state.ts`.

## Header, dock, focus

- **Close always reads `Close`**: the region is named by its title (`<section
aria-label={title}>`), so no drawer repeats its name, and a `DrawerFrame` has no
  label of its own for the X. A back link is always the arrow (`ArrowLeft`) and
  steps back; an X never does. The Context drawer in its versions view keeps Close,
  with `Back to Summary` under the title, and Escape takes that step.
- Close is a 28px target (`size-7`) with the 14px glyph, like every header utility
  (copy, open on its page). A header holds at most one labelled button (Stop, Run
  again, New); utilities share one icon tone. The count slot holds a count or a
  version, never the session title: Ask's header reads `Ask`.
- **One dock, one padding.** The `dock` slot is `px-4 py-3` and holds the one
  control under the body (the Ask composer, a transcript's reply field, a script
  run's status line). No drawer pads its own composer; `TranscriptReplyDock` only
  measures it for the toast lift.
- **Focus on open.** The composer when the dock holds a text field (Ask, a writable
  transcript), else the panel itself (`DrawerFrame` section, `tabIndex` -1, no
  ring), never `Close`, whose tooltip would cover the top bar. Whatever the body
  focused first is left alone.
- **Focus on close** returns to the opener. When a shortcut opened the drawer from
  the page body (`⌘L`, `F`), it returns to the last real control that had focus
  (`lastFocusedElement` in `packages/ui`, updated on `focusin`, never the body).
- **Esc in two steps.** In a focused, non-empty text field the first Esc only blurs
  and keeps the draft; the next Esc (or the first otherwise) closes. A page click
  never closes a drawer. There is one Esc listener, the stack.

## Toasts and floating surfaces

### A toast never covers a drawer

The stack is 360px wide, its dismiss button pinned to the card's top right (a 28px
target that does not move with the action's width), the action on its own row.

- Beside a pushing drawer its right edge is the drawer card's left edge minus 12px
  (`toastRightOf({ mode, drawerWidth, hasNativeView })`, measured from
  `[data-drawer-card]` while a toast shows).
- Over an overlay drawer it stays at the right edge above it, except over the
  browser pane, whose page draws above every toast, so the stack keeps left of it
  ([browser.md](../browser.md#the-pane)).
- It lifts above the Ask composer and the transcript reply field (`useToastLift`).

### Floating surfaces

Menus, popovers, the hover card, Sessions, the update card and the delete confirm
are all `FLOATING_SURFACE` from `@goodboy/ui` (rounded-lg, `floating-edge`,
`bg-floating`, `shadow-lg`), with no per-site border, fill or shadow.

- Widths come from one scale (`POPOVER_WIDTH_PX`): menus 240 (never under 200),
  popovers 320 and 384, Sessions 500, toast 360, hover card 320.
- Each keeps `SHELL_GUTTER_PX` from every window edge and caps its height at the
  room left ([styling.md](../styling.md#a-dialog-is-the-last-resort-not-the-default)).
- **The update card is never clipped**: a `Popover` in the popover layer, 300px and
  never wider than `min(384px, window - 24px)`, a title, one line and its state's
  verbs ([release.md](../release.md#auto-update)), no bullets. On the places rail it
  opens right of the Update mark, 8px from it, bottom aligned and 12px from the
  edge (`isBesideAnchor`, `useFloatingPlace`); elsewhere from its anchor with the
  same 12px. It stays away while its anchor is inert (`useIsAnchorInert`).

## Tests

- `drawerGeometry.test.ts` pins the thresholds.
- `regressions/drawer-rule.test.ts` fails a drawer that measures the window, reads a
  breakpoint or calls `drawerLayoutOf` or `dockLayoutOf` outside `DrawerColumn` and
  the two geometry files, and a scrim or an `inert` page in `DrawerColumn`.
- `regressions/popover-widths.test.ts` counts off-scale floating widths per file and
  never lets one grow.
