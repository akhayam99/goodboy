# Keyboard and terminal

Drive Goodboy from the keyboard, run a shell in the session's worktree, and open the code in your own editor. Scripts, files and terminals sit next to the session, so you rarely leave the app to check on them.

### Terminal

Open a real login shell in the workspace folder or any linked worktree.

#### Open a terminal

- **Terminal** at the foot of the right rail, **⌃** with the backtick key, or **⌘⌥T** shows or hides the Terminal dock, on any page. In a session it opens on the session's worktree. Anywhere else it opens in the workspace folder.
- The dock stays open as you move between pages. Each session keeps its own terminals running while you are away. The rail button shows how many run.
- The worktree menu and ⌘K **Open <repo · branch> in terminal** open that worktree in the dock.
- **File › New Terminal** and ⌘K **New terminal** add a fresh tab in the dock, on the active worktree or on the workspace folder when the session has no branch.
- **⌘T** adds a tab in place. **⌘N** opens a picker of folders and existing worktrees, one row each with the project and the branch. Type to filter.
- In the dock the header has one scope picker (project, then branch). **+** adds a tab in the current scope.

#### The Terminal page

- **Open full page** in the dock's **⋯** makes the terminal full size, with every terminal of the workspace beside it. **Dock** puts it back on the same tab, and so does Back.
- It says **No terminal yet** until you open one.
- Terminals are grouped by session. One line per worktree shows the project, the branch and a dot while a shell runs a process.
- The line names the command that runs. When it ends, the line says it passed, or that it failed with its exit code.
- Each worktree shows its terminals as tabs with a **+** to add one.
- A session you archive keeps its shells, in an **Archived sessions** group under the live ones. **Close all** asks first.

The exit status comes from a small hook a zsh terminal adds when it starts. Your own shell files and hooks are never changed, and other shells show no status. **Settings › This Mac › Editor, terminal, git › Built-in terminal › Command status** turns the hook off for the terminals you open next.

#### The tab strip

- **Change folder** is disabled while a command runs. It clears what is typed on the prompt, then types `cd`.
- **⋯** holds **Send last output**, **Copy worktree path** and **Open session**. In the dock it also holds **Open full page**. A folder with no session has a quiet **Copy folder path** instead.
- **Send last output** attaches the end of the tab's scrollback to the session's composer. It is sent only when you send.
- Selecting text in a terminal shows **Add to message**, which attaches just the selection the same way.
- A port a terminal listens on shows as a chip at the right edge of the tab strip. A click opens localhost on it in the session's browser, **⌘-click** in your own. Only TCP ports are detected.

#### Close a tab

- Typing `exit` closes the tab. The next New terminal is a new tab with an empty prompt.
- **⌘W** closes one thing per press and never quits Goodboy. It asks first while a command runs.
- In the drawer, **⌘W** does not close the last idle shell. The drawer closes and the shell keeps running with its scrollback.

#### Keys inside a terminal

| Key                 | What it does                                                                 |
| ------------------- | ---------------------------------------------------------------------------- |
| **⌘⇧[** and **⌘⇧]** | Previous and next tab, while a terminal or its tab strip has focus.          |
| **⌃1** to **⌃9**    | Select tab N (**Ctrl+Shift+1** to **9** off macOS). Never sent to the shell. |
| **F2**              | Rename the focused tab.                                                      |
| **⌘F**              | Search the scrollback.                                                       |

#### Reload and restart

- Shells survive a reload. The tabs come back in the same order with the same active tab.
- A restart reopens each tab on its folder with the saved scrollback, up to 256 KiB per tab. It is kept in the app data in files only you can read, with keys and tokens masked, and goes after a week if the tab never comes back.
- The tab shows the line "Session restored. The previous process ended." It says so when the folder is gone.

#### What a tab runs

- A tab whose shell runs a process shows it next to its title, such as `pnpm test` or `vite --port 4310`. The question when you close that tab names the same process.
- When Goodboy quits with a process running in a terminal, the tab comes back with a strip above it, "pnpm dev ended when Goodboy quit". A crash or an update that ends Goodboy does the same.
- **Run it again** on the strip types the command and presses Enter. **Dismiss** closes it. The strip shows on the first launch after the quit only.
- **Restart** on a tab that exited by itself runs the command typed in it again. A tab that failed to open, or whose last command was `exit`, restarts empty.

#### Dot and file paths

When a command that ran for more than ten seconds ends while the terminal dock is closed, **Terminal** on the right rail gets a dot ("pnpm test finished after 42s"). The dot does not say whether the command passed.

A file path in a terminal's output is underlined, with or without a line and column, such as `src/billing/rounding.ts:42:13`.

- **⌘-click** (Ctrl-click off macOS) opens it in your editor at that line. A plain click stays a selection.
- A path that climbs out of the terminal's worktree opens nothing and says so.
- With no editor found, the file opens in Files at that line.

### Keyboard shortcuts, back and forward

Move through Goodboy, change a shortcut and stop an agent without leaving the keyboard. **⌘/** opens the full list.

Keys on this page are the Mac keys. On Linux, ⌘ reads as Ctrl, and a few chords differ: **⌘I** is **Ctrl+Shift+I**, and a **⌘⌥** key is **Ctrl+Shift+Alt** with the same letter or digit.

#### Move around

| Key                | What it does                                                                                                                                    |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **⌘⌥** + a letter  | Opens a view.                                                                                                                                   |
| **⌘⌥C**            | The session's Context tab.                                                                                                                      |
| **⌘⌥F**            | The Changes tab of the session's branch, or the session's file versions when it has no branch. On a pull request page, that page's Changes tab. |
| **⌘⌥X**            | The same Changes tab, on All files.                                                                                                             |
| **⌘⌥A**            | Runs, filtered to what is running. A **Running** chip shows the filter, and **Clear filter** removes it.                                        |
| **⌘⌥W**            | Runs with no filter, and clears one that is set.                                                                                                |
| **⌘1** to **⌘9**   | Switch workspaces.                                                                                                                              |
| **⌘[** and **⌘]**  | Back and Forward through the last 50 places of this window. Overview and Desk are two faces of one place, so they never change a face.          |
| **⌘↑** and **Esc** | Go one crumb up, to the parent of the page. A session tab has no parent, so ⌘↑ goes to the board.                                               |
| **⌥⌘↓**            | The next session that needs you.                                                                                                                |

#### Reload

- **⌘R** reloads the place you are on, never the whole app. In the Browser it reloads the tab. In a session it refreshes its projects, branches and pull requests.
- **⌘⇧R** reloads Goodboy. The window comes back on the same page. In the Browser, when it has the keyboard, it reloads the tab without cache instead.

#### Keys in a list

- **J** and **↓** go to the next row, **K** and **↑** to the one before, **Enter** opens the row in focus. This holds in Tasks, Notifications, Scripts, Chat, Runs, Artifacts, Workflows, Terminal and Monitoring. The Board takes **J** and **K** beside its arrows.
- **/** goes to the search of a list that has one: Tasks, Scripts, Chat, Monitoring and the archived chats.
- The letters type in a field and in a terminal, and wait while a dialog or a panel is open over the list.

#### Keys on a move

- On a session's Overview and on the Desk, **Enter** runs the verb of the move in front, the one with the filled button. Its tooltip shows the key.
- **J** and **K** go from move to move. **Enter** then runs the verb that has the focus.
- **S** puts the move with the focus, or the move in front, out of the way, as Not now does. **⌘Z** brings it back.
- These keys type in a field and in a terminal, and do nothing while a page covers the session.

#### The Desk

The Desk has no key. A tool opened on the Overview, by its key or from the right rail, splits the page into the Desk. **⌃`** opens Terminal. **⌘L** opens Ask beside the page and never splits it.

- **⌘W** on the Desk closes one tool at a time, the focused one first. Closing the last one closes the Desk: the Overview comes back at full width with **Desk closed** and **Reopen**, which brings the tools back as they were.
- One window holds the Desk of a session. In a second window a tool says **Desk open in another window** with **Bring it here**. The window that loses the Desk says **Desk moved to another window** with **Bring the Desk back**.

#### Change a shortcut

1. Open **Settings › This Mac › Keyboard shortcuts**.
2. Press **Change** on a row, then the new keys. **Esc** cancels.
3. **Reset** puts one row back. Recording the default chord does the same.

A line above the list names the shortcut that holds the chord, and refuses three things.

- A chord a shortcut in the same place already holds.
- A system chord (**⌘Q**, **⌘C** and the like).
- A key with no modifier.

The menu bar keys, the message keys, **Esc**, plain list keys and the digit rows stay as they are. Tooltips and field hints follow a change. The Guide text keeps the default until the next launch.

#### Fold a column

- **⌘B** opens and closes Sessions in the top bar.
- **⌥⌘B** folds the column inside the page you are on. The places rail never folds.
- That column is the Session pages column, the Chat and Terminal lists, the Guide chapters, the changelog versions, the Settings scopes or the notification filters.
- Each page remembers it. On a page with no inner column the key does nothing.

#### Undo, Esc and panels

- On the Commits page, **⌘Z** undoes a local commit edit and **⌘⇧Z** redoes it. Text fields keep their own undo.
- Tooltips, the Guide, field hints and the key caps under a composer all read their keys from one list, so a key is spelled once. The key caps show while the box is empty and has the focus, and go at the first letter.
- **Esc** closes the dialog or preview in front.
- While an agent runs and nothing else is open, **Esc** twice stops it. The first press says "Esc again to stop" beside the Stop button for three seconds. In Chat and Ask, **Esc** twice in the box stops the reply the same way, and **Send** is back. A changed stop key works there too.
- In a session, **Esc** in a box with text leaves the box and keeps your text. A further **Esc** closes the panel on the right, then does what the back row above the page does. On the Overview it does nothing.
- **⌘⇧W** closes the panel that has the focus, even with the keyboard in a terminal. With the page focused it closes the panel on the right. Off macOS it is **Ctrl+F4**.
- **Tab** reaches the head of a panel. **Enter** or **Space** lifts it, the arrow keys walk the places in screen order and read each one aloud, **Enter** drops it there and **Esc** cancels. **⇧Enter** on a tab of a cell lifts that tool alone.
- **F6** moves the focus to the next panel: the page, the detail, then each open tool. **⇧F6** goes back.
- With two tools open, **⌘K** has **Move Terminal panel…** for each one. It lists only the places that keep the page its room. **Reset panel layout** puts every panel back where it opens, with **Undo** in the toast.

#### The Mac menu bar

On a Mac the menu bar carries the same keys.

- File: New Session, New Chat, New Terminal, New Workspace, Close (**⌘W**) and Close the panel (**⌘⇧W**).
- Edit: Search.
- View: Show or Hide Sessions (**⌘B**), Search or Run, Reset Panel Layout, zoom, Reload (**⌘R**) and Reload Goodboy (**⌘⇧R**).
- Go: Back and Forward, then Board, Tasks, Workflows, Chat, Connections, Impact, Monitoring and Notifications. After a separator, Show or Hide Terminal and Show or Hide Browser.
- Help: Guide, What's New, Keyboard Shortcuts and Report a Bug.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/keyboard-shortcuts-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/keyboard-shortcuts-light.webp" alt="The Keyboard shortcuts page in Settings, every shortcut in the groups General, Workspaces, Views and Lists, with Search or run on ⌘K, Search on ⌘F, Report a bug on ⌘I and a ⌘⌥ key for each view from Overview to Slack threads">
</picture>

<sub>Screenshot from Goodboy 0.40.1</sub>

### Script drawer

Pin the scripts you use and run them from the session.

#### Find and run a script

- Open the Scripts pane from **Scripts** on the right rail, or with ⌘⌥S.
- Scripts are listed per branch, headed by the project and the branch they run on. Services (dev servers and watchers) come first, then the scripts that run and end.
- Each row shows the script's name and its command. A click on a row opens its output.
- The row's one control is **Run** or **Stop**. **Pin**, **Restart**, **Open in Terminal** and the rest live in the right click menu.
- A script runs on the branch you are on: the branch page, or the agent or run you opened. **Open in Terminal** opens a terminal in that branch's worktree with the command typed in, not run.
- From ⌘K, a script runs at once when its project has one branch in the session. With more than one and no branch on screen, a second step asks **Run Replay settlement batch on which branch?**.

#### Services

- A running service shows its dot and uptime. Its port opens beside the session on a click, and in your own browser on **⌘-click**.
- **Run** on a Service starts it in place and leaves the list as it is.
- A project with more than one Service has **Start all services** on its header. It starts the ones that are not running.
- When Goodboy quits with services running, the first Scripts view after the next launch has one row, **Start the 2 services that were running**, with **Start** and **Dismiss**.

#### Commands

- **Run** on a Command shows its live output in place of the list, with **Run again**, **Copy output**, **Add to message** and **Back to scripts**.
- **Add to message** attaches the log to the session's composer without sending it. The log is titled with the script, the exit code and the worktree.
- A running script takes no input. Its pane says **Output only. Stop ends it.**
- A running script puts a dot on **Scripts**. A run that failed puts a red one there until you open its output.
- A script that ends while you are in another session raises a toast, "Check posting drift failed in ledger-core", with **Open output**.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/keyboard-script-drawer-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/keyboard-script-drawer-light.webp" alt="The Scripts pane grouped by project, and the Check posting drift output open on the right: Failed after 12s in ledger-core on nw/fix-settlement-replay, the failing vitest output, Run again, Exit 1 and Copy output">
</picture>

<sub>Screenshot from Goodboy 0.40.1</sub>

### Open in editor

Jump into VS Code, Cursor, Zed, the JetBrains IDEs, Sublime Text, Vim or Neovim, at the worktree or the file.

- **Open with**, in **Settings › This Mac › Editor, terminal, git**, picks the editor, the terminal app and the browser that links and artifacts open in.
- **Open in external terminal** sits in the menus of a session, a branch folder, a worktree and a folder in Files. It opens the folder in Terminal.app, iTerm, Warp or Ghostty, whichever are installed. Linux uses the system terminal.
- A file path with a line number in a terminal opens at that line in your editor. `code -g`, `zed` and `subl` take `file:line:col`. The JetBrains IDEs take `--line` and `--column`.

### Explore

Browse the session folder as a file tree on the **Changes** page of a branch. **All files** beside **Changed** swaps the list of changed files for the whole folder, and **⌘⌥X** opens it there.

- A changed file carries a letter and its line counts. An unchanged file is muted.
- A click on a changed file scrolls to its diff. A click on an unchanged file reads it in place, with its line count, **Open in editor** and **Back to the changes**.
- The filter field searches the loaded and changed files. **Hide files** folds the list, and **F** or **/** bring it back.
- A branch with no change says **No changes against main** and offers **All files**.

### Browser

Open your dev server, a port or a link beside the session or on a page of its own, without leaving Goodboy.

#### Open the browser

- **Browser** at the foot of the right rail, or Go › **Show or Hide Browser**, shows or hides the browser beside the work, on any page. Its tooltip counts the open tabs.
- In a narrow window the right rail keeps its icons only, with the names in the tooltips. The Browser then lies over the page, behind a veil. A click on the veil or **⌘⇧W** closes it.
- **Open full page** makes it full size on the Browser page. Its row holds the pins of each project, then every session's tabs behind the session's name. Click a name to fold its tabs; the name keeps their count. **Dock**, last in the row, puts it back. The page never reloads, so a half-typed form stays.
- Pick a tab on the Browser page to show it there. The trail at the top goes back to its session.

#### The address bar

- The tabs sit in one row with Back, Forward and Reload, and the page sits right under it, edge to edge.
- Pins come first as square icons. The other tabs show their icon and title, narrow down to the icon when the row fills, then the row scrolls.
- The shown tab is the address bar. It shows the page, not its address: the icon, the title and the host. Click it, or press **⌘L**, to see the full address selected and type a new one. **Esc** puts the title back.
- In a pane under 560 pixels wide, Pin and Open full page move into **More**.
- Type an address and press **Enter** to open it beside the session, or **⌘Enter** to open it in your browser. A localhost address opens your dev server.
- Type a word to find a tab of any session, a project pin or a page this session visited. Words are never searched on the web.
- Type the path of a local page, image or PDF, like `~/harborline/plan.html`, to open it in a tab. Reload reads the file again. The page reads only the files in its folder and the folders under it. A missing file, a folder or another kind of file says why under the address. A link or a page never opens a local file.
- While a page loads, Reload becomes **Stop**. A page that never finishes says so after 30 seconds. **Back** and **Forward** turn off when there is nothing behind or ahead.
- **More** holds **Add to message**, Open in your browser, **Open full page**, This tab, **Clear site data** and Develop. This tab holds Copy address, Duplicate and Close tab. Develop holds **Reload without cache**, the widths and, on macOS, **Inspect in Safari**.

#### Clear the cache or a site

- **⇧-click** Reload, or **Reload without cache** under Develop, loads the page again and skips the cache.
- **Clear site data** asks first, then removes the cookies, storage, cache and service workers of the site of the shown tab, and it signs you out of that site. When the tab went through a sign-in on another site, a login popup included, the confirm lists that site too and clears it with the page's own. Other sites keep theirs. The page reloads, and a line under the address names every cleared site and says other tabs on them keep their page until you reload them. If it fails, the page stays and the line says why.
- Off macOS the row says **Clear browser data** and clears every site in the browser of this workspace.
- **Settings › Workspace › Projects › Danger zone › Clear browser data** clears every site of the workspace. Open tabs reload.

#### Links

- A port chip, a running Service's port, a link in a conversation, a decision or an artifact and a web address in a terminal open beside the session. The tab already on that page is shown when there is one. Sign-in and connect links keep opening your own browser.
- **⌘-click** opens your own browser instead.
- **Settings › This Mac › Editor, terminal, git › Open with › Links in a session** picks where a plain click goes: **In Goodboy** or **In your browser**.
- A terminal with no session sends its links to your own browser.

#### Send a page to the agent

- **Add to message** puts the text you see on the page on the message box as a chip with the title, the site and the word count. It also sits in the right-click menu of a tab, and **⌘⇧S** does the same for the shown tab.
- The page is read when you press it, never before. Nothing goes to the agent until you send the message, and the × on the chip takes it away.
- A page over 60,000 characters is cut, and the text says so at the end. A key or a token in the text is hidden.
- A failure says why under the address row, with **Retry**.

#### Point at part of a page

- **Select an element**, the button before Console, or **⌘⇧C** turns the pointer into a crosshair, and the page says "Select an element".
- The part under the pointer gets an outline with its name and size. On your dev server the name is the component.
- Click it and a note opens under the address row: "What should change?". **⇧-click** adds more parts to the same note, up to four.
- **Enter** puts a chip and a picture for each part on the message box, and your note in the text. **Esc** leaves. Nothing goes until you send.
- The agent gets the address, the part's text, its HTML up to 4,000 characters, a few styles and its picture. On a dev server this session runs, it also gets the file and line. A key or a token is hidden.
- The note names the agent it adds to. With more than one agent in the session, it is a menu.

#### Browser keys

While the browser is on screen, its keys are the ones every browser uses.

| Key                 | What it does                                                                              |
| ------------------- | ----------------------------------------------------------------------------------------- |
| **⌘L**              | Go to the address.                                                                        |
| **⌘T**              | Open a new tab.                                                                           |
| **⌘W**              | Close the shown tab. With no tab left it closes the browser. A pin is never closed by it. |
| **⌘⇧T**             | Reopen the last tab you closed, up to five.                                               |
| **⌘⇧[** and **⌘⇧]** | Step through the tabs.                                                                    |
| **⌘D**              | Pin or unpin the shown tab.                                                               |
| **⌘⇧S**             | Send the page to the agent.                                                               |
| **⌘F**              | Find text in the page.                                                                    |
| **⌘⇧J**             | Open the console.                                                                         |
| **⌘⇧C**             | Select an element on the page.                                                            |

Elsewhere these keep their other meaning, so ⌘L stays Ask and ⌘F stays Search. Click into the page and the page keeps the keys. Click the address row or a tab to give them back.

The find bar sits under the address row. It says **Found** or **Not found**. **Enter** goes to the next match and **⇧Enter** to the previous one. **Esc** or **Done** closes the bar.

#### Console

**Console**, the button after More, or **⌘⇧J**, opens the console in a dock beside the page: below it in the Browser pane, right of it on the Browser page. The icon in the dock's head moves it to the other side, and its edge drags to resize it. Each place keeps its own side and size.

**Console** lists what the page logged, with its errors, and **Network** the requests. It starts over at every load. **Clear** empties the list you see, and **Send to** the agent puts the log and the failed requests on the message box as one file you can remove.

#### Network

**Network** is a table of the requests of the load: method, path, status, type, size, time and a waterfall bar. The type list above it keeps one kind (Fetch, Doc, JS, CSS, Img, WebSocket and event streams). **Failed only** keeps the requests that failed, and the search field matches path, method and status. The line under the table counts the requests you see, their size and how long the page took to load.

Click a request to open it: its **Response**, its **Payload**, its **Headers** and its **Timing**, with the time spent waiting and downloading when the page reports it. Below the page the request opens beside the table; right of the page it takes the table's place. **Esc** or the back arrow returns to the table where you left it, and **↑** and **↓** step through the requests the filters keep. **Send request** puts the request on the message of the agent the button names, as a file you can remove. Authorization and cookie headers are never read, so they never reach an agent. Nothing goes until you send.

The page's own address has no status: the browser does not report it.

#### Errors

When the page fails, a red count shows in the address row: thrown errors, promises without a catch, errors the page logs and failed requests. Warnings never count. With no error there is no count at all. Click it to open the dock on **Errors**, a tab that exists only while there are errors.

Each error shows once, with how many times it happened, when first and when last. Click it to see its stack. Lines from files in the session's worktree, served by a dev server on one of its ports, show their path in color. **Send** puts one error on the message of the agent the button names, **Send all to** puts them all, as a file you can remove. Nothing goes until you send.

#### Tabs and sites

- Tabs belong to the session. Pin a tab to keep it in every session of the project. Tabs close when the session is archived.
- **⌘K** lists the tabs of every session in the workspace and the pins. Pick one to show it.
- Each workspace keeps its own cookies and site data, so a sign-in never shows in another workspace. Switching workspace closes the other one's tabs, and they reopen at their address when you show them.
- A tab hidden for 10 minutes closes its page and keeps its address and title in the list. A window keeps four live tabs, and a fifth closes the one hidden longest. A tab you are looking at never closes.

## Under the hood

This part is for contributors and agents who change the feature.

- Terminal dock: ``⌃` `` (`terminal.studio`) and ⌘⌥T (`session.terminal`) both run `toggleTerminalDock`. ``⌃` `` passes `shouldFocusFirst`: an open Terminal without the focus gets it, a focused one closes. Off a session page it opens `openWorkspaceTerminal`, a drawer with `sessionId: null`. `openTerminalOnPage` and `dockTerminalPage` move between dock and page, `dockEmptyTerminalPage` docks a terminal from the empty page, and [terminal.md](../navigation/terminal.md) owns the Terminal page.
- The Desk: `useDeskFollowsTools` opens the Desk when a tool opens on the Overview. `landingOf` (`store/slices/navigation/`) is the one entry rule and `deskLandingOf` feeds it the session. `useDeskLanding` opens the tools after the saved grid is read and closes the Desk when its last tool goes (`closeDesk`). No shortcut id switches the face: `session.desk` is gone from the registry and the menu, and a saved override for it is dropped (`overrides.test.ts`). `closeCurrentLevel` (⌘W) closes a Desk tool through `deskToolToClose`. `useDeskOwner` holds the Desk through `desk_hold` in `window_heartbeat.rs`. `landingOf.test.ts`, `useDeskLanding/index.test.tsx`, `useDeskOwner/index.test.tsx` and `desk-nav.rows.tsx` cover each case.
- Moving a panel: `DockPanelHead` is focusable (`Move {title}`) and lifts through `DockDragSource.onLift`. `useDockDrag.lift` starts the drag, `useDockDragKeys` walks and drops, `dockZoneStepOf` orders the cards, and `DockGrid` keeps the `data-dock-note` live region. `moveShellPanel` focuses the moved head with `focusPanelHead`. `useDockDragKeys.test.ts`, `DockGridKeys.test.tsx` and `shellFocus.test.ts` cover each key.
- Archived sessions group: `terminalGroups` and `CloseGroupButton` build the group and its **Close all**.
- Process on a tab: `terminal_list_live` returns `foregroundCommand`, shaped by `foregroundLabelOf`. `terminalCommandOf` is the fallback.
- Terminal size: one tab has one PTY size, so a tab never shows in two panes. `createTerminalDriver` sends sizes through `createResizeQueue`, one `terminal_resize` at a time. It skips a size the PTY already has. It drops a measure that a newer one replaced while a call ran.
- Exit status: `terminal_shell_hook.rs` writes zsh startup files under the app data `shell-integration/zsh` and points `ZDOTDIR` there. They source the user's own files. The hook runs under `emulate -L zsh`, appends to `precmd_functions` and `preexec_functions` and survives `setopt nounset`. Preexec keeps the command line, precmd prints `ESC ] 633;D;<code>;<command> BEL`. `terminal_exit_mark.rs` reads the mark, `terminal_list_live` returns `lastExitCode` and `lastExitCommand`, `terminalActivityOf` words the row from them and never from typed keys. The setting is `terminal.exitStatus`, read by Rust when a terminal opens; only `false` turns it off.
- Linux chords: a registry test fails any ⌘⌥ entry without its Ctrl+Shift+Alt chord.
- Changed shortcuts: the local setting `shortcuts.overrides`, by registry id.
- One spelling per key: hints read the shortcut registry through the `shortcut` prop or `shortcutGlyphs`.
- Stop the running agent: the registry id is `agent.stop`. The session composer registers it (`useEscapeStop`); `MessageComposer` (Chat and Ask) reads it in its own field. Both arm through `useEscapeArm`. The field yields to a menu, a popover or a hover surface (`isEscapeTakenAbove`); `keys.rows.tsx` walks the order in Ask.
- Runs › Running: ⌘⌥A writes `runs.filter` (`openToolPane`), `useRunsFilter` reads it on the Runs page, and ⌘⌥W and Clear filter drop it (`clearRunsFilter`).
- Reload where you are: `view.reload` runs `reloadWhereYouAre`, which picks one surface registered with `useReloadSurface` (`pickReloadSurface`). `app.reload` reloads the window. `scopedReload.test.tsx` pins both.
- Service usage: `serviceUsageCardOf` builds the card with CPU and memory.
- Browser: the pane is the `browser` drawer kind in `features/browser/`, and [browser.md](../browser.md#the-pane) owns the address rule, the live tabs and the overlay rule. The page is the `browser` studio kind (`BrowserStudio`), and [browser.md](../browser.md#the-page) owns its groups, its route and the view owner rule. `promoteBrowserTab` and `demoteBrowserTab` move a tab between them ([browser.md](../browser.md#moves)).
- Browser doors: [browser.md](../browser.md#doors) owns `openInBrowser`, the click rule, the peek and the `browser.address` scope beside `ask.open`.
- Add to message: `sendPageToAgent` reads through `browser_page_text` and queues the file for the agent `useHandOutputToAgent` names; [browser.md](../browser.md#doors) owns the rule and `browser.sendToAgent` is the key.
- Browser console: `useConsoleEntries` pulls `browser_console_read`, and `applyConsoleRead` keeps the latest cursor. `BrowserToolsDock` places the dock, and `browserToolsDockPref` keeps its side and size per surface. `BrowserConsole` draws the console list, and `consoleAttachmentOf` the file. `NetworkTab` draws the request table (`networkRowsOf` filters it, `networkSummaryOf` writes the line under it) and `NetworkDetail` one request; `requestAttachmentOf` writes its file and `isHiddenHeader` keeps sensitive headers out of both. `consoleCounts` owns every count, the red one in the row (`BrowserErrorCount`) included. `errorGroupsOf` groups the errors, `sourceFileOf` maps a frame to a worktree file, `ErrorsTab` draws them and `errorsAttachmentOf` writes the file. [browser.md](../browser.md#console) owns the hook, the read and the caps. `browser.console` is the key.
- Pick an element: `useElementPick` drives `browser_pick` (`page_runtime/pick.js`), `BrowserPickNote` draws the note and `addPickedElements` queues `elementAttachmentOf` files with the `browser_element_snapshot` picture. [browser.md](../browser.md#pick-an-element) owns the runtime, the read and the caps. `browser.pick` is the key; `pick.test.tsx` covers the flow.
- Files: the Changes page switches between **Changed** and **All files** (`useChangesMode`); the file chord opens it on All files.

- Context entry: `togglePane` and `openContextDrawer` default to Goal; `withoutRemovedPages` restores former Context addresses beside Overview.

- Places rail: `apps/desktop/src/App.tsx` supplies `AppShell.leftRail` without a fold control; `apps/desktop/src/app/components/ShellLeft/index.tsx` keeps it visible beside the page.
- Move keys: `useMoveKeys` runs on the Overview column and the Desk column. Enter is `list.open` and clicks the `data-move-verb` button of `data-move-primary`, and declines when it is disabled. S is `move.notNow` and calls the `onNotNow` of the card's menu target, with its Undo. J and K reuse `useRowFocusKeys` on `data-move-verb`. Both keys wait unless `isFaceShown`. The `list` scope entries live in `listShortcuts.ts`.
- List keys: `useListKeys` follows a selected row (Tasks, Notifications, Scripts). `useRowFocusKeys` moves the focus between the rows of a list with no selected row (Chat, Runs, Artifacts, Workflows, Terminal, Monitoring). `useSearchKey` takes **/** alone for a field. The Board reads the same registry entries inside `useBoardArrowKeys`.
