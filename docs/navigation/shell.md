# The shell

> **Read this when** you change the frame of the window: the skeleton, the top bar, the rail foot, the menu bar or a column door. **Not for** context menus ([context-menus.md](context-menus.md)), the slots and the places rail ([surfaces.md](surfaces.md)), shortcuts ([shortcuts.md](shortcuts.md)) or the bug sheet and setup ([setup-and-crash.md](setup-and-crash.md)).

## Skeleton

The window is one strip of chrome (the top bar), the places rail on the left, one
main slot and, inside a workspace, a right rail with a dock. Nine principles say
where each thing lives. A **holds** principle is true today and guarded by a
test; a **target** is the direction, with no test yet, and the unit that makes it
true turns it into **holds** and adds its guard. A unit that changes the skeleton
edits this section first.

1. **Left is where you go. Holds.** The places rail
   ([surfaces.md](surfaces.md#the-places-rail)) holds New and the six places and
   no tool. An open session keeps the Board lit, since it is the Board's child; the
   Desk is a face of the session, not a place, and keeps it lit too. Sessions in
   the top bar moves between sessions without the Board
   (`ShellLeft/index.test.tsx`, `regressions/places-rail.test.tsx`).
2. **Right is what you hold. Holds.** The right rail sits at the sheet's right edge
   on every workspace screen: the session tools on a session page, Terminal and
   Browser everywhere. They stay open across every move inside the place they were
   opened in, and on Tasks, Chat and Workflows the page's panel and the dock stay
   open together, the panel left of the dock (`toolsStay.test.ts`,
   `StudioFrame/panelAndDock.test.tsx`, `p10-right-dock.test.tsx`).
3. **One home, one name. Target.** Owned by Column doors.
4. **A page replaces the page. Target.** Owned by Surfaces.
5. **The top bar is identity, movement and live state. Target.** It holds no
   control for another container; every chip opening the home of its number is
   target.
6. **The bottom-left is the app's corner. Target.** Owned by The rail foot.
7. **A menu shows five rows at most. Target.** Right click menus are exempt: they
   mirror the action catalog.
8. **The places rail never folds. Holds.** No toggle, no peek, no saved width:
   64px with a word under each icon, 44px icons only under a 1100px window, and an
   old folded choice changes nothing (`regressions/places-rail.test.tsx`).
9. **Inside a session, the right opens its Desk. Holds.** On the Overview, the
   right rail tools open the Desk with that tool; on the Desk they show and hide
   its panels, and closing the last one brings the Overview back. The head has no
   switch between the two (`useDeskLanding/index.test.tsx`). Outside a session a
   tool opens beside the page.

Also guarded today:

- **One selected sign** and **one door for moves**
  ([model.md](model.md#one-selected-sign)), pinned by
  `__tests__/navigation/oneDoor.test.ts`. A control lights from `isCurrent`, never
  from its own state.
- **Saved layouts load without loss**: a layout and the fold choices the previous
  build wrote restore, every studio and drawer kind, the board, a session, and a
  Terminal dock without a session (`__tests__/navigation/restore-previous-build.test.ts`).
  So a persisted key, a studio kind, a drawer kind and a lens id keep their names.
- **Every route has a row** in `__tests__/surfaces/navigation-flows/`.

## Context menus

Every object's actions are written once, in the action registry
(`features/actions/`); the overflow menu, the right click and the palette read the
same list ([context-menus.md](context-menus.md)).

## Surfaces

One app layout, and every surface fills its slots: the places rail, the main slot,
the right drawer, the Desk and the header actions ([surfaces.md](surfaces.md)).

## Top bar

The top bar says what is happening now; the column takes you to places;
preferences live in Settings. Every chip opens the home of its number: Now ends on
Monitoring, Usage opens the Providers menu, Spend opens Impact on its Spend tab,
the bell its own popover.

### Frame

- On macOS the traffic lights sit inside the bar, whose left zone starts 72px in
  (`--titlebar-inset`, 0 in full screen and on other systems).
- The bar is a deep drag region: any spot that is not a control moves the window,
  a double click zooms it, and controls never drag.
- One three-column grid, `minmax(0,1fr) auto minmax(max-content,1fr)`, each zone
  pinned to its track (`col-start-1/2/3`), so a dropped item never lets another
  zone slide over. When the right zone outgrows its half, the command center
  slides off the midpoint instead of being covered.
- The bar never edits. The bug, the update and the version live at the rail foot;
  the setup checklist is a card on the Board.

### Left: Sessions and Repositories

The workspace mark sits at the top of the places rail, and the bar holds no
sidebar toggle.

- **Sessions** (`SessionsPopover`, ⌘B, `sessions.toggle`) opens a 500px popover by
  the one placement rule: the 12px shell gutter from every edge, the height capped
  at the room left, the list scrolling between a fixed search field and a fixed
  Open Board foot.
- Its groups are `sessionOrderOf`'s (Pinned, then by state; the Needs you number is
  `attentionCountOf`). Typing filters by title or project, the arrows and Enter
  open a row, and the pin calls `pinSession` or `unpinSession`, which leave the
  row in place when the write fails.
- A row shows the status mark, the live line or the project, the count of what
  waits on you (the Board's `needsYouOf`), and **Desk** when the session reopens on
  its Desk ([session-rail.md](session-rail.md#a-sessions-row)).
- While a session needs you, the control carries a warning dot whose tooltip says
  how many (`SessionsTrigger`).
- After an update from a build with a sidebar session list, a one-time card under
  Sessions (`SessionsCard`, 320px) reads "Your sessions moved here" with **Show
  sessions**. Opening Sessions in any way closes it for good: the close is saved
  (`shell.sessionsCardClosed`) before the card goes, so a failed save keeps it. A
  fresh install never shows it (`store/slices/sessions-card/`).
- **Repositories** is the `RepoEntry` ([model.md](model.md#one-home-per-thing)).

### Centre: movement and the command center

- `Back` and `Forward` (24px icons) name their destination in the label and the
  tooltip (`Back: Comments`, the session on a second line, `Hold to show history`
  on a third, `⌘[`). They sit at 40% with `Nothing to go back to` on an empty
  history, and open the last 12 entries on right click or a 400ms hold.
- The command center opens the palette and shows ⌘K; it never takes typing.
- Board and Chat are rail places. Board does nothing on the board, closes a studio
  over the board, and in a session goes to the board as a history entry, like ⌘⇧H
  and Open Board in Sessions (`ShellLeft`).
- **Chat** opens the `chat` studio on the chat you had open last in this workspace
  (`lastChatByWorkspace`, memory only, `selectChatDoor`), else the most recent by
  activity, else a new chat. After New chat (in `ChatHeader`, or ⌘⇧N) it opens a
  new one until you pick a chat again. The rail place, the bar and the palette
  share the rule.
- A chat with no message is one centred stage (the glyph, **Ask about
  {workspace}**, one sentence, the composer, up to three suggestions); the first
  message docks the composer. Archiving or deleting the open chat lands on the next
  most recent one. A chat row carries a running dot or a new-reply dot.
- Start session in a chat's Start work from chat panel creates the session, and
  Add to session picks one; both call `openStartRun` with the brief, which pushes
  that session's Runs and fills **Start a run** (nothing starts until Start). Back
  returns to the chat because `captureLocation` keeps `appStudio`.

### Right: Now, Usage, Spend and the bell

1. **Now**: running and scripts, each only above zero, from `deriveSessionStage`
   through `useNowSessions`, so a running session that needs you does not count as
   running. Static dots; the tooltip names the unit ("2 sessions running, 1 script
   running"). At zero one muted "Idle" slot with the neutral ring keeps the chips
   beside it still.
2. **Usage**: one chip per connected plan provider (Claude, Codex, Gemini,
   Cursor), in provider order, those reporting nothing last. The order never
   follows state.
3. **Spend**: today's figure with `today`, hidden until the first cent, named
   `Spend today. Open Impact`, opening Impact on its Spend tab; never merged with a
   count.
4. **The bell**: its unread count drawn like a tab count (one number, capped at 9+,
   the quiet unread tone, warning when an unread item carries an action). It opens
   the notification popover and stays pressed while Notifications is open.

There is no storage chip (a control that appears at a threshold breaks the model,
and "Free 7 GB" read as free disk); "N GB can go" lives on the Storage row of the
Settings rail. The bar holds no Impact or Monitoring icon.

**The Now popover** groups running and scripts, draws no empty group and ends on
**Open Monitoring**, the page that owns those counts. A script row moves to its
session and opens that run's output in the right drawer; a running session row
opens the session hover card after the pointer rests.

Sessions that need you are not in the Now chip or its panel: the Board door
carries the count, and the Sessions control a dot. Needs you counts three
units, and each tooltip names its own: sessions ("2 sessions need you") on the Board
door, the dock badge and Search or run; questions ("3 questions") on the
Questions tab of the session; items ("4 items need you") on the Overview card and
the Runs group. The bell is unchanged.

**A Usage chip** is the provider glyph and one bar of its tighter window.

- The percent shows in tabular gray above 70%, `Out` with the reset day at 100%. A
  clock marks data older than 30 minutes or a window that reset since; a dashed
  track means no data. A provider with no figures draws no chip.
- The fact card (`LimitsTooltip` around `limitsCardOf`) lists every window with its
  percentage and reset, the free Codex resets when Codex is out, and the update age.
- A click on a chip, or on a provider under `+N`, opens the Providers menu under the
  strip (`LimitsProvidersMenu`, `ProvidersMenuPanel`, loaded on first open; see
  Column doors), with or without a workspace.
- The strip is a toolbar: arrows move between chips. With no provider connected it
  is one pulsing `Connect a provider` chip opening the same menu, and nothing shows
  while providers are being detected.
- A bar in the chrome is always a provider window; money is always a figure.

### Narrow widths

The bar is an `@container/topbar` and degrades on its own width, never the
viewport, so app zoom acts like a narrow window:

1. Below `chrome-wide` the command center narrows (its `Search or run` label shows
   from `chrome-labels` up; the workspace name is in its tooltip) and Usage keeps
   two chips.
2. Below `chrome-labels` it becomes an icon with ⌘K, the signal words (`running`,
   `scripts`, `today`) drop and Usage keeps one chip. Counts, dots, glyphs and the
   spend figure stay, their tooltips carrying the words.

The traffic lights, identity, the movement cluster, the command center, the spend
figure, the first Usage chip and the bell never hide. The only overflow is a `+N
providers` chip for the Usage chips that do not fit and the providers with no
figures (the hidden glyphs, then `+1 provider`, never a bare number; `Usage` with
no chip shown), in the tone of the worst hidden provider, at every width.
`chrome-labels` sits below the 1024px minimum window, so words only drop under
zoom.

### Workspace popover and theme

- **One switcher.** The workspace mark is mounted once; ⌘O opens its one anchored
  popover, and the palette lists workspaces as rows of its own.
- `Search workspaces` filters by name and folder path. The current workspace sits
  in its own `This window` row (a check mark, `Current`, and the only gear into
  Workspace settings) with its folder count (`folderCountLabel`), **Add project**
  (the folder picker, then an undo toast) and **Manage folders**. The foot holds
  one **New workspace**, which opens the one form.
- Every other workspace shows one verb, `Open`, replacing the workspace in this
  window; `⌘Enter` opens a new window, and a row open elsewhere says `In another
window`. Open over running agents asks first, inline under the row: the primary
  keeps them going in a new window, the ghost alternative stops them and opens
  here.
- A closed `Disconnected` group lists workspaces removed from disk, each with
  `Reconnect`. With no other workspace no empty row is drawn; a search with no
  match says `No other workspaces match`.
- **Theme is not in the bar.** Settings > This Mac > Look and alerts > Appearance
  holds the three-way choice, and the palette answers **Theme** with **Theme:
  dark**, **light** and **system**. Both call `switchTheme({ to })` in
  `shared/lib/theme.ts`, the only writer, and the swap is one paint
  (`theme-switch-is-one-paint`). No shortcut is bound to it.

## The rail foot

The foot is the app's corner, from the top: Settings (⌘,), Report (⌘I), the Update
mark while an update waits, and the signature. Settings, Report and Update are rail
items with their word under the icon (`ShellRailItem`), and none goes to a
workspace page. Report reads "Report a bug, draft saved", with the draft dot, while
a report is half written. Before a workspace exists the rail is only this foot.

### The signature

The signature (`app/components/ShellLeft/RailSignature/index.tsx`) is a 32px
`BrandTile` on the rail axis below the last item.

- Tile `#0b0b0d`, white dog, radius 0.28 of the side, mark 0.76; no ring, plate,
  border, glow or gradient; never inverted, the same in both themes. It fills one
  rail tile (`SHELL_RAIL_TILE`), so the dog sits on the icons' axis.
- Its bottom edge sits 4px above the content sheet's: the rail pads its foot by
  `SHELL_RAIL_FOOT_PX`, the 12px `SHELL_GUTTER_PX` `DrawerColumn` keeps under the
  sheet plus `SHELL_RAIL_EDGE_PX`, the 4px its top keeps. The space above is the
  rail's `gap`.
- It is the door to What's new: a quiet button named "What's new" (tooltip on the
  right, no word under it) that calls `openChangelog`, the last stop of the rail's
  arrow keys (`data-shell-rail-item="signature"`). While the installed release has
  unread notes, a small dot sits on its corner and the name becomes "What's new,
  new release notes" (`useHasUnseenRelease`, [release.md](../release.md)).
- The rail shows no version line: it is in the Update card, Settings and What's
  new.
- At the 700px minimum window the foot fits with the Update mark above the
  signature: the wide rail needs 662px of the 664px under the 36px top bar (`u50-logo-foot-*` scenes). A
  GitLab or Bitbucket reachability line (`HostReachabilityLine`) under the top bar
  takes its height from the rail.
- `useRailFootEffects` (`app/components/ShellLeft/useRailFootEffects`) holds the
  restart when idle (`useRestartWhenIdle`), the anchor the update card opens
  beside, and the onboarding re-read when a secondary window takes focus.

### The Update mark

The Update mark (`features/updater/components/UpdateRailMark.tsx`) is one more item
above the signature, never in its place: one shape, no pill, no version line, the
word **Update** in `primary` on `primary-subtle`. `updateMarkOf`
(`features/updater/updateMark.ts`) gives it by state:

| State          | Mark                                                                     | Card                                         |
| -------------- | ------------------------------------------------------------------------ | -------------------------------------------- |
| None           | No mark, the signature alone                                             | None                                         |
| Available      | Arrow, word Update                                                       | Later, Update now                            |
| Downloading    | Arrow with a ring that fills, the word is the percent (`updateProgress`) | The bar fills, the button is busy            |
| Ready          | Arrow, with a `primary-edge` ring                                        | Later, Restart now                           |
| Agents running | Same as Ready                                                            | Later, Restart now, Restart when they finish |
| Queued         | Same as Ready                                                            | Later, Cancel restart, Restart now           |
| Failed         | Alert glyph, `danger` on `danger-subtle`                                 | Later, Retry (nothing changed on the Mac)    |

- It breathes three times on arrival (`animate-arrival-breath`, the `soft-pulse`
  keyframes, under `motion-safe`) and then holds still; reduced motion shows only
  the tint.
- A click toggles the update card (`toggleUpdateCard`), opened right of the rail,
  aligned with the foot (`useDropdownDirection`, side `right`, align `end`), 12px
  inside every edge ([right-drawer.md](right-drawer.md#floating-surfaces)). Its
  copy, arrival and snooze are `UpdateArrivalCard`, `updateCardCopy` and
  `updateSnoozeGate`.
- The new version is in the tooltip and in Settings. The workspace launcher, which
  has no rail, shows the update as the `UpdatePill` pill.

### What is not in the foot

- Pair an iPhone lives in Settings, iPhone (`goodboy:open-pair-device` lands on
  `{ scope: 'app', section: 'iphone' }`), and in the palette; Keyboard shortcuts in
  Settings, Shortcuts (⌘/). Report a bug opens the bug sheet.
- Every studio keeps a visible door: the flow table in
  `__tests__/surfaces/navigation-flows` gives each row that reaches a studio a
  `door` of `visible` or `palette`, and `studio-doors.test.ts` fails on a studio
  kind with no `visible` row. The Guide and What's new are the exception: their
  door is `palette`, with Help in the menu bar ([help.md](help.md)).

## Menu bar

On macOS the app has seven menus:

| Menu    | Rows                                                                                                       |
| ------- | ---------------------------------------------------------------------------------------------------------- |
| Goodboy | About, Check for Updates, Settings, Services, Hide, Hide Others, Show All, Quit                            |
| File    | New Session, New Chat, New Terminal, New Workspace, Close, Close the panel                                 |
| Edit    | the native rows, then Search                                                                               |
| View    | Show or Hide Sessions, Search or Run, Reset Panel Layout, zoom, Reload, Reload Goodboy, Full Screen        |
| Go      | Back, Forward, the destinations in `DESTINATIONS` order, then Show or Hide Terminal and Browser (the dock) |
| Window  | the native rows                                                                                            |
| Help    | Guide, What's New, Keyboard Shortcuts, Report a Bug                                                        |

One table lays them out (`SECTIONS` in `src-tauri/src/app_menu.rs`). A row is a
native item (About, Quit, Undo, Cut, Copy, Paste, Select All, Full Screen,
Minimize, Zoom) or a command with an id, a title-case label and an optional combo.

1. A command row emits `goodboy://menu` with `{ id }` to the focused window.
2. `useMenuCommands`, mounted by `useAppShortcuts`, is the one listener;
   `runMenuCommand` reads the id.
3. A registry shortcut id (`session.new`, `app.close`, `search.open`) replays its
   combo through the dispatcher, so a scoped owner keeps its place.
4. Any other id runs its `MENU_ACTIONS` entry (`menuActions.ts`: Check for Updates,
   New Terminal, New Workspace, the Go doors, Guide, What's New).
5. An id with neither warns once and does nothing.

A new item adds a row and an id, never an event or a listener.

- Every Go page opens through `openDestination`, like the column and the palette.
  Browser toggles the dock (`toggleBrowserDock`), Terminal runs its shortcut, and
  New Terminal adds a tab in the dock, or on the Terminal page while it is open
  (`openWorkspaceTerminal` switches the page to it). Doors that need a workspace do
  nothing without one.
- `openDestination` does nothing on the page the column already shows as current
  (`selectColumnPlace`), so a Go pick there adds no entry and keeps an open Impact
  page's scope.
- The native menu bar is not bound to five rows. Every menu the app draws (a `⋯`,
  a header menu, a popover of actions) holds five rows at most; right click menus
  are not bound. A menu whose rows come from data (a picker, rows built by
  `toMenuEntries`, the history menu of the arrows) is named in the budget test with
  its reason.
- `menu-row-budget.test.ts` reports each hand written menu's row count (literal
  rows, radio choices, rows mapped from a constant list; two menus in one file add
  up); `overflowRows.test.ts` and `overflowRows.drawer.test.tsx` measure the
  registry menus state by state; `menuBar.parity.test.ts` fails when an id has no
  registry entry or action, a combo differs from the registry, a label is not
  title case, a key has two owners, or the Go rows differ from `DESTINATIONS`.

## Report sheet

One sheet files every bug, floating at the bottom of the window with no overlay;
its doors, the crash and freeze records and first-run setup are in
[setup-and-crash.md](setup-and-crash.md).

## Auto in the shell

Auto is described in [auto.md](../auto.md); this is where it sits.

- Auto is always on: Settings has no Auto switch.
- An Auto conversation is a row of the session's one **Runs** tab.
- The tree of an Auto agent, and of each child of a tree, is the Agents column of
  the run page (The Lead page in auto.md), never a second rail beside the chat.
- An Auto agent's chat gets its delegation lines and its tail through the
  `insertions` prop of `ChatView` (`useAutoChat`).
- The plan drawer swaps its toolbar for `AutoPlanToolbar` on a plan of an Auto
  tree, and the Overview timeline hides a tree's children and draws its state from
  `autoFactsByAgentId`.

## Column doors

- **Settings** (the foot door and ⌘,) opens the last settings page (Look and alerts
  at first), with or without a workspace. Workspace settings opens only from the
  gear on the current-workspace row of the workspace popover.
- **Impact** is the quiet last place on the rail (`isReference`). It opens its
  Overview tab; the spend figure and the `Impact: Spend` palette entry open Spend.
- **The Providers menu** is not a door: it changes things in place
  (`app/components/ProvidersMenu`). It lists the same `ProviderPolicyList` as the
  Models row Provider order, writing through `setProviderPolicy`, then Connect for
  each CLI provider not connected, then **Manage providers**, a door to
  Connections. It holds no usage figure and reads the cached providers without
  refreshing them.
- What's new is a tab of Help and a palette row, so it has no door. The connected
  tools have no glyph strip: Tasks' Source filter is the tool door, and Connect a
  tool lives in Connections.
- **The release notice** answers "have you read the notes for what you're
  running", not "was a release published". After an update one notice names the
  installed version and opens its notes, offline too. A fresh install shows none,
  and dismissing it marks that version read.
- Opening any studio closes the others. A current door does nothing.
- **Before any workspace exists** the places rail keeps its foot; New session and
  the places wait for one. Settings then opens its home with only the App and
  Providers groups, and Providers opens on an account instead of the workspace
  defaults.

## Shortcuts

One registry with three modifier planes and a `pane` plane of plain keys
([shortcuts.md](shortcuts.md)).
