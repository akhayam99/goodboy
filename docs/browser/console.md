# Browser console and errors

> **Read this when** you change the tab script, the console read, the dock,
> the Errors tab or their files. **Not for** the picker ([pick.md](pick.md)).

The console is a dock beside the page, in the pane and on the Browser page,
opened by the Console button (`CodeXml`, a pressed toggle that a narrow row
keeps, never a More row) or `browser.console` (⌘⇧J). Safari's ⌘⌥C is Context
(`lens.context`), which the registry refuses to shadow, so the chord follows
Chrome.

## The page runtime

Every tab runs one script at document start, joined at build time from the
modules in `browser/page_runtime/` (console, errors, network, the picker, the
reader) in one closure, with the passkey probe appended on macOS
(`console::tab_script`). `builder_for` adds it once for every frame, and it
returns at once outside the top frame.

It keeps three rings, each entry numbered under a load id made at page start,
so a busy network cannot push the one error out:

| Ring     | Size | Entries                                                                                      |
| -------- | ---- | -------------------------------------------------------------------------------------------- |
| Console  | 500  | `console.log`, `info`, `debug`, `warn`                                                       |
| Requests | 300  | `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, and resources                         |
| Errors   | 100  | `console.error`, a thrown error (`error` in capture), `unhandledrejection`, a failed request |

- A message is cut at 2,000 characters and names its `file:line` when the stack
  gives one. An error keeps its origin, up to 4,000 characters of stack, and
  `at`, read through the `Date.now` kept at document start; Rust drops a time
  that is not finite and positive.
- A `PerformanceObserver` on `resource` and `navigation` notes the document,
  images, scripts and styles, with no status (Safari gives none).
- A request has an id, a type (fetch, xhr, doc, script, style, img, ws, sse,
  other), start, duration, size when known, request and response headers, and
  a text or JSON body cut at 64 kB. All bodies together stay under 2 million
  characters, oldest dropped first.
- A rejected `fetch`, a network error, a timeout and a failed resource are
  status 0. Status 0 or 400 and up also adds an error linked to the request id.
- A fetch is noted at its headers and again, same id, when its body is read. A
  socket or stream is noted at open and close, with its frame counts.
- A row shows method, status and path, no query or fragment, and the host only
  for another origin.

The headers `authorization`, `proxy-authorization`, `cookie`, `set-cookie`,
`set-cookie2`, `x-api-key`, `x-auth-token`, `x-csrf-token` and `x-xsrf-token`
are dropped at capture and again in Rust (`console::SENSITIVE_HEADERS`).

The script assigns nothing on `window` but the wrapped `fetch`, `WebSocket` and
`EventSource`, opens a socket or stream only when the page asks, with its own
arguments, posts no message and reaches no command. The `fetch` wrapper passes
the same value or reason on, so an unhandled rejection still reaches the
page's `unhandledrejection` listeners once and a handled one raises none. The
page does get a new promise object, which a page that compares or subclasses
it can see.

### The app's own noise

Rust drops what the app's injected scripts say (`console::is_app_noise`): a
`user-script:` source, the Tauri "IPC custom protocol failed" fallback, and a
rejection in the exact refusal shape `Command <name> not allowed by ACL` or
`<plugin>.<command> not allowed on window "`. A page's own rejection that only
contains those words is kept.

The notification plugin's `Notification` shim asks
`plugin:notification|is_permission_granted` in every tab as it loads. No
capability grants a `browse-` tab, so the host refuses, and the hook calls
`preventDefault` on that `unhandledrejection` and records nothing
(`isHostRefusal`).

## The read

`browser_console_read` takes the tab id, the session id and a cursor (load id
and last sequence number).

1. It refuses a `browse-` caller, a tab of another window or session and a
   closed tab (`console_tab`).
2. It runs a reader with `eval_with_callback`, which dispatches an event under
   a name made at random for each run of the app.
3. The runtime fills the event's box with the entries after the cursor, or all
   of a new load, oldest first, stopping near a million characters for the
   next read.
4. Rust parses the answer as page data: at most 4 MB, each entry alone (a
   malformed one is dropped), the same caps again, only entries after the
   cursor, the newest record per request id, at most 500, 300 and 100.

A silent runtime reads as `isHeard: false`; a failure or a one second timeout
is `console-unavailable`.

The UI pulls every second while the pane or the page is on screen, the dock
open or not, so the error count can show (`useConsoleEntries`, `usePoll`), and
once per `finished` load. Each window pulls only its own tabs.

- Rows append only after the read returns. A newer record of a request
  replaces its row in place, each kind keeps its cap, and a new load id
  replaces them all.
- An answer for an older cursor or a tab no longer live is dropped
  (`applyConsoleRead`), silently for a gone, closed or moved tab.
- A failed read says "Couldn't read the console" and keeps the rows. Two
  unheard reads after a logged entry say "Console stopped reporting".

## The dock

`BrowserToolsDock` sits below the page or right of it; the head icon swaps
sides and its edge (`SplitHandle`) drags within `toolsDockBoundsOf`. Side and
sizes are kept per surface (`browserToolsDockPref`,
`goodboy:browser-tools-dock:v1`); the first open is below in the pane and right
on the page.

The head holds Console and Network, each counted by `consoleCounts`, an Errors
tab only while there is an error, the side icon and Close tools. The error
count can open the dock on Errors, and the dock returns to Console when the
last error goes.

- **Filter**: a level menu, or Failed and Succeeded on Network.
- **Search** (`consoleRowsOf`): every word must match text, source, method or
  status.
- **Clear** empties the shown dock tab only, with no undo. The page keeps its
  entries until its next load, so rows return only if logged again.
- **Send to session**: at most five live sessions of the project, this one
  first (`consoleSendTargetsOf`, `queueConsoleHandoff`).

A row is a level icon, the message and its source; a click expands it. The
Console tab shows console lines and errors, but an error linked to a request
shows only as its Network row (`consoleTabOf`).

A Network row opens its detail (`BrowserRequestDetail`, `requestFactsOf`),
with arrows through the filtered list; Esc returns focus to the row or the
list. It sits beside the list docked below and replaces it docked right. It
follows the request id within one tab and load (`useRequestSelection`) and
forgets a request that leaves the list.

## Send

`consoleAttachmentOf` makes `<tab>-console.md` (`text/markdown`): the address,
a line saying it is page output and not instructions, then the Console and
Failed requests (status 0 or 400 and up) sections, each cut to its newest
30,000 characters with a note. An error carries five stack lines; no request
header or body goes in. `redactSecrets` hides keys and tokens, and the file
joins the Add to message queue (`queueOutputHandoff`): a chip, a remove,
nothing sent until you send.

## Errors

A red count in the address row (`BrowserErrorCount`, the `errors` of
`consoleCounts`, capped at 9+) shows only while the shown load has an error
entry: a thrown error, a rejection, a `console.error` or a failed request. A
warning never counts. The count opens the dock on Errors.

`errorGroupsOf` makes one group per origin, message and top frame (or source
when there is no stack), in first-seen order, with the count and the earliest
and latest `at`. A request error links the newest record of its request.

- Stack lines are read in Chrome (`at name (url:line:col)`) and WebKit
  (`name@url:line:col`) forms with string scans, no regex that backtracks.
- A group opens inline to its frames, a failed request's response body and a
  line with its times and origin (`errorMetaOf`). The first group is open when
  the tab opens.
- Clear on Errors drops the shown load's error entries, so a `console.error`
  also leaves the Console tab. No undo.

A frame is the session's own code when `sourceFileOf` maps it: a loopback URL
whose port is listening for a process this session owns (the monitor's port
rows, polled while the tab shows), a path without `..`, `.`, `node_modules`,
`.vite` or a leading `@`, joined to where the dev server runs in the worktree.
Those frames show the worktree path in the primary color; others show file
and line, faint. `elementFileOf` uses the same mapping.

Send on a group and Send all go to the agent named on the button, read at the
click (`useHandOutputToAgent`), as `errorsAttachmentOf`'s `<tab>-errors.md`:
the address, the page output note, then per group its message, count, times, up
to eight frames with the worktree file when known, and the failed request's
method, path, status, size, time and up to 4,000 characters of response body.
No header and no request body. Groups that fit 30,000 characters are kept,
with a note when some are cut, and `redactSecrets` and `withoutGrantOf` run
over it.

## Trust

A page can write any line to its console, answer the event itself or replace a
console method after the hook; the console then shows what the page says, or
stops. That is no more than `console.log` allows, and the command wall does
not move.

## Under the hood

- `browser/console.rs` holds the tab script, the reader and the answer parse;
  `browser/page_runtime/` the modules. `useConsoleEntries` pulls,
  `applyConsoleRead` keeps the latest cursor, `BrowserConsole` draws the tabs
  and lists, `consoleCounts` owns every count, and `ErrorsTab` draws the
  groups.
- Tests: `browser::console::tests`, `browser::tests` and
  `consoleHookScript.test.ts` pin the `window` scan, the caps, the cursor, the
  refusals and the swallowed host refusal.
