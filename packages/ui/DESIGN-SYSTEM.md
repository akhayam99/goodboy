# Design system

> **Read this when** you need concrete tokens, scales, or primitives to implement against. **Not for** intent and product judgment (`DESIGN.md`) or Tailwind authoring mechanics (`docs/styling.md`).

This file holds the tokens, scales, primitives and visual rules for
`@goodboy/ui`. It owns the design system layer. Fixed rules and product intent
stay in [DESIGN.md](../../DESIGN.md). Tailwind mechanics and the reasons behind
stacking order stay in [docs/styling.md](../../docs/styling.md).

The tokens are stored in `apps/desktop/src/styles.css` under `@theme`. That
file is only where they sit. The rules for what they mean and how they combine
live here.

## Text hierarchy

Text uses four opaque semantic steps. `foreground` is primary content,
`muted-foreground` is supporting content, and `faint-foreground` is metadata,
placeholders and trailing hints. `disabled-foreground` is reserved for disabled
controls. Opacity modifiers do not create additional text steps.

## Elevation ramp

`background`, `subtle`, `muted` and `elevated` express distance from the canvas
in both themes. Components step between those opaque surfaces instead of
mixing one surface through opacity. `bg-hover` and `bg-selected` are
interaction overlays painted as a background-image layer, so they stack on
whatever fill the element rests on instead of replacing it, and `cn` keeps them
beside a surface class. `scrim` is reserved for modal backdrops.

A selected row has one treatment everywhere: `bg-selected`, foreground text and
medium weight, driven by `data-selected` (`selectedRow.ts`, used by
`SelectableRow` and `RailCard isSelected`). No ring and no primary tint mark a
selection; the focus ring stays the only ring, so focus and selection read
apart, as in VS Code and Linear lists.

A row that holds its own links or buttons is `InteractiveRow`: one overlay
button stretched over the row opens it, and the inner controls sit above it.
A `role="button"` div with its own key handler and propagation stopping is not
another pattern. A settings-style rail entry with an icon, a subtitle and a
status dot is `StatusRailItem`.

## Type scale

`text-3xs` 10px/14px, `2xs` 11px/16px, `xs` 12px, `sm` 14px/20px, `base` 15px,
`lg` 17px, `xl` 20px, and one display grade, `2xl` 24px/32px, kept for the
onboarding titles, the `EmptyState` hero and the Impact headline. Arbitrary
sizes are covered by [docs/styling.md](../../docs/styling.md).

**Every size a repeated row uses declares its own line-height.** Without that
pair, the box height follows whatever `line-height` the size inherits. For
example, `3xs` and `2xs` inherited the body's 1.55 and came out at 15.5px and
17.05px. That put the lens rail's group labels and count chips on a fractional
pixel, and a row with a count ended up taller than a row without one. `3xs`,
`2xs`, `sm` and `2xl` have a fixed line height in the tokens. `xs` does not, so
a repeated row that uses it writes `leading-4` where it is used.

### One grade per role

The grade follows what a thing **is**, not which file draws it. A row label is a
row label in the activity feed and in a brief, so it is the same size in both.
The session Overview is the reference surface. Its density was tuned on
purpose. Window zoom scales every surface at once. So if another surface uses a
larger grade for the same role, the user has to choose between a comfortable
Overview and a comfortable everything else.

| role                                             | grade               | resolves to |
| ------------------------------------------------ | ------------------- | ----------- |
| pane title                                       | `text-xl`           | 20px        |
| section label, and its `hint`                    | `text-2xs`          | 11px / 16px |
| top-level row label                              | `text-sm leading-5` | 14px / 20px |
| nested row label, a child of the row above it    | `text-xs leading-4` | 12px / 16px |
| secondary label beside a row label               | `text-2xs`          | 11px / 16px |
| chip                                             | `text-2xs`          | 11px / 16px |
| metadata inside a row: time, ordinal, cost, hint | `text-3xs`          | 10px / 14px |
| status label                                     | `text-xs`           | 12px        |

**Prose is the one exception. It is a reading grade, not drift.** Human and
assistant transcript messages, a markdown body and any artifact the reader came
for stay on the comfortable grade (`text-sm`). Making those smaller makes the
app worse. The chrome around prose still takes the grade its role asks for. A
document pane's section label is an eyebrow even when the body under it is
`text-sm`, because `DESIGN.md` compresses chrome without limit and never the
artifact.

## Radius scale

One radius family, one step away from square. There is no `rounded-xl` token:
larger radii look bubbly at this scale. `no-token-bypass.test.ts` rejects bare
`rounded` and arbitrary `rounded-[Npx]`. Bare `rounded` comes out at 3.75px on
the 15px root, so it is always written `rounded-sm`.

| token          | value | used for                                                      |
| -------------- | ----- | ------------------------------------------------------------- |
| `rounded-lg`   | 8px   | framed surfaces: cards, banners, panels                       |
| `rounded-md`   | 6px   | controls and popovers: buttons, inputs, selects, icon buttons |
| `rounded-sm`   | 4px   | inline tokens: kbd, code, small badges, checkboxes            |
| `rounded-full` | n/a   | pills, avatars, circular icon buttons                         |

## Spacing scale

The base is `4px`, set in px and never in rem. Every utility comes out as
`calc(4px * n)`. So the smallest step on the scale (`0.5`, a 2px gap) is still
a whole pixel, and so is every step above it.

A rem base breaks that. The root font size is 15px, which turns the same scale
into a 3.75px grid and puts most boxes on a fractional pixel. You cannot see
it until something animates. An element with a running transition gets its own
compositing layer and is drawn on the device pixel grid. So a fractional box
snaps to whole pixels when the transition starts, and snaps back when it ends.
That shows up as a one pixel bounce on every icon in the column.

## Gap scale

One limited scale where each step has a meaning. Never an arbitrary value.

| token   | separates                      |
| ------- | ------------------------------ |
| `gap-2` | a tight group: icon plus label |
| `gap-4` | controls, or related blocks    |
| `gap-6` | sections                       |
| `gap-8` | a header zone from a body zone |

## Density grades

Four grades, set by `--density-{compact,cozy,comfortable,scan}`:

- **Compact**: the sidebar.
- **Cozy**: the strips inside a pane, the composer, tool/system transcript rows.
- **Comfortable**: human and assistant prose. Built for reading.
- **Scan**: the stage board and other card grids. Tuned for sweeping down a
  column of cards, not reading one.

## Color and tone resolution

- **One tint helper, one stage map.** Tones go through `tintClasses(tone)`.
  Stage colors go through `STAGE_TONE`. No per-file tone maps.
- The stage tones: attention `warning`, running `info`, in review `success`,
  done `merged`, building neutral.
- Elevation is a four-step ramp: canvas < panel < rail/chip < floating. To lift
  something, move one step up the ramp. Never invent a shade.

## Icon and tone vocabulary

One module holds two maps with the same keys. One maps a concept to its icon,
the other maps it to its tone. The second map's type comes from the first, so a
concept cannot get an icon without a tone, or a tone without an icon.

- **One icon per concept.** If a concept already has an entry, never import a
  lucide symbol for it locally. Add the concept to the map instead.
- **One tone per concept, passed alongside the icon** as a pair where it is
  used.
- **Tone is meaning, not decoration.** `questions` is `warning` because a
  question blocks someone. `decisions` is `success` because it is settled.
  `plans` is `draft` because a plan is a proposal, not a settled fact. `sentry`
  is `danger` because it is errors. `terminal` and `settings` are `neutral`
  because they are plumbing. Giving a concept a new color changes what it
  claims.

Eight tones (`success`, `info`, `warning`, `danger`, `primary`, `merged`,
`draft`, `neutral`). Each one resolves through the single accessor
`tintClasses(tone)`. Components take a `Tone` and call it. They never
hand-write `bg-warning/10`. Every solid semantic fill uses the shared `on-tone`
text colour.

### Identity palettes

Identity colour names an object instead of describing its state. Two workflows
running at once are both `info`, and that is exactly the pair a reader needs to
tell apart. So a run and a workspace get a colour that says "this one" and
nothing more.

One set serves every object that needs a name: `--color-identity-1` to
`--color-identity-8` in `apps/desktop/src/styles.css`, chroma 0.09 on eight
hues, with no red. Two accessors read it, and nothing else does:

- `runIdentity` in `apps/desktop/src/features/session/timeline/runIdentity.ts`
  picks a start slot per session from a hash of the session id. Then it walks
  the set with stride 3 across workflow runs and agent chains, ordered by
  creation time and id. 3 and 8 share no factor, so every slot is used before
  one repeats. It gives four versions of one slot: `stroke` for an SVG lane,
  `chip` for the run's own chip, `mutedChip` for a discarded run's chip, and
  `spin` for the running border. `runIdentityStroke`, next to it, turns the
  index the rail geometry carries back into a stroke.
- `workspaceAccent` in `apps/desktop/src/features/workspace/color.ts` hashes a
  workspace id onto the same eight slots for its sidebar dot.

Three limits keep identity small:

- Identity never reads as a tone. `token-contrast-floor.test.ts` keeps every
  identity colour at oklab delta e 4.5 or more from every tone, and at 4.5:1
  as text on every surface. A violet lane is not a plan. A lane colour says
  nothing beyond "these rows are one run".
- Identity colours the lane, the run chip that names it and the workspace dot,
  nothing else. Stage stays in the marker on top of the lane, which still goes
  through `tintClasses(tone)` like everything else.
- The run chip is the only component tinted from identity instead of from a
  tone. So on purpose it is **not** a `Chip`. `TimelineRunChip` in the
  timeline feature owns its own surface, and the palette never enters
  `packages/ui`.

A run row carries the chip, one title and at most one short status line.
`TimelineRunLabel` prints the workflow name as that title with a single
`truncate`, and never the run goal: a goal is a document and lives in the
workflow detail. A preset or custom workflow names itself in the chip tooltip.
When any step of the run, at any depth, waits on an open question,
`runOpenQuestion` picks the oldest one. The run row then takes the question
marker, says "Needs your answer in step 4.2" in the warning tone, and shows a
visible Answer in the warning outline. Answer calls `focusQuestion` and opens
the questions lens on that exact question. Every Answer on the feed (agent,
question and run rows) is the same action.

Agent kinds (`--color-agent-*`) and provider glyphs (`--color-provider-*`) are
identity palettes of their own. Each has a single accessor and is held to the
same floor test. Anything else that reaches for an identity colour is a bug.
Add a tone instead.

### Lane vocabulary

The activity feed draws its structure instead of indenting it. Four ingredients
make up the whole grammar. Nothing outside this list may appear on the rail:

| ingredient | value                                                       | meaning                                                   |
| ---------- | ----------------------------------------------------------- | --------------------------------------------------------- |
| spine      | 1px, `--color-border`, solid, unbroken on every row         | the session's own thread                                  |
| lane       | 2px, identity hue, solid                                    | a run whose steps have happened                           |
| join       | quarter curve between spine and lane at a row's marker line | a run departing at its origin or merging when it finished |
| stub       | 1px, `--color-border`, offset one column                    | a standalone agent's fan-out, which belongs to no run     |

The spine is the backbone of the feed. It is full height, always drawn, never
tinted and never broken.

### What a rail line says

**Pattern is time.** Solid means this line's own work has happened. Dashed
means it has not happened yet. The switch from solid to dashed sits at the
running step, so the switch itself reads as progress. Dashed means nothing
else, on any line, at any depth. A dashed stretch always points toward NOW.

A discarded run keeps its pattern and its identity hue, and dims to
`TERMINAL_DIM` on every lane segment and join it owns. That is the same dim a
finished row uses. Its chip switches to the `mutedChip` version.

The stub exists because identity names a run and nothing else. A standalone
agent's children are still session work. So their offset line stays in the
neutral spine colour and does not borrow a run's colour.

Geometry is computed in
`apps/desktop/src/features/session/timeline/railGeometry.ts`. The lane offset is
one 16px unit per level. Rows are laid out against `timelineRhythm.ts`. Its
grades fix line height, box height and marker size, so a marker centres on its
label's line and not on its row box.

Two rules follow from the direction of time. Newer sits above older at every
level. So a run's origin row is the bottom of its group and its steps stack
upward. And a dash always points toward NOW, because dashed means future.

Queued steps follow the same direction. They sort by step path, not by the
order the agents were created in, so a run's 7, 6 and 5 sit above step 4's
queued 4.3 and 4.2. One dash per run reaches NOW. A child lane that still has
work queued ends at its newest row and rejoins its parent lane there with a
dashed join (the `rejoining` group shape), under the parent's next step. A
child lane with no ancestor lane continuing above it stays open to NOW instead.

A third rule covers what the feed shows: **everything, always**. Nothing in the
feed collapses, summarises or hides behind a count. No row or divider has a
disclosure control. Density is the only protection against a wall of rows, and
it comes from the grades in `timelineRhythm.ts`, not from hiding rows.

## z-index tokens

Named tokens in `apps/desktop/src/styles.css` under `@theme`, with keys
`--z-index-*`. Tailwind v4 turns each key into a `z-<name>` utility. The order
is a precedence chain (each layer must sit above the one below).
`docs/styling.md` owns the reasoning. This table is only the registry.

| token                        | value | who                                                                                            |
| ---------------------------- | ----- | ---------------------------------------------------------------------------------------------- |
| `--z-index-studio`           | 50    | the `AppShell` studio slot and the launcher's viewport `StudioShell`, the floor: never lowered |
| `--z-index-popover-backdrop` | 55    | click-catcher behind the app-global popovers                                                   |
| `--z-index-onboarding`       | 60    | the onboarding wizard over a studio                                                            |
| `--z-index-drag`             | 62    | the workflow studio drag ghost                                                                 |
| `--z-index-popover`          | 65    | the app-global popovers                                                                        |
| `--z-index-command-palette`  | 70    | ⌘K, which fires whatever else is open                                                          |
| `--z-index-tooltip`          | 75    | triggerable from inside a popover or the palette                                               |
| `--z-index-toast`            | 85    | the toast stack                                                                                |
| `--z-index-lightbox`         | 90    | the image lightbox, above everything z-indexed                                                 |
| (native `<dialog>`)          | n/a   | the browser's top layer, above every z-indexed element                                         |

## Primitives

The register taxonomy, and the rule that all registers share one family, live
in [DESIGN.md](../../DESIGN.md). The barrel file is the list of primitives. A
list in a doc goes stale, `src/index.ts` cannot. If a register needs a shape
the family does not have, add it to the family. A register never keeps a
private one.

## Pane anatomy

The package ships the pane primitives `PANE_RHYTHM`, `ScrollFade`, and
`Divider`, not a pane frame. `PaneShell` is a desktop component at
`apps/desktop/src/shared/components/PaneShell/`, built from those primitives.
It is a scroll region whose body is a centred column. It has one `h1` per
surface. `meta` holds counts and totals in `tabular-nums`, never a control. The
header row wraps, so actions drop under the title instead of squeezing it. The
pane owns the gap below the header, and children add no top margins. The root
is `min-w-0 flex-1` in both scroll modes, so inside a flex row such as
`StudioShell` it fills the pane and the column centres in the full width.

**One title grade.** Every lens pane and studio detail gets its title from
`PaneShell`: an `h1` at `text-xl`, then an optional description, meta and
actions. `icon` takes a concept glyph, `glyph` takes a brand mark. A detail
that needs its own header row passes `HeaderBand` (also an `h1`) through the
custom `header` slot. `scroll="body"` keeps the header fixed above a divider
for studio details. Studio chrome (`OverlayHeader`) and the focused-pane lens
label are window chrome, not headings. The header is named with `aria-label`,
so the detail title is the only `h1` on the surface.

**The reading column caps at `max-w-5xl` and centres.** That is 1024px, which
is also the window's minimum width. So the cap never applies at minimum size.
There, the sidebar and the pane insets set the width. The cap is for wide
monitors, where a paragraph with no cap runs past a comfortable line length.

`wide` is the escape hatch for a workbench, not for a long document. It is
applied only in one case: the workbench goes full width, but its empty state
stays in the reading column. That way an empty pane never shows a 2000px-wide
dashed box.

## Action zones

Which action goes in which zone is decided in [DESIGN.md](../../DESIGN.md#action-zones). The slots that carry it:

- The fixed chrome row has one flexible context region, followed by one action region that never shrinks away. It is pushed to the far end and stays outside the content scroller. `StudioShell` exposes it as `headerAccessory`, `HeaderBand` as `actions`, and inspector headers use the same `actions` slot. The focused object's primary action uses it too.
- A creation or edit flow's action row is the one the creation grammar below describes. It is never stretched across a shell or container that also holds unrelated content.
- A section-scoped action uses `SectionHeader.action`. A field control uses `FieldRow`. Neither one moves itself up into global chrome.

`InlineConfirm` stays attached to a destructive trigger in its action region. A confirmation detached in the body, or a destructive footer dock, is not another zone. It is the only confirmation body, and it shows in exactly one of three placements, picked by how much room the trigger has:

- **Row swap**: a trigger inside a row with width (a `FieldRow`, a section footer) is replaced in the same slot by the `card` surface.
- **Anchored**: a small trigger (icon button, sidebar row action, header action, rail row) opens `ConfirmPopover`, which shows the `plain` surface in an `AnchoredPopover`. Escape and a click outside cancel. The popover stays open and busy while the confirm runs.
- **Menu swap**: a destructive item in an open menu or popover replaces the menu body with `InlineConfirm surface="plain"` in the same popover.

A card `InlineConfirm` inside a popover, or one floated with `absolute top-full`, is a bug (`inline-confirm-placement.test.ts`). The trigger is ghost or secondary with danger text. The solid danger fill shows only on the confirm button. The title says what will happen. The description says what survives and how to undo it. Reversible actions use `role="alert"`, irreversible ones `role="danger"`.

**Copy feedback lives on the control.** `useCopyLink().copy({ text, key })` keys the copied state, so in a list only the row whose `key` matches flips to "Copied". A successful copy never toasts; a failure shows inline while the control stays mounted, and only a menu item, which unmounts on click, reports a failure through a toast. `CopyButton` reads "Copy", "Copied", "Copy failed".

## Section rhythm

`PANE_RHYTHM.stack` separates peer sections. `Divider` separates regions whose boundary matters. Section children do not add margins. `SectionHeader` is the standard section heading, with an optional description. The eyebrow size is the default for every surface. `size="page"` is only for a document whose body is prose the reader came for, such as the guide or a creation flow's form sections. Description copy comes only through `hint`, so its size and muted tone stay matched to the heading grade.

**The outline is independent of the grade.** `headingLevel` turns an eyebrow-grade label into an `h2` or `h3`. So a pane section keeps its place in the document outline without taking the page grade. A section that needs a heading does not need bigger type because of that.

`SectionSurface` is `SectionHeader` on the one raised section surface. Use it
for a reading surface whose sections would otherwise be separated by empty
space alone. It sits one step above the canvas, so the cards inside it reach
the top of the ramp and nothing stacks a fourth level. A metadata line is not a
section and does not get a surface. Its optional `icon` goes to the heading,
the same slot `SectionHeader` gives it, at the row icon size.

`Eyebrow` is a label primitive for metadata, statistics and small internal groups. It is also the only uppercase label. A standalone label with `uppercase` renders `Eyebrow` (inside a heading element when it titles a region), never a hand-made `uppercase tracking-*` span. Chips and badges use sentence case: `Chip` has no uppercase option, and a status or kind chip has a sentence-case label. Arbitrary `tracking-[…]` values are rejected (`uppercase-label-uses-eyebrow.test.ts`). `Eyebrow` does not replace `SectionHeader` when a section also needs an action or description. `FieldRow` owns a form field's label, help copy and control alignment. It does not title a section. When these roles overlap, `SectionHeader` wins for the section, and then `FieldRow` labels the controls inside it. `Divider` is a sibling between regions, never decoration after every heading or field.

## Prose disclosure

`ClampedProse` is the only multi-line prose clamp. It accepts one to six lines, renders the text as preview markdown, and shows the complete text in place through Show more and Show less. Do not apply `line-clamp-*` directly to prose, and do not slice a display string. Single-line identity labels may use `truncate` when their full value is available from the focused object or an accessible disclosure.

Artifacts exempted by `DESIGN.md`, including the text of an open question, never use `ClampedProse`.

## Card action grammar and creation grammar

**One card action grammar.** Two fixed slots. Navigation sits top right and is
always visible. Lifecycle and destructive actions sit bottom right. Hover may
show lifecycle actions without moving either slot, and keyboard focus shows the
same. Icon actions use the shared `Tooltip`, never the native `title`. A
hover slot keeps its width at rest: it fades with `opacity-0
group-hover:opacity-100 group-focus-within:opacity-100`, never `hidden
group-hover:flex`, and the row's primary action stays outside it, visible.

**A control whose only content is an icon carries a tooltip, everywhere.** The
`aria-label` names it for assistive tech but gives the mouse user nothing. So
`IconButton`, `OverflowMenu`, `CopyButton` and `RefreshIconButton` wrap
themselves, and a hand-rolled icon button wraps itself in `Tooltip`. The native
`title` waits a second, shows in the OS style and not ours, and cannot be
positioned or styled. Pass `tooltip` when the control needs to say more than
its accessible name. `IconButton` refuses a `title` at the type level.

There is no exception for a control that can go `disabled`, and no native
`title` for that state either. A disabled element sends no mouse events and
cuts the event path above itself. So listeners on the control stop working in
exactly the state where the user most needs to know why nothing happens.
`Tooltip` handles that itself. When a trigger declares `disabled`, `Tooltip`
adds an anchor span. The span carries the listeners and takes `pointer-events`
away from the disabled control. So the hover lands on the anchor, and the
tooltip still opens. If a trigger needs its anchor shaped (because it is out of
flow or stretches), pass `anchorClassName`. Do not hand-roll a wrapper, because
a wrapper between `Tooltip` and the control hides the `disabled` the primitive
checks. Keyboard focus still cannot reach the control while it is `disabled`.
That comes from the attribute itself. `icon-only-controls-carry-a-tooltip`
enforces the rule.

**One creation grammar.** Bare sections stacked in one column, never a bordered
box around the whole thing. Secondary controls go in `SectionHeader`'s
`action` slot. Related options sit in one container, not one card each. One
action row comes right after the last section: error on the left, exactly one
primary button on the right, cancel and alternates as ghost or secondary.

## Empty states

A lens with nothing to show has one layout: `LensEmptyState`. It is a wrapper
that fixes `bordered` and `size="inline"`, and makes `description` required.
Lenses always use `inline`. Only a surface's own main empty state gets the
large size and an `h2`. An empty lens leaves `headingLevel` unset, so it adds
nothing to the document outline.

Inline empty states belong to a lens or a compact collection surface. A filled,
borderless inline empty state belongs to a surface's own body and uses
`FilledEmptyState`, which owns its inset and fill. Do not hand-roll either
shape with `EmptyState size="inline"`.

**Inline beats the centred hero** because the pane already has a title and a
rhythm. A hero repeats the title in bigger type. It pretends the lens is a
landing page, when it is one of a rail full of destinations.

**The gap trap.** The parent flex container owns the spacing. So a child that
renders `<div />` or an empty fragment still costs a full gap step, and leaves
a hole nobody can trace. A component with nothing to show returns `null`. The
rail drops groups with no rows, instead of drawing a heading over nothing.

```tsx
if (count === 0) return null;
```

Groups are separated by the step the pane puts between its body children.
Rows inside one group sit tighter. That is what makes active, completed and
discarded read as three answers instead of one long list.

What "empty" means, and the copy rule for it, are product rules and live in
[DESIGN.md](../../DESIGN.md).

## Motion registry

Seven animations, one meaning each. Transition keyframes (`fade-in`,
`nav-step-in`, `nav-step-out`, `studio-in`, `studio-out`) move content between
states and sit outside the registry.

- `spin-border`: working.
- `border-pulse`: a warning-stage card needs you.
- `attention-ring`: something new arrived. It is a short outward breath (three
  cycles, then rest) on an element that now needs the user, never one that
  is working.
- `soft-pulse`: the only animation in the app for a lasting state. It breathes
  a state that holds and is alive: the Providers launcher icon (never its
  label) while no provider is connected, the centre dot of the running marker
  on the activity rail, a running tool icon or scout dot, and the boot splash
  status. On the rail it sits inside the `spin-border` ring, so the pair reads
  as one running state, not two claims. The bar for another lasting-state
  animation is high.
- `cost-chip-pulse`: the spend meter just ticked. One 1100ms halo, paired with
  the digit roll.
- `text-shimmer`: a label whose action is in flight, such as a handoff while
  its agent starts. It replaces a spinner next to the label.
- Skeleton pulse (`animate-pulse` inside `Skeleton` only): loading.

`no-token-bypass.test.ts` rejects any `animate-pulse` or `animate-ping`
outside `Skeleton`.

Motion-safe gating, "motion confirms, never decorates", "motion names who is
working, and for how long", and "Spinners are forbidden" are product rules and
live in [DESIGN.md](../../DESIGN.md).

## Alignment and truncation

**A column holds its width.** A chip repeated down a list takes a fixed width.
In a right-aligned cluster, variable text comes first and glyphs last.

**Truncation order is designed, not accidental.** In the top bar, the identity
column has the only width cap and truncates first. Everything to its right is
`shrink-0`, so signals and controls keep their click areas while the name gives
way. In the rail, the label truncates and the count is `shrink-0`, so a long
label loses characters before a count disappears.

**The chrome shares one left axis.** The collapsed rail is
`COLLAPSED_RAIL_WIDTH` (44px, exported by `AppShell`) and its buttons center on
22px. The top bar starts at `pl-1.5`, so the workspace avatar centers on the
same 22px. Change one side and the other moves with it:
`workspace-avatar-centers-on-collapsed-rail.test.ts` compares the two centers.
Widening the rail to fix a padding is the wrong trade, because chrome pays rent.

**An inline trigger inside `AnchoredPopover` passes `anchorClassName="flex"`.**
The anchor is a block `div`, so an `inline-flex` trigger (a `Chip`, a pill)
sits on a line box as tall as the inherited body line height and lands on its
baseline, 1 to 2px under the center of a flex cell. The Beta and Sponsor pill in
the footer did exactly that. A trigger that is already `flex` is block level
and needs nothing. Never correct the drift with `translate-y`.

**A repeated row is read down a column, not across a line.** So anything whose
width follows its content breaks the column for every row under it.

- A label chip in a repeated row has a fixed width (`Chip`'s `width`
  prop). `auto` is for one-off chips in a detail panel, never a column. A
  fixed-width wrapper around the chip does not count. It aligns what comes
  after the chip and leaves the chip ragged.
- A chip that works as a control next to buttons (the session overview's
  context, attention, linked-work and branch chips) is `Chip size="control"`
  with `shape="badge"`. That gives the `h-6` control height, the focus ring,
  and a tone hover. A custom element that needs the same frame (a popover
  trigger with its own ref) takes `chipClasses`, never a local class string.
- In a right-aligned cluster, variable text comes first and glyphs last. What
  sits nearest the edge must be constant-width, or it wanders from row to row.
  In a left-aligned cluster the glyph comes first. The test is where the group
  is anchored, not what looks tidy in one row.
