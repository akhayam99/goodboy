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

Any `text-[Npx]` is rejected, with one standing exception: relative `em` sizing
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

## The window grid

Columns, resize handles and the footer are areas of **one** CSS grid. Their
widths are saved, and clamped when read back. They are never nested flex
containers. So hiding or resizing a column is one template declaration, and
nothing inside it needs to know. [navigation.md](navigation.md) owns which
columns exist and what each one may do.

The top bar is drawn outside the window grid. Its centred layout uses two
equal flexible outer columns around the brand. Page breadcrumbs stay in the
pane that owns them and do not set the top bar's size.

The overlay slots are children of the grid, not siblings above it. An overlay
that must float without taking up layout space spans its row and is
`pointer-events-none` at its root, then turns events back on for the panel
itself. An overlay that must cover the work area spans main and everything to
the right of it, never the session sidebar.

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
`overflow-y-auto` is forbidden. The viewport hides its native scrollbar, so the
fade is the only sign that a region scrolls.

**Give it a bounded height**: `min-h-0 flex-1` inside a flex column, or a
`max-h-*` on the root. A root with no height limit does not throw an error. It
renders as a list with no end, which is why this breaks without anyone
noticing.

**The header must sit outside the fade.** The fades are overlays with absolute
position, painted above the viewport. So a `sticky` header inside the scroller
is covered as soon as the region scrolls. An opaque `bg-*` does not save it,
because the overlay paints over the header, not under it. The fix is in the
structure. Titles, breadcrumbs, toolbars and error banners live in a
`shrink-0` zone outside. Only the body is wrapped.

## Dividers separate chrome from content, never content from content

A `Divider` marks the boundary between app chrome and a pane's content, not a
boundary inside content. Allowed: the top bar and footer, a studio or sidebar
rail against the detail pane (vertical), a pane's fixed header against its
scrolling body (`PaneShell scroll="body"`, `InspectorHeader`), and inside a
floating surface (popover, palette) the seam between its header or input and
its list, at most one per side.

Inside content, separation comes from gap (the `gap-4/6/8` scale), from
surface (`SectionSurface`, `bg-subtle` against the canvas), or from a label
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
prompt. Everything else is a popover or inline.

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
studio**, so it can be opened while that studio is up. The footer's popovers
qualify, because the studio leaves the bars clickable. Anything narrower keeps
the nearest local `z-10`..`z-40`. That value is scoped to one card, toolbar or
pane, and never compared against a full-page studio. This is why the footer
builds its own popover instead of raising the shared one. Many pane menus use
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
