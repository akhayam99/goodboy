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

Four facts shape everything else:

- **A tab is two things.** The live webview is gone when the app quits; a row
  in `browser_tabs` outlives it with only the owner, address, title and
  position.
- **A webview is costly.** A hidden one keeps its memory, so the host closes
  tabs that sleep too long or pass the live cap, and a closed tab reloads at
  its address when shown.
- **The view draws above the app.** Nothing in the DOM can cover it, so one
  loop places it at a placeholder and hides it under any overlay.
- **A write names its target** (session, tab, workspace or owner) and changes
  state only after the host answered.

## Pages

- [host.md](browser/host.md): what a tab may load, popups, windows, the command
  wall, passkeys, engine limits.
- [local-files.md](browser/local-files.md): typed paths, the `gblocal` scheme,
  grants.
- [lifecycle.md](browser/lifecycle.md): live, asleep and closed, the sweep and
  cap, the lock, profiles.
- [tab-rows.md](browser/tab-rows.md): saved rows, the store slice, the close on
  archive, visits.
- [pane.md](browser/pane.md): the dock, its address row, tabs, command field,
  find, More, Inspect in Safari and live tabs.
- [placement.md](browser/placement.md): the placement loop, zoom, overlays and
  covers.
- [page.md](browser/page.md): the full Browser page and the moves to and from
  the dock.
- [doors.md](browser/doors.md): chips, links, the peek, Send to agent, the
  click rule.
- [keys.md](browser/keys.md): the keymap, keys while a page has focus, ⌘K.
- [console.md](browser/console.md): the page runtime, the console, the Errors
  tab.
- [pick.md](browser/pick.md): Select an element.

## The invariant

**A page in a tab reaches no Goodboy command.** Tauri decides whether a page
may call a command by its address, not by the webview's name: a page on the
app's own origin is local, and a local page may call every command.

1. The host refuses every navigation that would make a tab local, except a
   local file the user typed. That refusal is the first wall
   ([host.md](browser/host.md#the-navigation-rule)).
2. The label is the second: no capability grants a `browse-` webview, and no
   app command runs for one ([host.md](browser/host.md#capabilities)).

## Local files

Only a typed address or the app's own saved copy opens a local file, served on
the `gblocal` scheme through a grant per tab
([local-files.md](browser/local-files.md)).

## Profiles

Each workspace has its own browser profile, and one runs at a time across every
window ([lifecycle.md](browser/lifecycle.md#profiles)).

## The pane

The Browser dock beside a session owns the address row, the tabs, the address
rule and live tabs ([pane.md](browser/pane.md)); the overlay rule is in
[placement.md](browser/placement.md).

## The page

The full Browser page groups every session's tabs and owns its route and count
([page.md](browser/page.md)).

## Moves

A move between dock and page keeps the same webview and never reloads
([page.md](browser/page.md#moves)).

## Doors

A door opens a page in a session's browser through `openInBrowser`, and Send to
agent reads a tab's text for one press ([doors.md](browser/doors.md)); keys and
⌘K are in [keys.md](browser/keys.md).

## The click rule

`openTarget` in `features/open/` decides where every target opens
([doors.md](browser/doors.md#the-click-rule)).

## Passkeys

A tab can't finish a passkey sign-in on macOS, so the host watches for the
request ([host.md](browser/host.md#passkeys)).

## Console

One script per tab keeps console lines, requests and errors, read only while a
surface shows the tab ([console.md](browser/console.md)).

## Pick an element

Select an element adds up to four picked elements to the agent's draft
([pick.md](browser/pick.md)).

## Performance

The browser costs nothing until a tab opens, then stays inside a budget.
`features/browser/browserBudgets.ts` (`BROWSER_BUDGETS`) holds every number a
test or a release checks.

- **Never opened**: no `browser_*` command, frame request or store commit runs
  before the first tab. The pane (`LazyBrowserPane`) and the page
  (`renderStudio`) are lazy chunks, so the first bundle carries only the host
  calls and tab actions, and `bundle-budget.json` stays as it is.
- **Open, switch, close**: 3, 1 and 1 store commits.
- **Idle**: no host command. A parked or hidden pane, or one with no awake tab,
  lists nothing on a timer; the tool rail draws once with the store's count.
- **The view moves** with at most one host call per frame, none when the
  placeholder did not move (`sameBounds`). A frame sets no React state and
  writes no store key; the one write on the loop's path unbinds a view the host
  lost.
- **Memory** is the engine's. A live tab costs 70 to 110 MB, hidden tabs cost
  as much as shown ones on macOS, and four tabs stay under 450 MB over none. A
  person measures it at each release (`docs/testing.md` → Manual release gate:
  browser memory).

`browserBudgets.test.tsx` counts, never times, every budget above and checks
that `docs/testing.md` still names the gate's numbers.
`viewBoundsOf.perf.test.ts` times one measure over a 500 row page with open
menus in the perf project.

## Errors

A `browser_*` command fails with a reason code from `browser/reason.rs`, never a
sentence, and the pane owns the words
(`features/browser/browserFailureText.ts`). The codes: `browser-caller`,
`not-web-address`, `invalid-address`, `local-missing`, `local-folder`,
`local-type`, `tab-gone`, `tab-closed`, `window-gone`, `other-window`,
`too-many-popups`, `session-closing`, `invalid-workspace`, `profile-busy`,
`site-moved`, `site-data-unavailable`, `profile-shared`, `profile-unavailable`,
`history-unavailable`, `invalid-preset`, `console-unavailable`,
`tab-row-gone`, `tab-row-owner`, `tab-rows-changed`, `tab-rows-failed`.

## Under the hood

The host lives in `apps/desktop/src-tauri/src/browser/`, its native calls in
`src-tauri/src/platform/`, and the app side in
`apps/desktop/src/features/browser/`, `features/open/` and the `browser`,
`browser-host` and `browser-visits` store slices. Each page ends with its own
files and tests.
