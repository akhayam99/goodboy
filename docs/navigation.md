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
- **The top bar carries state, identity and movement.** Movement is Back,
  Forward, Board and Search, clustered in the centre. Destinations (studios)
  stay in the footer, and the bar never edits a record in place. The spend
  chip is the one exception: it is state that opens the studio that owns that
  number, on Impact's Spend tab. Board is not a destination like Inbox: it is
  home, and home sits with the arrows.
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
  neutral at rest, and so is the footer's Goodboy chip, with one exception: a
  downloaded update tints the chip into a pill until you act on it. A ready
  update is an event, not a rest state.
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
`composer.json` scripts by category. A row's sublabel names its package (the
manifest name, or `root`) and shows the script's body, not its invocation; the
trailing badge is `Running` or the package's short name (`web`, not
`package.json`) so twenty `dev` rows in a monorepo read apart. Manifests are
read from each mount the first time `$` is typed. With more than one mount a
row also names its project. An empty list says why: no project in the
session, no script in the project, or no match for the filter. Enter runs the
row and opens its output in the right drawer; the composer text is cleared.

## Addresses and history

Every view has an address, and one history per window and workspace records
them. The navigation slice (`store/slices/navigation/`) owns both.

- **A `Location` is where you are plus how the page was.** Its `place` is the
  board or a session view: lens, open agent, session studio and one target
  (artifact, run, issue, diff focus, terminal mount). Its `studio` is the app
  studio open over that place, if any. Its `focus` is the page state: the open
  drawer, selection, scroll and revealed rows. `locationKey` prints the text
  form used by tests and logs: `board`, `s/{session}`, `s/{session}/review`,
  `s/{session}/workflows/{run}`, `s/{session}/agents/agent/{agent}`.
- **One door.** Every move goes through `navigate({ to, mode })`, `back()`,
  `forward()`, `up()` or `amendFocus({ patch })`. `sessionPlace`,
  `agentPlace` and `BOARD_PLACE` build the `to`. The per-session keys the
  surfaces render from (`activeLens`, `selectedAgentId`, `sessionStudio`, the
  focused target) are written only by the slice. A contract test
  (`__tests__/navigation/oneDoor.test.ts`) fails when `features/`, `app/` or
  `shared/` calls `setActiveLens`, `setCurrentSession`, `selectAgent` or
  `setSessionStudio`.
- **Aliases live in `canonicalLocation`, and only there.** An agent resolves
  to its home lens (an unknown agent to Agents). `pr` on a GitHub session
  becomes `review` before it is recorded, so no view redirects after it
  mounts.
- **Push, amend, replace.** A new place pushes: board and session, session to
  session, lens, a child, a sibling from a switcher, a session studio. Pushing
  the place you are on replaces it. Page state amends the current entry and
  never adds one. Canonical rewrites replace. The stack keeps 50 entries and
  lives in memory. Each workspace has its own stack, so switching workspace
  finds that workspace's history again.
- **Back restores the entry as it was; a forward move arrives clean.** Before a
  push, the live view is captured into the current entry, so Back finds the
  same run, artifact or diff focus. A forward move (crumb, sidebar, palette,
  notification, Board) starts with an empty focus.
- **Up goes to the parent.** When the previous entry is the parent, Up is Back.
  Otherwise it pushes the parent. Closing a session studio pops every studio
  entry stacked on the same base.
- **Dead entries fall out.** An archived or deleted session removes its
  entries and collapses the duplicates left behind. An agent that is gone
  falls back to its home lens.
- **Keys.** ⌘[ and ⌘] (`nav.back`, `nav.forward`, app plane) and the mouse's
  back and forward buttons walk the stack.

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
session it follows a saved preference, toggled from the first button of the
sidebar (or of the collapsed rail, on the same axis) or ⌘B. ⌘B does nothing on
the board or under a studio, where the sidebar is not there to see. Peek never
touches that preference.

A window is a strip, a set of columns, and a pane. Each owns one thing.

**The strip** is one row on the chrome, with no line under it: the edge of the
content sheet closes it. It renders **outside** the grid, so no column resize,
hide animation or overlay can move it.

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
Every row carries a `ToneBar`, the same tone primitive as its card
(`sessionTone`), never only running and needs-you rows. Nothing the row knows
hides in a tooltip.

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

**New session starts blank, straight on its Overview.** New, ⌘N, the board,
the palette, the collapsed rail and the checklist all fire
`goodboy:new-session`, and `NewSessionBridge` calls `startBlankSession`
(`store/slices/sessionStart/`): it creates a session with no title, goal,
project, agent or workflow and lands on its Overview. Nothing is asked first.
While the last blank session is still untouched (no title, goal, slot, mount,
agent or workflow run), New goes back to it instead of creating another one,
so repeated presses never pile up empty sessions. A second press while the
first create is still running is ignored. A blank session reads `Untitled
session` in the header, the sidebar, the board and every confirm
(`sessionTitle`).

**A session with nothing started sets itself up inline** (`SessionSetup`).
While it has no agent and no workflow run, the Overview shows `Set up this
session` in place of the next step and Activity: an ordered list of three
steps, one open at a time, each with its own empty state and actions.

- **Goal** asks "What should this session get done?". Save goal writes the
  goal slot and, while the session is untitled, names it after the goal's
  first sentence (`saveSessionSetupGoal`, marked `Named by Goodboy`).
- **Project** lists the workspace projects not in the session yet
  (`MountProjectList`, the same list and preflight as Add project). Skip keeps
  the turns in the session folder; a workspace with no project offers `Add
workspace project`.
- **Start the work** lists `Your workflows`, `Built in` and `From scratch`
  (`Orchestrated workflow`, `Custom workflow`), with Start agent and the Create
  menu beside them. Picking a workflow prefills the builder draft
  (`builderDraftFor`: the preset and its steps, or the custom or orchestrated
  approach, plus the session goal) and opens the same `Start a workflow` studio
  the Workflows lens uses (`WorkflowBuilderView`), editable before anything
  starts.

Each step can be skipped, and a done or skipped row reopens in place on click
(`focusSessionSetupStep`). The next open step is the first one neither done
nor skipped. Skips live in memory per session. The header hides `Add a goal`
and the empty Projects section while the setup shows, so nothing is asked
twice. The first agent or workflow run ends the setup and the Overview
becomes the usual document. Picking up an issue with a drafted brief lives in
the Inbox (Launch session).

## Breadcrumbs

- **The trail belongs to the page, not to the chrome, and it is mounted
  once.** `TrailBar` sits at the top of `SessionWorkspace`, above every layer
  (lens, child page, session studio) and outside every animation, in a 40px
  band (12 above, a 24px row, 4 below) on the same `PageColumn` as the title
  and body. It is never in the top bar and never a full-width strip. Changing
  lens, opening an agent or opening a session studio keeps the same DOM node;
  only the segments change. The layers under it fade in over 150ms with no
  scale. Panes under the band get one header grammar from `PaneShell`: title,
  optional tabs, 16 below, no crumb row of their own. A session studio (builder,
  merge request, Bitbucket) has no second title bar: its title is the crumb,
  and Esc or the parent crumb is Up.
- **Studios use the same `Trail`.** The `StudioFrame` band renders the studio
  name through the `Trail` primitive from `@goodboy/ui`. A studio body that
  goes deeper claims the band with `StudioTrail` (the workflow editor shows
  `Workflows > Ship a fix` with its save state and actions), so the app has one
  breadcrumb.
- **Every crumb has an icon, and depth compacts the trail.** Agents carry the
  agent glyph in their kind's colour, runs the run glyph, artifacts, questions
  and pull request modes their own. The last crumb and its parent always stay
  full. From four crumbs `Overview` turns into its icon; from five every
  ancestor but the parent does. When the band still has no room, ancestors turn
  to icons from the left, then the icons after `Overview` fold into a `…` menu
  right after it; `Overview` is the anchor and never folds. An icon crumb keeps
  its name as tooltip and accessible name. `compactTrail` in `@goodboy/ui` is
  the pure rule; the label closes with a 220ms width transition (120ms fade),
  and a new crumb enters from the right 60ms later. Under reduced motion only
  the opacity changes.
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
  run under Workflows, an ad-hoc agent under Agents, a resolver under its
  comment in Review (`s/{session}/review/t/{thread}/agent`). Back returns where
  you were, while the trail says where you are.
- **Segment menus.** Every segment that has siblings carries one `CrumbMenu`
  (the `Trail` primitive in `@goodboy/ui`), and the rule is one: its menu lists
  the siblings of what that segment names, plus at most two actions that belong
  to that thing. The page segment (depth one, or `Overview` when it is alone)
  lists the session's pages with a count that names what it counts
  (`3 need you`, `2 running`), grouped as pages, Tools and Linked; `Overview`
  has no menu once it has children. A run lists the session's runs (Running,
  Finished, a chained run indented under its own with `after ...`); a step
  lists every step of its run in order, the ones not started switched off; an
  agent lists the agents of the same home grouped Needs you, Running, Done,
  newest first; an artifact lists the session's artifacts by kind. Actions
  exist only where a real action backs them: `Start agent`, `Start a workflow`
  and `New artifact` (opens the kind picker) on their pages, `Stop this step`
  while a step runs and `Retry step` when it failed or is blocked
  (`recoverStuckStep`), `Show saved copy` and `Copy folder path` on the open
  artifact. An attempt offers `Resolve again` once no attempt on that comment
  is queued or running: it starts a new attempt with the Review page's default
  instruction, through the same `useResolveAgain` hook Review uses.
- **The Diff ends on the branch it shows**, with its `+N -M`, and that segment
  lists the session's branches by repo with one state word each, the first
  that applies of `Merged`, `Gone on origin`, `Local only`, `Diverged from
origin`, `Behind main by N` and `On origin` (`branchPriorityOf`), and `All
branches in Overview`. `Local only` and `Diverged from origin` read the
  branch's own remote copy (`branchPushStateOf`), never the base it was cut
  from. A
  branch whose pull request merged reads `Merged` even with no git ancestry
  (a squash merge), in the menu and in the Diff header alike
  (`isMountRequestMerged`). It never
  turns into an icon. A Diff opened without a branch lands on the active mount.
- **The resolver's page reads Review, the comment, Agent.** The comment segment
  (`retryPolicy.ts:42`) lists the open conversations by file, resolved ones
  apart, with `Open on GitHub` and `Copy link`; `Agent` lists the attempts on
  that comment.
- **Settings claims its studio band** with Settings, the scope and the App
  section. The scope segment lists App, the workspace, Providers & models and
  Tools; the section segment lists the App sections. Neither carries an
  action: Settings has no project scope, so there is no `Use workspace values`
  to offer. The first segment of a
  studio has no menu: studios change from the footer.
- **Every menu row has five slots**: lead, label with a faint second part,
  meta, a state that is always a word (from `agentStateWord`, the same reading
  `isAgentFinished` makes), and a check on the current row, which is there even
  when it is the only row. The last segment opens its menu from the whole
  segment and always shows the chevron; an ancestor goes up by its name and
  shows its chevron on hover. Widths are 300 (pages, scopes, sections), 380
  (runs, steps, agents, artifacts, conversations, attempts) and 460 (branches);
  a filter appears from nine rows up. An action that breaks something (Stop
  this step) confirms inside the menu's action band with `InlineConfirm`;
  Escape cancels the confirm first, then closes. Shortcuts live in the segment
  tooltip and the palette, never in the rows.
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

- Left: workspace identity. It has a 200px limit and truncates, with the full
  name in its tooltip. The sidebar toggle lives in the sidebar, not here.
- Centre: the movement cluster, then the command center. `Back` and `Forward`
  (24px icons) name their destination in the tooltip (`Back to Review ·
{session}  ⌘[`), sit at 40% with `Nothing to go back to` when the history is
  empty, and open the last 12 entries on right click or a 400ms hold. `Board`
  is `SquareKanban` plus the word, 24px high like the search: on the board it
  is pressed (`aria-current="page"`, `You're on the board`) and does nothing;
  over a studio on the board it closes the studio; in a session it navigates
  to the board as a history entry. ⌘⇧H does the same. The command center opens
  the palette and shows ⌘K; it never takes typing itself.
- Right: the storage chip, the Now chip (needs you, running, scripts, each
  only when above zero), today's spend and the bell. The storage chip
  (`StorageChip`) reads `Free 7 GB` in muted text only while at least 1 GB of
  worktree folders can go on every workspace, the same "can go" the Storage
  summary counts (`useStorageSummary`); it never turns warning, and it hides
  when there is nothing to free. A click opens App > Storage scoped to all
  workspaces on To review, scrolled to the worktree folders. Now opens one popover grouped by those
  three, and a group with no rows is not drawn. A script row moves to its
  session and opens that run's output in the right drawer. Spend opens Impact
  on its Spend tab; it is never merged with a count. Then `Limits`: one chip per connected plan provider (Claude, Codex,
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

The traffic lights, identity, the movement cluster (Board keeps its word),
the command center, the needs-you count, the
spend figure, the first Limits chip and the bell never hide. The Limits chips
past the ones that fit are the only overflow: a `+N` chip takes the tone of
the worst hidden provider and lists them. No other control moves into an
overflow menu. `chrome-labels` sits below the 1024px minimum window, so words
only drop under zoom.

- Workspace identity opens an anchored popover that switches and creates
  workspaces. ⌘O opens that same popover, never a second one, and the palette
  lists workspaces as rows of its own. `Find a workspace or project` filters by
  workspace name and by project name. The current workspace sits in its own
  `This window` row (a check mark and `Current`, plus the only gear icon into
  Workspace settings); every other workspace shows one verb, `Open`, that
  replaces the workspace in this window (`⌘Enter` always opens a new window
  instead, and a row already open elsewhere says `In another window`). Open
  replacing a window with agents running here asks first, inline under the
  row, never in a modal: the primary keeps them going in a new window, the
  ghost alternative stops them and opens here. A closed `Disconnected` group
  lists workspaces removed from disk, each with a small `Reconnect`. Settings
  opens on App > General; only Workspace settings lives behind this popover,
  so the bar holds no second settings control.
- **Identity is pinned and mounted once.** Workspace identity stays at the left
  of the top bar on the board, inside sessions, and under studios. Exactly one
  switcher is live, and ⌘O opens its single anchored popover.
- **Theme is in the bar, after the fourth round of removing it.** A dark room,
  a projector, a shared screen: the theme changes several times a day, and a
  detour through Settings is friction each time. The toggle sits after the
  vertical divider and before the bell, alternates dark and light on a click,
  and turns Match system into an explicit choice the first time it is
  clicked. Below the 720px `chrome-narrow` width it leaves the bar; it is not
  in the never-hide list. The three-way choice (dark, light, Match system)
  stays in Settings > App > General and in the palette.
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
"Goodboy beta". Its popover leads with Report a bug (with ⌘I, and Draft saved
when a draft waits), then the version and release notes, the update, the setup
checklist, What's new, keyboard shortcuts and Sponsor. Report a bug closes the
popover and opens the report sheet. The popover opens by itself once, when the
first agent finishes a turn, and never while the setup wizard is open; the
checklist has no floating card.

## Report sheet

One sheet files every report. `ReportSheetHost`
(`features/bug-report/components/ReportSheetHost`) floats it above the footer
chip, centred, with no overlay: the page under it stays live. Every door lands
there: ⌘I from anywhere, Report a bug in the Goodboy chip, Report a bug in the
palette (it also answers bug, issue, feedback, crash and broken), **Settings >
App > Help**, **Help > Report a bug** in the macOS menu bar (`help_menu.rs`
emits `goodboy://report-open` to the focused window), and Report this on a
warning or error notification, which attaches that notification. Opening the sheet reads the screen you are on
before anything moves, so Settings stays open under it.

- **One line is the title.** The cursor starts there. ⇥ or Add detail opens a
  longer field, ⌘↵ sends, Esc closes, and the line and the detail stay in the
  `bugReportDraft` slice until the report is sent.
- **Every attached part is a chip.** Version and build, system, screen, CLI
  versions, and the notification or the error when there is one. A chip's ×
  leaves it out; the dashed chip puts it back.
- **What gets sent** opens the exact text that leaves, with the count of
  redactions and the list of what never leaves.
- **The button says where it goes.** With GitHub connected it is Send, and
  the issue is filed through `gh` under your account; the toast links it.
  While you type, an open issue that matches shows above the chips with Add
  mine there, which comments instead of filing. Without GitHub it is Open on
  GitHub: a prefilled link, and when the report does not fit the link the full
  text goes to the clipboard first.
- **Crash and startup failure.** The crash screen shows the same sheet inline
  under the error, with the error and our stack frames attached and the line
  set to `Crash: <kind>`. The startup error screen opens it under the error
  with Report this. Neither needs the store.
- **After a crash the app could not show.** An uncaught window error or a
  panic leaves `~/.goodboy/last-crash.json`. The next launch shows one
  persistent toast with when and where: Goodboy closed unexpectedly last time
  after a panic, Goodboy hit an error last time when the window kept running.
  Report it opens the sheet as Report this crash or Report this error with the
  error and the last action names attached, and Dismiss
  deletes the record. `LastCrashBridge` claims the record, so only one window
  shows it.

First-run setup is a full-screen wizard in one shell that never moves: a top
bar with a labelled stepper (Provider, Project, Code host, Tasks, First
session) and Skip setup, a body that starts at the same line on every step,
and a footer pinned at the bottom (Back left, Skip for now and the primary
right). Steps crossfade in place (240 ms, 80 ms of opacity with reduced
motion); the footer is disabled while they do. Welcome says what the five
steps take. Provider needs one usable route (a CLI login, a saved key or
OpenCode's free models). Project picks one folder, with or without version
control, names the workspace after its parent folder and finds the
repositories inside one. Code host is skipped by itself when no project is a
repository. Code host and Tasks can be skipped; Sentry, Slack and the rest
live in Settings › Integrations. There is no permissions question: every
workspace starts on Full access. The last step offers three ways to start,
with Ask an agent picked and three starters: Start Scout creates the session
in the project picked in the Project step (`startFirstScout`), titled after
the starter, with Scout running on it. Pick up a task closes the wizard on the
Inbox. Run a workflow closes it on a blank session in that project, open on its
Start the work step. With no
issue source at all, Pick up a task says so and leads back to Code host. The checklist has six
items (provider, project, code host, task manager, first session, profile); a
skipped code host or task manager reopens its own step, and the first session
ticks when an agent finishes a turn, not when a session row exists.

Right: Inbox, Workflows, Impact and Settings. Settings always opens App >
General, with or without a workspace; Workspace settings opens only from the
gear on the current-workspace row of the workspace popover. Impact is a
destination, so it has a launcher; the launcher opens its Overview tab, while
the spend figure in the top bar and the `Impact: Spend` palette entry open its
Spend tab. Providers & models is a Settings scope, reached from the Settings
rail and the palette, so it has no footer launcher. Changelog opens from the
Goodboy chip and the palette, so it earns no footer entry either.

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
elsewhere, where Ctrl+T belongs to the shell. Report a bug (`report.open`) is
⌘I on macOS and Ctrl+Shift+I elsewhere, because Ctrl+I is Tab in a terminal;
it fires from anywhere, the terminal included. Refresh session
(`session.refresh`, ⌘⇧R) sits on the session plane beside Archive (⌘⇧A) and
Delete (⌘⇧⌫), because it acts on the open session; ⌘R stays the app reload.
The plane is for the dispatcher.
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
shortcuts) and the guide. The palette opens there too.
Studios are not part of the breadcrumb IA. They exit on close or Esc, and only
one is open at a time.

- **An open studio is a history entry.** Opening a studio, or switching from
  one studio to another, pushes an entry over the page underneath
  (`openStudio`). Reopening the same studio, a Settings scope change and the
  Inbox's provider and record update that entry (`amendStudio`). Back from
  Workflows reopens the Inbox with its record. Close and Esc fold every studio
  entry stacked on the same page into that page (`closeStudio`): closing means
  the side trip is over, Back means one step.
- **Navigating closes the studio.** A forward move to a place (another
  session, a lens, an agent, the board) arrives with no studio, whether it came
  from the palette, a needs-you row, a shortcut or a link inside the studio, so
  the destination always lands in front. Switching workspace closes it too.
- **One frame for every studio.** `StudioFrame` (`app/components/StudioFrame`)
  mounts only while a studio is open and stays mounted from Inbox to Workflows
  to Settings. It owns the 40px band (the studio's icon and name, the body's
  subtitle and accessory, Done), the Esc layer and the motion: `studio-in` when
  it opens, `studio-out` when it closes, and on a switch only the band's name
  fades while the new body enters in 160ms. A studio body still renders
  `StudioShell`; inside the frame it only hands its chrome to the band. Until a
  body's chunk arrives, the frame shows one of three opaque skeletons: `list`
  (Inbox, Notifications, Add workspace, Impact), `rail`
  (Settings) or `grid` (Workflows, Changelog, the guide, pairing). With no studio
  open, no frame node exists, so nothing covers the page.
- **One Esc stack.** The frame, a body that holds Esc (the Inbox with a record
  open), the agent overlay and the delete confirm all register with
  `useEscapeLayer`, so Esc closes the topmost layer only.

- **Not every studio earns a footer entry.** Notifications opens from the bell
  popover (its footer's Open all notifications) and from the palette's Go to
  group, never from the footer, since the bell already shows the unread count.
  The popover never deletes history. That lives in the studio, behind its
  confirm. Reporting a bug is not a studio: it is the report sheet above.
- **Notifications have one row and one scope.** `NotificationRow` draws a
  group in the popover (`compact`, one line, eight rows at most, Unread or
  All) and in the studio (`cozy`, opens in place with the body, the older
  members and Report this). Both lead with a fixed unread slot that holds
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
  Backup, Storage, Security findings, Help, Danger zone) always sit under the
  App row as indented
  rows, whichever scope is active, so switching scope never moves a row above
  the pointer. The panel shows one item at a time. Providers & models nests
  Defaults and one row per provider, and Integrations nests one row per tool. Those
  two lists open and close with `Reveal`, and the rail stays one mounted
  element across scopes: `SettingsStudio` portals each scope's nested list and
  detail into slots it owns, and keeps a closing scope mounted until its list
  has collapsed. Every settings panel enters with `nav-step-in`
  (`SETTINGS_PANE_ENTRY`). So no scope adds a second rail column. Every scope
  panel keeps the reading width. Precedent: the VS Code settings table of
  contents and Linear's settings sidebar.
- **Storage is the one place for disk space, scoped by a picker.** App >
  Storage lists every worktree folder Goodboy made, grouped by repository,
  under three filters: To review, In use and Kept. The page is two clusters
  (`StorageCluster`), each with its own accent on a tinted icon and a left
  rail: `Free up space` (primary: the summary, Worktrees, Artifacts from
  deleted sessions, History and app data, Cleanup) and `Clean up branches`
  (merged: Branches, then the scoped workspace's after-merge rule with a
  `Change` link to Workspace settings). A scope picker
  (`StorageScopePicker`, `Listbox`) sits in the page header row next to
  `Check again` (`StorageHeaderActions`): the current
  window's workspace, every other workspace with its own weight, `Removed
workspaces` (folders whose owning workspace is gone or was never linked),
  and `All workspaces` with the machine total. The scope drives the summary
  numbers, the worktree list and the artifact list together
  (`storageScope`, `resolveStorageScope`); it defaults to the current
  window's workspace, or to all workspaces without one. A scope other than
  all drops App data out of the bar into its own line (`state.storageScope`
  never splits app data by workspace) and keeps a faint, clickable `All
workspaces: <total>, <can go> can go` line under the numbers. The
  workspace page's own Notice, and the `open-orphan-worktrees` notification
  action, both open Storage already scoped to that workspace
  (`openStorage({ scope })`); the machine-wide `open-storage` nudge opens it
  scoped to all. The only bulk action removes clean folders idle past
  "Suggest cleanup after"; a folder with changes, an operation in progress, a
  writer lease or no git registration never joins it and says why on its row.
  Outside Settings there is one nudge and never a modal: `evaluateStorageNudge`
  sends a `storage-reclaimable` notification (action `open-storage`) when that
  amount passes 10 GB, then stays quiet for 14 days and speaks again only after
  it grew by another 10 GB. The thresholds and the last nudge live in the
  settings table (`storage.suggestAfterDays`, `storage.lastNudgeAt`,
  `storage.lastNudgeBytes`). Sizes are measured one folder at a time after
  boot, never on the boot path. The worktree scan itself sends nothing.
  In the branches cluster, `Branches` (`BranchesSection`) lists local branches
  only, in the same scope, grouped by project. It scans only when it opens:
  one `git for-each-ref` per project (`project_branches`), with the merge
  test cached by both tips and fed each branch's merged pull request head
  (`listMergedRequestHeads`). A filter picks `Made by Goodboy` (the default,
  branch names from `session_worktrees` and `retained_worktree_paths`),
  `Yours` (plus branches whose tip is authored by the repo's `user.email`,
  shown `By you`) or `All local`; protected branches never show. Tabs split
  `Safe to delete` (merged by merge commit or rebase, merged by its pull
  request with nothing after the merged head, or never used), `Needs a
look` (`Merged, then N new commits`, unmerged and gone on origin, local
  only for over 30 days, or older than 90 days; never preselected) and
  `All`. Each row has
  the session chip (`SessionChip`: stage dot, title, stage word, opens the
  session), `On origin` / `Local only` / `Gone on origin`, the verdict and
  the last commit's age. Delete goes through an InlineConfirm in the bulk
  bar that counts the commits an unmerged branch takes with it and offers
  `Also delete N on origin` only for Goodboy's own pushed branches in repos
  where GitHub does not already delete merged branches. Deletes use the
  same compare-and-delete and 14-day restore as the after-merge rule; a
  success Notice carries `Undo` for the batch. A branch another worktree
  holds reads Protected, so its folder goes first from Worktrees.
  In the space cluster, under Worktrees, "Artifacts from deleted sessions" lists plans, reports
  and wireframes whose session is gone, under To review and Kept, with Open,
  Keep (30 days or always) and Delete behind an InlineConfirm. Its one bulk
  action deletes the unused ones. Artifacts never trigger a nudge on their own.
- **Security findings is its own App page, workspace-scoped.** It scans the
  text Goodboy keeps for a workspace (saved scripts today; workflow steps,
  the profile, reply templates and permission rules are named in the design
  but not wired to a scan call yet) for known token shapes
  (`scanTextForSecrets`, packages/core), fingerprints each hit with sha256,
  and never stores the value (`security_findings` table,
  `recordSecurityFindings`). A save reconciles that subject's findings: new
  fingerprints open, missing ones resolve, and a finding marked "Not a
  secret" (`dismissSecurityFinding`) stays dismissed even if the exact same
  value is scanned again, until "Flag again" clears it. The page needs a
  workspace; without one it says so instead of scanning anything.
- **Settings rail tone is state, never decoration.** Each row carries its
  concept icon from `CONCEPT_ICONS`. One reader, `railSubtitles({ state,
workspaceId })`, owns every row's subtitle and tone (it replaced three
  separate selectors read straight from `SettingsRail`, and a regression test
  spies on `invoke` to keep it invoke-free at render). A dot appears only
  when something needs doing: warning on Providers & models when a connected
  CLI is too old for a model it serves or no provider is connected
  (`selectProviderAttention`, with the reason as the row subtitle), info on
  General while an app update is ready, info on Storage with "N GB can go" as
  its subtitle once clean idle folders pass 10 GB (warning when the disk has
  under 10 GB free and at least 1 GB can go, `selectStorageAttention`),
  warning on Security findings with "N open" once the current workspace has
  an undismissed finding (`selectSecurityFindingsAttention`), and warning on
  Workspace with "N folders not found" once one of its projects reads
  `missing` in `projectGitStatus` (otherwise the row just names the
  workspace). Integrations carries a faint inventory subtitle with no dot,
  "N of M connected" over the whole integration catalog
  (`connectedInventory`). Danger zone reads in `text-danger`. Panel sections sit on
  bands (`Band`, eyebrow outside) with gap between them and no `Divider`; a danger zone
  is an inline danger `Notice`. The workspace page is the exception: one
  column of eyebrow sections 24px apart. Its title is the workspace name,
  renamed in place. Projects group Starred ahead of All (never in both), each
  a 32px grid row (star, kind, name, description, a base-branch chip only
  when set by hand, a Folder-not-found flag) with Open in editor, Copy path
  and Unlink in a reserved column, dim at rest; clicking the name opens an
  inline editor below the row for the rest (description, base branch, After
  merge for repos, folder, facts, footer actions). New session defaults sit in a
  two-column grid with each help behind an info mark, followed by the
  `After a pull request merges` segmented control, and disconnecting is a
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
  blocked with the reason until Goodboy has resolved it for a session. A GitHub
  pull request opens read only: description, review state, branches and its
  comments, with Launch session as the primary and Open in GitHub for the rest.
  Merge
  always asks first, and so does every destructive verb. The mount reads
  through the workspace's first repo project, so a workspace with no repo
  project stops at an empty state.
- **Every record header has the same four places.** `RecordHeader` puts the
  tool glyph, the identifier and the state on the identity line, with Open in
  the tool, the `⋯` menu and, in the inbox, close at its end. Under the title
  sits one action row: one primary (Launch session, or Open session once one is
  linked) and at most two tool verbs picked by state. Before a session is
  linked, the inbox adds Link to a session beside Launch session: a searchable
  list of the workspace's sessions, inline, that links the record to the one
  you pick. Everything else lives in
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
  the work. The session context and the Explore file preview open there.
  Creating or configuring stays in a popover, navigating stays in the sidebar,
  and an object you work on is a child page in the trail. See
  [The right drawer](#the-right-drawer).
- **Review is where the session's code is discussed; the pull request page is
  where it ships.** The lens is Review, its list is Conversations (heading,
  back links and the overview action say so), and Resolve stays a verb on the
  actions that settle a thread. Review exists with or without a pull request:
  without one it is one root with a `No pull request` header and the session's
  notes (see Pull request review in `docs/concepts.md`). Its dock holds only the
  publication, and its header links the pull request page (`PR #528 ›`).
  The `pr` lens is the pull request page on GitHub too (`Merge request` on
  GitLab, still their own studios there). Its trail is
  `Overview › Pull request › #528`, and `#528` opens a menu of the session's
  pull requests by branch, with `New pull request`. The page header carries the
  state action (`Merge`, `Mark ready for review`), `Write review` and `GitHub`.
  The body reads, in order: one warning with `Resolve in Review` when
  conversations wait or a reviewer asked for changes, otherwise the merge
  readiness note; then Details, Checks and Activity. `Write review` is a child
  page (`Overview › Pull request › #528 › Write review`) with the submit dock;
  without a pull request the page is the creation form
  (`Overview › Pull request › New`). The child page lives in the store per
  session and drops back to the page when the lens closes. Everything Review
  shows comes from one durable conversation model and everything it sends goes
  out through one publisher, so a restart finds the same rows in the same
  states, and no second path pushes a reply or closes a thread.
- **The resolver stays in Review.** A resolver exists for one comment, so its
  home is that comment, never the Agents lens. The conversation panel has two
  tabs, `Comment` and `Agent`; `Agent` shows the resolver's live transcript and
  composer, with a dot while it works. View agent, a notification, the
  agent-started toast and the palette all land on Review with that comment's
  panel open on `Agent` (`canonicalLocation` maps the resolver to the first
  thread of its attempt). `…` → Open agent full page opens the resolver as a
  child page of Review; Back, or Up when the queue is the entry below, returns
  to the queue with the panel open, and Up from a page reached any other way
  opens the queue with that comment. There are no return pills: the Diff, the
  publication and the resolver page all come back through Back.
- **The switcher and the palette list only destinations the session can
  use.** One function feeds both. Context is a drawer, not a destination: the
  palette offers **Show context** (⌘⌥C) and neither lists a Context page.
  Explore is always listed and
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

A new session is created blank and always lands on Overview. Nothing is a
condition for having one: goal, project, agents and workflow are each set
later, inline, from the setup steps. Creating a session picks no project. The session is born on the
workspace with only a container directory, and projects are materialized when
the work reaches them ([concepts.md](concepts.md) → Lazy sessions).

## The right drawer

Every drawer is one primitive, `DrawerColumn` from `@goodboy/ui`, never a
split nested inside a pane. `AppShell` puts one beside the main area, and a
studio body puts one beside its list. It opens at 400px, resizes from 340 to
560px from a handle on its left edge, and keeps one saved width
(`goodboy:right-drawer-width:v1`, clamped on read) for every drawer. It is a
floating card: 8px from the top, right and bottom edges and from the column,
radius 10 (`rounded-frame`), `bg-subtle`, a hairline border. When the main
area minus the drawer and the two gutters would leave the content column
under 560px, the card lies over the right of the main area with a shadow and
no scrim, and the main stays interactive; pushing, it has no shadow. Closed,
its track is 0px wide and `inert`. Opening pushes the track open in 220ms while
the card slides 12px in; over the page it slides 16px in 200ms; a new kind in
an open drawer fades its content in 120ms. It never touches the sidebar
preference.

One drawer at a time, per window. The `drawer` store slice holds
`{ kind, sessionId, payload }`: `openDrawer`, `closeDrawer` and `toggleDrawer`
(pressing the trigger again closes it). **The open drawer is part of the
history entry's focus.** A forward move (crumb, sidebar, palette, a child such
as an agent) arrives with it closed; Back and Forward bring it back as it was;
Escape and its X close it in place. Focus then returns to the trigger. `app/components/DrawerHost` turns a `kind` into its content, framed
by `DrawerFrame` from `@goodboy/ui`: a 44px header (icon, title, count, at most
one action, close), one divider, a `ScrollFade` body and an optional dock. A
body that scrolls itself, such as a chat, passes `scroll="self"` and fills the
frame instead. A new kind adds a variant to `DrawerContent` and a case to the
host.

The `context` kind carries `{ tab, view }`: `tab` is `goal`, `decisions` or
`summary`, in that order, and `view` is `current` or `versions` (the old
versions of that slot, inside the same drawer, with Restore; Escape leaves the
view before the drawer). The **Context** chip in the session header toggles it
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
with Retry in the drawer's status line. The old addresses `s/{session}/context`
and `context/goal`, `context/decisions`, `context/summary` resolve in
`canonicalLocation` to the overview with this drawer open on the matching tab.
The drawer header has one action, **Copy as brief**, which copies Goal,
Decisions, Summary and Open questions in that order (`shareableContext`).

The drawer sits on the `subtle` panel surface, like every `DrawerFrame`. Its
tabs are a `SegmentedTabs` strip at its own width, with the status line on the
same row; the Decisions tab carries the count and the change dot.

Every tab reads as labelled blocks (`ContextBlock`: a `fill` band with an
eyebrow title, an icon and a count). A block shows its key line first and
folds the rest behind **Show N more** (`KeyLineList`); `summaryItems` splits a
body into items, one per top-level bullet with its sub-bullets, or one per
sentence for prose. Summary shows State, Next, Open questions (the session's
open questions, read only) and Learned, then any section the summarizer did not
name. Goal is one block with Edit and Versions in its header. Decisions shows
the changes block, then Active, then the folded Replaced and withdrawn group.

The Decisions tab reads the decisions ledger ([turns.md](turns.md#the-decisions-ledger)).
When something changed since the previous look (`sessionDecisionsBaseline`,
the `context_seen_at` captured when the drawer opened), it starts with
**Changed since you last looked**: one line per row, `+` added, `−` removed
(`Replaced by 7` or `Withdrawn`), a pencil for reworded, and a click scrolls to
the row and highlights it. Then **Active**, with its count: active decisions
newest first, each with its number, at most two lines of
text, and who settled it (`Implementer · turn 9 · 1h`, `You · 2h`,
`replaces 5`). An added row also carries `New` until the next open. A row the summarizer reworded says `Reworded by Goodboy` with
**Show previous**. On hover a row offers edit (a reword of yours) and
Withdraw, with no confirm because the bottom group, **Replaced and withdrawn**,
offers Restore; its rows are struck through, point at the decision that
replaced them (`→ 7` scrolls there and highlights it), and quote the reason.
The dock adds a decision of yours on Enter. While the summarizer writes, rows
stay readable and every edit waits. A row that arrives while the drawer is open
comes in with `Reveal` (200ms), and a reworded text fades in (180ms,
`animate-text-swap`); both are `motion-safe`, so reduced motion swaps at once.

In Activity, a `decisions_changed` row that carries `decisionChanges` is a
disclosure: the row toggles (`Show changes` / `Hide changes`, `aria-expanded`)
a diff under it, `+ D12`, `D3 → D12` with the reason, `− D5` with the
withdrawal reason, at most six lines, and **Open in Context**, which opens the
drawer on Decisions with those numbers in `payload.highlight` (highlighted for
2.4s, the closed group opened when one of them is there). The expanded row
adds the diff's fixed height (`decisionChangeDetail`) to its item before
`layoutTimelineRail`, so the rail and lanes run through it.

The `artifact` kind carries `{ artifactId, tab }`, with `tab` either `details`
or `chat`. The artifact shell opens it from its `Chat` and `Details` buttons;
the drawer header switches between the two. It also closes when the focused
artifact changes. While it is open, Escape closes the drawer before it takes the
artifact back to the list.

A studio covers the whole window grid, so it cannot use that column. The inbox
record opens in the same `DrawerColumn` inside the studio body
(`InboxStudioLayout`), with the same width, card and motion. Escape closes the
record before the studio.

`conversation` (payload `{ threadId, tab }`) is a Review conversation. The queue
stays the page and the conversation opens in the shell drawer: `DrawerHost`
renders `ConversationDrawerSlot`, and `ResolveQueueHome` portals the panel
into it, so the panel keeps the queue's order and keys. Back from the Diff or
from the resolver's page finds the conversation open again, because it was in
the entry. The panel is one column that reads its own width (`@container`),
never the viewport: a 44px `ResolvePanelHeader` (the state as glyph and word,
the location in mono, previous and next with `N of M`, `…`, close), then the
comment, the agent's question, the reply, the change, the checks and the
resolver's run, and a fixed footer with one primary and one secondary action.
The list beside it replaces the old Back to conversations button.

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
sidebar.

The Diff lens shows one branch. The trail carries the choice (see Segment
menus); there are no worktree tabs. The header speaks only for that branch:
meta `repo · N commits · state word`, one primary chosen from the branch state
(`Rebase on main` when it is behind main, `Push branch` when it is local only
with commits, none otherwise), `Rewrite history` with the commit count and `⋯` (Refresh, Open
all in editor, Copy branch name, Copy patch). Every rewrite takes the shown
mount's `mountId`, never the active mount. `Rebase on main` replays the
branch on origin with the history engine and runs no agent. The engine first
predicts the replay in memory; when it conflicts, the button reads
`Rebase on main · N conflicts` and the tooltip names the files, and only then
the hidden History rewriter merges the edits in a throwaway copy. The branch
moves only after the engine checks the result, with a backup ref and a push
with lease.

`Rewrite history` is a child page of the branch: the trail reads
`Overview › Diff › <branch> › Rewrite history`, the branch segment leads back
to the Diff, and picking another branch from its popover keeps you on Rewrite
history. The page draws the branch as a graph (`history_graph`): a grey main
trunk with its head node (`main is here now`, how many commits it gained,
`Start from today's main`), your branch leaving it at the real fork point, one
row per commit newest first, and `Your branch starts here` at the fork. Fact
chips over it say how many commits are yours and how many stay after Apply,
how far main moved, and how many are already online. The big list is always
the branch as it is (Now) and never reorders while you plan; beside it, After
Apply draws the planned result with a dashed lane, each node level with its
own row when the order allows. Under 760px of content the side graph becomes
a `Now | After Apply` toggle. Every action has one color (Keep green, Fold in
azure, Combine yellow, Move violet, Rename neutral, Remove red, Start from
today's main grey) used on the row's change mark, its node, a 2px edge, the
dot of its "what happens" line and its planned change. Drag a row between two
others to move it, drop it onto a row to fold it in (fixup, `Keep title`), and
switch `Keep title | Keep both` on the folded row or its change to combine
(squash). The drag is pointer events with our own hit testing
(`useHistoryDrag`), never HTML5 drag and drop: the window's native file drop
owns the drag session on macOS, and the composer's file drop needs it on. Keys
on a focused row: Alt with the arrows moves, C folds into the one below, S
combines keeping both messages, R or Enter renames, Delete or Backspace
removes, ⌘Z undoes the last edit. Hovering a row, a node in After Apply or a
planned change lights up the same commit in all three places. Nothing touches
git while you edit: the plan is a draft saved per worktree in `history_plans`,
the planned changes are derived from it (each with its own `Undo`, plus
`Reset all`), and once the plan rests for a quarter of a second the engine
predicts it in memory with one `git merge-tree --stdin` process for every
commit and one `git fast-import` that writes the predicted commits (git 2.45
or newer; older git spawns one merge and one commit per step). A predicted
conflict shows on its row (`may conflict in webhook.ts`) and in a notice with
`Rewrite with an agent`. The action row sits at the end of the content
(`FormActions`, no dock): `Apply`, or `Apply here only` and `Apply and update
online` when the plan replaces commits that are already online, which also
shows the notice about the pull request and the push with lease. Apply never
rewrites the branch first. `history_plan_run` checks the worktree (right
branch, nothing uncommitted, head where the plan started), replays the whole
plan on a temporary git worktree outside your checkout, reports each step
while the page says `Trying your changes on a temporary copy. Your branch is
untouched until this finishes.`, checks the result (no conflict left, no merge
commit, the planned number of commits, and the same tree as the branch, or the
branch merged with today's main, except the files of removed commits), and
removes the copy on every exit. A stop names the step and why and says the
branch is exactly as it was. Only a passing check moves the branch, after a
backup ref: the files move first with a two-way `read-tree` that refuses to
overwrite local or untracked work (ignored files and folders included), then
the branch ref moves with a compare and swap while HEAD still points at that
branch, and nothing ever runs a hard reset on your checkout. The worktree and
branch the trial ran on travel with the run to the move and the push, and any
switch stops them. A rewrite interrupted by a crash is settled before the next
one checks the worktree; a record Goodboy cannot tie to its branch blocks
Apply with a notice instead of being guessed. Empty commits are
kept; only what the plan removes or folds disappears. Commits before the first change keep their shas, so an edit to local
commits never rewrites what is online. The push always carries
`--force-with-lease` on the online sha the plan already contains
(`history_remote_lease`), never a bare force or a sha read after the trial;
a push that lands during the trial stops the apply before anything moves; if
origin moved, nothing is pushed and the result offers `Bring them into the
plan`, which fetches the commits origin gained, replays them on top of the
rewrite in a copy and leaves `Push with lease` on the new origin sha. The
result section lists what changed in the action colors, says whether the
online copy was updated, what the check found, and the backup, with `Restore
it` and `Done`. Every move leaves a backup under `refs/goodboy/backup/`, in a
namespace made from the full branch name, kept 30 days; `Backups` in the page menu lists them with `Restore previous
history`, which moves the branch back and, on a branch with an upstream,
pushes it with a lease only when the online copy has nothing newer than that
backup, or is the last rewrite this page pushed and the online copy it replaced
was already in that backup; otherwise it stays restored here and the page says
nothing was pushed.
The backups restores leave skip the 30 days and keep the newest 20 per
branch, never dropping one that is the only ref to its commits, and the
newest backup of a branch is never pruned. Backups made before the current
naming never move: they show read-only as older backups under every branch
whose name matches, can't be restored from the page and are never pruned. History rewriter's writable directories
are its copy, that copy's own git admin folder, the object store and the
packed-refs lock file git takes when it clears a rebase marker. They confine
it only under an OS sandbox or permission check (Codex in `workspace-write`,
Claude outside `bypassPermissions`); in `bypassPermissions`, the default, the
kickoff's rules are what keep it inside the copy. Temporary copies left by a crash are removed when the
app starts. Each copy lives in a folder Goodboy reserves atomically under
`~/.goodboy/history-copies`, never in a temp folder a sandboxed agent can write, with an
owner file and a lock it holds while the copy is in use, and nothing deletes a
copy without both, so a second window never removes a copy in use. The owner
file records the copy's git admin folder when the copy is made; the rewriter's
roots and the cleanup use it only while it is `<common>/worktrees/<name>` and
its `gitdir` names exactly that reserved copy, never the copy's own `.git`.
Codex rewriter turns also lose write access to the temp folders. `Branch vs main` sits in the file
toolbar under the title, with `N files +N -M`, because it decides which files
you see, not what you do to the branch. The file toolbar row holds `N files` (the file jump, also `T`: filter,
arrows, Enter), `N of M viewed`, `Unified | Split` and `Wrap` (on by default,
saved as `goodboy:diff-wrap`; split always wraps). `[` and `]` go to the
previous and next file. Each file has a sticky header (status letter, path,
changes, comment count, `Viewed`, `⋯` with Open in editor, Copy path, Comment
on file); a viewed file collapses, and generated or binary files start
collapsed. Rows are a CSS grid with `role="grid"`, never a table. Click a line
number to comment, drag or shift-click to cover a range; the composer and the
threads sit under the last line of the range. ⌘Enter saves, Escape cancels.
The Diff lens docks `N notes` and `Resolve in Review`, which opens Review on
the same notes; Write review docks `N drafts` and `Submit review`, whose
popover holds the summary and the verdict. Files mount in batches of 20 as the
browser idles, so a large diff stays responsive.

## The Scripts lens

`ScriptsPanel` is one `PaneShell` (`Scripts`, meta `N projects · N running`,
a `Filter scripts` field that `/` focuses and `New script`) over one list
grouped by mount, project plus branch, from `useSessionScripts`. A project
mounted twice is two groups, and its saved scripts show in both; you pick
where a script runs by picking the row in the right group. A group header
collapses it, and the collapsed set is kept per workspace
(`goodboy:scripts-groups-collapsed:v1:<workspaceId>`).

Inside a group, three levels: project (the group header above), then Saved
(when at least one script is saved for that project) or a package, then the
row. When a group holds more than one manifest package (a pnpm, yarn or npm
workspace, or package.json next to composer.json), Saved gets its own titled
`ScriptSavedSection` (eyebrow `Saved N`), sitting above one `ScriptPackageSection`
per package: a `Package` glyph, the name from its manifest, the folder in mono
(root has none), the script count and, when something is running in it, an
info-toned `N running` badge. The root package comes first, then workspace
packages by folder, then composer; the filter matches the package name,
folder and a script's body too. Each package section has its own chevron:
beyond six packages the sections default closed, except the root, one with a
script running or run today, and any section a live filter matches (a filter
always forces its matches open, regardless of the stored state). The closed
or open state a person picks is kept per workspace and per package
(`goodboy:scripts-packages-collapsed:v1:<workspaceId>`). With a single
manifest package, rows stay flat under the project header, as before.

Every row is the same `ScriptRow`: category node, name (its tooltip names the
invocation, e.g. `Runs yarn workspace @northwind/web run dev`), the script's
**body** (`vite --port 3000`, not `yarn run dev`: the invocation is what
made every `dev` row look the same), Source (hidden inside a Saved or package
section, since the header already says it; shown as `Saved`/`package.json`/
`composer.json` only for a flat, single-package list), Last run in glyph and
word, one Run or Stop button and a `⋯` menu (saved: Edit, Duplicate, Delete
with an inline confirm; manifest: Save as script, Copy command, both using
the invocation). "Save as script" from a workspace package writes a command
that still runs in that package once saved at the project root
(`workspaceInvocation`: `yarn workspace <pkg> run <name>`, `pnpm --filter
<pkg> run <name>`, `npm run <name> --workspace <dir>`, `bun run --filter <pkg>
<name>`, `composer run-script <name> -d <dir>`), because a saved script always
runs from the worktree root. Clicking a row opens its output in the
`scriptRun` drawer, and the row whose output is open is selected. New script
and Edit open the same inline `ScriptEditor` card, at the top of the active
mount's group or in place of the edited row. Saved scripts of workspace
projects that are not in the session are named in one line under the groups.
The session sidebar has no scripts section: `$` launches, the Now chip
watches.
