# Styling

> **Read this when** implementing spacing, radius, scroll, overlay or z-index
> in code. **Not for** which tokens exist (`packages/ui/DESIGN-SYSTEM.md`) or
> which surface should exist in the IA (`docs/navigation.md`).

This file covers the mechanics: how this codebase writes spacing, radius,
scroll, overlays and z-index. The values themselves are a token registry and
live in [packages/ui/DESIGN-SYSTEM.md](../packages/ui/DESIGN-SYSTEM.md).

One ownership rule runs through all of it. The container decides spacing once.
The things being spaced never add their own.

## Separation: `gap`, never margin or `space-y/x`

The space between siblings belongs to the parent, set once with `gap`. Margins
and `space-y/x-*` are forbidden for separation. They spread the decision across
the children, they collapse in ways you cannot predict, and they are
asymmetric. Using padding as a spacer is the same mistake under a different
name.

```tsx
// good: parent owns the rhythm
<div className="flex flex-col gap-4">
  <Title />
  <Tags />
  <Actions />
</div>

// bad: margins on children
<div>
  <Title className="mb-4" />
  <Tags className="mb-4" />
  <Actions />
</div>

// bad: space-y is margin under the hood
<div className="space-y-4">...</div>
```

The semantic scale picks which `gap` to use, not the component. The mapping
lives in [DESIGN-SYSTEM.md](../packages/ui/DESIGN-SYSTEM.md)'s gap table.
Never an arbitrary value.

## Padding is for surface insets only

Padding is allowed only as the inner inset of a surface: inside a card, a
banner, an input, or a button's click area. Never as space between siblings.
Keep insets compact: `p-3` for dense list rows, `p-4` for standard cards and
banners, `p-5` for a hero surface. `p-6` and larger make a card feel emptier
than its content deserves.

## Edge insets belong to the host, not the child

The space between a hosted component and the pane edge, on all four sides,
belongs to the host wrapper. If a child adds its own `pb-*`/`px-*` to reach the
edge, it makes a layout decision that is not its to make. It breaks as soon as
that child is placed somewhere else.

```tsx
// good: host owns the edge inset on every side; child just draws
<div className="shrink-0 px-4 pt-10">{/* header zone */}</div>
<main className="flex min-h-0 flex-1 flex-col gap-6 px-4 pb-10">
  <RouteView />
</main>

// bad: child pads its own bottom against the edge
<main className="flex min-h-0 flex-1 flex-col px-4">
  <ScrollFade className="min-h-0 flex-1 pb-10">{/* child owns edge inset */}</ScrollFade>
</main>
```

For a scroll region, the host adds padding around the `ScrollFade`. That way
the extra space at the end sits below the scroller, not inside it.

## Radius and type: pick from the scale, never inline a value

Radius comes from the scale and is never written inline. The mapping and
values are in [DESIGN-SYSTEM.md](../packages/ui/DESIGN-SYSTEM.md#radius-scale)'s
radius table.

Type takes a role (`text-row`, `text-body`, `text-label`, `text-meta`,
`text-chip` and the rest), never a size, a weight, a leading and a tracking
written one by one. Spacing takes whole steps of the 4px grid, never a half
step. The roles and the ratchets that count the raw classes and the half steps
are in [DESIGN-SYSTEM.md](../packages/ui/DESIGN-SYSTEM.md#type-scale).

Four more scales are ratcheted to zero by `scale-rules.test.ts` and
`row-heights-on-the-scale.test.ts`: an icon is `ICON_SIZE.mark`, `row`, `control`
or `hero` (10, 12, 14, 18), never a number; a gap is 4, 8, 12, 16, 24 or 32px
(`gap-1`, `gap-2`, `gap-3`, `gap-4`, `gap-6`, `gap-8`, plus `gap-0.5`), never
`gap-5`, `gap-7` or `gap-10`; a one-line row is 24, 28, 32, 36, 40 or 48px high;
`font-mono` is code (a branch, a path, a command, a sha), and a number is sans
with `tabular-nums`. Text colour follows `TEXT_ROLE` (label, secondary, hint,
disabled). See [DESIGN-SYSTEM.md](../packages/ui/DESIGN-SYSTEM.md#icon-ladder-and-row-scale).

`no-token-bypass.test.ts` rejects any `text-[Npx]`, a display grade above `2xl`,
`font-bold`, `rounded-xs` or `rounded-xl` and up, and an arbitrary `shadow-[`.
The one standing exception for size is relative `em` sizing
inside prose and markdown rendering. There the size is meant to scale with a
parent whose size changes from place to place.

## Surfaces and borders: pick the role, never a shade

A surface takes the role it plays on the six-step ladder (`chrome`,
`background`, `subtle`, `muted`, `elevated`, `floating`), anything inside a
parent takes `fill`, and a grey "not yet" mark takes `idle`. Borders pick one of
three jobs: `border-soft` decorates, `border` delineates a control, and
`border-strong` emphasises a control on hover. The roles, the light-mode axes
and the contrast floors are in
[DESIGN-SYSTEM.md](../packages/ui/DESIGN-SYSTEM.md#surface-ladder). A colour
class with no `--color-*` token behind it fails `no-token-bypass.test.ts`.

`bg-chrome` is the app frame and nothing else. `AppShell` paints the window
once with `bg-backdrop` (chrome plus the `--app-backdrop` glow), and the top bar
and the left column stay transparent on it, so one field runs behind both. The
main pane stays on `bg-background`, one step in front, and every panel and
drawer stays flat. `no-token-bypass.test.ts` fails a `bg-chrome` anywhere else
and a `bg-backdrop` outside `AppShell` (the c02 levels scene, which draws the
shell without it, is the one exception). `--app-backdrop-strength` defaults to
3 (percent of `primary`); light mode multiplies it by
`--app-backdrop-scale: 2.5`, because the same percent is invisible on the near-white
chrome. `index.html` carries the light cover as a literal 15% and
`boot-shell-paints-the-chrome.test.ts` fails if it drifts from the scale.

## The window grid

Columns, resize handles and the studio slot
are areas of **one** CSS grid. Their
widths are saved, and clamped when read back. They are never nested flex
containers. So hiding or resizing a column is one template declaration, and
nothing inside it needs to know. [navigation.md](navigation.md) owns which
columns exist and what each one may do.

Top bar and left column are one chrome field, and the page container is a
**sheet** on it (`SHEET_CLASSES` in `packages/ui/src/sheet.ts`, drawn by
`DrawerColumn` with `frame="sheet"`; `AppShell`'s `main` is the grid cell it
sits in). A sheet corner rounds only
where the chrome wraps it on two sides: with the sidebar, the top-left and
bottom-left corners take `rounded-frame` (10px) and one uniform 1px
`frame-edge` border runs along the top, left and bottom; the right side meets
the window square. With no sidebar, or while it is hidden, the sheet has no
radius and only a top and bottom edge. The left resize handle draws no line at
rest: on hover and drag its `data-left-resize` state turns the sheet's left
edge to `border` in 120ms, so the sheet edge is the handle. A studio follows
the same rule: `StudioRailLayout` puts its rail on the chrome and its detail on
a wrapped sheet, and a studio without a rail is a flush sheet.

The top bar is drawn outside the window grid. Its centred layout uses two
equal flexible outer columns around the command center. Page breadcrumbs stay
in the content column of the pane that owns them and do not set the top bar's
size.

The sheet is drawn by `DrawerColumn`, not by `main`: `AppShell`'s `main` is a
plain grid cell and `DrawerColumn` with `frame="sheet"` draws the page
container (`data-container="page"`, the sheet shape above) and, beside it, the
drawer container (`data-container="drawer"`), 0px wide while closed. While a
drawer pushes, the page container rounds all four corners and the drawer
container stands 8px to its right and 8px from the window's right edge, both
with `frame-edge` and `rounded-frame`; the drawer container takes `bg-drawer`,
one step quieter than `bg-background`. Pushing, its aside is the container
width plus two 8px insets; over the page it is the container width plus the 8px
handle gutter, because the container is flush with the window's right edge. It
opens beside the page: the pane gives up the drawer's track and the centred
column slides left to re-centre in what is left of it (see The content
column). The drawer pushes only while the page container keeps 560px plus its
48px of gutters and the room covers the drawer's saved width. That is the one
breakpoint of the drawer, named `DRAWER_PUSH_RESERVE` (624: 560, 48 and the
two 8px insets) in `drawerGeometry.ts`: a column at least the reserve plus the
drawer's width pushes (1024 for a side drawer at 400, 1344 for a reader at
720), and nothing else in the app measures a width to choose; below that it
lies over the page, full height, with a scrim and an `inert` page, never
squeezed. While it lies over the page, `DrawerColumn` draws an edge host
(`data-drawer-edge`) at the right edge above the scrim and hands it to the page
through `DrawerEdgeContext`; the session tools column portals a live copy there
(`SessionFrame`), and the card sits left of it, so a tool can still switch or
close the drawer. The host is measured after every commit (and by a
`ResizeObserver` after that), and `drawerLayoutOf` takes its width as
`edgeWidth`: the overlay card plus the column always fit in the sheet, so the
column never covers the card's primary or its Close. `sizing` on `DrawerColumn` is `side` (400, drag 384 to 560), `reader`
(720, drag 480 to 1000) or `full` (the whole column, always over the page); each
tier has its own saved width and a handle. `placement="overlay"` skips the push
rule for a drawer that always lies over the page; the thresholds (1024 for
`side`, 1344 for `reader`) are pinned by `drawerGeometry.test.ts`. The pure geometry lives in
`packages/ui/src/drawerGeometry.ts` (`drawerLayoutOf`, with `drawerWidthOf`,
`drawerModeOf` and `mainWidthOf` on top of it) and `drawerGeometry.test.ts`
sweeps every main from 600 to 2400 and runs a width matrix: 1024, 1440 and
1920 windows at zoom 0.8, 1 and 1.25, default and widest sidebar.
`selectDrawerSizing.test.ts` takes every drawer kind at 1280 and 1440 and
checks the pushing card ends 8px inside the aside and the overlay card ends on
the column edge. A pushing card grows from the window's right edge: the aside
eases its width with its right edge fixed (`justify-end`, `overflow-clip`, so a
field focused while it opens cannot scroll the track), the card follows it with
its border and corners in view, and the content keeps its final width
(`--goodboy-drawer-track` minus the 18px of handle gutter, inset and border)
pinned to the right edge and fades in once there is room (`drawer-content-in`).
Closing, the card keeps a copy of its content for `FOLD_MS` (220ms) while the
width eases to 0 and the copy fades (`drawer-content-out`). `drawer-overlay-in`
slides at most the 8px inset; the overlay card starts that far outside the
sheet and is clipped by it. `drawer-overlay-out` and `drawer-fade-out` run
`DRAWER_EXIT_MS` (160ms) while `useDrawerExit` keeps the overlay card mounted
after a close. `DrawerColumn.test.tsx` pins the structure that math assumes (the two
containers as siblings, an 8px `w-2` handle gutter, the track's `pr-2`, the
overlay container's `rounded-l-frame` and `border-l`, the overlay track's min
width, the push track variable).
[navigation.md](navigation.md#the-right-drawer) owns what goes in it.

**A fold never re-centres an icon.** The main sidebar (⌘B) and the session
rail fold through `FoldLayers` (`packages/ui/src/components/FoldLayers.tsx`):
the grid column or the rail width eases in 220ms, the open layer keeps its full
width pinned to the left edge and clipped, so no label wraps or truncates anew,
and its words fade over the icon layer, which draws each icon at its open row's
x and y. Unfolding fades the words in after 60ms. A level drill in the session
rail slides a copy of the leaving level out and the new level in, 24px each,
from the drill side (`LevelStack`). Tokens and timings are in
[DESIGN-SYSTEM.md](../packages/ui/DESIGN-SYSTEM.md#motion-registry); under
reduced motion each one is an instant swap.

The top bar's 6px left padding puts the workspace tile on the collapsed rail's
22px axis. The identity row adds `--titlebar-inset`, which defaults to 0px in
`styles.css`; on macOS `useTitlebarInset` raises it to 72px so the traffic
lights, drawn inside the bar by the overlay title bar, never sit on a control,
and drops it back to 0px in full screen. A window without a top bar (Home)
keeps a 36px drag strip at its top edge instead.

The overlay slots are children of the grid, not siblings above it. An overlay
that must float without taking up layout space spans its row and is
`pointer-events-none` at its root, then turns events back on for the panel
itself. An overlay that must cover the work area spans main and everything to
the right of it, never the session sidebar.

## The content column

Every main pane renders through `PaneShell`, and its crumb, header and body
sit in one `PageColumn`. At rest the column is centred in the pane, with equal
space either side: Overview, Runs, Agents, Artifacts, the session pages, Chat,
Workflows, Tasks detail, settings pages, agent and pull request detail. The
header, the trail band (the `Session` crumbs and the Ask button), the body and
the footer share the same column edges, so moving from Overview to Runs to
Agents to a settings page never shifts the first letter. The Ask button is the
last item of the trail's `PageColumn`: its right edge is the column's right
edge, the header actions' right edge. The gutter is 24px a side, 16px once the
pane is under 720px wide. The gutter switch is a container query on the pane
(`@container` on the `PaneShell` root, `@max-[720px]:` on the column), never a
media query on the window, because the space that counts is the pane's.

## The page layout

One primitive draws the top of every page: `PageHeader`
(`packages/ui/src/components/PaneShell/PageHeader.tsx`). It owns the top inset
(`PANE_RHYTHM.headerInset`, 12px, none under a studio band), the 32px title
row (`PaneTitleRow`), the gap under the header, the title's left edge (its
`PageColumn`) and the Close a studio frame hands down. `PaneShell` draws it, and a
page with its own frame (the Sessions board, the Terminal, the chat room header)
mounts it directly. No page sets its own header padding: the Settings column, the
board frame and the terminal drop their own top rows.

The columns beside the page share that header line: the session rail top row
(`data-rail-top`, `data-header-line`), the first icon of the session tools column
and every drawer header row (`DrawerFrame`) take `PANE_RHYTHM.headerInset` and
`PANE_RHYTHM.headerRow` (`h-8`), so their tops and centres match the page title
row. `validate-scenes --only header-line` measures all four on
`r4-rail-tools-open` at 1100, 1440 and 1920 and fails a drift over 1px.

A page root names its kind (`page="overview"`, `page="terminal"`) and
`PAGE_MEASURE` in `packages/ui/src/frameGeometry.ts` gives the column it sits on:

| Measure | Pages                                                                                                                                                                                        |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| column  | Overview, Runs, a run, Orchestrated, Agents, an agent, Auto agents, Artifacts, a plan or report, Questions, the worktree pages, Tasks, Workflows, Settings, Monitoring, Notifications, Guide |
| measure | the chat room (header, thread, composer)                                                                                                                                                     |
| full    | the Sessions board, the Terminal                                                                                                                                                             |

A loading page draws `PageSkeleton` with the same kind, so its title bar and
body start where the page will: `STUDIO_META[kind].skeleton` names the body shape
of each studio (`rows`, `prose`, `room`, `terminal`, `cards`) and whether it has a
rail, and the Sessions list loads on list rows, the board on lanes. A page empty
state sits on the page column at the top left, at the title's left edge (the
empty chat stage stays centred). `shared/layout/pageLayout.test.ts` fails when a
door or session page skips the primitive, sets its own header padding, picks a
width beside its kind, borrows another page's skeleton or puts its empty state off
the column.

## The frame map

`packages/ui/src/frameGeometry.ts` holds one typed map, `PAGE_FRAME: Record<FramePage, FrameType>`.
A page with no entry fails typecheck. Four frame types:

| Type   | Pages                                                                                                                             | Width                               | Title left                         |
| ------ | --------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | ---------------------------------- |
| column | Overview, Runs, a run, Agents, an agent, Questions, Workflows, Impact, Settings, Scripts, Artifacts, Explore, Storage, Monitoring | 1008, centred                       | column + 24                        |
| reader | a plan, a report, a wireframe page, a release, a Guide chapter body                                                               | 768, centred in its detail          | reader + 24                        |
| stage  | Board, Terminal                                                                                                                   | fluid from the sheet inset, to 1856 | 24                                 |
| split  | Chat, Guide, What's new, Tasks, Notifications, Branch                                                                             | `[rail 288][detail]`                | the detail's column, in its detail |

`frameGeometryOf({ page })` returns the type, the space above the title (the 12px
header inset; no page sits under a 40px band now that every Close is on the title row), the title row
(32px), the title centre (28px), the drawer row (28px) and
`titleLeft` read from the type.
`STUDIO_META[kind].page` names the page of a studio and `frameTierOf` gives the tier its band
draws at; a test fails when the two disagree.

Five rules:

1. **Band, title and first body edge share one x.** In a split page a studio band (drawn
   only when it holds Close, a trail or an accessory) moves into the detail (`StudioDetail`,
   first child of the detail) and the rail starts at the top of the sheet, so it never sits
   over the rail. A split studio wraps its detail in
   `StudioDetail`; `StudioFrame` hands it the band through `StudioBandContext`.
2. **One page rail.** Every split page uses `StudioRailLayout` with `railWidth="standard"`
   (288, resizable 220 to 420). No page draws a second rail column.
3. **Stage pages are only the Board and the Terminal.** Nothing else is fluid.
4. **The page title row and the drawer header share one line.** `DrawerFrame` draws its
   header row on the page header line (`PANE_RHYTHM.headerInset` and `headerRow`: 12px
   inset, 32px row), with one close control.
5. **First-time states sit at the top left of the page column**, in one `EmptyState`
   layout; only the empty chat stage centres.

The Branch page is one detail on one 960 column; its sections are the pages under the entries of the sidebar's
current branch row of the Projects tree, so the page has no rail of its own (`BranchDetail` draws the studio band first
when a host hands one through `StudioBandContext`).

Centring lives in `PageColumn` alone (`mx-auto` on `column` and `measure`, none
on `full`). No view centres itself. Sub-pages follow the same tiers as their
parent: Runs > Create, a run, a form, a studio's detail and its loading state
all sit on a `PageColumn` (`FormPage` is one), and `columnContract.test.ts`
walks every studio so a new place cannot sit on the left.

Three width tiers, one rule each:

| Tier    | Width                 | Used by                                                                                                                           |
| ------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| measure | `--measure`, 720px    | prose: plan prose, comment and note bodies, a Brief, the chat room (`PANE_RHYTHM.prose`, `PageColumn width="measure"`)            |
| column  | `--column-max`, 960px | the page column, centred: Overview, settings, cards, code blocks and tool output inside the transcript (`PageColumn`, `FormPage`) |
| full    | the pane, fluid       | work surfaces, from the pane's left edge: the terminal, Tasks lists, the Board (`PageColumn width="full"`)                        |

A body that owns its scroll (`scroll="self"`: the agent transcript and its
composer) puts its own `PageColumn` around the scrolling content and the
composer, so it shares the header's edges; the scroll viewport spans the pane
and carries no gutter.

Prose keeps its 720px measure aligned left inside the column, except in a
conversation (see below) and on an artifact document page (a plan, a report): its prose, parts, editor, skeleton
and past versions fill the column and share one right edge. The drawer copy of
a plan keeps the reading measure. The `full` tier
is the only exception to centring and ignores the slide below: its right edge
follows the drawer exactly as before.

**The drawer slide.** When a right drawer opens (Context, Ask, a transcript, an
artifact document, a plan) the main area gives up the drawer's track and the
centred column re-centres in the space left of the drawer, keeping its full
width while that space is wide enough. It shrinks only below its frame, down to
the column minimum (560px plus gutters); under that the drawer lies over the
page. Closing the drawer slides the column back. It is one 220ms
ease-out width transition on the drawer's track (`FOLD_MS`), so the column's centre follows
it in the same frames; it is off under `prefers-reduced-motion`. A route change
never moves the column, with or without a drawer. The pure geometry is
`pageBoxOf` in `packages/ui/src/drawerGeometry.ts`.

No view picks its own width or its own centring. The column changes only when
the window changes or the right drawer opens, never because you moved from
Overview to Review to a chat. `shared/layout/columnContract.test.ts` fails under `features/` on any
`max-w-[Nch]`, any `max-w-[Npx]` (the palette, the onboarding wizard and Home, on one 600px column, are the
listed exceptions), any `max-w-[Nrem]` of 24rem or more, any `mx-auto` outside
the Board frame and two centred empty states (centring is `PageColumn`'s job,
and the test asserts it centres `column` and `measure` and not `full`), `PANE_RHYTHM.measure`,
`DIFF_CAPPED_COLUMN_CLASS` and `max-w-xl` to `max-w-7xl` (with a narrow list
for cards that still use `max-w-xl`), and on a lens the session workspace
mounts without `PaneShell`, or a root that draws a crumb of its own. The
session has no trail band (the path is the session rail back row), and the
panes under it start with their title.

Detail views (an agent, a pull request, an issue from any tracker, a Review
mode) use `PaneShell` like every other pane. A detail keeps its own header
through the `header` slot, its sections go in `tabs`, and what used to sit
under the header (properties, a banner, an approval rail, the agent's next
action) is the first block of the body. A body that owns its scroll, such as a
transcript or a diff, asks for `scroll="self"`.

A Session or Agent page reads as one centred column: every child, banner, card
and footer sits on the same edges. Only prose keeps the 720px measure, aligned
left inside the column. Tables, code and cards take the whole column.

A conversation is the exception: assistant messages fill the transcript column,
so their right edge lines up with the composer. The 960px column is the cap, not
the message. A user or injected card keeps a fixed 48px start gap
(`PANE_RHYTHM.message.user`) in the agent transcript, Chat, the Ask panel and
the fix run drawer.

**The Branch page** is one detail whose header, Ask button and every section body share the 960px
column, so nothing moves from one section to the next. Its sections are the pages under the current branch row in
entries in the sidebar; Files opens its file tree under the Files entry, outside the column, so
the diff keeps the column. The Pull request entry is one column: a label 96 property block in
three groups, then the description and the activity. Comments is one full-width list; the open comment and its
properties read in the comment drawer beside it.

## Layout: fixed-height shell, scroll on content

Each pane is a fixed-height column that hides its own overflow. Only an inner
region scrolls. The pane itself never scrolls.

```tsx
<div className="flex h-full flex-col overflow-hidden">
  <div className="shrink-0">{/* header zone: sticky context */}</div>
  <ScrollFade className="min-h-0 flex-1">{/* body zone: scrolls */}</ScrollFade>
</div>
```

The header zone (`shrink-0`) never scrolls away. The body (`flex-1 min-h-0`) is
the only scroll region. `min-h-0` is what makes the overflow happen there
instead of on the pane. A sub-section with its own header repeats the same
split. Each view owns its own `ScrollFade`. Never wrap the whole pane in one
global scroller, because that pushes every view's header through the same
mask.

A flex-column child that fills the rest of its parent is `min-h-0 flex-1`,
never `h-full`. `h-full` beside a `shrink-0` sibling makes the child as tall as
the whole parent, so the pair overflows by the sibling's height and the sheet
clips the bottom edge (the message box ends up half under the window).
`PaneShell` takes a `lead` prop for blocks that sit above a self-scrolling
body: the lead is `shrink-0` and the children sit in a `min-h-0 flex-1` fill
slot. The `fill-child-uses-min-h-0` ratchet counts the remaining `flex h-full
flex-col` roots and only ever falls.

## Scroll edges fade, never hard-cut

Every scroll region is wrapped in `ScrollFade` from `@goodboy/ui`. Raw
`overflow-y-auto` is forbidden (the `raw-scroller` ratchet only ever shrinks).
The viewport hides its native scrollbar, and `ScrollFade` draws its own thumb
in overlay: a track 2px from the edge, a 6px pill that grows to 8px under the
pointer, in the `scrollbar-thumb` / `scrollbar-thumb-active` tokens. It never
takes width from the content, so a mouse user can still see how long a list
is without scrolling first; the fade is not the only sign a region scrolls
anymore. It shows on scroll or on hover, hides 900ms after the last of either,
and stays lit permanently under the system's "always show scrollbars" setting
(read once through the `system_scroller_style` Tauri command, exposed to
`ScrollFade` through `ScrollerStyleContext`). Pass `scrollbar="none"` to a
`ScrollFade` that must never show a thumb (rare; most viewports want the
default). A region that must drive its own scroll (a log that follows its
tail) passes `viewportRef` and `onViewportScroll` instead of reaching for a
raw scroller. A `textarea` or a `contenteditable`, which cannot be wrapped,
gets the `.native-scroll` class instead: a thin native scrollbar in the same
`scrollbar-thumb` token.

**Give it a bounded height**: `min-h-0 flex-1` inside a flex column, or a
`max-h-*` on the root. A root with no height limit does not throw an error. It
renders as a list with no end, which is why this breaks without anyone
noticing.

**The header must sit outside the fade.** The fades are overlays with absolute
position, painted above the viewport. So a `sticky` header inside the scroller
is covered as soon as the region scrolls. An opaque `bg-*` does not save it,
because the overlay paints over the header, not under it. The fix is in the
structure. Titles, breadcrumbs, toolbars and error banners live in a
`shrink-0` zone outside. Only the body is wrapped. A scroller whose sticky
headers belong to its body, such as the file headers of a diff, passes
`fadeEdges="end"`: only its bottom edge fades, so the header on top stays
sharp.

## Dividers separate chrome from content, never content from content

Chrome and content separate with the edge of the content sheet, not with a
line: the top bar, the left column and a studio rail draw no horizontal `Divider`
against the content (the left column's one `h-px` separator between its doors and the
Sessions list is inside the chrome), and the board header sits `gap-6` above its columns. A
`Divider` marks what is left of the boundary between chrome and a pane's
content, never a boundary inside content. Allowed: a vertical divider inside
the chrome (between top bar or footer groups), a pane's fixed header against its
scrolling body (the chat composer in a `PaneShell` dock, the `DrawerFrame`
header, the comment action bar under the Branch thread), and inside a
floating surface (popover, palette) the seam between its header or input and
its list, at most one per side. A page whose dock reads as the end of its
document (the orchestrated run, its queued hints over the composer) passes
`dockEdge="space"` to `PaneShell`: no divider, the composer's own surface and
the dock's padding separate it.

Inside content, separation comes from gap (the `gap-3/4/6/8` scale), from
a band (`Band`, `bg-fill` inside its parent), or from a label
that carries text (`Eyebrow`, `TimelineDayRule`). An unlabeled line inside
content is a bug, not a style choice. A toolbar group or a dialog block that
sits inside content does not get its own `<Divider>` either: it gets a `gap`
or a card.

Folder groups in the Projects card are the one content-level exception, owner
approved 18/10: `ProjectTree` draws the `Divider` primitive between one folder
group and the next (never above the first, never inside a group), so each
folder reads as its own block next to its branch rows.

Never use a `border-t/-r/-b/-l` on a container as a divider. Borders that draw
a control's own shape are fine.

`apps/desktop/src/__tests__/regressions/divider-sits-between-chrome.test.ts`
guards this with a frozen debt list: a violation already in the codebase may
be listed there, but the list only shrinks. Each allowed file carries a
reason: `chrome` for one of the boundaries above, `markdown` for a table rule
or a `---` break that the Markdown renderer draws because the source text asked
for it, and `debt` for a line inside content that has not been migrated yet. A
short list of files is exempt from the border check because their `border-t/b`
draws a control's own shape (a corner bracket, an input underline), not a seam.

## A dialog is the last resort, not the default

Anything that belongs to a control opens next to it, as a `Popover`. The
popover is portaled to `document.body` and positioned from the trigger's
`getBoundingClientRect()`. One hook owns the whole mechanism: fixed
coordinates, backdrop, portal, Escape, and flipping above the trigger when
there is no room below. Use it instead of rebuilding any piece by hand. A
centred overlay for a menu that clearly belongs to something on screen is a
bug, not a style choice. A hand-rolled version gets two things wrong without
any error. First, paint nothing until the first measurement, or the panel
flashes at `0,0`. Second, recompute on `scroll` with capture `true`, because a
scroll in any ancestor moves the trigger.

**Confirmations never open a dialog.** A destructive action confirms through
`ConfirmPopover`, one placement anchored to its trigger, and a restorable one
acts at once with Undo. That way the thing being destroyed stays visible while
the user decides and the page under it never moves. Its behaviour and trigger
styling belong to
[DESIGN-SYSTEM.md](../packages/ui/DESIGN-SYSTEM.md#action-zones).

**`Dialog` survives for the three cases an anchor cannot serve**: a full-screen
viewer, a multi-step flow that owns the whole screen, and a blocking system
prompt. Everything else is a popover or inline. A centred `Dialog` sits on
`bg-floating`, like popovers, toasts and the command palette; the full-screen
viewer passes `surface="screen"` to stay on the content surface. Any line that
sets a background on a `z-popover`, `z-toast` or `z-command-palette` layer uses
`bg-floating`, and `no-token-bypass.test.ts` holds that.

## z-index: a named scale, not a magic number per file

Some overlays are app-global and short-lived. They must win against every
full-page surface, because their trigger stays visible and clickable no matter
what is open under it. These use named tokens from the `@theme` block in
`styles.css`, under `--z-index-*`. Tailwind v4 turns each key into a
`z-<name>` utility. The values and their order are the table in
[DESIGN-SYSTEM.md](../packages/ui/DESIGN-SYSTEM.md#z-index-tokens), with a
native `<dialog>` above all of them in the browser's top layer.
`no-token-bypass.test.ts` rejects `z-[N]`. A new global layer gets a named
token and a row in the table.

That order is a precedence chain, not taste. Each step must sit above the one
under it, because it can be opened while that one is still open. **A control
earns a name here only when its trigger stays clickable under a fullscreen
studio**, so it can be opened while that studio is up. The popovers of the
top bar and the left column qualify, because a studio leaves both clickable.
Anything narrower keeps the nearest local `z-10`..`z-40`. That value is scoped
to one card, toolbar or pane, and never compared against a full-page studio.
This is why the chrome builds its own popovers instead of raising the shared
one. Many pane menus use
the shared popover, and raising it would raise all of them at once.

## Focus rings

Interactive controls compose `FOCUS_RING` from `@goodboy/ui`. It draws a
two-pixel `focus-ring` token and removes the native outline. A control clipped
inside an overflow-hidden row adds `ring-inset`; it does not weaken or resize
the shared ring.

The global `:focus-visible` outline lives in `@layer base`, so `outline-none` on a utility wins
and a field draws one ring: the container with `focus-within:ring-2`, the inner input with no
border, ring or outline (`SearchField` is that pattern).

A ring shows on keyboard focus only: it is `focus-visible`, so a click never
draws it. Every control in the top bar, every switch and every checkbox composes
`FOCUS_RING`, and the `controls` journey tabs through the bar and a Settings row
and checks the ring by the constant, not by a class written in a test. A
selected card is a fill plus a check, never a ring, a border and a wash together.

## Row actions rest quiet

A row that carries verbs keeps them in one fixed cell and draws them with
`row-actions` (`styles.css`), on a row that is a `group/row`. The cell is empty
at rest and fills on hover, on focus inside the row, while a menu or confirm
opened from it is open (`aria-expanded`), and while the row's right click menu
is open (`data-menu-open`). The verbs stay in the tab order, so the keyboard
reaches them without a hover. Every verb is also in the row's registry menu on
right click and Shift+F10. Write the reveal as `row-actions`, never as
`opacity-0` with `group-hover:opacity-100`: `no-hover-only-actions.test.ts`
counts the second form. A status the user must see (Stopping, Force stop) is
not a verb and sits outside the reveal. `MonitoringStudio/ActionsCell.tsx` is
the reference.

In the Projects card of the rail, every trailing element (the card plus, the
folder plus, the Rebase all or Abort header action, the row chip and the row
dots) ends on one right edge. Icon slots are `TRAIL_SLOT` boxes flush with the
card inset; a chip, `Rebase all` and `Abort` take `TRAIL_PILL_INSET`
(`shared/components/trailingSlot.ts`) so their ink lands where the plus glyph
does. The row dots sit over the chip's place, and the chip hides while they
show (hover, focus inside, current row).

## An expanded row is one group, not two

A disclosure (a header plus the body it opens) is a single surface. The
container owns the border and the open background. The header sits inside it
with no border of its own. The body continues under the same rail with no gap
between the two. If you add a second bordered box below the header, or a
`gap-*` between header and body, the open row reads as two unrelated
components. Nothing inside the body draws its own box. A labelled section is
an `Eyebrow` plus its content, never a nested card.
