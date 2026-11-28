# Studios

> **Read this when** you add or change a studio (Tasks, Chat, Workflows, Notifications, the Guide), its band, its page rail or a record page. **Not for** Settings ([settings.md](settings.md)), the Terminal page ([terminal.md](terminal.md)) or studio trails ([trails.md](trails.md)).

Every studio (Tasks, Chat, Workflows, Terminal, Impact, Notifications, Settings,
Changelog, the guide, Add workspace) is a page in the one main slot, drawn inside
the content sheet over the page it replaces.

- The page under it stays mounted and inert, and every session drawer parks until
  the studio closes ([surfaces.md](surfaces.md#the-dock-follows-the-page)). The
  places rail stays live beside it (`App.tsx` supplies `AppShell.leftRail`).
- One studio is open at a time. Studios are not part of the breadcrumb IA.
- There is no Close button. A door page leaves by another door, Back or Esc; an
  app page (Settings, Help, New workspace) shows `Back to app` with the Esc chip
  at the top left of its band (`StudioBackButton`, `close: 'back'` in
  `studioMeta.ts`).
- On close, `StudioFrame` gives focus back to what opened the studio, or to its
  door when that is gone (Search or run), unless focus already sits outside the
  studio (`restoreStudioOpener`).
- On Workspaces, which has no column, the app studios take the whole window: Settings
  (its corner gear, ⌘, or ⌘/ for shortcuts) and the guide. Search or run opens
  there too.

## History and frame

- **An open studio is a history entry.** Opening a studio, or switching to
  another, pushes an entry over the page underneath (`openStudio`). Reopening the
  same studio, a Settings scope change and the Tasks' provider and record amend it
  (`amendStudio`), so Back from Workflows reopens Tasks with its record. Close and
  Esc fold every studio entry stacked on the same page into that page
  (`closeStudio`): closing ends the side trip, Back is one step.
- **Navigating closes the studio.** A forward move to a place (another session, a
  lens, an agent, the board) arrives with no studio, from Search or run, a
  needs-you row, a shortcut or a link inside the studio. Switching workspace, a
  session key (⌃Tab, ⌥⌘↓, ⌘⇧[) and any column row close it too.
- **One frame for every studio.** `StudioFrame` (`app/components/StudioFrame`)
  mounts only while a studio is open and stays mounted across switches. It owns
  the 40px band, the Esc layer and the motion: `studio-in` on open, `studio-out`
  on close, and on a switch only the band's name fades while the new body enters
  in 160ms. With no studio open, no frame node exists.
- A studio body still renders `StudioShell`, which hands its chrome to the band.
  Until a body's chunk arrives, the frame shows the opaque skeleton of that page
  (`STUDIO_META[kind].skeleton`, through `PageSkeleton`): `rows` (Tasks, Work,
  Workflows, Monitoring, Notifications, Settings, Add workspace), `prose` (the
  guide, What's new), `room` (Chat), `terminal` and `cards` (Impact), plus a rail
  skeleton where the page has a rail.

### The band holds no title

`StudioBand` never draws a crumb title, an icon or a subtitle; the page `h1` is
the one title. `STUDIO_META[kind].close` places the exit:

| `close` | Studios                                                             | Band                                                         |
| ------- | ------------------------------------------------------------------- | ------------------------------------------------------------ |
| `none`  | Tasks, Chat, Workflows, Terminal, Impact, Monitoring, Notifications | none; the door or Escape leaves                              |
| `back`  | Settings, Help, Add workspace                                       | 40px, only `Back to app` and the Esc chip, in a `PageColumn` |

- A band also appears when the body claims it with a `StudioTrail` or passes a
  header accessory. While a band shows, the frame hands its body
  `UnderTrailContext`, so the title adds no 8px; a bandless page sits on the 8px
  header inset (`frameGeometryOf`), like a session page.
- The provider wraps the body whether or not the band is drawn, so a trail that
  claims the band never remounts the page (Tasks Open lost its record that way).
- The frame root carries `data-studio-title` for the journey tests.
- Each studio has one `h1` in the 32px title row (`PaneTitleRow`, fixed `h-8`,
  actions at its right, a long title truncates): Tasks the view's name;
  Workflows with its tab strip under it and `New workflow` as the one primary at
  the end of the tab row; Impact with the period selector in the row and a meta
  line under it; Help and Notifications through `PaneShell`; the Chat thread's
  title (`ChatHeader`). Exactly one `h1` per studio scene.

## One Esc stack

The frame, a body that holds Esc (Tasks with a record open), the agent overlay and
the delete confirm all register with `useEscapeLayer`, so Esc closes the topmost
layer only.

- Every popover built on `useDropdown` (`AnchoredPopover`, the pickers, the bell)
  holds a layer while open, so Esc inside a studio closes the popover, keeps the
  studio and gives focus back to the trigger. The image lightbox, a history drag,
  the quick actions popover and the artifact page's back-to-list Esc register the
  same way.
- A later layer sits above an earlier one. A layer inside a parked drawer is
  suspended while the studio is open and keeps its place.
- A focused field may claim Esc first with `preventDefault`, and the stack leaves
  it alone.
- `useKeepFullScreenOnEscape` is the one raw Esc listener left, because it must
  see the key when no layer is open ([shortcuts.md](shortcuts.md)).
- `__tests__/regressions/escape-and-keys-use-the-stack.test.ts` counts `'Escape'`
  literals and window key listeners per file and fails on growth.

## Notifications

**Not every studio earns a door.** Notifications opens from the bell popover's
footer (Open all notifications, a door: `door: true`) and from Go to in Search or
run, never from the column, since the bell shows the unread count. While it is
open the bell is its one lit control (read from the column place through
`AppTopBar`), and the page has no exit control. The popover never deletes
history: that lives in the studio, behind its confirm.

### One row, two densities

`NotificationRow` draws a group in the popover (`compact`, one line, eight rows at
most, Unread or All) and in the studio (`cozy`, opens in place with the body, the
older members and Report this error).

- **Reading.** Opening the popover marks nothing. A row is read once it has been
  on screen for one second with the popover open (`useSeenNotifications`, one
  timer per row, cleared when the row, the popover or the window visibility goes; a hidden
  document restarts the second when it is visible again),
  so a row beyond the eight stays unread. The ghost `Mark all as read` (only while
  something is unread) clears the rest.
- **Severity** leads on the quiet node alone (`NotificationSeverityNode`,
  `WorkNode look="quiet"`): error on the solid danger node, warning on the solid
  amber one, success a bare check, info a neutral node with its glyph. Unread is
  the title weight (500 in foreground), read rows recede, and there is no second
  dot. The age is the `ActivityMeta` time column.
- **Studio row controls.** A fixed fourth column holds the hover controls
  (`NotificationRowActions`): Mark as read and the `⋯` of the `notification` kind
  (Open, Mark as read or unread, Report this error, Copy text, Delete), also on
  right click. They never change the row's width. The opened row keeps only the
  notification's own action (Retry) as a button. A failed write shows "Couldn't
  finish that" and leaves the row as it was (`runVerb`).

### Scope and facets

- The facets (view, severity, source and, with several workspaces, the workspace
  scope) are a page rail beside the list (`StudioRailLayout`, `placement="page"`,
  surface `notifications`, 288px), with counts from SQL (`countNotifications`), so
  they stay true past the loaded page. The unread count, here and on the bell,
  is one owner (`notificationBadgeOf`): unread errors and warnings. A count shows from two; a zero facet is
  dimmed. The rail holds no key legend: the keys are in the tooltips and the Keyboard
  chapter of the Guide.
- Both surfaces default to this workspace: a row belongs to its workspace, or its
  session's, and a row with neither shows in every workspace. Mark all as read and
  Delete all act on that scope.
- A scope switch keeps the shown list until the new one is read, then changes
  scope, list and counts in one write (`setNotificationScope`). A failed read keeps
  all three and logs "Couldn't load notifications" with Retry, and of two quick
  switches the last wins. A refresh asked during a switch waits, then reads the
  scope it left, so opening the studio never cancels the pick. Once a scope is shown, its failed-switch row is deleted, so a Retry never stays
  behind in Needs action. The
  bell's Unread view keeps its snapshot until the scope changes.
- Older pages load with a cursor. No subtitle, no day group counts, and the title
  is Notifications in every view.

### Header and keys

- `NotificationsHeaderActions`: the shared `FilterButton` only while the rail is
  folded, the ghost `Mark all as read`, then the `⋯` of the `notifications` kind
  (Mark all as read, naming the scope, and Delete all).
- Delete all opens a `ConfirmPopover` anchored to the `⋯`, titled with the count
  ("Delete 7 notifications?") and naming the workspace or "every workspace".
- The meta reads "6 notifications · 4 unread".
- A row's Delete acts at once with "Notification deleted" and Undo
  (`dismissNotificationGroup` re-inserts through `insertNotification`; ⌘Z too).
- Rows group by day (Today, Yesterday, This week, Older). J and K or the arrows
  move, Enter runs the row's action and E deletes. The cursor never marks a row
  read: a group is read when it opens or from its own Mark as read.
- The rail rows (`packages/ui` `FacetRail`), the list keys
  (`shared/hooks/useListKeys`) and the day grouping (`shared/utils/groupByDay`)
  are shared primitives.

## Tasks

Tasks uses the rows and the list keys, but no day grouping and no rail.

- Its facets (source, show, type, project) sit in one Filter menu of the tool
  row, after the search and the For you and All switch and before `Group by:
Source`. `⋯` in the title row holds Refresh and Manage tools (the `taskList`
  kind).
- Its rows are one `ListGrid` with a group per source, status or project
  (`taskGroupsOf`), the total on the label (`taskGroupTotalsOf`, starred rows
  included), five rows each until Show all; each group is its own listbox.
- Tasks opens with a quiet cursor on its first row (`data-cursor`,
  `aria-selected="false"`) and no pane, so nothing opens by itself. A click, Enter
  or a record asked for on open (`initialRecordKey`) opens the pane
  (`aria-selected="true"`, `bg-selected`).

| Key    | Does                                                                                     |
| ------ | ---------------------------------------------------------------------------------------- |
| J, K   | move the cursor; the record follows only once one is open                                |
| Enter  | on the shown row, the launch popover (⌘↵ in the panel launches), or the linked session   |
| O      | the record in its tool                                                                   |
| R      | the record with its reply box focused, when it has one (`recordCanReply`)                |
| S      | star or unstar                                                                           |
| /      | the search; Escape leaves the field                                                      |
| Escape | closes the pane or the full page and keeps the cursor; a second Escape closes the studio |

## Page rails

- **A list that belongs to the page sits in the page.** Chat's chats,
  Changelog's releases, the guide's chapters and the Tasks and Notifications
  filters are content beside their detail: `StudioRailLayout` with
  `placement="page"` draws the list on the page background with the resize edge
  as the only line. Every page rail opens at 288px (`standard`). A narrow list
  beside a detail is not two sidebars: the app never puts a panel on each side of
  the content.
- **A page rail folds.** With `onCollapsedChange` the rail's first row starts
  with "Hide <rail name>" (⌥⌘B). A folded rail leaves a 44px strip with "Show
  <rail name>" at the same x, plus any `foldedActions`. `useStudioRailFold`
  remembers the choice per surface (`goodboy:studio-rail-folded:<studio>:v1`).
- **It folds itself when there is no room.** `StudioRailLayout` measures its root
  and publishes the width per surface (`studioRailPaneStore`). Under 880px of page
  every list folds without saving; Show opens it over the page
  (`data-rail-over-page`, Esc or Hide folds it, nothing saved), and it docks again
  once there is room. A rail portaled out of its page (the Agents rail of a run,
  the file list of Changes) passes the page as `pane` with `hasPageOutside`.
- A folded rail leaves the `FilterButton` (28px, the count of active filters) in
  the title row, opening the same facets in a popover; docking again is the Show
  strip or ⌥⌘B, never a header button. Tasks' search moves into the title row too.
- **⌥⌘B** (`innerColumn.toggle`) folds the inner column of the page you are on:
  each foldable column registers with `useInnerColumn` while its page shows, and
  the key toggles the last one (`innerColumnStore.toggleCurrent`). Search or run
  lists it by the column's name (Hide chat list, Show session pages); on a page
  with none, the key does nothing.
- **Every studio list resizes** (`StudioRailLayout` in Settings, Guide, Chat,
  Changelog, Bitbucket, Tasks, Notifications) from its right edge between 220 and
  420px (a page may pass `min` and `max`), 8px per arrow key (32 with Shift), back
  to its default (256 narrow, 288 standard) on a double click. Each studio keeps
  its width (`goodboy:studio-rail-width:<studio>:v1`), and the skeleton opens at
  it. `useResizableWidth` (`@goodboy/ui`) owns read, clamp and save for these
  rails and the drawer: during a drag the width lives in a CSS variable, so
  nothing renders or saves until the drag ends.

## Records

- **Disconnecting is scoped.** An integration studio disconnects from its own
  header, which clears the workspace credential, never a system-level session. A
  workspace on the system `gh` CLI has nothing to clear, so it offers no
  disconnect and points to `gh auth logout`. The control reads credential state
  alone, not the git remote, so a leftover scoped key on a non-GitHub workspace
  can still be cleared.
- **A code-host record keeps its verbs outside a session.** A GitLab merge request
  from Tasks approves, merges, closes and reopens through the workspace's GitLab
  host. A Bitbucket pull request shows its verbs blocked with the reason until
  Goodboy resolved it for a session. A GitHub pull request opens read only, with
  Start from #318 as the primary (Review pull request when your review is
  requested) and Open in GitHub for the rest. Merge and every destructive verb ask
  first. The mount reads through the workspace's first repo project, so a
  workspace with none stops at an empty state.

### The record header

`RecordHeader` puts the tool glyph, the identifier and the state on the identity
line, with Open in the tool, the `⋯` and, in Tasks, close at its end.

- Under the title, one action row: one primary (Start session, Review pull
  request, or Open session once linked) and at most two tool verbs by state.
- Before a session is linked, Tasks adds Link to a session under the properties
  (`RecordFrame.link`), a searchable list of the workspace's sessions.
- `⋯` in a fixed order: rare tool verbs, Refresh, Copy link, Unlink, then
  destructive verbs after a separator.
- Editable properties change from the control that shows them (the Jira state
  opens its transitions).
- Start has one verb and the result follows the record (`startFromRecord`): an
  issue or an error opens the New session draft with the issue picked and its
  brief being written; a pull request waiting on you starts a PR reviewer on the
  Conversation tab; a Slack thread, a merge request, a Bitbucket pull request or a
  pull request of yours opens a popover with the goal and the brief. Enter from the
  Tasks list does the same, or opens the linked session.

### The record body

- Facts sit as pills in fixed slots (person, weight, place, labels, measure,
  links, time), the field name in the tooltip and time as a relative age with the
  date in the tooltip. A missing fact leaves no pill.
- One scroll with no tabs: Description (ten lines, then Show more), the tool's own
  sections closed behind a one-line summary (Checks, Changes and Approvals on merge
  and pull requests, Stack trace open and Breadcrumbs on Sentry), then
  Conversation with its count. `RecordSections` owns the order, the fact
  registries in `shared/detail-fields` own the slots. A changed file opens its diff
  in a full-screen dialog.
- **Conversation** is `shared/components/Conversation`: messages without cards,
  replies under a neutral rail (the last three open, the rest behind Show earlier
  replies), a code anchor chip on review threads, a resolved thread folded into
  one row. Each tool has a pure adapter next to its client that turns its comments
  into threads and declares what it can do: Reply where it has threads, Quote where
  it is flat (mentioning the author on GitHub), Resolve only where it resolves,
  reactions only on Slack.
- The composer sits in the drawer's dock, only when the tool lets Goodboy write.
  Reply (or `r` on a focused message) puts a Replying to bar above it, Escape
  clears it, ⌘↵ sends. A sent message shows Sending in place; a refused one stays
  with its text, Retry, Copy text and Discard.

## Tests

- `regressions/studio-rail-folds.test.tsx` renders Chat, Terminal, the Guide, the
  changelog, Settings, Notifications and the file list of Changes at 800px and
  expects each Show button.
