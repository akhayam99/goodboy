# Controls

> **Read this when** you build or change a control, a list box, a menu or a key hint. **Not for** tokens and scales ([DESIGN-SYSTEM.md](../DESIGN-SYSTEM.md)) or intent and product judgment ([DESIGN.md](../../../DESIGN.md)).

## Primitives

The register taxonomy, and the rule that all registers share one family, live
in [DESIGN.md](../../../DESIGN.md). The barrel file is the list of primitives. A
list in a doc goes stale, `src/index.ts` cannot, and an export nobody reads is
deleted with its test and its doc line (`ui-exports-have-consumers.test.ts`
counts the ones left). If a register needs a shape
the family does not have, add it to the family. A register never keeps a
private one.

## Control scale

One ladder of control heights runs through every register: **24** (`xs`),
**28** (`sm`, the default), **32** (`md`). Nothing else is a control height.

| Primitive                            | Sizes                                                                                                           | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Button`                             | `xs` 24 (icon 12, gap 4), `sm` 28 (icon 12, gap 8), `md` 32 (icon 14, gap 8)                                    | Variants `primary`, `secondary`, `ghost`, `quiet` (a ghost with muted text), `danger`, `ghost-danger`. Solid `danger` is the confirm button of `InlineConfirm` only: no other first click is solid red. Disabled is the `fill` background with the `disabled-foreground` label, never `opacity-50`. `Chip`, `Switch`, `CardAction`, `SegmentedTabs`, `ChoiceCards`, `Listbox` rows and `IconButton` share the `DISABLED` string (`disabled-foreground` label, not-allowed cursor). `Skeleton` fills with the `skeleton` token. |
| `IconButton`                         | `xs` 24, `sm` 28, `md` 32 squares, `rounded-md`, glyph 12, 14, 14                                               | Ghost by default. A border only for `variant="outline"`. A smaller glyph sits inside the 24 target. Every icon-only control keeps its tooltip.                                                                                                                                                                                                                                                                                                                                                                                 |
| `Chip`                               | `kind="state"` pill 20 (11/16), `reference` badge 24 (12/16, clickable), `id` 4px mono badge 20, `count` dot 16 | The kind is the meaning and the only geometry prop: a chip names a `kind`, never a size or a shape, and none named is a `state` pill. `StateBadge` is `Chip kind="state"`. A routing chip (effort, reply length, mode) is neutral and selected by fill.                                                                                                                                                                                                                                                                        |
| `Meter`                              | `xs` 4 track, `sm` 6 track; the fill is a tone, default `primary`                                               | A bar that draws a number. It is `role="meter"` with a required label, a value and a max, so the caption never carries the only reading. The track is `METER_TRACK`, which a stacked bar shares. A hand-made track beside a styled width is counted by `hand-made-meters.test.ts`.                                                                                                                                                                                                                                             |
| `StatusDot`                          | `sm` 6, `md` 8; the fill is a tone                                                                              | A small round status mark. A hand-made round span with a status fill is counted by `hand-made-dots.test.ts`; a labelled dot takes `ariaLabel` and gets its role and name.                                                                                                                                                                                                                                                                                                                                                      |
| `SegmentedTabs`                      | `xs` frame 28 (inside a title row that also holds actions), `sm` frame 32 (page-level tabs on their own row)    | The tab keeps one weight selected or not; selection is a fill. A group of two to four choices is `SegmentedTabs`; a group of cards with a description is `ChoiceCards`.                                                                                                                                                                                                                                                                                                                                                        |
| `Input`, `Textarea`, `Listbox` field | `sm` 28 (default), `md` 32                                                                                      | 13px `text-ui` text, `rounded-md`. `SearchField` (28, search icon, clear button, `ariaLabel` required) is the one search input, with one focus ring on its container and none on the inner input; it takes a `hint` for a registered shortcut.                                                                                                                                                                                                                                                                                 |
| `Checkbox`                           | 16 box, 4px radius, inside a 24 hit area                                                                        |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `Switch`                             | 16 by 28 track inside a 24 target                                                                               | The label names the setting and never says On or Off: the setting goes in `ariaLabel`.                                                                                                                                                                                                                                                                                                                                                                                                                                         |

A bar has one control height. Every control in the top bar is 28 and
`rounded-md`: the history arrows, Board, Chat, the command centre, the bell,
Spend, the Limits chips and the Now chip all take
`TOP_BAR_CONTROL` (height `h-7`, square `size-7`, radius `rounded-md`) and
`FOCUS_RING`. The bar container stays `h-9`. The right cluster reads Now (with the needs you count first), Limits,
Spend, the bell, and Spend opens Impact on its Spend tab (`Spend today. Open
Impact`): Impact is a sidebar door, and the bar has no Impact icon and no theme
toggle. The command
centre says `Search` with its chord as bare text; the workspace name lives in its
tooltip. The Limits overflow chip prints a word, `+2 providers`, never a bare
number. The trail keeps the first crumb's word until every other ancestor has
shrunk to an icon and folded (`compactTrail`). A fold holds two crumbs or more: a lone ancestor stays an icon, which is as wide as the fold. `Trail` has no lead slot: nothing sits before the first segment, and no crumb carries a back glyph. The bell's count badge sits 2px
inside the bell's box. The session trail band keeps its 24 controls, and trail,
rail and tree-row buttons are 24.

A task chip reserves a 16px trailing slot that shows the unlink on hover, so
the button never covers the last character of the label.

A selected card is a fill plus a check: never a ring, a border and a wash
together.
A `ChoiceCards` option may carry `facts` (label and text pairs, the New
session page's Example line). While nothing is picked the cards are explained:
each card has a soft border and draws its facts under the hint. Once one is
picked every card folds back to the one-line card, so the form under it has
the room. A focus ring appears on keyboard focus (`focus-visible`) only.

Rules for new and changed code (the migration of old code is the sweep's):
icons use `ICON_SIZE` (mark 10, row 12, control 14, notice 16, hero 18), on the icon and
on an `iconSize` override alike, and a file never keeps its own alias of a step
(`const KIND_ICON_SIZE = 10`): `scale-rules.test.ts` counts all three; mono is for
branch, path, command, sha and code; money, counts and durations are sans with
`tabular-nums`; rows sit on 24, 28, 32, 36, 40 and 48; gaps sit on 4, 8, 12, 16,
24 and 32 (no `gap-5`, `gap-7`, `gap-10`); labels are sentence case, and a
section label goes through `Eyebrow`.
`control-heights.test.ts`, `kbd-overrides.test.ts`,
`hand-rolled-radio-groups.test.ts`, `switch-labels-name-the-setting.test.ts`,
`row-heights-on-the-scale.test.ts` and `scale-rules.test.ts` hold the line.
`scale-rules` is at its end state: its baseline lists only the files a named unit
still has to change, and a mock scene (`design-scale-ladders`, `design-controls-scale`)
draws every step from the tokens.

## Listbox

`Listbox` is the one control for picking a value from a list. There is no
native `<select>`: the WebKit menu ignores theme, density and keyboard.
`no-token-bypass.test.ts` fails on `<select` and on any import of `Select`.

- **Trigger**: `field` in forms and Settings (hairline `border`, the
  container's fill, 28px `sm` (the default) or 32px `md`, 12px text,
  `rounded-md`), `quiet` for a value
  inside a row (muted text, `bg-hover` on hover), `chip` inside cards and steps
  (`chipClasses`). Open, the border goes to `border-strong` and the chevron
  turns 180 degrees in 120ms. Disabled, the text is `disabled-foreground` and
  `disabledReason` shows in a tooltip.
- **Popover**: level 4 (`floating`, `shadow-lg`, `border`, `rounded-lg`),
  padding 4, at least the trigger's width and at most 360 by 320, scrolling in
  a `ScrollFade`. It opens below and flips above with `useDropdown`, entering
  in 120ms (opacity and a 0.98 scale, `animate-popover-in`). Every select,
  picker and filter opens under its trigger, start aligned (`side` `bottom`,
  `align` `start`, the hook's defaults), and clamps inside the window. The hook
  measures the trigger itself when the anchor wrapper holds one element, so a
  wrapper stretched by a column never pushes the popover to the far edge.
  `side: 'right'` opens beside the trigger (the terminal picker, the bug report)
  and flips left when the right is short. An override of either needs a reason
  in `regressions/popover-anchoring.baseline.json`, which only falls. It keeps 12px from
  the viewport edge. `popupWidth="trigger"` fixes the width to the trigger's
  (160px at least) so a long title truncates instead of widening the popover;
  use it with an `isBlock` trigger in a drawer or a form. The 360 cap is a
  `maxWidth` passed to `useDropdown`, because the inline `max-width` the hook
  writes would beat a `max-w-*` class. Popovers stop above the status bar: the
  hook subtracts `--dropdown-bottom-inset` (36px, set in `styles.css`) from the
  room below the trigger, so a popover shrinks or flips instead of covering it.
  A list of long identifiers passes `maxPopupWidth` to raise the 360 cap: the
  branch pickers (`BranchCombobox`, `BaseBranchSelect`) pass
  `BRANCH_PICKER_MAX_WIDTH` (480), wide enough for a ticket-prefixed branch and
  its pull request note on one line.
- **Option**: 32px on one line, or two lines with an 11/16 faint description;
  a 16px leading slot, `text-body`, meta on the right. The cursor, mouse or
  keyboard, is `bg-selected`; the current value is a check on the right and
  `text-row`. No primary tint. A blocked option stays visible in
  `disabled-foreground` and says why on its second line. A group label is a
  muted `Eyebrow`. A label that can outgrow the popup is cut at the end with
  `truncate`, in the row and the trigger; text never stays after the ellipsis.
  Names that share a start are told apart by what the row carries beside them
  (a pull request number), and the full name sits in the tooltip.
  A name in a row is never cut in the middle. A file or terminal path keeps
  the extension or last segment after the ellipsis (`MiddleText`).
- **Search** appears on its own above 8 options (or with `searchable`): a flush
  row (search icon, no box, a hairline divider below, no focus ring of its own),
  a fuzzy filter, the match underlined (the list itself shows the matches, so no
  "3 of 41" count), and an empty state in one
  sentence plus the `create` row when the caller can make the value.
- **Multiple**: a checkbox in the leading slot with the row icon beside it,
  Enter toggles and stays open, a footer reading "2 selected" (nothing at 0)
  and Clear.
- **Empty copy**: `emptyLabel` and `noMatchLabel` replace the default "No
  {noun}s yet" and "No {noun} matches" sentences when the list has its own
  words ("No sessions match").
- **Keyboard and ARIA**: the APG select-only combobox. Enter, Space and the
  arrows open on the current value; arrows, Home, End, PageUp and PageDown move;
  letters run typeahead; Enter chooses; Escape and a click outside close and
  give focus back to the trigger; Tab closes and moves on. The trigger is
  `role="combobox"` with `aria-activedescendant` (the search field takes it
  when it shows), the list `role="listbox"`, each row `role="option"`.

`ListboxList` and `ListboxOptionRow` are the headless list and row for a list
that lives inside another popover (chips input suggestions, a preset list with
its own actions), so every value list draws the same row. Menus of actions stay
on `MenuList` (object menus, page menus and the `OverflowMenu` body), and inline
choice rows stay inline.

## Menus

`MenuList` is the one body for a menu of actions on an object; `ContextMenu`
places it at the pointer, and an overflow trigger places it in an
`AnchoredPopover`. The desktop feeds both from the action registry, so the two
never differ ([docs/navigation/shell.md](../../../docs/navigation/shell.md#context-menus)).

- **Surface**: level 4 (`FLOATING_SURFACE`: `floating`, `shadow-lg`, `border`,
  `rounded-lg`), 240px wide with a 200px floor and a 384px ceiling
  (`MENU_MAX_WIDTH`, passed as `maxWidth` to `useDropdown` because the inline
  `max-width` the hook writes would beat a `max-w-*` class; a long row
  truncates its label and clamps its description at three lines),
  padding 4, rows at `rounded-sm`, scrolling in a `ScrollFade`. It enters with
  `animate-popover-in` (120ms, opacity and a 0.98 scale). `ContextMenu` opens
  at the pointer and flips left or up to stay 8px inside the window
  (`placeContextMenu`).
- **Row**: a 16px leading slot for the icon, the label, the shortcut glyphs on
  the right in `text-meta text-faint-foreground`, and a chevron when the
  row opens a submenu. Verb groups are split by a hairline, never by headers. A
  blocked row stays in `disabled-foreground` with its reason on a second faint
  line, is `aria-disabled`, and keeps focus so the reason can be read. Only a
  verb whose confirm is destructive takes the danger tint.
- **One submenu level**: `choices` open a second panel beside the row (right,
  or left when there is no room), with a check on the current value. Nothing
  nests deeper.
- **Radio group**: a `kind: 'radio'` entry is a named set of choices drawn in
  the menu itself (`MenuRadioGroup`): a `role="group"` with the label as an
  eyebrow, one `menuitemradio` row per choice with `aria-checked`, and a
  primary check in the leading slot of the current one. Choosing closes the
  menu and runs `onSelect` with the choice id. A disabled group stays
  visible and `aria-disabled`. A choice can carry a `hint` (a count, drawn
  after the label in `text-meta`, as the diff filter does) and a `tooltip`
  (also its `aria-description`, as the run autonomy menu does). Every value
  picker is a radio group: the run route Change menu, Group by in the tasks
  inbox, the file tree filter, run autonomy, the Explore folder switcher,
  the history arrows, the wireframe version and the Jira assignee.
- **Labeled group**: a `kind: 'group'` entry holds items under an eyebrow
  label in a `role="group"` named by it, for a list of places split by owner
  (the New terminal picker groups its folders by session). Radio groups and
  labeled groups are the only places a menu shows a header, because the label
  names what the rows belong to.
- **Item extras**: `tooltip` draws a tooltip on the row (the terminal
  picker's full path), `isActive` paints the row hovered while focus stays in
  a filter field (the row Enter would open), and `shouldStayOpen` keeps the
  menu open after a choice so its owner closes it once the write succeeds and
  shows a refusal inline (the Jira moves and assignee). `shouldStayOpen` works
  on a radio entry too.
- **Confirm in place**: a verb with a confirm swaps the menu body for
  `InlineConfirm`, the menu swap placement below; Escape
  cancels the confirm first, then closes.
- **Keyboard and ARIA**: `role="menu"` with `menuitem` rows (`menuitemradio` in
  a submenu and a radio group). The first row takes focus on open; the arrows, Home and End move;
  letters run typeahead; Enter and Space run; ArrowRight opens the submenu and
  ArrowLeft or Escape leaves it; Tab and a click outside close. Every
  `AnchoredPopover` with `role="menu"` gets the same arrow keys and typeahead
  through `useMenuKeys`, so every overflow menu moves the same way. There is one
  menu body: `OverflowMenu` takes `entries` (`MenuEntry`) and draws them with
  `MenuList`, so a menu opened from a `+` and the object `⋯` share padding, icon
  size and row.
- **No hand-built roles**: only the primitives in this package write `menu`,
  `menuitem`, `menuitemradio` or `menuitemcheckbox`. The desktop renders every
  menu through `AppMenuList`, with no allowlist
  (`apps/desktop/src/__tests__/actions/handBuiltMenus.test.ts`). A picker
  with a filter field puts the field above the list and passes
  `isAutoFocus={false}` so typing stays in the field.

## Key hints

`Kbd` in `packages/ui/src/components/Kbd.tsx` draws every key hint, in one of
two looks.

- **`inline`** is the default. A chord inside a control ("Ask ⌘L", "Search
  ⌘K") is bare `font-sans text-meta text-faint-foreground`: no border, no fill,
  no fixed height. It sits 4px after the label, which is the control's own
  `gap-1`, never a margin on the hint. It is `aria-hidden` when the control
  already says the shortcut in its tooltip, its `aria-label` or
  `aria-keyshortcuts`.
- **`cap`** is the boxed 20px `rounded-sm` mono cap. A single key inside a
  button (Accept A, Reply only R, Skip S) takes it, because a bare letter reads
  as part of the label. The shortcut sheet and the Esc of a sheet header take it
  too.

Inside a filled button a hint takes the button's `on-tone` text (`isOnTone` on
`Kbd`, `KeyHint` and `KbdPill`), never an opacity step. `KeyHint` is the one
component for a hint inside a control: a chord (`⌘↵`) is drawn bare, a single
key (`F`, `Esc`) is drawn as the small cap, and the hint is `aria-hidden`.
`KbdPill` is `Kbd look="cap"` and takes no `className`; `kbd-overrides.test.ts`
holds it. A hint shows only on a control whose shortcut is registered. A control
that lists a shortcut in its tooltip (the Link work chip) does not repeat it as a
cap. `Kbd` sets `data-look` and, on a filled button, `data-on-tone`, so a test names the look
without reading a class.
