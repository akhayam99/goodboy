# Navigation and information architecture

> **Read this when** deciding what surface exists and where it lives: a rail,
> a pane, the top bar, the crumbs. **Not for** spacing/scroll/overlay
> mechanics (`docs/styling.md`) or design intent and tone (`DESIGN.md`).

This page is the hub for [navigation/](navigation/). A heading keeps its name when
it moves, so a link such as `navigation/shell.md#top-bar` and the words "Top bar"
find the same text.

## How the screen works

- **The frame.** One strip of chrome, the top bar, over the places rail on the
  left, one main slot, and, inside a workspace, the right rail at the window's
  edge. There is no footer, and no surface draws a frame of its own.
- **Three surfaces, three jobs.** The top bar is now (what happens, where you are,
  what it costs); the places rail is access (New, Board, Tasks, Workflows, Chat,
  Connect, Impact, and Settings at the foot); the ⌘K palette is transit. The right
  rail holds the tools (Terminal, Browser, Scripts, Ask, Monitor), which open in a
  dock beside the page.
- **One main slot.** The Board, a session, the New session draft and every studio
  are pages in it, one at a time. A studio draws over the page it replaces, and the
  page's drawer parks until it closes. A door replaces the open studio; a link
  inside a studio stacks; Close, Esc and Back leave the same way; every page lights
  exactly one control.
- **A session** is a child of the Board. Its head holds the title row and the page
  tabs (Overview, Runs, Artifacts, Questions, Context); a page below a tab shows
  crumbs and a back button instead. A branch is one Branch page with its own tabs.
  The right drawer holds reference beside the page, and a tool opened on the
  Overview splits it into the Desk.
- **Addresses.** Every view has an address in one history per window and
  workspace. Every move goes through one door, aliases resolve in
  `canonicalLocation`, and an older build's stored places fold in
  `withoutRemovedPages`.
- **Actions.** Every object's verbs are written once, in the action registry; the
  `⋯` menu, the right click and the palette read the same list.

## Pages

### Rules and shell

| Page                                                | Open it when you change                                                      |
| --------------------------------------------------- | ---------------------------------------------------------------------------- |
| [model.md](navigation/model.md)                     | homes, destinations, doors and links, the selected sign, undo, follow toasts |
| [addresses.md](navigation/addresses.md)             | a place, a target, Back, Forward, Up, stored places, window restore          |
| [palette.md](navigation/palette.md)                 | the ⌘K palette: scope, the empty list, ranking, prefixes, `$` scripts        |
| [context-menus.md](navigation/context-menus.md)     | a verb, a menu, a selection bar, a confirm, the webview menu                 |
| [shell.md](navigation/shell.md)                     | the skeleton, the top bar, the rail foot, the menu bar, column doors         |
| [surfaces.md](navigation/surfaces.md)               | the layout slots, the places rail, the Desk, a parked drawer, header actions |
| [shortcuts.md](navigation/shortcuts.md)             | a shortcut, a plain key, a per-OS combo, Esc in full screen                  |
| [help.md](navigation/help.md)                       | the Help page, the Guide and What's new                                      |
| [setup-and-crash.md](navigation/setup-and-crash.md) | the bug sheet, crash and freeze records, first-run setup, boot               |
| [connections.md](navigation/connections.md)         | the Connections page, its tiles, key checks, links into it                   |

### Session

| Page                                            | Open it when you change                                                                 |
| ----------------------------------------------- | --------------------------------------------------------------------------------------- |
| [session-rail.md](navigation/session-rail.md)   | the page tabs, the head and title row, crumbs, Esc, switching sessions, the Board model |
| [projects-card.md](navigation/projects-card.md) | the Projects, Folder and Linked cards, a branch row, Rebase all                         |
| [lens-surfaces.md](navigation/lens-surfaces.md) | the Overview, Activity, Runs, Questions, Artifacts, an issue, an agent, files           |
| [session-tools.md](navigation/session-tools.md) | the right rail, a tool's state and signal, the Scripts pane                             |
| [terminal.md](navigation/terminal.md)           | the terminal in the dock and the Terminal page                                          |

### Drawer and dock

| Page                                          | Open it when you change                                                   |
| --------------------------------------------- | ------------------------------------------------------------------------- |
| [right-drawer.md](navigation/right-drawer.md) | the drawer containers, tiers, push rule, slots, focus, floating surfaces  |
| [dock-grid.md](navigation/dock-grid.md)       | the grid of open tools, resizing, dragging, the grid saved on the session |
| [drawer-kinds.md](navigation/drawer-kinds.md) | what one kind shows: artifacts, Ask, transcript, Context, script output   |

### Home and studios

| Page                                                | Open it when you change                                                    |
| --------------------------------------------------- | -------------------------------------------------------------------------- |
| [home-and-drawer.md](navigation/home-and-drawer.md) | Home, the New workspace form, creating a session, the New session draft    |
| [studios.md](navigation/studios.md)                 | a studio's frame, the Esc stack, Notifications, Tasks, page rails, records |
| [trails.md](navigation/trails.md)                   | a studio trail, its compaction, a segment menu                             |
| [settings.md](navigation/settings.md)               | Settings, its pages and rows, Restore defaults, Storage, security findings |

### The Branch page

| Page                                                        | Open it when you change                                                |
| ----------------------------------------------------------- | ---------------------------------------------------------------------- |
| [branch-page.md](navigation/branch-page.md)                 | the frame, address, header and its one step, tabs, landing, counts     |
| [branch-push.md](navigation/branch-push.md)                 | pushing, the banners, a failed push and its fix agent, stale deps      |
| [branch-conversation.md](navigation/branch-conversation.md) | the merge box, the side column, the Activity, the create form, hosts   |
| [branch-changes.md](navigation/branch-changes.md)           | the Changes rail and tree, All files, the toolbar, loading, file cards |
| [diff-notes.md](navigation/diff-notes.md)                   | notes, threads and review in the diff, the identifier popover          |
| [branch-comments.md](navigation/branch-comments.md)         | the Comments list, the open comment, fix runs, the Comments counts     |
| [branch-commits.md](navigation/branch-commits.md)           | the Commits graph, live edits, backups, Rebase on main                 |
| [branch-work.md](navigation/branch-work.md)                 | the Checks and Work tabs                                               |
