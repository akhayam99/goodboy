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

Every scroll region is wrapped in `ScrollFade` (`packages/ui/src/components/ScrollFade.tsx`,
imported from `@goodboy/ui`), which fades the top and bottom edges with a gradient. Raw
`overflow-y-auto` is forbidden. The fade is scroll-aware: no top fade at the top, no bottom
fade at the bottom, no fade at all when the region does not overflow. The viewport hides its
native scrollbar, so the gradient is the only affordance that a region scrolls.

### Give it a bounded height

The viewport carries `max-h-[inherit]` (`max-w-[inherit]` when horizontal) so a `max-h-*` on
the `ScrollFade` root actually caps the scroller. Callers must bound the height one of two
ways: `min-h-0 flex-1` inside a flex column, or a `max-h-*` on the root. A root with no height
constraint does not error, it renders as an unbounded list, which is why this regresses
silently.

## The header must sit outside the fade

The two gradients are absolutely positioned overlays on the `ScrollFade` root, painted above
the scrolling viewport with scroll-driven opacity. A `sticky` header inside the scroller pins
right under the top overlay and gets veiled as soon as the region scrolls; an opaque `bg-*`
does not save it, because the overlay paints over the header, not under it.

The fix is structural, not cosmetic: keep anything that must stay crisp and fixed
(titles, breadcrumb, toolbars, error banners) in a `shrink-0` zone outside the
`ScrollFade`, and wrap only the scrolling body in it.

## Dividers between regions, never container borders

Separators between regions (panes, sidebar sections, toolbar groups, dialog blocks)
use the `<Divider>` component from `@goodboy/ui` (a faded hairline), rendered as a
sibling. Never a `border-t/-r/-b/-l` on a container to act as a divider. Borders that
define a control's own shape (buttons, inputs, popovers, chips) are fine.

## A dialog is the last resort, not the default

Anything that belongs to a control opens anchored to that control, as a `Popover`
from `@goodboy/ui` portaled to `document.body` and positioned off the trigger's
`getBoundingClientRect()`. `AppTopBar/NeedsYouPopover` and
`workspace/components/WorkspaceSwitcher` are the reference implementations: fixed
coordinates, a `z-30` click-catcher behind, Escape to close, and a flip above the
trigger when the space below runs out. A centred overlay for a menu that has an
obvious on-screen owner is a bug, not a style choice.

Confirmations never open a dialog. A destructive action swaps its own row or button
for `InlineConfirm`, so the thing being destroyed stays visible while the user
decides. `WorkspaceLauncher`'s disconnect and `DeleteSessionConfirm` are the pattern.

`Dialog` survives for the three cases an anchor cannot serve: a full-screen viewer
(`DiffViewerDialog`, the chat lightbox), a multi-step flow that owns the whole
screen (`OnboardingWizard`, `WorkspaceLinkDialog`), and a blocking system prompt
(`UpdateIndicator`). Everything else is a popover or inline.

## An expanded row is one group, not two

A disclosure (header plus the body it reveals) is a single surface. The container
owns the border and the open background, the header sits inside it with no border
of its own, and the body continues under the same rail with no gap between the two.
A second bordered shell below the header, or a `gap-*` between header and body,
reads as two unrelated components the moment the row opens.

In the chat transcript that container is
`features/chat/components/TranscriptDisclosure`, whose header is a
`TranscriptRowHeader` with `grouped` (which drops the header's own border). Nothing
inside the body draws its own box: a labelled section is a `2xs` uppercase muted
label plus its content, never a nested card. Outside the transcript the same rule is
carried by `Collapsible` in `@goodboy/ui`.

## Compaction: lists stay dense, artifacts don't

Sourced from a density audit that found the same defects repeating everywhere a
list, popover, or card row appeared: unbounded prose, four-deep item stacks,
terminal state crowding the top, a wall of actions shown at all times when hover
would do, placeholder cards where nothing needed saying, and type sizes invented on
the spot. Six rules, phrased so a diff can be checked against them directly.

### Prose clamps in lists

Any user, model, or bot prose rendered inside a list, popover, or card row goes
through a line clamp (3 lines or fewer, e.g. `line-clamp-3`) or a collapsed
disclosure. An unbounded markdown render or `whitespace-pre-wrap` is legal only in a
pane or detail view whose title names that content, see the exemption below.

### Three tiers per list item

A list item renders at most a title, one status or chip row, and one `MetaRow`. A
fourth stacked block means the item needs a focused view, not another row. `RailCard`
is the reference shape: `title` (clamped), `status` (a wrapped chip row), `meta` (a
`MetaRow`), `trailing` (one action plus the chevron). Lists render through
`RailCard`, `SelectableRow`, or `LinkedWorkRow`; a bespoke `flex-col` with four or
more children inside a `map()` is a review flag.

### Terminal state hides behind a count

Completed, answered, resolved, dismissed, and discarded items never render inline by
default. They sit behind a header toggle with a count (the `WorkflowRailSectionToggle`
pattern) or a collapsed disclosure row.

### One visible action per row

A repeated row shows at most one always-visible action plus the chevron. Everything
else is revealed on hover and focus (`CardAction`'s `reveal` prop, gated on
`group-hover`/`group-focus-within`), or lives in the focused view.

### Empty sections collapse

Inside a composite page, a section with nothing to show renders its header at most,
never a placeholder card. Only a full pane may show an `EmptyState`.

### No off-scale type

Any `text-[Npx]` is rejected; the scale is `text-3xs` through `text-xl`
(`3xs` 10px, `2xs` 11px, `xs` 12px, `sm` 14px, `base` 15px, `lg` 17px, `xl`
20px). The one exception is relative `em` sizing inside prose/markdown
rendering (`InlineCode`, `CostBadge`, `Markdown`'s inline chips and code
spans), where the size is intentionally proportional to a parent font size
that varies by call site, not a fixed pixel value.

### The exemption: never compress the artifact

None of the rules above are absolute; a rule with no stated exception gets
misapplied. The governing line: compress metadata, chrome, and history without
limit; never compress the artifact the user navigated to.

| surface                                                 | why it's exempt                                       |
| ------------------------------------------------------- | ----------------------------------------------------- |
| the plan body in Plan Studio                            | the plan is the artifact the user opened              |
| `SlotPane` documents (goal, decisions, session summary) | the pane's own title already names the content        |
| the PR description in `PrOverview`                      | click-to-edit; a clamp fights the editor              |
| the question text in `QuestionCard`                     | clamping the thing being decided causes wrong answers |
| the diff viewer                                         | the diff is the artifact                              |
| the terminal dock                                       | raw process output, not summarizable                  |
| the Explore preview contents                            | file contents, not metadata                           |
| Sentry stack traces and breadcrumbs                     | the trace is the artifact under investigation         |
| GuideStudio                                             | the guide body is the artifact                        |

Bounded scroll regions on those are fine (`ScrollFade`, per Scroll edges fade above);
truncation is not.
