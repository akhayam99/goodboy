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

`bg-chrome` is the app frame and nothing else: `AppShell` paints it on the
window and the left column, and `AppTopBar` (and `AppFooter` under Classic
bars) paint their bars with it. The main pane stays on `bg-background`, one step in front.
`no-token-bypass.test.ts` fails a `bg-chrome` anywhere else.

## The window grid

Columns, resize handles, the studio slot and (under Classic bars) the footer
are areas of **one** CSS grid. Their
widths are saved, and clamped when read back. They are never nested flex
containers. So hiding or resizing a column is one template declaration, and
nothing inside it needs to know. [navigation.md](navigation.md) owns which
columns exist and what each one may do.

Top bar and left column are one chrome field, and `main` is a **sheet** on
it (`SHEET_CLASSES` in `packages/ui/src/sheet.ts`). A sheet corner rounds only
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

The right drawer is not a grid column: `DrawerColumn` sits inside the `main`
area beside the page, 0px wide while closed and the saved width plus two 8px
insets while open. It opens beside the page: the main area gives up the drawer's track and the
centred column slides left to re-centre in what is left of it (see The content
column). When pushing would leave the main area under 560px plus
its 48px of gutters (the drawer's track, insets included, is counted), the
drawer lies over the page instead. `sizing` on `DrawerColumn` is `default` (the
saved width, with the resize handle), `half` (half of the column, capped so the
main area keeps its 560px and the drawer still pushes, no handle) or `full`
(the whole column, always over the page). The pure geometry lives in
`packages/ui/src/drawerGeometry.ts` (`drawerWidthOf`, `drawerModeOf`,
`mainWidthOf`) and `drawerGeometry.test.ts` runs it over a width matrix:
1024, 1440 and 1920 windows at zoom 0.8, 1 and 1.25, default and widest
sidebar. `selectDrawerSizing.test.ts` takes every drawer kind at 1280 and
1440 and checks the card ends 8px inside the aside, also while it slides in:
`drawer-card-in` and `drawer-overlay-in` slide at most the 8px inset, never
past the window edge. `DrawerColumn.test.tsx` pins the classes that math
assumes (an 8px `w-2` handle, the card's `mr-2`, the track's min width).
[navigation.md](navigation.md#the-right-drawer) owns what goes in it.

The top bar's 6px left padding puts the workspace tile on the collapsed rail's
22px axis. The identity row adds `--titlebar-inset`, which defaults to 0px in
`styles.css`; on macOS `useTitlebarInset` raises it to 72px so the traffic
lights, drawn inside the bar by the overlay title bar, never sit on a control,
and drops it back to 0px in full screen. A window without a top bar (the
workspace launcher) keeps a 36px drag strip at its top edge instead.

The overlay slots are children of the grid, not siblings above it. An overlay
that must float without taking up layout space spans its row and is
`pointer-events-none` at its root, then turns events back on for the panel
itself. An overlay that must cover the work area spans main and everything to
the right of it, never the session sidebar.

## The content column

Every main pane renders through `PaneShell`, and its crumb, header and body
sit in one `PageColumn`. At rest the column is centred in the pane, with equal
space either side: Overview, Runs, Agents, Artifacts, the session pages, Chat,
Workflows, Inbox detail, settings pages, agent and pull request detail. The
header, the trail band (the `Session` crumbs and the Ask button), the body and
the footer share the same column edges, so moving from Overview to Runs to
Agents to a settings page never shifts the first letter. The Ask button is the
last item of the trail's `PageColumn`: its right edge is the column's right
edge, the header actions' right edge. The gutter is 24px a side, 16px once the
pane is under 720px wide. The gutter switch is a container query on the pane
(`@container` on the `PaneShell` root, `@max-[720px]:` on the column), never a
media query on the window, because the space that counts is the pane's.

Centring lives in `PageColumn` alone (`mx-auto` on `column` and `measure`, none
on `full`). No view centres itself. Sub-pages follow the same tiers as their
parent: Runs > Create, a run, a form, a studio's detail and its loading state
all sit on a `PageColumn` (`FormPage` is one), and `columnContract.test.ts`
walks every studio and session studio so a new place cannot sit on the left.

Three width tiers, one rule each:

| Tier    | Width                 | Used by                                                                                                                                          |
| ------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| measure | `--measure`, 720px    | prose: transcript assistant text, plan prose, comment and note bodies, a Brief, Chat answers (`PANE_RHYTHM.prose`, `PageColumn width="measure"`) |
| column  | `--column-max`, 960px | the page column, centred: Overview, settings, cards, code blocks and tool output inside the transcript (`PageColumn`, `FormPage`)                |
| full    | the pane, fluid       | work surfaces, from the pane's left edge: every Branch tab, File versions, the terminal, Inbox lists, the Board (`PageColumn width="full"`)      |

A body that owns its scroll (`scroll="self"`: the agent transcript and its
composer) puts its own `PageColumn` around the scrolling content and the
composer, so it shares the header's edges; the scroll viewport spans the pane
and carries no gutter. File versions is `full`, trail included.

Prose keeps its 720px measure aligned left inside the column. The `full` tier
is the only exception to centring and ignores the slide below: its right edge
follows the drawer exactly as before.

**The drawer slide.** When a right drawer opens (Context, Ask, a transcript, an
artifact document, a plan) the main area gives up the drawer's track and the
centred column re-centres in the space left of the drawer, keeping its full
width while that space is wide enough. It shrinks only below its frame, down to
the column minimum (560px plus gutters); under that the drawer lies over the
page, as before. Closing the drawer slides the column back. It is one 180ms
ease-out width transition on the drawer's track, so the column's centre follows
it in the same frames; it is off under `prefers-reduced-motion`. A route change
never moves the column, with or without a drawer. The pure geometry is
`pageBoxOf` in `packages/ui/src/drawerGeometry.ts`.

A margin rail (`--margin-rail`, 288px) sits on the right of a work surface
from 1280px of pane: Branch thread properties.

No view picks its own width or its own centring. The column changes only when
the window changes or the right drawer opens, never because you moved from
Overview to Review to a chat. `shared/layout/columnContract.test.ts` fails under `features/` on any
`max-w-[Nch]`, any `max-w-[Npx]` (the palette and the onboarding wizard are the
listed exceptions), any `max-w-[Nrem]` of 24rem or more, any `mx-auto` outside
the Board frame and two centred empty states (centring is `PageColumn`'s job,
and the test asserts it centres `column` and `measure` and not `full`), `PANE_RHYTHM.measure`,
`DIFF_CAPPED_COLUMN_CLASS` and `max-w-xl` to `max-w-7xl` (with a narrow list
for cards that still use `max-w-xl`), and on a lens the session workspace
mounts without `PaneShell`, or a root that draws a crumb of its own. The
session trail lives only in `TrailBar`, a 40px band above every layer; the
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

**Work** pages (the tabs of the Branch) take the whole width of the pane: Files
puts its file tree on the left from 900px of pane up and the diff beside it
(under 900px the tree is a 44px strip that opens over the diff), Comments puts
the list and the thread side by side from 900px, the thread's properties
inline under it until 1280px and in the margin rail from there.

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
against the content, and the board header sits `gap-6` above its columns. A
`Divider` marks what is left of the boundary between chrome and a pane's
content, never a boundary inside content. Allowed: a vertical divider inside
the chrome (between top bar or footer groups), a pane's fixed header against its
scrolling body (the chat composer in a `PaneShell` dock, the `DrawerFrame`
header), and inside a
floating surface (popover, palette) the seam between its header or input and
its list, at most one per side.

Inside content, separation comes from gap (the `gap-4/6/8` scale), from
a band (`Band`, `bg-fill` inside its parent), or from a label
that carries text (`Eyebrow`, `TimelineDayRule`). An unlabeled line inside
content is a bug, not a style choice. A toolbar group or a dialog block that
sits inside content does not get its own `<Divider>` either: it gets a `gap`
or a card.

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
`InlineConfirm`. That way the thing being destroyed stays visible while the
user decides. Its placements and trigger styling belong to
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

## An expanded row is one group, not two

A disclosure (a header plus the body it opens) is a single surface. The
container owns the border and the open background. The header sits inside it
with no border of its own. The body continues under the same rail with no gap
between the two. If you add a second bordered box below the header, or a
`gap-*` between header and body, the open row reads as two unrelated
components. Nothing inside the body draws its own box. A labelled section is
an `Eyebrow` plus its content, never a nested card.
