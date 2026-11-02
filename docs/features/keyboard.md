# Keyboard and terminal

Drive Goodboy from the keyboard, run a shell in the session's worktree, and open the code in your own editor. Scripts, files and terminals sit next to the session, so you rarely leave the app to check on them.

### Terminal

Open a real login shell in the workspace folder or any linked worktree.

**Open a terminal**

- **⌃** with the backtick key opens the Terminal page with every terminal, grouped by session.
- **⌘⌥T**, the worktree menu and ⌘K **Open <repo · branch> in terminal** open a session terminal in a drawer, one click from the page.
- Inside a session, ⌘K **New terminal in this session** adds a fresh tab in that drawer. It uses the active worktree, or the workspace folder when the session has no branch. The session stays open.
- **⌘T** adds a tab in place. **⌘N** opens a picker on the page and in the drawer. Type to filter, use the arrows and Enter.
- The picker offers folders and existing worktrees, one row each with the project and the branch. The path is in the tooltip.
- In the drawer the header reads **Terminal** and one scope picker (project, then branch). ⌘N opens it. **+** adds a tab in the current scope.

**The Terminal page**

- It says **No terminal yet** until you open one.
- It groups terminals by session. Each group shows its row count from two.
- One line per worktree shows the project, the branch and a dot while a shell runs a process.
- Each worktree shows its terminals as tabs with a **+** to add one. A tab selects on a click anywhere on its body.
- Issue chips and the diff stay on the session, not here.
- The folder path line shows only for a plain folder, never for a worktree.
- A session you archive keeps its shells. An **Archived sessions** group sits under the live ones, folded with its count. **Close all** asks first.

**The tab strip**

The strip ends with the same controls on every scope.

- **Change folder** is disabled while a command runs. It clears what is typed on the prompt, then types `cd`. The tab stays under the folder it started in.
- The ports sit next to it.
- **⋯** holds **Send last output**, **Copy worktree path** and **Open session**. A folder with no session has a quiet **Copy folder path** instead.
- **Send last output** attaches the end of the tab's scrollback to the session's composer. It is sent only when you send.
- Selecting text in a terminal shows **Ask the agent about this**. It attaches just the selection the same way.
- A port a terminal listens on shows as quiet text on a worktree row that is not selected. For the selected worktree it shows as a chip at the right edge of the tab strip, never on a tab. A click opens localhost on it.
- Port detection runs every 5 seconds and sees TCP only.

**Close a tab**

- Typing `exit` closes the tab. The next New terminal is a new tab with a new id and an empty prompt.
- **⌘W** closes one thing per press and never quits Goodboy. The order is a popover, the selected terminal tab, the drawer, then the session view.
- **⌘W** asks first while a command runs. The question names the tab and sits under its close button.
- In the drawer, **⌘W** does not close the last idle shell. The drawer closes and the shell keeps running with its scrollback.

**Keys inside a terminal**

- **⌘⇧[** and **⌘⇧]** move to the previous and next tab. They are the session keys, only while a terminal or its tab strip has focus.
- **⌃1** to **⌃9** select tab N (**Ctrl+Shift+1** to **9** off macOS). They are never sent to the shell.
- **F2** on a focused tab renames it.
- **⌘F** searches the scrollback.

**Reload and restart**

- Shells survive a reload. The tabs come back in the same order with the same active tab.
- A restart reopens each tab on its folder with the saved scrollback. That is up to 256 KiB per tab, kept in the app data in files only you can read. They go with the tab, or after a week if it never comes back.
- The tab shows the line "Session restored. The previous process ended." It says so when the folder is gone.

**Dot on Terminal**

When a command that ran for more than ten seconds ends while the terminal drawer is closed, **Terminal** in the tools column gets a dot ("pnpm test finished after 42s"). It does not say whether the command passed, because a shell gives no exit status.

**File paths in output**

- A file path in a terminal's output is underlined, with or without a line and column. Examples are `src/billing/rounding.ts:42:13` and `src/ledger.ts(7,3)`.
- **⌘-click** (Ctrl-click off macOS) opens it in your editor at that line. A plain click stays a selection.
- A path that climbs out of the terminal's worktree opens nothing and says so.
- With no editor found, the file opens in Files at that line.
- The same paths in a script's output are buttons.

**What a tab runs**

- A tab whose shell runs a process shows what it runs next to its title, such as `pnpm test` or `vite --port 4310`. Goodboy reads it from the process table every two seconds.
- The question when you close that tab names the same process. The last command typed in the tab is only the fallback.
- An idle tab keeps its title.
- When Goodboy quits with a process running in a terminal, the tab comes back with a strip above it, "pnpm dev ended when Goodboy quit". A crash or an update that ends Goodboy does the same.
- The strip has **Run it again** and **Dismiss**. **Run it again** types the command and presses Enter, because you asked. The strip shows on the first launch after the quit only.
- **Restart** on a tab that exited by itself runs the command typed in it again. A tab that failed to open, or whose last command was `exit`, restarts empty.

### Keyboard shortcuts, back and forward

Move through Goodboy, change a shortcut and stop an agent without leaving the keyboard.

**Move around**

- Keys on this page are the Mac keys. On Linux, ⌘ reads as Ctrl, and a few chords differ: **⌘I** is **Ctrl+Shift+I**.
- A **⌘⌥** key opens each view. On Linux the chord is **Ctrl+Shift+Alt** with the same letter or digit, since a bare Ctrl+Alt chord belongs to the desktop there.
- **⌘1** to **⌘9** switch workspaces.
- **⌘[** and **⌘]** walk your history.
- **⌘↑** goes up one level to the page that holds the one you are on.
- **⌥⌘↓** goes to the next session that needs you.
- **⌘/** opens the full list.
- The header of that page says that a right click or **Shift+F10** on a list row opens its actions. These are the same words as the tooltip of a row's **⋯**.
- The first time the pointer enters a list, every row shows its **⋯** until the pointer leaves, once.

**Change a shortcut**

- In **Settings › Keyboard shortcuts**, each row with a **Change** button can take another chord. Press **Change**, then the new keys. **Esc** cancels.
- A line above the list refuses three things and names the shortcut that holds the chord.
- Refused: a chord a shortcut in the same place already holds, a system chord (**⌘Q**, **⌘C** and the like), and a key with no modifier.
- **Reset** puts one row back. Recording the default chord does the same. The choices are kept in a local setting, by registry id.
- The menu bar keys, the message keys, **Esc**, plain list keys and the digit rows stay as they are.
- Tooltips and field hints follow a change as they redraw. The Guide text keeps the default until the next launch.

**Fold a column**

- **⌘B** folds the sidebar. **⌥⌘B** folds the column inside the page you are on.
- That column is the session rail on every level, the Chat and Terminal lists, the Guide chapters, the changelog versions, the Settings scopes or the notification filters.
- Each remembers it per page. On a page with no inner column the key does nothing and the palette leaves the entry out.

**Undo and Esc**

- On the Commits page, **⌘Z** undoes a local commit edit and **⌘⇧Z** redoes it. Text fields keep their own undo.
- Tooltips show keys beside their controls. Every hint in the app reads its keys from the shortcut registry, so a key is spelled once. That covers tooltips, the Guide, field hints and the key caps under a composer.
- **Esc** closes the dialog or preview in front, listed as Close the dialog or preview.
- While an agent runs and nothing else is open, **Esc** twice stops it. The first press says "Esc again to stop" beside the Stop square for three seconds. The second stops the agent, listed as Stop the running agent, press twice.
- A menu, a drawer or a dialog that is open always takes the key first. The key leaves the page only when no turn runs.

**The Mac menu bar**

On a Mac the menu bar carries the same keys.

- File holds New Session, New Chat and Close (**⌘W**).
- Edit holds Search.
- View holds the sidebar, the palette, zoom and Reload.
- Go walks to Sessions, Tasks, Chat, Workflows, Terminal, Impact, Notifications and Monitoring.
- Help holds Guide, What's New, Keyboard Shortcuts and Report a Bug.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/keyboard-shortcuts-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/keyboard-shortcuts-light.webp" alt="The Keyboard shortcuts page in Settings, every shortcut in the groups General, Workspaces, Views and Lists, with Command palette on ⌘K, Search on ⌘F, Report a bug on ⌘I and a ⌘⌥ key for each view from Overview to Slack threads">
</picture>

<sub>Screenshot from Goodboy 0.27.1</sub>

### Script drawer

Pin the scripts you use and run them from the session.

- Open the Scripts pane from **Scripts** in the tools column at the right of the session, or with ⌘⌥S.
- It groups scripts on one grid into **Services** (dev servers and watchers) and **Commands** (scripts that run and end).
- A click on a row opens its output. The row's one control is **Run** or **Stop**. **Pin**, **Restart** and the rest live in the right click menu.
- A running service shows its dot and uptime. CPU and memory are two rows in the card you get when you rest on its status.
- **Run** on a Service starts it in place and leaves the list as it is. The row's last line, uptime and port are the feedback. A click on the row, or Enter, opens its output.
- A project with more than one Service has **Start all services** on the Services band. It starts the ones that are not running.
- **Run** on a Command shows the Command's live output in place of the list, with **Run again**, **Copy output**, **Ask the agent about this** and **Back to scripts**.
- **Ask the agent about this** attaches the log to the session's composer without sending it. The log is titled with the script, the exit code and the worktree. The same verb is in the row's right click menu.
- A line a program redraws (a progress bar, a spinner) shows as its last frame, one line.
- A running script takes no input. Its pane says **Output only. Stop ends it.**
- A running script puts a dot on **Scripts**. A run that failed puts a red one there until you open its output.
- A script that ends while you are in another session raises a toast, "Check posting drift failed in ledger-core", with **Open output**.
- When Goodboy quits with services running, the first Scripts view after the next launch has one row, **Start the 2 services that were running**, with **Start** and **Dismiss**. It lists only Services that still exist in the folder they ran in and are not running.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/keyboard-script-drawer-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/keyboard-script-drawer-light.webp" alt="The Scripts pane grouped by project with Services and Tasks, and the Check posting drift output open on the right: Failed after 12s in ledger-core on nw/fix-settlement-replay, the failing vitest output, Run again, Exit 1 and Copy output">
</picture>

<sub>Screenshot from Goodboy 0.27.1</sub>

### Open in editor

Jump into VS Code, Cursor, Zed, the JetBrains IDEs, Sublime Text, Vim or Neovim, at the worktree or the file. **Open with**, in **Settings › General**, picks the editor, the terminal app and the browser that links and artifacts open in. **Open in terminal app** sits in the menus of a session, a branch folder, a worktree and a folder in Files. It opens the folder in Terminal.app, iTerm, Warp or Ghostty, whichever are installed. A file path with a line number in a terminal opens at that line in your editor. `code -g`, `zed` and `subl` take `file:line:col`. The JetBrains IDEs take `--line` and `--column`. Linux uses the system terminal.

### Explore

Browse the session folder as a file tree, with a preview of the selected file beside it, **Open** and **Copy**. Files that changed against the base branch carry a letter, and **Changed** lists only those. **Ask about this file** on a file row opens **Start a run** with the file attached: write the ask, and Auto routes it like any other.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/keyboard-explore-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/keyboard-explore-light.webp" alt="Explore in Harborline: the session folder of payments-api as a file tree with a letter M or A on the files that changed against the base branch, the All files and Changed 7 switch, and the rounding.ts changes on the right with its Preview and Changes tabs and Open">
</picture>

<sub>Screenshot from Goodboy 0.27.1</sub>

## Under the hood

This part is for contributors and agents who change the feature.

- Archived sessions group: `terminalGroups` and `CloseGroupButton` build the group and its **Close all**.
- Process on a tab: `terminal_list_live` returns `foregroundCommand`, shaped by `foregroundLabelOf`. `terminalCommandOf` is the fallback.
- Linux chords: a registry test fails any ⌘⌥ entry without its Ctrl+Shift+Alt chord.
- Changed shortcuts: the local setting `shortcuts.overrides`, by registry id.
- One spelling per key: hints read the shortcut registry through the `shortcut` prop or `shortcutGlyphs`.
- Stop the running agent: the registry id is `agent.stop`.
- Service usage: `serviceUsageCardOf` builds the card with CPU and memory.
