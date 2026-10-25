# Home, creation and the right drawer

> **Read this when** you change Home, the way a project or a session is created, or what goes in the right drawer. **Not for** spacing, scroll and overlay mechanics ([styling.md](../styling.md)) or design intent and tone ([DESIGN.md](../../DESIGN.md)). The other pages are listed in [navigation.md](../navigation.md).

## Home

Home is the one page of a window with no workspace open: workspaces exist and
none is open here, or there is no workspace at all. `App.tsx` renders it
whenever `currentWorkspace` is null, in every window. It has no app chrome, so
it carries the lockup itself: the 40px `BrandTile`, the word and the version
([brand.md](../brand.md)). Under it:

- **Workspaces.** One row per workspace, most recent first (`WorkspaceRow`):
  the identity tile, the name, the folder count (`folderCountLabel`, "3
  folders") and the folders' common parent (`workspaceFolderPath`, the home
  folder as `~`); a workspace of one plain folder says its face instead of
  "1 folder" ("Documents", "Code, no git yet": `workspaceFaceLabel`, which
  falls back to `folderCountLabel`), Open in a new window, Disconnect behind an
  inline confirm, and
  when it was last opened. A click opens it here, or in a new window while
  agents run here. The search field shows from five workspaces on.
- **New workspace** (⌘N on Home, `home.newWorkspace`) fires
  `goodboy:add-workspace` through `openNewWorkspace`, like the switcher, the
  palette, the Goodboy menu and the menu bar. On Home the `addWorkspace` place
  swaps the list for `NewWorkspaceForm` in place, the lockup stays put, Cancel
  or Escape goes back, and Create opens the new workspace and lands in it,
  whatever the folders are: a plain Code folder was already offered git on its
  pick row.
- **No workspace yet.** A card that says how a workspace starts, with New
  workspace and, while setup is unfinished in the main window, "Setup paused at
  Workspace · 1 of 4 done" and **Resume setup** (`useSetupResume`, counted by
  `setupProgress`).
- **Reopen the last workspace on launch**, a switch.

Setup mounts over Home and opens in the main window only. The app layers keep
one key across Home and the shell, so the setup wizard is not remounted when
the first workspace opens under it.

## Starting a project from nothing

Every door that creates or adds folders opens one inline form,
`NewWorkspaceForm` (`shared/components/NewWorkspaceForm/`), never a dialog. It
runs in three modes: `first-run` (the setup Workspace step, title "Your first
workspace"), `new` (the New workspace studio and Home) and
`add` (the empty board and Settings, Workspace, folders, which add folders to
the workspace they name by id). The form owns its action row.

- **Pick or drop a folder.** Choose folder (Cmd+O) or a drop on the drop area
  only reads: `validate_git_repo`, `scan_child_repos` and the move preview fill
  a draft in memory (`useWorkspaceDraft`). Each read carries a pick number and a
  late answer for an older pick is dropped. The pick number is taken before the
  folder dialog opens (`isPicking` keeps Choose folder busy), so a folder that
  answers after a newer pick, Start from scratch, Back or closing the form is
  dropped too. A repository shows Git and its
  default branch; a subfolder of one snaps to its root and says so; a folder of
  repositories lists them checked; a plain folder offers git init on Create; a
  folder that cannot be read says why (macOS privacy opens Privacy settings
  through `open_privacy_settings`) and keeps Create off with the reason.
- **Name.** The workspace takes the picked folder's name through
  `nameFromFolder` and is edited in place; Escape while editing restores it.
- **A folder another workspace holds** asks Move it here or Leave it out; Create
  stays off until one is chosen, and Move is off while agents run there. The
  move happens on Create, never on the click.
- **Start from scratch** (the old Start a new project) asks a folder name and a
  location (the last parent folder, else the home folder, changed with the
  system picker). Create makes the folder, a repository on `main` with a first
  commit that holds `.gitignore` and nothing else, and the workspace named
  after it. Outside setup it then opens the first lap session; in setup it goes
  on to the next step.
- **Create** calls `createWorkspaceWithFolders` once, with a workspace id the
  draft made before the write; Retry reuses it. Nothing is written before
  Create. The New workspace studio never reopens setup.

The first lap session shows one notice under the goal of its Overview,
`Not published yet`, with **Publish**. Publish
opens an inline panel: create a repository on your own GitHub account
(visibility is always an explicit pick) or use any HTTPS or SSH address. When
the project folder has changed files the primary action reads **Publish and
move my work**. When `main` appears on the remote, whoever pushed it, the
banner turns into the move card. A move in progress shows its own banner, and
a finished one leaves a report on the bootstrap session until it is dismissed.
The project git pill offers **Publish** on a repository with no remote.

## Creating a session

The new session form always lands on Overview. It offers no agent-kind picker
before the session exists: the kind is a choice made inside a session, not a
condition for having one. Its issue sources come from a curated allowlist, not
from every connected provider, because a connected code host does not mean an
issue picker. The section hides when none of the allowed sources is connected.
Creating a session picks no project either. The session is born on the
workspace with only a container directory, and projects are materialized when
the work reaches them ([concepts.md](../concepts.md) → Lazy sessions).

Every start of work from a task says **Start from** and the identifier
(`startFromLabel`): **Start from HBL-412** in Tasks and in the draft,
**Start from #318** in the one-step panel, **Start work from chat** in Chat.
**Review pull request** is the one exception, because the review is the work.
The retired phrases are in `retiredNames.ts`.

## The right drawer

Every drawer is one primitive, `DrawerColumn` from `@goodboy/ui`, never a
split nested inside a pane. `AppShell` puts one beside the page container, and
a studio body puts one beside its list.

**Two containers, never a panel inside the content.** The page container is the
sheet (its `bg-background`, its 1px `frame-edge` border, `data-container="page"`)
and the drawer container is its sibling (`data-container="drawer"`), each with
its own size, drawn from the same top to the same bottom. With no drawer the
page container is today's sheet: rounded on the left where the chrome wraps it,
flush with the window's right edge. While a drawer pushes, the page container
rounds all four corners (`rounded-frame`), the drawer container stands 8px to
its right (the resize handle sits in that gap) and 8px from the window's right
edge, with the same edge and radius, and the pair keeps an 8px inset above the
window's bottom edge. The drawer container is one step quieter than the page
(`bg-drawer`, recessed between chrome and background in both themes): it reads
as secondary, never louder, never tinted, and never a border to fake the
difference. `AppShell` hosts it through `DrawerColumn`'s `frame="sheet"`. The
Tasks and Chat studios do the same inside the studio slot: their body registers
its drawer with the `StudioFrame` (`useStudioDrawer`), the frame draws one
`DrawerColumn` with `frame="sheet"` around the band and the body, so the band and
the list are the page container and the drawer container stands beside them from
the slot's top to its bottom; the slot's own sheet steps aside
(`data-studio-sheet-owner`). A studio body with no hosting frame (a studio that
covers the left column) keeps `frame="none"`, which draws only the drawer
container as a card inset 8px on its right, top and bottom.

**Two tiers, one width each.** A side drawer (Ask, Context, a fix run or agent
transcript, script output, a plan part, an artifact) opens at 400px, resizes
from 384 to 560px and keeps `goodboy:right-drawer-width:v1`. A reader drawer
(the plan, report and wireframe document, an Explore file, a file diff) opens at
720px, resizes from 480 to `min(1000, room)` while it pushes and to
`min(1000, page - 16)` over the page, and keeps its own
`goodboy:reader-drawer-width:v1`. Both are clamped on read and written once when a
drag ends; a double click on the handle resets to the tier default (400 or 720);
the two saved widths never bleed. There is no third tier: no drawer expands over
the whole column, the reader tier is the large one. `selectDrawerSizing` picks
the tier from the drawer kind. The pure rule lives in `drawerLayoutOf` (`drawerGeometry.ts`).

**One push rule.** `room = main - 16 - 48 - 560`: the pane (the `DrawerColumn`'s
own width) minus the drawer's two 8px insets, the page's gutters and the 560px
the page keeps. The drawer pushes only while the page container keeps 560 plus
its 48px of gutters and `room` covers the drawer's saved width; it is never
squeezed. Otherwise it lies over the page at `min(saved, main - 16)`. The mode reads the committed width, never a drag in progress,
and while it pushes the handle stops at `min(tier max, room)`, so a drag never
flips the mode. Once a drawer pushes at some width it pushes at every wider one.
The column and measure pages are centred, and the column slides left to
re-centre in the space left of the drawer (full tier work surfaces keep their
left edge and give up their right).

**The thresholds are fixed.** The default side drawer (400) pushes from a 1024
column and the default reader (720) from a 1344 column; below that they lie over
the page. `drawerGeometry.test.ts` pins both numbers and
`regressions/drawer-rule.test.ts` fails a drawer that measures the window, reads
a breakpoint or calls `drawerLayoutOf` outside `DrawerColumn`, so every
width-dependent drawer (fix run, CI fix, terminal, the rest of `DrawerHost`)
goes through `DrawerColumn`. A drawer that must never push, such as the New
drawer, passes `placement="overlay"` (`drawerPlacement` on `AppShell`): it lies
over the page at its saved width at every column width. `selectDrawerPlacement`
(`store/slices/drawer/`) returns `overlay` for the New drawer and `auto` for every
other kind; the New drawer uses the `reader` tier, so it keeps the reader's saved width. Crossing the threshold
with a drawer open swaps the mode in place and keeps focus in the drawer; if
focus was on the page it moves into the drawer, never to the body.

**Over the page, the drawer container runs the full height of the sheet.** It
has no inset: flush with the sheet's top, bottom and right edges, left corners
rounded (`rounded-l-frame`), a left border only, `shadow-xl`, the same
`bg-drawer`; the page container goes back to its resting sheet shape under it. A scrim
(`bg-scrim`, 120ms fade, none under reduced motion) covers the page below the
card, and the page is `inert`, so nothing under it takes a click, a Tab or a
screen reader. A click on the scrim asks the top layer of the escape stack
(`dismissTopEscapeLayer` in `packages/ui/src/escape.ts`), so an editor or an
unsent draft inside the drawer answers first, exactly as it does to Esc.
Pushing has no scrim and nothing is inert. Closed, the
aside is 0px wide and `inert`. Opening and closing ease the track's width in
220ms (`DURATION_BASE_MS`, none under reduced motion) with its right edge fixed, and the
centred column slides with it: the card grows leftward from the window edge,
its content held at its final width on that edge so nothing reflows, and the
content fades in once there is room; over the page it slides in 200ms; a new kind in
an open drawer fades its content in 120ms. It never writes the sidebar
preference: a pane folds nothing but the session rail, and only a reader tier
pane does that (`shellFoldsOf`, see Surfaces).

**Closing never moves the page behind a drawer.** `DrawerColumn` remembers the
last mode the drawer was open in (`useDrawerExit`). Closed from pushing, the
aside stays in the flow, its width eases to 0 in 220ms and the card keeps a
frozen copy of its content that fades in 120ms (`drawer-content-out`); with
nothing laid out or under reduced motion it closes at once. Closed from
over the page, the aside stays out of the flow with no width transition, so the
page keeps its width at every frame, and the card and scrim stay mounted for
`DRAWER_EXIT_MS` (160ms) while they fade and slide 8px right (`drawer-overlay-out`;
only the fade, `drawer-fade-out`, under reduced motion). The exit card is a
frozen copy of the DOM the drawer had, so its escape layers, focus and handlers
are gone the moment it closes (a drawer that holds a `canvas`, `iframe`, `video`, `audio` or `webview`, or more than `DRAWER_EXIT_MAX_ELEMENTS` (2000) elements, is not copied and closes at once with no exit; the copy is taken during the render that closes the drawer, before React commits it, because a host that reads the same store, such as `DrawerHost`, empties itself in that same commit): the aside, the card and the scrim are `inert` or
`pointer-events-none`, the page is not `inert`, and a click on the page behind
works at once. Reopening during the exit cancels it and shows the drawer as it
stands, without playing the entry again.

**A drawer's up is its back row, never a trail.** A drawer is page state, not
an address, so it draws no breadcrumb. A drawer opened from another drawer shows
one quiet back row under its header (`DrawerBackLink` from `@goodboy/ui`, the row
`DrawerFrame`'s `back` draws), naming where it returns: **Back to agents**,
**Back to files**, **Back to scripts**. The run step drawer has no `DrawerFrame`
and draws the same `DrawerBackLink` above its transcript; **Back to agents**
reopens the Agents drawer on the run it came from.

One drawer at a time, per window. The `drawer` store slice holds
`{ kind, sessionId, payload }`: `openDrawer`, `closeDrawer` and `toggleDrawer`
(pressing the trigger again closes it). **The open drawer is part of the
history entry's focus.** A forward move (crumb, sidebar, palette, a child such
as an agent) arrives with it closed; Back and Forward bring it back as it was;
Escape and its X close it in place. The one exception is the `ask` drawer: a
forward move that stays in its session keeps it open (`keepAskDrawer` in
`navigate`), so a chip in an answer changes the page beside it; leaving the
session closes it, and Back brings it back like any drawer. Another drawer
opened from the page replaces it. `app/components/DrawerHost` turns a `kind` into its content, framed
by `DrawerFrame` from `@goodboy/ui`: a header whose 28px row is centred on the band (icon, title, count, at most
one labelled action, close), one divider, a `ScrollFade` body and an optional
`dock`. A body that scrolls itself, such as a chat, passes `scroll="self"` and
fills the frame instead. A new kind adds a variant to `DrawerContent` and a
case to the host.

**Header grammar.** The close control always reads `Close`, in every drawer: the
region is already named by its title (`<section aria-label={title}>`), so no
drawer repeats its own name in the label. The one exception is the Context
drawer in its versions view, whose control reads `Back to current` and goes
back to the current view instead of closing. The Close button is a 28px target
(`size-7`) with the 14px glyph, and so is every utility in the header (copy,
open on its page); a header holds at most one labelled button (Stop,
Run again, Open in Files, New) and utilities share one icon tone. The count slot
is for a count or a version, never for the session title: Ask's header reads
`Ask`.

**One dock, one padding.** The `dock` slot is `px-4 py-3` and holds the one
control that belongs under the body: the Ask composer, the reply field of an
agent transcript, the script run's status line. No drawer pads its own
composer; `TranscriptReplyDock` only measures it for the toast lift.

**Focus and Esc.** A drawer's first control takes focus when it opens, pushing
or over the page: the composer when the dock holds a text field (Ask and a
transcript that can be written to), the drawer panel itself (`DrawerFrame`
section, `tabIndex` -1, no ring) otherwise, never the `Close` button, whose
tooltip and ring would cover the top bar and the first action, and whatever
the body focused itself first (an editor, the composer's own focus) is left
alone. Closing hands focus back to the control that opened it; when a shortcut
opened the drawer from the page body (`⌘L`, `F`), the target is the last real
control that had focus (`lastFocusedElement` in `packages/ui`, updated on
`focusin`, never the body). Esc answers in two steps: while a text field in the
drawer is focused and not empty, the first Esc only blurs it, the draft stays;
the second Esc (or the first, with an empty field or no field focused) closes.
A click on the scrim asks the same top layer of the escape stack
(`dismissTopEscapeLayer`) and keeps focus where it was while pressed, so it
follows the same two steps. There is one Esc listener, the stack; a drawer
never adds a second one.

**The Ask draft survives.** `askDrafts` in the `ask` slice holds the text of the
composer per thread (`threadId`, or `${sessionId}:new` for a thread that does
not exist yet), in memory only: closing the drawer with Esc, the scrim or `⌘L`
and opening it again finds the draft, a send that lands clears it, and a send
that fails puts it back.

**A toast never covers a drawer.** The stack is 360px wide with its dismiss
button pinned to the card's top right corner (a 28px target that does not move
with the width of the action) and the action on its own row. Beside a pushing
drawer the stack's right edge is the drawer card's left edge minus the 12px
gutter (`toastRightOf({ mode, drawerWidth })`, measured from
`[data-drawer-card]` while a toast is on screen); over an overlay drawer it
stays at the right edge and above the scrim. It still lifts above the Ask
composer and the transcript reply field (`useToastLift`).

**Floating surfaces are one surface.** Menus, popovers, the hover card, the
session switcher, the update card and the delete confirm are all
`FLOATING_SURFACE` from `@goodboy/ui` (rounded-lg, border, `bg-floating`,
`shadow-lg`), with no per-site border, fill or shadow. Their widths come from
one scale: menus 240 (never under 200), popovers 320 and 384, toast 360, hover
card 320, session switcher 420. `regressions/popover-widths.test.ts` counts the
off-scale widths a floating surface declares per file and never lets one
grow.

**The update card is never clipped.** It is a `Popover` in the popover layer, anchored above the Goodboy row with 12px to the window edge, 300px wide and never wider than `min(384px, window - 24px)`: a title, one line and the verbs of its state ([release.md](../release.md#auto-update)), no bullets. It stays away while its row is inert, as when Settings covers the column (`useIsAnchorInert`), and comes back with the row. A `fixed` card inside the sidebar would resolve against the sidebar, which has a transform and `overflow-hidden`.

**An object that belongs to where you are opens in a drawer; the page changes
only by an explicit command.** A plan read from the planner that wrote it (the
row in its chat, in its Brief, or a plan row in Activity) stays on the agent
page: the address does not change, the page keeps its scroll, and the drawer
sits beside it. The same goes for every artifact kind read from its work: a
report or a wireframe row in Activity, and a report or wireframe chip in a
transcript, open the same `artifact-document` drawer (`DrawerHost` hands a
report or a wireframe to `ArtifactReadingDrawer`, which shows the report or
the wireframe stage, with Open in Artifacts as its one header action). **A plan always opens
in the drawer** (`openPlanDrawer`): the object menu's **Open**, the plan view
inside Ask, a plan row in the palette, a plan hit in search and the plan chip in
a chat open it over the page you are on, unless you are already on the
Artifacts page, where they select the plan. From another session they land on
that session with the drawer open (`openPlanAnywhere`). Reports and wireframes
are transit from the palette and from search and keep navigating; the Artifacts
page stays the library. Going to
the Artifacts page from a drawer is a command of its own, **Open in Artifacts**
in the drawer header, and it is the only page change. The `artifact-document` kind
carries `{ artifactId, revision }`; `revision` is `null` for the current
version and a number for an earlier one read from the revisions. It is the one
drawer in the reader tier: it opens at 720px and you drag its edge from 480
to 1000 (a double click resets it to 720), so there is no Expand. The body
stays on the 720 reading measure whatever the width. The header holds the
title, **Open in Artifacts** and **Copy markdown** as two 28px icon buttons,
and Close; the second row holds the state chip, `vN`, the parts, **Edit** and
**Run plan**. **Copy markdown** is absent when the plan has no copy action.
Escape closes it. While the planner
revises the plan the body is dimmed and Run plan waits.

The `ask` kind carries no payload: the thread on screen lives in the `ask`
slice (`askThreadId` per session, `null` for a fresh thread). `AskDrawer`
(`features/session/ask/components/AskDrawer/`) puts the thread in the frame's
`ScrollFade` and the composer in its `dock`. Its header is **Ask** and a **Reset chat**
icon button (⌘N while focus is inside the panel, also in ⌘K), with no session
title. Reset starts a clean thread (`newAskThread`, `askThreadId` back to `null`,
the next question makes a new chat id) and the old thread stays under **Earlier**,
so nothing is lost and no Undo is needed. It waits while a reply streams. The body starts with
**Right now** (no model call: `askRightNow` over `askDigestOf`, the five
comment words, running agents, open questions and the session cost) and three
suggested questions; each line's mark is one text line tall, so
it centres on the first line of text even when the line wraps; once a thread has
turns it folds to one row. Then
**Earlier** threads on a fresh thread, then the turns. An answer chip that
targets a page navigates (the drawer stays, see above), except a question: it
opens the Questions page and the question in the drawer under **Back to Ask**
(`question` drawer, `from: 'ask'`); a chip that targets a
plan or another artifact opens it inside the drawer under **Back to answer**,
and Escape goes back before it closes. Buttons come only from verbs the action
registry offers right now (`askVerb`, `useAskActions`): **Answer question N**
prefills and focuses the answer field, **Review N ready** runs
`session.review`, **Tell {agent}…** prefills the agent's box and runs
`agent.message`. A verb with a confirm shows an `InlineConfirm` first. Nothing
runs in one click.

The `transcript` kind carries `{ agentId }` and shows one agent's conversation
beside the page, at the saved drawer width with its resize handle (sizing
`default`, like Ask, so it never resizes after it opens), without selecting
that agent: the page
under it keeps its address and its trail (`loadAgentTranscript` with
`isSelecting: false`). It reads, top to bottom, a lead (the fix run summary
for a resolver), the transcript, and a field to write to that agent, which
sends with `sendTurn` to that agent and keeps its draft in `agentDraft`. A
resolver's transcript always opens here, on the Comments tab of its Branch
(see The resolver stays on its comment).

The `context` kind carries `{ tab, view }`: `tab` is `goal`, `decisions` or
`summary`, in that order, and `view` is `current` or `versions` (the old
versions of that slot, inside the same drawer, with Restore; Escape and the
header's **Back to current** leave the view before the drawer). The **Context** chip in the session header toggles it
on any page of the session, and so does ⌘⌥C; ⌘⌥G, ⌘⌥E and ⌘⌥U open it on Goal,
Decisions and Summary. The first open shows Summary, later ones the last tab
used in that session. The chip carries a quiet dot, never a count, when the
decisions ledger changed since the drawer was last seen
(`sessions.context_seen_at`, compared with the ledger rows in
`decisionChangesSince`: added, removed and reworded rows, leaving out what you
did yourself and what came and went unseen), and opens on Decisions then. The
drawer marks it seen when it opens, on any tab, and again when it closes. A
session never looked at starts its baseline the first time it loads, so the
rows it already had never read as new. The chip shows
a pulsing dot while the summarizer writes and a danger glyph when it failed,
with Retry in the drawer's **Context updates** row. The old addresses `s/{session}/context`
and `context/goal`, `context/decisions`, `context/summary` resolve in
`canonicalLocation` to the overview with this drawer open on the matching tab.
The drawer header has one action, **Copy context**, which copies Goal,
Decisions, Summary and Open questions in that order (`shareableContext`).

The drawer sits on the `subtle` panel surface, like every `DrawerFrame`.
**Context updates** (`ContextUpdates`, a `Collapsible`) sits above the tabs:
closed, it says `Updated 2 min ago`, `Queued`, `Updating…` or `Couldn't update`;
open, it lists the last round (`summarizerRounds`: when, how many turns or a
full pass, model and effort, tokens and cost, what changed as a comma list of
links to the tabs, every value on the same column), **Change model** (Settings, Providers and models, Models, scrolled to
Step summaries) and **Update now**. Update now queues a consolidation pass
through `requestContextUpdate`, behind any pass in flight and never beside it;
`summarizerPending` holds the turns waiting and whether a requested update is
queued, and the row reads only that queue state, as the pane's first gray line
(no label). The pane is one scroll with Goal, Decisions, Summary and Learned as
sections (`ContextSection`, no tabs); opening it on a section scrolls there. The
count lives on the Active group and the change signal on its own group. The engine has one name, **Context**, in Activity, in the
drawer and in these docs.

Every section reads as labelled blocks (`ContextBlock`: a flat group with an
eyebrow title, an icon and a count). A block shows its key line first and
folds the rest behind **Show N more** (`KeyLineList`); `summaryItems` splits a
body into items, one per top-level bullet with its sub-bullets, or one per
sentence for prose. Summary shows State, Next, Open questions (the session's
open questions, read only) and Learned, then any section the summarizer did not
name. Goal is one block with Edit and Versions in its header. Decisions shows
the changes block, then Active, then the folded Replaced and removed group,
split into Removed by you and Replaced with a search across both.

The Decisions tab reads the decisions ledger ([turns.md](../turns.md#the-decisions-ledger)).
When something changed since the previous look (`sessionDecisionsBaseline`,
the `context_seen_at` captured when the drawer opened), it starts with
**Changed since you last looked**: one line per row, `+` added, `−` removed
(`Replaced by 7` or `Withdrawn`), a pencil for reworded, and a click scrolls to
the row and highlights it. The label never wraps: when label, count and action do not fit
the drawer width, **Mark as read** drops to its own right-aligned line (`ContextBlock`). **Mark as read** in its header fades the block, moves
the marker to the moment of the click (`markContextRead`, saved before the state changes) and clears the
tab dot; a later change brings the block back. Then **Active**, with its count: active decisions
newest first, each with its number, at most two lines of
text, its why as one muted line under the text when the row has one (clamped
to two lines, **Show more** when longer; older rows show nothing), and who
settled it (`Implementer · turn 9 · 1h`, `You · 2h`,
`replaces 5`). An added row also carries `New` until the next open. A row the summarizer reworded says `Reworded by Goodboy` with
**Show previous**. Clicking a row opens it (**Show more** on the text when it
was clamped, same toggle), revealing Edit (a reword of yours) and Remove.
Remove withdraws at once, with no confirm, so agents see it retired, but the
row stays where it was, struck through, with a per-row Undo, and the block
opens with `N changes on this visit · Undo all` while any are pending.
Leaving the drawer, by closing it or switching session, drops them into the
bottom group, **Replaced and removed**, split by a `Removed by you` /
`Replaced` filter with a search over both; only the rows you removed offer
Restore. Every closed row is struck through, points at the decision that
replaced it (`→ 7` scrolls there and highlights it), and quotes the reason.
The dock adds a decision of yours on Enter. While the summarizer writes, rows
stay readable and every edit waits. A row that arrives while the drawer is open
comes in with `Reveal` (200ms), and a reworded text fades in (180ms,
`animate-text-swap`); both are `motion-safe`, so reduced motion swaps at once.

In Activity, a `decisions_changed` row that carries `decisionChanges` is a
disclosure: the row toggles (`Show changes` / `Hide changes`, `aria-expanded`)
a diff under it, `+ D12`, `D3 → D12` with the reason, `− D5` with the
withdrawal reason, at most six lines, and **Open in Context**. Each decision is
a three-column grid (sign, id, text): the text wraps whole beside the hanging
id, and the reason or note sits on its own line under it, never truncated.
**Open in Context** opens the
drawer on Decisions with those numbers in `payload.highlight` (highlighted for
2.4s, the closed group opened when one of them is there). The expanded row
adds the diff's height to its item before `layoutTimelineRail`, so the rail and
lanes run through it. `DecisionChangesDetail` measures itself (a layout effect
and a `ResizeObserver`) and reports `{ rowId, height }` to `useTimelineRows`,
which keeps it per row id and uses it over `decisionChangeDetail`'s line
estimate, which stays as the first-frame value. `Reveal`'s grid element is
`min-w-0`, so no body, of any list, widens its column.

The `artifact` kind carries `{ artifactId, tab }`, with `tab` either `details`
or `chat`. The artifact shell opens it from its one `Details` button, on the
tab last used; the drawer header switches between the two. It also closes when the focused
artifact changes. While it is open, Escape closes the drawer before it takes the
artifact back to the list.

A studio covers the whole window grid, so it cannot use that column. A Tasks
record opens in the studio's `DrawerColumn` beside the list on the reader tier
(`InboxStudioLayout` passes `sizing: 'reader'` through `useStudioDrawer`), with
the same card and motion; a window too narrow for the list and the pane lifts
the pane over the list. Open full in the pane header puts the record at the 720
measure in place of the list (`TaskFullPage`), which claims the studio band with the trail
Tasks › its key (`StudioTrail`); the Tasks crumb returns to the list.
Escape closes the record before the studio.

`conversation` (payload `{ threadId }`) is the open comment on the Comments tab, side tier.
It rides the drawer slot of the location next to the address
`s/{session}/branch/comments/t/{thread}` (`placeWithThread` keeps both, `openReviewComment`
writes both), so Back, a refresh of the list and a window reload find the same comment open.
`DrawerHost` renders only a slot for it (`ReviewCommentDrawerHost`); `ReviewFlow` portals the
`DrawerFrame` into that slot, so the drawer shares the page's diff, filters, verb controller and
keys. Its title is the file and line, its meta the author, age and state word, `N of M` its
position in the shown list; a later answer for a comment it already left is dropped because the
content is keyed by thread.

`scriptRun` (payload `{ scriptKey, mountId }`) shows one script run's output.
`ScriptRunDrawer` reads the run from `scriptRuns`, where the one
output subscription per run lives, so closing the drawer loses nothing. The
header action is Stop while it runs and Run again after (when it cannot run, a
tooltip says why, never a native title); the body is a status
line (state, time, project, branch), a `Command` disclosure closed by default,
and the log, which follows the tail until you scroll up and then offers
`Jump to latest`. Error lines carry a danger bar and an `err` prefix, and a long token (a path, a
hash) wraps at the edge instead of breaking every word. The dock
says `Following output` while it runs and the exit, time and Copy output after.
`Ask the agent about this` sits next to it, while the run is live too, and
hands the log to the session's agent: it queues a text attachment titled
`Output of <script>, <exit>, <project> on <branch>` (`outputHandoffOf`), opens
the session when it is not on screen, and the composer takes it as a chip,
focuses itself and sends nothing, so a running agent is never interrupted. The
same verb is in the right click menu of a Task or Service row (disabled with
`No output yet` until the run printed something), in the terminal's `⋯` menu as
`Send last output`, and as a floating button on a terminal selection. The text
is redacted with `redactSecrets` first and capped to its last 24,000 characters
with a `[truncated: ...]` line on top. An archived session, or one with no
agent, hides the verb. The queue is the `outputHandoffs` store key, per agent;
the composer drops a handoff that lands after it moved to another agent and
keeps it queued for the right one.
A run records the mount it ran in, so a project mounted twice reopens on the
right branch.

`file-diff` (payload `{ source, path }`) peeks at a diff without leaving the
page. The source is a worktree (a file opened from the chat) or a commit (a
GitHub commit link clicked anywhere in a session; outside a session the link
opens in the browser). It shows unified and wrapped, and a worktree peek offers
`Open in Files`, which opens the Files tab of the Branch page on that mount with the file in focus.
There is no drawer for notes: a note lives on its line in Files and as a row in
Comments, and `Fix comments` (kind `fix-comments`) is the one fix action. A note
without a branch sits in `Unassigned notes` on the Session overview.
