# Design: screen anatomy and surface ownership

The layer between [styling.md](./styling.md) (gap, padding, radius, dividers,
scroll fades, dialogs) and [navigation.md](./navigation.md) (routing, breadcrumb
derivation, studio taxonomy). This file answers a different question: what a
screen is made of, and which surface is allowed to own what.
[DESIGN.md](../DESIGN.md) holds the editorial line (voice, register, color
philosophy). Nothing here repeats those three.

Every rule below names the file that enforces it. Where the code does not
enforce the rule, it is listed under [Known drift](#known-drift) instead of
being written as if it did.

## 1. The three surfaces

An app window is a strip, a set of columns, and a pane. Each owns one thing.

### The strip

`apps/desktop/src/app/components/AppTopBar/index.tsx`. One row, `h-9` (36px),
`data-tauri-drag-region`, closed by a `<Divider />`. It renders in `AppShell`'s
`topBar` slot, which sits in a `shrink-0` wrapper **outside** the grid
(`packages/ui/src/components/AppShell.tsx`), so no column resize, no
`leftHidden` animation, and no overlay can ever move it.

Composition, left to right: mascot, collapse toggle (session only), workspace
identity, crumbs, update pip, workspace rollup, vertical divider, then the
global control cluster (running scripts, notifications, onboarding, settings).

The strip is context, never content. Everything in it is a chip, an indicator,
a crumb, or a trigger that opens something elsewhere. No editor, no form, no
list is rendered inline in the strip. `WorkspaceRollupStrip` opens the budget
studio, `WorkspaceIdentityRow` opens a popover, `SessionStripCrumbs` changes
the active lens. None of them mutates a record in place.

Exactly one child carries `flex-1`, the crumb region:

```tsx
<div className="flex min-w-0 flex-1 items-center overflow-hidden pl-1">
  {hasActiveSession ? <SessionStripCrumbs /> : null}
</div>
```

Every other child is `shrink-0`. That single decision fixes the truncation
order for the whole strip (see [section 7](#7-density-and-the-reading-column)).

### The columns

`packages/ui/src/components/AppShell.tsx` builds one CSS grid with the areas
`left | lhandle | main | rhandle | right` (plus a full-width `footer` row of
`2.25rem` when a footer is passed; the footer's contents are navigation.md's
subject). Column widths are pixel values persisted in `localStorage` and
clamped on read (`LEFT_SIDEBAR_MIN` 260, `MAX` 640, `DEFAULT` 340).

Two rules live in `buildLayout`:

- `leftHidden` sets the left column and its handle to `0px` and suppresses the
  `ResizeHandle` entirely. The aside additionally fades and slides
  (`-translate-x-2 opacity-0`) and takes `inert`, so a hidden column is not
  focusable. The grid animates only `grid-template-columns`, 200ms, motion-safe.
- Collapse and hide are different states. `rightSidebarCollapsed` narrows the
  right column to a 44px rail; `leftHidden` removes it. The left column has no
  rail state.

Two overlay slots sit inside the grid rather than above it. `leftOverlay`
spans `1 / -1` at `z-20` and is `pointer-events-none` at the root (its children
opt back in), which is what lets the sidebar peek float over main without
taking layout. `overlay` spans `main-start / right-end` at `z-30`, so a
full-surface editor covers main and right but never the sessions column.

Inside `main`, a session draws its own two columns
(`features/session/components/SessionWorkspace/index.tsx`): the lens rail at a
persisted `lensColumnWidth` (default 240, min 200, max 400), a `ResizeHandle`,
then the pane.

The lens rail is navigation. `LensColumn`
(`SessionWorkspace/parts/LensColumn/index.tsx`) renders a `nav` whose rows only
call `onSelect` or `onSelectOverview`. Row content is data, not decisions:
`buildLensGroups` (`LensColumn/groups.ts`) returns the four groups (Context,
Work, Infra, Integrations) with label, icon, tone, count, dot, and the rail just
paints them. Counts and status dots are read-only signals attached to a
destination. Session lifecycle is not in the rail: it sits below a `<Divider>`
in `LensColumnFooter` (see drift 4).

### The pane

The work. The only surface that scrolls its own body, mounts editors, and takes
a title. Its anatomy is [section 3](#3-pane-anatomy).

## 2. One home per thing

**The rule.** If a thing must exist in state A and can exist in state B, it
lives where it must, and B does not get a second copy.

**The worked example: `leftHidden`.** `useSessionSidebarVisibility`
(`features/workspace/hooks/useSessionSidebarVisibility/index.ts`) derives it as
`!hasActiveSession || isCollapsed`. The first term is not a preference: on the
board there is no session, so there is no sessions column at all, ever.
Therefore anything that must be reachable from the board cannot live in the
sidebar. Workspace identity must be reachable from the board, so it lives in
the strip, and `WorkspacesSidebar` renders no workspace name at all, only the
Board button and `SessionActivityBar`.

Current mounts, one each:

| Thing                           | Sole mount                                                     |
| ------------------------------- | -------------------------------------------------------------- |
| Workspace identity and switcher | `features/workspace/components/WorkspaceIdentityRow/index.tsx` |
| Session title (read)            | `features/session/components/SessionStripCrumbs/index.tsx`     |
| Session title (rename)          | `SessionOverviewPane/HeaderBand.tsx`                           |
| Collapse the sessions column    | the toggle in `AppTopBar/index.tsx`, plus ⌘B                   |

`WorkspaceIdentityRow` is the trigger and the anchor at once: it holds the
`triggerRef`, and `WorkspaceSwitcher` mounts as its child when open. The command
palette does not build a second one, it dispatches
`goodboy:open-workspace-switcher` and this row listens.

The title split is the rule applied twice. `SessionStripCrumbs` shows
`session.goal` as the breadcrumb root and it is read-only there: the click
target resets the lens to overview (`setActiveLens(session.id, null)`), it does
not edit. Rename lives in the overview's `HeaderBand`, and
`useSessionTitleRename` has exactly one caller in the app.

`useSessionCrumbs` (`features/session/hooks/useSessionCrumbs/index.ts`) is the
strip's half of the same breadcrumb builder the in-content trail uses
(`buildSessionBreadcrumb`). The strip renders `crumbs.slice(1)` behind the
title, so the `Overview` root is the title itself rather than a second word.

The collapse control is one button. The keyboard path
(`useShortcut('column.toggle', sessionSidebar.toggle)` in `App.tsx`) calls the
same hook method, not a parallel implementation.

### One registry, three modifier planes, no hand-typed combos

`shared/keyboard/registry.ts` owns every binding. Bare ⌘ is the app plane, ⌘⇧
the session plane, ⌘⌥ the lens plane, and a combo string is never written by
hand outside that file: controls read `shortcutGlyphs(id)`. Bindings are also
meant to be seen, so a control that has one shows it, as a pill revealed on
hover in dense rows and as a parenthesised suffix in tooltips and titles.
A hint that would truncate the label beside it moves to the tooltip instead.

### Peek is a display of the sidebar, not a second sidebar

When the column is collapsed, `SidebarPeekOverlay`
(`features/workspace/components/SidebarPeekOverlay/index.tsx`) renders the same
`<WorkspacesSidebar>` in the `leftOverlay` slot with `onNavigate={closePeek}`.
There is one sessions list in the codebase.

Width is the pinned column's persisted width times `PEEK_WIDTH_FACTOR` (1.5),
clamped to `LEFT_SIDEBAR_MAX`. A panel that is only on screen while the pointer
rests on it has to be read in one glance, so it is given more room than the
column the user chose to live with. The factor is applied at read time in the
overlay, so widening the peek never moves the pinned column.

The timing lives in the hook, not the overlay: open after 150ms from the screen
edge, 100ms from the strip's toggle (a deliberate anchor is faster than a
graze), close after 300ms.

The hold counter is why portaled menus do not kill the peek. A menu that
portals to `document.body` leaves the panel's DOM subtree, so the pointer
leaving the panel fires `onPanelLeave` while the user is still using the menu.
`SidebarPeekHoldContext` (`SidebarPeekOverlay/hold.ts`) hands `hold` and
`release` down; `SessionActivityBar` and its `SessionViewMenu` call them around
their popovers. `scheduleClose` records `wantsClose` but returns early while
`holdCount > 0`, and `releasePeek` runs the deferred close only when the last
holder lets go. Escape is gated by the same counter, so the first Escape closes
the menu and not the panel underneath it.

The peeked panel does not draw a border. It copies `ResizeHandle`'s hairline:

```tsx
<span className="pointer-events-none absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-border-soft to-transparent" />
```

which is the same gradient `ResizeHandle` paints
(`packages/ui/src/components/ResizeHandle.tsx`). The docked column terminates in
that hairline, so the floating one must terminate in it too. A solid
`border-r` reads as a different kind of edge and gives away that the panel is a
different component.

## 3. Pane anatomy

`features/session/components/SessionWorkspace/parts/PaneShell.tsx` is the
frame. Root:

```tsx
<ScrollFade className="h-full" viewportClassName="px-6 py-5" fadeSize={24}>
  <div className="mx-auto flex w-full flex-col gap-5 max-w-5xl">
```

- **title**, required, `h1`, `text-xl font-semibold leading-snug`.
- **description**, optional, `text-sm text-muted-foreground`, one line of what
  the lens is for.
- **meta**, optional, sits on the title's baseline, `text-xs tabular-nums
text-muted-foreground`. Counts and totals, never a control.
- **actions**, optional, right side of the header row, `justify-end gap-1.5`.
  The header row is `flex-wrap items-start justify-between gap-3`, so actions
  wrap under the title instead of squeezing it.
- **body**, `gap-5` below the header. The pane owns that gap, children do not
  add top margins ([styling.md](./styling.md)).

The column caps at `max-w-5xl` and centres. `wide` swaps that for `max-w-none`
and is the escape hatch for a workbench, not for a long document. It has one
caller today, `FileVersionsPane/index.tsx`, and even there it is conditional:

```tsx
wide={loading || groups.length > 0}
```

The workbench goes full width; its empty state stays in the reading column, so
an empty pane never presents a 2000px-wide dashed box. A pane that is nothing
but a workbench skips `PaneShell` altogether: `FilesPane.tsx` returns
`DiffViewerPane` directly and only wraps `PaneShell` around its two failure
states.

## 4. Empty states

One layout for a lens with nothing to show: `LensEmptyState`
(`apps/desktop/src/shared/components/LensEmptyState/index.tsx`). It is a thin
wrapper that fixes two of `EmptyState`'s knobs and makes `description`
mandatory:

```tsx
<EmptyState bordered size="inline" icon={icon} tone={tone} ... />
```

The resulting row (`packages/ui/src/components/EmptyState.tsx`): dashed border
`rounded-lg border border-dashed border-border-soft bg-elevated/40`, a 14px
concept icon in its concept tone at `mt-0.5 shrink-0`, title `text-xs
font-medium`, description `text-xs leading-relaxed text-muted-foreground`, and
the optional action pinned right at `shrink-0 self-center`.

`EmptyState`'s size scale is `inline | sm | lg | xl`. Only `inline` is a row;
the other three are centred columns with a 48px tinted disc and grow the type
up to `text-2xl`. Lenses use `inline`, always.

Why inline beat the centred hero: the pane already has a title, a description
and a `gap-5` rhythm. A centred hero restates the title in bigger type, breaks
that rhythm, and pretends the lens is a landing page when it is one of a rail full of
destinations. A one-line bordered row says the same thing without
claiming the screen. `headingLevel` is left unset, so an empty lens adds
nothing to the document outline.

Call sites, all identical in shape:
`QuestionsPane.tsx`, `WorkflowsPane.tsx`, `FilesPane.tsx`, `PrPane.tsx`,
`SlotPane.tsx`, `IntegrationPane/index.tsx`, `FileVersionsPane/index.tsx`,
`features/terminal/components/TerminalDock/index.tsx`,
`features/explore/components/ExplorePane/index.tsx`,
`features/scripts/components/ScriptsPanel/index.tsx`,
`features/plans/components/PlanStudio/index.tsx`.

**The gap trap.** A wrapper that renders an empty element still consumes the
parent's `gap`. Since separation is owned by the parent flex container
([styling.md](./styling.md)), a child that renders `<div />` or an empty
fragment inside a bordered shell still costs a full gap step and leaves a hole
nobody can attribute to a component. A component with nothing to show must
return `null`:

```tsx
if (count === 0) return null;
```

`features/context/components/ContextPanel/strips/PendingResolutionsStrip.tsx`
and `SessionOverviewPane/PipelineSection.tsx` both do this, and both are direct
children of the `flex flex-col gap-2` body in `ActivitySection.tsx`. Same rule
in the rail: `buildLensGroups` filters out groups whose `rows` are empty rather
than rendering a group heading over nothing.

**What "empty" counts.** A lens is empty when it has no ACTIVE item, not when it
has nothing on screen. Revealing the completed or discarded group does not fill
the lens: those rows are a reread, not work in flight. So a single flag decides
both halves of the layout:

```
hasActive
  false -> the empty state stays in the body, its CTA inside it,
           and any revealed group renders underneath it
  true  -> the empty state goes, the CTA moves to the section header
```

`WorkflowsPane`, `StandaloneAgentsLane` and `ResolverAgentsLane` all read
`hasActive` this way, and `AgentLane` renders the empty state and the children
together rather than one or the other. The copy has to match the flag: an empty
state above a visible list says "No active agents", never "No agents yet".

**The gap between groups.** Rows inside a group sit at `gap-1` or `gap-2`; the
groups themselves are separated by `gap-5`, the same step `PaneShell` puts
between its body children. That is what makes active, completed and discarded
read as three answers instead of one long list.

## 5. Icon and tone vocabulary

`apps/desktop/src/shared/components/conceptIcons.ts` holds two maps over the
same key set: `CONCEPT_ICONS` (concept to `LucideIcon` or brand glyph) and
`CONCEPT_TONE` (concept to `Tone`). The second is typed `satisfies
Record<Concept, Tone>`, where `Concept = keyof typeof CONCEPT_ICONS`, so a
concept cannot gain an icon without gaining a tone or vice versa. Around 107
files import from it.

Rules:

- One icon per concept. Do not import a lucide symbol locally for a concept
  that already has an entry. Add the concept to the map instead.
- One tone per concept, and pass it alongside the icon. Call sites read
  `icon={CONCEPT_ICONS.questions} tone={CONCEPT_TONE.questions}` as a pair;
  `LensColumn/groups.ts` does this for every rail row.
- Tone is meaning, not decoration. `questions` is `warning` because a question
  blocks someone, `decisions` and `plans` are `success` because they are
  settled, `sentry` is `danger` because it is errors, `terminal` and `settings`
  are `neutral` because they are plumbing. Recolouring a concept changes what
  it claims.

The vocabulary itself is `packages/ui/src/tint.ts`: nine tones (`success`,
`info`, `warning`, `danger`, `primary`, `accent`, `merged`, `operations`,
`neutral`), each resolving through the single accessor `tintClasses(tone)` to a
fixed set of class strings (`bg`, `bgSoft`, `ring`, `border`, `borderSoft`,
`hover*`, `text`, `icon`, `dot`, `solid`). Components take a `Tone` and call
`tintClasses`; they never hand-write `bg-warning/10`.

## 6. Overlays

Three patterns, in order of preference. The mechanics and the dialog
justification live in [styling.md](./styling.md); this is the anchoring recipe
and the decision.

**Anchored popover, by default.** Anything owned by a visible control opens off
that control. Reference implementations: `AppTopBar/NeedsYouPopover.tsx` and
`features/workspace/components/WorkspaceSwitcher/index.tsx`. The recipe both
follow:

1. `createPortal(..., document.body)`, so no ancestor's `overflow-hidden` can
   clip it. Every column in `AppShell` sets `overflow-hidden`.
2. Measure in `useLayoutEffect` off the trigger's `getBoundingClientRect()`,
   store `{ top | bottom, left }` in state, and render at `position: fixed`.
   Render nothing while `coordinates == null`, so the panel never paints at
   `0,0` before its first measurement.
3. Recompute on `resize` and on `scroll` with capture `true` (a scroll in any
   ancestor moves the trigger).
4. Clamp `left` into the viewport with an 8px margin.
5. Flip above when the space below is short:
   `spaceBelow < PANEL_MAX_HEIGHT + VIEWPORT_MARGIN` sets `bottom:
window.innerHeight - rect.top + 6` and drops `top`.
6. A click-catcher behind, closing on `mousedown`, and a panel above it. The
   four app-global popovers (`NeedsYouPopover`, `WorkspaceSwitcher`,
   `NotificationCenter`, `RunningScriptsIndicator`) use `z-popover-backdrop`
   and `z-popover` from the named scale in `docs/styling.md`, so they clear a
   full-page studio at `z-50`. A popover scoped to one pane keeps a local
   `z-30`/`z-40` instead.
7. Escape closes.

`Popover` from `@goodboy/ui` supplies only the shell (`rounded-md border
border-border bg-elevated text-xs shadow-lg`). Positioning is always the
caller's, which is why the recipe above is a recipe and not a prop.

**`InlineConfirm` for destructive actions.**
`packages/ui/src/components/InlineConfirm.tsx`. The row or button being acted on
swaps itself for the confirm, so the thing under threat stays on screen.
`role` (`primary | alert | danger`) picks the tone through `ROLE_TONE`, the
component owns its own busy state across the awaited `onConfirm`, and
`autoDisarmMs` disarms an armed confirm the user walked away from. Call sites
include `DeleteSessionConfirm`, `ArchiveSessionConfirm`,
`BulkDeleteSessionsConfirm`, `ResolverActions`, `WorkspaceLauncher`,
`WorkflowDeleteButton`, `ScriptRow`.

**`Dialog` for the three cases an anchor cannot serve**: a full-screen viewer,
a flow that owns the whole screen, and a blocking system prompt. See
[styling.md](./styling.md) for the list and the reasoning.

## 7. Density and the reading column

The scale is six custom properties in `apps/desktop/src/styles.css`:
`--text-2xs: 11px`, `--text-xs: 12px`, `--text-sm: 14px`, `--text-base: 15px`,
`--text-lg: 17px`, `--text-xl: 20px`. Four named density grades
(`--density-{compact,cozy,comfortable,scan}`) bind a size to a gap and a
padding so siblings agree; see [DESIGN.md](../DESIGN.md) for which surface runs
at which grade.

What each level is for, as actually used:

| Level         | Where                                                           |
| ------------- | --------------------------------------------------------------- |
| `text-xl`     | the one `h1` per surface: `PaneShell` title, `HeaderBand` goal  |
| `text-sm`     | pane description, definition of done, `NextUpCard` title        |
| `text-xs`     | body text, list rows, chips, the entire strip, popover contents |
| `text-2xs`    | meta and signals: timestamps, `InlineConfirm`, rollup numbers   |
| `text-[13px]` | rail rows only, half a step above body to read as navigation    |
| `text-[10px]` | rail group headings, uppercase, `tracking-[0.12em]`             |

`PaneShell`'s `meta` slot is `text-xs`, not `text-2xs`: it sits on the `text-xl`
title's baseline, where 11px would look broken.

**Why the pane caps at `max-w-5xl`.** That is 64rem, 1024px, which is also the
window's minimum width (`minWidth: 1024` in `apps/desktop/src-tauri/tauri.conf.json`
and in `features/workspace/window.ts` for spawned windows). So the cap is never
the binding constraint at minimum size: the sessions column, the lens rail and
the pane insets are. The cap exists for wide monitors, where an uncapped
`text-sm` paragraph would run past a comfortable measure. Content that is not
prose opts out with `wide` (section 3).

**What truncates first.** In the strip, the crumb region is the only `flex-1`
child, so it absorbs every shortfall before any control moves. Inside it the
order is fixed by explicit caps: the session title is `min-w-16 max-w-80 shrink
truncate`, each trailing crumb is `max-w-48 truncate`, and workspace identity is
`max-w-56` with its own `truncate`. Indicators, the rollup, and the control
cluster are `shrink-0` and never move. In the rail, the label is `min-w-0
flex-1 truncate` and the count badge is `shrink-0`, so a long lens label loses
characters before a count disappears.

**What lines up in a repeated row.** A list of peers is read down a column, not
across a line, so anything whose width follows its content breaks the column for
every row under it. Two rules follow.

A label chip in a repeated row carries a fixed width. `Chip` takes `width="sm" |
"md" | "lg"` (`min-w-16`, `min-w-24`, `min-w-32`, each with `justify-center`);
`auto` stays content-sized and belongs to one-off chips in a detail panel, never
to a column. `WorkflowOriginTag` is `lg`, because ORCHESTRATED is the longest
label it can carry; the provider routing status and the budget turn kind are
`md`. A fixed-width wrapper around the chip does not count: it aligns what comes
after the chip and leaves the chip itself ragged.

In a right-aligned cluster, variable text comes first and glyphs last. The
things nearest the edge have to be the constant-width ones or they wander row to
row. So a workflow step row reads model name, then provider glyph, then status
icon, which is what `RoutingBadge`'s `glyphPlacement="trailing"` is for. In a
left-aligned cluster the opposite holds and the glyph leads, which is the
default. The test is where the group is anchored, not what looks tidy in one
row.

## 8. The session overview as the reference page

`features/session/components/SessionOverviewPane/`. Every rule above, on one
screen. Read it before designing a new one.

**The frame.** A `ScrollFade` at `h-full` with the insets on
`viewportClassName`, a centred `max-w-5xl` column, `gap-6` between sections,
`<Divider />` as a sibling between them and never a border on a section.

**The stage line.** `HeaderBand.tsx` opens with a `StatusDot` in
`STAGE_TONE[stage.stage]`, the stage word, and the machine-derived reason
muted beside it. Colour is never alone: dot, word, and sentence carry the same
fact. `pulsing` is set only for `running`, so motion means one thing.

**The title.** `h1` at `text-xl font-semibold`, `text-balance`, falling back to
"Untitled session". The rename affordance is a pencil that is invisible until
`group-hover/goal` or `focus-visible`, and drops to `opacity-60` under
`motion-reduce` so it is never unreachable. Editing swaps the `h1` for an
`Input` styled at the same `text-xl font-semibold`, so the line does not jump.
Below it: the definition of done as a `text-sm` paragraph, the PR status line,
then a wrap row of `text-2xs` chips (branch, summarizer, age).

**Next up.** One section, one job. `Eyebrow label="Next up" muted` for the
section, then either a single `NextUpCard` or an empty state. The card is the
page's only primary button: `selectNextUp.ts` chooses exactly one item, and
`NextUpCard` tints its border and background with that item's tone
(`tint.borderSoft`, `tint.bgSoft`), so urgency is expressed by the surface
instead of by a badge parked next to it. Signals ride as neutral chips so they
cannot compete with the tone.

**Linked work.** Eyebrow on the left, one secondary action on the right (a
`Link` overflow menu). Rows are one shared `LinkedWorkRow` / `ExternalTaskChip`
per item, with per-row actions in `ExternalRefActions`. No linked work renders
an inline empty state rather than hiding the section: a section that vanishes
teaches nothing.

**Activity.** Same header shape: eyebrow left, actions right, and the actions
only appear once the session is not fresh, because a fresh session gets a richer
`ActivityEmptyState` with the two ways to start (workflow, single agent) as full
rows. The body is `flex flex-col gap-2` and every child returns `null` when it
has nothing (`PipelineSection`, `PendingResolutionsStrip`), which is the gap
trap from section 4 in its natural habitat. Everything else collapses into one
`SummaryRow` per category (`N to resolve`, `N completed workflows`, `N completed
agents`) rather than listing finished work.

**The rhythm to copy.** Section eyebrow, at most one action in the header, at
most one primary button per section, an inline empty state instead of a
disappearing section, `gap-6` between sections, `gap-2` inside one.

## Known drift

Verified against the code, not speculation.

1. **The reference page does not use the pane primitive.**
   `SessionOverviewPane/index.tsx` builds its own `ScrollFade` at
   `viewportClassName="px-8 py-7"` with `gap-6`, and its `h1` lives in
   `HeaderBand`. Every other lens uses `PaneShell` at `px-6 py-5` with `gap-5`.
   The overview is deliberately roomier, but the divergence is unmanaged: a
   change to `PaneShell` does not reach the page most people look at.

2. **Two empty-state shapes.** Lenses use `LensEmptyState`, which is dashed
   border on `bg-elevated/40`. The overview calls `EmptyState size="inline"`
   directly with `className="rounded-lg bg-muted/20 px-3.5 py-2.5"` in
   `index.tsx`, `LinkedWorkSection.tsx` and `ActivityEmptyState.tsx`: filled,
   borderless, different insets. Both read fine; there is no rule that says
   which surface gets which, and no wrapper for the filled one.

3. **The concept maps are convention, not enforcement, and the overview is
   where they leak.** `NextUpCard.tsx` imports `Bot`, `CircleHelp` and
   `MessageSquareReply` straight from lucide even though
   `CONCEPT_ICONS.agents`, `.questions` and `.resolve` are those exact symbols,
   so the same concepts now have two import paths. `LinkedWorkSection.tsx`'s
   link menu uses `ListTodo` for Linear, `Bug` for Sentry and `GitFork` for
   GitLab, where `CONCEPT_ICONS` has the real brand glyphs. Nothing lints this.

4. **Two confirm primitives, and the rail footer is not purely navigation.**
   `InlineConfirm` is the documented one, but icon-dense rows use
   `shared/components/ConfirmPill` instead (label plus check plus cross, no
   description). `LensColumnFooter.tsx` uses it for archive and delete, which
   also means the lens column hosts session lifecycle actions, editor launch,
   git actions and the project switcher below its `<Divider>`. The `nav` above
   the divider is navigation only; the column as a whole is not.

5. **One stale claim in `docs/navigation.md`.** It says the Scripts lens runs at
   `width="5xl"`; `PaneShell` has no `width` prop (only `wide`), and the Scripts
   lens in `SessionWorkspace/index.tsx` uses the default column.
