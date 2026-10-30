# Design system

> **Read this when** you need concrete tokens or scales to implement against, or the page for a primitive or a surface. **Not for** intent and product judgment (`DESIGN.md`) or Tailwind authoring mechanics (`docs/styling.md`).

This file is the registry of the tokens, scales, z-index layers and motion of
`@goodboy/ui`. It owns the design system layer. The primitives and surfaces
have a page each in [design/](design/), listed under Pages. Fixed rules and product intent
stay in [DESIGN.md](../../DESIGN.md). Tailwind mechanics and the reasons behind
stacking order stay in [docs/styling.md](../../docs/styling.md).

The tokens are stored in `apps/desktop/src/styles.css` under `@theme`. That
file is only where they sit. The rules for what they mean and how they combine
live here.

## Pages

This file is the registry: the tokens and scales that tests and primitives read. The pages below hold the rules for one family of surfaces each.

| Page                                                | Holds                                                                                                                                                                                               |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Controls](design/controls.md)                      | Primitives, Control scale, Listbox, Menus, Key hints                                                                                                                                                |
| [Feedback and empty states](design/feedback.md)     | Notices, Action feedback, Empty states, Question card                                                                                                                                               |
| [Layout and action grammar](design/layout.md)       | The left column, Pane anatomy, Action zones, Section rhythm, Prose disclosure, Card action grammar and creation grammar, One way to ask, Comment composer and replies, Form actions                 |
| [Surfaces](design/surfaces.md)                      | Report sheet, Pull request page, Workspace chat                                                                                                                                                     |
| [Rail and work vocabulary](design/rail-and-work.md) | Needs you and the two views, Rail vocabulary, History graph, Work nodes and row states, Row hover and focus, Session row hover card and switcher, Rail, Work meta, The plan in the workflow builder |

## Text hierarchy

Text uses four opaque semantic steps. `foreground` is primary content,
`muted-foreground` is supporting content, and `faint-foreground` is metadata,
placeholders and trailing hints. `disabled-foreground` is reserved for disabled
controls. Opacity modifiers do not create additional text steps.

The four steps are named by what the text does, in `TEXT_ROLE`
(`packages/ui/src/textRoles.ts`): `label` is `foreground`, `secondary` is
`muted-foreground`, `hint` (time, id, hint, separator) is `faint-foreground` and
`disabled` is `disabled-foreground`. `MetaRow`, `Eyebrow` and a neutral `Chip`
take their colour from the table, so a role changes in one place. A call site
that picks a colour for a role the table names uses the role constant. The
token values themselves are not part of the table.

`Input`, `Textarea` and `SearchField` print their placeholder in
`faint-foreground`, the same as every hand-built field, so an empty field reads
apart from a filled one. `placeholder:text-muted-foreground` is forbidden by
`no-token-bypass.test.ts`. A `provider-*` token is a logo colour: it paints a
glyph (`IntegrationGlyph`), never text, because the brand hues clear only the
3:1 glyph floor. A chip that names a provider keeps its label in `foreground`
and its glyph in the brand colour; `text-provider-*` is forbidden by the same
test.

`faint-foreground` clears 4.5:1 on every surface step and on a `fill` chip sunk
into `background`, `subtle` or `muted`, in both themes, and the syntax tokens
clear 4.5:1 on the plain diff background and on an added or removed line, word
fill included. `text-contrast.test.ts` reads the tokens from `styles.css` and
fails when one drifts under.

## Surface ladder

Six opaque roles, from the back of the window to the eye. Components step
between them instead of mixing one surface through opacity.

| step | role     | class           | holds                                                 |
| ---- | -------- | --------------- | ----------------------------------------------------- |
| 0    | chrome   | `bg-chrome`     | the app frame: top bar, left column and its rail      |
| 1    | sheet    | `bg-background` | the content sheet, a studio's detail, viewer dialogs  |
| 2    | panel    | `bg-subtle`     | grouped content on the sheet                          |
| 3    | inset    | `bg-muted`      | opaque rails, highlighted code rows                   |
| 4    | raised   | `bg-elevated`   | cards: board cards, `RailCard`                        |
| 5    | floating | `bg-floating`   | popovers, menus, centred dialogs, toasts, the palette |
| 6    | tooltip  | `bg-floating`   | the label tooltip, one line on the floating surface   |

Dark mode brightens one step at a time, 1.06 to 1.09:1 between neighbours.
Light mode is ink on paper, read on two axes. On the elevation axis (what sits
in front) chrome < content < raised = floating: nothing is brighter than white,
so above raised the lift is `shadow-lg` plus `border`. On the nesting axis
(what sits inside) content > panel > inset: the deeper, the darker.

The window backdrop is step 0 plus one glow: `bg-backdrop` paints `chrome`
under `--app-backdrop`, a radial of `primary` from the top-left corner (the
website accent hue). `--app-backdrop-strength` is its alpha in percent, 3 by
default, a faint glow over chrome (0 turns it off); light mode scales it by
`--app-backdrop-scale: 2.5` (3% sidebar becomes 7.5%, the 6% cover 15%) so the glow
reads on the light chrome as it does on the dark one. Only `AppShell` (and the c02 levels scene that stands in for it) paints it,
under the top bar and
the left column; the sheet, the session rail and every drawer stay opaque and
flat. Mock scenes preview a strength with `?backdrop=<n>`. The boot splash and
the Welcome cover that follows it paint `bg-backdrop-cover` instead: the same
radial at `--app-backdrop-cover-strength` (6), so the handoff has no seam.

`drawer` sits beside the page surface, not on the ladder: a right drawer is its
own container next to the sheet and is painted one step quieter than
`background`, between `chrome` and `background` in both themes (dark
`oklch(0.187 0.006 255)`, light `oklch(0.964 0.0045 250)`: the same hue and no
more chroma than `background`, so it recedes and never tints). It carries every
text token at 4.5:1 and every border at the floors of the ladder, held by
`token-contrast-floor.test.ts`. A drawer container never fakes the difference
with a border.

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

`border` is an alpha overlay (foreground at 38% in dark, 45% in light), never a
solid value, so it holds 3:1 on every step from `chrome` to `floating` and sits
near 3.3:1 on the base sheet instead of 4.5:1.

Three translucent tokens paint over whatever sits below them: `frame-edge`
(white 8% in dark, black 8.5% in light) draws the content sheet and the right
drawer container at 1.2:1 or more on chrome and background, and
`scrollbar-thumb` and `scrollbar-thumb-active` clear 1.8:1 and 3:1 on
background, panel and floating.

A clickable card at rest carries two signals together (a fill one step above
its parent plus the hairline). Its states clear 3:1: hover `border`, selection
`bg-selected`, focus ring. `token-contrast-floor.test.ts` holds the ladder
order and every floor on all six steps, and `no-token-bypass.test.ts` fails on
any colour class with no `--color-*` token behind it.

`bg-hover` and `bg-selected` are interaction overlays painted as a
background-image layer, so they stack on whatever fill the element rests on
instead of replacing it, and `cn` keeps them beside a surface class. Hover is
8.5% white in dark and 7.5% black in light, about 19 of 255 levels on a row and
on a tinted waiting or unread row, enough to notice while moving down a list;
selected is 13% and 12%, so a selected row always reads above a hovered one.
`row-hover-wash.test.ts` holds both floors. `scrim` is reserved for modal backdrops and the backdrop of a drawer over the page.

A selected row has one treatment everywhere: `bg-selected`, foreground text and
medium weight, driven by `data-selected` (`selectedRow.ts`, used by
`SelectableRow` and `RailCard isSelected`). `SegmentedTabs` follows it too: a
hairline track, `bg-selected` on the active segment, no raised pill. A
selected nav entry also lights its icon in its own kind color, never the
label: `selectedIconClass` (`SelectableRow selectedIconTone`, the column
doors, `RailButton` and the pressed session tool) over one function,
`navEntryToneOf`, which reads the icon's `CONCEPT_TONE` (Agents and Auto agents
primary, Artifacts draft, questions warning, files and comments info, checks
success) and falls back to
`primary` for an entry with no kind color (Overview, Terminal, Settings).

A selected row adds no hover wash on top of `bg-selected`
(`data-[selected=true]:hover:bg-selected`), and faint text inside it reads as
muted (`[data-selected='true'] .text-faint-foreground` in `styles.css`), so
every line of a selected row clears 4.5:1 on every surface step in both themes.
A tinted chip keeps its rest fill at hover and draws its ring stronger
(`hoverRing`); a tone's `hoverBg` is the neutral `bg-hover` overlay, never a
stronger tint, because a 20% tint under tone text fell under 4.5:1. Text never
takes an `opacity-*` step: a quiet model label is the muted variant of
`RoutingLabel` (name in `muted-foreground`, provider mark in its color). The
composed cases (tint, selected row) live in `token-contrast-floor.test.ts`,
Composed contrast.

`SegmentedTabs` has three sizes: `xs` (28px strip, for a header row that also holds the title and
actions), `sm` (36px) and `md`; the tablist carries `data-size` so a test can
check it against its neighbours. The track hugs its tabs (`w-fit`) unless it
`fill`s the row. A count badge (a string or a number) never reads 0 and never sits on the
selected tab, where the list under it already shows the rows; a node badge (a
changed dot) stays; a
caller shows the switch only when two or more options have content (one option
is a disabled select, not a switch), and never inside a pane. No ring and no
primary tint mark a selection; the focus ring stays the only ring, so focus and selection read
apart, as in VS Code and Linear lists.

`ChoiceChips` is the compact choice: one wrapping row of chips for two to nine
short answers to one question, where `ChoiceCards` is a column of cards with a
hint. It is a horizontal `listbox` of `option` buttons, not a tablist and not a menu, with
roving focus: one tab stop on the picked chip, the arrows (and Home and End) move
and pick, wrapping, and the keys 1 to 9 pick by the faint number each chip
shows (`keyScope` widens the number keys to a whole card, and a field inside it
keeps its own typing). A chip is 28px (`min-h-7`) and wraps a long label
instead of cutting it. The selected chip follows the selected row rule with a
stronger border and no ring; the others sit on a hairline. The advised answer
carries quiet `Recommended` text, never a tone. Past nine chips the numbers and their keys go away. `AutoNextAction` is
the first use: a neutral `bg-subtle` card of about 116px (12px padding, a title
row, a chip row, an action row, 8px gaps) whose only colour is a 6px warning
`StatusDot` before its label, one primary and a quiet `Not now`.

A row that holds its own links or buttons is `InteractiveRow`: one overlay
button stretched over the row opens it, and the inner controls sit above it.
A card shaped row passes `radius="lg"` so the focus ring follows its corners.
A `role="button"` div with its own key handler and propagation stopping is not
another pattern. A rail entry is a `SelectableRow`; the row never indents
itself: every child list under a rail heading takes `PANE_RHYTHM.navRail.nest`,
so child icons line up under the parent label and every nested list indents by
one step. The Settings navigation rows are one 28px line of icon and word
(`SettingsNavRow` in the desktop app), a 6px `StatusDot` at the end names a
row that needs attention, and the sentence lives on the page.

## List grid

Every list of records (agents, runs, tasks, checks, worktrees, sessions in the
List view) is one `ListGrid`: a single CSS grid whose rows are `subgrid` rows,
so every cell of a column starts and ends on the same x on every row. The
caller declares its columns once (`ListGridColumn`: a fixed width in px, or
`fill` for the one title column), and the grid adds a zero edge track on each
side so the column gap is also the row's inner inset. Rows hold no flex of their
own and no pill whose width varies: a role is a plain word in a fixed column, a
state is a `StateDot` or a glyph in a 16px column.

- `align: 'end'` with `isNumeric` right aligns a number in tabular figures, so
  "1m 12s" and "12m 40s" end on one edge.
- `isTitle` marks the `fill` column: foreground, `text-row`. Other columns read
  muted, or `tone: 'hint'` for ids and ages.
- A row with `onSelect` is one button: the row is the action, it carries no
  buttons of its own and nothing appears on hover. `isSelected` sets
  `data-selected` and `aria-current`. Up and Down move focus between rows.
- `rowHeight` is 32 by default and 28 in the sidebar.
- `isShrinkable` on a fixed column makes its width a cap (`minmax(0,232px)`):
  in a column too narrow for every width, the `fill` column gives way first,
  then the shrinkable columns, so the grid never scrolls sideways. A track or a
  chevron stays fixed. The Now card branch rows mark the branch, project and
  state columns shrinkable.
- `shouldHideWhenEmpty` on a column drops it from the template, its cells and its
  gap, while no mounted row fills it (a cell of `null`, `undefined`, `false` or
  `''` is empty). As soon as one row fills it, every row keeps the cell, empty
  where it has nothing, so the column stays on one x. Unknown is an empty cell,
  never "0 B", "-" or "no port".
- `canSpanEmpty` on a column lets its cell take the empty cells right after it in
  a row, so a title keeps the width of a column that row leaves blank. The Questions
  grid sets it on the question column: a waiting question has no answer line.
- `ListGridGroup` takes an optional `mark` drawn right before its name, over
  the rows' leading glyph column: the Sessions List puts one
  6px `StatusDot` in the stage tone there (`stageTrackOf`), so rows keep only
  their state node and no row carries a track.
- `ListGridGroup` names a group in sentence case with its count right after
  the name, like a Board lane and a sidebar group (a count alone in the last
  column read as a value of the row below). The count shows from 2 rows (a
  group of one says nothing a row does not), and a capped group passes `fold`
  (`{ label: 'Show all', onToggle }`), the quiet fold word right after the
  count, so the total is said once on the label and the foot carries no number;
  an `action` (one visible control,
  such as the `Open session` arrow on a Terminal page group) sits at the end of
  the heading row; a
  grouped grid (`isGrouped`) spaces its groups 16px apart, never with a divider.
  `headingLevel` is 3 by default and 2 on a page whose title is the only heading
  above the groups. A group with no `label` draws its rows alone, with no heading
  and no count, for a lead group that needs no name above a named one.
- A list with a keyboard cursor (Tasks) makes each group its own listbox
  (`isListbox`, `activeDescendant`) and its rows options (`isOption`,
  `isCursor` marks the cursor with `data-cursor` and the hover fill). What is not
  a row stays outside the listbox: `lead` holds the lines above the rows, `foot`
  the lines under them, and `isSticky` keeps the group label on top while a long
  group scrolls.
- `ListGridLine` is a one-line gray note across the grid, a button when it has
  `onClick` ("Show all 38", "Linear is rate limited. Retry").

`StateDot` is the one state mark of a list or a sidebar slot: a 6px
`StatusDot` named by its state word (the tooltip and the accessible name),
`running` (info), `needsYou` (warning), `failed` (danger), `unread` (primary),
`done` (success), and `idle` and `stopped`, a neutral ring with a transparent
fill on every background. A running dot pulses (under `motion-safe`) only when
the caller passes `isLive`, on the item that runs (a list row, a tail glyph);
chrome (top bar chips, doors, rail slots) stays static. A count next to a door
lives in the dot's tooltip, never as colored text. The Sessions door is the one exception: it
says how many sessions need you as a number (see the door pill below). The Tasks door carries the quiet `unread` dot while an item assigned to you arrived since you last looked (`taskNewKeys`, its count in the tooltip).

Scenes `c01-grid-list`, `c01-grid-groups`, `c01-grid-dots` and `c01-grid-type`
show the grid, its groups, every dot and the type specimen.

### Counts, fact lines and durations

Three helpers in `apps/desktop/src/shared/utils/` own how a number, a fact line
and a duration read, so no surface writes its own rule.

- `countSlotText({ count, isBesideGlyph })` is the text of every sidebar slot
  and tab badge. It returns the grouped number ("12", "1,024") from 1, or from 2
  when `isBesideGlyph` says a glyph beside it already means one (a session
  signal "?", a running node, an unread dot). It returns `null` at 0, while
  loading and when the read is unknown or denied: the slot draws nothing, never
  "-", "0", "None" or a skeleton glyph, and the reason lives in the tooltip.
- `joinFacts({ facts })` joins a fact line with the one " · " separator. It
  trims each part and skips `null`, `undefined`, `false` and empty parts, so a
  line never shows a doubled or dangling separator ("Limit $3.00 · $1.12
  spent"). It returns `''` when nothing is left.
- `formatDuration({ durationMs })` (`time/formatDuration.ts`) is the one
  duration, live and done: "42s", "2m 37s", "1h 12m". It returns `null` under
  one second, so nothing shows before the first second and "ms" never shows. The
  clock form "2:37" is gone. A run step clock counts execution only, never the
  time spent waiting on you: a tail that names `stepAgentId` reads the same
  active time as the step row (`agentActiveClock` over `agentActiveTime` in
  `features/workTreeModel`, from the `WorkTimeContext` source), so the row and
  the tail always show one value, and it draws no clock without that source. A
  tail that waits for your answer draws no clock. Only an operation with no
  wait in it (a cleanup, a history rewrite, a fix run) keeps `useTailClock`
  ticking once a second over its own `startedAt`. Both format through
  `formatDuration`, returning `null` in the first second.

## Type scale

Features name a **type role**, never a size, a leading, a weight and a
tracking one by one. Each role is a `--text-*` token in `styles.css`, or an
`@utility` when it also sets case or family, and fixes size, a whole-pixel line
box, weight and tracking together. `cn` reads every role as a font size, so a
later role or grade replaces an earlier one and a text colour never drops it.
The list is `TYPE_ROLES` in `typeRoles.ts`.

The family is Inter: the variable Latin file in `apps/desktop/src/assets/fonts/`,
declared once as a global face in `styles.css` and first in `--font-sans`, with
the system stack behind it as the fallback. `--font-mono` stays the system mono
stack, for code only: a model name is a name, so the routing picker trigger
(`TriggerLabel`) and the inline `RoutingLabel` set it in the sans family, the
same as the Runs on row and the Defaults rows. The body turns on `calt` and sets `font-optical-sizing: auto`, so the
drawing tightens along the file's optical axis (14 to 32) as the size grows.
Tabular figures are not global: Inter's `tnum` also widens the hyphen, which
set `storefront-web` apart as `storefront - web`. `text-meta` and `text-chip`
do not force them. A number that lines up in a column (a time, a cost, a
count, a size) adds `tabular-nums` itself: `RelativeTime`, the count slots, the
`WORK_META_COLUMN` time and cost cells and every `isNumeric` `ListGrid` column
carry it, and `numbers-are-tabular.test.ts` lists the files that must. The file has no character variants and no stylistic sets, so
`cv11` or `ss01` would change nothing. `app-font-is-inter.test.ts` reads the
file's feature list and fails on a feature the file lacks. The face is upright
only, so emphasis gets a synthetic slant. The boot shell in
`apps/desktop/index.html` stays on `system-ui`, because it paints before the
stylesheet loads, and the exported report embeds the same file as a data URI.

| role           | measure                   | used for                                                                                   |
| -------------- | ------------------------- | ------------------------------------------------------------------------------------------ |
| `text-display` | 24/32, 600, -0.01em       | onboarding titles and the Impact title                                                     |
| `text-title`   | 18/28, 600, -0.012em      | level 1: the one pane title (h1) of a surface, h1 and h2 inside a message                  |
| `text-heading` | 14/20, 600                | level 2: a page-grade section, a popover title, a kickoff question                         |
| `text-row`     | 13/20, 500                | level 4: a top-level row label, a card title                                               |
| `text-body`    | 14/20                     | running text; text with no class inherits it from the body                                 |
| `text-prose`   | 15/24                     | level 3, the one reading size: messages, markdown, artifacts, goals, descriptions          |
| `text-eyebrow` | 12/16, 500, sentence case | a section label, only through `Eyebrow`                                                    |
| `text-meta`    | 12/16                     | level 5: controls, a nested row, a status label, time, ordinal, cost, count, a second line |
| `text-chip`    | 11/16, 500                | the label inside a chip, a badge, a key cap, a count pill                                  |
| `text-code`    | mono 12/18                | branch, path, command, inline code                                                         |
| `text-ui`      | 13/20                     | level 4: every line of a list surface that is not its title or prose                       |
| `text-lead`    | 15/24, 500                | the title of a list surface                                                                |
| `document`     | 15/25                     | the report document body (screen and file); a reading exception, not a `--text-*` role     |

Mono is for code: a branch, a path, a command, a sha and code. Money, counts,
durations, percentages, ages and key letters are the sans stack with
`tabular-nums`. A file whose
`font-mono` is code is listed with a one-word reason in
`regressions/scale-rules.mono-code.json`; any other `font-mono` fails
`scale-rules.test.ts`.

`document` is the one exception to "a role, never a size": it lives in
`artifactDocument.css`'s own `--print-*` tokens, not `typeRoles.ts`, because
the report reads the same way in the app, on disk and on paper, and the paper
medium shrinks every one of its tokens under `@media print`. It never appears
outside `ArtifactDocument`.

### Five levels

Every text on a page has one of five levels. They step by size and weight
first, and by colour second.

| level | role                     | measure           | colour                              |
| ----- | ------------------------ | ----------------- | ----------------------------------- |
| 1     | `text-title`             | 18/28, 600        | foreground                          |
| 2     | `text-heading`           | 14/20, 600        | foreground                          |
| 3     | `text-prose`             | 15/24, 400        | foreground                          |
| 4     | `text-row` and `text-ui` | 13/20, 500 or 400 | foreground                          |
| 5     | `text-meta`              | 12/16, 400        | muted, or faint for time and counts |

`text-prose` is the only reading size: `text-read` is gone, merged into it.
`text-chip` (11/16) stays for tags and moves to 12 later. The sidebar is 13
throughout: a door, a session row and a rail entry are one 28px row in
`text-ui` (13, 400) whatever the glyph, with `ICON_SIZE.row` icons in hint gray
at rest (only the selected entry's icon takes its kind color), `bg-selected`
plus foreground for the selected row, and a trailing slot drawn by
`countSlotText`. Nothing appears on hover; a shortcut lives in the tooltip.
A page uses the five levels: its title is level 1 (or `text-lead` in a list
surface), its sections are level 2, its prose is level 3, its names are level
4 (`text-row` for a row's name and a group label, `text-ui` for the rest of a
list cell) and its second lines, times, counts and costs are level 5. Weight
is 400, 500 or 600 and comes with the role, never a `font-*` utility. Colour
follows the three grays of the text hierarchy. A branch or a path in such a
surface is `text-ui font-mono`, listed in `scale-rules.mono-code.json` like
any other code. `levels.test.ts` reads the five sizes from `styles.css` and
fails when a file that renders `ListGrid` reaches for `text-display`,
`text-body` or `text-eyebrow`. Scene `u31-text-levels` shows the five levels
on a title, a list with times, counts and costs, a chip and a meta line.

A role with no weight inherits one: `text-meta font-medium` is a control label
at 500, `text-chip` a chip. Weights are 400, 500 and 600, and
600 belongs to display, title and heading. `text-row`, `text-lead`, `text-chip`
and `text-eyebrow` carry 500 themselves, so a weight utility next to a role is redundant, and
`forbidden-patterns.test.ts` counts it (`role-weight-override`). Tracking lives only inside
the roles. A leading utility still composes with a role
(`text-chip leading-none` for a one-line badge), because the role reads
the leading before its own line box.

The raw grades (`3xs` to `2xl`) stay defined as theme tokens, each on a
whole-pixel line box, but no class reaches for them: `no-token-bypass.test.ts`
fails on any `text-xs`, `text-sm`, `text-lg` and the rest, and
`forbidden-patterns.test.ts` counts raw weights, leadings and tracking per file,
where the count only goes down. `scripts/codemods/type-roles.mjs`
(`pnpm codemod:type-roles`) rewrites the combinations that map one to one
(`text-sm font-medium` to `text-row`, `text-3xs` to `text-chip`,
`text-sm leading-relaxed` to `text-prose`). Arbitrary sizes are covered by
[docs/styling.md](../../docs/styling.md).

Spacing sits on a 4px grid: `1`, `2`, `3`, `4`, `6`, `8` (4, 8, 12, 16, 24, 32px).
A half step (`py-1.5`, `gap-2.5`, `px-3.5`) is out, and `0.5` stays only for a
hairline. `half-step-spacing` in `forbidden-patterns.test.ts` allows none, and
no baseline lists it. `spacing-grid.test.ts`
reads `paneRhythm.ts`, `timelineRhythm.ts` and `workMetaSpec.ts` and fails on a
half step, or on a row height outside 24, 28, 32, 36, 40 and 48. A one-line rail
row is `navRail.row` (32px), a two-line one `navRail.rowTwo` (48px). A session
row in the left column is 28px, and so are the pages nested under it. A tree
row (the Auto work rail, a run's step tree) is two lines in 48px:
`PANE_RHYTHM.tree.line` (28, the node sits on its centre) then
`PANE_RHYTHM.tree.meta` (20); the work rail reads them from `railSpec.ts`. A
property list is `PANE_RHYTHM.property`: an 88px label column and a value
column, the label and the value's first line both 28px so their centres match,
a wrapping value flowing below, groups 24px apart. `spacing-grid.test.ts`
holds the work rail, the tree row and the property grid on the scale.

The Sessions block shares one left edge and one gap. The `Sessions` eyebrow
(`sessionList.headerInset`, 16px), the door icons (`navRail.inset` plus
`navRail.door`) and the session row icons (`sessionList.pad` plus
`sessionList.rowInset`) all start at 16px, and the doors and the session rows
share one vertical gap (`navRail.doorGap` equals `sessionList.rowGap`). The view
menu trigger is a 28px target (`sessionList.menuTrigger`). The groups of the list
are spaced by that same gap (`sessionList.listGap`), and a group header has no
top margin of its own. One separator sits between the doors and the Sessions
header, with the doors' gap above and below it, and the first row under the
header is New session, shaped like a session row. `paneRhythm.test.ts` holds the
three edges and the gaps.

The main sidebar has one icon column. Every leading glyph (New session, the
doors, the session state nodes, Settings, and the same buttons on the folded
rail) sits in `navRail.icon`, a 12px slot that centers a glyph of any size at
22px, the folded rail's axis and the workspace tile's center in the top bar
while `--titlebar-inset` is 0. `sidebar-icon-column.test.tsx` reads the centers
in the `r4-column-dark` and `r4-column-light` scenes and on the folded rail,
within 1px.

A stat card holds its label to two lines (`line-clamp-2`), pins the figure to
the bottom of the card with `mt-auto`, and puts the delta and the hint on their
own row under the figure, never beside the label. A row of cards that carry
deltas passes `reservesDeltaRow` so the figures sit on one baseline. A card with
`onClick` is the button: it carries no arrow, tints on hover and takes
`FOCUS_RING`.

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
worse. A conversation reads in the 720px measure, centred: assistant messages
take the measure and a user card keeps a 48px start gap (`PANE_RHYTHM.message.user`). The chrome around prose still takes the role its job asks for. A
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
| `rounded-frame` | 10px  | only the content sheet and the right drawer container           |
| `rounded-lg`    | 8px   | surfaces: cards, popovers, menus, bands, notices, toasts        |
| `rounded-md`    | 6px   | controls: buttons, inputs, triggers, icon buttons, sidebar rows |
| `rounded-sm`    | 4px   | role pill, kbd, inline code, checkbox, rows inside a popover    |
| `rounded-full`  | n/a   | avatars, nodes, status bars, thumbs                             |

## Elevation

Five levels plus the tooltip. A level sets surface, shadow, border and radius
together, and there is no arbitrary shadow.

| level      | surface                         | shadow      | border                        | radius                     | holds                            |
| ---------- | ------------------------------- | ----------- | ----------------------------- | -------------------------- | -------------------------------- |
| 0 frame    | `chrome`                        | none        | none                          | n/a                        | top bar, left column, rail       |
| 1 sheet    | `background`                    | none        | `frame-edge`                  | `frame` where chrome wraps | content, studio detail           |
| 2 band     | `fill` (band), `subtle` (panel) | none        | none                          | `lg`                       | groups, panels on the sheet      |
| 3 card     | `elevated`                      | `shadow-sm` | `border-soft`, hover `border` | `lg`                       | board cards, `RailCard`          |
| 4 floating | `floating`                      | `shadow-lg` | `border`                      | `lg`                       | popovers, menus, toasts, dialogs |
| 5 tooltip  | `floating`                      | `shadow-lg` | `border-soft`                 | `md`                       | label tooltips                   |

The label tooltip is `FLOATING_SURFACE` with the `md` radius and a soft border: foreground text in `text-meta` medium, `px-2 py-1`, at most 280px wide, fading in over 120ms when motion is allowed. Its shortcut is a plain `Kbd` in the faint color. The shared `Tooltip` gives its node an `id` and sets `aria-describedby` on the trigger while it is open, unless its text equals the trigger's `aria-label`, so a screen reader never hears a name twice. `Tooltip` has no variant; a mark with two facts or more uses the fact card below. It opens on the side it is given and flips to the other side when it would cross the window edge by the gap, so it never sits under the edge or over its own target; along the edge it shifts instead. A trigger that opens a popover passes `isSuppressed` with the popover state, so its label never lies over the popover it opened.

**Fact card.** `FactCard` (`packages/ui/src/components/FactCard`) is the hover card for a mark that has two facts or more, built from the session hover card: `FLOATING_SURFACE`, `p-3`, `gap-3` between parts, 320px wide, `z-tooltip`, with `pointer-events-none` so it never covers the next row. It takes data, never JSX: a `FactCardSpec` of an optional decorative glyph, a title with an optional sub, an optional state (a tone dot, the words, a pulse only for running work), one to six facts (label in muted, value in foreground with tabular numbers, an optional faint note, an optional tone) and an optional faint footnote. The label column is `fit-content(40%)`: a short label takes its width, a long one (a session title) cuts at 40% of the card so the value stays in view. More than six facts throws in development and names the card; a production build shows the first six. One sentence is a `Tooltip`, text that is already visible needs nothing or `TruncatedText`. A fact card holds no buttons: the click on the trigger acts and the footnote says what it does. It opens after 500ms of rest, closes after 180ms of grace, opens at once within 300ms of another card closing (`useRestHover`, shared with the session hover card), and opens at once on keyboard focus (the rested-focus prop makes a list with arrow keys wait the rest instead). Escape closes it and still reaches the layer beneath. A touch never opens it, so the tap does what the trigger does; the tap-open prop is for a trigger whose only job is the card, and a tap outside closes it. the suppressed prop keeps it shut under an open menu. The card is `aria-hidden`: `factCardSentence` writes one sentence from the data into a node that is always mounted, and the trigger points at it with `aria-describedby`, so a screen reader hears the card once, even before it opens. The trigger must be a native element or a component that forwards `ref`, the pointer, focus and click handlers and `aria-describedby`.

**Top bar and spend cards.** The limits chip, the provider usage pill (spent, used, resets), the repositories entry (one row per repo that needs a look, five and "and N more" past six), the review throughput bar (one row per segment, the card sits on the whole bar) and each bar of the turn histogram (agents and share, the median in the footnote) wrap their trigger in a `FactCard` and send data only. A row in the Now popover opens the real session hover card in its facts-only form instead of a one line tooltip. `fitCardRows` (`shared/utils`) is the one place that keeps a card at six rows.

**Git and review cards.** A check row opens a card with its name, the result as the state and the time it took, and a footnote that says where the click leads (the log, the checks page or the Debugger); it never shows the address. A history mark that takes in, folds into or renames a commit opens a card with a row per taken commit, or the new name, and the plain reason in the footnote; a mark with no extra fact stays a one line label. The plan line's conflict mark opens a row per conflicting file when there are two or more, and no tooltip for one file because the line already names it. A diff file header shows the file name as the title with its status, folder and rename source as rows, and an artifact state badge shows its label, the detail as the state and the reason in the footnote. A footnote wraps onto a second line instead of cutting. Each builds its `FactCardSpec` in a pure function next to the component (`checkCardOf`, `historyMarkCardOf`, `conflictCardOf`, `fileCardOf`, `artifactStateCardOf`).

**Rail, chat and session cards.** An Auto rail row opens a card with its name, the state, the task and the route (`railRowCardOf`). The routing label and the routing model block open a Routing card with Provider, Model, Effort and, when the run left the plan, the plan sentence in the footnote; `routingLabelModel` returns that `card` and no joined `tooltip` string. A pinned session in the icon rail opens the real session hover card after a 500 ms rest, in its facts-only form. A chat's session mark lists one row per linked session with its stage (`chatSessionCardOf`). The Ask answer footer opens a card with Cost and Read (`askReplyDetail` returns rows, and no card when it has none). A running service's CPU and memory are two rows (`serviceUsageCardOf`). The work time cell gets Running, Active, Usually or Most finish within, a Cost row and the basis in the footnote, with "Longer than usual" as the state; `WorkTime` now carries `facts` and `footnote` beside the `detail` sentence other chips still read. The timeline clock opens Started and Finished rows (`clockSpanCardOf`) and keeps the one line "At 09:00" label for rows that are neither an agent nor a run.

**Tooltip kinds guard.** `tooltip-kinds` counts, per file, a `Tooltip` or `OptionalTooltip` whose `content` is JSX (inline or a variable declared in the file), a `content` that joins facts (`·`, `joinFacts(`, `.join(`), a `content` that greys its text (`text-faint-foreground`, `text-muted-foreground`), and `variant="card"`. It is a plain ban now: the baseline file is gone and any count fails the test, with the kind to use in the message. A `Tooltip` has no `variant`, so a hand built card has no primitive to hide in. Two facts on one label go on two lines (`\n`, the label keeps line breaks) or into a `FactCard`. `floating-surface-is-one-constant` covers the label `Tooltip` and `FactCard` too: both paint `FLOATING_SURFACE` and neither sets a `bg-floating` fill (the `FactCard` parts set no fill or shadow at all).

**Text that is already visible.** A tooltip never repeats what the screen shows. A branch name, a title or a row label that fits has no tooltip; one that can be cut goes through `TruncatedText`, which opens the full text only when the element is cut. A reason that must stay readable (the Auto blocked tail) passes `lines={2}`: it wraps to two lines before it is cut, and `isFocusable` puts it in the tab order only while it is cut so the keyboard opens the same tooltip. A title cut inside an `InteractiveRow` (the Auto child card, a run tree row, an artifact row, a plan part) opens its tooltip like any other: the row lets `TruncatedText` take the pointer and passes a click on it to the row, so the row stays one click target. A cell of a `ListGridRow` without its own tooltip is a `TruncatedText` too, so a cut cell shows its whole text. A control that falls back to its own visible text (`MessageAction`, `RecordActions`) shows a tooltip only when it has something else to say, such as a blocked reason, through `OptionalTooltip`. A native `title` attribute is never used: the `native-title` baseline is empty and the guard is a ban, so a reason on a disabled control or a status line goes through `Tooltip`. The term hint component is gone: a word that stays on screen gets a `tooltip` on its option, and a definition with facts is a `FactCard` with one row. Where the state word sits inside a row that already has its own tooltip (the timeline state line), only the inner mark keeps it.

A right drawer is its own container, never a card inside the sheet: it takes `drawer` (see Surfaces), `frame-edge` and `rounded-frame` like the sheet it stands beside. Over the page it is flush with the window edge (no inset), takes `rounded-l-frame` and a left border only, and adds `shadow-xl`. Outside the tooltip, `shadow-md` belongs
only to a dragged card.

**One floating surface.** Level 4 is the constant `FLOATING_SURFACE`
(`rounded-lg border border-border bg-floating shadow-lg`, from
`packages/ui/src/floatingSurface.ts`). `Popover`, `ContextMenu`,
`MenuChoicePanel`, the crumb menu, the history arrow menu, the session hover
card, the session switcher, the update arrival card and the delete confirm
take it as it is; a site adds layout and padding only, never a border, a fill or
a shadow of its own. So do the find bars, the selection bars and their confirm,
the bulk undo bar, the quick actions popover, the palette panel, the question
pill, the toast overflow chip and the drag ghost of the history. A tone may
change the border colour (`border-danger`) and a pill may change the radius
(`rounded-full`); nothing else leaves the constant. `floating-surface-is-one-constant`
fails on any tsx file that writes `bg-floating` without importing it, bar a
fixed list that only falls: the edge-to-edge sidebar peek, the inline rename
field, the `Dialog` surface table and the mock scenes.

**One width scale.** A floating surface is 240px wide when it is a menu (never
under 200), 320 or 384 when it is a popover, 500 when it is a studio panel (a
form in a popover), 360 when it is a toast, 320 when it is the hover card and
420 when it is the session switcher. Nothing else: 224, 260, 300 and 368 are
retired. The four popover widths are named once in `@goodboy/ui`:
`POPOVER_WIDTH_PX` and `POPOVER_WIDTH_CLASS` hold `compact` 240, `standard` 320,
`wide` 384 and `studio` 500, and a `useDropdown` call reads its `width` and
`expectedWidth` from them instead of writing a pixel value. A popover never
carries a hand-measured height: `useDropdown` measures the open panel and caps
it with `maxHeight`, so a row or header that changes height cannot leave a gap
or clip. Any other wide panel is the exception, listed in
`regressions/popover-widths.baseline.json`, which counts the off-scale widths
per file and never lets one grow. A suggestion list that sits on top of a composer is
bounded to the studio width and never runs the width of the composer. A popover opens
below its trigger or flips above it when the room below is smaller, and shifts along the
edge to stay at least 8px inside the window; `tooltips-and-popovers.test.tsx` proves it
for the model picker, the run settings and Asks you, a row menu and the trigger label.

**Side cards place with `useFloatingPlace`.** The rail flyout and the session
hover card open beside their anchor through `useFloatingPlace`, which wraps
`placeFloating` (side `right`, alignment `start`, an 8px gap and edge, flipping to
the left when the card does not fit). It paints nothing until the first
measurement and measures again on a resize and on a scroll of any ancestor
(capture), skipping a scroll inside the card itself. A new hover card or flyout
calls the hook; it does not copy the clamp.

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

## Icon ladder and row scale

An icon is one of five sizes, `ICON_SIZE` in `packages/ui/src/iconSize.ts`
(imported from `@goodboy/ui`, never re-exported from a domain file), and
nothing else: no numeric `size=` on an icon, in a prop, a default parameter or a
ternary. `icon-size-uses-a-token.test.ts` scans the app and `packages/ui`.

| token               | px  | used for                                                  |
| ------------------- | --- | --------------------------------------------------------- |
| `ICON_SIZE.mark`    | 10  | a glyph inside a chip, a dot, the xs and 3xs controls     |
| `ICON_SIZE.row`     | 12  | the leading or trailing glyph of a row, a trigger chevron |
| `ICON_SIZE.control` | 14  | buttons, menu triggers, rail tabs, form adornments        |
| `ICON_SIZE.notice`  | 16  | the tone icon of a `Notice`, the `DogMascot` default      |
| `ICON_SIZE.hero`    | 18  | empty states, studio headers, choice tiles                |

Stroke is one rule, `ICON_STROKE` in the same file: 2 at `mark` and `row`, 1.75
at `control` and `notice`, 1.5 at `hero`, and 2.5 on a check mark. A call site
passes the token, never a number.

One glyph has one import spelling, the one `conceptIcons.ts` uses
(`TriangleAlert`, `CircleAlert`, `CircleX`, `CircleCheck`,
`SquareArrowOutUpRight`). `lucide-one-spelling-per-glyph.test.ts` fails on the
old aliases. Three glyphs mean failure, each in one place: `CircleAlert` for a
`Notice` of tone danger, `TriangleAlert` for a danger zone, `CircleX` for a
failed run. `ArrowUpRight` means open in a larger view (a drawer's open as page)
and is never an external link: that is `SquareArrowOutUpRight`.

A brand mark (`DogMascot`, `IntegrationGlyph`, `BrandGlyph`) takes its own pixel
size and is not an icon here. A row, one line or a menu row, is 24, 28, 32, 36,
40 or 48px high, and a resized row keeps its hover and focus states
(`ROW_INTERACTIVE`). `row-heights-on-the-scale.test.ts` fails on a height between
22 and 48px that is not on that list.

## Gap scale

One limited scale where each step has a meaning. Never an arbitrary value, and
never 20, 28 or 40px.

| token   | px  | separates                                    |
| ------- | --- | -------------------------------------------- |
| `gap-1` | 4   | a tight group: icon plus label               |
| `gap-2` | 8   | controls in a row, the parts of a chip       |
| `gap-3` | 12  | rows in a list, the fields of a form         |
| `gap-4` | 16  | controls, or related blocks                  |
| `gap-6` | 24  | sections (`PANE_RHYTHM.stack`)               |
| `gap-8` | 32  | a header zone from a body zone, page regions |

`gap-0.5` (2px) stays for a hairline gap between stacked rows. `gap-5`, `gap-7`,
`gap-10` and their `gap-x`, `gap-y`, `space-x` and `space-y` twins fail
`scale-rules.test.ts`.

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
- **A concept has one tone everywhere.** The nav, the lens switcher, search and
  the palette read the same `CONCEPT_TONE` entry. There is no second map for
  the nav. Agents and Auto agents are `primary`, plans and artifacts are
  `draft`, and `merged` stays the color of a merged pull request and a done
  stage.
- **An agent color is not a state color.** No `--color-agent-*` token equals
  another agent token, `primary` or a tone, in either theme
  (`identity-palette-avoids-state-hues.test.ts`). Auto is its own green-teal,
  CI fixer its own cyan.
- **On an artifact, colour says the state, never the kind.** `plan`, `report`
  and `wireframe` are `neutral`: the glyph and the word name the kind. A plan
  nobody ran is `warning` (the next click is yours), one that ran is `success`,
  a replaced or discarded one is `neutral`, and `merged` never appears on an
  artifact. In the report kit, `decision`, `summary`, `goal` and `note` are
  neutral structure, `risk` and `question` are `warning`. A kit callout is a
  neutral surface with a tone line and a toned icon, never a tinted fill.

Eight tones (`success`, `info`, `warning`, `danger`, `primary`, `merged`,
`draft`, `neutral`). Each one resolves through the single accessor
`tintClasses(tone)`. Components take a `Tone` and call it. They never
hand-write `bg-warning/10`. Every solid semantic fill uses the shared `on-tone`
text colour.

An icon inside a solid fill, a `primary` or `danger` button or a `ghost-danger`
button takes the label colour (`[&_svg]:text-current` in `tintClasses(tone).solid`
and `BUTTON_VARIANT_CLASSES`), so a toned icon passed in never draws a dim tint
on the fill. `ButtonIconColor.test.tsx` pins it per variant and per tone; the
`on-tone` contrast on every tone in both themes is pinned by
`token-contrast-floor.test.ts`.

### Identity palettes

Identity colour names an object instead of describing its state. Two workflows
running at once are both `info`, and that is exactly the pair a reader needs to
tell apart. So a run and a workspace get a colour that says "this one" and
nothing more.

One set serves every object that needs a name: `--color-identity-1` to
`--color-identity-8` in `apps/desktop/src/styles.css`, chroma 0.09 on eight
hues, with no red and no amber, so a lane never reads as failed or waiting
(`identity-palette-avoids-state-hues.test.ts` keeps every hue 30 degrees or
more from the danger and warning hues). Two accessors read it, and nothing
else does:

- `runIdentity` in `apps/desktop/src/features/session/timeline/runIdentity.ts`
  picks a start slot per session from a hash of the session id. Then it walks
  the set with stride 3 across workflow runs and agent chains, ordered by
  creation time and id. 3 and 8 share no factor, so every slot is used before
  one repeats. It gives two versions of one slot: `stroke` for an SVG lane and
  `spin` for the running border. The run's glyph stays neutral, so
  a lane colour never lands on a chip. `runIdentityStroke`, next to it, turns the
  index the rail geometry carries back into a stroke.
- `workspaceAccent` in `apps/desktop/src/features/workspace/color.ts` hashes a
  workspace id onto the same eight slots for its sidebar dot.

Three limits keep identity small:

- Identity never reads as a tone. `token-contrast-floor.test.ts` keeps every
  identity colour at oklab delta e 4.5 or more from every tone, and at 4.5:1
  as text on every surface. A violet lane is not a plan. A lane colour says
  nothing beyond "these rows are one run".
- Identity colours the lane, the running border and the workspace dot, nothing
  else. Stage stays in the marker on top of the lane, which still goes through
  `tintClasses(tone)` like everything else.
- `TimelineRunChip` is an 18px glyph circle with the icon of the run's origin
  and no word. It is neutral at rest and fainter on a discarded run, whatever
  the run state. The palette never enters `packages/ui`.

A run row carries the glyph, one title and at most one short status line.
`TimelineRunLabel` prints the run title (`run.title`, falling back to the
workflow name) with a single `truncate`, and never the run goal: a goal is a
document and lives in the workflow detail. A preset or custom workflow names itself in the glyph's hover card and
accessible name.
When any step of the run, at any depth, waits on an open question,
`runOpenQuestion` picks the oldest one. The run row then takes the question
node, says "Needs your answer in step 4.2" in the warning tone, and shows a
visible Answer as a neutral secondary button. Answer calls `focusQuestion` and
opens the questions lens on that exact question. Every Answer on the feed
(agent and run rows) is the same action.

One waiting launch is marked once. The agent or run row keeps the amber
question node and "Needs you" and its one Answer, and everything around it
stays quiet: only a row whose `rowStateTone` is warning gets the soft warning
wash. A question asked inside a launch has no row of its own in Activity, and a
question without a launch has none until it is answered, when it becomes one
muted row of the Log. What waits on you is gathered in the **Needs you**
block, not in a chip: see "Needs you and the two views" below.

Agent kinds (`--color-agent-*`) and provider glyphs (`--color-provider-*`) are
identity palettes of their own. Each has a single accessor and is held to the
same floor test. Anything else that reaches for an identity colour is a bug.
Add a tone instead.

The rail, work node and row vocabulary continues in [Rail and work vocabulary](design/rail-and-work.md).

## z-index tokens

Named tokens in `apps/desktop/src/styles.css` under `@theme`, with keys
`--z-index-*`. Tailwind v4 turns each key into a `z-<name>` utility. The order
is a precedence chain (each layer must sit above the one below).
`docs/styling.md` owns the reasoning. This table is only the registry.

| token                        | value | who                                                                                |
| ---------------------------- | ----- | ---------------------------------------------------------------------------------- |
| `--z-index-studio`           | 50    | the `AppShell` studio slot and the app studios over Home, the floor: never lowered |
| `--z-index-popover-backdrop` | 55    | click-catcher behind the app-global popovers                                       |
| `--z-index-onboarding`       | 60    | the onboarding wizard over a studio                                                |
| `--z-index-drag`             | 62    | the workflow studio drag ghost                                                     |
| `--z-index-popover`          | 65    | the app-global popovers                                                            |
| `--z-index-command-palette`  | 70    | ⌘K, which fires whatever else is open                                              |
| `--z-index-tooltip`          | 75    | triggerable from inside a popover or the palette                                   |
| `--z-index-toast`            | 85    | the toast stack                                                                    |
| `--z-index-lightbox`         | 90    | the image lightbox, above everything z-indexed                                     |
| `--z-index-boot`             | 95    | the boot splash fade-out cover, above everything z-indexed                         |
| (native `<dialog>`)          | n/a   | the browser's top layer, above every z-indexed element                             |

A popover opened from inside the command palette does not need a higher token.
`PopoverPortalProvider` gives `useDropdown` a portal target inside the
palette's own layer, so the popover stacks at `z-popover` within the palette's
`z-command-palette` context and renders above its panel.

`useDropdown` also holds an escape layer while its popover is open, so Esc closes
the popover before whatever it opened from, and it returns focus to the trigger
when Esc closed it from inside. Pass `isEscapeEnabled: false` only when the
surface must keep Esc for itself.

A press inside a popover opened from within another popover (a `Listbox` in an
`AnchoredPopover`) counts as inside the outer one, so choosing an option does not
close it. `AnchoredPopover` marks the press on its surface through
`dropdown.markPress`, and React carries it across the portal; a press outside
both still closes both.

## Motion registry

Four animations, one meaning each: `spin-border`, `soft-pulse`, `cost-tick`
and `text-shimmer`, described below. The Skeleton pulse is `soft-pulse` under
the Tailwind name `animate-pulse` (`--animate-pulse` points at it), so the
app has one breathing animation, not two: a loading skeleton and a running
sign share the same period and dip, and the surface they sit on says which
one it is. Transition keyframes (`reveal-fade`, `fade-in`, `history-arrive`,
`nav-step-in`, `nav-step-out`, `studio-in`, `studio-out`, `studio-body-in`,
`layer-in`, `layer-out`, `drawer-fade-out`, `drawer-overlay-in`,
`drawer-overlay-out`, `drawer-swap`, `trail-crumb-in`, `crumb-menu-in`,
`popover-in`, `fold-fade-in`, `fold-fade-out`, `level-in-forward`,
`level-in-back`, `level-out-forward`, `level-out-back`, `wizard-fade-in`,
`wizard-fade-out`, `wizard-step-in`, `wizard-step-out`, `welcome-word-out`,
`welcome-rise`) move content between states and sit outside the meanings.
`motion-registry.test.ts` fails on a `@keyframes` in `styles.css` that this
section does not name, and on a name here that `styles.css` does not define.

**Three durations, two curves.** Every transition and animation takes one of
`--duration-quick` (120ms: a popover, a fade, anything that leaves),
`--duration-base` (200ms: a width, a drawer, a level, a swap) and
`--duration-slow` (280ms: a studio opening), and one of `--ease-enter`
(`cubic-bezier(0.2, 0, 0, 1)`: what arrives) and `--ease-exit`
(`cubic-bezier(0.4, 0, 1, 1)`: what leaves). A stagger is `--delay-step`
(60ms). Four values sit outside the scale on purpose: the three loop periods
`--loop-pulse`, `--loop-spin` and `--loop-shimmer`, and `--hold-history-arrive`
(the 1.4s fade of a landed history row). The fold and level timers are
`DURATION_BASE_MS`, and `DRAWER_EXIT_MS` is `DURATION_QUICK_MS`, in
`packages/ui/src/motionTimings.ts`; `motion-registry.test.ts` pins each constant
to its token. A literal duration or `cubic-bezier` in `styles.css` outside the
token block fails the same test.

**Motion tokens.** A width that opens or folds (the main sidebar grid column,
the session rail, the drawer track, the diff file rail) eases in
`--duration-base` (`DURATION_BASE_MS`); words fade in `--duration-quick`
(`fold-label-out`, and `fold-label-in` after one `--delay-step`, so they arrive
once there is room); a level drill takes `--duration-base` in, after one
`--delay-step`, and `--duration-quick` out (`DURATION_BASE_MS`); drawer content fades in
`--duration-quick` after one `--delay-step` (`drawer-content-in`) and out in
`--duration-quick` (`drawer-content-out`).
Width moves only on the one element that owns it; what moves inside it is
opacity and `transform`, and the content keeps its final width, so nothing
reflows or wraps mid move. Every new keyframe lives under
`prefers-reduced-motion: no-preference`, and the hooks that stage a move
(`useFoldPhase`, `useLevelSwap`, `useDrawerExit`) check `canAnimate` first: under
reduced motion, or with nothing laid out, the state changes in place.

**A floating control stays mounted and fades.** A control that comes and goes
with the reader's position (the chat's **Jump to latest**) is never mounted and
unmounted: it stays in the tree, `inert` and `aria-hidden` while it is not
needed, and moves between `opacity-0` and `opacity-100` with
`motion-safe:transition-opacity` on `--duration-quick` and `--ease-enter`, so it
does not pop in during streaming and a screen reader never lands on it hidden.
It is built on `IconButton`, never a hand-made round button. A mark that shows
where unseen content begins is a plain hairline (not a `Divider`, which sits
between chrome) with the word **New** in the muted meta type, drawn once, never
animated.

**A hidden window stands still, and forced colors keep the sign.** While the
window is hidden or minimised, `useHiddenWindowPause` sets `data-window-hidden` on
`<html>` from one `visibilitychange` listener, and one rule in `styles.css`
pauses every running animation under it: no per-element observer, nothing to
unsubscribe. Under `forced-colors: active` a pulsing dot or arc takes the
system `Highlight` colour and the `spin-border` ring traces in `Highlight`, so
the "who is working" sign never vanishes with the author palette.

**A fold keeps every icon where it is.** `FoldLayers` holds a rail's two
states as two layers pinned to its left edge and clipped (`overflow-clip`): the
open layer at its full width and the 44px icon layer under it. Folding, the
width eases to 44px while the open layer, on the rail's own surface
(`bg-inherit`), fades out over the icons and is removed at the end; unfolding is
the reverse, and the icon layer leaves once the words are in. The icon layer
draws each icon at the x and y of its open row: a `RailButton` is the open row
without its word, the session rail's icon level starts with the session node on
the identity row's line and its pages on 28px rows, and the main rail's New
and doors sit on the column's rows. Neither layer carries a toggle: the one
sidebar toggle sits in the top bar, so it never moves when the column folds.

**A drill crosses levels in one move.** `LevelStack` keeps its layers
absolute, so no height changes. On a level change `useLevelSwap` copies the
leaving layer (`exitSnapshotOf`, the drawer's exit copy) during the render that
changes it, slides the copy 24px toward the back and fades it, and slides the
new layer in 24px from the drill side (forward from the right, back from the
left). The folded icon levels drill the same way. The `Trail` closes a crumb label with `grid-template-columns` from
`1fr` to `0fr` (`--duration-base`, `--ease-enter`, 40ms cascade), the same
trick as `Reveal` on the other axis.

`Reveal` is the one height transition for disclosed content: `grid-template-rows`
from `0fr` to `1fr`, `--duration-base` on `--ease-enter`, the pair of the `AppShell` columns,
behind `motion-safe`. It keeps its children mounted through the
collapse and unmounts them on `transitionend`, or at once when no transition
runs (reduced motion, tests). `Collapsible` opens through it. A disclosure
never mounts and unmounts its panel by hand.

`Disclosure` is the toggle-and-body pair for a row that opens its detail: a
14px chevron, an 8px gap and a label on one `px-2` line, and a body inside
`Reveal` whose left indent is measured from them (`pl-[calc(8px+14px+8px)]`,
never a typed `pl-5`, `pl-7` or `pl-9`). A body that sits under a control
measures its indent the same way, from that control's own padding, width and
gap. The ratchet `hand-indent.test.ts` counts `pl-5`, `pl-7` and `pl-9` in
`features/` and only falls.
Its optional `actions` sit beside the toggle on the same line, never inside
it, so a group header can carry a bulk button (Next's **Retry 3**) without
nesting a button in a button.

A theme switch is one paint, a class swap on `<html>` and nothing else:
`applyDocumentTheme` writes the `light` or `dark` class, `data-theme` and
`color-scheme` once each in a single task, and the CSS variables repaint the
page in that frame. There is no React state for it (the zustand store keeps
only the preference, set in the same call, so the palette, the Settings field
and the footer chip commit once together). Every route into a switch (the
top bar toggle, the palette, Settings, the system, another window) goes through
that one function (`switchTheme`), and it writes nothing when the resolved theme is already
applied. `html[data-theme-switching]` turns every element transition off from
before the swap until two painted frames later (a timer guards a window that
never paints), so no `transition-colors` surface animates on its own and a
state change in the same click, such as the selected tab, does not fade
through the new palette. Never add a per-element color transition for the
theme, and never wrap the swap in `document.startViewTransition` or fade a
cover over it: the switch stays the instant swap
([docs/traps.md](../../docs/traps.md) → Theme switch is an instant swap). The few things
that paint with JS colors (the xterm terminal, the changelog image) listen through `subscribeAppliedTheme` or `useAppliedTheme` and
update only themselves.

- `spin-border`: working, on an element whose own edge carries the signal
  (a `WorkNode`'s ring). A session card carries its tone in a
  `ToneBar` instead, a bar inside the surface rather than a border around it,
  breathing through `soft-pulse` while running. A session row in the column has
  no bar: its `WorkNode` is the sign.
- `soft-pulse`: the only animation in the app for a lasting state. It breathes
  a state that holds and is alive: the centre dot of a running
  `WorkNode` that carries no step number, the head of a running `WorkNode`'s
  progress arc (which then replaces the centre dot), a running tool icon or
  scout dot, a running session's `ToneBar`. On the
  rail it sits inside the `spin-border` ring, or on the arc, so the pair reads
  as one running state, not two claims. The bar for another lasting-state
  animation is high.
- `cost-tick`: the spend chip's amount just changed. The figure rises 6px into
  place in `--duration-base`; with reduced motion it changes in place.
- `text-shimmer`: a label whose action is in flight, such as a handoff while
  its agent starts. It replaces a spinner next to the label.
- The update pill has no animation of its own. It enters once with
  `studio-body-in` (opacity and 4px) when a new version arrives, then holds
  still in the soft primary tone. The arrival card announces it; nothing
  sweeps, rings or repeats on focus.
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
`collapsed-rail-width.test.tsx` pins both. The main sidebar has one toggle,
`ColumnToggleButton` in the top bar left of Back and Forward (⌘B), the same
button whether the column is open or folded, and neither the column nor its
44px rail draws a toggle row (`sidebar-toggle-axis.test.tsx`). Widening the rail to fix a padding is
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
- The exception is a chip that leads a title (the role chip of an agent, the
  Workflow chip of a run): it is part of the label, so it hugs its word and
  the title follows it. The column a reader scans in those rows is the state
  slot and the meta on the right. Every such chip is `Chip`, a pill tinted in
  its role colour; `hand-made-chips.test.ts` counts hand-rolled pills per file
  and the count only goes down.
- A chip that works as a control next to buttons (the session overview's
  context, attention, linked-work and branch chips) is `Chip kind="reference"`.
  That gives the `h-6` control height, the focus ring,
  and a tone hover. A custom element that needs the same frame (a popover
  trigger with its own ref) takes `chipClasses`, never a local class string.
- In a right-aligned cluster, variable text comes first and glyphs last. What
  sits nearest the edge must be constant-width, or it wanders from row to row.
  In a left-aligned cluster the glyph comes first. The test is where the group
  is anchored, not what looks tidy in one row.

Compatibility empty-state and keyboard aliases remain only while callers owned by
parallel units are migrated during integration. New callers name EmptyState section
and Kbd inline or cap directly.

The Terminal first-time page has no rail and offers the one New terminal. Loading the terminal view
announces Starting the shell. Permission rules and recent decisions use section
states that explain when rows are added. Other Settings scope lists retain their
existing states until their separate loading contracts are covered.
