# The session tools and the Scripts pane

> **Read this when** you change the right rail (Terminal, Browser, Scripts, Ask, Monitor), a tool's state or signal, or the Scripts pane. **Not for** the terminal itself ([terminal.md](terminal.md)), the drawer geometry ([right-drawer.md](right-drawer.md)), the grid of open tools ([dock-grid.md](dock-grid.md)) or the Browser pane ([browser.md](../browser.md#the-pane)).

## The right rail

One 56px column (`TOOL_RAIL_WIDTH_PX`; 44px icons only, the name in the tooltip,
under a 1100px window) at the window's right edge on every workspace screen,
`aria-label="Tools"` (`SessionTools`, drawn by `ShellToolRail` in the shell's
`rightRail` slot, and inside their own sheet by Tasks, Chat and Workflows).

- It lives in the drawer container, never the page container, and every panel opens
  inward of it ([right-drawer.md](right-drawer.md#the-rail-is-the-anchor)).
- It holds Terminal, Browser, Scripts, Ask and Monitor (`RAIL_TOOLS`, each with its
  pane id and optional shortcut), with no heading. All five stay visible on every
  workspace page; Scripts and Ask are disabled without a session and say "open a
  session first" (`ToolRailFrame`, `toolFactOf`). `toggleRailTool` toggles each
  panel to the rail's left. Explore, Agents and Context open from their pages and
  keys.
- Tasks, Chat and Workflows fade their content while the rail stays still
  (`StudioFrame` animates its `data-studio-motion` nodes); a record panel open with
  the page fades with it, one opened later keeps the drawer's motion. Moving between
  the shell rail and a page's rail keeps focus on the same tool (`railFocusMemo`).
- A scene or frame without the shell rail keeps the column inside `SessionFrame`
  (`ShellRailContext`).

### Buttons

- `SessionToolButton` names each tool under its icon in the 9px `text-rail` role:
  secondary (`TEXT_ROLE.secondary`) closed, label strength open, so captions keep
  their contrast in light mode. One grid cell each, icon over label on one centre
  column; the open tool is a quiet filled tile (`bg-selected`, no border).
- Under a 480px tall window all captions hide together. Every tooltip gives the
  name, the shortcut and any signal reason.
- Ask has its own question glyph (`CONCEPT_ICONS.ask`), distinct from Chat, and
  reads **Ask this session** with ⌘L on hover.

### Tool states

`toolStateOf`:

| State   | When                                             | Drawn                                                       |
| ------- | ------------------------------------------------ | ----------------------------------------------------------- |
| at rest | closed                                           | the icon                                                    |
| pressed | it holds the slot                                | `bg-selected`                                               |
| waiting | it is the tool in the slot's back chip           | a small ring (`ToolWaitingRing`), named `Terminal, waiting` |
| current | its page is open (Terminal, Browser, Monitoring) | selected, `aria-current="page"`, a click does nothing       |

The rail rings a tool from the same `selectSlotBack` the drawer's back chip reads,
so they never disagree: a reader or form in the chip rings nothing, and a pressed
tool never rings.

### Signals

- Terminal names its running terminals (`Terminal, 2 running`) and Browser its tabs
  (`Browser, 3 tabs`), from `toolFactOf` over `runningTerminalCount` and
  `selectBrowserTabCount`, in the tooltip.
- Monitor shows ports in use as a `CountBadge` (`toolCountOf`, `ToolCountMark`),
  warning when a pinned port is down; with no port in use a down pin shows a warning
  `StatusDot` instead (`tool-warning`), since a zero badge draws nothing. Count and
  fact come from `monitoringSignalOf`, on the same `monitoringSignal` as the left
  door.
- The signal dot and the waiting ring anchor to the 16px glyph (`tool-glyph`,
  `TOOL_CORNER_SLOT`), at its top end and top start; the port count sits on the
  button's corner, never over the label. A dot sits with any state and keeps its
  reason in the accessible name: updating, failed, changed, or a finished script or
  command.
- The column is a vertical toolbar with one tab stop: Up, Down, Home and End move
  (`toolbarIndexAfter`).
- An overlay drawer leaves live tools at its right edge (`DrawerEdgeContext`); the
  page stays live, never inert. `drawerLayoutOf` decides push or overlay from the
  content width excluding both rails ([styling.md](../styling.md)). Folding the rail
  leaves the column in place.

## Opening the tools

- **Terminal, Browser and Monitor open on every page.** In a session Terminal and
  Browser belong to it; Monitor always shows the workspace.
- **Monitor** opens `MonitoringDrawer` with `sessionId: null` through
  `toggleRailTool`; its header has Open full page, and `UNSAVED_DRAWER_KINDS` keeps
  it out of the saved layout.
- **Terminal and Browser** toggle with `toggleTerminalDock` and `toggleBrowserDock`
  ([terminal.md](terminal.md#terminal-opens-in-the-right-dock)): on a session page on
  the session's terminal or tabs, elsewhere on the workspace's (for Browser, the
  session the Browser page would pick, with an empty state when there is none).
- **Open full page** in the dock header grows a tool into its page
  (`openTerminalOnPage`, `promoteBrowserTab`, a push). While the page is open the
  dock stays in the store but is not mounted, so Back brings it back on the same tab;
  Dock on the page moves it back (`dockTerminalPage`, `demoteBrowserTab`).
- **Browser** opens a page beside the work (kind `browser`, `features/browser/`):
  the session's tabs and the project pins in a reader tier pane
  ([browser.md](../browser.md#the-pane)).
- **Scripts and Ask are dock tools.** Their buttons name the session
  (`toggleRailTool`); `DrawerHost` renders `ScriptsPanel` and `AskPane` in a
  `DrawerFrame` grid cell. The Scripts chord, the palette's Open Scripts, toasts and
  stored notifications (`open-lens` scripts) still open Terminal through
  `openToolPane`.
- **Ask** opens the session's Ask panel (`openAsk` and `closeAsk` name the session);
  a second press closes it. It stays while the tabs change, and the Overview never
  becomes the Desk for it (`deskToolsOf` leaves Ask out). ⌘L (`ask.open`) opens it
  and focuses its box; Close or Esc hides it. Ask keeps its conversation and starts
  no agent, and the Context tab holds no Ask ([drawer-kinds.md](drawer-kinds.md#ask)).
- Outside a session the **Chat** door answers what Ask answers for one session.
  Explore and Context read one session, and ⌘L is bound only while one is visible.
  Explore is **All files** on Changes; Context is its tab.
- **One dock and one detail together.** `panelsOf` pairs Terminal, Browser or
  Monitor with a detail (`isWorkspaceTool`, `isPairedSlot`). A second click closes
  the selected panel; another panel in the same slot replaces it. Esc closes through
  `DrawerFrame`.

### No tool opens by side effect

- **There is no Agents panel.** ⌘⌥A (`session.spawned`) and its palette row open
  Runs on what is running, and a window saved with the old `spawned` panel opens
  Runs filtered to Running (`withoutRemovedPages`).
- An Auto row of Runs opens the Auto page and nothing beside it. The Overview's run
  row opens that exact run page, an orchestrated run included, and Back returns;
  its step rows and status sentence are status, not links.
- **An agent opens in the centre.** Every door to an agent (the Overview, a
  delegation line, a run step, Who asked, a notification, the palette) lands on its
  page (`AgentDetailPane`, with the Auto notice for an Auto child; a preset run step
  reads as its step page through `presetRunFocusOf`). A window saved with the old
  `auto-child` or `run-step` drawer opens the page.
- **A saved level 2 lands on its page.** A window saved on a run or on the Auto
  level opens that page with no panel (`withoutRemovedPages` drops `sidebar-level`);
  a tool it had open stays. The drawer belongs to the window's store.
- `withoutRemovedPages` sends a stored `explore` or `scripts` page to the Overview
  with that pane open, and drops a stored `terminal` page.

## The Scripts pane

A toolbar (a `Filter scripts` field from nine rows on, which `/` focuses, and an
icon `New script`) over one list grouped by mount, project plus branch, from
`useSessionScripts`. The session has no scripts section of its own: `$` launches
([palette.md](palette.md#scripts-with-)), the Now chip watches.

### Groups and packages

- A project mounted twice is two groups, its saved scripts in both; you pick where a
  script runs by picking its group. A header collapses its group, kept per workspace
  (`goodboy:scripts-groups-collapsed:v1:<workspaceId>`). Branch names that share a
  prefix cut in the middle and keep their last 12 characters (`midTruncate`,
  `MidTruncate`).
- **Start all services** sits on the mount header, and its one ghost refresh on the
  rows' right edge.
- Inside a group: the project (the header), then Saved (when a script is saved) or
  a package, then the row.
- With several manifest packages (a pnpm, yarn or npm workspace, or package.json
  beside composer.json), Saved is its own `ScriptSavedSection` (`Saved N`) above one
  `ScriptPackageSection` per package: a `Package` glyph, the manifest name, the
  folder in mono (none for root), the script count, and an info `N running` badge
  while something runs. With one package, rows stay flat.
- Root first, then workspace packages by folder, then composer. The filter matches
  the package name, the folder and a script's body.
- Each package section has its own chevron. Beyond six packages they start closed,
  except the root, one with a script running or run today, and any a live filter
  matches (a filter always opens its matches). The state you pick is kept per
  workspace and package (`goodboy:scripts-packages-collapsed:v1:<workspaceId>`).

### Rows

Services first (category `dev`, or a script named `start`, `serve`, `watch` or
`preview`, by `isService`), then Commands, with no band labels, on one grid. Every
row is the same `ScriptRow`:

- a category node; the name, its tooltip naming the invocation (`Runs yarn workspace
@northwind/web run dev`); the script's **body** (`vite --port 3000`, not `yarn run
dev`, since the invocation made every `dev` row look alike);
- Source, hidden inside a Saved or package section and shown as
  `Saved`/`package.json`/`composer.json` only in a flat list;
- Last run in glyph and word;
- one right edge: Pin, Run and a `…` menu (saved: Edit, Duplicate, Delete with an
  inline confirm; manifest: Save as script, Copy command, both with the invocation),
  visible at rest, with Stop while the script runs.

- A running service shows its last output line, its uptime (CPU and memory in the
  tooltip, from the monitor snapshot for the run's pid, polled only while the lens is
  open) and its port as a link once a listener owned by the run exists. An idle one
  shows its expected port, or `:5005 in use` in warning when another worktree holds
  it. A task row shows a result glyph, duration and age in gray, and a failure's last
  line.
- **Open in terminal** in the row menu runs `openScriptInTerminal` in that mount's
  worktree with the command prefilled; **Pin**, **Restart** and the rest are on right
  click.
- A row click opens its output in the `scriptRun` drawer
  ([drawer-kinds.md](drawer-kinds.md#script-output)) and selects the row.
- New script and Edit open the same inline `ScriptEditor` card, at the top of the
  active mount's group or in place of the row.
- "Save as script" from a workspace package writes a command that still runs in that
  package from the project root, where saved scripts run (`workspaceInvocation`:
  `yarn workspace <pkg> run <name>`, `pnpm --filter <pkg> run <name>`, `npm run
<name> --workspace <dir>`, `bun run --filter <pkg> <name>`, `composer run-script
<name> -d <dir>`).
- Saved scripts of workspace projects not in the session are named in one line
  under the groups.

### Pins and suggestions

A pin belongs to the project, not the worktree: its id is the source, the folder and
the name (`scriptPinId`, a saved script by its id), stored as a JSON list in the app
setting `scripts.pinned.<projectId>` (`toggleScriptPin`, loaded by `loadScriptPins`
through `useScriptPins`).

- A pinned script shows once: in the `Pinned` strip at the top only when the session
  has several projects (a click runs it in its group's worktree), else in the rows.
  The palette lists pinned scripts under `$` with the project name
  (`scriptPinEntries`, run through `runPinnedScript`).
- A project with nothing pinned shows a dimmed **Suggested** band (its root `dev`,
  `build`, `test`, `lint` and `typecheck`, first match each), each row with **Run**
  and a quiet **Pin**. A Run leaves its result on the row, a running row swaps Run
  for **Stop** and opens its output, and a row with a result stays after another
  script is pinned.
- A project with no pinned or saved script reads `No scripts in <project>` with an
  inline `Pin a script` (`ScriptPinPicker`, listing its manifest scripts; a pin adds
  the row) and `New script`, never a trip to Settings.
- On the workspace Projects page a project's open editor card ends with a `Scripts`
  field (`ProjectScriptsField`, `Scripts · N pinned`) where the other scripts are
  pinned. It reads the folder when the card opens (`loadProjectRootScripts`, kept in
  memory by root path), says `On <base>` and where a pin shows, and lists the scripts
  with the same pin. A package label shows only with several packages; a project
  with no package.json or composer.json says so; a failed scan is an inline `Notice`
  with `Retry`. The row stays 32px with no scripts control.
