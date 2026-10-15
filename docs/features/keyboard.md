# Keyboard and terminal

Drive Goodboy from the keyboard, run a shell in the session's worktree, and open the code in your own editor. Scripts, files and terminals sit next to the session, so you rarely leave the app to check on them.

### Terminal

Open a real login shell in the workspace folder or any linked worktree. **⌃`** opens the Terminal page with every terminal, grouped by session. **⌘⌥T**, a mount row and ⌘K **Open <repo · branch> in terminal** open a session terminal in a drawer, one click from the page. The page groups terminals by session with one row per worktree, and each worktree shows its terminals as tabs with a **+** to add one; **Open session** on a group goes to that session. A port a terminal listens on shows as a chip, on the tab and summed on the worktree, and a click opens localhost on it (detection runs every 5 seconds and sees TCP only). Typing `exit` closes the tab, **⌘F** searches the scrollback, and shells survive a reload. After a reload or a restart the tabs come back in the same order with the same active tab; a restart reopens each on its folder with the saved scrollback (up to 256 KiB per tab, kept in the app data and deleted with the tab) and the line "Session restored. The previous process ended.", and says so when the folder is gone.

### Keyboard shortcuts, back and forward

A **⌘⌥** key opens each view, **⌘1** to **⌘9** switch workspaces, **⌘[** and **⌘]** walk your history, and **⌘/** opens the full list. On the Commits page, **⌘Z** undoes a local commit edit and **⌘⇧Z** redoes it; text fields keep their own undo. Tooltips show keys beside their controls.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/keyboard-shortcuts-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/keyboard-shortcuts-light.webp" alt="The Shortcuts page in the groups General, Workspaces, Navigate and Views, with Command palette on ⌘K, Report a bug on ⌘I, Back on ⌘[ and Forward on ⌘], and a ⌘⌥ key for each view from Overview to Slack threads">
</picture>

<sub>Screenshot from Goodboy 0.13.1</sub>

### Script drawer

Pin the scripts you use and run them from the session. The Scripts lens groups them into **Services** (dev servers and watchers) and **Tasks**, with **Stop** and **Restart** on a service. Open a script's live output in a drawer beside the list, with **Run again** and **Copy output**.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/keyboard-script-drawer-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/keyboard-script-drawer-light.webp" alt="The Scripts page with the Check posting drift drawer open on the right: Failed after 12s in ledger-core on nw/fix-settlement-replay, a Command line, the failing vitest output, Run again, Exit 1 and Copy output">
</picture>

<sub>Screenshot from Goodboy 0.13.1</sub>

### Open in editor

Jump into VS Code, Cursor, Zed, the JetBrains IDEs, Sublime Text, Vim or Neovim, at the worktree or the file. **Open with**, in Settings, General, picks the editor and the browser that links and artifacts open in.

### Explore

Browse the session folder as a file tree, with a preview of the selected file beside it, **Open** and **Copy**. Files that changed against the base branch carry a letter, and **Changed** lists only those. **Ask an agent** on a file row starts an agent on that file.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/keyboard-explore-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/keyboard-explore-light.webp" alt="Explore in Harborline: the session folder as a file tree with the notes and exports folders and brief.md, settlement-batches.csv and drift-summary.xlsx, and the northwind-call.md preview on the right with its path, size, Open outside and Copy">
</picture>

<sub>Screenshot from Goodboy 0.13.1</sub>
