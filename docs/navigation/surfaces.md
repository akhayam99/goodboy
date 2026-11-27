# Surfaces

> **Read this when** you change the app layout: the slots, the places rail, the Desk, a parked drawer, the header actions of a page, or what a surface shows while it loads. **Not for** the drawer's geometry and slot store ([right-drawer.md](right-drawer.md)), the dock grid ([dock-grid.md](dock-grid.md)) or the top bar ([shell.md](shell.md#top-bar)).

## Shell layout

One strip of chrome above, the places rail plus main under it, and no footer.

- **One app layout, and every surface fills its slots.** The board, the session and
  the studios draw no frames of their own. A surface that needs another frame
  changes the shared one (`app/shellArrangement`, read by every shell mount, the
  app and the mock scenes alike).
- **The places rail never changes, and a session adds no column.** Its pages are
  page tabs under the title, inside the content sheet
  ([session-rail.md](session-rail.md#session-page-tabs)). A list or filters that
  belong to a page sit beside the detail as a page rail.
- **The right drawer is context, never navigation**: reference beside the page,
  closing with the pane that opened it.
- **The strip** is one row with no line under it; the content sheet's edge closes
  it. It renders outside the grid, so no resize, animation or overlay moves it.
- **The columns** are one grid at saved widths, clamped when read. `AppShell` takes
  the rail as `leftRail` in an `auto` column sized by the rail itself (64px, 44px
  under a 1100px window), with no handle and no saved width. The grid holds the rail
  and the page, nothing else.
- **The overlay slots sit inside the grid.** A studio draws inside the content
  sheet over the page it replaces (`AppShell`'s `studio`,
  `[data-studio-slot="content"]`), so the places rail stays live and the drawer
  parks under it. The slot is opaque (`bg-background`, `bg-chrome` for a studio that
  draws its own sheets), the page under it stays mounted and inert, and a studio
  never covers the top bar.
- **The pane** is the work: the only surface that scrolls its own body, mounts
  editors and takes a title.

## The right drawer is one slot

The latest open wins, and what it replaced is gone: the head shows no back button for
it. A tool beside a reader stays on screen with it
([right-drawer.md](right-drawer.md)).

### The dock follows the page

- **A session drawer belongs to its session.** While a studio replaces the session,
  the drawer parks, out of sight and out of reach of every close key; Esc, Close or
  Back brings it back with the session.
- A parked drawer stays mounted, hidden and inert (`DrawerColumn` `isParked`), out
  of the flow, with no exit and no width change, so a draft, a scroll or a running
  terminal survives. The session under the page widens while it is parked.
- **Terminal and Browser belong to the session they were opened in, or to the
  Board**: docked across every move inside it and beside every page but their own;
  leaving parks them until you come back (`keptTool`, `dockAfterPlace`,
  `selectDrawerPanel`). Under their own page they stay in the store but are not
  mounted (`useShellRight`), so no shortcut answers twice.
- At a narrow width the dock floats over the page: the page slot is its own layer
  (`data-studio-host`, `isolate`), so the dock and its scrim paint above it.
- On Tasks, Chat and Workflows the page's panel and the dock open together, ordered
  content, page panel, rail, dock: `AppShell` hands the dock down through
  `ShellDockContext` (`isDockInStudio` from `useShellRight`), and the page's
  `DrawerColumn` puts its panel in the `detail` slot; below the push width both lie
  over the page with a scrim.
- Close keys read `selectDrawerPanel`, null under a studio unless a workspace tool
  shows beside it, and the history entry keeps the drawer. A workspace switch
  empties the slot.
- Esc, the list keys and the Scripts run and stop keys are suspended inside a parked
  drawer (`useIsDrawerParked`), so a hidden list never moves or runs a script. After
  the trip the drawer's inner step (a plan in Ask) answers first again.
- A drawer's own key (⌘⌥S) on a page leaves it and every page stacked under it and
  shows that drawer; it never closes a parked one, and an overlay drawer takes focus
  back.

### Closing the top of the slot

- **Esc in the session** closes the top of the slot, then the drawer from the chip,
  before the page goes up ([session-rail.md](session-rail.md#esc-is-one-ladder)). It
  never changes Overview and Desk.
- ⌘⇧W (Ctrl+F4 off macOS, File › Close the panel) closes the top of the slot from
  anywhere, a focused terminal or web page included; an open menu or dialog takes it
  first, and a parked drawer is never closed.
- The right rail shows the slot: the tool in the slot is pressed, the one in the chip
  waiting ([session-tools.md](session-tools.md#tool-states)).

## The tools build the Desk

A tool is what the Desk draws with content: a grid cell, a detail of the tool kind
(Scripts), or the session's Ask; readers do not count (`deskToolsOf`). The Desk is a
frame of the same solver: `DeskBody` draws a `DockLane` beside its column and
`dockLayoutOf` lays the tools in it with `isDesk`, while the head, the tabs and the
right rail stay the session's.

- **No switch and no key.** A tool opened on the Overview, from the rail or its key,
  splits the page (`useDeskFollowsTools`).
- **Entering again** reopens the tools the session had (`landingOf`, the entry rule
  every door asks); with none, the whole Overview.
- **Bring it here.** A door that brings the Desk with nothing kept opens a tool at
  once, in order: the tools of the first move of Next, the agent of Now, the first
  project's terminal, the workspace folder's terminal. It only picks a tool the Desk
  can draw (`DESK_OPENS`, today the terminal), after the saved grid is read; a Desk
  saved with no tool comes back as the Overview with no line (`useDeskLanding`).
- **Closing the last tool** (its X, ⌘⇧W or ⌘W) closes the Desk: the Overview returns
  with **Desk closed** and **Reopen** in the banner under the head, focus on Reopen,
  history unchanged. Reopen brings the tools back as they were.

### One window holds the Desk

One window holds a session's Desk (`desk_hold`, `window_heartbeat.rs`), read from
the live windows only: a closed window, or one whose heartbeat stopped, frees it.

- Another window on the session stays on the Overview with **Desk open in another
  window** and **Bring it here**, and a tool opened there says the same instead of
  splitting the page.
- The window that loses it returns to the Overview with **Desk moved to another
  window** and **Bring the Desk back**, written in the page, not a toast, its shells
  still running.
- A holder change goes to every window as `desk-holder`, and a window showing one of
  these lines asks again every 5 seconds.

## The places rail

The places rail (`app/components/ShellLeft/`, on `ShellRail`) is on every screen
with a workspace, the same shape everywhere; before a workspace exists it keeps only
its foot ([shell.md](shell.md#the-rail-foot)).

1. **The workspace mark** (`WorkspaceIdentityRow`): the tile with the name under it.
   ⌘O or a click opens the switcher right of the rail (`SHELL_RAIL_POPOVER`, 12px
   inside the window); ⌘1 to ⌘9 switch without it.
2. **New** (⌘N, an outlined tile; a dot and `New session, draft in progress` while a
   draft waits).
3. **Board** (⌘⇧H), Tasks, Workflows, Chat, Connect and Impact, Impact quiet and last.
4. At the foot Settings (⌘,), the bug and the Goodboy signature.

Each item is an 18px icon with one word under it. Connections reads Connect, its
full name kept as accessible name and tooltip. Monitoring has no item (`home:
'menu'` in `destinations.ts`).

- **The mark's count** is the number of sessions that need you in other
  workspaces, amber, or red when one is broken; a dot says another workspace had
  activity. While a switch loads the word names the target and the mark is busy; a
  failed switch keeps your workspace and says `Couldn't open {name}.` with **Retry**.
- **One lit item**, from the column place through `railPlaceOf`: a session keeps the
  Board lit, a page lights its own. A current item does nothing, except the Board lit
  under a session, which goes to the Board (`canReselect` on `ShellRailItem`).
- **Two marks** (`useDoorSignals`, chosen by `railMarkOf`): the needs-you count on
  the Board, as a warning count, and a dot on Tasks for new tasks. The reasons go in
  the accessible name: "Board, 2 sessions need you: Checks failing, 1 question for
  you" (`doorSignalOf`). Running terminals and browser tabs count on the right rail.
- **One count of sessions that need you.** The Board count reads
  `useNowSessions().attention`, `useWorkspaceAttention` over every session of the
  workspace, whatever the project filter. The Now chip does not show it; the
  Sessions control carries a dot. The palette's Needs you rows and the screen reader
  line read the same sessions (`useNowSessions().needsYou`), longest waiting first.
- While Monitoring is closed, `useMonitoringSignalRefresh` rescans only the pinned,
  learned and Goodboy-run ports every 30 seconds (`monitor_snapshot` with a port
  list, merged into the snapshot), only with the window visible and the snapshot
  over 15 seconds old, never beside another scan.
- **Width.** Under a 1100px window the rail drops to 44px icons, words in the
  tooltips. It never folds, resizes or saves a width, and no key or page folds it.
  An older build's sidebar keys are listed in
  [versioning.md](../versioning.md#retired-state).

## Header actions

One grammar draws every page and drawer header's actions (`HeaderActions`):
secondary controls, at most one secondary button, at most one filled primary, then
the overflow `...`, all 28 tall, the last on the column edge. No actions, no `...`.

| Header           | Reads                                                                                                                        |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Session overview | the overflow only (Refresh, Pin session, Archive session, Delete session...)                                                 |
| Agent page       | Interrupt, Close or Reopen as one ghost button with its word (into the overflow below 560px); `Delete agent` in the overflow |
| Artifact         | `[Details] [secondary] [primary] [...]`; Details opens the artifact drawer on its last tab                                   |
| Branch           | `[Abort rebase] [one primary] [...]`                                                                                         |
| Plan drawer      | `[Edit] [Approve] [...]`                                                                                                     |
| Scripts          | `[search] [New script]`                                                                                                      |

- Delete session... opens its confirm beside the overflow trigger without moving the
  page; Escape or Cancel returns focus to the overflow.
- While a push confirm or any action confirm is open on a branch, the primary turns
  secondary so the confirm holds the one filled button.
- Approve on a plan reads Approving until it resolves, then closes the drawer on any
  page with one toast; a plan whose run was approved reads Approved with no primary
  until the run starts the step.

### Run pages

The preset run level and the orchestrated document hold one primary
(`runHeaderPrimaryOf`), first match wins: **Answer** for an open question, **Raise
limit** at the limit, the verb of `runPrimaryOf` (**Review plan**, **Approve and
continue**, **Continue**, **Retry**, **Decide next step**, **Start step 2**, **Start
run**, **Restore**), else **Pause run** or, once paused, **Continue** in the same
place (`RunLiveVerbs`, the `workflowRun` registry's own `when`).

- The tail says the state and keeps only its own step verbs.
- The `⋯` follows See, Steer, Settings, Copy, End: View diff, Skip step N (and Pause
  or Continue while the header holds another primary), Step routing (orchestrated),
  Save as preset, Copy run summary, **Stop run** (asks first), Archive run, Delete
  run, never the approve button.
- A failed Pause, Continue or Stop leaves the run as it was, reports the error and
  keeps the word, so pressing again is the retry.
- The title is the page's only h1. The head's back button (`Back to Runs`), its
  crumbs or Esc go back to the list, and no other chevron does.

## Loading

**A number that has not loaded is a skeleton, never 0.**

- The Browser count on the rail (`selectBrowserTabCount` is `null` until the tab rows
  land) and the hover card's agent count and cost (`useSessionSummary` returns `null`
  and `isCountsLoading` until the phase runs and telemetry is in) draw a skeleton
  labelled Loading.
- The palette (`PaletteSkeleton`), a lazy studio (`StudioSkeleton`) and the artifact
  viewer in the reading drawer (`ArtifactSkeleton`) show their shape while their
  chunk loads.
- The router keeps `fallback={null}` only around the onboarding wizard, which draws
  nothing when not needed.
