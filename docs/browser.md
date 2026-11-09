# Browser host

> **Read this when** you are changing how Goodboy opens, places or closes a
> web page inside a window, what such a page may reach, the browser pane
> beside a session or the Browser page. **Not for** the other doors (server
> chips, links, ⌘K), which are not built yet, or the data disclosure users
> read (`SECURITY.md`).

A browser tab is a native webview that Rust places inside a Goodboy window,
next to the app's own page. Rust owns every tab. The window asks for a tab
through a command, gets an opaque id back, and from then on only places,
shows, hides, navigates and closes that id.

## The invariant

**A page in a tab reaches no Goodboy command.** Tauri decides whether a page
may call a command by its address, not by the webview's name: a page on the
app's own origin is local, and a local page may call every command. So the
host refuses every navigation that would make a tab local. That refusal is
the first wall. The label is the second: no capability grants a `browse-`
webview, and no app command runs for one (see Capabilities).

## The navigation rule

The rule lives in `apps/desktop/src-tauri/src/browser/guard.rs` and runs in
`on_navigation`, in `on_new_window` and before every command that loads an
address.

- Only `http` and `https` load. `javascript:`, `data:`, `blob:`, `file:` and
  every other scheme are refused.
- `about:blank` and `about:srcdoc` pass at any time. Such a page or frame
  takes its creator's origin, so it can never make a tab local. A new tab may
  start on `about:blank`, never on `about:srcdoc`.
- The app's own origins are refused even on `http`: `tauri://localhost`,
  `http://tauri.localhost` and `https://tauri.localhost` (Windows), every
  scheme Goodboy or Tauri registers (`tauri`, `ipc`, `asset`, `gbframe`) and
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
  is refused with `too-many-popups` in the log. Showing or closing one frees
  its seat. Otherwise nothing opens.
- Every download is refused. Asking before a download is not built yet.

Phase 0 spike S2 proved the wall: a page in a tab got none of six probe
commands, and got all six once it navigated itself to the dev origin or to
`tauri://localhost`, until this rule refused those navigations.

## Tabs and windows

- A tab's webview is a child of the window that asked for it, labelled
  `browse-<id>`. It is created when the tab opens, never at boot.
- Only the owning window may drive a tab, and a `browse-` webview may drive
  none. Listing a session's tabs and closing them reach only the calling
  window's tabs.
- Closing a session's tabs is one command, `browser_session_close`. The store
  calls it when a session is archived or deleted. It tries every tab and answers
  `{ closed, failed }`; a tab that failed to close stays listed, so calling
  again closes the rest. A tab or popup that was still opening when the
  session closed is refused with `session-closing` and its webview is
  destroyed; the session takes new tabs again afterwards.
- A tab's address in a listing is read from the live webview, so a page that
  moves with `history.pushState` or a fragment shows its new address.
- A destroyed window's tabs leave the registry with it.
- The registry stamps when a tab was hidden. The sleep and close policy reads
  that stamp; it is not built yet.

## Tab rows

The live webview is Rust's and is gone when the app quits. What outlives it is
a row of `browser_tabs`: an id, an owner, the address, the title and a
position. A row holds no cookie and no page content. The owner is a session or
a project, never both: a tab a session holds is a session tab, and a tab pinned
to a project is a pin that every session of the project shares.

- Rust writes the table (`browser/tab_rows.rs`), one command per verb:
  `browser_tab_rows_list`, `browser_tab_row_save`, `browser_tab_rows_reorder`,
  `browser_tab_row_delete`, `browser_session_tab_rows_delete`,
  `browser_tab_row_pin` and `browser_tab_row_unpin`. Every command names its
  owner and never reads the current session.
- A save takes the address through the same rule as a live tab, so a row never
  holds a local address, and keeps the first 512 characters of the title. A
  second save of an id updates its address and title and keeps its position.
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
  project's workspace. Writes run one at a time in call order, a load that
  answers after a newer load or a write is dropped, and the active tab is
  state of this window only.
- Archiving or deleting a session calls `closeBrowserSessionTabs`. It closes
  the live tabs, then deletes the session's rows. When a tab does not close, the
  rows stay, the error shows, and the archive or delete still goes through; the
  next call closes the rest. Pins are not the session's rows, so they stay. The
  rows of a deleted session also go with it (`ON DELETE CASCADE`).

## The pane

The Browser tool in a session's tools column opens the pane in the session's
one side slot, as a tool drawer in the reader tier (`DRAWER_KINDS.browser`),
so the session rail folds to icons while it is open. Pressing the tool again,
the X or Esc on the pane closes it; Esc inside the page goes to the page.

- **The address row** holds Back, Forward and Reload, the address, Pin to the
  session's project (Unpin when a pin is shown), Open in your browser and
  Close. The first button toggles the tab list, and the pane remembers the
  choice (`goodboy:browser-tab-list:v1`).
- **The address rule** (`addressOf`): a full `http` or `https` address loads
  as typed; a bare host loads on `https`, and on `http` when it is
  `localhost`, a `*.localhost` name, an IPv4 address in `127.x`, `[::1]` or
  `0.0.0.0`. A name whose first label is `127` stays on `https`. Words,
  a host with no dot and every other scheme are refused under the row. The
  pane never sends text to a search engine.
- **Tabs**: the strip shows the session's tabs, then the project pins with
  their title and a pin mark, then New tab. The list shows This session and Pinned for the project, with
  the note that tabs close when the session is archived. With no tab the pane
  shows an empty state and focuses the address.
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
  `set_bounds`. Every frame, with a `ResizeObserver` as backup, it measures the
  placeholder (`viewBoundsOf`) and wants the shown tab at that rect, or no tab
  when the placeholder is gone, hidden or covered. It runs one host call at a
  time toward the latest wanted state, shows the new tab before hiding the old
  one, and drops a live id the host answers `tab-gone` for, so the next frame
  reopens the row. A view whose hide failed stays on its list and is hidden
  again on the next frame. A wake that answers after the wanted tab changed
  is never placed or shown. A failed wake stops trying that tab until Reload
  or a new address. Closing the pane hides the view.
- **Overlays**: a menu, a popover, a dialog or the palette is any element that
  matches `OVERLAY_SELECTOR` (`shared/keyboard/overlaySelector.ts`). For a
  popover the cover check measures the children of `[data-dropdown-portal]`,
  because the wrapper itself has no height, and an element with no area never
  counts. A tooltip (`[role="tooltip"]`) covers the view too, but stays out
  of `OVERLAY_SELECTOR`, which also gates shortcuts. A studio page counts as
  well (`[data-studio-slot]`), because it sits over the session without
  unmounting the pane. While one intersects the placeholder, the view is
  hidden; an overlay elsewhere in the window leaves it shown. Toasts keep left of the pane, even when it lies over
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

The Browser tile in the sidebar opens the Browser page, a studio kind of its
own (`{ kind: 'browser', sessionId, tabId }`), like the Terminal page.

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
  session and the same placement loop and overlay rule. The pane of that
  session stays mounted under the page and is covered by it, so its view hides.
- **One view, one place**: a placement owns the live ids it showed, and hides
  only a view it still owns, a hide tried again after a failure included. The
  pane's late hide cannot take the view off the page. A pane that still holds
  the view waits while the page owns it, and shows it again once the page
  lets it go.
- **The route** names the session and the tab. Picking a row amends it, and a
  close or a new tab moves it to the tab now shown. A reload or ⌘R reads the
  route back, so the page comes back on the same tab, not the first one. A
  route with no session opens on the first session holding a tab, at its
  first tab, and names that session.
- **Back to the session**: the band's trail names the picked session, and
  pressing it opens that session.
- **The count** on the tile is the number of rows the page lists: the tabs of
  the workspace's sessions plus the pins of their projects, named
  `Browser, 3 tabs`. A tab counts whether or not its page is open. A
  session's rows load when its pane or the page opens.

## Capabilities

`capabilities/default.json` grants by webview label (`webviews`: `main`,
`win-*`), never by window. A grant by window reaches every webview inside
that window, a tab included; a grant by webview reaches only the window's own
page. No capability names a `browse-` label or grants a remote address.

Capabilities gate plugin commands only. An app command runs for any local
page unless its handler checks, so `lib.rs` wraps `generate_handler!` in
`browser::refuse_browser_pages`, which answers every app command from a
`browse-` webview with the `browser-caller` code before it runs.

## Known limits

- Tauri gives a tab the same initialization scripts as a window, and 2.12
  has no option to leave them out of a child webview. Every page in a tab
  sees `__TAURI_INTERNALS__` with the invoke key and the window and webview
  labels, and runs under the `freezePrototype` script from `tauri.conf.json`
  (not yet checked in a real tab). A site that assigns `toString` or
  `constructor` on a plain object throws in strict mode there. The command
  wall is the guarantee, not the missing script (`docs/traps.md`).
- Back and forward are native on macOS: the host steps the WebKit view's own
  history, so a page cannot trap them. Tauri 2.12 exposes no
  native step, so on Windows and Linux they still run `history.back()` and
  `history.forward()` inside the page, which the page can redefine.

## Errors

A `browser_*` command fails with a reason code from `browser/reason.rs`
(`browser-caller`, `not-web-address`, `invalid-address`, `tab-gone`,
`window-gone`, `other-window`, `too-many-popups`, `session-closing`,
`tab-row-gone`, `tab-row-owner`, `tab-rows-changed`, `tab-rows-failed`), never
a sentence. The pane owns the words (`features/browser/browserFailureText.ts`).

## Under the hood

- `apps/desktop/src-tauri/src/browser/host.rs` builds a tab's webview with
  the rule, the popup path and the download refusal; `commands.rs` holds the
  eleven `browser_*` commands; `registry.rs` holds the tabs and the popup
  seats (`MAX_HIDDEN_POPUPS`). The native back and forward step lives in
  `src-tauri/src/platform/web_history.rs`, the only `unsafe` the host needs.
- `guard::tests` pins every refused origin, the loopback aliases of the dev
  origin, `http` and `https` pages, `javascript:`, `data:`, `file:`,
  `about:blank` and `about:srcdoc` frames and a page that sends itself to the
  app, and walks redirect, form post, blank page and script sequences. It
  also fails when `lib.rs` registers a scheme the rule does not refuse. The
  rule is a pure function because no test can load a page headless.
- `browser::tests` opens tabs on Tauri's mock runtime: the owning window, the
  refusals and their codes, an app command a `browse-` webview calls from a
  local address, the popup cap and its `browser://tab-opened` event, listing
  and closing only the calling window's tabs, a retry after a partial
  session close, a destroyed window, and that no production code looks a
  window up through `webview_windows` or `get_webview_window`. The native
  back step cannot run headless.
- The page lives in `features/browser/components/BrowserStudio/`, its groups in
  `browserPageGroups.ts`, the route sync in `hooks/useBrowserStudioTab`.
  The sessions come from `browserScopeSessions`, the count from
  `browserTabCount`. `BrowserStudio/index.test.tsx` pins the grouping, a tab
  of another session, the reload back to the named tab, a route with no
  session, the overlay hide, and that only the workspace's sessions load and
  the count matches the rows; `createNativePlacement.test.ts` pins the owner
  rule both ways and a failed hide retried after the page took the view;
  `restoreLocation.test.ts` pins the route across a reload; the scenes are
  `browser-page` and `browser-page-dark`.
- `apps/desktop/src/__tests__/regressions/browser-isolation.test.ts` fails
  when a capability could match a `browse-` label, grants by window or grants
  a remote address. `csp-img-src.test.ts` pins `frame-ancestors 'none'`.
- `add_child` needs the `unstable` feature of `tauri`, so `Cargo.toml` pins
  the minor (`~2.12`). A Tauri bump is its own pull request, with the spikes
  run again.
- `browser::tab_rows::tests` runs every row command against the migrated
  schema: save and update, positions, reorder, ownership, pin and unpin, the
  cascade with a session and a project, and the address rule.
  `store/slices/browser/index.test.ts` drives the slice through `storyHarness`
  with a fake host: open, close, reorder, pin, a failure that keeps the old
  rows, a late load, a second window loading the same rows and the close on
  archive. `archiveTask.test.ts` and `deleteTask.teardown.test.ts` pin that
  archive and delete call it.
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
  and the view hidden when the pane closes. `createOverlayWatch.test.ts` pins
  the cover check for a popover with no role and for tooltips.
  `addressOf.test.ts` pins the address rule. The mock scenes `browser-pane` and `browser-pane-tabs` (light
  and dark) draw a stand in where the native view goes.
