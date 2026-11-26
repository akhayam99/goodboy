# The browser pane

> **Read this when** you change the Browser dock beside a session, its
> address row, tabs, find, More or live tabs. **Not for** placing the native
> view ([placement.md](placement.md)).

Browser at the foot of the right rail opens the pane in the one side slot, as
a tool drawer in the browser tier (`DRAWER_KINDS.browser`,
`toggleBrowserDock`), and the session rail folds to icons. Search or Run and
Go › Show or Hide Browser toggle it too.

- It shows the session page's tabs, or elsewhere the session the Browser page
  would pick (`WorkspaceBrowserDock`, drawer `sessionId: null`), or no tabs
  yet, without Open full page.
- It stays open across moves, beside any page but the Browser page, and closes
  when its session is archived or deleted (`slotAfterSessionGone`).
- The tool, the X or Esc on the pane closes it; Esc inside the page goes to the
  page. On the Desk ⌘W closes it, and the last tool closing shows **Desk
  closed** with **Reopen**, which returns it on its address.

The pane opens at 720 and drags from 480 to the room the session column leaves
(it keeps 560 and the gutters), past the reader tier's 1000 cap. It keeps its
own width (`goodboy:browser-drawer-width:v1`). When a resize leaves less room,
the pane shrinks to the room and keeps pushing while 720 fits; below that it
lies over the page. A resize never rewrites the saved width.

## The address row

The one row of the pane (`BrowserAddressRow`, `PANE_RHYTHM.firstRow`), under
its head (`DockPanelHead`: title, Open full page, Close; the head moves the
pane, [dock-grid.md](../navigation/dock-grid.md)). It holds Back,
Forward, Reload, the tabs, New tab, Pin to the session's project (Unpin for a
shown pin), Select an element ([pick.md](pick.md)), Console
([console.md](console.md)) and More.

- Under 560px of row (`NARROW_ROW_PX`), `foldedBrowserRowsOf` moves Pin to the
  top of More, which always holds Open full page.
- The page sits flush under the row (`BrowserView`, `data-browser-frame`) with
  no card, border, inset or line: a `border-t` there is a divider the divider
  guard refuses.

### Loading, Back and Forward

From the shown tab's `started` to its `finished`, a 2px `info` line breathes
on the row's bottom edge (`BrowserLoadLine`), with no percentage, and Reload
becomes Stop (`browser_tab_stop`; a refusal keeps the line and shows the
words).

- A `finished` for another address than the load that started is dropped, and
  an event for a tab the session does not hold is ignored.
- With no `finished` for 30 seconds the line goes off silently
  (`LOAD_STALL_MS`): a slow page is not an error.

Back and Forward read `browser_history_state` (`canGoBack`, `canGoForward`) when
the shown address changes and when a load ends, and disable for real. On
Windows and Linux, which cannot tell, both stay on.

### The address pill

The pill (`BrowserAddressPill`) shows the favicon, the title (`model.titleOf`)
and the host muted, or the host alone before a title. A click or ⌘L swaps it
for the command field with the URL selected. Esc (an escape layer), blur or a
row that went through swaps it back and drops the draft. A refused address
keeps the field and the reason under the row.

The favicon is the page's icon or a letter tile (`BrowserFavicon`), the same on
every row of the origin. Rust fetches it once per origin (`browser/favicon.rs`,
`browser_favicon`): `/favicon.ico`, then up to three `<link rel="icon">`
addresses. An icon must be `http` or `https` on the page's own host, an image
under 64 KB, with no redirect off the host. The answer, a miss included, is
kept for the run. The request carries no cookie and no profile, and the app
reads the icon as a data URL.

### The command field

The command field (`useCommandField`, `BrowserCommandPanel`) suggests only
while words are typed; focus alone opens nothing. The suggestions float in a
popover under the address row and as wide as it (`AnchoredLayer`,
`data-dropdown-portal`). It moves nothing, and the view hides under its cover
while it crosses it ([placement.md](placement.md#overlays)).

Groups, in order and only when they have rows (`commandRowsOf`):

- **Open**: the typed address, Beside this session on ↩, In your browser on ⌘↩.
- **Tabs**: every session's tabs and the project pins, this session first,
  pins tagged, another session named (`matchTabs`).
- **Visited**: up to six of this session's matching addresses.

Every typed word must match a row's title, host or path, else one line reads
"No tab or address matches". The arrows move and wrap, ↩ runs, ⌘↩ opens in
your browser. A tab of another session shows in that session's browser.

### The address rule

`addressOf` reads typed text:

- A full `http` or `https` address loads as typed.
- A bare host loads on `https`, or on `http` for `localhost`, a `*.localhost`
  name, `127.x`, `[::1]` or `0.0.0.0`. A name whose first label is `127` stays
  on `https`.
- A path starting with `/` or `~/`, or a `file:` address, is a local file
  ([local-files.md](local-files.md)).
- Words and a host with no dot match tabs and visits instead. Other schemes
  get no Open row.

The pane never sends text to a search engine.

## Find in page

⌘F, while the browser is on screen, opens a second 32px row under the address
row (`useFindInPage`, `BrowserFindBar`). It takes room from the page, so the
view shrinks instead of sitting under it.

1. Each keystroke clears the selection and calls `browser_find`, which runs
   `window.find` through `Webview::eval_with_callback` and answers `isFound`.
2. The bar reads Found or Not found, with no count (`window.find` gives none);
   WebKit draws the highlight.
3. ↩ and ⇧↩ step forward and back, wrapping.
4. Esc or Done sends an empty needle, which only removes the selection, and
   closes the bar.

A failed search, or an asleep tab with no view, reads "Couldn't search this
page" and keeps the bar. The latest request wins: an answer for an older
needle or another tab is dropped, and showing another tab empties the result.
The host refuses a needle over 200 characters (`needle-too-long`), and the
field stops at 200.

## More

More (`BrowserMoreMenu`, off rules in `browserMoreRows.ts`) holds, after any
rows the narrow row folded in: Send to agent
([doors.md](doors.md#send-to-agent)), Open in your browser, Open full page
([page.md](page.md#moves), absent when the dock has no page), Copy address,
Duplicate (`model.duplicate`, the shown address in a new tab), Develop and
Close tab (off for a pin). Develop holds the width presets (absent with no tab
shown) and, on macOS, Inspect in Safari; its hint names the current preset.

### Width presets

Desktop, Tablet 768 and Phone 390 come from one table,
`features/browser/devicePresets.ts`, for the menu, the frame and the note.

- The preset is kept per tab id in `browserDevicePresets`, in memory: it
  survives a tab switch, not a restart, and each window keeps its own.
- A narrower preset draws `BrowserDeviceFrame` as the padding and border of the
  box around the placeholder, never an overlay over the page rect.
  `viewBoundsOf` caps and centers the placeholder at that width, and that is
  the rect `browser_tab_place` sends.
- On macOS `useDeviceAgent` then calls `browser_user_agent`, which sets the
  `WKWebView` custom agent through `with_webview` and reloads
  (`platform/web_user_agent.rs`; Desktop restores `TAB_USER_AGENT`). The hook
  loops until each live tab's agent matches its preset, so a late answer is
  corrected and a tab that wakes gets its agent again.
- A refused call keeps the width and reads "Width only, the user agent didn't
  change" with an error line naming the tab. Off macOS the call is skipped
  and the note says only the width changes.

The note under the row names the preset and says touch isn't simulated:
pointer, hover and pixel ratio stay desktop. Desktop is the undo. Scenes:
`browser-width-phone`, `browser-width-tablet`.

### Inspect in Safari

Inspect in Safari puts the shown tab in Safari's Develop menu. `model.inspect`
calls `browser_tab_inspectable`, which sends the public `setInspectable:`
selector through `with_webview` (`platform/web_inspect.rs`).

- It needs macOS 13.3 or later; the host checks the selector and otherwise
  refuses with `unsupported-platform`, as it does off macOS.
- The row is absent off macOS and disabled with no tab shown. A line under the
  row says to pick the tab in Safari's Develop menu (turned on in Safari's
  settings).
- The property stays on until the tab closes.

The `devtools` cargo feature stays off and no private selector is used, so
only a tab the person chose is inspectable; `browser::tests` fails on
`open_devtools`, `_inspector`, `developerExtrasEnabled` in production code or
`devtools` in `Cargo.toml`. Safari cannot attach headless, so the manual gate
lists it (`docs/testing.md` → Manual release gate: inspect in Safari).

## ⌘R reloads the shown tab

While the browser has the keyboard (focus in the pane or the page webview),
⌘R reloads the shown tab. The pane and the page register `model.reload` with
`useReloadSurface`, and the menu bar brings ⌘R to the window even when the page
has focus, since a menu command never goes to a browser tab. ⌘⇧R reloads Goodboy ([shortcuts.md](../navigation/shortcuts.md)).

## Tabs

The tabs sit in the address row (`BrowserTabStrip`, one horizontal
`ScrollFade`): the project pins as square favicons (a group named
`Pinned · <project>` for assistive tech), a separator, then the session's tabs.

- The shown tab is the pill (`data-browser-tab="active"`): it takes the free
  room and has Close for a session tab.
- Another tab is a `BrowserTabChip` that shrinks to its icon before the row
  scrolls. The shown tab scrolls into view.
- An inactive tab has no Close, since hover-only buttons are not allowed: show
  it first, or press ⌘W.
- Right click opens the tab menu (Add to message, `browserTabTargetOf`).
- With no tab shown, the command field ends the row, New tab leaves it, and
  the pane shows an empty state.

An asleep or closed tab shows its favicon faint and says "Asleep, opens at its
address and may reload" in its name and tooltip. `useTabStates` reads
`browser://tab-state`, corrects it on every event and list answer, and keys it
by engine tab id, so the Browser page marks every session's tabs.

### Live tabs

A row and a live webview are not the same thing.

1. Opening a page asks the host for a hidden webview, saves the row with its id
   and binds the two in `browserLiveTabs`.
2. After a restart a row has no webview; showing it opens one at the saved
   address and binds the new id.
3. A pin shown in the pane is `browserShownPin`; pinning the shown tab keeps it
   on screen.

`browser://tab-load` `finished` and `browser://tab-state` drive the live
address and title. The pane saves a session tab's row whenever they differ
from the stored row, an earlier address included, and tries a failed save at
the next change.

A 1.5 second list is only a safety net for address moves with no load. It runs
while the pane is on screen with an awake bound tab, plus once when the pane
opens and once when it returns. An answer for a session the pane left is
dropped, and the host reads no address from an asleep tab.

### Coming back

Leaving the session parks the Browser and its tab sleeps.

- On mount, on a tab pick and when a binding arrives, the pane asks the host
  about each live page it shows (`useParkedTab`) and places nothing until that
  answer; an answer for a page no longer shown is dropped. A page this window
  just opened shows without asking.
- A tab the engine closed meanwhile (ten minutes hidden or the cap) is not
  reopened on its own: the pane shows `localhost:4010 · asleep`, "The page
  closed while you were away. It reloads at its address." and **Wake**, which
  rebuilds the webview at its address.
- A tab only asleep returns as it was, with no card; a failed ask shows the tab
  as before.

## Writes

Writes name the session and the tab, and wait for the host.

- Open saves the row after `browser_tab_open` answered. Close calls
  `browser_tab_close` (`tab-gone` counts as closed), then deletes the row.
- A failure keeps the old state and shows the words under the address row.
- An open that answers after a newer open or after the pane closed is closed
  and never shown; if only its row save is late, the tab is closed and the row
  deleted.
- A session close forgets the session's live views and its shown pin.
- A popup the host opened (`browser://tab-opened`) becomes a session tab while
  the pane is open.

## Under the hood

- `apps/desktop/src/features/browser/`: `browserHost.ts` calls the live tab
  commands and `addressOf.ts` is the address rule. `store/slices/browser-host/`
  holds the loads by live tab id and the icons by origin. `browser/find.rs`
  builds the find script.
- Tests: `components/BrowserPane/index.test.tsx`, `parked.test.tsx` (coming
  back), `hostFacts.test.tsx` (load line, history, icons), `keys.test.tsx`
  (find), `addressOf.test.ts` and `browser/find.rs`.
- Scenes, light and dark: `browser-pane`, `browser-pane-tabs`,
  `browser-pane-address`, `browser-pane-field`, `browser-pane-more`,
  `browser-pane-loading`, `browser-pane-find`, `browser-pane-find-missing`.
