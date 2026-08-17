# Design system

> **Read this when** you need concrete tokens, scales, or primitives to implement against. **Not for** intent and product judgment (`DESIGN.md`) or Tailwind authoring mechanics (`docs/styling.md`).

Tokens, scales, primitives and visual law for `@goodboy/ui`. This file owns the
design system layer: invariants and product intent stay in [DESIGN.md](../../DESIGN.md),
Tailwind mechanics and precedence reasoning stay in [docs/styling.md](../../docs/styling.md).

Tokens physically live in `apps/desktop/src/styles.css` under `@theme`. That is
a location, not ownership: the law for what they mean and how they compose
lives here.

## Type scale

`text-3xs` 10px, `2xs` 11px, `xs` 12px, `sm` 14px, `base` 15px, `lg` 17px,
`xl` 20px. Any `text-[Npx]` is rejected; standing exceptions live in
`docs/styling.md`, which owns the authoring rule.

## Radius scale

One radius family, one step off square. `rounded-xl` and larger read as bubbly
at this scale.

| token          | value | used for                                           |
| -------------- | ----- | -------------------------------------------------- |
| `rounded-lg`   | 8px   | framed surfaces: cards, banners, inputs, buttons   |
| `rounded-md`   | 6px   | small inset controls: icon buttons, segmented tabs |
| `rounded-full` | n/a   | pills, avatars, circular icon buttons              |

## Gap scale

One restricted, semantic scale, never an arbitrary value.

| token   | separates                      |
| ------- | ------------------------------ |
| `gap-2` | a tight group: icon plus label |
| `gap-4` | controls, or related blocks    |
| `gap-6` | sections                       |
| `gap-8` | a header zone from a body zone |

## Density grades

Four grades, driven by `--density-{compact,cozy,comfortable,scan}`:

- **Compact**: the sidebar.
- **Cozy**: the strips inside a pane, the composer, tool/system transcript rows.
- **Comfortable**: human and assistant prose. Built for reading.
- **Scan**: the stage board and other card grids. Tuned for sweeping a column
  of cards, not reading one.

## Color and tone resolution

- **One tint helper, one stage map.** Tones resolve through `tintClasses(tone)`,
  stage colors through `STAGE_TONE`. No per-file tone maps.
- The stage tones: attention `warning`, running `info`, in review `success`,
  done `merged`, building neutral.
- Elevation is a four-step ramp: canvas < panel < rail/chip < floating. Lift by
  stepping the ramp, never by inventing a shade.

## Icon and tone vocabulary

One module holds two maps over one key set: concept to icon, concept to tone,
the second typed off the first so a concept cannot gain an icon without gaining
a tone or vice versa.

- **One icon per concept.** Never import a lucide symbol locally for a concept
  that already has an entry; add the concept to the map instead.
- **One tone per concept, passed alongside the icon** as a pair at the call
  site.
- **Tone is meaning, not decoration.** `questions` is `warning` because a
  question blocks someone, `decisions` and `plans` are `success` because they
  are settled, `sentry` is `danger` because it is errors, `terminal` and
  `settings` are `neutral` because they are plumbing. Recolouring a concept
  changes what it claims.

Nine tones (`success`, `info`, `warning`, `danger`, `primary`, `accent`,
`merged`, `operations`, `neutral`), each resolving through the single accessor
`tintClasses(tone)`. Components take a `Tone` and call it; they never
hand-write `bg-warning/10`.

## z-index tokens

Named tokens in `apps/desktop/src/styles.css` under `@theme`, keys
`--z-index-*`: Tailwind v4 turns each key into a `z-<name>` utility. The
ordering is a precedence chain; `docs/styling.md` owns the reasoning for it,
this table is the registry only.

| token                        | value | who                                                    |
| ---------------------------- | ----- | ------------------------------------------------------ |
| (StudioShell fullscreen)     | 50    | the floor: never lowered                               |
| `--z-index-popover-backdrop` | 55    | click-catcher behind the app-global popovers           |
| `--z-index-popover`          | 65    | the app-global popovers                                |
| `--z-index-command-palette`  | 70    | ⌘K, which fires whatever else is open                  |
| `--z-index-tooltip`          | 75    | triggerable from inside a popover or the palette       |
| `--z-index-toast`            | 85    | the toast stack                                        |
| (native `<dialog>`)          | n/a   | the browser's top layer, above every z-indexed element |

## Primitives

The register taxonomy and its shared-family invariant live in
[DESIGN.md](../../DESIGN.md). The barrel is the roster: a doc list of
primitives goes stale, `src/index.ts` cannot. A register that needs a shape
the family does not have grows the family; it never keeps a private one.

## Pane anatomy

The package ships the pane primitives `PANE_RHYTHM`, `ScrollFade`, and
`Divider`, not a pane frame. `PaneShell` is a desktop composition at
`apps/desktop/src/shared/components/PaneShell/` built from those primitives:
a scroll region whose body is a centred column. It has one `h1` per surface;
`meta` carries counts and totals in `tabular-nums`, never a control; the header
row wraps, so actions drop under the title instead of squeezing it; the pane
owns the gap below the header and children add no top margins.

**The reading column caps at `max-w-5xl` and centres.** That is 1024px, also
the window's minimum width, so the cap never binds at minimum size: the
sidebar and the pane insets do. It exists for wide monitors,
where an uncapped paragraph runs past a comfortable measure.

`wide` is the escape hatch for a workbench, not a long document, and it is
applied conditionally: the workbench goes full width, its empty state stays in
the reading column, so an empty pane never presents a 2000px-wide dashed box.

## Action zones

The fixed chrome row uses one flexible context region followed by one shrink-safe action region. `StudioShell` exposes that region as `headerAccessory`, `HeaderBand` exposes it as `actions`, and inspector headers use the same `actions` slot. Generic object, lifecycle and destructive controls go there. The action region is pushed to the far end and never enters the content scroller.

The focused object's primary action uses the same fixed header action region. A creation or edit flow instead lands its commit in one action row that sits in the scrolling flow immediately after the last section, with supporting error copy at the start and cancel plus exactly one primary action at the end. Alternates and reset controls join the same row as ghost or secondary buttons. A section-scoped action uses `SectionHeader.action`; a field control uses `FieldRow`; neither promotes itself into global chrome. A surface that genuinely needs a dock argues for one at review; docking is no longer the default for any composition.

`InlineConfirm` stays attached to a destructive trigger in its action region. A detached confirmation in the body is not another zone.

## Section rhythm

`PANE_RHYTHM.stack` separates peer sections and `Divider` separates regions whose boundary matters. Section children do not add margins. `SectionHeader` is the canonical section heading and optional description: its default eyebrow size is for compact and scan surfaces, while `size="page"` is for a reading-surface section that needs an `h2`. Description copy comes only through `hint`, so its size and muted tone remain paired with the heading grade.

`Eyebrow` is a label primitive for metadata, statistics and small internal groups. It does not replace `SectionHeader` when a section also needs an action or description. `FieldRow` owns a form field's label, help copy and control alignment; it does not title a section. When these roles overlap, `SectionHeader` wins for the section, then `FieldRow` labels the controls inside it. `Divider` is a sibling between regions, never decoration after every heading or field.

## Prose disclosure

`ClampedProse` is the only multi-line prose clamp. It accepts one to six lines, renders the text as preview markdown and reveals the complete text in place through Show more and Show less. Do not apply `line-clamp-*` directly to prose or slice a display string. Single-line identity labels may use `truncate` when their full value is available from the focused object or an accessible disclosure.

Artifacts exempted by `DESIGN.md`, including the text of an open question, never use `ClampedProse`.

## Card action grammar and creation grammar

**One card action grammar.** Two stable slots: navigation top right, always
visible; lifecycle and destructive bottom right. Hover may reveal lifecycle
actions without moving either slot, and keyboard focus reveals the same. Icon
actions use the shared `Tooltip`, never the native `title`.

**One creation grammar.** Bare sections stacked in one column, never a bordered
box around the whole thing; secondary affordances in `SectionHeader`'s
`action` slot; related options in one container, not one card each; one
action row immediately after the last section, error left, exactly one primary
button right, cancel and alternates as ghost or secondary.

## Empty states

One layout for a lens with nothing to show: `LensEmptyState`, a wrapper that
fixes `bordered` and `size="inline"` and makes `description` mandatory. Lenses
use `inline`, always; only a surface's own main empty state gets the large
size and an `h2`, and an empty lens leaves `headingLevel` unset so it adds
nothing to the document outline.

Inline empty states belong to a lens or compact collection surface. A filled,
borderless inline empty state belongs to a surface's own body and uses
`FilledEmptyState`, which owns its inset and fill. Do not hand-roll either
shape with `EmptyState size="inline"`.

**Inline beats the centred hero** because the pane already has a title and a
rhythm: a hero restates the title in bigger type and pretends the lens is a
landing page when it is one of a rail full of destinations.

**The gap trap.** Separation is owned by the parent flex container, so a child
rendering `<div />` or an empty fragment still costs a full gap step and leaves
a hole nobody can attribute. A component with nothing to show returns `null`,
and the rail filters out groups with no rows rather than rendering a heading
over nothing.

```tsx
if (count === 0) return null;
```

Groups are separated by the step the pane puts between its body children while
rows inside one sit tighter, which is what makes active, completed and
discarded read as three answers instead of one long list.

What "empty" means semantically, and the copy rule for it, are product
invariants and live in [DESIGN.md](../../DESIGN.md).

## Motion registry

Four animations, one meaning each.

- `spin-border`: working.
- `border-pulse`: a warning-stage card needs you.
- `attention-ring`: something new arrived, a finite outward breath (three
  cycles, then rest) on an element that now requires the user, never one that
  is working.
- `soft-pulse`: the only standing-state animation in the app, breathing the
  Providers launcher while no provider is connected. The bar for a second one
  is high.

Motion-safe gating, "motion confirms, never decorates", "motion names who is
working, and for how long", and "Spinners are forbidden" are product
invariants and live in [DESIGN.md](../../DESIGN.md).

## Alignment and truncation

**A column holds its width.** A chip repeated down a list takes a fixed width;
in a right-aligned cluster variable text comes first, glyphs last.

**Truncation order is authored, not emergent.** In the strip the crumb region
is the only `flex-1` child, so it absorbs every shortfall before any control
moves, and explicit caps fix the order inside it: session title first, then
trailing crumbs, then workspace identity. In the rail the label truncates and
the count is `shrink-0`, so a long label loses characters before a count
disappears.

**A repeated row is read down a column, not across a line**, so anything whose
width follows its content breaks the column for every row under it.

- A label chip in a repeated row carries a fixed width (`Chip`'s `width`
  prop); `auto` is for one-off chips in a detail panel, never a column. A
  fixed-width wrapper around the chip does not count: it aligns what comes
  after the chip and leaves the chip ragged.
- In a right-aligned cluster, variable text comes first and glyphs last: what
  sits nearest the edge must be constant-width or it wanders row to row. In a
  left-aligned cluster the glyph leads. The test is where the group is
  anchored, not what looks tidy in one row.
