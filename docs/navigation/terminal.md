# Terminal in the dock and on its page

> **Read this when** you change where a terminal opens, its folder picker, its tabs, its signals, Run in terminal, or the Terminal page. **Not for** the rail button ([session-tools.md](session-tools.md)) or the dock grid ([dock-grid.md](dock-grid.md)).

One Terminal studio serves every terminal: it lives in the dock, and its page is the
large size of the same object. A terminal id is `<sessionId>::t<n>` for a session
and `ws:<workspaceId>::t<n>` for the workspace (`terminalOwner.ts`). A session has
no Terminal page of its own; a saved location naming the old session terminal lens
lands on the Overview (`withoutRemovedPages`).

## Terminal opens in the right dock

⌃` (`terminal.studio`), ⌘⌥T (`session.terminal`), the rail button, the Go menu and
Search or run all run `toggleTerminalDock`: on a session page the session's terminal
on its worktree, elsewhere the workspace folder terminal (`openWorkspaceTerminal`,
owner `ws:<workspaceId>`, drawer `sessionId: null`).

- The dock stays open across every move. File > New Terminal adds a fresh tab there,
  or on the Terminal page while it is open. A request waiting for the home folder is
  dropped when the dock, the page or the session changed meanwhile. The panel loads
  on first open (`LazyTerminalDrawer`).
- **It picks its folder** (`toggleSessionTerminal`): with one worktree, that one;
  with several, the one this session last opened a terminal on (`terminalScopes`,
  set by `openSessionTerminal`), else the active mount; without a branch, the session
  folder (`scratch_dir_prepare`, dropped when you left before it answered). The scope
  lives in memory and goes with the session.
- **One path into a session terminal.** `openSessionTerminal` adds a terminal at the
  worktree (or reuses a running one there, never with a `prefill`) and opens the
  `terminal` drawer (`DrawerContent` `{ kind: 'terminal'; payload: { terminalId }
}`, `TerminalDrawer` in `DrawerHost`, side sizing). Every door uses it: the mount
  row and diff `Open in Terminal`, the rebase banners (`openMountTerminal`), the
  session row menu, ⌘K `Open <repo · branch> in terminal`
  (`session.openWorktreeTerminal`, one per worktree) and ⌘⌥T.
- **Run in terminal** (a command tool card or a shell block in a message,
  `useRunInTerminal`) is that path with a `prefill` from `typedCommandOf`: one line as
  typed, several as one bracketed paste, control characters dropped, no line end. It
  never presses Enter, and an archived session hides it.

### The dock header

- The terminal icon, then the scope picker in the title's place
  (`TerminalScopePicker`, a combobox named `Terminal folder`, as `DrawerFrame`'s
  `titleContent`; the region stays `Terminal`): the branch in mono, never the
  worktree folder hash.
- Its menu names each place `project · branch`: this session's worktrees (an info dot
  when a shell there runs a process), the main checkout, the workspace folder and,
  without a branch, the session folder. A pick opens or reuses a shell there
  (`openSessionTerminal`, a workspace-owned tab for the workspace folder); each scope
  keeps its own tabs, and nothing is killed.
- Then the short worktree chip (truncating before the buttons), Open full page and
  Close, over the page's tab strip, so drawer and page show the same tabs. The folder
  pill ends with "All terminals" (the Terminal page), and a Scripts menu ends the tab
  row (`TerminalScriptsMenu`: a pick opens a tab in the pill's folder and types the
  command, `scriptCommandOf`). The Scripts chord still opens the old drawer until it
  is removed.
- Closing the drawer never kills a shell: the tabs stay in the Terminal list under
  the session, and the drawer closes by itself when its worktree has none left. A
  worktree that goes away under an open terminal shows "This worktree was removed".
  `Open full page` selects the same tab on the page, which remounts on the same pty
  and replays its scrollback.

### Signals

- The Terminal button shows a dot when a command that ran over ten seconds ended
  with the drawer closed (`useTerminalFinishSignal`, a 3 second poll of
  `terminal_list_live` kept to the latest answer, state in `terminalFinishes`,
  cleared when the drawer opens). It says "finished", never "failed": it does not
  read the exit status.
- A script that ends while its session is off screen raises one toast, `<script>
failed in <project>` (or `finished`), with `Open output`, from
  `ScriptEndToastBridge` over `goodboy:script-ended`; a script you stopped, or a run
  that ended while the app was closed, raises nothing.

## The Terminal page

Opened from the dock's `Open full page` (`openTerminalOnPage`, a push, so ⌘[ brings
the dock back on the same tab) and left by `Dock` in its header
(`dockTerminalPage`); with no terminal yet, `Dock` opens one in the dock
(`dockEmptyTerminalPage`), as the empty Browser page does.

It is `StudioPlace` `{ kind: 'terminal'; terminalId; sessionId; worktree }` in
`TerminalStudio`: `StudioShell` plus `StudioRailLayout surface="terminal"`, a rail
that does not fold. With no terminal at all there is no rail, and the empty state
owns the single `New terminal`.

- **New terminal** heads the rail, a split control: the button opens a tab in the
  selected worktree, the chevron the picker (`NewTerminalMenu`,
  `terminalPickerClusters`), opening right (`useDropdown` `side: 'right'`) in
  clusters: `Workspace folder` first, named by the folder (`harborline`), then one per
  session with attached worktrees, headed by its title. A row is the project, the
  branch, the short worktree chip and the path on one line; `Open project` opens the
  project settings. A worktree path keeps its project folder and `gb-` folder whole
  (`pathTail`), the head truncating first.
- **The list** is one `ListGrid` named `Terminals`: one `ListGridGroup` per session
  with terminals (its title cut at the end, the full title in `aria-label`, a visible
  `Open session` arrow, the terminal count), `Workspace folder` last with no action.
  Inside, one 28px row per worktree (`terminalWorktrees.ts`, key
  `<sessionId>#m:<mountId>`, or `#p:<cwd>` with no mount): branch or folder icon,
  project and branch, the first port (hidden on the selected row, whose ports sit at
  the tab strip's end) and a running dot; the path and every port in the tooltip
  (`TerminalWorktreeRow`).
- **Tabs.** A selected row shows its terminals as tabs (`TerminalTabStrip`) with a
  `+`. No terminal header: the strip's end carries `TerminalStripActions`, a `⋯` with
  `Open session` and `Copy worktree path` (or `Copy folder path`) from the
  `terminalTab` kind, a single word when only one applies.
- A new terminal is always a tab of its worktree, `shell`, then `shell 2`
  (`nextTerminalTitle`); double click renames, Enter saves, Esc cancels.
- When a shell exits, whatever the code, its tab closes and a neighbour of the same
  worktree is selected; the watch lives in the terminal slice (`watchTerminalExits`,
  started by `reattachTerminalTabs`), so it works with the page closed. Only a
  terminal that failed to start stays, as a `failed` chip with a restart button,
  never reopened on its own.
- The 28px close x is always visible: an idle shell closes at once, a busy one asks
  in a `ConfirmPopover` (`Keep`, danger `Close`).
- The detail is a location row (the cwd trimmed to the workspace folder, middle
  truncated, with the `cd` menu only while idle), the tab strip, then the shell.
- `⌘T` (`terminal.newTab`) adds a tab to the selected worktree while one has focus.
  ⌘K has `Terminal` (`goto:terminal`, the dock), `New terminal`
  (`action:new-terminal`) and, with worktrees, `Open <repo · branch> in terminal`.
