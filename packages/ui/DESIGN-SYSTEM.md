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

## Surface ladder

Six opaque roles, from the back of the window to the eye. Components step
between them instead of mixing one surface through opacity.

| step | role     | class           | holds                                                 |
| ---- | -------- | --------------- | ----------------------------------------------------- |
| 0    | chrome   | `bg-chrome`     | the app frame: top bar, sidebar, footer, studio rails |
| 1    | sheet    | `bg-background` | the content sheet, a studio's detail, viewer dialogs  |
| 2    | panel    | `bg-subtle`     | a drawer that pushes the column, `SectionSurface`     |
| 3    | inset    | `bg-muted`      | opaque rails, highlighted code rows                   |
| 4    | raised   | `bg-elevated`   | cards: board cards, `RailCard`                        |
| 5    | floating | `bg-floating`   | popovers, menus, centred dialogs, toasts, the palette |
| 6    | tooltip  | `bg-foreground` | the inverted chip, above everything                   |

Dark mode brightens one step at a time, 1.06 to 1.09:1 between neighbours.
Light mode is ink on paper, read on two axes. On the elevation axis (what sits
in front) chrome < content < raised = floating: nothing is brighter than white,
so above raised the lift is `shadow-lg` plus `border`. On the nesting axis
(what sits inside) content > panel > inset: the deeper, the darker.

Two tokens are relations, not steps. `fill` is one step inside whatever parent
it sits on (white 6% in dark, black 5% in light), so a neutral chip, a
secondary button or a skeleton moves the right way on any surface. `idle` is
the single grey for "not yet" and "off": pending and queued dots, an off switch
track, inactive bars. States that share it differ by shape (filled, ring,
dash), never by another opacity.

Three borders, each with one job:

| token           | job                                                              | floor                           |
| --------------- | ---------------------------------------------------------------- | ------------------------------- |
| `border-soft`   | decorative hairline: dividers, image frames, resting raised card | 1.2:1, 1.3:1 on raised/floating |
| `border`        | controls, the floating edge, card hover                          | 3:1 on every step               |
| `border-strong` | emphasis: control hover                                          | 4.5:1 on every step             |

Three translucent tokens paint over whatever sits below them: `frame-edge`
(white 8% in dark, black 8.5% in light) draws the content sheet and the
floating drawer at 1.2:1 or more on chrome and background, and
`scrollbar-thumb` and `scrollbar-thumb-active` clear 1.8:1 and 3:1 on
background, panel and floating.

A clickable card at rest carries two signals together (a fill one step above
its parent plus the hairline). Its states clear 3:1: hover `border`, selection
`bg-selected`, focus ring. `token-contrast-floor.test.ts` holds the ladder
order and every floor on all six steps, and `no-token-bypass.test.ts` fails on
any colour class with no `--color-*` token behind it.

`bg-hover` and `bg-selected` are interaction overlays painted as a
background-image layer, so they stack on whatever fill the element rests on
instead of replacing it, and `cn` keeps them beside a surface class. `scrim` is reserved for modal backdrops.

A selected row has one treatment everywhere: `bg-selected`, foreground text and
medium weight, driven by `data-selected` (`selectedRow.ts`, used by
`SelectableRow` and `RailCard isSelected`). `SegmentedTabs` follows it too: a
hairline track, `bg-selected` on the active segment, no raised pill. No ring and no primary tint mark a
selection; the focus ring stays the only ring, so focus and selection read
apart, as in VS Code and Linear lists.

A row that holds its own links or buttons is `InteractiveRow`: one overlay
button stretched over the row opens it, and the inner controls sit above it.
A `role="button"` div with its own key handler and propagation stopping is not
another pattern. A settings-style rail entry with an icon, a subtitle and a
status dot is `StatusRailItem`. Its dot is optional: without a `tone` it draws
none, so a rail shows tone only on the rows that need attention, and
`statusLabel` names a dot that no subtitle explains. `density="compact"` is the
tighter child row under a rail heading. The row never indents itself: every
child list under a rail heading takes `PANE_RHYTHM.navRail.nest`, so child
icons line up under the parent label and every nested list indents by one
step.

## Type scale

Features name a **type role**, never a size, a leading, a weight and a
tracking one by one. Each role is a `--text-*` token in `styles.css`, or an
`@utility` when it also sets case or family, and fixes size, a whole-pixel line
box, weight and tracking together. `cn` reads every role as a font size, so a
later role or grade replaces an earlier one and a text colour never drops it.
The list is `TYPE_ROLES` in `typeRoles.ts`.

| role             | measure                       | used for                                                   |
| ---------------- | ----------------------------- | ---------------------------------------------------------- |
| `text-display`   | 24/32, 600, -0.01em           | onboarding titles, the `EmptyState` hero, the Impact title |
| `text-title`     | 17/24, 600, -0.005em          | the one pane title (h1) of a surface                       |
| `text-heading`   | 14/20, 600                    | a page-grade section, a popover title, a kickoff question  |
| `text-row`       | 14/20, 500                    | a top-level row label, a card title                        |
| `text-body`      | 14/20                         | running text; text with no class inherits it from the body |
| `text-prose`     | 14/22                         | messages, markdown, artifacts                              |
| `text-label`     | 12/16                         | controls, a nested row, a status label                     |
| `text-secondary` | 11/16                         | a secondary line, a chip, an option description            |
| `text-eyebrow`   | 11/16, 600, 0.08em, uppercase | a section label, only through `Eyebrow`                    |
| `text-meta`      | 10/14, tabular                | time, ordinal, cost, count                                 |
| `text-code`      | mono 12/18                    | branch, path, command, inline code                         |

A role with no weight inherits one: `text-label font-medium` is a control label
at 500, `text-secondary font-medium` a chip. Weights are 400, 500 and 600, and
600 belongs to display, title, heading and eyebrow. Tracking lives only inside
the roles. A leading utility still composes with a role
(`text-secondary leading-none` for a one-line badge), because the role reads
the leading before its own line box.

The raw grades stay defined, each on a whole-pixel line box: `3xs` 10/14, `2xs`
11/16, `xs` 12/16, `sm` 14/20, `base` 15/24, `lg` 17/24, `xl` 20/28, `2xl`
24/32. New code does not reach for them. `forbidden-patterns.test.ts` counts
raw sizes, weights, leadings and tracking per file, and the count only goes
down. `scripts/codemods/type-roles.mjs` (`pnpm codemod:type-roles`) rewrites
the combinations that map one to one (`text-sm font-medium` to `text-row`,
`text-3xs` to `text-meta`, `text-sm leading-relaxed` to `text-prose`); the rest
moves by hand, area by area. Arbitrary sizes are covered by
[docs/styling.md](../../docs/styling.md).

The `html` root stays 15px while any `rem` remains. `body` and `#root` are
14/20, so text with no class lands on the body role instead of 15/23.25.

### One role per job

The role follows what a thing **is**, not which file draws it. A row label is a
row label in the activity feed and in a brief, so it takes the same role in
both. The session Overview is the reference surface. Its density was tuned on
purpose. Window zoom scales every surface at once. So if another surface uses a
larger role for the same thing, the user has to choose between a comfortable
Overview and a comfortable everything else.

**Prose is the one exception. It is a reading grade, not drift.** Human and
assistant transcript messages, a markdown body and any artifact the reader came
for stay on `text-prose` or `text-body`. Making those smaller makes the app
worse. The chrome around prose still takes the role its job asks for. A
document pane's section label is an eyebrow even when the body under it is
prose, because `DESIGN.md` compresses chrome without limit and never the
artifact.

## Radius scale

One concentric family: an inner radius is the outer radius minus the padding
between them, so a popover at 8 with 4 of padding holds rows at 4.
`no-token-bypass.test.ts` rejects bare `rounded` and arbitrary `rounded-[Npx]`.
Bare `rounded` comes out at 3.75px on the 15px root, so it is always written
`rounded-sm`.

| token           | value | used for                                                        |
| --------------- | ----- | --------------------------------------------------------------- |
| `rounded-frame` | 10px  | only the content sheet and the floating drawer                  |
| `rounded-lg`    | 8px   | surfaces: cards, popovers, menus, bands, notices, toasts        |
| `rounded-md`    | 6px   | controls: buttons, inputs, triggers, icon buttons, sidebar rows |
| `rounded-sm`    | 4px   | role pill, kbd, inline code, checkbox, rows inside a popover    |
| `rounded-full`  | n/a   | avatars, nodes, status bars, thumbs                             |

## Elevation

Five levels plus the tooltip. A level sets surface, shadow, border and radius
together, and there is no arbitrary shadow.

| level      | surface                          | shadow      | border                        | radius                     | holds                                 |
| ---------- | -------------------------------- | ----------- | ----------------------------- | -------------------------- | ------------------------------------- |
| 0 frame    | `chrome`                         | none        | none                          | n/a                        | top bar, sidebar, footer, studio rail |
| 1 sheet    | `background`                     | none        | `frame-edge`                  | `frame` where chrome wraps | content, studio detail                |
| 2 band     | `fill` (band), `subtle` (drawer) | none        | none                          | `lg` band, `frame` drawer  | groups, a drawer that pushes          |
| 3 card     | `elevated`                       | `shadow-sm` | `border-soft`, hover `border` | `lg`                       | board cards, `RailCard`               |
| 4 floating | `floating`                       | `shadow-lg` | `border`                      | `lg`                       | popovers, menus, toasts, dialogs      |
| 5 tooltip  | `foreground`                     | `shadow-md` | none                          | `md`                       | tooltips                              |

A drawer in overlay adds `shadow-xl`. Outside the tooltip, `shadow-md` belongs
only to a dragged card.

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

## Color and tone resolution

- **One tint helper, one stage map.** Tones go through `tintClasses(tone)`.
  Stage colors go through `STAGE_TONE`. No per-file tone maps.
- The stage tones: attention `warning`, running `info`, in review `success`,
  done `merged`, building neutral.
- Surfaces follow the six-role ladder above. To lift something, move it to the
  role it plays; to sink something inside a parent, use `fill`. Never invent a
  shade.
- Tone variants have fixed names, all owned by `tintClasses`: `solid` (full
  fill plus `on-tone`, only the primary CTA and confirmed destructive buttons),
  `bg` (10% wash, never a signal on its own), `text` (tone text, readable on its
  own wash), `border` (40%, decoration, never the only signal), `rail` (full
  tone left border, for a card or strip whose edge carries meaning; neutral is
  `border-l-border`) and `bgSoft` (5%, only for washing a whole card). The
  neutral `bg`, `bgSoft` and `solid` sit on `fill`, so a neutral chip sinks one
  step into any parent.

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
- **On an artifact, colour says the state, never the kind.** `plan`, `report`
  and `wireframe` are `neutral`: the glyph and the word name the kind. A plan
  nobody ran is `warning` (the next click is yours), one that ran is `success`,
  a replaced or discarded one is `neutral`, and `merged` never appears on an
  artifact. In the report kit, `decision`, `summary`, `goal` and `note` are
  neutral structure, `risk` and `question` are `warning`. A kit callout is a
  neutral surface with a tone rail and a toned icon, never a tinted fill.

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
  one repeats. It gives five versions of one slot: `stroke` for an SVG lane,
  `chip` for the run's own chip, `mutedChip` for a discarded run's chip,
  `litChip` for the chip while its lane is hovered, and `spin` for the running
  border. `runIdentityStroke`, next to it, turns the
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
`TimelineRunLabel` prints the run title (`run.title`, falling back to the
workflow name) with a single `truncate`, and never the run goal: a goal is a
document and lives in the workflow detail. A preset or custom workflow names itself in the chip tooltip.
When any step of the run, at any depth, waits on an open question,
`runOpenQuestion` picks the oldest one. The run row then takes the question
node, says "Needs your answer in step 4.2" in the warning tone, and shows a
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

### A lane is a control

The coloured lane is the run, so it opens the run. Every row draws a
transparent 12px hit area centred on each run lane that crosses it, child
lanes included, because a child lane is the same run one column over. A click
anywhere on it opens the workflow, however far the origin row has scrolled
away. A click on the row text still opens the row's own leaf (the agent, the
question, the artifact). The node on the lane lets the pointer through to the
lane. Hovering a lane thickens every segment and join of that run to 3px in
every row, washes its column in the run hue at 12%, lights the run chip
(`litChip`) and shows "Open workflow: <name> (⇧↵)". The hover state lives in
the activity pane, never in the store. The hit areas stay out of the tab
order: from the keyboard, Shift+Enter on a focused row opens the run of its
lane (`activity.openRun` in the shortcut registry). The spine, a standalone
agent's stub and an agent chain lane are drawing only, since none of them is
a run. The workflow run tree draws the same rail without hit areas, because
it already is the run.

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
`apps/desktop/src/features/workTreeModel/railGeometry.ts`. The lane offset is
one 16px unit per level. Rows are laid out against
`apps/desktop/src/features/workTreeModel/timelineRhythm.ts`. Its grades fix
line height and box height (entry 40px, step 32px, queued 26px), so a node
centres on its label's line and not on its row box. Every grade carries the
same 20px node.

Two rules follow from the direction of time. Newer sits above older at every
level. So a run's origin row is the bottom of its group and its steps stack
upward. And a dash always points toward NOW, because dashed means future.

Queued steps follow the same direction. They sort by step path, not by the
order the agents were created in, so a run's 7, 6 and 5 sit above step 4's
queued 4.3 and 4.2. One dash per run reaches NOW. A child lane that still has
work queued ends at its newest row and rejoins its parent lane there with a
dashed join (the `rejoining` group shape), under the parent's next step. A
child lane with no ancestor lane continuing above it stays open to NOW instead.
A child lane closes on its newest row once its parent and every child have
settled, and at once when you close the parent. An agent you closed counts as
settled, so a lane waiting on it stops reaching NOW.

**A dashed stretch exists only while work is scheduled above it.** Scheduled
means a row that is running, waiting on you (a question, a ready step, a spend
limit) or queued to start by itself. When the newest work failed, was stopped
or was closed by you and nothing else is scheduled, the lane ends on that node
with the `closed` group shape: no dash toward NOW and no rejoin elbow, because
the work stopped rather than came back. `merged` stays for groups that finished
well. A run halted on a failed step closes its lane until a step runs again.
Queued children of a failed parent cannot start, so they do not hold the lane
open. Queued children of an agent you closed draw as skipped. Both shapes come
from each row's `RowState` in `buildTimelineStream`, not from a second status
check.

Suggestions are not scheduled work, so they never draw a dash. They sit in one
**Suggested next** strip above NOW, on a `bg-subtle` surface aligned with the
row text, with no rail and no node: an eyebrow, then one line per suggestion
with its glyph, title, detail and one action. A suggestion leaves the strip
once its work exists, for example a plan once an agent consumes it.

The workflow detail uses the same vocabulary for one run. Its run tree has no
session spine: `layoutTimelineRail` runs with `hasSpine: false`, the run lane
takes column 0 and starts on the run's first step (a lane whose origin row is
one of its own members draws a straight line there, not a branch join), and
children take column 1. There is no run row and no time column; everything
else, dashes, rejoins and nodes, is the feed's.

A third rule covers what the feed shows: **everything, always**. Nothing in the
feed collapses, summarises or hides behind a count. No row or divider has a
disclosure control. Density is the only protection against a wall of rows, and
it comes from the grades in `timelineRhythm.ts`, not from hiding rows. A queued
step is a row of its own with its own dashed node, never a count behind one
clock glyph.

### Work nodes and row states

Every surface that draws a sequence of work (the activity feed, the workflow
run tree, the agents on a project) draws its nodes with one primitive,
`WorkNode` in `packages/ui/src/components/WorkTree/`. It is 20px on every
grade, sits on the canvas so the lane never shows through it, and knows
nothing about agents: the caller hands it a state, a mark and a label.

| node       | ring                                    | centre                   |
| ---------- | --------------------------------------- | ------------------------ |
| `queued`   | 1.5px dashed, `faint-foreground`        | local index, faint       |
| `ready`    | 1.5px dashed, `warning`                 | play triangle, warning   |
| `running`  | 2px `border-soft` track + `spin-border` | local index, or info dot |
| `question` | 1.5px `warning`                         | `?`, warning             |
| `budget`   | 1.5px `warning`                         | `$`, warning             |
| `failed`   | 1.5px `danger`                          | `!`, danger              |
| `done`     | 1px `success` over a `success/18` fill  | check, success           |
| `closed`   | 1px `border`                            | check, muted             |
| `stopped`  | 1px `border`                            | small square, muted      |
| `skipped`  | 1px `border-soft`                       | dash, faint              |
| `marker`   | `ring-1` in the concept tone            | the concept glyph        |

A node can also take `progress`, measured active time over the usual time,
from 0 to 1 and clamped. A `running` node with progress draws a 2px `info` arc
from twelve o'clock over the `border-soft` track instead of `spin-border`, and
the `soft-pulse` head sits on the end of the arc. A `question` or `budget` node
keeps the arc frozen in `warning` over a `warning/35` track, with no motion.
A `failed` node never draws the arc. The arc steps with the panel's 5 second
clock and never animates between values: a ring that glides for nine minutes
decorates, it does not confirm. Without progress the node is the table above.

The number inside is the local index (`2` for step 4.2). The full path stays
in the ordinal column of the row, because it survives when the number turns
into a check. A row outside a sequence (a standalone agent, a run origin)
carries a dot instead of a number, and a fact row (plan, artifact, event,
issue, question) carries its concept glyph. A state that asks something or
broke replaces the number with its glyph, so colour never speaks alone.

What a row is doing is computed once, as a `RowState` (phase, reason, ask), in
`apps/desktop/src/features/workTreeModel/rowState.ts`. Every surface reads that
value: the node comes from `rowStateNode`, the short status sentence after the
title from `rowStateSentence`, and the single visible action from the ask.
When several conditions hold, failed wins, then waiting (an answer, then the
next click, then the spend limit), then running, then queued, then done. The
summarizer briefing the next step and a chat turn in flight are the machine
working: they read as running, never as "Needs you". A run you stopped reads
as `stopped`, an agent you closed as `closed`: finished is not the same as
succeeded.

### Work meta

The right end of a work row is `WorkMeta` in
`packages/ui/src/components/WorkTree/`. Its columns have fixed widths from
`WORK_META_COLUMN`, so every row reads down the same columns and a cost of
`$12.40` never pushes the model of the row above out of line.

| column     | width | holds                                                        | in a narrow row                                             |
| ---------- | ----- | ------------------------------------------------------------ | ----------------------------------------------------------- |
| routing    | 136px | provider glyph, model, then one detail (`Sonnet 5 · High`)   | detail goes under 720px, name under 440px, gone under 360px |
| time       | 96px  | measured time or estimate ("~3-7m left", "~6-9m", "14m")     | 80px under 640px, gone under 360px                          |
| cost       | 56px  | what the row has spent, empty before anything is spent       | under 560px it leaves the row                               |
| cost range | 72px  | an estimated cost range before a step starts (`isCostRange`) | under 560px it leaves the row                               |
| action     | 76px  | the one visible action, reserved even when empty             | never drops                                                 |
| menu       | 24px  | the row menu, like Close workflow on a run row               | never drops                                                 |

A row inside a `WorkTimeProvider` always renders the time column, empty when
it has nothing to say, so the columns stay in line. The cost column follows
the same rule: `cost={null}` keeps an empty column, and leaving `cost` out
drops it, as the builder does for a plan with no measured estimate yet. A
run row has no routing: its step progress sits in the routing column and its
time in the time column.

The narrow rules are container queries, never window breakpoints, because
the same feed sits in a wide overview and in a split pane. The activity feed
puts the container on each row's content box (`WORK_ROW.container`, right of
the time gutter and the rail), so the widths above are the room the label and
the meta share, not the width of the panel. The label always gets what the
meta leaves: below 520px a role chip hugs its word and a run chip keeps only
its glyph, and the row state after the title reads its short form ("Needs
you", "Step 3 ready") under 880px, with the full sentence in its tooltip. The
state never shrinks; the title truncates first, down to a 64px floor
(`WORK_ROW.title`), and the meta leaves before the title reaches it: the
routing detail, then cost, then the model name, then under 360px the glyph and
the time, then under 320px the row state (the node and the action still say
it). The model outlives the cost because a narrow row, like the right drawer,
still has to say who is working; the cost stays in the time tooltip. A list under 440px also
drops the time gutter; the day and Now labels move beside the rail. Label segments keep their
leading words and tokens whole ("Opened #612:") and only the last segment
truncates. The "Open ↵" hint takes room only while a row of 640px or more is
hovered or focused. What leaves the row stays in the routing tooltip, which
always reads the whole route ("Claude · Opus 5.5 · High"). The routing column
is `RoutingLabel isColumn`, with no fill and no chip. Its words come from
`routingLabelParts`, the same function behind the model picker trigger, so a
row, the trigger, the queue and a header say a route the same way: the Codex
variant and the checkpoint belong to the name (`GPT 5.6 Sol`), the Cursor
modes and the effort are details. Planned routing (a step that has not
started) is faint; routing that ran is muted. The detail is faint while the
effort is only planned and takes the row tone once the run reports the effort
it was started with. When the run picked something other than the plan, in
model, provider or observed effort, the whole cell is underlined dotted and
its one tooltip names the plan ("Planned Opus 5 High, routing picked Sonnet 5
Medium", "Planned High, ran Medium"). Nothing is struck through. The activity
feed, the workflow run tree and the Subagents tree of a Brief all end their
rows with this meta, so a step and its sub-agents read the same wherever they
appear. Headers, cards, tables and the queue use the inline `RoutingLabel`.

### The plan in the workflow builder

The builder draws the plan with the same grammar, because the form is a
preview of the run. Every row is future, so every node is `queued` with its
number and the lane is dashed in the run's identity colour. There is no
ordinal column: nothing in the form can turn into a check. Each row draws
its own lane segment over its own height, so an expanded row lengthens its
segment and needs no second lane engine. Step 1 sits at the bottom, just
above the launch bar, and **Add step** is the top node, because the future is
up. The list keeps run order in the DOM and reverses it with
`flex-col-reverse`. The form sits on the pane measure, the same column as the
workflow detail, so the plan keeps its width when the run starts. The meta
columns are `WorkMeta` with no `@container` above them, so the effort shows at
every width, since choosing it is the point of the form. The row's trailing
column is `WORK_META_COLUMN.menu`, sized to the reorder grip it holds. A row opens in place as
one group (the rule in `docs/styling.md`), and its model axes are the
`RoutingPicker` body mounted inline, not a copy of it. Once the workspace has
enough measured steps and at least one step in the plan has an estimate, each
row's time column holds its usual range and its cost column a cost range, in the same faint as the planned routing, and the
name row carries the plan's total in a muted chip. Nothing in the form draws a
percentage or an arc: nothing has run yet.

An orchestrated plan has no steps yet, so it draws the orchestrator as the
origin node and three example rows above it: queued nodes, muted role pills
and a bare bar for the title, never text or routing, under a caption that
says they are an example. They enter once, staggered 120ms apart, with the
`fade-in` transition keyframe and `animation-fill-mode: backwards`. The
entry confirms that the mode changed and that the run grows one step at a
time. It never loops, and reduced motion drops it.

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

## Notices

`Notice` is the one shape for an error, a warning, an info line or a success
that sits in the page. Its tone lives only in a left rail and in the icon. The
surface stays neutral, the title is `foreground` and the body is
`muted-foreground`. Tone never colors the text or fills the surface.

- **Tone**: `danger` (`CircleAlert`), `warning` (`TriangleAlert`), `info`
  (`Info`), `success` (`CircleCheck`).
- **Placement** changes the surface and padding, never the anatomy.
  `transcript` is transparent with no border, `inline` and `banner` sit on
  `bg-subtle` with `border-border-soft`, `floating` sits on `bg-floating` with
  a shadow. The rail is 2px in the page and 4px when floating.
- **Title names the action** that failed ("Couldn't load pull requests"). The
  body states the cause in plain words. Raw output (stderr, exit codes, paths,
  URLs) goes in `detail`, which renders behind a Details disclosure in
  monospace. `splitErrorMessage` decides whether a message is a readable
  sentence or raw output.
- **Actions stay neutral**: `Button variant="secondary"` for the recovery,
  `ghost` for an alternative. Never a tone-colored button.
- **Actions follow the notice's own width.** The notice is an
  `@container/notice`. From `@md` (28rem) the actions sit to the right of the
  text, top-aligned with a multi-line notice and centred on a title-only one.
  Below it they drop onto their own row under the body, aligned with the
  title, and wrap. Text never shrinks to make room for a button.
- **Children** render under the body at full width, for live work the notice
  owns, such as the terminal of a CLI update running inside the card.

Every message shape in the desktop app renders through it. `ErrorStrip` is a
thin `Notice placement="banner"` for a failed load with Retry. Budget alerts
and the unpriced-turns warning are banners. Guide tips, the partial brief after a step,
the branch switch confirmation and merge conflicts are `inline`. The sign-in
prompt in the chat is `transcript`. Toasts are `floating`: the toast card owns
only its timer, hover pause and dismiss, and passes its action and a ghost
dismiss button as the Notice actions. Chat errors in the desktop app go through `formatErrorForHumans`, which
turns a known provider failure into a sentence and keeps the raw text as the
detail.

## Pane anatomy

The package ships the pane primitives `PANE_RHYTHM`, `PageColumn`, `ScrollFade`,
and `Divider`, not a pane frame. `PaneShell` is a desktop component at
`apps/desktop/src/shared/components/PaneShell/`, built from those primitives,
and it is the one wrapper every main pane uses. It is a scroll region whose
crumb, header and body share one `PageColumn`. It has one `h1` per surface.
`meta` holds counts and totals in `tabular-nums`, never a control. The header
row wraps, so actions drop under the title instead of squeezing it. The pane
owns the gap below the header, and children add no top margins. The root is
`@container min-w-0 flex-1` in every scroll mode, so inside a flex row such as
`StudioShell` it fills the pane and the column centres in the full width.

**One title grade, one header height.** Every lens pane and studio detail gets
its title from `PaneShell`: the crumb row (24px, only inside a session), then an
`h1` at `text-lg` with `meta` inline and actions on the right (32px). Padding
is 12px above and 16px below, 92px in all, 128px with the optional `tabs` row.
There is no description line and no divider under the header: the text that
teaches goes in the empty state, and the `ScrollFade` edge marks the seam.
`icon` takes a concept glyph, `glyph` takes a brand mark. A detail that needs
its own header row passes `HeaderBand` (also an `h1`) through the custom
`header` slot. `scroll="body"` keeps the header fixed above a scrolling body,
`scroll="self"` hands the body a bounded region that scrolls itself (a
transcript), and `dock` pins a row to the bottom of the same column. Studio
chrome (`OverlayHeader`) and the focused-pane lens label are window chrome,
not headings. The header is named with `aria-label`, so the detail title is
the only `h1` on the surface.

**The content column is 960px and centres.** `PANE_RHYTHM.column` caps at
`--column-max` (960px of content, gutters excluded) and `PageColumn` adds the
24px gutter, 16px when the pane is under 720px wide. No view picks its own
width: the column changes only when the window changes or the right drawer
opens. `PANE_RHYTHM.hero` (640px) is only for the content of an empty state.
[docs/styling.md](../../docs/styling.md) owns the column rules.

## Action zones

Which action goes in which zone is decided in [DESIGN.md](../../DESIGN.md#action-zones). The slots that carry it:

- The fixed chrome row has one flexible context region, followed by one action region that never shrinks away. It is pushed to the far end and stays outside the content scroller. `StudioShell` exposes it as `headerAccessory`, `HeaderBand` as `actions`, and `DrawerFrame` as its one `action`. The focused object's primary action uses it too.
- A creation or edit flow's action row is the one the creation grammar below describes. It is never stretched across a shell or container that also holds unrelated content.
- A blocked object's way out is one next action strip in the `banner` slot of the detail layout: under the header, above the tabs, outside every scroll region, so every tab sees the same copy. Its tone sits on the left rail only (danger for a failed step, warning for a question, info for a wait), with a sentence that names the object, a muted cause, the technical detail behind a disclosure, one primary action and at most two secondary ones. It never repeats at the bottom of a transcript.
- A status row that describes the same block, like the orchestrator strip under a failed step or an open question, stays on a neutral rail, so only the next action strip carries the tone.
- The `tabs` slot of the detail layout keeps the tab strip at its own width. It never stretches across the header.
- A section-scoped action uses `SectionHeader.action`. A field control uses `FieldRow`. Neither one moves itself up into global chrome.
- A region that can start several kinds of work shows one primary, never a row of peer buttons. `SplitButton` joins the primary half, which its owner renders through `primary({ className })` so a popover can anchor to it, with a chevron half that opens the less frequent starts as a menu. Each menu item names the kind and carries a one-line `description` and a concept `tone` on its icon. `OverflowMenu` and `SplitButton` render items through the same `MenuItems`.
- The empty session follows the same rule. It asks one question with a single-select list of rows (glyph, title, one line), and only the selected row's primary shows. Rarer starts sit in a quiet `More ways to start` menu, and an item that cannot work yet is left out, never shown disabled. A grid of tiles is not an action zone.
- An overflow menu that has to confirm one of its items in place renders `MenuItems` inside its own `AnchoredPopover` and swaps to a plain `InlineConfirm`, as the orchestrator strip does for **Stop now**.
- An on or off setting is a `Switch`: the label names the setting and the knob says its state, so the label never reads "on" or "off". Autorun uses it everywhere (`WorkflowAutorunToggle`).

**Record actions.** A record from a connected tool (issue, merge or pull request, thread, error) has four fixed places, whatever the tool:

| Place     | What goes there                                                                               | Shape                                              |
| --------- | --------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Primary   | Launch session, or Open session once one is linked                                            | one filled button, first in the action row         |
| Secondary | at most two tool verbs that move the record forward, picked by state                          | neutral `secondary` buttons, tone only in the icon |
| Overflow  | rare tool verbs, Refresh, Copy link, Unlink session, then destructive verbs after a separator | the `⋯` menu on the identity line                  |
| Utilities | Open in the tool, `⋯`, close                                                                  | icon buttons at the end of the identity line       |

A verb blocked for a moment stays visible with its reason in the tooltip; a verb the tool refuses is not shown. Merge confirms under the action row, and a destructive verb confirms in its menu with a plain menu swap. Properties that can change (state, assignee) change from the control that shows them, never from a button. `RecordHeader` and the `RecordVerbs` type own the contract.

`InlineConfirm` stays attached to a destructive trigger in its action region. A confirmation detached in the body, or a destructive footer dock, is not another zone. It is the only confirmation body, and it shows in exactly one of three placements, picked by how much room the trigger has:

- **Row swap**: a trigger inside a row with width (a `FieldRow`, a section footer) is replaced in the same slot by the `card` surface.
- **Anchored**: a small trigger (icon button, sidebar row action, header action, rail row) opens `ConfirmPopover`, which shows the `plain` surface in an `AnchoredPopover`. Escape and a click outside cancel. The popover stays open and busy while the confirm runs.
- **Menu swap**: a destructive item in an open menu or popover replaces the menu body with `InlineConfirm surface="plain"` in the same popover.

A card `InlineConfirm` inside a popover, or one floated with `absolute top-full`, is a bug (`inline-confirm-placement.test.ts`). The trigger is ghost or secondary with danger text. The solid danger fill shows only on the confirm button. The title says what will happen. The description says what survives and how to undo it. Reversible actions use `role="alert"`, irreversible ones `role="danger"`.

**Copy feedback lives on the control.** `useCopyLink().copy({ text, key })` keys the copied state, so in a list only the row whose `key` matches flips to "Copied". A successful copy never toasts; a failure shows inline while the control stays mounted, and only a menu item, which unmounts on click, reports a failure through a toast. `CopyButton` reads "Copy", "Copied", "Copy failed".

## Section rhythm

`PANE_RHYTHM.stack` separates peer sections. `Divider` separates app chrome from content, never content from content: [docs/styling.md](../../docs/styling.md) owns the rule. Section children do not add margins. `SectionHeader` is the standard section heading, with an optional description. The eyebrow size is the default for every surface. `size="page"` is only for a document whose body is prose the reader came for, such as the guide or a creation flow's form sections. Description copy comes only through `hint`, so its size and muted tone stay matched to the heading grade.

**The outline is independent of the grade.** `headingLevel` turns an eyebrow-grade label into an `h2` or `h3`. So a pane section keeps its place in the document outline without taking the page grade. A section that needs a heading does not need bigger type because of that.

`SectionSurface` is `SectionHeader` on the one raised section surface. Use it
for a reading surface whose sections would otherwise be separated by empty
space alone. It sits on the panel step of the surface ladder, so the cards
inside it take the raised step and nothing stacks another level. A metadata line is not a
section and does not get a surface. Its optional `icon` goes to the heading,
the same slot `SectionHeader` gives it, at the row icon size.

`Eyebrow` is a label primitive for metadata, statistics and small internal groups. It is also the only uppercase label. A standalone label with `uppercase` renders `Eyebrow` (inside a heading element when it titles a region), never a hand-made `uppercase tracking-*` span. Chips and badges use sentence case: `Chip` has no uppercase option, and a status or kind chip has a sentence-case label. Arbitrary `tracking-[…]` values are rejected (`uppercase-label-uses-eyebrow.test.ts`). `Eyebrow` does not replace `SectionHeader` when a section also needs an action or description. `FieldRow` owns a form field's label, help copy and control alignment. It does not title a section. When these roles overlap, `SectionHeader` wins for the section, and then `FieldRow` labels the controls inside it. `Divider` is a sibling between chrome and content, never decoration after every heading or field, and never a separator between two pieces of content: use `gap`, `SectionSurface`, or a labeled rule like `Eyebrow` instead.

## Prose disclosure

`ClampedProse` is the only multi-line prose clamp. It accepts one to six lines, renders the text as preview markdown, and shows the complete text in place through Show more and Show less. Do not apply `line-clamp-*` directly to prose, and do not slice a display string. Single-line identity labels may use `truncate` when their full value is available from the focused object or an accessible disclosure.

Artifacts exempted by `DESIGN.md`, including the text of an open question, never use `ClampedProse`.

## Term hints

`TermHint` explains a word that stays on screen but still needs a sentence. The
word keeps its surrounding type and gets a dotted underline. A click or
keyboard focus opens an `AnchoredPopover` with the term, one sentence and an
optional action; hover never opens it and it never opens on its own. Escape,
an outside click or moving focus away closes it. The anchor is a block `div`,
so the sentence around a hint is a `div` or a `span`, never a `p`. A hint
never sits inside another button or tab: put it in the line under the control.
The desktop app reaches it only through `GlossaryTerm`, which reads the one
definition table and adds Open the guide.

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
A tooltip that has to show a small table (the top bar Limits chips) passes
`variant="card"`: a 260px elevated card that wraps, instead of the one-line
label.
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

The empty Activity of a new session is the kickoff. It asks "How do you want to
start?" and answers with a single-select list of three rows, each a concept
glyph, a title and one line: Pick up a task, Run a workflow, Not sure yet. The
selected row reveals its fields and its one primary under the list. Arrow keys
move between rows and Enter moves into the selected row's fields. There is no
example run and no grid of tiles.

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

`Reveal` is the one height transition for disclosed content: `grid-template-rows`
from `0fr` to `1fr`, 200ms `ease-out`, the same curve as the `AppShell`
columns, behind `motion-safe`. It keeps its children mounted through the
collapse and unmounts them on `transitionend`, or at once when no transition
runs (reduced motion, tests). `Collapsible` opens through it. A disclosure
never mounts and unmounts its panel by hand.

- `spin-border`: working. A card that carries its tone on a left rail runs the
  same signal down that rail instead (`spin-rail`), so the tone never wraps the
  box. Under reduced motion the rail holds still at full tone.
- `border-pulse`: a warning-stage card needs you.
- `attention-ring`: something new arrived. It is a short outward breath (three
  cycles, then rest) on an element that now needs the user, never one that
  is working.
- `soft-pulse`: the only animation in the app for a lasting state. It breathes
  a state that holds and is alive: the centre dot of a running
  `WorkNode` that carries no step number, the head of a running `WorkNode`'s
  progress arc (which then replaces the centre dot), a running tool icon or
  scout dot, and the boot splash status. On the rail it sits inside the
  `spin-border` ring, or on the arc, so the pair reads as one running state,
  not two claims. The bar for another lasting-state
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

**The top bar's left edge belongs to the window.** The collapsed rail is
`COLLAPSED_RAIL_WIDTH` (44px, exported by `AppShell`) and its buttons center on
22px. The top bar starts at `--titlebar-inset`, which clears the macOS traffic
lights, so it no longer shares an axis with the rail:
`collapsed-rail-width.test.ts` pins both. Widening the rail to fix a padding is
the wrong trade, because chrome pays rent.

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
