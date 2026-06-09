# Styling

Concrete Tailwind rules for spacing, radius, and scroll. `DESIGN.md` owns the
surface principles (voice, density, color, signals) and points here for the
mechanics. Goodboy is a three-pane Tauri shell, not a single scrolling page, but the
ownership rule is the same throughout: spacing is decided once by the container,
never scattered into the things being spaced.

## Separation: `gap`, never margin or `space-y/x`

Space between sibling elements is the parent's responsibility, expressed once via
`gap` on a flex or grid container. Margins and `space-y/x-*` are forbidden for
separation: they scatter the decision across children, collapse unpredictably, and
are asymmetric. Padding-as-spacer (`py`/`px` on a wrapper to push siblings apart) is
the same mistake wearing a different name.

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

## Padding is for surface insets only

Padding is legitimate only as the internal inset of a surface: the breathing room
inside a card, banner, input, or a button's hit-area. It must never stand in for
separation between siblings.

```tsx
// good: padding is the card's inner inset; gap separates its contents
<article className="flex flex-col gap-3 rounded-lg border border-border p-4">
  <h2>Title</h2>
  <p>Body</p>
</article>
```

Insets stay compact: `p-3` for dense list rows, `p-4` for standard cards and
banners, `p-5` for a hero surface. `p-6` and larger waste space and make a card feel
emptier than its content warrants.

## Edge insets belong to the host, not the child

The space between a hosted component and the pane edge, on all four sides, is the
host wrapper's responsibility, never the child's. A view draws itself; it does not
decide how far it sits from the edge. Same logic as `gap`: spacing is owned once, by
the container. A child that reaches out with its own `pb-*`/`px-*` to clear the edge
is making a layout decision that is not its to make, and it breaks the moment the
same child is hosted somewhere else.

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

For a scroll region, the host pads around the `ScrollFade` (`pb-10` on the parent) so
the trailing room sits below the scroller, not inside it. The child `ScrollFade` is
only `min-h-0 flex-1`.

## Radius: one family, one step off square

Every framed surface shares a single radius so the UI reads as one family. The
standard is `rounded-lg` (8px). Larger radii (`rounded-xl`, `rounded-2xl`) read as
bubbly at this scale and are not used.

| token          | value | use                                                |
| -------------- | ----- | -------------------------------------------------- |
| `rounded-lg`   | 8px   | framed surfaces: cards, banners, inputs, buttons   |
| `rounded-md`   | 6px   | small inset controls: icon buttons, segmented tabs |
| `rounded-full` | -     | pills, avatars, circular icon buttons              |

## Gap scale

One restricted, semantic scale. Do not reach for arbitrary values.

| token   | use                                 |
| ------- | ----------------------------------- |
| `gap-2` | within a tight group (icon + label) |
| `gap-4` | between controls / related blocks   |
| `gap-6` | between sections                    |
| `gap-8` | header zone to body zone            |

## Layout: fixed-height shell, scroll on content

Each pane is a fixed-height column that hides its own overflow; only an inner region
scrolls. The pane itself never scrolls.

```tsx
<div className="flex h-full flex-col overflow-hidden">
  <div className="shrink-0">{/* header zone: sticky context */}</div>
  <ScrollFade className="min-h-0 flex-1">{/* body zone: scrolls */}</ScrollFade>
</div>
```

- header zone (`shrink-0`): titles, breadcrumb, toolbars. Always visible, never
  scrolls away.
- body zone (`flex-1 min-h-0`): the only scroll region. `min-h-0` lets it shrink
  below content height so overflow lands here, not on the pane.

A sub-section with its own header repeats the split: the header is a `shrink-0` zone,
only the body below it is wrapped in `ScrollFade`. Each view owns its own
`ScrollFade`; do not wrap the whole pane in one global scroller, that would force
every view's header through the same mask.

## Scroll edges fade, never hard-cut

Every scroll region is wrapped in `ScrollFade`
(`apps/desktop/src/shared/components/ScrollFade`), which masks the top and bottom
edges with a gradient. Raw `overflow-y-auto` is forbidden. The fade is scroll-aware:
no top fade at the top, no bottom fade at the bottom, no fade at all when the region
does not overflow. The scrollbar stays visible (a persistent thin track), since
macOS overlay scrollbars auto-hide and leave no affordance that a region scrolls.

## The header must sit outside the fade

`ScrollFade` works with `mask-image`, which dims the entire composited layer, text
and opaque backgrounds alike. A `sticky` header placed inside the scroller fades
along with everything else as content slides under it; an opaque `bg-*` does not save
it, because the mask is applied above the paint. `mask-image` also does not establish
a containing block for `sticky`, so the sticky offset resolves against the scroller
anyway.

The fix is structural, not cosmetic: keep anything that must stay crisp and fixed
(titles, breadcrumb, toolbars, error banners) in a `shrink-0` zone outside the
`ScrollFade`, and wrap only the scrolling body in it.

## Dividers between regions, never container borders

Separators between regions (panes, sidebar sections, toolbar groups, dialog blocks)
use the `<Divider>` component from `@goodboy/ui` (a faded hairline), rendered as a
sibling. Never a `border-t/-r/-b/-l` on a container to act as a divider. Borders that
define a control's own shape (buttons, inputs, popovers, chips) are fine.
