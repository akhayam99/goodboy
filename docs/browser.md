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
  is refused with `too-many-popups` in the log. Showing a popup frees its
  seat, and so does closing it, by hand, by the sweep or by the cap.
  Otherwise nothing opens.
- Every download is refused. The ask lands with the pane, which is the first
  part that can listen for it.

Phase 0 spike S2 proved the wall: a page in a tab got none of six probe
commands, and got all six once it navigated itself to the dev origin or to
`tauri://localhost`, until this rule refused those navigations.

## Tabs and windows

- A tab's webview is a child of the window that asked for it, labelled
  `browse-<id>`. It is created when the tab opens, never at boot.
- Only the owning window may drive a tab, and a `browse-` webview may drive
  none. Listing a session's tabs and closing them reach only the calling
  window's tabs.
- Closing a session's tabs is one command, `browser_session_close`, for the
  store to call when a session is archived. It tries every tab and answers
  `{ closed, failed }`; a tab that failed to close stays listed, so calling
  again closes the rest. A tab or popup that was still opening when the
  session closed is refused with `session-closing` and its webview is
  destroyed; the session takes new tabs again afterwards.
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
  profile. `browser_profile_isolation` answers `shared` (and `perWorkspace`
  everywhere else) so the pane can warn, and `browser_profile_clear` refuses
  with `profile-shared`, because clearing would wipe every workspace.
- **Windows and Linux**: the profile is a data directory,
  `~/.goodboy/browser/profiles/<name>`, created when the first tab of the
  workspace opens. Tauri gives each distinct directory its own WebView2
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
deletes the folder. It answers `{ shouldRestart }`: Linux keeps its WebKit
context for the life of the app, so cookies already in memory outlive the
deleted folder and the answer is `true`; elsewhere it is `false`.

Windows and Linux are written against the Tauri and wry sources and have not
been run: the first run on each of them is the check (spike S3 was never run).

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
`tab-closed`, `window-gone`, `other-window`, `too-many-popups`,
`session-closing`, `invalid-workspace`, `profile-busy`, `profile-live`,
`profile-shared`, `profile-unavailable`), never a sentence. The pane
owns the words.

## Under the hood

- `apps/desktop/src-tauri/src/browser/host.rs` builds a tab's webview with
  the rule, the popup path and the download refusal; `commands.rs` holds the
  thirteen `browser_*` commands; `profile.rs` holds the profile id, the
  per-platform store, the switch and the clear; `registry.rs` holds the tabs, the popup seats
  (`MAX_HIDDEN_POPUPS`) and the pure picks of which tabs to close;
  `lifecycle.rs` holds the limits (`SLEEP_LIMIT_MS`, `MAX_LIVE_TABS`), the
  sweep, show, hide and place, and `browser://tab-state`. The native back and forward step lives in
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
  back step cannot run headless. The lifecycle tests pass the clock in: the
  timer close at 10 minutes less a millisecond and at 10 minutes, the cap
  close order, a closed tab shown again under its id and address, a shown tab
  that no sweep closes, the events, and that starting the lifecycle at boot
  leaves the registry and the webviews as they were. The profile tests pin a
  stable and distinct id and folder per workspace, that a switch closes the
  other workspace's views (in one window and across two) and announces it, that
  a closed view returns under its id, that a popup keeps its opener's profile,
  and that a clear refuses with live views, a second clear and a blank id and
  blocks opens while it runs. The macOS store and the Windows and Linux folder
  are not reachable from the mock runtime.
- `apps/desktop/src/__tests__/regressions/browser-isolation.test.ts` fails
  when a capability could match a `browse-` label, grants by window or grants
  a remote address. `csp-img-src.test.ts` pins `frame-ancestors 'none'`.
- `add_child` needs the `unstable` feature of `tauri`, so `Cargo.toml` pins
  the minor (`~2.12`). A Tauri bump is its own pull request, with the spikes
  run again.
- Until the pane lands, `scripts/check-tauri-commands.mjs` allowlists the
  `browser_*` commands with a reason; the pane and the tabs slice remove
  those lines as they call them.
