# Browser host and its walls

> **Read this when** you change what a tab may load, popups, tab ownership,
> the command wall, passkeys or an engine limit. **Not for** typed local files
> ([local-files.md](local-files.md)).

## The navigation rule

The rule lives in `apps/desktop/src-tauri/src/browser/guard.rs` and runs in
`on_navigation`, in `on_new_window` and before every command that loads an
address.

- Only `http` and `https` load, plus a typed local file. `javascript:`,
  `data:`, `blob:`, `file:` and every other scheme are refused.
- `about:blank` and `about:srcdoc` always pass: they take their creator's
  origin, so they never make a tab local. A new tab may start on
  `about:blank`, never on `about:srcdoc`.
- The app's own origins are refused even on `http`: `tauri://localhost`,
  `http://tauri.localhost` and `https://tauri.localhost` (Windows), every
  scheme Goodboy or Tauri registers (`tauri`, `ipc`, `asset`, `gbframe`,
  `gblocal`) and its `<scheme>.localhost` form, and the `devUrl` origin in a
  development build.
- When the `devUrl` host is a loopback name, every loopback host on its port
  counts as that origin: `localhost`, any `*.localhost`, `127.0.0.0/8`,
  `[::1]`, `0.0.0.0` and `[::]`. A release build may open a server on that
  port, because there it is not the app.
- A redirect, a form post, a meta refresh and a `location` change each reach
  `on_navigation` as a new address, so a page that sends itself to a refused
  address stays where it was.
- On macOS a frame's load is checked too. WebView2 reports only the top page,
  so frames are not checked on Windows; the app's policy carries
  `frame-ancestors 'none'`, so no page can frame the app.
- Every download is refused.

### Popups

A popup (`window.open`, a link with a target) never becomes a window. When its
address passes the rule, it opens as a new hidden tab in the opener's session
and window, which hears `browser://tab-opened` with the tab's facts
(`openerId` names the opener). Otherwise nothing opens.

A session holds at most four hidden popups, those still opening included; past
that a popup is refused with `too-many-popups` in the log. Showing or closing a
popup (by hand, by the sweep or by the cap) frees its seat.

## Tabs and windows

- A tab's webview is a child of the window that asked for it, labelled
  `browse-<id>`, created when the tab opens, never at boot.
- Only the owning window may drive a tab, and a `browse-` webview may drive
  none. Listing a session's tabs reaches only the calling window's tabs.
- A listing reads the address from the live webview, so `history.pushState`
  and fragment moves show.
- A destroyed window's tabs leave the registry with it.

`browser_session_close` closes a session's tabs in every window, not only the
caller's, when the session is archived or deleted
([tab-rows.md](tab-rows.md#closing-on-archive-and-at-boot)). It tries every
tab and answers `{ closed, failed }`; a tab that failed stays listed, so
calling again closes the rest. A tab or popup still opening in any window is
refused with `session-closing` and its webview destroyed, as is a popup whose
opener closed first. After the first pass the host closes tabs that slipped
in, and then the session takes new tabs again.

An open reads the session's generation before it waits for the lock and checks
it again once it holds it, before any other workspace's views are closed.

## Capabilities

`capabilities/default.json` grants by webview label (`webviews`: `main`,
`win-*`), never by window: a grant by window would reach every webview inside
it, a tab included. No capability names a `browse-` label or grants a remote
address.

Capabilities gate plugin commands only. An app command runs for any local page
unless its handler checks, so `lib.rs` wraps `generate_handler!` in
`browser::refuse_browser_pages`, which answers every app command from a
`browse-` webview with `browser-caller` before it runs.

Two tests hold the wall:

- `registers_every_app_command_behind_the_browser_wall` in
  `src-tauri/src/browser/tests.rs` reads the source (the real commands cannot
  build on the mock runtime). It fails on a second `invoke_handler` or
  `generate_handler` in `lib.rs`, a list that is not the whole argument of
  `refuse_browser_pages`, a `window-commands.json` name outside it, or a
  handler or capability added at run time elsewhere. The `probe` test beside
  it proves the wrapper refuses a `browse-` caller.
- `browser-isolation.test.ts` in `src/__tests__/regressions/` fails on a
  capability that matches a tab label, grants by window or names a remote
  address, a capability in `tauri.conf.json`, or a file the test does not read
  (anything but top level `.json`).

## Passkeys

A tab can't finish a passkey sign-in on macOS. Answering one needs Apple's
managed browser entitlement
(`com.apple.developer.web-browser.public-key-credential`), granted only to an
organization account whose app can be the default browser. Goodboy has
neither, so WebKit refuses the request at once, security keys and a phone
included.

So the host watches for the request:

1. On macOS the tab script ([console.md](console.md#the-page-runtime)) carries
   a passkey probe that every frame runs. It wraps `navigator.credentials.get`
   and `create`: a passkey call, unless it is only the quiet autofill offer,
   posts to a native message handler and then runs unchanged. Options or a
   bridge that throw on read never stop the call.
2. The handler is added just after the view is made, so a request from the
   first document looks for it again every 100 ms for two seconds.
3. The handler marks the tab's facts `isPasskeyBlocked`. An ask that lands
   before the tab is registered is held until it is.

The pane and the page show a notice above that tab only, with Open in your
browser and Dismiss. Dismiss clears the mark on the host
(`browser_tab_passkey_dismiss`), as does a new document load; a refused
dismiss keeps the notice and shows the reason. The sign-in then lives in the
default browser, and the tab's workspace profile stays signed out.

## Known limits

- Tauri 2.12 gives a child webview the same initialization scripts as a
  window, so every page in a tab sees `__TAURI_INTERNALS__` with the invoke key
  and the labels. The command wall is the guarantee, not the missing script
  (`docs/traps.md`).
- `freezePrototype` in `tauri.conf.json` is off, because Tauri adds it to every
  tab and real sites that assign `toString` or `constructor` on a plain object
  broke under it. The app document freezes itself with
  `public/freeze-prototype.js`, the first script of `index.html`.
- On macOS a tab sends a current Safari user agent (`TAB_USER_AGENT` in
  `browser/host.rs`): the bare WKWebView agent lacks `Version/` and `Safari/`,
  and sites such as Google then serve legacy pages. Windows and Linux keep the
  engine's agent, and Tauri has no setter after build, so there
  `browser_user_agent` refuses with `unsupported-platform`.
- Back, forward and Stop are native on macOS (the WebKit view's own history
  and `stopLoading`), so a page cannot trap them. Tauri 2.12 has no native
  step, so Windows and Linux run `history.back()`, `history.forward()` and
  `window.stop()` in the page, which the page can redefine. Only macOS reports
  `canGoBack` and `canGoForward`.
- The host reports a load's start and finish, never a failure. A failed or
  cancelled load sends no `finished`, so its line ends at the 30 second limit
  or on Stop.

## Under the hood

- `browser/host.rs` builds a webview with the rule, popups, the download
  refusal and the tab script; `commands.rs` holds the commands; `registry.rs`
  the tabs, the popup seats (`MAX_HIDDEN_POPUPS`) and the pure close picks.
  `load.rs` sends `browser://tab-load` (`started`, `finished`, tab id,
  address) to the owning window only and clears the passkey mark on a start.
- `src-tauri/src/platform/web_history.rs` holds the native back, forward,
  history state and stop.
- The passkey watch: `browser/passkey.rs` (handler-to-tab map),
  `src-tauri/src/platform/passkey_handler.rs` (native class) and
  `browser/passkey.js`, which `console::tab_script` appends. `host.rs`
  registers the handler after the view is made and forgets it when the tab
  closes, its open is refused late or its window goes (`forget_window`).
- Those two `platform/` files, `platform/key_monitor.rs` and
  `platform/web_inspect.rs` are the only `unsafe` the host needs, enforced by
  the unsafe ratchet in `proc/signal.rs`.
- `add_child` needs the `unstable` feature of `tauri`, so `Cargo.toml` pins the
  minor (`~2.12`). A Tauri bump is its own pull request, with the spikes run
  again.
- Tests: `guard::tests` (the rule is pure because no test loads a page
  headless; it also fails on a scheme `lib.rs` registers that the rule misses),
  `browser::tests` on the mock runtime (it also fails on a window lookup
  through `webview_windows` or `get_webview_window`), `csp-img-src.test.ts`,
  `passkey::tests` and `passkeyWatchScript.test.ts`. The native back step and
  the passkey handler cannot run headless.
