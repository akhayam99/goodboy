# Browser host

> **Read this when** you are changing how Goodboy opens, places or closes a
> web page inside a window, what such a page may reach, the browser pane
> beside a session, the Browser page or a door that opens one (server chips,
> links, ⌘K, ⌘L), or what the browser may cost in commits and memory.
> **Not for** the data disclosure users read (`SECURITY.md`).

A browser tab is a native webview that Rust places inside a Goodboy window,
next to the app's own page. Rust owns every tab. The window asks for a tab
through a command, gets an opaque id back, and from then on only places,
shows, hides, navigates and closes that id.

## The invariant

**A page in a tab reaches no Goodboy command.** Tauri decides whether a page
may call a command by its address, not by the webview's name: a page on the
app's own origin is local, and a local page may call every command. So the
host refuses every navigation that would make a tab local, except a local
file the user typed (see Local files). That refusal is the first wall. The label is the second: no capability grants a `browse-`
webview, and no app command runs for one (see Capabilities).

## The navigation rule

The rule lives in `apps/desktop/src-tauri/src/browser/guard.rs` and runs in
`on_navigation`, in `on_new_window` and before every command that loads an
address.

- Only `http` and `https` load, plus a local file the user typed (see Local
  files). `javascript:`, `data:`, `blob:`, `file:` and every other scheme are
  refused.
- `about:blank` and `about:srcdoc` pass at any time. Such a page or frame
  takes its creator's origin, so it can never make a tab local. A new tab may
  start on `about:blank`, never on `about:srcdoc`.
- The app's own origins are refused even on `http`: `tauri://localhost`,
  `http://tauri.localhost` and `https://tauri.localhost` (Windows), every
  scheme Goodboy or Tauri registers (`tauri`, `ipc`, `asset`, `gbframe`,
  `gblocal`) and
  its `<scheme>.localhost` form, and in a development build the `devUrl`
  origin. When the `devUrl` host is a loopback name, every loopback host on
  its port counts as that origin: `localhost`, any `*.localhost`,
  `127.0.0.0/8`, `[::1]`, `0.0.0.0` and `[::]`. A release build may open a
  server on that port, because there it is not the app.
- A page that sends itself to one of those addresses stays where it was. A
  server redirect, a form post, a meta refresh and a `location` change each
  reach `on_navigation` as a new address and meet the same rule.
- On macOS a frame's load reaches `on_navigation` too. On Windows WebView2
  reports only the top page, so a frame is not checked there; the app's own
  policy carries `frame-ancestors 'none'`, so no page can frame the app.
- A popup (`window.open`, a link with a target) never becomes a window. When
  its address passes the rule it opens as a new hidden tab in the opener's
  session and window, and that window hears `browser://tab-opened` with the
  tab's facts (`openerId` names the tab that opened it). A session holds at
  most four hidden popups, those still opening included; past that a popup
  is refused with `too-many-popups` in the log. Showing a popup frees its
  seat, and so does closing it, by hand, by the sweep or by the cap.
  Otherwise nothing opens.
- Every download is refused. Asking before a download is not built yet.

Phase 0 spike S2 proved the wall: a page in a tab got none of six probe
commands, and got all six once it navigated itself to the dev origin or to
`tauri://localhost`, until this rule refused those navigations.

## Local files

Only an address the user types opens a local file: the address row, ⌘L, or
⌘K Open. It is an absolute path (a drive path such as `C:\work\plan.html` on
Windows), a `~/` path or a `file://` address, to a page, an image or a PDF. A link, a door, a page, a popup or a frame never
opens one; `browser_tab_open` and `browser_tab_navigate` still refuse `file:`.

- **The scheme.** The file is served by Rust on `gblocal`
  (`browser/local.rs`), never loaded as `file:`. The pane calls
  `browser_tab_open_local` or `browser_tab_navigate_local` with the typed
  text. Rust expands `~/`, resolves links, and refuses a missing path
  (`local-missing`), a folder (`local-folder`) or another type
  (`local-type`). A new tab starts on `about:blank`, gets its grant, then
  loads the file.
- **The grant.** It belongs to one tab, lives in the registry beside the tab
  and goes with it: closing the tab revokes its grants before the webview
  closes, so a close that fails still leaves no grant. It names the file's folder and a random token; the live
  address is `gblocal://localhost/<token>/<absolute path>`
  (`http://gblocal.localhost/...` on Windows). `on_navigation` lets a tab
  move to a `gblocal` address only when the token is its own and the path is
  inside the folder, so a web page that does not know the token can neither
  navigate to, frame nor embed the file. A popup to a local address is
  refused like any app origin.
- **What a request reads.** The handler checks the requesting webview's
  `browse-` label against the grant, then the path: under the folder, no `..`,
  no hidden file or folder, links resolved and checked again, a known type
  (pages, images, PDF, styles, scripts, fonts, data, text, video) and at most
  64 MB. The checked path is then opened one part at a time from the folder
  with no link followed (`scoped_path::open_confined`), and the type, size and
  bytes come from that one handle, so a file or folder swapped for a link
  after the check answers 404. On Windows the file is opened, then the final
  path of that open handle must equal the checked path, so a folder swapped
  for a junction answers 404 too. A platform with neither open serves
  nothing. Anything else answers 404; nothing lists a folder.
- **How far a grant reaches.** A grant serves every known type in the page's
  own folder, one level, no recursion. Below that folder it serves only
  static assets (`ASSET_TYPES`: styles, scripts, source maps, fonts, icons,
  images, wasm and video), never a page, a PDF, data or text, so a site with
  `index.html` beside `css/`, `js/` and `img/` loads whole, while a page
  saved into a busy folder can not read the documents under it. A link from
  the page to another page in a subfolder does not load; type its path to
  open it. A wide folder is the home folder and every folder right under it
  (Downloads, Documents, Desktop), the top of the disk or a folder one level
  down, a folder right under `/Volumes`, `/media` or `/mnt`, and the top of a
  mounted volume (its device differs from its parent's on macOS and Linux, a
  reparse point on Windows). A check that can not read the folder or its
  parent counts as wide. A page in a wide folder gets a grant of its own
  (`wide_page`) that serves the page itself and the static assets beside it,
  nothing else: no subfolder, no other page, and no PDF, data or text file
  next to it, so a page saved to Downloads can not read the documents saved
  there. Each file opened in a wide folder gets its own token.
- **Headers.** Responses carry `no-store`, `nosniff`, `no-referrer` and
  `Cross-Origin-Resource-Policy: same-origin`.
- **What the app sees.** Facts, listings and rows carry the `file://` address,
  query and fragment included; the token never leaves Rust. The address row
  shows the path (`C:/work/plan.html` for a Windows drive, which opens again),
  the title comes from the document, Reload reads the file again. A closed tab
  comes back through its grant at the same query and fragment; after a restart
  the row opens again through `browser_tab_open_local`, since the user typed
  it. ⌘K Open shows a tab already on the same file instead of opening another:
  `fileKeyOf` gives a `file://` address, its path, a `~/` path and a drive
  path in either slash the same key. On Windows the grant and the request
  compare paths without the `\\?\` prefix. Open in your browser is
  off for a local tab (`open_url` takes `http` and `https` only).
- **Why a scheme and not a `file:` load.** WebKit's file load with read
  access to a folder would give the web process read
  access to the whole folder tree, hidden files included, with no check on
  links, for as long as that process lives; it is macOS only and cannot be
  tested headless. The scheme checks every request, works on every platform
  and is a pure function under test. The cost: Tauri counts a page on a
  scheme the app registers as its own origin (`is_local_url` in Tauri 2.12),
  so for a local page the label wall in Capabilities is the only command
  wall. A web page never gets there.

## Tabs and windows

- A tab's webview is a child of the window that asked for it, labelled
  `browse-<id>`. It is created when the tab opens, never at boot.
- Only the owning window may drive a tab, and a `browse-` webview may drive
  none. Listing a session's tabs reaches only the calling window's tabs.
- Closing a session's tabs is one command, `browser_session_close`. The store
  calls it when a session is archived or deleted, and it reaches the session's
  tabs in every window, not only the caller's. It tries every tab and answers
  `{ closed, failed }`; a tab that failed to close stays listed, so calling
  again closes the rest. A tab or popup that was still opening in any window
  when the session closed is refused with `session-closing` and its webview is
  destroyed, as is a popup whose opener closed first; the session takes new
  tabs again afterwards. After the first pass the host looks for tabs that
  slipped in and closes those too.
  An open reads the session's generation before it waits for the lock and
  checks it again once it holds it, before any other workspace's views are
  closed.
- A tab's address in a listing is read from the live webview, so a page that
  moves with `history.pushState` or a fragment shows its new address.
- A destroyed window's tabs leave the registry with it.

## Lifecycle

A tab is in one of three states, shown as `state` in its facts.

- **live**: shown.
- **asleep**: hidden, webview still alive. Hiding stamps `hiddenSinceMs`.
- **closed**: the webview is destroyed. The registry keeps the tab's id, its
  last address, its title and the last place it was given, so the tab is still
  listed.

Hiding frees nothing, because a hidden webview keeps its memory (spike S8).
Only closing frees it, so two rules close a tab:

- **Ten minutes hidden.** A background thread sweeps every 30 seconds and
  closes each asleep tab hidden for 10 minutes or more. Showing the tab and
  hiding it again restarts the clock.
- **More than four live per window.** Opening, showing or hiding a tab that
  leaves a window with more than four live webviews (live and asleep, popups
  included) closes the asleep tab hidden the longest, then the next, until
  four remain. Hiding a tab in a window of five shown tabs therefore closes
  that tab at once.
  A shown tab is never closed by either rule, so a window of more than four
  shown tabs keeps them all.

Showing a closed tab builds its webview again at the stored address and place,
under the same id and the same `browse-` label, and it comes back live. The
page loads again, so its scroll and form state are gone. A closed tab refuses
navigate, reload, back and forward with `tab-closed`; show it first. Hiding a
closed tab answers its facts as they are, placing one only stores the place,
and closing one removes it from the registry.

A tab that changes state (live to asleep and back, asleep to closed, closed to
live) sends `browser://tab-state` with its facts to its own window, whoever
asked for the change. A call that finds the tab already in that state sends
nothing.

Nothing is created at boot. The sweep thread starts with the app and owns no
webview; the registry is empty until a window opens a tab. Every change of
state runs under one lock in the registry, so a show never meets a sweep
half way through destroying the same webview. That lock stays held across the
calls that wait on the main thread (building, showing and closing a webview,
and the event), so a slow webview build holds up the sweep and the other
commands for as long as it takes. The lock is taken before the registry's own
and no main-thread callback takes it, so this never deadlocks.

A tab the cap or the sweep closed is marked closed first and its webview
destroyed second, after its live address is stored. If the webview will not close, the tab goes back to asleep
and the next sweep tries again. A popup opened over the cap can close itself;
its facts, in the answer and in `browser://tab-opened`, then say `closed`.

## Profiles

A tab belongs to a workspace, and a workspace has its own browser profile:
cookies, local storage and every other site datum. A sign-in in one workspace
never shows in another. `browser_tab_open` takes the `workspaceId` the tab
belongs to; a blank one is refused with `invalid-workspace`. A popup uses its
opener's profile, and a closed tab comes back in the profile it left.

The profile is named by the workspace id: the first 16 bytes of a SHA-256 over
the id, written as 32 hex digits when it names a folder. The same workspace
always gets the same profile, two workspaces never share one, and the name
holds no character of the id, so no id can reach another path.

- **macOS 14 and later**: the profile is a WebKit data store with that
  identifier. WebKit keeps it; Goodboy sees no folder.
- **macOS 13 and older**: WebKit has no named stores, and Tauri falls back to
  the app's one store without saying so. Every workspace then shares one
  profile, so opening a tab never closes another workspace's views.
  `browser_profile_isolation` answers `shared` (and `perWorkspace`
  everywhere else) so the pane can warn, and `browser_profile_clear` refuses
  with `profile-shared`, because clearing would wipe every workspace.
- **Windows and Linux**: the profile is a data directory, `browser/profiles/<name>`
  in the app data folder, created before any view of another workspace is
  closed, so a folder that cannot be made fails the open and leaves the running
  workspace as it was. Tauri gives each distinct directory its own WebView2
  environment or WebKit context, so the stores are separate in one window.
  Linux needs no window of its own for this. The Linux pane limit (children do
  not take their bounds) is about placement, and belongs to the pane.

**One profile runs at a time, across every window.** Before a webview is
built, opening a tab or bringing a closed one back first closes the live and
asleep views of every other profile, under the same lock the lifecycle takes.
Those tabs stay listed as `closed`, keep their id, address and place, and each
window that owns one hears `browser://tab-state`. They come back lazily,
through the same show path as a tab the sweep closed, and showing one closes
the views of whichever profile was running. Cookies are not lost by a switch:
they sit in the profile's store. If a view will not close, it is put back as it
was, the open fails with `profile-busy`, and the views that did close stay
closed.

**Clearing a profile.** `browser_profile_clear` takes a `workspaceId`, refuses
with `profile-live` while any of the workspace's tabs is live or asleep (switch
to another workspace or close them first), and refuses with `profile-busy` when
the same profile is already being cleared. While it runs, opening or showing a
tab of that workspace is refused with `profile-busy`, so a view never opens on a
store being wiped. On macOS it removes the WebKit store; on Windows and Linux it
deletes the folder. A webview that is still shutting down can hold the store, so
the clear tries up to three times, 400 ms apart, and only then fails with the
platform's error; the user can try again. It answers `{ shouldRestart }`: Linux keeps its WebKit
context for the life of the app, so cookies already in memory outlive the
deleted folder and the answer is `true`; elsewhere it is `false`.

Windows and Linux are written against the Tauri and wry sources and have not
been run: the first run on each of them is the check (spike S3 was never run).

## Tab rows

The live webview is Rust's and is gone when the app quits. What outlives it is
a row of `browser_tabs`: an id, an owner, the address, the title and a
position. A row holds no cookie and no page content. The owner is a session or
a project, never both: a tab a session holds is a session tab, and a tab pinned
to a project is a pin that every session of the project shares.

- Rust writes the table (`browser/tab_rows.rs`), one command per verb:
  `browser_tab_rows_list`, `browser_tab_row_save`, `browser_tab_rows_reorder`,
  `browser_tab_row_delete`, `browser_session_tab_rows_delete`,
  `browser_tab_row_pin`, `browser_tab_row_unpin` and
  `browser_stale_tab_sessions`. Every command names its owner and never reads
  the current session.
- A save takes the address through the same rule as a live tab, so a row never
  holds an app address, and keeps the first 512 characters of the title. A
  local file is stored as its `file://` address, never its `gblocal` one. It
  drops a username and password from the address and keeps the query and the
  fragment, so a token in the query still lands in the row. A second save of an
  id updates its address and title and keeps its position.
  The position is the owner's largest plus one, and a reorder answers with the
  rows in their new order.
- A reorder must name exactly the owner's rows (`tab-rows-changed` otherwise),
  and a row only moves between owners through pin and unpin
  (`tab-row-owner` when the caller does not own it). Deleting a row that is
  already gone succeeds, so a retry is safe.
- The `browser` store slice (`store/slices/browser/`) keeps the rows as state:
  `browserSessionTabs` and `browserActiveTab` per session, `browserProjectPins`
  per project. An action changes state only after its command answered, and a
  failure leaves the old rows and reports the error on the session or the
  project's workspace. Writes of one session run one at a time in call order
  and never wait on another session, a load that answers after a newer load, a
  write or the session's eviction is dropped, and the active tab is state of this window only. A
  reorder that fails with `tab-rows-changed`, because another window added or
  closed a tab, reloads the session's rows.
- Archiving or deleting a session calls `closeBrowserSessionTabs`. It closes
  the session's live tabs in every window, then deletes the session's rows, and
  drops the session's keys from state. A tab still opening in any window when
  the close starts is refused. When a tab does not close, the rows stay, the
  error shows, and the archive or delete still goes through. Pins are not the
  session's rows, so they stay. The rows of a deleted session also go with it
  (`ON DELETE CASCADE`).
- Every boot runs `closeStaleBrowserTabs`. `browser_stale_tab_sessions` names
  the sessions that are archived and still hold rows, and the sessions that are
  archived or gone and still hold a live tab; each gets the same close. That is
  the retry of a close that failed, because after the archive or delete nothing
  else calls it.

## The pane

Browser at the foot of the right rail, on every screen, opens the pane in the
one side slot, the dock, as a tool drawer in the browser tier
(`DRAWER_KINDS.browser`, `toggleBrowserDock`), so the session rail folds to
icons while it is open. Search or Run opens it too, and Go › Show or Hide Browser
shows or hides it like the rail button. On a session
page it shows that session's tabs; anywhere else it shows the session the
Browser page would pick (`WorkspaceBrowserDock`, drawer `sessionId: null`), or
says there are no tabs yet, with no Open as page, since that page would be
empty too. It stays open across every move, beside any page
but the Browser page, and closes when the session it shows is archived or
deleted (`slotAfterSessionGone`). Pressing the tool again, the X or Esc on the pane closes
it; Esc inside the page goes to the page.

- **The width**: the pane opens at 720 and its edge drags from 480 to the room
  the session column leaves (it keeps 560 and the gutters), so on a wide window
  it goes well past the 1000 cap of the reader tier. It keeps its own saved
  width (`goodboy:browser-drawer-width:v1`). When a window resize leaves less
  room than the saved width, the pane shrinks to the room and keeps pushing
  while 720 fits; below that it lies over the page. The saved width is not
  rewritten by a resize and comes back when the window grows. The page follows
  the pane because the placement loop measures the placeholder every frame.

- **The address row** holds Back, Forward and Reload, the address, Pin to the
  session's project (Unpin when a pin is shown), Open in your browser, Open as
  page (see Moves) and Close. The first button toggles the tab list, and the pane remembers the
  choice (`goodboy:browser-tab-list:v1`).
- **⌘R reloads the shown tab** while the browser has the keyboard: a click or
  focus in the pane, or the page webview itself. The pane and the page register
  `model.reload` with `useReloadSurface` (the page as the main surface of its
  screen), and the menu bar brings ⌘R to the window page even when the page
  webview has focus, since a menu command never goes to a browser tab. ⌘⇧R
  reloads Goodboy ([shell.md](navigation/shell.md)).
- **The address rule** (`addressOf`): a full `http` or `https` address loads
  as typed; a bare host loads on `https`, and on `http` when it is
  `localhost`, a `*.localhost` name, an IPv4 address in `127.x`, `[::1]` or
  `0.0.0.0`. A name whose first label is `127` stays on `https`. A path that
  starts with `/` or `~/`, or a `file:` address, is a local file (see Local
  files). Words, a host with no dot and every other scheme are refused under
  the row. The pane never sends text to a search engine.
- **Tabs**: the strip shows the session's tabs, then the project pins with
  their title and a pin mark, then New tab. The list shows `Pinned · <project>`
  first, then This session, then New tab; the note that tabs close when the
  session is archived is the tooltip of the This session label. A tab the
  engine put to sleep or closed (`browser://tab-state`, read by
  `useTabStates`, corrected by every successful 1.5 second poll, and keyed by
  the engine's tab id so the Browser page marks tabs of every session) shows its favicon faint and
  a moon mark, "Asleep, may reload when opened" (an asleep webview comes back
  as it was, a closed one loads again). The list has three widths in
  `browserTabListPref`: `list` (192px), `rail` (36px of favicons, titles in
  tooltips) and `hidden`; the fold button cycles `list` and `rail`, and a pane
  under 560px wide shows the rail. The old boolean value reads as `list` or
  `hidden`. The Browser page rail uses the same rows and the same groups order.
  With no tab the pane shows an empty state and focuses the address.
- **Live tabs**: a row and a live webview are not the same thing. Opening a
  page asks the host for a hidden webview, saves its row with the webview's id
  and binds the two in `browserLiveTabs`. After a restart a row has no live
  webview; showing it opens one at the saved address and binds the new id. A
  pin shown in the pane is `browserShownPin`; pinning the shown tab keeps it on
  screen. The pane reads the live address and title every 1.5 seconds and
  saves a session tab's row whenever they differ from the stored row, a page
  that comes back to an earlier address included. A failed save is tried
  again at the next change.
- **Placement**: one loop (`createNativePlacement`) owns show, hide and
  `set_bounds`. Every frame, and whenever the view's frame changes size, it
  measures the placeholder (`viewBoundsOf`) and wants the shown tab at that
  rect, or no tab
  when the placeholder is gone, hidden or covered. It runs one host call at a
  time toward the latest wanted state, shows the new tab before hiding the old
  one, and drops a live id the host answers `tab-gone` for, so the next frame
  reopens the row. A view whose hide failed stays on its list and is hidden
  again on the next frame. A wake that answers after the wanted tab changed
  is never placed or shown. A failed wake stops trying that tab until Reload
  or a new address. Closing the pane hides the view. A pane that goes away
  while a host call still runs, or whose last hide failed, tries the hide
  again a few times after it is gone (`STOP_RETRIES`), because no frame will
  ask again. Before ⌘R reloads the window, every view a placement still owns
  is hidden (`hideOwnedViews`, capped wait): the reloaded page no longer knows
  their ids, so a shown view would stay painted with no pane around it.
  The `ResizeObserver`
  watches the view's frame (`BrowserView`), which is mounted whenever the pane
  is, never the placeholder inside it: the placeholder mounts later, once a tab
  is shown, so an observer started at mount would watch nothing. An error row
  or a tab strip that grows the chrome shrinks the frame and moves the native
  view at once, even when no frame runs.
- **Overlays**: a menu, a popover, a dialog or Search or run is any element that
  matches `OVERLAY_SELECTOR` (`shared/keyboard/overlaySelector.ts`). For a
  popover the cover check measures the children of `[data-dropdown-portal]`,
  because the wrapper itself has no height, and an element with no area never
  counts. A tooltip (`[role="tooltip"]`) covers the view too, but stays out
  of `OVERLAY_SELECTOR`, which also gates shortcuts. A studio page counts as
  well (`[data-studio-slot]`), but only for a view under it in the sheet: a
  Browser dock floating over a page at a narrow width sits above the page and
  keeps its view. The other way round, a Terminal dock floating over the
  Browser page makes the page's region inert (`[data-drawer-main][inert]`), and
  a view inside that region is hidden, so the native view never paints over
  the dock. While
  one intersects the placeholder, the view is
  hidden; an overlay elsewhere in the window leaves it shown. While the view is
  hidden under an overlay the placeholder shows a cover (`BrowserCover`) on the
  subtle surface: favicon, title, host and the reason in one line
  (`coverReasonText.ts`, from `createOverlayWatch().coverOf`: menu, dialog,
  tooltip or page). The cover goes one frame after the host showed the view
  again (`onShown` of `createNativePlacement`), so no frame has neither, and it
  stays when the show fails. Toasts keep left of the pane, even when it lies over
  the page (`toastRightOf`), and left of the Browser page's view, so they
  never sit under a view.
- **Writes** name the session and the tab. A state change waits for the host:
  open saves the row after `browser_tab_open` answered, close calls
  `browser_tab_close` (a `tab-gone` answer counts as closed) and then deletes the
  row. A failure keeps the old state and shows the words under the address
  row. An open that answers after a newer open, or after the pane closed, is
  closed and never shown; when only its row save answers that late, the tab
  is closed and its row deleted. A session close also forgets the session's
  live views and its shown pin. A popup the host opened (`browser://tab-opened`)
  becomes a session tab while the pane is open.

## The page

Open as page in the dock opens the Browser page, a studio kind of its own
(`{ kind: 'browser', sessionId, tabId }`), like the Terminal page. While it is
open the Browser button on the right rail is selected and does nothing.

- **The list** shows every tab of the workspace's sessions, one group per
  session in the workspace's session order, then one group of pins per
  project. It does not follow the sidebar's sort or filters, because a filter
  can hide a session that holds a tab. A pin opens in the picked session when
  it works on that project, else in the first session that does. The picked
  session keeps its group with no tab, so New tab opens a page in it. With
  pins and no session tab, the page opens on a session that hosts a pin. With
  neither, the page says so.
- **The view** is the pane's: the same address row (no list toggle and no
  Close, the band and Esc close the page), the same model for the picked
  session and the same placement loop and overlay rule. The dock stays in the
  store under its own page but is not mounted, so the page alone places the
  view.
- **One view, one place**: a placement owns the live ids it showed, and hides
  only a view it still owns, a hide tried again after a failure included. The
  pane's late hide cannot take the view off the page. A pane that still holds
  the view waits while the page owns it, and shows it again once the page
  lets it go.
- **The route** names the session and the tab. Picking a row amends it, and a
  close or a new tab moves it to the tab now shown. A reload of Goodboy (⌘⇧R) reads the
  route back, so the page comes back on the same tab, not the first one. A
  route with no session opens on the first session holding a tab, at its
  first tab, and names that session.
- **Back to the session**: the band's trail names the picked session, and
  pressing it opens that session. Dock, in the header, moves the page back
  into the dock on the tab (see Moves). The empty page keeps Dock too, and it
  opens the workspace dock, so the page is never a dead end.
- **The count** on the Browser button is the number of rows the page lists: the tabs of
  the workspace's sessions plus the pins of their projects, named
  `Browser, 3 tabs`. A tab counts whether or not its page is open. A
  session's rows load when its pane or the page opens.

## Moves

A move never reloads the page: the same live webview, with the same id, gets
new bounds or a new window. A form half typed and the scroll stay.

- **Open as page** in the pane's address row, shown with or without a tab,
  with the same arrow as the Terminal dock's header, pushes the Browser page
  on the session and the shown tab
  (`promoteBrowserTab`), so ⌘[ brings the dock back. The page's placement takes
  the view through the owner rule above and places it at the page's rect.
- **Dock** in the page's header closes the page and opens the dock on that
  session (`demoteBrowserTab`), beside the place under the page. The page's
  placement hides the view and lets it go, and the pane shows it at the pane's
  rect. The pane shows the tab the page showed, because both read the
  session's shown tab in this window.
- A host failure while the page places the view shows under the page's
  address row, and the view stays with the pane, which shows it again on
  Dock. A page show that answers after the tab went back
  is hidden again, and the pane takes the view.
- **Another window**: moving a tab to another window comes later.

## Doors

A door opens a page in a session's browser. Every door names the session it
sits in and the address, and one function opens it (`openInBrowser`).

- **Where it opens**: the door opens the dock on that session, beside the
  session view or beside a page over it (the Terminal page); on the Browser
  page it switches the page to that session. A door with no session, such as
  a terminal on a plain folder, opens your browser.
- **Which tab**: a tab of the session already on the same address is shown.
  A bare server address (`http://localhost:5173`) takes any tab on that
  server. Otherwise a new tab opens. A host failure keeps the old tabs and
  reports on the session. Every door that shows or opens a tab ends the New
  tab draft explicitly (`endBrowserDraft` bumps `browserDraftEnds`, which the
  pane watches), also when the tab it shows is
  already the active one. A later door wins: a door request cancels an older
  open still waiting on the host, so the tab the last click named is the one
  shown. A tab picked in ⌘K shows that exact tab (`showBrowserTab`), never the
  first tab on the same address.
- **Server chips**: the port chip on a terminal tab strip and the live port
  on a running Service open `http://localhost:<port>`.
- **Links**: a web link in what is written in a session (a conversation
  turn, a decision, an artifact) opens beside it. Those regions carry
  `data-browser-links` inside the session's `data-browser-session`, and
  `isBrowserLinkArea` checks both. A link anywhere else, such as an
  integration, sign-in or connect guide in a drawer, opens your browser as
  before, and so does a link outside a session. A GitHub commit link still
  opens its diff. Chips and rows need only `data-browser-session`.
- **The click rule**: one function, `openWebLink`, decides every plain web
  link click, on chips, session links, a Service's port and a terminal's
  printed addresses alike. ⌘-click (Ctrl-click off macOS) always opens your
  browser. Otherwise the Links setting (`links.open`, Settings › General ›
  Open with) decides: `goodboy`, the default, opens beside the session, and
  `browser` opens your browser. A door with no session opens your browser
  whatever the setting says. The click's modifier is read when the click
  lands, and the setting is read before the open starts; a setting that
  cannot be read counts as the default and reports a warning. The ⌘-click
  listener runs after the page's own handlers and skips a click they already
  handled, so an anchor with its own `onClick` opens your browser once.
  ⌘-click on a file path in a terminal still opens your editor.
- **Terminal links**: `GenericTerminalPanel` hands a printed web link and its
  click event to `onOpenWebLink`; with no prop it keeps opening your browser,
  as the provider's inline terminal does. The terminal pane passes the
  session of its tab, so a terminal on a plain folder has none.
- **Peek**: resting on or focusing a `localhost` link in a session, or
  resting on any web address in a terminal, shows a card with the title of
  its tab (or the host), the address and what a click does, in the words of
  `webLinkPeekWords.ts`, which read the same place `openWebLink` picks. The card
  never creates a tab, because every tab is a whole webview.
- **⌘L** focuses the address row while the pane is on screen or the Browser
  page is open. Elsewhere ⌘L stays Ask about this session, which held the
  chord first (`browser.address` is scoped, so it wins only there). A page
  that has focus keeps its keys, so ⌘L reaches the row only while Goodboy
  has focus.
- **⌘K** lists the browser tabs of the session Search or run is scoped to (the
  current session when it is not) and offers `Open <address>` first, beside
  that same session, for an address with `http` or `https` or a localhost
  name, or for a host with a port or a path. A typed path to a page, an image
  or a PDF gets `Open <path>` beside the session (`typedLocalPathOf`), and no
  entry with no session. With no workspace open the entry
  reads `In your browser` and opens your browser. A file name such as
  `foo.ts:42` or `plan.md/x` stays a search, as does a bare word with a dot
  (`typedAddressOf`).

## Performance

The browser costs nothing until a tab opens, and then stays inside a budget.
`features/browser/browserBudgets.ts` (`BROWSER_BUDGETS`) holds every number a
test or a release checks.

- **Never opened**: no `browser_*` host command, no frame request and no
  store commit run before the first tab. The pane (`LazyBrowserPane`) and the
  page (`renderStudio`) are lazy chunks, so the first bundle carries only the
  host calls and the tab actions; `bundle-budget.json` stays as it is. A
  webview is created only by `browser_tab_open`, never at boot.
- **A tab opens, switches and closes** in a fixed number of store commits
  (4, 1 and 1).
- **The view moves** with one host call per frame at most, and none for a
  frame where the placeholder did not move. A frame sets no React state and
  writes no store key, so it commits nothing in the pane or the conversation
  (the one write on the loop's path is unbinding a view the host lost). `sameBounds` drops a frame that did not move the view.
- **Memory** is the engine's, not React's. A live tab costs 70 to 110 MB and
  hidden tabs cost as much as shown ones on macOS, so only closing frees
  memory. Four tabs stay under 450 MB over the no tab state. A person
  measures it at each release (`docs/testing.md` → Manual release gate:
  browser memory); the phase 0 numbers are in the plan's spike S8.

## Capabilities

`capabilities/default.json` grants by webview label (`webviews`: `main`,
`win-*`), never by window. A grant by window reaches every webview inside
that window, a tab included; a grant by webview reaches only the window's own
page. No capability names a `browse-` label or grants a remote address.

Capabilities gate plugin commands only. An app command runs for any local
page unless its handler checks, so `lib.rs` wraps `generate_handler!` in
`browser::refuse_browser_pages`, which answers every app command from a
`browse-` webview with the `browser-caller` code before it runs.

## Passkeys

A tab can't finish a passkey sign-in on macOS. Answering a passkey request for
any site needs Apple's managed browser entitlement
(`com.apple.developer.web-browser.public-key-credential`), which Apple grants
only to an organization account whose app can be the default browser. Goodboy
has neither, so WebKit refuses the request at once.
Security keys and a phone go through the same request and fail the same way.

So the host watches for the request instead. On macOS every frame of a tab
runs a small script at document start that wraps `navigator.credentials.get`
and `create`: a call that asks for a passkey, unless it is only the quiet
autofill offer, posts to a native message handler
and then runs unchanged. A request whose options or bridge throw on read still
runs. The handler is added just after the view is made, so a request from the
first document looks for it again every 100 ms for two seconds. The handler
marks the tab's facts `isPasskeyBlocked`; an ask that lands before the tab is
registered is held and applied when it is. The pane and the page show a notice above that tab only,
with Open in your browser (the same action as the address row) and Dismiss.
Dismiss clears the mark on the host (`browser_tab_passkey_dismiss`); a new
document load clears it too. A refused dismiss keeps the notice and shows the
reason. After the hand-over the sign-in lives in the default browser: the tab's
workspace profile stays signed out.

## Known limits

- Tauri gives a tab the same initialization scripts as a window, and 2.12
  has no option to leave them out of a child webview. Every page in a tab
  sees `__TAURI_INTERNALS__` with the invoke key and the window and webview
  labels. The command wall is the guarantee, not the missing script
  (`docs/traps.md`).
- Tabs run with an unfrozen `Object.prototype` on purpose. `freezePrototype`
  in `tauri.conf.json` is off because Tauri adds it to every tab, and real
  sites that assign `toString` or `constructor` on a plain object broke under
  it. The app document freezes itself instead, with
  `public/freeze-prototype.js` as the first script of `index.html`.
- A tab sends a current Safari user agent on macOS (`TAB_USER_AGENT` in
  `browser/host.rs`). The bare WKWebView agent lacks the `Version/` and
  `Safari/` tokens, and sites such as Google then serve their legacy pages.
  Windows and Linux keep their engine's own agent.
- Back and forward are native on macOS: the host steps the WebKit view's own
  history, so a page cannot trap them. Tauri 2.12 exposes no
  native step, so on Windows and Linux they still run `history.back()` and
  `history.forward()` inside the page, which the page can redefine.

## Errors

A `browser_*` command fails with a reason code from `browser/reason.rs`
(`browser-caller`, `not-web-address`, `invalid-address`, `local-missing`,
`local-folder`, `local-type`, `tab-gone`,
`tab-closed`, `window-gone`, `other-window`, `too-many-popups`,
`session-closing`, `invalid-workspace`, `profile-busy`, `profile-live`,
`profile-shared`, `profile-unavailable`, `tab-row-gone`, `tab-row-owner`,
`tab-rows-changed`, `tab-rows-failed`), never a sentence. The pane owns the
words (`features/browser/browserFailureText.ts`).

## Under the hood

- `apps/desktop/src-tauri/src/browser/host.rs` builds a tab's webview with
  the rule, the popup path and the download refusal; `commands.rs` holds the
  sixteen `browser_*` commands; `local.rs` holds the `gblocal` scheme, the
  path rule and the grant check; `profile.rs` holds the profile id, the
  per-platform store, the switch and the clear; `registry.rs` holds the tabs, the popup seats
  (`MAX_HIDDEN_POPUPS`) and the pure picks of which tabs to close;
  `lifecycle.rs` holds the limits (`SLEEP_LIMIT_MS`, `MAX_LIVE_TABS`), the
  sweep, show, hide and place, and `browser://tab-state`. The native back and forward step lives in
  `src-tauri/src/platform/web_history.rs`. The passkey watch keeps its
  handler-to-tab map in `browser/passkey.rs`, its native handler class in
  `src-tauri/src/platform/passkey_handler.rs` and its script in
  `browser/passkey.js`; `host.rs` adds the script to every frame,
  registers the handler after the view is made, clears the mark on a page
  start and forgets the handler when the tab closes, when its open is refused
  late and when its window is destroyed (`forget_window`). The two `platform/`
  files are the only `unsafe` the host needs, which the unsafe ratchet in
  `proc/signal.rs` enforces.
- `guard::tests` pins every refused origin, the loopback aliases of the dev
  origin, `http` and `https` pages, `javascript:`, `data:`, `file:`,
  `about:blank` and `about:srcdoc` frames and a page that sends itself to the
  app, and walks redirect, form post, blank page and script sequences. It
  also fails when `lib.rs` registers a scheme the rule does not refuse. The
  rule is a pure function because no test can load a page headless.
  `browser::local::tests` pins the typed forms, the missing, folder and type
  refusals, the folder scope, a path that climbs, hidden files, a link out of
  the folder and one inside it, a file or folder swapped for a link after the
  check, the home folder and mounted volume limits, the token address, a
  typed query and fragment, and that a tab loads only what its own grant
  covers. `browser::tests` loads a typed file through its grant, drops the
  grant on close, brings a closed local tab back through the same grant at its
  query and fragment and refuses a `file:` address on the web path.
- `browser::tests` opens tabs on Tauri's mock runtime: the owning window, the
  refusals and their codes, an app command a `browse-` webview calls from a
  local address, the popup cap and its `browser://tab-opened` event, listing
  only the calling window's tabs, closing a session's tabs in every window
  and refusing a late open in any of them, a retry after a partial
  session close, a destroyed window, and that no production code looks a
  window up through `webview_windows` or `get_webview_window`. The native
  back step cannot run headless. The lifecycle tests pass the clock in: the
  timer close at 10 minutes less a millisecond and at 10 minutes, the cap
  close order, a closed tab shown again under its id and address, a shown tab
  that no sweep closes, the events, and that starting the lifecycle at boot
  leaves the registry and the webviews as they were. The profile tests pin a
  stable and distinct id and folder per workspace, that a switch closes the
  other workspace's views (in one window and across two) and announces it, that
  a closed view returns under its id, that a popup keeps its opener's profile,
  that a switch which cannot close one view restores it, closes the rest and
  succeeds on a retry, that a shared store closes nothing, that a folder that
  cannot be made leaves the running workspace alone, that a popup whose opener
  was switched out fails without a view, and that a clear refuses with live
  views, a second clear and a blank id, blocks opens while it runs and retries
  a failing wipe up to three times. The macOS store and the Windows and Linux
  folder are not reachable from the mock runtime.
- The page lives in `features/browser/components/BrowserStudio/`, its groups in
  `browserPageGroups.ts`, the route sync in `hooks/useBrowserStudioTab`.
  The sessions come from `browserScopeSessions`, the count from
  `browserTabCount`. `BrowserStudio/index.test.tsx` pins the grouping, a tab
  of another session, the reload back to the named tab, a route with no
  session, the overlay hide, that only the workspace's sessions load and
  the count matches the rows, and the moves: Open as page and Dock
  keep one live id with no open, navigate or reload, a failed place
  on the page shows its words and leaves the view to the pane, and a late page
  show is hidden again; `createNativePlacement.test.ts` pins the owner
  rule both ways, a failed hide retried after the page took the view, the
  hide after a pane left mid call or after a failed hide, and the hide before
  a reload; `leaveWithLiveTab.test.tsx` mounts `ux39-p11-browser-session` and
  checks that the view stays in the visible dock or is hidden when Chat or
  Settings opens and when the dock closes; `restoreLocation.test.ts` pins the route across a reload; the scenes are
  `browser-page` and `browser-page-dark`.
- `passkey::tests` pins that an ask reaches only its own tab, that a
  respawned tab or a reused handler address belongs to the newest tab and
  that a closed tab is forgotten; `registry.rs` pins the mark and its clear
  per tab and an ask held until its tab registers; `browser::tests` pins that
  a destroyed window forgets its tabs' handlers. `features/browser/passkeyWatchScript.test.ts` runs the script on a
  fake page: a passkey `get` or `create` is reported and still runs, a
  conditional or non-passkey request stays quiet, a handler that arrives late
  is still told and one that never arrives is given up on, and throwing
  options, a throwing bridge or a broken handler never break the page. `BrowserPane/index.test.tsx` and
  `BrowserStudio/index.test.tsx` pin the notice on its tab, Open in your
  browser, Dismiss on the host and a refused dismiss; the scenes are
  `browser-pane-passkey` and `browser-pane-passkey-dark`. The native handler
  cannot run headless.
- `apps/desktop/src/__tests__/regressions/browser-isolation.test.ts` fails
  when a capability could match a `browse-` label, grants by window or grants
  a remote address. `csp-img-src.test.ts` pins `frame-ancestors 'none'`.
- `add_child` needs the `unstable` feature of `tauri`, so `Cargo.toml` pins
  the minor (`~2.12`). A Tauri bump is its own pull request, with the spikes
  run again.
- `browser::tab_rows::tests` runs every row command against the migrated
  schema: save and update, positions, reorder, ownership, pin and unpin, the
  cascade with a session and a project, the address rule with its stripped
  credentials, and the sessions whose tabs outlived them.
  `store/slices/browser/index.test.ts` drives the slice through `storyHarness`
  with a fake host: open, close, reorder, pin, a failure that keeps the old
  rows, a late load, a second window loading the same rows, a reorder that
  reloads on `tab-rows-changed`, a hung write in one session that does not hold
  back another, the close on archive and the boot retry.
  `archiveTask.test.ts` and `deleteTask.teardown.test.ts` pin that archive and
  delete call it, and `archiveTask.test.ts` that no tab state is left for the
  archived session.
- The pane lives in `apps/desktop/src/features/browser/`: `browserHost.ts`
  calls the live tab commands, `addressOf.ts` is the address rule,
  `createNativePlacement.ts` and `hooks/useNativePlacement` own placement, and
  `createOverlayWatch.ts` finds an overlay over the view.
  `components/BrowserPane/index.test.tsx` drives it through `storyHarness` with a
  fake host: open and show at the placeholder, refused words with no host
  call, navigation and history by live id, a refused navigation, close before
  the row delete, pin, an overlay over the view and one elsewhere, a late open
  closed, a failed hide tried again, a late wake never shown, a failed wake
  woken again by Reload, a revisited address saved, a failed save tried again
  and the view hidden when the pane closes. It also opens a typed local file
  through `browser_tab_open_local` with its path in the row, moves the shown
  tab with `browser_tab_navigate_local`, shows the words for a missing file,
  and places the view lower when the address error grows the chrome with no
  frame running. `createOverlayWatch.test.ts` pins
  the cover check for a popover with no role, for tooltips and for a page view
  under an overlay dock, and the reason per overlay kind. The mock scene
  `browser-pane-cover` (light and dark) opens a menu over the page.
  `addressOf.test.ts` pins the address rule. The mock scenes `browser-pane` and `browser-pane-tabs` (light
  and dark) draw a stand in where the native view goes.
- The doors: `openInBrowser.ts` opens, `tabForAddress.ts` picks the tab,
  `openWebLink.ts` is the click rule (`webLinkPlace.ts` is its pure answer,
  `isOwnBrowserClick.ts` reads the modifier, `shared/lib/linksOpenOf.ts` and
  `linksOpenSetting.ts` read and name the setting), `sessionOfElement.ts`
  reads `data-browser-session`, `claimSessionLink.ts` takes a link from the
  shared interceptor (`useCommitLinkInterceptor`), `hooks/useOwnBrowserLinkClicks`
  takes ⌘-click and `components/BrowserLinkDoors` draws the peek through
  `WebLinkPeek.tsx`, which the terminal pane draws too
  (`terminal/hooks/useTerminalWebLinks`). The ⌘K entries come from
  `palette/hooks/useBrowserEntries` and `typedAddressOf.ts`.
  `doors.test.tsx` pins each door with a fake host: a chip opening a new tab
  and reusing one, ⌘-click and a session-less chip calling the system opener,
  a service row, a door on a page, a host failure, links in and out of a
  session, the peek, the Links setting set to your browser on a chip, a link
  and the peek, ⌘L beside Ask and the ⌘K entries. `openWebLink.test.ts` pins
  ⌘-click over the setting, `goodboy` with and without a session and
  `browser`; `webLinkPeekWords.test.ts` pins the peek words against the place;
  `GenericTerminalPanel/webLinks.test.tsx` pins that the addon's click reaches
  `onOpenWebLink` with its event and that a hover reports the row;
  `LinksOpenField/index.test.tsx` pins the row reading, saving and keeping the
  old value on a failed save. `tabForAddress.test.ts` pins the tab match; the
  scenes are `browser-peek`, `browser-peek-dark`, `settings-links` and
  `settings-links-dark`.
- The budgets: `features/browser/browserBudgets.ts` holds the numbers.
  `browserBudgets.test.tsx` runs in the unit project and counts, never times:
  no `browser_*` command and no frame request while no tab was opened, the
  store commits to open, switch and close a tab, one host call per frame while
  the view moves and none while it rests, no commit in React or the store in
  either case, and that `docs/testing.md` still names the manual gate's
  numbers. `viewBoundsOf.perf.test.ts` times one measure over a 500 row page
  with open menus in the perf project. The memory numbers are checked by hand
  at each release (`docs/testing.md` → Manual release gate: browser memory).
