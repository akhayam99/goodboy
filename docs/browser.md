# Browser host

> **Read this when** you are changing how Goodboy opens, places or closes a
> web page inside a window, or what such a page may reach. **Not for** the
> pane, its tabs list and its doors (they land with the pane), or the data
> disclosure users read (`SECURITY.md`).

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
- `about:blank` loads only as a tab's first page.
- The app's own origins are refused even on `http`: `tauri://localhost`,
  `http://tauri.localhost` and `https://tauri.localhost` (Windows), every
  scheme Goodboy or Tauri registers (`tauri`, `ipc`, `asset`, `gbframe`) and
  its `<scheme>.localhost` form, and in a development build the `devUrl`
  origin. A release build may open a server on that port, because there it
  is not the app.
- A page that sends itself to one of those addresses stays where it was. A
  server redirect, a form post, a meta refresh and a `location` change each
  reach `on_navigation` as a new address and meet the same rule; only a
  tab's very first navigation may be `about:blank`, refused or not.
- On macOS a frame's load reaches `on_navigation` too. On Windows WebView2
  reports only the top page, so a frame is not checked there; the app's own
  policy carries `frame-ancestors 'none'`, so no page can frame the app.
- A popup (`window.open`, a link with a target) never becomes a window. When
  its address passes the rule it opens as a new hidden tab in the opener's
  session and window; otherwise nothing opens.
- Every download is refused. The ask lands with the pane, which is the first
  part that can listen for it.

Phase 0 spike S2 proved the wall: a page in a tab got none of six probe
commands, and got all six once it navigated itself to the dev origin or to
`tauri://localhost`, until this rule refused those navigations.

## Tabs and windows

- A tab's webview is a child of the window that asked for it, labelled
  `browse-<id>`. It is created when the tab opens, never at boot.
- Only the owning window may drive a tab, and a `browse-` webview may drive
  none.
- Closing a session's tabs is one command, `browser_session_close`, for the
  store to call when a session is archived.
- A destroyed window's tabs leave the registry with it.
- The registry stamps when a tab was hidden. The sleep and close policy reads
  that stamp; it is not built yet.

## Capabilities

`capabilities/default.json` grants by webview label (`webviews`: `main`,
`win-*`), never by window. A grant by window reaches every webview inside
that window, a tab included; a grant by webview reaches only the window's own
page. No capability names a `browse-` label or grants a remote address.

Capabilities gate plugin commands only. An app command runs for any local
page unless its handler checks, so `lib.rs` wraps `generate_handler!` in
`browser::refuse_browser_pages`, which answers every app command from a
`browse-` webview with the `browser-caller` code before it runs.

## Errors

A `browser_*` command fails with a reason code from `browser/reason.rs`
(`browser-caller`, `not-web-address`, `invalid-address`, `tab-gone`,
`window-gone`, `other-window`), never a sentence. The pane owns the words.

## Under the hood

- `apps/desktop/src-tauri/src/browser/host.rs` builds a tab's webview with
  the rule, the popup path and the download refusal; `commands.rs` holds the
  eleven `browser_*` commands; `registry.rs` holds the tabs.
- `guard::tests` pins every refused origin, `http` and `https` pages,
  `javascript:`, `data:`, `file:`, `about:blank` and a page that sends itself
  to the app, and walks `NavigationGate` through redirect, form post, blank
  first page and script sequences. It also fails when `lib.rs` registers a
  scheme the rule does not refuse. The rule is a pure function because no
  test can load a page headless.
- `browser::tests` opens tabs on Tauri's mock runtime: the owning window, the
  refusals and their codes, an app command a `browse-` webview calls from a
  local address, closing a session's tabs, a destroyed window, and that no
  production code looks a window up through `webview_windows` or
  `get_webview_window`.
- `apps/desktop/src/__tests__/regressions/browser-isolation.test.ts` fails
  when a capability could match a `browse-` label, grants by window or grants
  a remote address. `csp-img-src.test.ts` pins `frame-ancestors 'none'`.
- `add_child` needs the `unstable` feature of `tauri`, so `Cargo.toml` pins
  the minor (`~2.12`). A Tauri bump is its own pull request, with the spikes
  run again.
- Until the pane lands, `scripts/check-tauri-commands.mjs` allowlists the
  `browser_*` commands with a reason; the pane and the tabs slice remove
  those lines as they call them.
