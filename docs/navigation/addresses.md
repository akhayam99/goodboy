# Addresses and history

> **Read this when** you add a place, a target or a stored page, change what Back, Forward, Up or a reload does, or touch how a window comes back. **Not for** the write rules behind an address ([state-writes.md](../typescript/state-writes.md)) or the crumbs on screen ([session-rail.md](session-rail.md#crumbs)).

Every view has an address, and one history per window and workspace records it. The
navigation slice (`store/slices/navigation/`) owns both.

## A Location

A `Location` is where you are plus how the page was: `place` (Home, the board or a session
view: lens, open agent and one target, such as an artifact, a run, an issue, a diff
focus, a Branch section or a thread), `studio` (the app studio over it; a session
has none of its own) and `focus` (the open drawer and the scroll). It carries only
what a screen reads. `locationKey` prints the text form for tests and logs:

| Address                                  | Place                                                       |
| ---------------------------------------- | ----------------------------------------------------------- |
| `home`                                   | Home                                                        |
| `board`                                  | the Board                                                   |
| `s/{session}`                            | the session Overview                                        |
| `s/{session}/branch/comments`            | a Branch section                                            |
| `s/{session}/branch/pr`                  | the branch's Overview section                               |
| `s/{session}/workflows/{run}`            | a run                                                       |
| `s/{session}/agents/agent/{agent}`       | an agent                                                    |
| `s/{session}/branch/comments/t/{thread}` | a thread, with a fix run transcript in the drawer when open |
| `s/{session}/questions/q/{question}`     | a question open over Questions                              |

A window an older build saved with an agent tab, an Explore folder, the Explore or
Scripts lens, a selection or revealed rows still loads: `withoutRemovedPages` folds
those parts (see Stored places), and an unknown lens opens the Overview, never a
blank page.

**An open item is named by the address.** A question (`question` target,
`questionPlace`) and a thread (the Branch target's `threadId`) are items: the
address names them while their panel is open, read by `captureLocation` from the one
open drawer. Closing the panel (Esc, the X, ⌘W, or a tool pressed over it) clears the
address too, and a reload reopens the same item. An item is not depth: Up from it
leaves the page. Close on a question goes back through history to where it was
opened (`closeQuestion`).

## One door

Every move goes through `navigate({ to, mode })`, `back()`, `forward()`, `up()` or
`amendFocus({ patch })`; `sessionPlace`, `agentPlace` and `BOARD_PLACE` build the
`to`.

- **A move lands exactly where `to` says.** A place with no target is the list
  (Runs, Artifacts), never the object shown before, so a caller meaning an object
  passes it as the target. Opening a row is a move Back undoes (`openArtifactPage`,
  `openGithubIssue`).
- **Back to the row.** Runs and Artifacts write the opened row's id into
  `focus.returnRows` and its index into `focus.scroll` with `amendFocus` first
  (`useRowReturn`), so Back scrolls to it even when a row landed above; the index is
  only the fallback for a place saved before ids. Runs unfolds Earlier or Finished
  when the row sits there.
- A background write, such as a run starting, never moves the page.
- **Only the slice writes the view keys** (`activeLens`, `selectedAgentId`, the
  focused target). `__tests__/navigation/oneDoor.test.ts` fails when `features/`,
  `app/` or `shared/` calls `setActiveLens`, `setCurrentSession` or `selectAgent`.
- **A reload keeps a session it can still show**, archived ones included
  (`selectSessionById` in `restoreLocation`). A workspace load empties the archived
  list, so when the saved session is not open `restoreLocation` awaits
  `loadArchivedSessions` first. The Scripts drawer carries its project in its
  payload, so a reload keeps that scope.

## Aliases live in `canonicalLocation`

Only there, before a place is recorded, so no view redirects after it mounts.

- An agent resolves to its home lens, an unknown agent to Agents.
- The pull request and Comments are two lenses that never alias: a door to the pull
  request lands on `pr`, to comments on `review`. On a code-host branch both become
  a Branch section.
- The Branch sections have one registry, `BRANCH_TAB_REGISTRY` in
  `features/branch/branchTabs.ts` (id, label, address token, shortcut,
  availability); `branchTabsOf({ state, hasComments })` returns them in order
  ([branch-page.md](branch-page.md#sections-and-landing)).
- One resolver decides every door, `unavailableBranchTab` in `canonicalLocation.ts`
  through `resolveBranchTab`: `comments` with no pull request and no comment becomes
  `files`, `checks` with no pull request becomes `pr`, every other address stays.
  While `pr` is not available its address parses and prints but lands on `comments`
  (a review being written on `files`), so a pasted or restored `pr` never errors.
- **Changes is a place of a branch.** On a session with a branch a `files` place
  becomes the Branch Changes tab (`branchPlace` with `tab: 'files'`), on the place's
  mount or else the branch looked at last (`doorMountPath`), keeping its file focus.
  A folder session keeps `FilesPane`. A stored `diff` target with `page: 'history'`
  opens the pull request's Commits.

## An address carries its own mount

- `canonicalLocation` never fills a missing mount: a Branch address with `mountPath:
null` stays `null`, and the page shows the active mount when it renders.
- A caller acting on a mount passes it (`branchPlace({ mountPath })`, `lensPlace({
mountPath })`); a door meaning "the mount on screen" leaves it out, and
  `lensPlace` reads it once through `doorMountPath` at the click.
- Back and a reload never move the write destination: the page shows the mount the
  address names, and a write confirm names its repository.

A Branch address also carries `mountId`, null when no mount is known:

1. `branchPlace` leaves it null.
2. `navigate`, Back, Forward and a restore pass every address through
   `withKnownMount`, which fills the id from the path, moves a stale path to its id's
   folder, and makes an id no mount has unavailable (no mount, no focus) instead of
   taking whatever mount now sits at the old path.
3. Only an address without an id falls back to `mountPath`.
4. The open page keeps its id in `diffMountId`, so `captureLocation` saves it by id
   with the id's current folder after a worktree moved.

`trackOf` in `features/track/` reads one mount's github state, selected pull
request, terminals and agents by `mountId`. The journeys are the rows of
`__tests__/surfaces/navigation-flows/target-identity.rows.tsx`.

## Push, amend, replace

- A new place pushes (board and session, session to session, lens, child, a sibling
  from a switcher); pushing the current place replaces it. Page state amends the
  current entry; canonical rewrites replace.
- The stack keeps 50 entries in memory, one stack per workspace, so switching
  workspace finds its history again.
- **Back restores the entry as it was; a forward move arrives clean.** Before a push
  the live view is captured into the current entry, so Back finds the same run,
  artifact or diff focus. A forward move (crumb, Sessions, palette, notification,
  Board) starts with an empty focus. A page tab navigates first and clears the run
  and artifact focus after, so the clear never reaches the entry it leaves
  (`openSessionPage`).
- **Dead entries fall out.** An archived or deleted session removes its entries and
  collapses the duplicates; a gone agent falls back to its home lens.

## Up and the two Backs

**Up goes to the parent.** When the previous entry is the parent, Up is Back;
otherwise it pushes the parent (`upTo({ to })`, called by `up()` and every crumb).
Closing an app studio is Back, so Up from a studio and Close land alike. `crumbsOf`
walks `parentPlace` up to the session.

**Close a session** is Up with Home as the parent (`closeSession`, the Close button at the
end of the session head, ⌘W as the last rung and ⌘↑ on a session tab). When the entry
before the session is Home it is Back, so the history stays clean; from the Board or
another session it pushes Home, and Back reopens the session as it was left. It is
navigation only: no agent stops, nothing is archived, the Board still lists the session.
Esc stays inert on a session tab (`escapeLadder` reads `parentPlace`, which has none there).

| Back              | Follows                                | After a reload                                    |
| ----------------- | -------------------------------------- | ------------------------------------------------- |
| Crumbs and Esc    | `parentPlace`, only inside the session | the same, also in a second window and from a link |
| ⌘↑ and Close      | `parentPlace`, then Home from a tab    | the same                                          |
| History Back (⌘[) | this window's stack of 50              | empty                                             |

- A top agent (a root agent at `s/{session}/workflows/agent/{agent}`, the one page
  `canonicalAgent` resolves for every door) goes back to Runs, crumbs `Overview ›
Runs › {run}` like a run. When an up lands on the Overview, `upTo` writes the agent
  it left into `focus.returnRows['board.lead']` so the board shows its row.
- Opened from a pull request's Runs tab, an agent goes back to that tab, read from
  `focus.runGroup`, which the window layout saves.
- A session tab is the top of its session and has no crumbs. A file open in a
  branchless session's Changes goes back to Changes, then the Overview.
- **A face is not an entry.** Overview and Desk are two faces of the session
  Overview, so the address never names a face. It lives per session in
  `sessionFace`, saved with the dock grid
  ([dock-grid.md](dock-grid.md#the-grid-saved-on-the-session)). A tool opened on the
  Overview turns it to the Desk in place and closing the last tool turns it back,
  pushing nothing (`switchSessionFace`). Back, Forward, the crumbs and Esc never
  change a face; ⌘↑ from the Desk goes to Home.
- **An Auto run keeps one frame.** The run page and every agent page under it draw
  the Agents rail in the frame's left slot (`LeadPage`, `RunAgentsRail`), marking the
  agent in the address, so a reload, Back and Forward restore it; a row opens that
  agent in the centre and the rail keeps its scroll. An agent's parent crumb is the
  agent that spawned it, up to the run (`parentPlace`), and Esc walks the same way.

### Keys

- ⌘[ and ⌘] (`nav.back`, `nav.forward`) and the mouse's back and forward buttons
  walk the stack.
- ⌘↑ (`nav.up`, `goUp`) is Up. On a session tab, with no parent, it goes to Home
  (`closePlaceOf`), the same as Close. In a studio it runs the parent crumb
  of the `StudioTrail` on screen (`studioUpSlot`: Impact › Spend › a provider goes to
  Spend, a full Tasks record to the list); a studio with no trail parent closes. It
  yields to a text field.

## Stored places

One fold, `withoutRemovedPages`, maps every place an older build saved to its new
home. `PLACE_ROWS` (`placeRows.ts`) names the `focus.returnRows` keys that carry what
a place needs without a new stored kind.

| Stored                                                           | Opens as                                                                   |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Overview, Runs, Artifacts, Questions                             | the same place                                                             |
| Changes page                                                     | the Branch page Changes tab, on its branch                                 |
| Context panel, any section, or the Goal, Decisions, Summary lens | the Context tab, `context.section` = that section (`history` for versions) |
| The old Ask drawer                                               | the same page with no drawer (`DROPPED_DRAWERS`); ⌘L opens the Ask pane    |
| An address of the old Agents drawer or Agents page               | Runs, `runs.filter` = `running`                                            |
| Scripts panel, a script run                                      | unchanged, the Scripts drawer                                              |
| An address of the old Explore drawer or page                     | the Changes tab, `changes.mode` = `all`                                    |
| A file opened from the old Explore tree                          | the Changes tab on that file, `changes.mode` = `all`                       |
| A file opened from a link, a reading panel                       | unchanged                                                                  |
| The old Log panel                                                | the session Overview, with its last three rows and Open activity           |
| An unknown lens                                                  | the session Overview                                                       |

The previous release must open every place this build saves: it folds a stored
Context tab to its Context panel, opens a stored Changes tab as that branch's diff
on its pull request page, and a saved Connections page as its Settings page.

## A window comes back where it was

1. `captureWindowLocation` reads the current entry, focus included.
2. `restoreLocation({ location })` replaces the top entry with it as a restore (a
   gone session falls back to the board, a gone agent to its lens).
3. Reload Goodboy (Cmd+Shift+R) writes it into the reload intent in session storage.
4. Each window saves it as `window.layout.<window label>` in the settings table half
   a second after it moves (`useWindowLayout`) and forgets it on close.

After an update or restart, and on any launch with **Reopen last** on, the main
window restores its layout and reopens every other saved window with
`#restore=<old label>`, one per workspace, each reading and forgetting its layout
(`restoreLaunchLayout`). With Reopen last off a plain launch opens Workspaces and forgets
the saved windows. The history stack stays in memory: a restored window starts with
one entry.

## Tests

- `storedPlaces.test.ts` runs every stored row through a frozen copy of the previous
  release's fold (`testing/opensInPreviousRelease.ts`).
- `navigationContract.test.ts` holds the two Backs, the reload and the two windows.
