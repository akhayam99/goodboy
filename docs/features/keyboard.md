# Keyboard and terminal

Drive Goodboy from the keyboard, run a shell in the session's worktree, and open the code in your own editor.

### Terminal

Open a real login shell in the session's worktree. **⌃`** opens the Terminal studio, with every terminal of the workspace and its sessions in one list; **⌘⌥T** opens the Terminal view of the session, **⌘T** adds a terminal while the terminal has the focus, and the shells are still there after a reload. **⌘F** finds in its scrollback.

### Keyboard shortcuts, back and forward

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/keyboard-shortcuts-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/keyboard-shortcuts-light.webp" alt="The Shortcuts page in the groups General, Workspaces, Navigate and Views, with Command palette on ⌘K, Report a bug on ⌘I, Back on ⌘[ and Forward on ⌘], and a ⌘⌥ key for each view from Overview to Slack threads">
</picture>

<sub>Screenshot from Goodboy 0.13.1</sub>

Drive Goodboy from the keyboard: a **⌘⌥** key for each view (**⌘⌥R** opens the Branch page on Comments, **⌘⌥F** on Files and **⌘⌥1** on the pull request, where **E** edits its title), **⌘1** to **⌘9** for your other workspaces in the order the switcher numbers them, and **⌘[** and **⌘]** through history. **⌘N** starts a new session and **⌘⇧N** a new chat. **⌘/** opens the list, and a key that only works in one place says where. In the Files tree the arrows walk the rows, **Home** and **End** jump, **→** and **←** open, close and climb a folder, **Enter** jumps the diff to the file and keeps the focus in the tree, **Space** marks the file viewed and **Esc** returns to the diff. Tasks opens with a quiet cursor on its first row and no drawer, so **J** and **K** move it, **↵** opens the row and launches, **O** opens the tool, **R** opens it and replies, **S** stars and **/** searches at once. **Esc** closes the drawer first and a second **Esc** closes Tasks. **How Goodboy listens**, in the Guide, puts the prefixes, the list keys and the two kinds of field on one page. One registry drives the keys, that page, the Shortcuts list and the tooltips, and a tooltip always draws its keys the same way: the name, then the keys in faint text, as in `Ask an agent  ⌘L`. **Esc** closes what is open inside the app and never takes the window out of macOS full screen. **⌃Tab** flips between your recent sessions: hold **⌃** to see the list, and its foot names two gestures, `⌃Tab next` and `Release to open`. **⇧⌃Tab** goes back and **Esc** cancels; both stay in the Shortcuts list. **⌘⇧]** and **⌘⇧[** step through the sessions in the order the list shows them, so four presses visit four different sessions.

**Double click** a name in a diff line, or **Alt click** it, to see where it is defined and used. The popover lists both groups: **↑** and **↓** move, **↵** opens the result and **Esc** closes it and returns to the diff. A result in this change scrolls the diff to its line; any other opens the Explore file drawer on that line.

### Script drawer

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/keyboard-script-drawer-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/keyboard-script-drawer-light.webp" alt="The Scripts page with the Check posting drift drawer open on the right: Failed after 12s in ledger-core on nw/fix-settlement-replay, a Command line, the failing vitest output, Run again, Exit 1 and Copy output">
</picture>

<sub>Screenshot from Goodboy 0.13.1</sub>

Pin the scripts you use from the project row on the workspace Projects page in Settings, or right in the Scripts lens. A session's Scripts lens lists only the scripts you pinned and the ones you saved, grouped by project into **Services** (dev servers and watchers) and **Tasks**, and a project with nothing pinned shows a dimmed **Suggested** band (its dev, build, test, lint and typecheck) with a **Pin** on each row; **Pin a script** lists the rest inline. A service row shows its port, uptime, CPU, memory and last output line while it runs, with **Stop** and **Restart** always visible, and `:5005 in use` when another worktree holds its port. A task row shows its result, duration and age. **Pin** and **…** show when you point at a row, **Run** and **Stop** always. A pinned script shows once, in its band; there is no separate Pinned strip. On the Scripts page `J` and `K` move between rows, `Enter` opens the output, `R` runs or restarts the selected script and `X` stops it. Pinned scripts are also in the palette under `$` with their project. Watch a script's live output in a drawer beside the list. **Stop** ends a running script, **Run again** starts it over, the footer shows the exit code and the time (**Exit 1 · 12s**) with **Copy output**, and the drawer comes back after a reload.

### Open in editor

Jump into VS Code, Cursor, Zed, the JetBrains IDEs, Sublime Text, Vim or Neovim, at the worktree or the file. VS Code and Cursor open it in the window you already have. **Open with**, in Settings, General, picks the editor, and the browser that links and artifacts open in: **System default** at first, with a note when the one you chose is no longer installed.

### Explore

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/keyboard-explore-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/keyboard-explore-light.webp" alt="Explore in Harborline: the session folder as a file tree with the notes and exports folders and brief.md, settlement-batches.csv and drift-summary.xlsx, and the northwind-call.md preview on the right with its path, size, Open outside and Copy">
</picture>

<sub>Screenshot from Goodboy 0.13.1</sub>

Browse the session folder as a file tree, with a preview of the selected file beside it, **Open** and **Copy**. A chip under the title says which project you are looking at, `ledger-core · hl/ledger-rounding`. When a session has more than one project the chip opens a list of them: picking one changes what you browse and nothing else, so agents keep writing where they were, and each project keeps its own open folders. **Browse files**, on a project in the session overview, opens Explore on that project. Each row is 40px high and shows a type icon, the name, the size and how long ago it changed; the size and the age drop away as the column narrows. The folders you opened stay open when you come back, and a folder that holds a link to another folder lists it as a folder. The arrow keys walk the tree: Right opens a folder, Left closes it or goes to its parent, Home and End jump, and Enter or Space opens the preview of a file. A folder with thousands of entries stays smooth. Each file row shows three icons on hover or focus, each with a tooltip: **Ask an agent** starts an agent on that file, **Open** opens it, and **Show in Finder** reveals it; right click or the menu key adds **Copy path**. A folder row has no **Ask an agent**, and reads **Open in editor** only when an editor can open it. In a repository, a text or code file reads **Open in editor** and opens in the editor you chose in Settings, General, Open with (VS Code and Cursor reuse the window you already have). Images, PDFs and other binary files, files of a folder project, and any file when no editor is installed read **Open** and use the default app. If the editor is gone, the error says so and offers **Choose editor**.

The Terminal studio offers New terminal when no shell has been opened yet.
