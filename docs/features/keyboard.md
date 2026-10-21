# Keyboard and terminal

Drive Goodboy from the keyboard, run a shell in the session's worktree, and open the code in your own editor. Scripts, files and terminals sit next to the session, so you rarely leave the app to check on them.

### Terminal

Open a real login shell in the workspace folder or any linked worktree. **⌃`** opens the Terminal page with every terminal, grouped by session. **⌘⌥T**, the worktree menu and ⌘K **Open <repo · branch> in terminal** open a session terminal in a drawer, one click from the page. Inside a session, ⌘K **New terminal in this session** adds a fresh tab in that drawer on the active worktree, or on the workspace folder when the session has no branch, and the session stays open; **⌘T** adds a tab in place and **⌘N** opens a picker (type to filter, arrows, Enter) on the page and in the drawer. The picker offers folders and existing worktrees, one row each with the project and the branch (the path is in the tooltip). In the drawer the header reads **Terminal** and one scope picker (project, then branch), which ⌘N opens; **+** adds a tab in the current scope. The Terminal page has the title **Terminal** on the same header row as every other page, with **No terminal yet** under it at the same left edge until you open one, and groups terminals by session on one grid, each group with its row count from two, and one line per worktree (project, branch, a dot while a shell runs a process); the port and dot cells leave the grid when no row fills them, so the branch keeps the room. Issue chips and the diff stay on the session, not here. Each worktree shows its terminals as tabs with a **+** to add one; the strip ends with the same controls on every scope: **Change folder** (disabled while a command runs), the ports, then **⋯** with **Copy worktree path** and **Open session**, or a quiet **Copy folder path** on a folder with no session. The folder path line shows only for a plain folder, never for a worktree. A tab selects on a click anywhere on its body and its name keeps a 48px floor. A port a terminal listens on shows as quiet text on a worktree row that is not selected and, for the selected worktree, as a chip at the right edge of the tab strip (never on a tab), where a click opens localhost on it (detection runs every 5 seconds and sees TCP only). **⌘W** closes one thing per press and never quits Goodboy: a popover, then the selected terminal tab (it asks first while a command runs, naming the tab, under its close button), then the drawer, then the session view. Typing `exit` closes the tab, and the next New terminal is a new tab with a new id and an empty prompt: each owner keeps a counter that only goes up (saved with the tabs), and closing a tab makes the app forget the exited output it kept for ten minutes, **⌘F** searches the scrollback, and shells survive a reload. After a reload or a restart the tabs come back in the same order with the same active tab; a restart reopens each on its folder with the saved scrollback (up to 256 KiB per tab, kept in the app data and deleted with the tab) and the line "Session restored. The previous process ended.", and says so when the folder is gone.

### Keyboard shortcuts, back and forward

A **⌘⌥** key opens each view, **⌘1** to **⌘9** switch workspaces, **⌘[** and **⌘]** walk your history, **⌘↑** goes up one level to the page that holds the one you are on, and **⌘/** opens the full list. **⌘B** folds the sidebar and **⌥⌘B** folds the column inside the page you are on: the session rail on every level, the Chat and Terminal lists, the Guide chapters, the changelog versions, the Settings scopes and the notification filters; each remembers it per page, and on a page with no inner column the key does nothing and the palette leaves the entry out. On the Commits page, **⌘Z** undoes a local commit edit and **⌘⇧Z** redoes it; text fields keep their own undo. Tooltips show keys beside their controls. On a Mac the menu bar carries the same keys: File holds New Session, New Chat and Close (**⌘W**), Edit holds Search, View holds the sidebar, the palette, zoom and Reload, Go walks to Sessions, Tasks, Chat, Workflows, Terminal, Impact, Notifications and Monitoring, and Help holds Guide, What's New, Keyboard Shortcuts and Report a Bug.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/keyboard-shortcuts-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/keyboard-shortcuts-light.webp" alt="The Keyboard shortcuts page in Settings, 105 shortcuts in the groups General, Workspaces, Views and Lists, with Command palette on ⌘K, Search on ⌘F, Report a bug on ⌘I and a ⌘⌥ key for each view from Overview to Slack threads">
</picture>

<sub>Screenshot from Goodboy 0.27.1</sub>

### Script drawer

Pin the scripts you use and run them from the session. The Scripts pane (the Scripts icon in the tools column at the right of the session, ⌘⌥S) groups them into **Services** (dev servers and watchers) and **Tasks** on one grid: a click on a row opens its output, the row's one control is **Run** or **Stop**, and **Pin**, **Restart** and the rest live in the right click menu. A running service shows its dot and uptime; CPU and memory are two rows in the card you get when you rest on its status (`serviceUsageCardOf`). A script's live output replaces the list in the pane, with **Run again**, **Copy output** and **Back to scripts**.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/keyboard-script-drawer-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/keyboard-script-drawer-light.webp" alt="The Scripts pane grouped by project with Services and Tasks, and the Check posting drift output open on the right: Failed after 12s in ledger-core on nw/fix-settlement-replay, the failing vitest output, Run again, Exit 1 and Copy output">
</picture>

<sub>Screenshot from Goodboy 0.27.1</sub>

### Open in editor

Jump into VS Code, Cursor, Zed, the JetBrains IDEs, Sublime Text, Vim or Neovim, at the worktree or the file. **Open with**, in Settings, General, picks the editor and the browser that links and artifacts open in.

### Explore

Browse the session folder as a file tree, with a preview of the selected file beside it, **Open** and **Copy**. Files that changed against the base branch carry a letter, and **Changed** lists only those. **Start an agent** on a file row starts an agent on that file.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/keyboard-explore-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/keyboard-explore-light.webp" alt="Explore in Harborline: the session folder of payments-api as a file tree with a letter M or A on the files that changed against the base branch, the All files and Changed 7 switch, and the rounding.ts changes on the right with its Preview and Changes tabs and Open">
</picture>

<sub>Screenshot from Goodboy 0.27.1</sub>
