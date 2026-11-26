# Tab lifecycle and profiles

> **Read this when** you change when a tab sleeps or closes, the host lock or
> a workspace's profile. **Not for** the pane's asleep card
> ([pane.md](pane.md#coming-back)).

## States

A tab's facts carry its `state`:

- **live**: shown.
- **asleep**: hidden, webview still alive. Hiding stamps `hiddenSinceMs`.
- **closed**: webview destroyed. The registry keeps the id, last address,
  title and last place, so the tab is still listed.

Hiding frees nothing; only closing frees memory. Two rules close a tab, and
neither ever closes a shown tab:

- **Ten minutes hidden.** A thread sweeps every 30 seconds and closes each tab
  asleep for 10 minutes or more. Showing and hiding again restarts the clock.
- **More than four live per window.** Opening, showing or hiding a tab that
  leaves a window with more than four live webviews (live and asleep, popups
  included) closes the tab asleep longest, then the next, until four remain.
  Hiding one of five shown tabs therefore closes it at once.

A tab the cap or the sweep closes is marked closed first and destroyed second,
after its live address is stored. If the webview will not close, the tab goes
back to asleep for the next sweep. A popup opened over the cap can close
itself; its facts, in the answer and in `browser://tab-opened`, say `closed`.

Showing a closed tab builds its webview again at the stored address and place,
under the same id and `browse-` label, and the page loads again (scroll and
form state are gone). A closed tab refuses navigate, reload, back and forward
with `tab-closed`. Hiding it answers its facts, placing it stores the place,
and closing it removes it from the registry.

Every change of state sends `browser://tab-state` with the facts to the tab's
own window, whoever asked; a call that changes nothing sends nothing. A title
change or a passkey ask sends the same event.

## The lock

Nothing is created at boot: the sweep thread owns no webview, and the registry
is empty until a window opens a tab.

Every change of state runs under one registry lock, so a show never meets a
sweep half way through destroying the same webview. The lock stays held across
the calls that wait on the main thread (building, showing and closing a
webview, and the event), so a slow build holds up the sweep and other
commands. It is taken before the registry's own lock and no main-thread
callback takes it, so this never deadlocks.

## Profiles

Each workspace has its own browser profile: cookies, local storage and every
other site datum, so a sign-in never crosses workspaces. `browser_tab_open`
takes the tab's `workspaceId` and refuses a blank one with
`invalid-workspace`. A popup uses its opener's profile; a closed tab returns in
the profile it left.

The name is the first 16 bytes of a SHA-256 over the workspace id, written as
32 hex digits for a folder. It is stable, never shared, and holds no character
of the id, so no id can reach another path.

| Platform           | The profile                                                                                                                                                    |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| macOS 14 and later | A WebKit data store with that identifier. Goodboy sees no folder.                                                                                              |
| macOS 13 and older | No named stores: Tauri silently uses the app's one store, so every workspace shares it and an open never closes another workspace's views.                     |
| Windows and Linux  | The folder `browser/profiles/<name>` in the app data folder, which gets its own WebView2 environment or WebKit context, so the stores are apart in one window. |

- On macOS 13 and older `browser_profile_isolation` answers `shared`
  (`perWorkspace` elsewhere) so the pane can warn, and `browser_profile_clear`
  refuses with `profile-shared`, because it would wipe every workspace.
- On Windows and Linux the folder is made before another workspace's views are
  closed, so a failure leaves the running workspace as it was. Linux needs no
  window of its own for this; its limit that child webviews do not take their
  bounds is about placement ([placement.md](placement.md)). These two
  platforms are written against the Tauri and wry sources and have not been
  run: the first run is the check.

### One profile at a time

Across every window, only one profile runs. Before a webview is built, an open
or a closed tab coming back closes the live and asleep views of every other
profile, under the lifecycle lock. Those tabs stay listed as `closed` with
their id, address and place, each owning window hears `browser://tab-state`,
and they come back lazily through the show path. Cookies stay in the store. If
a view will not close, it is put back, the open fails with `profile-busy`, and
the views that did close stay closed.

### Not registered

`browser_profile_isolation` and `browser_profile_clear` live in
`browser/commands.rs` but stay out of `generate_handler!` and
`window-commands.json`: no page calls them, and a destructive command with no
caller stays out of reach. Register them together with the pane's shared
profile warning and its Clear button.

### Clearing a profile

`browser_profile_clear` takes a `workspaceId`.

- It refuses with `profile-live` while a tab of the workspace is live or
  asleep, and with `profile-busy` while the same profile is being cleared.
- While it runs, opening or showing a tab of that workspace fails with
  `profile-busy`.
- It removes the WebKit store on macOS and the folder elsewhere, up to three
  tries 400 ms apart for a webview still shutting down, then fails with the
  platform's error.
- It answers `{ shouldRestart }`: `true` on Linux, which keeps its WebKit
  context and its cookies in memory for the life of the app, `false`
  elsewhere.

## Under the hood

- `browser/lifecycle.rs` holds the limits (`SLEEP_LIMIT_MS`, `MAX_LIVE_TABS`),
  the sweep, show, hide, place and `browser://tab-state`.
  `browser/profile.rs` holds the profile id, the per-platform store, the
  switch and the clear.
- Tests: the lifecycle and profile tests in `browser::tests` pass the clock
  in. The macOS store and the Windows and Linux folders are not reachable from
  the mock runtime.
