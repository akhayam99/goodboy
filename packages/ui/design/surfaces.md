# Surfaces

> **Read this when** you change the report sheet, the pull request page or the workspace chat. **Not for** tokens and scales ([DESIGN-SYSTEM.md](../DESIGN-SYSTEM.md)) or intent and product judgment ([DESIGN.md](../../../DESIGN.md)).

## Report sheet

`ReportSheet` is the one shape for reporting a bug. It takes everything from
props and reads no store, so it also renders inside `ErrorBoundary` after the
app below it has crashed.

- **Variants**: `floating` is level 4 (`FLOATING_SURFACE`), placed by the host
  to the right of the sidebar bug icon (`side: 'right'`, `align: 'end'`, inside
  the window) with no overlay, or at the bottom centre when the icon is not on
  screen. `inline` drops the shadow onto `subtle`, for the crash and startup
  screens. The body scrolls in a `ScrollFade` between the head and the action
  row, so a short window never pushes the sheet off screen.
- **Head**: the bug glyph, a `text-heading` title, an optional type control (a
  `chip` Listbox) and an Esc `KbdPill` when the sheet can close.
- **Line**: one borderless `text-body` input that takes focus on mount, and
  can start selected. ⇥ from the line, or Add detail, opens an autogrowing
  `Textarea` under it. ⌘↵ anywhere in the sheet submits.
- **Match**: an open issue that matches the line sits in a `fill` row with
  Add mine there.
- **Attachments**: one `rounded-full` `fill` chip per part, `text-chip`,
  a 12px glyph and a × with a tooltip. A removed part stays as a dashed chip,
  struck through, that puts it back. The error chip carries the danger ring.
- **What gets sent**: a disclosure row (chevron, shield in success, the
  summary in `faint-foreground`) that opens the exact text in a `muted`
  `ScrollFade` of `text-code`, a copy button, and the line that says what never
  leaves.
- **Error**: a danger `Notice` (`inline`) at the end of the body, above the
  action row.
- **Action row**: `FormActions`, with the destination in `text-meta` on the
  left, Add detail while the detail is closed, and the
  primary button whose label names the destination, with its shortcut in an
  on-tone pill.

## Pull request page

The Overview of the Branch page is a document on the 960px column with
a properties column, the page example of the split frame: a rail of sections on the left
(the pages under the current branch row of the Projects tree, `aria-current="page"` on the section on screen) and,
on its right, the crumb band, the header with its state chip and one 640 + 296 grid with a 24px gap
that ends at the column's right edge: Linear's pull request page in our register. The main column
is the description (`SectionHeader` with `Edit` beside it, a markdown editor with
Write and Preview and `Save`, `Cancel` at its end) and the Activity: plain rows
of a 20px glyph on a round `bg-subtle` dot joined by a 1px `border-soft` spine, comments as
`bg-subtle` cards clamped to two lines, one muted line with the person in `text-row`, and the age at the
right in `tabular-nums`; a row that opens something takes `ROW_INTERACTIVE` and
says what it opens (`Open Comments`, `View checks`), a row that opens nothing has
no hover. The title is the page's `h1` in the fixed 32px title row
(`PaneTitleRow`): editing swaps its content for an input of the same height, so
the page never jumps. The side column is 224px beside a reading column of at most a prose measure (`max-w-prose`, 65ch) from an 880px page
container (`@container` query, not the window); below it the side column sits above the
reading column as one wrapping row. Each block is a faint `text-meta` label over its value rows
of 28px or more and nothing else: Reviewers (the verdict right after the name, not pinned to
the edge), Bots that commented (no verdict), Author and Linked issues with their relation.
The state is the chip in the line under the title, never a block, and the status strip sits
between the header and the columns: four cells on `bg-subtle` split by 1px `border-soft`
gaps in one `rounded-lg` frame, each a `text-meta` label, a `text-label` word after a
`StatusDot` and one faint `text-meta` detail; the cells take their tones from the branch state
map (conflicts `warning`, a failing check `danger`). Labels are not headings, so the outline reads `h1`, then
the `h2`s of Description and Activity.

**The capability rule.** The page never branches on the host. It reads the
`ReviewSourceCapabilities` of the active source: a control the host cannot do on
an object that exists is shown disabled with its reason in words (`Bitbucket has
no draft pull requests`, `Turned off in payments-api`, `Set by the project`), a
control for a concept the host does not have is left out. The merge
confirm is an inline panel with one `ChoiceCards` group (`ActionConfirm.choice`):
the option cards carry the effect sentence, draw no icon tile when they have no
icon, and a forbidden one is disabled with its reason. A card hugs its content: a title line with an optional `badge` tag, then one muted `hint` line. States follow the five of Empty states: no pull request is the branch page
(the branch as the title, its pushed state and distance as the line under it, the
status strip, then the create form with `In this branch` under it), the activity
loads as a `SkeletonRow`, a failed read is an inline danger `Notice` with Retry.

## Workspace chat

The chat page (`features/workspace-chat/components/ChatStudio`) is a studio
on `StudioRailLayout`: the chat list is the rail on `chrome`, one
conversation is the wrapped sheet, and "Start work from chat" is the
`DrawerColumn` drawer beside it, never a dialog.

- **List rows** are `InteractiveRow`s: title `text-meta`, the last answer
  as a `text-meta` snippet, time as `text-meta` on the right. Pin and
  Archive are ghost `IconButton`s that replace the time on hover. Groups are
  `Eyebrow` headings (Pinned, Today, This week, Idle). An idle row keeps its
  shape and only drops a text step (`faint` title, `disabled` snippet); a
  group action ("Archive idle") is a quiet text button at the end of its
  heading, and its Undo line takes the group's place.
- **The conversation** sits on `PageColumn`, the same 960px column as every
  other page: the header, the thread and the composer share one left and one
  right edge. Prose (paragraphs, lists, quotes, headings) stops at the 720px
  measure, left aligned; tables and code blocks take the whole column. The
  question is a `bg-subtle` bubble on the right in `text-prose`; the answer is
  `Markdown` in `text-prose` with no bubble. Under it, in order: `Read N files`
  (a quiet
  disclosure listing paths in `text-code`), then one `h-7` row. Copy
  (`CopyButton` with `tone="faint"`) and "Start work from chat" sit on the
  left, quiet `text-meta` actions that show on hover or keyboard focus of
  the answer (`group/answer`, `opacity-0` at rest so the row never shifts);
  the model and effort that wrote the answer sit on the right as faint
  `text-meta` text, always visible. A saved session link is a
  `bg-subtle` note in the thread under the answer it came from. A streaming
  answer with no text yet shows a pulsing `StatusDot` and "Reading {workspace}",
  never a spinner.
- **The header** holds the chat title as `text-heading`, the linked-sessions
  chip and one secondary `Start work` button. The chip is a `border-soft`
  button with the sessions glyph, "N sessions" and a `StatusDot` in the tone
  of the most urgent linked session (`STAGE_TONE`); it opens an anchored
  popover listing each session with its stage dot, title, origin and an Open
  button. It is absent while no live session is linked.
- **The composer** is the only pinned row: a `bg-subtle` box with the
  textarea, the app `RoutingPicker` in its `pill` variant (chat providers
  only, effort editable, a one-line footer for the providers that cannot
  chat), the faint "Read only. Nothing is changed." hint from `@2xl/chat`, and a
  square send button that turns into Stop while an answer streams. The Enter
  and Shift+Enter keys live in the send button's tooltip.
