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

`browser_profile_isolation` lives in `browser/commands.rs` but stays out of
`generate_handler!` and `window-commands.json`: no page calls it. Register it
together with the pane's shared profile warning.

### Clearing a profile

`browser_profile_clear` is the **Clear browser data** row of the workspace
Danger zone. It takes a `workspaceId`.

- It refuses with `profile-busy` while the same profile is being cleared.
  While it runs, opening or showing a closed tab of that workspace fails with
  `profile-busy`.
- The lease names the live and asleep tabs of the workspace. With open tabs,
  the store is emptied in place through the first of them (every data record
  on macOS, `clear_all_browsing_data` elsewhere), then each open tab reloads
  from origin, and the answer is `shouldRestart: false`.
- With no open tab, it removes the WebKit store on macOS and the folder
  elsewhere, up to three tries 400 ms apart for a webview still shutting down,
  then fails with the platform's error. It answers `{ shouldRestart }`: `true`
  on Linux, which keeps its WebKit context and its cookies in memory for the
  life of the app, `false` elsewhere.
- The row drops an answer that comes back after it moved to another
  workspace.

### Clearing one site

`browser_site_data_clear` takes `{ tabId, host, extraHosts }`: the host the
menu row showed and the sign-in hosts its confirm listed when the user
confirmed.

- It refuses `not-web-address` for a page that is not http or https, and
  `site-moved` when the live page is on another host by then or when an extra
  host is not in the tab's trail (below). The pane never names a site the
  host did not record.
- It holds the same lease as the workspace clear, on the tab's profile, until
  the reload is sent. A second clear of either kind answers `profile-busy`,
  also on a Mac with one shared store.
- On macOS it fetches every data record of the tab's store and removes those
  whose display name is the site or one of the extra hosts: `localhost`,
  `*.localhost` and an IP match only themselves, any other host matches its
  registrable domain. Ports share one record, so clearing `localhost:5005`
  clears every localhost port. Then the acting tab reloads from origin, and
  the answer is `{ host, extraHosts, scope: site }`. Other tabs on those sites
  are not reloaded and keep their page; the line under the address says so.
- WebKit names a record by the registrable domain of the public suffix list:
  `app.harborline.dev` is `harborline.dev`, `shop.acme.co.uk` is `acme.co.uk`.
  A tenant under a shared suffix keeps its own host, so `harborline.github.io`
  is its own record and clearing it leaves every other tenant alone. A record
  holds cookies, disk and fetch cache, IndexedDB, local and session storage.
- Off macOS it clears the whole store of the workspace and answers
  `scope: workspace`, which is why the row there says **Clear browser data**.
- A removal that does not answer within 10 s fails with
  `site-data-unavailable`, and the page is not reloaded.

### The sign-in trail

Each tab keeps the hosts of its main-frame pages, so the clear can reach the
sign-in provider a login went through.

- The host is recorded when a page commits and when it finishes, twenty hosts
  at most, oldest out first, each once. It lives in memory with the tab, keeps
  through sleep and wake (same tab id), is never saved and is not part of the
  tab facts.
- `browser_tab_trail { tabId }` answers the union of the tab's hosts, its
  opener chain and the popups it opened, five levels deep at most. It takes no
  lease. A popup that closes hands its hosts to its opener, and the popups it
  opened move under that opener.
- The trail exists only on macOS with a store per workspace. Elsewhere the
  read answers nothing, and a clear with an extra host is refused.
- The pane reads it after each finished load of the session and keeps only the
  latest answer for the shown tab. While nothing came back the confirm names
  the site alone, and the clear sends no extra host. The page's host and its
  parent domains (`harborline.dev` beside `app.harborline.dev`) are not listed
  as sign-ins, since the site clear removes their records. Every other trail
  host is listed, a subdomain or a sibling too, because it can keep a record of
  its own under a shared suffix.

### Reload without cache

`browser_tab_reload_from_origin` calls `reloadFromOrigin` on the WKWebView.
Windows and Linux have no such call in wry, so it is a plain reload there.
⇧-click on Reload and ⌘⇧R reach it: `app.reload` goes through
`reloadAppOrPage`, which picks the reload surface like ⌘R does and calls its
`reloadFromOrigin`, else reloads Goodboy.

## Under the hood

- `browser/lifecycle.rs` holds the limits (`SLEEP_LIMIT_MS`, `MAX_LIVE_TABS`),
  the sweep, show, hide, place and `browser://tab-state`.
  `browser/profile.rs` holds the profile id, the per-platform store, the
  switch and the clear. `browser/site_data.rs` holds the site match
  (`is_site_record`, and `is_record_of_any` for a list), the site and trail
  checks (`check_site`, `check_trail`) and the in-place clears;
  `platform/web_site_data.rs` the WebKit calls. The trail is `hosts` on the
  registry `Tab` (`remember_host`, `trail_of`), fed by `load::remember_load`
  from `report_load`. The settings row is `WorkspaceBrowserDataRow` through
  `useClearBrowserData`; the menu row is `siteDataRowOf`, its trail
  `hooks/useSiteTrail`.
- Tests: `site_data.rs` covers the host match, the list match, the site and
  trail checks and the 10 s wait; `registry.rs` the ring, sleep and wake, the
  popup union, the closed popup and the depth cap; `browser::tests` the lease
  and a failed clear in place; `BrowserPane/siteData.test.tsx` the confirm and
  its sign-in notes, the line, a failure, a busy retry, a pending and a late
  trail and a late answer; `scopedReload.test.tsx` ⌘⇧R and ⇧-click;
  `WorkspaceBrowserDataRow.test.tsx` the busy refusal and a late answer.
- `browser/site_data/tests/native_tests.rs` drives a real WKWebView by hand
  (`cargo test --lib site_data::tests::native_tests -- --ignored --nocapture`): it
  relaunches the test binary so WebKit gets the main thread, serves its own
  127.0.0.1 and ::1 pages, checks that a redirect hop and an iframe stay out of
  the trail, and prints the name and types of every record. CI skips it.
- Tests: the lifecycle and profile tests in `browser::tests` pass the clock
  in. The macOS store and the Windows and Linux folders are not reachable from
  the mock runtime.
