# Traps in browser tabs

> **Read this when** you change a browser tab, an overlay that can open over
> one, the capabilities or the command handler list, a browser profile, or a
> script Tauri or a plugin injects. **Not for** how the browser pane works
> ([../browser.md](../browser.md)).

## A browser tab is a native view above the page, and its label is not its guard

A tab ([../browser.md](../browser.md)) is a native webview drawn above the app's DOM that takes every click in its rect. Its label guards nothing.

### An overlay over a tab is drawn under it

A menu, toast, ⌘K or drawer over the tab's rect is drawn under it: move it out or hide the tab, never raise a `z-index`.

- The pane hides the view only for an element matching `OVERLAY_SELECTOR` (`shared/keyboard/overlaySelector.ts`) that intersects the placeholder. A new floating surface carries `dialog`, `menu`, `listbox`, `alertdialog` or `data-dropdown-portal`.
- A surface that covers the session without unmounting it, like the studio slot, joins the cover list in `createOverlayWatch`.
- `[role="tooltip"]` is in that list but not in `OVERLAY_SELECTOR` (which also gates shortcuts), so an intersecting tooltip hides the view; give a control above it `tooltipSide="top"`.

Place, show or hide a tab only through `createNativePlacement`; a second caller races its loop. While the tab's page has focus only a native menu accelerator reaches the app, never a JS-only shortcut.

### The command wall is the guard, not the label

Never add a `browse-` label, a `*` pattern, a `windows` list or a `remote` block to a capability (`browser-isolation.test.ts` fails). A window grant reaches every webview in it, tabs included, so `capabilities/default.json` grants by `webviews`. Capabilities do not gate app commands: Tauri runs one for any local address whatever the label, and only `browser::refuse_browser_pages` around `generate_handler!` in `lib.rs` stops a `browse-` caller. Keep that wrapper.

### The navigation rule is the first wall

Never loosen `browser/guard.rs` to "any scheme but the app's", and never let an address reach a tab without it. Its checks are pure functions, since no headless test loads a page; spike S2's probe stays the manual check after a Tauri bump.

On macOS it also sees iframe loads, and `about:blank` or `about:srcdoc` passes, because it takes its creator's origin and never makes a tab local. On Windows only the top frame is checked (WebView2 reports no frame load to `on_navigation`); `frame-ancestors 'none'` stops pages framing the app, but a frame on another local scheme is untested there and must be before the pane ships on Windows.

### The placement loop writes nothing on a steady frame

It runs every animation frame while the pane shows, reads the placeholder's rect, and asks the host only on a change. Its one store write is `unbindBrowserLiveTab` for a lost view (`tab-gone`). A steady frame calls no `setState` or store action, or the pane and everything under it commit each frame (`browserBudgets.test.tsx` counts zero commits); a new field is read from a ref or the rect. Hidden tabs keep their memory on macOS (WebKit has no suspend), so open a tab only when asked.

### A browser profile is not the same thing on every platform

See [../browser.md](../browser.md) → Profiles.

- `WebviewBuilder::data_store_identifier` does nothing on macOS 13 and older, where wry silently uses the app's one store and sign-ins leak across workspaces. Ask `browser::profile::isolation()`, never assume.
- On Windows and Linux isolation is the data directory, so every tab webview goes through `spawn_webview` and `profile::scope`, or it lands in the default store.
- Linux keeps a WebKit context alive after the last webview closes, so deleting a profile folder leaves cookies in memory; `browser_profile_clear` answers `shouldRestart: true`.
- Each WebView2 profile is its own process group, so one runs at a time: an open closes other profiles' views under the registry lock, and a clear holds a lease against opens.

### A window that holds a tab is invisible to `webview_windows()`

`webview_windows()` and `get_webview_window()` only see a window whose webviews all share its label, so a window with a tab drops out and the menu event, the close fallback, `reveal_main`, the heartbeat and the last-window teardown go blind. Use `get_window` or `windows()`, send with `EventTarget::webview_window(<window label>)`, and keep `webview_windows()` for boot only (`browser::tests` scans for it).

### Every tab gets the app's initialization scripts

Tauri gives a tab its own initialization scripts, so every page carries `__TAURI_INTERNALS__` with the invoke key and labels (spike S2 saw it on `example.com`), and Tauri 2.12 cannot leave it out. The command wall (`refuse_browser_pages`, the `webviews` grant) is the guarantee, not the missing labels.

The `freezePrototype` script from `tauri.conf.json` reaches tabs the same way and broke real sites: one that assigns `toString` or `constructor` on a plain object failed, a search URL read `[object Object]`, menus and sign-in pages died. So the option stays off and the app document freezes itself with `public/freeze-prototype.js`, the first script of `index.html` (`csp-img-src.test.ts` pins both).

### Plugin scripts reach every tab too

`tauri_plugin_notification::init()` replaces `window.Notification` in every webview with a stand-in that calls the plugin's commands. Capabilities gate the commands, not the script, so a site sees the stand-in, the wall refuses it, and it gets no prompt or notification. Tauri 2.12 has no per-webview opt-out, so check what a new plugin's script replaces on `window` before adding it.

### `Webview::url()` panics on a tab with no URL yet

On macOS wry 0.57 unwraps `WKWebView.URL`, nil until a first navigation commits; a tab restored at launch and read by the facts poll crashed every start. Read addresses with `platform::web_url::live_url_of` (through `with_webview`, `None` on nil, gives up after 500ms), never `url()`, the favicon command and title handler included; `no_tab_reads_its_address_through_the_panicking_getter` in `platform/web_url.rs` fails on any `webview.url()` in `src/`. From a main-thread event handler, read on a blocking task, since `with_webview` runs after the handler returns.

### The passkey watch never breaks the page's call

`browser/passkey.js`, added to every frame of a macOS tab, wraps `navigator.credentials.get` and `create` to report a passkey request ([../browser.md](../browser.md) → Passkeys). It always calls the original with the same arguments and returns its result untouched, and a missing or throwing handler never breaks the call (`passkeyWatchScript.test.ts`). `addScriptMessageHandler:name:` raises an Objective-C exception, aborting the app, when the name is taken, so `platform/passkey_handler.rs` removes it before adding; keep that order.

### Every local page shares one origin

Every local page is `gblocal://localhost` (`http://gblocal.localhost` on Windows) whatever its folder or tab ([../browser.md](../browser.md) → Local files). The path token and the per-tab grant separate local pages, not the origin: their storage, cookies and service workers are shared within a profile. Never key a decision on the local origin, or widen a grant because "it is the same origin anyway".
