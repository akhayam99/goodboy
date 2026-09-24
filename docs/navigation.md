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
- **The board frame.** A "Stage board" eyebrow with a session count sits over a
  centred strip of fixed-width stage columns. Empty columns show only their
  header. Collapsed columns keep a horizontal header. A card's goal is its one
  button (up to three lines, with the full goal in the tooltip). Its quick and
  lifecycle actions sit next to it, never nested inside it. Restoring an
  archived card uses the `restore` glyph.
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
  neutral at rest, and the footer's beta pill takes its tint only on hover and
  focus.
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

## Surfaces

**Shell layout.** One strip of chrome sits above, one footer below, and between
them one sidebar plus main. **There is one app layout and every surface fills its
slots.** The board, the session and the studios do not define their own frames.
A surface that needs a different frame changes the shared one instead of forking
a second. **Two flanking columns at once is not the IA.** A session draws one
full-width pane, and its navigation lives in that single left sidebar. Nothing
has to reach for a second column, and there is no second width to persist. The
sidebar carries presence. It appears when something else is going on. Inside a
session it follows a saved preference, toggled from one control or ⌘B. Peek
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
lives in the session overview and always has the Mount project action, even
before the first mount. Mounted projects show as dense rows. The empty section
is one quiet action row with a short explanation. Sessions are created lazily
on the workspace ([concepts.md](concepts.md) → Lazy sessions), and this section
is where a session's footprint grows. The session header has no second mount
control.

**Inside a session the sidebar stays the sessions list.** There is no second
mode. The sidebar lists the workspace's sessions grouped by stage, and the open
session tells its own story in the main pane. Lens surfaces still exist. You
reach them from rows and chips inside the overview (they expand in place or
open a side panel) and from the trail's destination switcher, never from the
sidebar. Board → session is the full depth of navigation.

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

## Breadcrumbs

- **The trail belongs to the page, not to the chrome.** It sits above the
  session pane, never in the top bar. The top bar is workspace chrome, and a
  session trail is page context.
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

Workspace identity stays on the left. The Goodboy brand is centred on the
window. Workspace-wide signals and set-once preferences stay on the right.
The bar is one three-column grid, `minmax(0,1fr) auto minmax(max-content,1fr)`.
When the signals fit their share, the brand sits at the window midpoint. When
they do not, the brand slides off the midpoint instead of being covered. The
identity has a size limit and truncates, with the full name in its tooltip.
The wordmark drops below `brand-word` and the mascot below `brand-mark`. No
control ever moves into an overflow menu.

- Workspace identity opens an anchored popover that switches and creates
  workspaces. ⌘O opens that same popover, never a second one, and the palette
  lists workspaces as rows of its own. Workspace settings has its own control
  next to identity. Buried inside the switcher, a common per-workspace
  preference was easy to never find.
- **Identity is pinned and mounted once.** Workspace identity stays at the left
  of the top bar on the board, inside sessions, and under studios. Exactly one
  switcher is live, and ⌘O opens its single anchored popover.
- Theme is the one set-once preference kept here. People flip it often enough
  to earn the slot. The guide and pair-device live in the settings studio and
  the palette.
- **The report control is the one exception to "the top bar never edits".**
  Its popover drafts a bug report, which is not a record until it is filed. The
  draft survives closing the popover. The primary action opens the full form
  instead of sending. Precedent: VS Code's top-level issue reporter.

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

Centre: the beta pill and, while an update is pending, the update pip.

Right: the launchers reached by name and a `More` popover for the rest.

- **The release notice answers "have you read the notes for what you're
  running"**, not "has a new release been published". After an update, one
  notice names the installed version and opens its notes. It works offline. A
  fresh install shows none, and dismissing it marks that version as read.
- Exactly one integration control has the active fill. It sits on the open
  glyph, or on the link action when that integration is disconnected. Opening
  any studio closes the others.
- **Before any workspace exists, the footer keeps its app half**: Providers,
  Settings, the beta pill and the update pip. The integration strip, Inbox,
  Workflows and More belong to a workspace and wait for one. Settings then
  lists only App and Providers & models, and Providers opens on an account
  instead of on the workspace defaults. Precedent: VS Code keeps its status bar
  and Manage gear with no folder open.

## Shortcuts

There is one registry with three modifier planes: bare ⌘ for the app, ⌘⇧ for
the session, ⌘⌥ for the lens surfaces. Nobody writes a combo string by hand
outside the registry. So no two surfaces can claim the same chord, and no
shortcut can exist without being documented. That holds for per-OS combos
too. An entry carries its own combo for other systems where the plain mapping
would collide, like the terminal's new tab: ⌘T on macOS, Ctrl+Shift+T
elsewhere, where Ctrl+T belongs to the shell. **A shortcut is taught where it
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
  popover (its header's Open all) and from the palette's Go to group, never
  from the footer, since the bell already shows the unread count. The popover
  never deletes history. That lives in the studio, behind its confirm. Report
  an issue opens from the top bar, **Settings > App > Help** and the palette.
  It sits next to settings, not beside the named launchers.
- **Settings nests items in its rail.** While App is active, its items
  (General, Shortcuts, Backup, Storage, Help, Danger zone) sit under the App
  row as indented rows, and the panel shows one item at a time. Providers &
  models nests Defaults and one row per provider the same way, and Tools nests
  one row per tool. So no scope adds a second rail column. Every scope panel
  keeps the reading width. Precedent: the VS Code settings table of contents
  and Linear's settings sidebar.
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
- **A code-host studio mounted outside a session is browse-and-launch only.**
  The write verbs (approve, request changes, comment, merge, decline) belong to
  a session and stay disabled. The mount reads through the workspace's first
  repo project, so a workspace with no repo project stops at an empty state.

## Lens surfaces

- **A lens shows one level. A studio is a rail plus a detail.** Inside a lens,
  selecting a card swaps the list for the detail, and the trail or Back is the
  way back. No lens keeps a rail beside its detail. A studio pairs a rail with
  a detail and has no back link. Completed and discarded groups sit behind
  header toggles that hide themselves at zero. So a session whose runs are all
  done shows an empty state, instead of opening the last completed run.
- **A step chat is one explicit click**, never an automatic redirect.
- **A lens-wide toggle is its own row**, never inside an empty state's action
  slot.
- **A sibling detail is a split, not a rail.** It is a resizable column owned
  by the pane it opens in, so it closes with that pane. There is one
  implementation of that split. Reuse it instead of growing a rail.
- **Review is the pull request destination for GitHub, and it has no second
  copy.** The lens is Review, its list of review threads is Conversations
  (heading, back links and the overview action say so), and Resolve stays a
  verb on the actions that settle a thread. One lens holds the review conversations, the PR details, the PR
  activity, the checks, the create-a-PR form and the reviewer's own draft
  review. They are detail modes of that one surface, switched from its dock,
  and each mode swaps in for the conversation list like any other detail. There
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
