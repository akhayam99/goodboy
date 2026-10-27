# Studios

> **Read this when** you add or change a studio: a place of its own such as Workflows, Settings or the Guide. **Not for** spacing, scroll and overlay mechanics ([styling.md](../styling.md)) or design intent and tone ([DESIGN.md](../../DESIGN.md)). The other pages are listed in [navigation.md](../navigation.md).

## Studios

Utility studios (Tasks, Chat, Workflows, Terminal, Impact, Notifications, Changelog,
the guide, Add workspace) render in the shell's studio slot, which
covers the content area only, beside the column, as its own sheet; the page
title is its one header (no title band). The column stays live, so another door or a session row is
one click away. **Settings is the one studio that takes the column**, in
both sidebar states: `shellArrangement` takes `isSettingsOpen` and returns
`leftSlot: 'column'` with no peek, so a folded sidebar shows the column at its
saved width while Settings is open and the rail returns when it closes. The
stored collapse is never written (`leftSidebarCollapsed` reports it as it is,
`isLeftRail` says what is drawn), and ⌘B waits. The column's content
cross-fades (160ms) to `‹ Back to app` (with its Esc hint), `Search settings`
and the settings groups, on the chrome like the sessions list, and the page
fills the content area as the one sheet. There is no band, no crumb and no
second sheet: `StudioFrame` draws no band (`hasBand={false}`), `SettingsStudio`
draws no `StudioTrail` and no `StudioRailLayout`, and the page's title row sits
where Overview's does (`UnderTrailContext` drops the 12px a bare page adds, and
the 40px a band would take is the top padding). There is no Close: Back to app,
Esc and Back land alike. A session key (⌃Tab, ⌥⌘↓, ⌘⇧[) is a forward move and
closes Settings on its way. On close, `StudioFrame` gives focus back to what
opened the studio, or to the studio's door when that is gone (the palette),
unless focus already sits outside the studio (`restoreStudioOpener`). The
exception is Home, which has no column to give. On Home, New workspace swaps
the list for the form in place, and the app studios take the whole window:
Settings (its corner gear, ⌘, or ⌘/ for shortcuts) and the guide. The palette
opens there too.
Studios are not part of the breadcrumb IA. They exit on close or Esc, and only
one is open at a time.

- **An open studio is a history entry.** Opening a studio, or switching from
  one studio to another, pushes an entry over the page underneath
  (`openStudio`). Reopening the same studio, a Settings scope change and the
  Tasks' provider and record update that entry (`amendStudio`). Back from
  Workflows reopens Tasks with its record. Close and Esc fold every studio
  entry stacked on the same page into that page (`closeStudio`): closing means
  the side trip is over, Back means one step.
- **Navigating closes the studio.** A forward move to a place (another
  session, a lens, an agent, the board) arrives with no studio, whether it came
  from the palette, a needs-you row, a shortcut or a link inside the studio, so
  the destination always lands in front. Switching workspace closes it too.
- **One frame for every studio.** `StudioFrame` (`app/components/StudioFrame`)
  mounts only while a studio is open and stays mounted from Tasks to Workflows
  to Settings. It owns the 40px band (the studio's icon and name, the body's
  subtitle, Close; Settings in the default shell has no band at all,
  so `hasBand` is off and its skeleton has no rail), the Esc layer and the motion: `studio-in` when
  it opens, `studio-out` when it closes, and on a switch only the band's name
  fades while the new body enters in 160ms. A studio body still renders
  `StudioShell`; inside the frame it only hands its chrome to the band. Until a
  body's chunk arrives, the frame shows the opaque skeleton of that page
  (`STUDIO_META[kind].skeleton`, drawn through `PageSkeleton` on the page's header
  inset and measure): `rows` (Tasks, Workflows, Monitoring, Notifications, Settings,
  Add workspace), `prose` (the guide, What's new), `room` (Chat), `terminal` and
  `cards` (Impact), with a rail skeleton where the page has a rail. With no
  studio open, no frame node exists, so nothing covers the page.
- **One title per page; the band holds no title.** `StudioBand` never draws a
  crumb title, an icon or a subtitle; the page `h1` is the one title.
  `STUDIO_META[kind].close` places Close: `none` for the sidebar door pages
  (Tasks, Chat, Workflows, Terminal, Impact, Monitoring: no band, no Close, the
  top bar Back and Escape leave them), `header` for Notifications, the guide and
  What's new (`StudioFrame` passes Close through `PaneActionsContext`, so it is the last
  action of the page title row, and the band holds it only until a page header
  claims it), `band` for the rest (Settings over the window, Add workspace),
  whose 40px band holds only Close
  inside a `PageColumn` of the studio's tier. A band also appears when the body
  claims it with a `StudioTrail` or passes a header accessory. While it draws a
  band, the frame hands its body `UnderTrailContext`, so a studio title does not
  add the 12px a bare page adds; a bandless page sits on the 12px header inset
  (`frameGeometryOf`), like a session page. The provider wraps the body whether
  or not the band is drawn, only its value changes: a trail that claims the
  band must not remount the page that drew it (Tasks Open full lost its record
  that way). The frame root carries
  `data-studio-title` for the journey tests.
- **Every studio draws the grid's title row.** Each studio has one
  `h1` in the same 32px row as every page (`PaneTitleRow`, fixed `h-8`, the actions
  at its right, a long title truncates and never wraps the row): Tasks the view's name,
  Workflows `Workflows` with its tab strip under the title and `New workflow` as the
  one primary at the right end of the tab row, Impact `Impact` with the period selector in the row and a meta line
  under it (the band keeps the crumb and Close only), the guide `Guide`, What's new and
  Notifications through `PaneShell`, and the Chat thread's title as the same `h1`
  (`ChatHeader`). Exactly one `h1` per studio scene.
- **One Terminal studio for every terminal.** The Terminal door (⌃`, `terminal.studio`)
opens `StudioPlace` `{ kind: 'terminal'; terminalId; sessionId; worktree }`in`TerminalStudio`:
`StudioShell`plus`StudioRailLayout surface="terminal"`. The rail does not fold, and its first
child is `New terminal`, a split secondary control: the button opens a tab in the selected
worktree, the chevron opens the picker. The picker (`NewTerminalMenu`, `terminalPickerClusters`)
opens to the right of the chevron (`useDropdown` `side: 'right'`) in clusters: `Workspace folder`first, then one cluster per session with attached worktrees, headed by the session title alone
(issue chips and diff stat stay off this page, cut C3); a row is the project, the branch, the short
worktree chip and the path on one line, and`Open project`opens the project settings. The
`Workspace folder` row is named by the folder (`harborline`), since the cluster title says the
rest; a worktree path keeps its project folder and its `gb-` folder whole (`pathTail`), and the
head of the path truncates first.
With no terminal at all the page has no rail: the empty state owns the single`New terminal`.
The rail is one `ListGrid`named`Terminals`with one`ListGridGroup`per session that has
terminals: the session title, a visible arrow button (`Open session`) beside it and the number of terminals in
the last column; the`Workspace folder` group comes last and has no action. Inside a group, one
28px row per worktree (`terminalWorktrees.ts`, key `<sessionId>#m:<mountId>`, or `#p:<cwd>`when
no mount matches) on the shared columns: branch or folder icon, project and branch, the first
port (hidden on the selected row, whose ports sit at the tab strip's right edge) and a running
dot while a shell runs a process; the folder path and every port live in the row tooltip, never
on screen (`TerminalWorktreeRow`). Selecting a row shows its terminals as tabs
(`TerminalTabStrip`) with a `+`that adds a tab in that worktree. There is no terminal header:
the tab strip's right end carries `TerminalStripActions`, a `⋯`with`Open session`and`Copy worktree path`(or`Copy folder path`) from the `terminalTab` kind of the action registry, a single word when only one applies. A new terminal is
always a tab of its worktree, titled`shell`, then `shell 2` (`nextTerminalTitle`); a tab is
renamed by double click, Enter saves, Esc cancels. When the shell exits, whatever the code, the
tab closes and the studio selects a neighbour of the same worktree: the watch lives in the
terminal slice (`watchTerminalExits`, started by `reattachTerminalTabs`), so it works with the
page closed. Only a terminal that failed to start stays, as a `failed`chip with a restart
button, and it is never opened again on its own. The close x is 28px, always visible: an idle
shell closes at once, a busy one asks in a`ConfirmPopover` (`Keep`, danger `Close`). The detail
is a location row (the cwd trimmed to the workspace folder, middle truncated, and the `cd`menu, only while the shell is idle), the tab strip, then the shell. A terminal id is`<sessionId>::t<n>`for a session and`ws:<workspaceId>::t<n>` for the workspace
(`terminalOwner.ts`). A session has no Terminal page of its own: the session terminal lens is
gone, and a saved location that still names it lands on the session overview
(`withoutRemovedPages`). `⌘T` (`terminal.newTab`) adds a tab to the selected worktree while one
has focus. ⌘K has `Terminal` (`goto:terminal`), `New terminal` (`action:new-terminal`, the
workspace folder) and, in a session with worktrees, `Open <repo · branch> in terminal`
(`session.openWorktreeTerminal`, one choice per worktree).
- **A session terminal opens in a right drawer.** `openSessionTerminal` adds a session terminal at
  the worktree (or reuses a running one there, never when it carries a `prefill`) and opens the `terminal` drawer over the session
  (`DrawerContent` `{ kind: 'terminal'; payload: { terminalId } }`, `TerminalDrawer` in
  `DrawerHost`, side sizing, resizable like the others). **Run in terminal** (the command tool card and a shell block in a message,
  `useRunInTerminal`) is that same path with a `prefill` from `typedCommandOf`: one line as typed,
  several lines as one bracketed paste, every control character dropped, no line end. It never
  presses Enter; the session must be live, so an archived session hides the verb. The mount row and diff `Open terminal`,
  the rebase banners (`openMountTerminal`), the session row menu, ⌘K `Open <repo · branch> in
terminal` and `⌘⌥T` (`session.terminal`, toggles the drawer on the active worktree) all go
  through it. The header holds the project name, the short worktree chip (it truncates before the
  buttons), two icon buttons (`Open on Terminal page` and `Close`, the text in the tooltip and the
  `aria-label`) and the same tab strip as the page: drawer and page show the same tabs of the same
  worktree. Closing the drawer never kills the shell: the tabs stay in the Terminal list under the
  session's group, and the drawer closes by itself when its worktree has no terminal left.
  `Open on Terminal page` closes the drawer and selects the same tab on the page; the pane
  remounts on the same pty and replays its scrollback. The page group title is the session title,
  cut at the end, never in the middle; the group's `aria-label` keeps the full
  title.
- **One Esc stack.** The frame, a body that holds Esc (Tasks with a record
  open), the agent overlay and the delete confirm all register with
  `useEscapeLayer`, so Esc closes the topmost layer only. So does every
  popover built on `useDropdown` (`AnchoredPopover`, the pickers, the bell):
  it holds a layer while open, so Esc inside a studio closes the popover and
  the studio stays, and it gives focus back to its trigger. The image
  lightbox, the sidebar peek, a history drag, the quick actions popover and the
  artifact page's back-to-list Esc register the same way. A layer registered
  later sits above one registered earlier. A key handler on a focused field may
  claim Esc first with `preventDefault`, and the stack then leaves it alone.
  `useKeepFullScreenOnEscape` is the one raw Esc listener left, because it must
  see the key when no layer is open. A ratchet
  (`__tests__/regressions/escape-and-keys-use-the-stack.test.ts`) counts
  `'Escape'` literals and window key listeners per file and fails on growth.

- **Not every studio earns a door.** Notifications opens from the bell
  popover (its footer's Open all notifications) and from the palette's Go to
  group, never from the column, since the bell already shows the unread count.
  The popover never deletes history. That lives in the studio, behind its
  confirm. Reporting a bug is not a studio: it is the report sheet above.
- **Notifications have one row and one scope.** `NotificationRow` draws a
  group in the popover (`compact`, one line, eight rows at most, Unread or
  All) and in the studio (`cozy`, opens in place with the body, the older
  members and Report this). Opening the popover marks nothing: a row is read once
  it has been on screen for one second with the popover open
  (`useSeenNotifications`, one timer per row, cleared when the row, the
  popover or the window visibility goes: a hidden document restarts every second
  when it is visible again), so a row beyond the eight shown stays unread, and the header's
  ghost `Mark all read` (only while something is unread) is the explicit way to
  clear the rest. Both lead with the severity glyph alone: unread is
  the title weight (500 in foreground), read rows recede, and no second leading
  dot. In the studio the time owns the third column and a fixed fourth column
  holds the hover controls (`NotificationRowActions`): the registry's hover
  action (Mark read, one click) and the `⋯` menu of the `notification` kind
  (Open, Mark read or unread, Report this, Copy text, Delete), also opened by
  right click. They show on hover and keyboard focus, never change the row's
  width, and the opened row keeps only the notification's own action (Retry) as
  a button under it. A failed write shows a "Couldn't finish that" toast and
  leaves the row as it was (`runVerb`). The facets (view, severity,
  source and, with more than one workspace, the workspace scope) are a page rail docked beside the list, in
  Chat's frame (`StudioRailLayout`, `placement="page"`, surface `notifications`,
  288px), with counts that come from SQL (`countNotifications`), so they stay
  true past the loaded page; a facet count shows from two, a zero facet is dimmed
  with no number. The rail holds no key legend: the keys are in the tooltips and
  the Keyboard chapter of the Guide. Load older pages with a cursor. The page has
  no subtitle and the day groups no count. The title is
  Notifications whichever view is picked. Both surfaces default to this workspace: a row belongs to
  its own workspace, or its session's, and a row with neither is app-wide and
  shows in every workspace. Mark all read and Delete all act on that same scope.
  The studio header draws them through `NotificationsHeaderActions`: the shared `FilterButton`
  only while the rail is folded, then the ghost `Mark all read` (only while something is unread), then the `⋯` menu of the
  `notifications` kind of the action registry (Mark all read, which names the scope, and Delete all). Delete all
  opens a `ConfirmPopover` anchored to the `⋯`, aligned to its end edge, titled with the scope's count ("Delete 7 notifications?") and naming the
  workspace or "every workspace"; it never swaps the title row. The title row's meta reads the
  count and the unread count ("6 notifications · 4 unread"). A row's Delete acts
  at once and pushes "Notification deleted" with Undo (`dismissNotificationGroup`
  re-inserts the rows through `insertNotification`; ⌘Z works too).
  In the studio, rows are grouped by day (Today, Yesterday, This week, Older),
  J and K or the arrow keys move, Enter runs the row's action and E deletes. The
  cursor never marks a row read: a group is read when it opens (a click or
  Enter) or from its own Mark read.
  The rail rows (`packages/ui` `FacetRail`), the list keys
  (`shared/hooks/useListKeys`) and the day grouping (`shared/utils/groupByDay`)
  are shared primitives. Tasks uses the rows and the list keys but not the day
  grouping or a rail: its facets (source, show, type, project) sit in one Filter
  menu of the header, next to the For me and All switch, the search, the grouping button (`Group: Source`) and
  `⋯` (Refresh, Manage tools: the `taskList` kind of the action registry), and its rows are one `ListGrid` with a group per
  source, status or project (`taskGroupsOf`), the total on the label (`taskGroupTotalsOf`, starred rows included), five rows each until Show all, and
  each group is its own listbox of options. J and K move a cursor through the
  rows on screen, and the record follows in the pane only once one is open.
  Tasks opens with a quiet cursor on its first row (`data-cursor`,
  `aria-selected="false"`) and no pane, so those keys act at once and nothing
  opens by itself; a click, Enter or a record asked for on open
  (`initialRecordKey`) opens the pane (`aria-selected="true"`, `bg-selected`).
  Enter on the row the pane already shows opens its launch popover (⌘↵ in the
  panel launches) or the session once one is linked, O opens the record in its
  tool, R opens the record and focuses the reply box when the record has one (a
  Sentry issue has none, so R does nothing there, `recordCanReply`), S stars or
  unstars, / focuses the search, and Escape in the search leaves the field.
  Escape closes the pane, or the full page, first and keeps the cursor; a second
  Escape closes the studio.
- **A list that belongs to the page sits in the page.** Chat's list of chats,
  Changelog's releases and the guide's chapters are content beside their
  detail, not a second navigation column: `StudioRailLayout` with
  `placement="page"` draws the list on the page background with the resize
  edge as the only line. Tasks' and Notifications' filters are the same frame. Every page rail opens at
  288px (`standard`); the skeleton reads the same constant.
- **A page rail folds, and folds itself when there is no room.** A page may pass
  `onCollapsedChange`: the rail's first row then holds a fold control (tooltip
  "Fold the rail" with ⌥⌘B), a folded rail leaves a 44px strip with "Show the
  rail" at the same height (none while the pane is too narrow to dock,
  `canUnfold`), and `useStudioRailFold` remembers the choice per surface
  (`goodboy:studio-rail-folded:<studio>:v1`). Chat, Terminal, the Guide, the
  changelog, Settings in its studio frame and Notifications fold this way.
  **⌥⌘B** (`innerColumn.toggle`) folds the inner column of the page you are
  on: each foldable column registers with `useInnerColumn` while its page
  shows (the session rail while no studio covers it, a page rail through
  `StudioRailLayout`), the key toggles the last one registered
  (`innerColumnStore.toggleCurrent`), the palette lists it under that
  column's name (Fold the chat list, Show the session rail) and leaves it out
  on a page with none, where the key does nothing. Under a pane of 880px the rail
  folds without saving anything and docks again when the pane widens. A folded
  rail leaves the shared `FilterButton` (28px tall, the lines icon with the
  count of active filters; docking the rail again is the Show the rail strip
  at the rail edge or ⌥⌘B, never a header button) in the title row, opening the same facets in a popover. The search field of
  Tasks moves into the title row with it.
- **Every studio list resizes.** `StudioRailLayout` (Settings in the legacy
  layout, Guide, Chat, Changelog, Bitbucket, Tasks, Notifications) drags from
  its right edge between 220 and 420px (a page may pass `min` and `max`), step
  8px (32 with Shift) with the arrow keys, and goes
  back to its default (256 narrow, 288 standard) on a double click. Each studio
  keeps its own width
  (`goodboy:studio-rail-width:<studio>:v1`), and the rail skeleton opens at
  that width. `useResizableWidth` (`@goodboy/ui`) owns read, clamp and save
  for these rails, the session sidebar and the drawer: while the pointer
  moves the width lives in a CSS variable (the drawer writes its own style),
  so nothing renders and nothing is saved until the drag ends. Precedent: VS
  Code, Zed and Linear sidebars.
- **Settings opens on a page, never on a grid.** The Settings door, ⌘, and the
  palette's Settings land on the page opened last, held in memory only
  (`lastSettingsFocus`, slice `settings-last-page`): the first open after the
  app starts lands on General, and a remembered page that no longer exists
  (a workspace page with no workspace, a provider that was removed) falls
  back to General (`resolveSettingsFocus`). A link that names a page (a scope,
  a section, a provider or a tool) opens that page. `scope: 'home'` stays as
  the alias for "the last page" and `SettingsStudio` resolves it once, then
  amends the history entry to the concrete page. The rail is the only index,
  portaled into the column (`SettingsColumnNav`, `Back to app` first, then
  `Search settings`, then the groups) in both sidebar states, or drawn beside
  the page on Home: its four groups (App, Workspace, Providers and
  models, Integrations) come from `settingsDirectory`. Every row is one 28px
  line of one grammar (`SettingsNavRow`): a group row carries its icon, a page
  row is nested by `PANE_RHYTHM.navRail.nest`, and a row has no second line,
  no count and no identity. A row that needs something shows a 6px dot at its
  end, named for assistive tech by the sentence that used to sit under it
  (Update needed, Signed out, Can't check, Not confirmed, Refused your runs, Error, Claude is about to run out); a quiet
  row shows nothing. The sentence lives on the page: a provider about to run
  out or out opens on a notice at the top of its page (`ProviderAttentionNotice`,
  the usage notice that used to close the Usage band). Every page is also a palette entry
  (`settingsPaletteEntries`, `Settings: Storage`, `Providers: Claude`), built from
  the same list, so ⌘K and the rail cannot disagree. `Search settings` in the
  column filters those same entries by name and former name, lists them in
  place of the groups, and opens the one picked on the same history entry; with
  no match it says `No settings match`. The status lines are read
  once per studio (`useSettingsStatus`, on the minute clock of `useNow`);
  opening Settings starts no loading of its own (no storage scan, no branch
  scan, no provider refresh). Without a workspace the Workspace and
  Integrations groups are left out. Precedent: the VS Code settings editor and
  Linear's settings sidebar.
- **Settings nests items in its rail.** The App items (General, Updates,
  Keyboard shortcuts, Storage, Backup and reset, iPhone) always sit under the
  App row as indented
  rows, whichever scope is active, so switching scope never moves a row above
  the pointer. The Workspace pages (Folders, About you, New sessions,
  Branches, Replies and commits, Permissions) sit the same way under the
  Workspace row (`workspacePages.ts`, `SettingsRailPageGroup`). The panel
  shows one item at a time. Providers and models nests
  Models and one row per provider, and Integrations nests one row per tool. Those
  two lists open and close with `Reveal`, and the rail stays one mounted
  element across scopes: `SettingsStudio` portals each scope's nested list and
  detail into slots it owns, and keeps a closing scope mounted until its list
  has collapsed. Every settings panel enters with `nav-step-in`
  (`SETTINGS_PANE_ENTRY`). So no scope adds a second rail column. Every scope
  panel keeps the reading width. Precedent: the VS Code settings table of
  contents and Linear's settings sidebar.
- **Providers and models names its scope in the page header.** Every page of
  the scope (Models and each provider) carries the scope as the meta line of
  its title: the workspace name when one is open, `All workspaces` when there
  is none (`ProviderSettingsScope` passes `scopeLabel`). The legacy trail
  reads `Workspace` and `Providers and models` without a name, so the name
  appears once per page.
- **Workspace settings is one page per area, each part in a card.** A
  workspace page carries the page title and one line of
  help; every part is a `Band` with one heading style (eyebrow, icon, hint
  under it) and help written under each field, never in a tooltip. Only the
  page on screen mounts, so Permissions and Replies and commits compute nothing
  while another page is open. The old anchors (`projects`, `profile`,
  `general`, `after-merge`, `review-replies`, `permissions`, `danger`) now
  pick a page (`workspacePageOf`); `track-with-git` (and the old
  `dev-project`) lands on Folders with the first commit review of the first
  plain code folder open. The workspace is renamed from the `Name` field of the
  Folders page, and its name is written once on that page, in the top bar
  (the disconnect row says `Disconnect this workspace`). The attribution line
  lives on New sessions only, and Replies and commits links to it. Replies
  and commits holds the reply voice and templates, `Mark thread as resolved`
  and the commit style (`review-replies` stays its page id and anchor); Run
  defaults live under Workflows.
  Tracking a plain folder with git is an inline flow in the Git repository band of the
  Folders page (`TrackWithGitFlow`, `FolderGitBand`), never a dialog: the
  first commit review, then `Publish to GitHub` through the same publish form
  as the first lap (`PublishPanel`). Creating a workspace never opens this
  band by itself: the pick row already offers **Track it with git** for a Code
  folder. A documents folder gets no row in the band.
  The **Plain folders** band (`FolderFacesBand`) lists each plain folder with
  the switch Code project or Documents (`setFolderPurpose`; when the write
  fails the old face stays, with the error beside it), one line of what the
  face means, and its saved versions: the size against the cap
  (`folderHistorySize`) with Review in Storage, or a failed first copy with
  Retry. Every window reads the faces again on focus (`useFolderFacesOnFocus`,
  in the top bar watch and on Home). Skills stays
  hidden behind its feature flag. Precedent: GitHub repository settings and
  Linear's settings pages.
- **Restore defaults and copy from another workspace share one inline
  flow.** The page menu (⋯ in the title row) of every page that owns settings
  offers `Restore defaults` and `Copy from…`; under a separator, the menu of
  every workspace page (Folders included) offers `Copy all pages from…` and
  `Restore all workspace defaults` for every page at once. The flow opens under the title as a band, never as a
  popover: pick the workspace, then a preview grouped by page with a
  checkbox per page and the from and to values, then the action row (`Copy N
settings`, `Back`, `Cancel`). It ends on a status line with `Undo`. The
  preview is computed when the flow opens (`loadFlowSources`), not on every
  render. Which keys a page owns comes from `pageKeys` (`features/settings/
pageKeys.ts`), typed so a new override key does not compile until it has
  an owner; provider defaults belong to Providers and models and are never
  copied, and neither are projects, folders, integration accounts,
  permission history or `bootstrap.*` keys. Restoring writes `null`; every
  override change of one copy or restore is one `patchWorkspaceOverrides`
  through the queued workspace writer. A field whose value differs from the
  default shows a small Reset button after its label (tooltip `Reset to
default`, hidden while the value is the default, `WorkspaceFieldRow`). Precedent:
  JetBrains Copy to Project and VS Code's Modified marker with Reset Setting.
- **Storage is the one place for disk space, scoped by a picker.** App >
  Storage lists every worktree folder Goodboy made, grouped by repository,
  under three filters: To review, In use and Kept. Each part is a card
  (`Band`) under a plain section title: Worktrees (with `Scan
another repository` at its foot), Artifacts of deleted sessions, and
  Transcripts and app data. There is no summary band: the page meta line
  reads `<total> on this Mac`, or `<total> in <workspace>` under a scope (the
  shared transcripts and app data stay out of a scoped total), from
  one function (`storageTotalBytes` and `storageMetaOf` through
  `useStorageMeta`), and adds `Low space: N GB free on this disk` under 10 GB
  free. The Worktrees header holds the three filters and `Remove N safe
folders · size` (`WorktreeRemoveButton`), with the sentence on idle days as
  its help line, and the folder `...` menu shows on hover and focus. `Prune`
  is a secondary button that confirms. Branches is a Workspace page
  (`branches`, `BranchesPage`): the workspace's After merge rule first, then
  the branch list under one select (`Safe to delete`, `Needs a look`, `All`),
  then a `Recently deleted` fold row (restore or delete for good, loaded from
  `deleted_branches` on open, which also releases the refs of deletions older
  than 14 days). The page meta line reads `N safe to delete · M need a look`
  (`branchesMetaOf` through `useBranchesMeta`). A scope picker
  (`StorageScopePicker`, `Listbox`) sits in the page header row next to
  `Suggest cleanup after` and `Check again` (`StorageHeaderActions`); the
  Branches header has the same picker without `Removed workspaces`
  (`BranchesHeaderActions`). `openStorage` and the
  cleanup notifications always land on Storage. The picker lists the current
  window's workspace, every other workspace with its own weight, `Removed
workspaces` (folders whose owning workspace is gone or was never linked),
  and `All workspaces` with the machine total. The scope drives the total, the
  worktree list and the artifact list together
  (`storageScope`, `resolveStorageScope`); it defaults to the current
  window's workspace, or to all workspaces without one. A scope other than
  all leaves App data out of the total (`state.storageScope`
  never splits app data by workspace). The
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
  On the Branches page, `BranchesSection` lists local branches
  only, in the same scope, in one list. It scans only when it opens:
  `git for-each-ref` over the local branches, one more over `origin` and one
  for the distance behind the base (`project_branches`; fields are split on a
  unit separator, so a branch name with a `|` still lists, and a git without
  the batched distance counts per branch), with the merge test cached by both
  tips (4096 entries at most) and fed each branch's merged pull request head
  (`listMergedRequestHeads`); protected branches never show. One select
  (`Safe to delete`, the default, `Needs a look`, `All`) filters the list.
  Safe to delete means merged by merge commit or rebase, merged by its pull
  request with nothing after the merged head, or never used. Needs a look
  means `Merged, then N new commits`, unmerged and gone on origin, local only
  for over 30 days, or older than 90 days; never preselected. Every branch
  row and every Recently deleted row sit on one grid (`BRANCH_TABLE_GRID`,
  each cell marked with its `data-cell` name): select, branch with its
  session title under it, folder, state chip (`Merged`, `No commits` or the
  full verdict, with how it merged and where it lives in its tooltip), the
  last commit's age and the action cell (`row-actions`, shown on hover and
  focus). Delete reads the `branch` kind (`branch.delete`), from the cell and
  from right click. A Recently deleted row shows the sha under the branch,
  the days left as the chip and Restore plus delete for good in the action
  cell. Delete on a merged branch acts at once
  and a toast carries `Undo`; an unmerged one confirms in a popover beside its button, and the bulk bar
  counts the commits it takes. `Also delete N on origin` sits above
  the bar only for Goodboy's own pushed branches in repos where GitHub does
  not already delete merged branches. Deletes use the same
  compare-and-delete and 14-day restore as the after-merge rule. A branch another worktree
  holds reads Protected, so its folder goes first from Worktrees.
  In the space cluster, under Worktrees, "Artifacts from deleted sessions" lists plans, reports
  and wireframes whose session is gone, under To review and Kept, with Open,
  Keep (30 days or always) and Delete, which asks in a `ConfirmPopover` beside its button. Its one bulk
  action deletes the unused ones. Artifacts never trigger a nudge on their own.
- **Security findings is a section at the end of the Storage page,
  workspace-scoped** (`SecurityFindingsSection`; the old `security-findings`
  address lands on Storage, and its warning dot sits on Storage). It scans the
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
workspaceId, nowMs })`, owns every row's attention sentence and tone (it replaced three
  separate selectors read straight from `SettingsRail`). `useSettingsStatus`
  calls it once per studio and hands the result to the rail and the home, and
  a test mounts the home on the strict `invoke` mock to keep it free of
  commands and loads at render. A dot appears only
  when something needs doing: warning on Providers and models when a connected
  CLI is too old for a model it serves or no provider is connected
  (`selectProviderAttention`, with the reason as the dot's label), info on
  Updates while an app update is ready (`updatesText`), info on Storage with "N GB can go" as
  its label once clean idle folders pass 10 GB (warning when the disk has
  under 10 GB free and at least 1 GB can go, `storageAttention`),
  warning on Storage with "N open" once the current workspace has
  an undismissed finding (`selectSecurityFindingsAttention`; Storage shows the
  worse of its two dots, `appAttention`), and warning on
  Workspace with "N folders not found" once one of its projects reads
  `missing` in `projectGitStatus` (otherwise the row just names the
  workspace). A dot means only "needs you": a tool whose health is bad shows a
  warning or danger dot named by its reason (`toolAttention`), and a connected,
  healthy provider or tool shows none (no green dot for connected). No rail row is red: the destructive actions sit at the
  bottom of their page, Reset (Delete all data) at the end of Backup and
  Disconnect at the end of Folders, and turn red only in their inline
  confirm. Panel sections sit on bands (`Band`, eyebrow outside) with gap between
  them and no `Divider`. The workspace page is the exception: one
  column of eyebrow sections 24px apart. Its title is the workspace name,
  renamed in place. One `Terminal folder` row sits above the projects: the
  computed folder (`workspaceFolder`) with `Change` (the folder dialog) and,
  when overridden, `Use the default` (`setTerminalWorkspaceFolder`). Folders
  group `Starred` ahead of `Other folders` (never in both; one `Folders`
  heading with `Star the ones you use most.` while nothing is starred), 16px
  apart with no divider, each a `SectionHeader` with its count and, for
  Starred, `Agents and pickers list these first.`; Starred is never folded and
  `Show N more` stays under Other folders. Each project is a 32px row on the
  group grid (star, kind, name, description, a base-branch chip only when set
  by hand, a Folder-not-found flag) with Open in editor, Copy path and Remove
  link in a reserved column, dim at rest. The star shows at rest only on
  starred rows (filled, warning tone) and stays visible at rest in
  `text-faint-foreground` on the others, in the same 24px slot (`StarToggle`). Clicking the name
  opens an inline editor card below the row for the rest (description, base
  branch, After merge for repos, folder, scripts, facts, footer actions); the
  card starts at the name column (`grid-cols-subgrid`) so its content sits 12px
  right of the name. `starredProjectsFirst({ projects, inside })` is the one
  order: starred first, then the rest, by `name` in Settings and by `recency`
  in pickers (`groupProjects` calls it). A project picker (the session Add
  folder list, the Sessions folder filter) with a starred project and six or
  more projects shows the same two headings and a small filled star on starred
  rows (`shouldGroupStarred`); a search flattens them. New session defaults sit in a
  two-column grid with each help behind an info mark, followed by the
  `After a pull request merges` segmented control, and disconnecting is a
  ghost row at the bottom that asks in a `ConfirmPopover` beside its button. Onboarding keeps the
  comfortable rows.
- **Master-detail is not the dual-sidebar anti-pattern.** A narrow list rail
  beside a detail panel is fine. "no left panel and right panel at once" is
  about two sidebars on either side of the content, which the app does not do:
  the column and the session rail both sit on the left.
- **Disconnecting is scoped.** A connected integration studio can disconnect
  from its own header. That clears the workspace credential, never a
  system-level session. A workspace running on the system `gh` CLI has nothing
  workspace-scoped to clear, so it offers no disconnect and points to
  `gh auth logout`. The control depends on credential state alone, not on the
  git remote. So a leftover scoped personal API key on a non-GitHub workspace
  can still be cleared.
- **A code-host record keeps its verbs outside a session.** A GitLab merge
  request opened from Tasks approves, merges, closes and reopens through
  the workspace's GitLab host. A Bitbucket pull request shows its verbs too,
  blocked with the reason until Goodboy has resolved it for a session. A GitHub
  pull request opens read only: description, review state, branches and its
  comments, with Start from #318 as the primary (Review pull request when its
  review is requested of you) and Open in GitHub for the rest.
  Merge
  always asks first, and so does every destructive verb. The mount reads
  through the workspace's first repo project, so a workspace with no repo
  project stops at an empty state.
- **Every record header has the same four places.** `RecordHeader` puts the
  tool glyph, the identifier and the state on the identity line, with Open in
  the tool, the `⋯` menu and, in Tasks, close at its end. Under the title
  sits one action row: one primary (Start session, Review pull request, or
  Open session once one is linked) and at most two tool verbs picked by state.
  Before a session is linked, Tasks adds Link to a session under the properties
  (`RecordFrame.link`): a searchable list of the workspace's sessions that links
  the record to the one you pick. Everything else lives in
  `⋯` in a fixed order: rare tool verbs, Refresh, Copy link, Remove link to session,
  then destructive verbs after a separator. Editable properties change from the
  control that shows them (the Jira state opens its transitions). Start has
  one verb and the result follows the record (`startFromRecord`): an issue or
  an error opens the New session draft with the issue picked and its brief
  being written; a pull request waiting on you starts a PR reviewer and lands
  on the Pull request tab; a Slack thread, a merge request, a Bitbucket pull
  request or a pull request of yours opens a popover with the goal and the
  brief. Enter from the Tasks list does the same, or opens the linked session.
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
