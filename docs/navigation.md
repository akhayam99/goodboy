# Navigation and information architecture

> **Read this when** deciding what surface exists and where it lives: pane,
> sidebar, strip, footer, breadcrumb. **Not for** spacing/scroll/overlay
> mechanics (`docs/styling.md`) or design intent and tone (`DESIGN.md`).

## The model

- **The board is home. Chat is a destination.** Open a workspace with no
  session selected and main shows a board of every session, grouped by stage
  (needs you / running / in review / building / done). You reach chat, diff,
  terminal and open-in-IDE from the cards. You never land on them. Every
  capability stays one step away.
- **The board frame.** The header has the pane title grade (`Board` plus a
  session count), with its actions on the right. Header and columns sit in one
  centred frame with a maximum width, so a wide or zoomed-out window never
  stretches the board. Every column has one fixed width, and the board scrolls
  sideways when they do not fit. Empty columns show their header and a short
  hint. Done and Archived fold into a dock at the end of the board: one icon
  per column with its count, widening to name them on hover or focus. A click
  opens the column just before the dock, and its header button folds it back.
  The dock stays pinned to the right edge while the board scrolls, and the
  folded state is remembered per workspace, both folded by default. Folding
  Archived clears its selection; folding Done keeps it. Cards have one fixed height: a goal of up
  to two lines (the full goal in the tooltip) is the card's one button, and the
  lifecycle menu shows next to the quick actions on hover or focus. Restoring
  an archived card uses the `restore` glyph.
- **An archived session is read-only until Restore.** Its overview shows an
  Archived chip with an inline Restore. The composer, new agents, workflows and
  project mounts stay disabled with "Restore this session to continue". Nothing
  restores on its own, so a shelved session never spends by itself.
- **Four surfaces, four jobs, no competition.** The top bar is chrome ("where am I
  and what is it costing"). The footer is access ("where do I go"). The sidebar is
  presence ("what else is going on"). The ⌘K palette is transit ("where do I
  want to be").
- **The top bar carries state and identity, never destinations.** It never
  edits a record in place. Anything that opens a destination belongs in the
  footer. The spend chip is the one exception: it is state that opens the
  studio that owns that number, the impact overview.
- **One home per thing.** Say a thing must exist in state A and can exist in
  state B. It lives where it must, and B gets no second copy. Workspace identity
  is always pinned at the left of the top bar. Neither the sidebar nor a studio
  header shows the workspace name again. A studio subtitle is a one-line
  purpose or the installed version, never the workspace.
- **Pin the structure, flex the density.** A control keeps a fixed position so
  people can learn it. No control appears or disappears when a count crosses a
  threshold. The counts themselves may: a chip that reads zero is noise, not
  structure. There are two exceptions. Integration groups sit in a row, so
  connecting one shifts the controls to its right. Their order is fixed, not
  their exact position. The update control comes and goes with a pending update,
  because an update is an event, not a count.
- **Hidden is not gone.** Anything the user can put away must come back without
  a hunt. A hidden sessions column peeks back when the pointer rests at the
  window edge. Peek floats the one sidebar over the page instead of laying it
  out.
- **Navigation chrome is neutral at rest.** Selection shows as a muted fill,
  never an inversion. The app has no inverted navigation control. New session
  is the only emphasised sidebar control. Navigation rows, Board included, are
  neutral at rest, and so is the footer's Goodboy chip.
- **Settings match the scope they edit.** Application settings is a full-page
  studio. Workspace settings is a scoped pane. Changes save instantly: no
  Save/Cancel footer, and no settings surface stacked on another.
- **One studio slot.** Workspace and app studios share the shell's single
  studio slot, one at a time. Opening one replaces the other, never stacks.
  Scope decides the pattern. Session-scoped editors layer over the session
  pane. Studios take the slot. Anything that became a lens stays a lens.

A second entry point reuses the existing mount and never builds a parallel one.
The palette dispatches an event that the owning component listens for. The
keyboard path calls the same hook method as the button.

The palette renders one ordered list: the current session's agents, sessions,
workspaces, a **Go to** group, scripts, actions and help. Workspaces are rows
of its own that open the chosen workspace. Go to reaches studios by name: Back
to board inside a session, then Inbox, Workflows, Impact, Changelog,
Notifications and Workspace settings inside a workspace, and Add workspace
everywhere. It never lists archive or delete, which are lifecycle, not
navigation. The first row is highlighted on open, and the highlighted row is
the one Enter runs.

In the composer, `$` lists every script of the session's mounted projects
(`useSessionScripts`): saved scripts first, then `package.json` and
`composer.json` scripts by category, each tagged with its source. Manifests are
read from each mount the first time `$` is typed. With more than one mount a
row names its project. An empty list says why: no project in the session, no
script in the project, or no match for the filter. Enter runs the row and opens
its output in the right drawer; the composer text is cleared.

## Surfaces

**Shell layout.** One strip of chrome sits above, one footer below, and between
them one sidebar plus main. **There is one app layout and every surface fills its
slots.** The board, the session and the studios do not define their own frames.
A surface that needs a different frame changes the shared one instead of forking
a second. **Two navigation columns at once is not the IA. The right drawer is
context, never navigation.** A session draws one full-width pane, and its
navigation lives in that single left sidebar. The right drawer holds reference
material beside the page and closes with the pane that opened it. The
sidebar carries presence. It appears when something else is going on. Inside a
session it follows a saved preference, toggled from one control in the top bar
or ⌘B. Peek
never touches that preference.

A window is a strip, a set of columns, and a pane. Each owns one thing.

**The strip** is one row closed by a `<Divider />`. It renders **outside** the
grid, so no column resize, hide animation or overlay can move it.

**The columns** are one grid at saved widths, clamped when read.

- **A column has one reduced state, and it is never a narrower copy of
  itself.** Hiding a column sets it and its handle to zero width and marks the
  aside `inert`. A zero-width column that still takes focus is a keyboard
  trap. Narrowing to a rail is allowed only where the content still works at
  rail width. Where peek already answers "let me glance at it", a rail would be
  a second copy of the same list, so it is not added. The shell primitive can
  lay out more reduced states than the product uses. Which one a column gets is
  decided here, not by what the primitive offers.
- **The overlay slots sit inside the grid, not above it.** The peek spans the
  work row, so it can hover over main without taking layout space. The studio
  slot spans the same row, sidebar included, and sits above the peek. A studio
  covers the columns between the bars, never the bars, and reaches the bottom
  edge when the footer is hidden.

**The pane** is the work. It is the only surface that scrolls its own body,
mounts editors and takes a title.

**The projects section shows which projects a session has materialized.** It
lives in the session overview and always has the Add project action, even
before the first mount. Mounted projects show as dense rows. The empty section
is its header with a one-line hint: turns run in the session folder until you
add a project. Sessions are created lazily
on the workspace ([concepts.md](concepts.md) → Lazy sessions), and this section
is where a session's footprint grows. The session header has no second mount
control.

**Inside a session the sidebar stays the sessions list.** There is no second
mode. The sidebar lists the workspace's sessions grouped by stage, and the open
session tells its own story in the main pane. Lens surfaces still exist. You
reach them from rows and chips inside the overview (they expand in place or
open a side panel) and from the trail's destination switcher, never from the
sidebar. Board → session is the full depth of navigation.

**A sidebar row and a board card read the same summary.** Both take
`useSessionSummary`, so they say the same things in the same words. The row has
two lines. The first is the goal, with the age on the right; on hover the age
gives its column to the cost, and the column keeps its width. The second is the
workflow progress when a run is active (one segment per step, then
`Implement · 3 of 5`, counted from the steps that started, never estimated),
otherwise the stage reason. At most two marks follow it, in this order: what
waits on you (open questions, then review drafts), the first linked task with a
`+n` for the rest, the agent count. The row starts with a 20px node: the pull
request glyph in its state colour when there is a request, otherwise the stage
icon, a ring while an agent runs, and `?` or `!` when the session needs you.
Running and needs-you rows carry the same left rail as their card
(`sessionRail`). Nothing the row knows hides in a tooltip.

**Peek is a way of showing the sidebar, not a second sidebar.** The overlay
renders the same sidebar component, and the codebase has one sessions list.
Peek is wider than the pinned column. The extra width applies at read time, so
widening the peek never moves the column. It opens after a short rest at the
screen edge, so a graze does not open it.

**The session overview is the reference page.** It shows the whole surface
grammar on one screen, so read it before designing a new surface. Here is its
rhythm. Each section has an eyebrow label. A section header holds at most one
action, and a section has at most one primary button. A `<Divider />` sits
between sections, and a section never has a border. A section appears once its
fact exists (a plan, a workflow run, a PR on a project). Before that it is one
quiet action row (link an issue, start an agent, attach a workflow). So the
empty session reads as a young version of the same document, not a wall of
placeholders. Finished work collapses into one summary row per category. The
surface itself shows urgency, never a badge parked beside it.

**An empty session asks one question.** Until the session has any activity,
the overview body is the kickoff: "How do you want to start?" with three
options in a single-select list.

- **Pick up a task** shows the open issues of the connected trackers with a
  search field. Picking one and pressing **Pick up** links it and proposes the
  brief, as the issue brief flow in [concepts.md](concepts.md) describes.
  Without a tracker it shows the connect links.
- **Run a workflow** asks for the goal and a workflow, then **Run workflow**
  starts it with that goal.
- **Not sure yet** takes an optional focus, then **Start Scout** starts a Scout
  that reads the project and suggests where to start.

Only the selected option's primary shows. **Draw a wireframe**, and **Write a
report** once an agent has finished, sit in a quiet **More ways to start**
menu. The list preselects Pick up a task when a tracker has open issues and
Run a workflow otherwise, and it remembers the last choice per workspace in
local UI storage. A new session puts focus on the question, not on the title.
The empty header keeps the title, faint while it is still the placeholder, and
one `⋯` menu with Archive and Delete. An archived session shows no kickoff.

## Breadcrumbs

- **The trail belongs to the page, not to the chrome.** It sits in the content
  column, directly above the title, never in the top bar and never as a
  full-width strip. The top bar is workspace chrome, and a session trail is
  page context. `SessionWorkspace` hands the trail down through
  `PageCrumbContext`, and `PaneShell` draws it inside the same `PageColumn` as
  the title and body, outside the mount animation, so it holds still while the
  view under it changes. Whatever draws the trail clears the context for its
  children, so a nested shell never draws a second one. Outside a session the
  context is empty and the row does not exist.
- **Under 720px of pane width the middle collapses.** Crumbs between the
  destination switcher and the last crumb fold into a `…` menu that lists them,
  the way VS Code and GitHub fold long paths.
- **The trail starts at `Overview`, and the session name is not a crumb.** The
  sidebar already shows the session identity. Repeating it in the trail spends
  a crumb on something the user is already looking at.
- The last crumb is the current location and is never clickable. A list view
  never fills in a crumb for an item the user has not opened yet.
- **An integration trail hangs off its own tool.** It uses the name the sidebar
  uses (GitHub, GitLab, Jira, Linear, Slack), at the same depth as any other
  lens. A studio belongs under its own tool, never under another tool's lens.
- **Opening a child extends the trail and keeps every ancestor**:
  `Overview > {HomeLens} > {Agent}`. Selecting a sibling changes only the last
  crumb and the child region.
- **The trail shows the structure of the app, not the history of the
  session.** A parent comes from the object that is open, never from the
  surface the jump came from. Selecting an agent leaves the active lens where it
  was, so that lens only ever records where the user came from. The activity
  feed, the palette, a notification, a linked-work chip and a restored session
  are shortcuts into a place that already has a parent. None of them may
  rewrite it. History is what Back is for.
- **A child hangs off the overview section that owns it**: a step under its
  run under Workflows, an ad-hoc agent under Agents, a fix attempt under Review.
  The overlay's back target still prefers the surface the user was standing
  in. So Back returns where you were, while the trail says where you are.
- **A crumb with siblings is a switcher.** It is plain text when the agent is
  alone in its home lens. Otherwise it is a popover that switches the open
  agent in place.
- **The depth-one crumb is the session's destination switcher.** It is the
  lens crumb when the trail has one, or the `Overview` crumb when that crumb is
  alone. It lists the session's own destinations, grouped by what they are
  for. A count in that menu follows the rule below: it is the number the
  destination itself lists, read from the same selector the destination reads.
  Deeper crumbs never carry the switcher. No second persistent strip, tab bar
  or rail carries it either.
- **The workflow case extends the same control**:
  `Overview > Workflows > {Run} > {Step}`. A delegated child names its root and
  parent agents between the run and itself, and an open question it answers
  adds one last crumb. There is no separate step strip and no "Part of
  {Workflow}" line.

## Top bar

The top bar says what is happening now. The footer takes you to places.
Preferences live in Settings. Each item has one home; anything else that shows
it is a signal that links there.

On macOS the window has no native title bar: the traffic lights sit inside the
top bar, which carries a 78px inset (12px in full screen and on other systems).
The bar is a deep drag region: any spot that is not a control moves the window,
and a double click zooms it. Controls never drag.

The bar is one three-column grid, `minmax(0,1fr) auto minmax(max-content,1fr)`,
with each zone pinned to its own track (`col-start-1/2/3`), so an item that
drops never lets another zone slide into its column. When the right zone
outgrows its half, the command center slides off the midpoint instead of being
covered.

- Left: the sidebar toggle, then workspace identity. On views without a
  sidebar the toggle's slot stays reserved, so identity never moves. The
  sidebar keeps no header and the collapsed rail no toggle of their own.
  Identity has a 200px limit and truncates, with the full name in its tooltip.
- Centre: the command center. It opens the palette and shows ⌘K. It never
  takes typing itself.
- Right: the Now chip (needs you, running, scripts, each only when above
  zero), today's spend and the bell. Now opens one popover grouped by those
  three, and a group with no rows is not drawn. A script row moves to its
  session and opens that run's output in the right drawer. Spend opens Impact;
  it is never merged with a count. Then `Limits`: one chip per connected plan provider (Claude, Codex,
  Gemini, Cursor), in the provider order, with providers that report nothing
  last. The order never follows state. At rest a chip is its glyph and a bar of
  the provider's most used window; the number shows from 80%, `Out` with the
  reset day at 100%, a clock marks data older than 30 minutes or a window that
  reset since, and a dashed track means no data. The card tooltip always
  carries every window, its percentage and its reset. A click opens Settings >
  Providers & models on that provider, scrolled to Usage, and the chip stays
  pressed while that page is open. The strip is a toolbar: arrow keys move
  between chips. With no provider connected the strip is one `Connect a
provider` chip. A bar in the chrome is always a provider window; money is
  always a figure. The bell opens the notification popover.

The bar is an `@container/topbar` and degrades on its own width, never the
viewport, so app zoom takes the same path as a narrow window:

1. Below `chrome-wide` the command center narrows and says only `Search`, and
   Limits keeps two chips instead of four.
2. Below `chrome-labels` it becomes an icon with ⌘K, the signal words
   (`need you`, `running`, `scripts`, `today`, `Limits`) drop and Limits keeps
   one chip. Counts, dots, glyphs and the spend figure stay, and their
   tooltips carry the words.

The traffic lights, identity, the command center, the needs-you count, the
spend figure, the first Limits chip and the bell never hide. The Limits chips
past the ones that fit are the only overflow: a `+N` chip takes the tone of
the worst hidden provider and lists them. No other control moves into an
overflow menu. `chrome-labels` sits below the 1024px minimum window, so words
only drop under zoom.

- Workspace identity opens an anchored popover that switches and creates
  workspaces. ⌘O opens that same popover, never a second one, and the palette
  lists workspaces as rows of its own. Workspace settings is the popover's
  last row for the current workspace, so the bar holds no second settings
  control.
- **Identity is pinned and mounted once.** Workspace identity stays at the left
  of the top bar on the board, inside sessions, and under studios. Exactly one
  switcher is live, and ⌘O opens its single anchored popover.
- Theme is not in the bar. It lives in Settings > App > General and in the
  palette, like the guide and pair-device.
- The top bar never edits. Reporting a bug, the setup checklist, the update
  and the version are about Goodboy itself, so they live in the Goodboy chip in
  the footer.

## Footer

Left: the integrations connected to this workspace, then one **Link
integration** action. Each connected integration is a named glyph that opens
its studio. The action lists every available integration and whether it is
connected, so connected and disconnected tools are both reachable through one
flow.

- With nothing connected, the action invites the first connection.
- The glyph strip scrolls sideways inside its region. The link action stays
  fixed, so many connections never push the rest of the footer aside.
- The footer does not depend on having a repository. Turning a folder-only
  workspace into one backed by a git repository happens in the workspace link
  and convert flow, not in the footer.

Centre: the Goodboy chip. It holds everything about Goodboy itself, the way
the Apple menu or Linear's help menu does. Its label says one thing, in this
order: an update is ready, setup is unfinished (with its progress), or
"Goodboy beta". Its popover holds the version and release notes, the update,
the setup checklist, Report a bug (the draft survives closing), What's new,
keyboard shortcuts and Sponsor. Report a bug swaps the popover for the short
form, and its primary action opens the full form instead of sending. The
popover opens by itself once, when the first project is added; the checklist
has no floating card.

Right: Inbox, Workflows and Settings. Settings opens on the current workspace
when there is one. Providers & models is a Settings scope, reached from the
Settings rail and the palette, so it has no footer launcher. Impact opens from
the spend figure and the palette, Changelog from the Goodboy chip and the
palette, so neither earns a footer entry.

The footer is an `@container/footer` on the same `chrome-labels` step as the
top bar. Below it, every launcher label and the **Link integration** label
drop together and the glyphs stay, with the name in the tooltip. The first
link action keeps its label, since it is the only thing on the left. The
Goodboy chip never hides. Past that the glyph strip scrolls.

- **The release notice answers "have you read the notes for what you're
  running"**, not "has a new release been published". After an update, one
  notice names the installed version and opens its notes. It works offline. A
  fresh install shows none, and dismissing it marks that version as read.
- Exactly one integration control has the active fill. It sits on the open
  glyph, or on the link action when that integration is disconnected. Opening
  any studio closes the others.
- **Before any workspace exists, the footer keeps its app half**: Settings and
  the Goodboy chip. The integration strip, Inbox and Workflows belong to a
  workspace and wait for one. Settings then opens on App and lists only App and
  Providers & models, and Providers opens on an account instead of on the
  workspace defaults. Precedent: VS Code keeps its status bar and Manage gear
  with no folder open.

## Shortcuts

There is one registry with three modifier planes: bare ⌘ for the app, ⌘⇧ for
the session, ⌘⌥ for the lens surfaces. Nobody writes a combo string by hand
outside the registry. So no two surfaces can claim the same chord, and no
shortcut can exist without being documented. That holds for per-OS combos
too. An entry carries its own combo for other systems where the plain mapping
would collide, like the terminal's new tab: ⌘T on macOS, Ctrl+Shift+T
elsewhere, where Ctrl+T belongs to the shell. The plane is for the dispatcher.
Every entry also names the task `group` it belongs to (General, Workspaces,
Navigate, Session, Views, Window), and Settings > App > Shortcuts lists the
groups in that order, read top to bottom per column. Entries that share a
`family` (only the nine workspace digits today) render as one row, "Go to
workspace 1 to 9" with ⌘1-9, while the registry keeps one entry per chord. A
family is only for chords that do the same thing to a different index: the
integration digits (⌘⌥1 to ⌘⌥6) open different lenses and keep a row each.
A few entries are keys a focused control answers, not global chords: Submit
comment (⌘↵) and Open the workflow of an activity row (⇧↵, the only combo
without ⌘). They sit in the registry so the list and the tooltips name them.
The control that owns each one handles its own key event and never registers
it with the dispatcher; the activity row matches through `eventMatches`.
**A shortcut is taught where it
is used.** A control that has one shows it: as a pill on hover in dense rows,
and as a glyph in parentheses in tooltips. Where the row is too tight, the
tooltip is the only place it shows. Off macOS, typing wins over the lens
plane. An AltGr character, or a Ctrl+Alt combo typed into a field or the
terminal, never fires a shortcut.

## Studios

Utility studios render in the shell's studio slot, between the top bar and the
footer, so both bars stay visible and usable. The one exception is the
workspace launcher, which has no shell. There, Add workspace takes the whole
window, and so do the app studios: Settings (its corner gear, ⌘, or ⌘/ for
shortcuts), the guide and Report an issue. The palette opens there too.
Studios are not part of the breadcrumb IA. They exit on close or Esc, and only
one is open at a time.

- **Navigating closes the studio.** Moving to another workspace, session, or
  lens of the current session closes whatever studio is open, whether the move
  came from the palette, a needs-you row, a shortcut or a link inside the
  studio, so the destination always lands in front. Selecting an agent does
  not count: workflow steps select agents on their own.

- **Not every studio earns a footer entry.** Notifications opens from the bell
  popover (its footer's Open all notifications) and from the palette's Go to
  group, never from the footer, since the bell already shows the unread count.
  The popover never deletes history. That lives in the studio, behind its
  confirm. Report an issue opens from the top bar, **Settings > App > Help**
  and the palette. It sits next to settings, not beside the named launchers.
- **Notifications have one row and one scope.** `NotificationRow` draws a
  group in the popover (`compact`, one line, eight rows at most, Unread or
  All) and in the studio (`cozy`, opens in place with the body, the older
  members and Send to developers). Both lead with a fixed unread slot that holds
  a primary dot on unread rows and stays empty on read ones, so every title
  keeps one left edge; unread titles are also bold and read rows recede. In the
  studio the time owns a fixed last column and Mark read and Dismiss swap in
  over it on hover, so the row never changes width. The studio rail filters by
  view, severity and source with counts that come from SQL
  (`countNotifications`), so they stay true past the loaded page; Load older
  pages with a cursor. Both surfaces default to this workspace: a row belongs to
  its own workspace, or its session's, and a row with neither is app-wide and
  shows in every workspace. Mark all read and Delete all act on that same scope.
  In the studio, rows are grouped by day (Today, Yesterday, This week, Older),
  j and k or the arrow keys move, Enter runs the row's action and e dismisses.
  The rail rows (`shared/components/FacetRail`), the list keys
  (`shared/hooks/useListKeys`) and the day grouping (`shared/utils/groupByDay`)
  are shared primitives. The inbox uses all three: its rail filters by view,
  type and source (one pick per section, a tool that did not load says so in
  its row), its one-line rows are grouped by the same days in time order, and
  j and k move the selection while the record follows beside the list. Enter
  launches or opens the session, o opens the record in its tool, r focuses the
  reply box, / focuses the search, and Escape closes the record before the
  studio. Below a 720px list column the rail folds into a Filters button in
  the list header.
- **Settings nests items in its rail.** The App items (General, Shortcuts,
  Backup, Storage, Help, Danger zone) always sit under the App row as indented
  rows, whichever scope is active, so switching scope never moves a row above
  the pointer. The panel shows one item at a time. Providers & models nests
  Defaults and one row per provider, and Tools nests one row per tool. Those
  two lists open and close with `Reveal`, and the rail stays one mounted
  element across scopes: `SettingsStudio` portals each scope's nested list and
  detail into slots it owns, and keeps a closing scope mounted until its list
  has collapsed. Every settings panel enters with `nav-step-in`
  (`SETTINGS_PANE_ENTRY`). So no scope adds a second rail column. Every scope
  panel keeps the reading width. Precedent: the VS Code settings table of
  contents and Linear's settings sidebar.
- **Storage is the one place for disk space.** App > Storage lists every
  worktree folder Goodboy made, grouped by repository, disconnected projects
  and removed workspaces included, under three filters: To review, In use and
  Kept. It is app scope because the disk belongs to the machine. The workspace
  page only shows a Notice that points to Storage filtered on that workspace,
  and the `open-orphan-worktrees` notification action opens Storage too
  (`openStorage`). The only bulk action removes clean folders idle past "Suggest
  cleanup after"; a folder with changes, an operation in progress, a writer
  lease or no git registration never joins it and says why on its row.
  Outside Settings there is one nudge and never a modal: `evaluateStorageNudge`
  sends a `storage-reclaimable` notification (action `open-storage`) when that
  amount passes 10 GB, then stays quiet for 14 days and speaks again only after
  it grew by another 10 GB. The thresholds and the last nudge live in the
  settings table (`storage.suggestAfterDays`, `storage.lastNudgeAt`,
  `storage.lastNudgeBytes`). Sizes are measured one folder at a time after
  boot, never on the boot path. The worktree scan itself sends nothing.
  Below the worktrees, "Artifacts from deleted sessions" lists plans, reports
  and wireframes whose session is gone, under To review and Kept, with Open,
  Keep (30 days or always) and Delete behind an InlineConfirm. Its one bulk
  action deletes the unused ones. Artifacts never trigger a nudge on their own.
- **Settings rail tone is state, never decoration.** Each row carries its
  concept icon from `CONCEPT_ICONS`. A dot appears only when something needs
  doing: warning on Providers & models when a connected CLI is too old for a
  model it serves or no provider is connected (`selectProviderAttention`, with
  the reason as the row subtitle), info on General while an app update is
  ready, info on Storage with "N GB can go" as its subtitle once clean idle
  folders pass 10 GB (warning when the disk has under 10 GB free and at least
  1 GB can go, `selectStorageAttention`). Danger zone reads in `text-danger`. Panel sections sit on
  `SectionSurface` cards with gap between them and no `Divider`; a danger zone
  is an inline danger `Notice`. The workspace page is the exception: one
  column of eyebrow sections 24px apart. Its title is the workspace name,
  renamed in place. Projects are 36px rows (`ProjectLinkList density="compact"`)
  with the path in the name's tooltip, open, copy and unlink under `⋯`, and
  adding behind one `Add project` popover. New session defaults sit in a
  two-column grid with each help behind an info mark, and disconnecting is a
  ghost row at the bottom that asks with `InlineConfirm`. Onboarding keeps the
  comfortable rows.
- **Master-detail is not the dual-sidebar anti-pattern.** A narrow list rail
  beside a detail panel is fine. "no left panel and right panel at once" is
  about two sidebars on either side of the content, which the app does not do.
- **Disconnecting is scoped.** A connected integration studio can disconnect
  from its own header. That clears the workspace credential, never a
  system-level session. A workspace running on the system `gh` CLI has nothing
  workspace-scoped to clear, so it offers no disconnect and points to
  `gh auth logout`. The control depends on credential state alone, not on the
  git remote. So a leftover scoped personal API key on a non-GitHub workspace
  can still be cleared.
- **A code-host record keeps its verbs outside a session.** A GitLab merge
  request opened from the inbox approves, merges, closes and reopens through
  the workspace's GitLab host. A Bitbucket pull request shows its verbs too,
  blocked with the reason until Goodboy has resolved it for a session. Merge
  always asks first, and so does every destructive verb. The mount reads
  through the workspace's first repo project, so a workspace with no repo
  project stops at an empty state.
- **Every record header has the same four places.** `RecordHeader` puts the
  tool glyph, the identifier and the state on the identity line, with Open in
  the tool, the `⋯` menu and, in the inbox, close at its end. Under the title
  sits one action row: one primary (Launch session, or Open session once one is
  linked) and at most two tool verbs picked by state. Everything else lives in
  `⋯` in a fixed order: rare tool verbs, Refresh, Copy link, Unlink session,
  then destructive verbs after a separator. Editable properties change from the
  control that shows them (the Jira state opens its transitions). Launch
  session opens a popover with the goal and the brief; Enter from the inbox list
  opens it, or opens the linked session.
- **Every record body has one order.** Under the header, facts sit as pills in
  fixed slots (person, weight, place, labels, measure, links, time), each with
  its field name in the tooltip and time as a relative age with the date in the
  tooltip; a fact the tool does not have leaves no pill. The body is one scroll
  with no tabs: Description (ten lines, then Show more), then the tool's own
  sections closed behind a one-line summary (Checks, Changes and Approvals on
  merge and pull requests, Stack trace open and Breadcrumbs on Sentry), then
  Conversation with its count. `RecordSections` owns the order, the fact
  registries in `shared/detail-fields` own the slots. A changed file opens its
  diff in a full-screen dialog.
- **One conversation, one composer, what the tool can do.** Every record's
  Conversation is `shared/components/Conversation`: messages without cards, a
  thread's replies under a neutral rail (the last three open, the rest behind
  Show earlier replies), a code anchor chip on review threads, and a resolved
  thread folded into one row. Each tool has a pure adapter next to its client
  that turns its comments into threads and declares its capabilities: Reply
  where the tool has threads, Quote where it is flat (the post quotes the
  message, and mentions the author on GitHub), Resolve only where the tool
  resolves, reactions only on Slack. The composer sits in the drawer's dock,
  only when the tool lets Goodboy write. Reply (or `r` on a focused message)
  puts a Replying to bar above it, Escape clears it, ⌘↵ sends. A sent message
  shows Sending in place, and a refused one stays with its text, Retry, Copy
  text and Discard.

## Lens surfaces

- **A lens shows one level. A studio is a rail plus a detail.** Inside a lens,
  selecting a card swaps the list for the detail, and the trail or Back is the
  way back. No lens keeps a rail beside its detail. Conversations is the one
  exception, because its work happens in bulk: a comment opens in a drawer
  column to the right and the list stays visible and selectable. A studio pairs a rail with
  a detail and has no back link. Completed and discarded groups sit behind
  header toggles that hide themselves at zero. So a session whose runs are all
  done shows an empty state, instead of opening the last completed run.
- **A step chat is one explicit click**, never an automatic redirect.
- **A lens-wide toggle is its own row**, never inside an empty state's action
  slot.
- **Reference beside the work opens in the right drawer, not a rail.** Popover
  = pick one thing in ten seconds; drawer = reference next to the work; page =
  the work. Slot and goal history and the Explore file preview open there.
  Creating or configuring stays in a popover, navigating stays in the sidebar,
  and an object you work on is a child page in the trail. See
  [The right drawer](#the-right-drawer).
- **Review is the pull request destination for GitHub, and it has no second
  copy.** The lens is Review, its list of review threads is Conversations
  (heading, back links and the overview action say so), and Resolve stays a
  verb on the actions that settle a thread. One lens holds the review conversations, the PR details, the PR
  activity, the checks, the create-a-PR form and the reviewer's own draft
  review. They are detail modes of that one surface, switched from its dock,
  and each mode swaps in for the conversation list like any other detail. An
  open mode is a child crumb (`Overview > Review > PR details`), and the Review
  crumb is the way back to the conversations: there is no second back bar. The
  mode lives in the store per session and drops back to the conversations when
  the lens closes. There
  is no GitHub studio layered over a session: a saved `pr` lens on a GitHub
  session lands on Review. The code-host lens still serves GitLab and
  Bitbucket, which open their own studios. Everything the lens shows comes from
  one durable conversation model. Everything it sends goes out through one
  publisher. So a restart finds the same rows in the same states, and no second
  path pushes a reply or closes a thread.
- **The switcher and the palette list only destinations the session can
  use.** One function feeds both. Context is one entry (its goal, decisions and
  summary parts open through their shortcuts). Explore is always listed and
  browses the active working directory. Diff and the other branch lenses need a
  branch. The code-host lens hides on GitHub. A tool lens appears once that
  tool is connected.
- **A lens surface is reached from the overview or from the trail's
  destination switcher, never from a rail.** Rows and chips inside the
  overview route to it, by expanding in place or opening a side panel. Counts
  and dots are read-only signals on the row that routes there. Session
  lifecycle actions are not navigation and do not belong on those rows. A
  count on a row is a promise about that destination. It counts the items the
  destination lists. Every surface that routes to the same destination shows
  the same number from the same selector. A group of items with no home at the
  destination gets no badge pointing there.
- **The activity bar shows ALL sessions grouped by stage**, never filtered to
  running only.
- **A blocked action is re-routed, never hidden.** A blocked workflow advance
  gives the reason on the CTA and opens an inline confirm before anything
  starts. With auto-run off, nothing advances without a click.

## Creating a session

The new session form always lands on Overview. It offers no agent-kind picker
before the session exists: the kind is a choice made inside a session, not a
condition for having one. Its issue sources come from a curated allowlist, not
from every connected provider, because a connected code host does not mean an
issue picker. The section hides when none of the allowed sources is connected.
Creating a session picks no project either. The session is born on the
workspace with only a container directory, and projects are materialized when
the work reaches them ([concepts.md](concepts.md) → Lazy sessions).

## The right drawer

The drawer is a column of the window grid (`AppShell`, areas
`left lhandle main rhandle right`), never a split nested inside a pane. It opens
at 400px, resizes from 340 to 560px, and keeps one saved width
(`goodboy:right-drawer-width:v1`, clamped on read). Closed, its tracks are
`0px 0px` and it is `inert`. When the main area minus the drawer and the two
gutters would leave the content column under 560px, it lies over the right of
the main area with `shadow-xl` and no scrim, and the main stays interactive.
It never touches the sidebar preference.

One drawer at a time, per window. The `drawer` store slice holds
`{ kind, sessionId, payload, lens }`: `openDrawer`, `closeDrawer` and
`toggleDrawer` (pressing the trigger again closes it). It closes when the lens
or the session changes, with Escape, and with its X; focus then returns to the
trigger. `app/components/DrawerHost` turns a `kind` into its content, framed
by `DrawerFrame` from `@goodboy/ui`: a 44px header (icon, title, count, at most
one action, close), one divider, a `ScrollFade` body and an optional dock. A
body that scrolls itself, such as a chat, passes `scroll="self"` and fills the
frame instead. A new kind adds a variant to `DrawerContent` and a case to the
host.

The `artifact` kind carries `{ artifactId, tab }`, with `tab` either `details`
or `chat`. The artifact shell opens it from its `Chat` and `Details` buttons;
the drawer header switches between the two. It also closes when the focused
artifact changes. While it is open, Escape closes the drawer before it takes the
artifact back to the list.

A studio covers the whole window grid, so it cannot use that column. The inbox
studio keeps the same contract inside itself (`InboxStudioLayout`): the record
opens in a right column with the same width constants and the same saved width,
resizes with the same handle, pushes the list while the list keeps 560px and
lies over it otherwise. Escape closes the record before the studio.

`scriptRun` (payload `{ scriptKey, mountId }`) shows one script run's output.
`ScriptRunDrawer` reads the run from `scriptRuns`, where the one
output subscription per run lives, so closing the drawer loses nothing. The
header action is Stop while it runs and Run again after; the body is a status
line (state, time, project, branch), a `Command` disclosure closed by default,
and the log, which follows the tail until you scroll up and then offers
`Jump to latest`. Error lines carry a danger bar and an `err` prefix. The dock
says `Following output` while it runs and the exit, time and Copy output after.
A run records the mount it ran in, so a project mounted twice reopens on the
right branch.

`file-diff` (payload `{ source, path }`) peeks at a diff without leaving the
page. The source is a worktree (a file opened from the chat) or a commit (a
GitHub commit link clicked anywhere in a session; outside a session the link
opens in the browser). It shows unified and wrapped, and a worktree peek offers
`Open in Diff`, which opens the Diff lens on that mount with the file in focus.
`diff-notes` lists the open notes of the Diff lens by file, and `review-drafts`
lists the review drafts of Write review; the dock count opens each one.

## The Diff lens

Every diff in the app is one `DiffView` (`features/diff`): the Diff lens, Write
review, the Bitbucket pull request changes and the `file-diff` drawer. Only the
comment behavior changes: a note for the agents in the Diff lens, a review
draft in Write review, none in Bitbucket and the drawer. There is no file
sidebar. The toolbar row holds `N files` (the file jump, also `T`: filter,
arrows, Enter), `N of M viewed`, `Unified | Split` and `Wrap` (on by default,
saved as `goodboy:diff-wrap`; split always wraps). `[` and `]` go to the
previous and next file. Each file has a sticky header (status letter, path,
changes, comment count, `Viewed`, `⋯` with Open in editor, Copy path, Comment
on file); a viewed file collapses, and generated or binary files start
collapsed. Rows are a CSS grid with `role="grid"`, never a table. Click a line
number to comment, drag or shift-click to cover a range; the composer and the
threads sit under the last line of the range. ⌘Enter saves, Escape cancels.
The Diff lens docks `N open notes`, the resolver routing chip and
`Propose fixes`; Write review docks `N drafts` and `Submit review`, whose
popover holds the summary and the verdict. Files mount in batches of 20 as the
browser idles, so a large diff stays responsive.

## The Scripts lens

`ScriptsPanel` is one `PaneShell` (`Scripts`, meta `N projects · N running`,
a `Filter scripts` field that `/` focuses and `New script`) over one list
grouped by mount, project plus branch, from `useSessionScripts`. A project
mounted twice is two groups, and its saved scripts show in both; you pick
where a script runs by picking the row in the right group. A group header
collapses it, and the collapsed set is kept per workspace
(`goodboy:scripts-groups-collapsed:v1:<workspaceId>`). Every row is the same
`ScriptRow`: category node, name, command, Source (`Saved`, `package.json`,
`composer.json`), Last run in glyph and word, one Run or Stop button and a `⋯`
menu (saved: Edit, Duplicate, Delete with an inline confirm; manifest: Save as
script, Copy command). Clicking a row opens its output in the `scriptRun`
drawer, and the row whose output is open is selected. New script and Edit open
the same inline `ScriptEditor` card, at the top of the active mount's group or
in place of the edited row. Saved scripts of workspace projects that are not in
the session are named in one line under the groups. The session sidebar has no
scripts section: `$` launches, the Now chip watches.
