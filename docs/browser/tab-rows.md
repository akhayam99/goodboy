# Tab rows and visits

> **Read this when** you change a saved tab row, the `browser` slice, the
> close on archive or visits. **Not for** the live webview
> ([lifecycle.md](lifecycle.md)).

A row of `browser_tabs` is what outlives the webview: an id, an owner, the
address, the title and a position, never a cookie or page content. The owner
is a session (a session tab) or a project (a pin every session of the project
shares), never both.

## The commands

Rust writes the table (`browser/tab_rows.rs`), one command per verb:
`browser_tab_rows_list`, `browser_tab_row_save`, `browser_tab_rows_reorder`,
`browser_tab_row_delete`, `browser_session_tab_rows_delete`,
`browser_tab_row_pin`, `browser_tab_row_unpin` and
`browser_stale_tab_sessions`. Each names its owner and never reads the current
session. `browser_workspace_tab_rows_list` answers every session's and
project's rows of the workspace it names in one read, never another
workspace's, for the Browser page, the palette and the tool rail.

- A save takes the address through the navigation rule, so a row never holds
  an app address, and keeps the first 512 characters of the title. A local
  file is stored as `file://`, never `gblocal`.
- A save drops a username and password and keeps the query and fragment, so a
  token in the query still lands in the row.
- A second save of an id updates address and title and keeps the position; a
  new row goes after the owner's largest.
- A reorder must name exactly the owner's rows (`tab-rows-changed` otherwise)
  and answers the new order.
- A row moves between owners only through pin and unpin (`tab-row-owner` when
  the caller does not own it).
- Deleting a row already gone succeeds, so a retry is safe.

## The store slice

`store/slices/browser/` keeps `browserSessionTabs` and `browserActiveTab` per
session, `browserProjectPins` per project, and `browserTabCounts` per loaded
workspace (recounted only when a tab write changes the rows; an unloaded
workspace has no count).

- State changes only after the command answered. A failure keeps the old rows
  and reports on the session or the project's workspace.
- One session's writes run one at a time in call order and never wait on
  another session.
- A load that answers after a newer load, a write or the session's eviction is
  dropped.
- The active tab is state of this window only.
- A reorder refused with `tab-rows-changed` (another window added or closed a
  tab) reloads the session's rows.

## Closing on archive and at boot

Archiving or deleting a session calls `closeBrowserSessionTabs`. It closes the
session's live tabs in every window (refusing one still opening), deletes the
session's rows and drops its keys from state. When a tab does not close, the
rows stay, the error shows, and the archive or delete still goes through. Pins
stay. A deleted session's rows also go by `ON DELETE CASCADE`.

Every boot runs `closeStaleBrowserTabs` on the sessions
`browser_stale_tab_sessions` names: archived ones that still hold rows, and
archived or gone ones that still hold a live tab. That is the only retry of a
failed close.

## Visits

`browser_visits` feeds Visited in the command field.

- Rust writes it (`browser/visit_rows.rs`) when a page load finishes, under the
  session the registry holds for that tab, so an agent's tab counts too.
- One row per address and session; a new visit moves it to the top, and rows
  past 200 per session go.
- A title change renames the row of the address the webview shows. The rename
  keeps the navigation count from when it came in, and a load that starts
  before the address is read drops it (`titled_address`).
- Only `http` and `https` outside the app's origins land, without username,
  password or fragment.
- The rows go with `browser_session_tab_rows_delete`, the stale sweep also
  names an archived session holding only visits, and a deleted session takes
  them.
- `browser_visits_list` answers the 20 newest; the `browser-visits` slice keeps
  them per session and drops a load a newer one passed.

Tests: `browser::tab_rows::tests` (every command on the migrated schema),
`store/slices/browser/index.test.ts` (the slice through `storyHarness`),
`archiveTask.test.ts` and `deleteTask.teardown.test.ts`.
