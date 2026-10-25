# Layout and action grammar

> **Read this when** you lay out a pane, the left column, action zones, the actions of a card or the actions of a form. **Not for** tokens and scales ([DESIGN-SYSTEM.md](../DESIGN-SYSTEM.md)) or intent and product judgment ([DESIGN.md](../../../DESIGN.md)).

## The left column

`AppShell` lays out one left column on the chrome, a resize handle and the
content sheet. The column is 240px by default, resizable from 200 to 400
(`LEFT_SIDEBAR_*`), and its one reduced state is a 44px rail
(`COLLAPSED_RAIL_WIDTH`). The desktop fills it with `SideColumn`; the rules for
what it holds live in [docs/navigation/shell.md](../../../docs/navigation/shell.md) → Surfaces.

| part        | shape                                                                                                    |
| ----------- | -------------------------------------------------------------------------------------------------------- |
| toggle      | none in the column: the one sidebar toggle is `ColumnToggleButton` in the top bar, left of Back (⌘B)     |
| New session | a 28px row, `text-row`, the primary tint (`bg` and `ring` of `tintClasses('primary')`), `+` in primary   |
| door        | a 28px row: 14px concept icon, the word in `text-row` muted, the shortcut in `text-chip` on hover        |
| current     | `bg-selected`, `text-foreground`, `cursor-default`, `aria-current="page"`, one per frame                 |
| foot        | Settings as a door, then the Goodboy row (`flex-1`) and a size-7 bug icon button                         |
| rail button | its open row without the word: `h-7 w-full px-2`, the icon at the row's x, the word in a right `Tooltip` |

Rows sit 4px apart (`gap-1`); the doors start 4px under New session. The
column swaps its content only for Settings, as two layers in place that
cross-fade (opacity and a 6px slide, 160ms, `motion-safe` only); the hidden
layer is `inert`. Settings takes the column in both sidebar states: over the
44px rail the grid track grows to the saved width while the stored collapse
stays untouched. A studio never covers it: `studioCoversLeft={false}` puts the
studio slot in the `main` area as its own wrapped sheet (`bg-background`, the
`wrapped` sheet edge), and `StudioFrame` with `placement="content"` draws its
band on that sheet instead of on the chrome. A frame whose body is a bare
page (Settings in the default shell) draws no band (`hasBand={false}`) and gives
its page the band's 40px as top padding, so the title row lands where a session
page's does under its trail.

**A session has its own rail, not a card.** The workspace list keeps every
session a flat row and never changes level; the open one is set in medium
weight and takes `bg-selected` while its page is on screen. Its pages, projects
and linked work live on the session level of the session rail
(`SessionRail/SessionLevel`; Projects and Linked as `LevelCard`s, a level 2
`bg-subtle` panel with its header row inside), at the left of the page on the page background
with the column's row recipe, and its deeper levels slide in there over 180ms,
so no card nests inside the list. A page
entry ends in one fixed 40px right-aligned slot: the count in tabular gray and
a 6px dot for running (info) or open questions (warning).

**Pinned sessions are a group.** A **Pinned** group sits first in the sessions
list, above every other group, in pin order. Its header is an `Eyebrow` with the
count, the same header as a group's: a toggle in a grouped list, a plain label
in a flat one (the rest of the flat list then reads Sessions, so the
boundary is named, with no divider). A pinned row is the same row as any other,
with no glyph at rest.

A list that belongs to a studio's page (Chat's chats, Changelog's releases) or
its filters (Tasks, Notifications) uses `StudioRailLayout` with
`placement="page"`: the rail sits on the page background and the resize handle
draws the only line between it and the detail. Every page rail is 288 wide
(`standard`), resizes between 220 and 420 unless the page passes `min` and
`max`, and can take `railHeader` (Tasks' search) plus `onCollapsedChange`, which
adds the fold control to the first row; `isCollapsed` hides the rail, and
`rail={null}` draws no rail at all, for a page with nothing to list (Chat before
its first chat, Terminal before its first terminal). Chat and Terminal rails
fold like every page rail (⌥⌘B, `useInnerColumn`), and their first child is
the full-width secondary New chat / New terminal button. A folded rail keeps a
44px strip with Show the rail at the fold control's height. The page
owns the folded state through `useStudioRailFold` (remembered per surface, and
forced under a pane of 880px), and a folded rail leaves `FilterButton` in the
title row: a 28px secondary button with the lines icon (`ListFilter`) and the count of active
filters, opening the same facets in a popover. Every filter trigger renders
through `FilterButton` (Tasks included); `filter-triggers.test.ts` allows only
the two icon-only `xs` triggers (the Sessions header and the file tree), and
that list only falls.

## Pane anatomy

The package ships the pane primitives `PANE_RHYTHM`, `PageColumn`, `ScrollFade`
and `Divider`, and the pane frame built from them. `PaneShell` lives at
`packages/ui/src/components/PaneShell/` and is the one wrapper every main pane uses. It is a scroll region whose
header and body share one `PageColumn` with the session trail band above it. It has one `h1` per surface.
`meta` holds counts and totals in `tabular-nums` on one muted line 4px under the
title row, never a control. The title row is fixed (`h-8`, centred, no wrap): a long
title truncates and the actions never drop under it. The pane
owns the gap below the header, and children add no top margins. The root is
`@container min-w-0 flex-1` in every scroll mode, so inside a flex row such as
`StudioShell` it fills the pane and `PageColumn` centres the column inside it.

**One header grid.** Every page, sub-page, studio and the Board draws its header
through `PageHeader` (`packages/ui/src/components/PaneShell/PageHeader.tsx`): the
12px header inset (`PANE_RHYTHM.headerInset`), or a 40px studio band where the band
still holds Close, a 32px title row with the page's `h1` at `text-title` and the
actions at its right, and an optional 12px muted meta line 4px under the row. The
title's centre is therefore 28px under the pane top (56px under a band) and its left
edge is the column's content edge on every page; a page names its kind
(`page="overview"`) and `PAGE_MEASURE` gives its column; `frameGeometryOf`
(`packages/ui/src/frameGeometry.ts`) is the table and the journey test reads it. Every
page has one of four frame types in `PAGE_FRAME` (column 1008, reader 768, stage, split
`[rail 288][detail]`), see [the frame map](../../../docs/styling.md#the-frame-map); in a split page the
band is the first child of the detail, never over the rail. Inside
a session the band is the `TrailBar`, and in a studio `StudioFrame` draws it inside a
`PageColumn` of the studio's tier and hands its body `UnderTrailContext`, so the header
adds no top padding; outside both, a bare page keeps 12px above.

**One title per page, no studio title band.** The studio band never draws a
title, a crumb of its own, an icon or a subtitle: the page `h1` is the one
title. `STUDIO_META[kind].close` says where Close lives. A sidebar door page
(`none`: Tasks, Chat, Workflows, Terminal, Impact, Monitoring) has no band and no Close; the top bar
Back and Escape leave it. A closable overlay (`header`: Notifications, Guide, What's new) has no band either: `StudioFrame` hands its Close button
to the page through `PaneActionsContext`, so `PaneShell` draws it as the last
action of the title row; until a page header claims it, the band holds it. The other overlays (`band`: Settings over the window,
Add workspace) keep a 40px band that holds only
Close. A band also appears when the body hands it a trail (`StudioTrail`, the
workflow editor and the Settings crumbs) or a header accessory, and only then is
the body `UnderTrailContext`. The bandless pages, the Board and Settings included,
sit on the 12px header inset in `frameGeometryOf`, like a session page. Optional `tabs` sit on
their own row under the meta line, at the column's left. A glyph never indents the
title: `PaneShell` has no `icon`, `glyph` or `tone`, the concept lives in the crumb. The
crumb names the structure and the `h1` the object, and a report's document title is an
`h2`.
There is no description line and no divider under the header: the text that
teaches goes in the empty state, and the `ScrollFade` edge marks the seam.
The one exception is the four session pages that hold work (Runs, Orchestrated,
Agents, Auto agents), which explain themselves on content and empty alike:
each passes `SessionPageIntro` as its `subheader`, two muted `text-body` lines at
the prose measure from the one copy map `SESSION_PAGE_INTRO`, and their empty
states keep only a title and an action. Every other page, the secondary pages
included, adds no description line.
A detail that needs its own header row passes `HeaderBand` (also an `h1`, in the same
fixed `h-8` row) through the custom `header` slot. The agent detail passes
`AgentHeader` instead: one 32px title row with the role chip, the one-line title (full
name on hover) and the provider mark, then the actions, **View transcript** and the
overflow menu. No meta line, no state, no model and no tabs (the state is the
conversation tail, the model sits in each turn footer), and the conversation under it
starts 8px down (`ChatView` `topInset="tight"`, `mode="conversation"`). A page that must show a banner
under its title (the first lap) receives it through `PaneBannerContext` and `PaneShell`
draws it as the first body block on the column, once, so the title never moves. The session overview passes `headerRhythm="section"`, so the gap under its header is `PANE_RHYTHM.stack`, the same as between its body sections. Its `HeaderBand` holds the title, then one
`Goal` line (an 11px faint label, the goal in muted text on one line with an
ellipsis) only when the goal says more than the title, or `Add a goal` when
there is none, then one row of facts: `Context`, `Artifacts`, linked work, `Link work` and the cost. Goal, decisions and summary
live in the Context drawer, never as a block in the column. `scroll="body"` keeps the header fixed above a scrolling body,
`scroll="self"` hands the body a bounded region that scrolls itself (a
transcript), and `dock` pins a chat composer to the bottom of the same column.
A form's actions never go in `dock`: they are `FormActions` at the end of the
body. Studio
chrome (the studio band) is window chrome, not a heading. The header is named with `aria-label`, so the detail title is
the only `h1` on the surface.

**One centred column.** Every column and measure page is centred in the pane
by `PageColumn` (`mx-auto`) and nowhere else: Overview, Runs, Agents,
Artifacts, plans, reports, Chat, Workflows, settings pages, agent and pull
request detail. Header, trail band (crumbs and the Ask button, whose right
edge is the column's), body and footer share its edges. Prose keeps the 720px
measure aligned left inside it, except an artifact page, which fills the column
(the plan drawer keeps the measure). Three tiers: **measure** (`--measure`, 720px,
`PageColumn width="measure"` or `PANE_RHYTHM.prose`) for prose, **column**
(`--column-max`, 960px) for the page column, and **full** for work surfaces,
which start at the pane's left edge and are the only exception. `PageColumn`
adds the 24px gutter, 16px when the pane is under 720px wide. No view picks its
own width or centres itself: the column changes only when the window changes or
the right drawer opens. `PANE_RHYTHM.hero` (640px) is only for the content of an empty state.
[docs/styling.md](../../../docs/styling.md) owns the column rules.

**The drawer slides the column left.** A drawer (context, plan or artifact,
file diff, script output, a fix run transcript, an agent conversation) takes
its track from the main area and the centred column re-centres in the space
left of it, at its full width while that space is wide enough, in one 220ms
ease-out move (`DURATION_BASE_MS`, none under reduced motion). A full tier work surface keeps its
left edge and only gives up its right. One rule decides the mode: with
`room = main - 16 - 48 - 560`, the drawer pushes while `room` covers its saved
width (side tier 400 by default, reader tier 720) and otherwise lies over the
page at `min(saved, main - 16)`; it is never squeezed. Pushing, the drawer is
its own container beside the page container: both rounded on all four corners
with `frame-edge`, 8px apart, the drawer 8px from the window's right edge, the
drawer on `bg-drawer`. Over the page it spends no pixels on an inset: the
container runs the full height of the sheet, flush with its top, bottom and
right edges, with `rounded-l-frame`, a left border only and `shadow-xl`, over a
`scrim` that fades in in 120ms. The
page under it is `inert`, a click on the scrim dismisses the top escape layer
like Esc, and focus moves into the card on open and back to the trigger on
close.

**The drawer container.** `DrawerFrame` is its one frame: a header whose 32px row sits on the
page title line (`PANE_RHYTHM.headerInset`, `PANE_RHYTHM.headerRow`), a
divider, a body and an optional `dock`. The title row reads icon, title, count
(a number or a version, never a session title), at most one labelled action,
then Close. A pane whose title is a control (the terminal scope picker) passes it as
`titleContent`: it replaces the visible heading, the region keeps `title` as its name. A pane that is a page (Explore) passes `isHeaderless` and draws `PaneShell` as its body: the frame then keeps only the region, Esc and focus, and `title` stays its name. Close always reads `Close` and is a 28px target (`size-7`, 14px
glyph); every utility in the header (copy, open on its page) is a 28px
icon button in one tone. The `dock` is `px-4 py-3`, the same padding for the Ask
composer, a transcript reply field and a script run's status line. The first
control takes focus when the drawer opens (the composer of the dock when it has
one, `Close` otherwise); Esc blurs a non-empty text field first and closes on
the next press, and a click on the scrim does the same through the escape
stack. A toast beside a pushing drawer stops at the container's left edge less the
12px gutter.

**A form opens where you clicked.** One placement rule for every inline form:

| The form acts on             | It opens                                                                   |
| ---------------------------- | -------------------------------------------------------------------------- |
| a line or a block            | inline under it, across the whole code width (both halves in a split diff) |
| a row                        | inside the row                                                             |
| a section                    | in the section body, under its header                                      |
| the page                     | in the header's action zone, or an anchored panel under the primary        |
| a selection                  | a bar at the bottom of the collection; the panel in the detail column      |
| an object of another surface | the right drawer, never a navigation                                       |

Every opening form scrolls itself into view (`block: 'nearest'`), takes focus,
and gives focus back to its trigger when it closes, saved or cancelled: a diff
line composer returns to its gutter number, a file composer to Comment on
file, a plan block composer to its comment button. Ask agent on a diff line
opens that agent's conversation in the `transcript` drawer with the quote in
its field; the diff stays. A split diff needs 880px for its code: under that it
draws unified and the toolbar says `Split needs a wider window`, and the
choice comes back with room.

**Work panes use the full width.** A pane whose body is a working surface (the
terminal, a Tasks list, the Board) passes `width="full"` to `PaneShell`, and to
the `PageColumn` of its tabs. It keeps the 24px gutter (16px under 720px) and
drops the 960px cap, so the header and the body share one left edge on any
pane, from the pane's own edge. The Branch page is not one of them: every tab
sits on the 960px column, the trail and the Ask button included, so nothing
moves from one tab to the next. Its Comments tab is one full-width list at
every width; a comment opens in a side tier `DrawerFrame` with its actions at
the end of the content through `FormActions`.

**Trail separator.** Each segment except the last ends with one 24px chevron
slot in `faint-foreground`: a button that opens the segment's menu, or a static
separator when there is none. Segments sit 4px apart, the name and the chevron
of a menu segment share one `hover` chip, and the chevron turns 90 degrees
while the menu is open. Colour changes take `--duration-quick` on `--ease-enter`; nothing else
moves.

**Trail on pages.** A page below a door names its place with a `Trail` handed to
its header through `PageTrailContext`: `PageHeader` draws it first, a 24px line
(`data-slot="page-trail"`) above the title row in the header's 8px gap, on the
title's left edge, with no band, border or background. `PaneShell` clears the
context for its body, so only the page's own header draws it. The last crumb
names the kind and carries `aria-current="page"`; a link crumb may carry a
`tooltip` and a `shortcut` (the parent crumb reads `Go up to Run` with ⌘↑).

**Crumb menus.** Every trail segment with siblings opens one `CrumbMenu`: a
`floating` popover, radius 8, `border-soft`, 4px padding, a 26px heading
(`Steps · Ship a fix`, count on the right), rows of 30px with five fixed slots
(20px lead, 12px label with an 11px faint second part, fixed-width tabular
meta, a state word with its dot or glyph, a 14px check on the current row on
`overlay-selected`), and an action band on `fill` under the list with at most
two 28px rows. Widths are 300, 380 and 460. It opens in 120ms (opacity and a
4px drop) and closes without motion. A segment whose menu would hold fewer than two entries (rows plus actions) draws as a plain crumb with no chevron, so there is never a menu of one (`crumbMenuWithChoice`).

## Action zones

Which action goes in which zone is decided in [DESIGN.md](../../../DESIGN.md#action-zones). The slots that carry it:

- Primary actions are visible, labeled buttons. Overflow holds copy and rare actions. Reversible removals act immediately, offer an Undo toast for about 10 seconds, and join app Undo outside text fields. Only an action that loses work asks for inline confirmation. Linked task chips open their task and reveal a separate unlink control on hover or focus; they have no overflow trigger.
- The fixed chrome row has one flexible context region, followed by one action region that never shrinks away. It is pushed to the far end and stays outside the content scroller. `StudioShell` exposes it as `headerAccessory`, `HeaderBand` as `actions`, and `DrawerFrame` as its one `action`. The focused object's primary action uses it too. A drawer whose header carries a state and verbs, like the plan drawer, adds one second row through `DrawerFrame`'s `toolbar`, and its title may then take two lines; expanded, the same content goes into the one `action` and the header is one row.
- A creation or edit flow's action row is the one the creation grammar below describes. It is never stretched across a shell or container that also holds unrelated content.
- A blocked object's way out is one next action strip in the `banner` slot of the detail layout: under the header, above the tabs, outside every scroll region, so every tab sees the same copy. Its tone sits on the left rail only (danger for a failed step, warning for a question, info for a wait), with a sentence that names the object, a muted cause, the technical detail behind a disclosure, one primary action and at most two secondary ones. It never repeats at the bottom of a transcript.
- A status row that describes the same block, like the orchestrator strip under a failed step or an open question, stays on a neutral rail, so only the next action strip carries the tone.
- The `tabs` slot of the detail layout keeps the tab strip at its own width. It never stretches across the header.
- A section-scoped action uses `SectionHeader.action`. A field control uses `FieldRow`. Neither one moves itself up into global chrome.
- A region that can start several kinds of work shows one primary, never a row of peer buttons. The less frequent starts sit behind an `OverflowMenu`. Each menu item names the kind and carries a one-line `description` and a concept colour on its icon (`iconClassName`), and `OverflowMenu` renders its `entries` through `MenuList`.
- The New session page follows the same rule, with one exception: it asks "What kind of run?" with two explained `ChoiceCards` (Workflow, Agent) side by side, then the two kinds of the picked card under them, because the kinds are the doors and they read better side by side. Only the picked kind's form, and only its primary, shows. An item that cannot work yet is left out, never shown disabled. A grid of tiles is otherwise not an action zone.
- The session overview's actions are one secondary `New` button that opens a menu of every start: Start a run, then Report and Wireframe. It is the one control of its kind on the page, so nothing sits beside it.
- An overflow menu that has to confirm one of its items in place gives the entry a `confirm` (`MenuList` swaps the list for a plain `InlineConfirm` in its own popover) and swaps to a plain `InlineConfirm`, as the orchestrator strip does for **Stop now**.
- An on or off setting is a `Switch`: the label names the setting and the knob says its state, so the label never reads "on" or "off". A page header holds no switch: the session's autorun is a menu verb, Turn on Autopilot or Turn off Autopilot, in the session `⋯`.

**Header actions.** Every page header and drawer header draws its actions through `HeaderActions` (`packages/ui/src/components/HeaderActions.tsx`), one slot in one order, left to right: secondary controls (a segmented control, a filter, the Details toggle), at most one secondary button, at most one filled primary, the overflow. An empty slot draws nothing, and an overflow with fewer than two drawn items draws nothing and, outside production, logs `OverflowMenu needs two items`, so a page with no actions shows no lone `...` and a lone action is a visible quiet control (`GuardedObjectOverflowMenu` and `BranchOverflow` count what is left after `omit`; `handBuiltMenus.test.ts` bans a literal `items={[` with one item). Every child is 28 tall (`Button` `sm`, `MenuTriggerButton size="control"`), and the last child ends on the column edge. The overflow glyph is `Ellipsis` (`CONCEPT_ICONS.more`) everywhere and the vertical dots glyph is imported nowhere (`moreVertical-banned.test.ts`). The trigger is one `size` prop: `control` is a 28 square in a page header or a drawer header, `compact` is a 24 square in a list row, and a trigger never takes padding classes to find its size. Delete and Archive are never icons at rest in a header: they are overflow items, and Delete asks in a `ConfirmPopover` anchored to the overflow trigger (focus lands on Cancel, Escape and Cancel close it and give focus back to the trigger). When a page has no second rare verb, so its overflow would hold one item, the verb stays a quiet text button instead (`ObjectActionVerb` over its registry kind, which keeps the confirm, now anchored to the word): Notifications' **Delete all** after **Mark all read**, and **Discard request** in the Auto project ask. A row or strip whose registry kind may resolve to one action wraps its `⋯` in `ObjectMenuOrVerb`, which draws the menu from two actions and the lone action as a quiet word: the diff file header and the terminal tab strip. A header button keeps its word at every width; below 560px the one secondary button folds into the overflow instead of turning into an icon with no word.

**Run headers and Close.** A run page (a preset step, the preset overview, the
orchestrated document) shows Pause run or Resume run and Stop run (which
confirms) as visible header buttons while the run lives, and Restore alone once
it is archived. The tail never repeats them: it carries a step verb ("Stop step
2", "Start step 3", "Approve plan", "Raise limit") or none ("Paused by you"). An
overlay page (Notifications, the guide) ends its header with Close,
which `StudioFrame` hands it; a sidebar door page has no Close.

**One filled primary per surface.** A page header region, a drawer, a card and an `InlineConfirm` each hold at most one `Button variant="primary"` (the `data-variant` attribute is how the ratchet counts them, `scene-primaries.test.tsx`). While a header's own confirm is open the header primary turns `secondary` (`BranchHeader` `isPrimaryYielding`, also while an action confirm of the page is armed) and the confirm's button is the one primary. `InlineConfirm` has no card of its own: a host that wants a surface (the push banner) gives it `bg-subtle`, never a tinted fill or border. A card that opens a drawer keeps a ghost Open, and the drawer takes its action in its header. A retry says what it retries, and only one Retry is filled.

**Record actions.** A record from a connected tool (issue, merge or pull request, thread, error) has four fixed places, whatever the tool:

| Place     | What goes there                                                      | Shape                                              |
| --------- | -------------------------------------------------------------------- | -------------------------------------------------- |
| Primary   | Start from HBL-412, Review pull request, or Open session once linked | one filled button, first in the action row         |
| Secondary | at most two tool verbs that move the record forward, picked by state | neutral `secondary` buttons, tone only in the icon |
| Overflow  | rare tool verbs, Refresh and Copy link                               | the `⋯` menu on the identity line                  |
| Utilities | Open in the tool, `⋯`, close                                         | icon buttons at the end of the identity line       |

A verb blocked for a moment stays visible with its reason in the tooltip; a verb the tool refuses is not shown. Merge confirms in a `ConfirmPopover` on its button, and a destructive verb confirms in its menu with a plain menu swap. Properties that can change (state, assignee) change from the control that shows them, never from a button. `RecordHeader` and the `RecordVerbs` type own the contract.

**Row verbs.** The action ladder of a row in a list of objects (the Overview's worktrees) has three rungs, left to right: the verb the state asks for as a quiet text button (Rebase, Push, Create PR, Reopen), the one verb every row can need as a quiet `IconButton` that asks in a `ConfirmPopover` (Close branch; a closed row keeps Remove from session in its menu), then the `...` with the rare verbs. The menu does not exist when it would hold fewer than two. Rows nest by one constant: a child row's leading glyph sits under the parent's name, `MOUNT_CHILD_INDENT = 22` (the 14px parent glyph and its 8px gap, `ProjectMountRows/mountGrid.ts`), every row of a band has the same 8px left edge and every trailing control ends 8px from the band's right edge. A "Show finished (n)" `CountToggle` and an empty line start on the child rail too.

A confirm has one placement: anchored. A destructive or one-shot trigger (icon button, sidebar row action, header action, rail row, a text button) opens `ConfirmPopover`, which draws the `plain` surface of `InlineConfirm` in an `AnchoredPopover` beside the trigger, so the page under it never moves. Anything restorable does not ask: it acts at once and offers Undo. Archiving a session is the one exception the owner asked for: it asks (`archiveConfirmOf`) and still offers Undo. A confirmation detached in the body, or a destructive footer dock, is not another zone. Notifications uses it: `Delete all` in the studio header opens it aligned to its end edge, with the scope's count in the title, and the title row never changes height. Push review stays in its banner.

- **Focus**: on open it lands on Cancel for `role="danger"` and on the confirm button for `primary` and `alert`. Enter activates the focused button, `Cmd+Enter` confirms from anywhere inside, Tab cycles between the buttons, Escape and a click outside cancel. After the confirm, if the trigger is gone, `returnFocusTo={{ rowSelector }}` puts focus on the next row, else the previous one, else the list; otherwise it returns to the trigger.
- **Trigger**: it takes the open state (`aria-expanded`), so a hover-revealed trigger stays visible while its popover is open (`group-has-[[aria-expanded=true]]/slot:opacity-100`, as in `ChatListRow`).
- **States**: busy keeps the popover open with the confirm busy, Cancel disabled and Escape ignored; failed keeps it open with the reason under the text in `role="alert"`; done closes it and shows no toast.

There is no card confirm: `InlineConfirm` draws one plain surface (no border, no fill, no tone line), and the one placement is the anchored `ConfirmPopover`. `InlineConfirm` stays for in-place confirms that never move the page: a plain menu swap inside a popover, the row of a palette, a banner that is itself a review step (the push review), and the floating confirm above a selection bar. `inline-confirm-placement.baseline.json` is empty and `inline-confirm-placement.test.ts` fails any confirm that asks for a card surface or a delay, and `absolute top-full` next to a confirm stays banned (`confirmpopover` scenes check that arming moves nothing). The trigger is ghost or secondary with danger text. The solid danger fill shows only on the confirm button. The title says what will happen. The description says what survives and how to undo it. Reversible actions use `role="alert"`, irreversible ones `role="danger"`.
When confirmation fails, `InlineConfirm` stays open and shows the formatted reason with `role="alert"`. The same controls become available for a retry. A confirm never disarms by itself: it waits for Cancel, Escape or a click outside.

**Selection bar.** `SelectionBar` is the one bar of every list that can pick rows (Board, session list, Review, Branches, Storage). It is a `floating` surface (level 4) of `rounded-lg` that sits at the bottom centre of the surface that owns the selection: `placement="overlay"` inside a `relative` region, `"sticky"` inside a scrolling page, `"flow"` where neither fits. Left to right it holds the X (Clear, tooltip with Esc), the count, `Select all N` while some rows are left, and the verbs as ghost buttons. A verb that undoes runs at once; a verb that does not passes a `confirm` node, which renders above the bar, takes focus on Cancel and gives it back to the verb when it closes. Escape closes the confirmation first, then clears the selection, through the escape stack. Rows carry `SelectionCheckbox`: a 16px box in a 20px target, revealed by `group/select-row` hover or focus and on every row once the list carries `group/select-list` with `data-selecting`, never a tab stop (the keys are X, Cmd+A, Esc and Delete, in the `selection` group of the shortcut registry). On a Board card the box sits out of the title row (`absolute`) in a 28px left gutter (`pl-7`), 6px from the card edge and from the title, and the tone rail starts below it (`top-9`) whenever the box shows, so the title lines up with the meta line and nothing moves when the box appears. The row element carries `data-select-id` so the lasso and the keys find it, and the scroller takes `pb-24` while something is selected, so the bar never covers the last row. A list whose bar can grow taller than that (a narrow column wraps it, a note stacks above it) passes `onHeightChange` and ends its scroll content with a spacer of that height plus 24px, so the last row always scrolls clear. A surface fed by the action registry renders `ObjectSelectionBar`, so the bar's words are the menu's words.

**Copy feedback lives on the control.** `useCopyLink().copy({ text, key })` keys the copied state, so in a list only the row whose `key` matches flips to "Copied". A successful copy never toasts; a failure shows inline while the control stays mounted, and only a menu item, which unmounts on click, reports a failure through a toast. `CopyButton` reads "Copy", "Copied", "Copy failed".

## Section rhythm

`PANE_RHYTHM.stack` separates peer sections. `Divider` separates app chrome from content, never content from content: [docs/styling.md](../../../docs/styling.md) owns the rule. The folder groups in the Projects card are content too: the parent's 12px `gap` sets one group apart from the next, one step above the flush rows inside a group, with no `Divider`. Section children do not add margins. `SectionHeader` is the standard section heading, with an optional description. The eyebrow size is the default for every surface. `size="page"` is only for a document whose body is prose the reader came for, such as the guide or a creation flow's form sections. Description copy comes only through `hint`, so its size and muted tone stay matched to the heading grade.

**One page, one section header.** The sections of a page (the Overview's Projects, Next and Unassigned notes) all open with `SectionHeader` at `headingLevel={2}`: the eyebrow, an optional count in `meta`, the section's one control in `action` and its one line of explanation in `hint`. A section never builds its own heading from a `h2` and type classes.

**The outline is independent of the grade.** `headingLevel` turns an eyebrow-grade label into an `h2` or `h3`. So a pane section keeps its place in the document outline without taking the page grade. A section that needs a heading does not need bigger type because of that.

**A group of rows that belong together under one name is a `Band`.** The band
is `bg-fill` and `rounded-lg`, with 4px of padding (`inset="rows"`) or 12px
for prose (`inset="content"`). `fill` and not `subtle`: `subtle` on the sheet
is 1.06:1 and does not read, `fill` is 1.17:1 in dark and 1.12:1 in light, and
because it is relative to its parent it steps down on its own inside a drawer.
The section keeps its eyebrow **outside** the band (`label`, with the
same `icon`, `hint`, `action` and `headingLevel` slots `SectionHeader` gives).
A group inside a section names itself on the band's first row (`groupLabel`),
in sentence case on `text-meta` medium muted, with a faint count on the right
(`groupMeta`, "3 roles"). A group of one row drops its label. Rows inside are
`BandRow`: `rounded-sm` (8 minus 4, concentric) with `bg-hover` when they act.
Bands of one block stack 8px apart (`BandStack`), sections 24px.

Use a band where something is configured in groups: defaults, the provider
page, settings, a tool's detail, skills. Never on a navigation or selection
list (sidebar, Tasks, facet rail, popover, palette: there the background means
hover and selection), never in a creation flow, never in a card or in another
band (`Band` throws when nested), never together with a border or a divider.

**A table read across columns stripes its rows.** From five rows up
(`STRIPED_MIN_ROWS`), even rows take `bg-fill` with `rounded-sm` at the ends,
under an eyebrow header with no line and no divider between rows. A `<table>`
takes `STRIPED_TABLE` (separate borders, so cells can round) and each `<tr>`
takes `STRIPED_ROW`, which paints the cells; row hover goes on the cells too
(`hover:[&>*]:bg-hover`). A list of row elements takes `STRIPED_LIST` on the
container; a list whose items wrap a row and an inline confirm takes
`STRIPED_BLOCK_LIST`, which paints only the row. Spend tables, Storage, Impact,
usage windows and Models in the picker stripe this way.

A metadata line is not a section and does not get a band.

`Eyebrow` is a label primitive for metadata, statistics and small internal groups. Every label is sentence case, the eyebrow included: no label is uppercase or tracked. A section label renders `Eyebrow` (inside a heading element when it titles a region), never a hand-made `uppercase tracking-*` span. Chips and badges use sentence case: `Chip` has no uppercase option, and a status or kind chip has a sentence-case label. Arbitrary `tracking-[…]` values are rejected (`uppercase-label-uses-eyebrow.test.ts`). `Eyebrow` does not replace `SectionHeader` when a section also needs an action or description. `FieldRow` owns a form field's label, help copy and control alignment. It does not title a section. Its `marker` slot sits right after the label (the Reset button of workspace settings, shown only while the value differs from the default) and its `menu` slot right after the control, or at the end of the label line when the row is `stacked` and the control spans the width. Inside a `Band` its rows sit on an 8px rhythm, so a marker, a menu or a wider control never makes one row look taller than its neighbour. When these roles overlap, `SectionHeader` wins for the section, and then `FieldRow` labels the controls inside it. `Divider` is a sibling between chrome and content, never decoration after every heading or field, and never a separator between two pieces of content: use `gap`, a `Band`, or a labeled rule like `Eyebrow` instead.

## Prose disclosure

`ClampedProse` is the only multi-line prose clamp. It accepts one to six lines, renders the text as preview markdown, and shows the complete text in place through Show more and Show less. Do not apply `line-clamp-*` directly to prose, and do not slice a display string. Single-line identity labels may use `truncate` when their full value is available from the focused object or an accessible disclosure.

Artifacts exempted by `DESIGN.md`, including the text of an open question, never use `ClampedProse`.

## Card action grammar and creation grammar

**One card action grammar.** Two fixed slots. Navigation sits top right and is
always visible. Lifecycle and destructive actions sit bottom right, visible at
rest. A card says its state once, with its `ToneBar`: the quick action stays
`muted-foreground` at rest and takes its tone only on hover, and a closed pull
request glyph on a Done card is quiet too. `CardAction` has no resting tint unless
a caller passes `highlighted` for a state of its own (an inspected or armed row). The
warning line paints with `warning-mark` (the same amber as `warning` in dark, a
lighter amber in light), because the text amber reads brick red as a line. Icon actions use the shared `Tooltip`, never the native `title`. No action
shows only on hover: hover may add a tooltip, a fill or a hover card, never the
only way to do something. `no-hover-only-actions.test.ts` fails on an
`opacity-0`, `invisible` or `hidden` element that a `hover:` or `group-hover:`
class reveals, outside its short list of decorative marks (an aria-hidden hint
inside a button that is itself the action) and second ways (the multi select
tick, entered by Cmd or Shift click).

**A list row leads with one action.** A row in a list (the Artifacts list, the
Scripts list) leads with its state-driven primary and the open control: no
trash column, no second text button. Secondary actions (Edit, Copy, Pin, Run)
sit after them, visible at rest, inside one element marked
`data-row-secondary` so a test can tell the primary from the rest. Destructive
and rare actions (Delete, Rename) live in the row's overflow menu, drawn as a
horizontal `Ellipsis` in a `row-actions` cell (docs/styling.md): empty at rest on a row that is not current, shown on hover, on focus inside the row and while its menu is open, always drawn on the current row, and every verb also opens from a right click and Shift+F10. A running Stop is the
exception: it stays visible. Every control of a list, row actions and group
header refresh alike, sits in a 28px slot on the same right edge.

**A header row has one control height.** Title row, trail band and page header
rows that hold several controls draw them all at 28px: `SegmentedTabs` `xs`,
`Button` `sm`, and an icon-only menu trigger as a 28px centred square
(`MenuTriggerButton size="control"`, which `OverflowMenu size="control"` and the
Branch header's Branch actions both draw). The compact trigger (21px, the
default) is for the end of a row of text, never beside a button. `Button`,
`SegmentedTabs` and the trigger carry `data-size`, so a screen's test asserts the
sizes it chose without reading a class. A primary and its overflow share one
baseline, primary first and overflow last, and a Branch header shows one primary
only.

**A control whose only content is an icon carries a tooltip, everywhere.** The
`aria-label` names it for assistive tech but gives the mouse user nothing. So
`IconButton`, `OverflowMenu`, `CopyButton` and `RefreshIconButton` wrap
themselves, and a hand-rolled icon button wraps itself in `Tooltip`. The native
`title` waits a second, shows in the OS style and not ours, and cannot be
positioned or styled. Pass `tooltip` when the control needs to say more than
its accessible name. `IconButton` refuses a `title` at the type level.

An icon-only control is an `IconButton` by construction: the
`hand-rolled-icon-buttons` ratchet counts a `<button>` whose only child is an
icon outside `packages/ui`, and its baseline only falls. Convert such a button to
`IconButton` (`tooltipSide` moves its tooltip to the side of a rail).

**One shortcut format.** A tooltip that names a key takes `shortcut="<id>"`, a
registry id, on `Tooltip`, `IconButton` or a wrapper. The
tooltip draws the label, then the keys from `shortcutGlyphs` as faint `Kbd` text
a `gap-2` after it: `Start an agent  ⌘L`, two nodes, never `Start an agent (⌘L)`
and never a key typed into the string. `tooltip-shortcuts-use-the-prop` fails on
a key written into a `tooltip`, `content` or `title` string and on a `shortcut`
literal that is not an id. A key with no registered keys prints the label alone.

**No native `title` on a DOM node.** `native-title` counts `title=` on a lowercase
element in `apps/desktop/src` and `packages/ui/src` (an `<iframe title>` is its
accessible name and is not counted), and its baseline is empty, so a new one fails the guard. A control or
a label with a different meaning goes behind `Tooltip`. Text that a `truncate`
cuts goes behind `TruncatedText`: it renders the element (`as` takes `span`, `div`,
`p`, `h3`, `code`, `li`, `dd` or `td`; a page `h1` stays an `h1` inside `Tooltip`), measures it when the pointer
enters, and shows its text (or `tooltip`) only when `scrollWidth` is wider than
`clientWidth` or `scrollHeight` is taller than `clientHeight`. A control with a
`title` prop (`Chip`, `StatusDot`, `GhostActionButton`, `SelectableRow`,
`ValueToken`, a `SegmentedTabs` option, a `SelectionBar` verb) shows it in a
`Tooltip`, never as an attribute; `SelectableRow` also takes the tooltip's
`shortcut` and `tooltipSide`, and `isPressed` for a row that toggles a pane
(the session tools). An empty tooltip shows nothing, so a
conditional reason is `content={reason}` with `reason` possibly `undefined`.
A long label wraps at 28rem and keeps a line break it is given. `Button` still
forwards a `title` as the native attribute, so a `Button` that needs a reason
stands inside a `Tooltip` instead.

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
`Tooltip` has one look, the label on `FLOATING_SURFACE`, and no `variant`. A
tooltip that has to show several facts (the top bar Limits chips) is a
`FactCard`, not a `Tooltip`.
A card that must not open while the pointer only passes over a dense list
passes `restDelayMs` (the Activity feed uses 800): the pointer has to rest, each
move restarts the wait, focus does not open it, and every other tooltip keeps
its 400ms. `isOpen` forces a tooltip open from the outside, as `i` does on an
Activity row.
A tooltip never sits on top of what its control opened. `isSuppressed` hides it
and keeps it from opening: `MenuTriggerButton` passes its open state, and
`IconButton` takes `isTooltipSuppressed` for a trigger that opens a popover
(the Explore ask button). A press on the control and Esc close an open tooltip,
and the focus a closing menu hands back to its trigger does not reopen it.
Keyboard focus (`:focus-visible`) opens the tooltip at once, and so does any
tooltip that opens less than 300ms after another one closed, so a row of icons
reads as one hover and not as four waits. A card with `restDelayMs` keeps its
rest. The overflow tooltip always says `More actions`: `OverflowMenu` and
`ObjectOverflowMenu` take no `tooltip`, and the contextual name stays in
`aria-label`. Only a choice menu that is not an overflow (`ObjectChoiceMenu`) names
itself.
That comes from the attribute itself. `icon-only-controls-carry-a-tooltip`
enforces the rule for `<button>`, `<a>` and `<Button>` controls, and sees icons
written as member expressions such as `<CONCEPT_ICONS.agents />`.

**One creation grammar.** Bare sections stacked in one column, never a bordered
box around the whole thing. Secondary controls go in `SectionHeader`'s
`action` slot. Related options sit in one container, not one card each. One
action row comes right after the last section: error on the left, exactly one
primary button on the right, cancel and alternates as ghost or secondary.

## One way to ask

Four rules keep the same intent in the same shape. `apps/desktop/src/shared/lib/interactionRules.ts`
holds the constants, the guide chapter How Goodboy listens prints them, and
`apps/desktop/src/__tests__/regressions/interaction-rules.test.ts` checks the code.

- **One verb per intent, one button variant per verb.** **Done** finishes an
  edit in place (`secondary`, `sm`). **Close** leaves a panel (`ghost`, `sm`),
  including the studio band. **Dismiss** hides a notice (`ghost`, `sm`).
  **Discard** abandons an unsaved draft (`ghost`, `sm`), the way the New
  workflow form does. **Delete** removes an object and confirms first. A verb is
  never drawn with a hand-made `<button>`.
- **Choosing a value.** Up to four options that fit the row are a
  `SegmentedTabs`. Five or more, or a list that depends on data, is a `Listbox`.
  A segmented control never carries a More segment. Reply verbosity and Theme
  are segmented, the default editor is a list.
- **Two kinds of field, one key each.** A message sends with Enter, goes to a
  new line with Shift+Enter and sends now with ⌘↵. A document takes a new line on
  Enter and saves or sends with ⌘↵. Every ⌘↵ check reads the `composer.submit`
  id through `isSubmitChord`, and every hint prints `shortcutGlyphs`.
- **A key you can see works.** The rail hints, the pills and the Keyboard shortcuts page
  read the registry. `navigation-flows/keys.test.tsx` presses every id on the
  real app and has a short exemption list that may only shrink.

## Comment composer and replies

One entry box writes every comment: a reply on a diff thread, a note, a plan
comment, a review draft edit, the resolver's reply and its hint. It is
`CommentComposer` in `apps/desktop/src/shared/components/CommentComposer`, a
document field (`PromptField`, ⌘↵ saves) with **Cancel** (ghost), an optional
**Ask agent** (`secondary`), and the one primary last. A feature keeps only its
words and its state: the label, the submit label, the value, and what to do with
`onSubmit({ body })`. The body is trimmed, and an empty one is refused unless
the caller says an empty body is allowed.

- **Esc** closes the composer through the escape stack (`useEscapeLayer`), so a
  drawer under it stays open. A composer never reads the key itself.
- **Busy** is held by the shell while `onSubmit` returns a promise, or by the
  caller through `isBusy`. **Error** is the caller's text, shown in an alert
  under the field; the draft stays.
- **Frame** is the caller's `className`: a thread reply on a diff sits in a
  full-border card, never in a side rail on a rounded box.

Replies under a comment are one `ThreadReplies` in
`apps/desktop/src/shared/components/ThreadReplies`: `mode="collapsed"` is one
line per reply (author and first line), `mode="full"` shows author, age and body
and folds to a count above two replies. A rail on the left (`border-l` with an
inner `pl-3`) marks the nesting, and the parent's gap spaces it.

## Form actions

Every form, creation and edit flow ends the way the new workflow form does
(session Overview, Workflows, Create): a page title, one big input card,
segmented choices with a one-line explanation, options as quiet pill selects,
and then the action row inline at the end of the content. Two primitives carry
it:

- **`FormPage`** is the scrolling body of a page-sized form: a `ScrollFade`
  holding a centred `PageColumn` with `gap-8` between the blocks. Put it inside the shell (`StudioShell`, `PaneShell scroll="self"`).
- **`FormActions`** is the action row. `leading` holds the quiet options or the
  status line on the left (Starts, Run on its own, Limit, routing, an error
  with `role="alert"`). A job that runs longer than a few seconds shows its
  status inside the input card, never in this row: the create form's card holds
  Scribe's running dot, seconds and `Stop` in its bottom row, and the actions
  stay inline at the end of the content with no bar. The children sit right-aligned in
  order: secondary first (Discard, Cancel, Back as `ghost` with
  `text-muted-foreground`), alternates as `secondary`, and the one primary
  last. `reason` puts the disabled primary's explanation under the buttons and
  pairs with the primary's `aria-describedby` through `reasonId`; `error` does
  the same for a failure: the cause in default text after a 14px danger glyph
  (never a red sentence), and the caller relabels the primary "Retry" while the
  draft stays. Leading holds the options (Model, Limit, Asks you, Starts);
  trailing is "Discard" (ghost) then the primary, and an empty estimate slot
  collapses so Discard always touches the primary.

Buttons are `md` on a page and `sm` inside a popover, a drawer or a card. The
row sits right after the last block: inside a popover it is the end of
`PopoverBody`, inside a dialog the end of the body, in a card the last child.

There is no footer bar. A form never pins its actions under the content with a
`Divider`, a `border-t`, a `<footer>`, `PaneShell` `dock` or
`PANE_RHYTHM.dock`. `PopoverFooter` and the `Dialog` `footer` slot are gone for
that reason. The `footer-cta-bar` rule in
`apps/desktop/src/__tests__/regressions/forbidden-patterns.test.ts` counts
those shapes per file and fails on a new one. The only pinned row left is a
chat composer (`dock={conversation.composer}`). A review surface that lives
over a long diff puts its submit in the diff toolbar instead (Write review's
Submit review, the diff lens notes), the way a code host puts Review changes at
the top.
