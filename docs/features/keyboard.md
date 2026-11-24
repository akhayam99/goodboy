# Keyboard and terminal

Drive Goodboy from the keyboard, run a shell in the session's worktree, and open the code in your own editor. Scripts, files and terminals sit next to the session, so you rarely leave the app to check on them.

### Terminal

Open a real login shell in the workspace folder or any linked worktree.

**Open a terminal**

- **Terminal** at the foot of the right rail, **⌃** with the backtick key, or **⌘⌥T** shows or hides the Terminal dock, on any page. In a session it opens on the session's worktree. Anywhere else it opens in the workspace folder.
- The dock stays open as you move between pages. Each session keeps its own: leave it and its terminals keep running, come back and they are where you left them. The rail button shows how many terminals run.
- The worktree menu and ⌘K **Open <repo · branch> in terminal** open that worktree in the dock.
- **File › New Terminal** and ⌘K **New terminal** add a fresh tab in the dock. In a session it uses the active worktree, or the workspace folder when the session has no branch. On the Terminal page the new tab opens on the page.
- **⌘T** adds a tab in place. **⌘N** opens a picker on the page and in the drawer. Type to filter, use the arrows and Enter.
- The picker offers folders and existing worktrees, one row each with the project and the branch. The path is in the tooltip.
- In the dock the header reads **Terminal** and one scope picker (project, then branch). ⌘N opens it. **+** adds a tab in the current scope.

**The Terminal page**

- **Open full page** in the dock's **⋯** makes the terminal full size, with every terminal of the workspace beside it. **Dock** puts it back on the same tab, and so does Back.
- It says **No terminal yet** until you open one. **Dock** stays there too, and opens a terminal in the dock.
- It groups terminals by session. Each group shows its row count from two.
- One line per worktree shows the project, the branch and a dot while a shell runs a process.
- The line names the command that runs. When it ends, the line says it passed, or that it failed with its exit code.
- The exit status and the command it belongs to come from a small hook a zsh terminal adds when it starts. Your own shell files and hooks are never changed. Other shells show no status.
- **Settings › Advanced › Built-in terminal › Command status** turns the hook off for the terminals you open next.
- Each worktree shows its terminals as tabs with a **+** to add one. A tab selects on a click anywhere on its body.
- Issue chips and the diff stay on the session, not here.
- The folder path line shows only for a plain folder, never for a worktree.
- A session you archive keeps its shells. An **Archived sessions** group sits under the live ones, folded with its count. **Close all** asks first.

**The tab strip**

The strip ends with the same controls on every scope.

- **Change folder** is disabled while a command runs. It clears what is typed on the prompt, then types `cd`. The tab stays under the folder it started in.
- The ports sit next to it.
- **⋯** holds **Send last output**, **Copy worktree path** and **Open session**. In the dock it sits in the header and also holds **Open full page**, as in the Browser; on the page it comes before **Dock**. A folder with no session has a quiet **Copy folder path** instead.
- **Send last output** attaches the end of the tab's scrollback to the session's composer. It is sent only when you send.
- Selecting text in a terminal shows **Add to message**. It attaches just the selection the same way.
- A port a terminal listens on shows as quiet text on a worktree row that is not selected. For the selected worktree it shows as a chip at the right edge of the tab strip, never on a tab. A click opens localhost on it in the session's browser, **⌘-click** in your own. A folder with no session opens your browser.
- Port detection runs every 5 seconds and sees TCP only.

**Close a tab**

- Typing `exit` closes the tab. The next New terminal is a new tab with a new id and an empty prompt.
- **⌘W** closes one thing per press and never quits Goodboy. The order is a popover, the selected terminal tab, the drawer, a page such as Tasks, then the session view. It only closes what you can see: a session's drawer waits out of sight while a page is open, and comes back when you leave the page.
- **⌘W** asks first while a command runs. The question names the tab and sits under its close button.
- In the drawer, **⌘W** does not close the last idle shell. The drawer closes and the shell keeps running with its scrollback.

**Keys inside a terminal**

- **⌘⇧[** and **⌘⇧]** move to the previous and next tab. They are the session keys, only while a terminal or its tab strip has focus.
- **⌃1** to **⌃9** select tab N (**Ctrl+Shift+1** to **9** off macOS). They are never sent to the shell.
- **F2** on a focused tab renames it.
- **⌘F** searches the scrollback.

**Reload and restart**

- Shells survive a reload. The tabs come back in the same order with the same active tab.
- A restart reopens each tab on its folder with the saved scrollback. That is up to 256 KiB per tab, kept in the app data in files only you can read, with keys and tokens masked. They go with the tab, or after a week if it never comes back.
- The tab shows the line "Session restored. The previous process ended." It says so when the folder is gone.

**Dot on Terminal**

When a command that ran for more than ten seconds ends while the terminal dock is closed, **Terminal** on the right rail gets a dot ("pnpm test finished after 42s"). The dot does not say whether the command passed; the Terminal page line does.

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
- **⌘⌥C** opens the session's Context tab. The former Goal, Decisions and Summary chords are retired; section links still reach their card. On a page such as Tasks, a session key leaves the page first.
- **⌘⌥F** opens the Changes tab of the session's branch on its Branch page, or the session's file versions when it has no branch. On a pull request page it picks that page's Changes tab.
- **⌘⌥X** opens that Changes tab on All files.
- **⌘⌥A**, listed as Runs › Running, opens Runs on what is running. A **Running** chip above the list shows the filter, and **Clear filter** removes it. With nothing running the page says **Nothing is running**.
- **⌘⌥W** opens Runs with no filter, and clears one that is set.
- **⌘1** to **⌘9** switch workspaces.
- **⌘[** and **⌘]** walk your history: the last 50 places of this window, empty after a reload. Overview and Desk are two faces of one place, so Back and Forward never change a face and never open a tool by themselves.
- **⌘↑** and **Esc** go one crumb up: to the parent of the page, and the same after a reload. The page of a top agent goes back to its session's Overview, or to the Runs tab of the pull request you opened it from. A session tab has no parent, so ⌘↑ goes to the board.
- **⌥⌘↓** goes to the next session that needs you.
- **⌘/** opens the full list.

**Reload where you are**

- **⌘R** reloads the place you are on, never the whole app.
- With the keyboard in the Browser, its address, its tabs or the page itself, ⌘R reloads that tab.
- In a session, ⌘R refreshes the session: its projects, branches and pull requests.
- On a page with nothing to reload, ⌘R does nothing.
- **⌘⇧R** reloads Goodboy. The window comes back on the same page.
- The header of that page says that a right click or **⇧F10** on a list row opens its actions. These are the same words as the tooltip of a row's **⋯**.
- The first time the pointer enters a list, every row shows its **⋯** until the pointer leaves, once.

**Keys in a list**

- **J** and **↓** go to the next row, **K** and **↑** to the one before, **Enter** opens the row in focus. This holds in Tasks, Notifications, Scripts, Chat, Runs, Artifacts, Workflows, Terminal and Monitoring. The Board takes **J** and **K** beside its arrows.
- **/** goes to the search of a list that has one: Tasks, Scripts, Chat, Monitoring and the archived chats.
- The key is read as a character, so **Shift+7** does it on an Italian or German keyboard.
- In Chat, Runs, Artifacts, Workflows, Terminal and Monitoring, **J** starts on the first row when nothing has the focus.
- In those lists the keys leave the page alone when the focus is on another part of it.
- The letters type in a field and in a terminal, and wait while a dialog or a panel is open over the list. With two lists on screen, the first one takes the key.

**Keys on a move**

- On a session's Overview and on the Desk, **Enter** runs the verb of the move in front, the one with the filled button. Its tooltip shows the key.
- **J** and **K** go from move to move. **Enter** then runs the verb that has the focus.
- **S** puts the move with the focus, or the move in front, out of the way, as Not now does. **⌘Z** brings it back.
- These keys type in a field and in a terminal, and do nothing while a page covers the session.
- On the Desk, **⌘↑** goes to the board, as on the Overview.

**The Desk**

- The Desk has no key. A tool opened on the Overview, by its key or from the right rail, splits the page into the Desk: **⌃`** for Terminal, **⌘L** for Ask.
- **⌘W** on the Desk closes one tool at a time, the focused one first. Closing the last one closes the Desk: the Overview comes back at full width with **Desk closed** and **Reopen**, and the focus goes to Reopen. **Reopen** brings the tools back as they were.
- One window holds the Desk of a session. In a second window a tool says **Desk open in another window** with **Bring it here**. The window that loses the Desk says **Desk moved to another window** with **Bring the Desk back**. When the window cannot check who holds it, the Overview stays with the error and **Retry**.

**Change a shortcut**

- In **Settings › Keyboard shortcuts**, each row with a **Change** button can take another chord. Press **Change**, then the new keys. **Esc** cancels.
- A line above the list refuses three things and names the shortcut that holds the chord.
- Refused: a chord a shortcut in the same place already holds, a system chord (**⌘Q**, **⌘C** and the like), and a key with no modifier.
- **Reset** puts one row back. Recording the default chord does the same. The choices are kept in a local setting, by registry id.
- The menu bar keys, the message keys, **Esc**, plain list keys and the digit rows stay as they are.
- Tooltips and field hints follow a change as they redraw. The Guide text keeps the default until the next launch.

**Fold a column**

- **⌘B** opens and closes Sessions in the top bar.
- **⌥⌘B** folds the column inside the page you are on. The places rail never folds.
- That column is the Session pages column, the Chat and Terminal lists, the Guide chapters, the changelog versions, the Settings scopes or the notification filters.
- Each remembers it per page. On a page with no inner column the key does nothing and Search or run leaves the entry out.

**Undo and Esc**

- On the Commits page, **⌘Z** undoes a local commit edit and **⌘⇧Z** redoes it. Text fields keep their own undo.
- Tooltips show keys beside their controls. Every hint in the app reads its keys from the shortcut registry, so a key is spelled once. That covers tooltips, the Guide, field hints and the key caps under a composer.
- The key caps under a composer show while the box is empty and has the focus, and go at the first letter. They stay in a document, where Enter adds a line. A screen reader reads each key by name with what it does, with the box every time.
- **Esc** closes the dialog or preview in front, listed as Close the dialog or preview.
- While an agent runs and nothing else is open, **Esc** twice stops it. The first press says "Esc again to stop" beside the Stop button for three seconds. The second stops the agent, listed as Stop the running agent, press twice.
- In Chat and Ask, **Esc** twice in the box stops the reply the same way. Then **Send** is back.
- The session and Chat differ on purpose. In a session a message you send while the agent works waits for the reply. In Chat and Ask, **Send** turns into **Stop** while the reply comes.
- With the keyboard in a box, **Esc** walks one order. First an open menu or popover, then a card shown on rest. Then the armed stop while a reply comes, then the panel that floats over the page. So in Ask the first **Esc** arms the stop while a reply comes, and closes the panel when none does.
- A changed stop key works in Chat and Ask too.
- A menu, a drawer or a dialog that is open always takes the key first. The key leaves the page only when no turn runs.
- In a session, **Esc** walks one ladder. In a box with text it leaves the box and keeps your text. Then it closes the panel on the right, and the panel it had replaced comes back. Then it closes that one. Then it does what the back row above the page does, so a step goes to its run and a list goes to the Overview. On the Overview it does nothing.
- **⌘⇧W** closes the panel that has the focus, even with the keyboard in a terminal. With the page focused it closes the panel on the right. The panel it had replaced comes back first. Off macOS it is **Ctrl+F4**.
- **F6** moves the focus to the next panel: the page, the detail, then each open tool. **⇧F6** goes back. The panel with the focus has a tinted border.
- With two tools open, **⌘K** has **Move Terminal panel…** for each one. It lists only the places that keep the page its room: above or below another panel, left or right of it, a swap, or beside the page. **Reset panel layout** puts every panel back where it opens, with **Undo** in the toast.
- **⌘⌥W** and **⌘⌥P** on a run, a step, an agent or an artifact go to Runs or Artifacts. So do they from Settings or a panel over the list. Pressed on the list itself they stay.

**The Mac menu bar**

On a Mac the menu bar carries the same keys.

- File holds New Session, New Chat, New Terminal, New Workspace, Close (**⌘W**) and Close the panel (**⌘⇧W**). Close the panel reads the same words as Settings, with no capital.
- Edit holds Search.
- View holds Show or Hide Sessions (**⌘B**), Search or Run, Reset Panel Layout, zoom, Reload (**⌘R**) and Reload Goodboy (**⌘⇧R**).
- Go holds Back and Forward, then Board, Tasks, Workflows, Chat, Connections, Impact, Monitoring and Notifications. After a separator, Show or Hide Terminal and Show or Hide Browser open those tools on the right rail.
- Help holds Guide, What's New, Keyboard Shortcuts and Report a Bug.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/keyboard-shortcuts-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/keyboard-shortcuts-light.webp" alt="The Keyboard shortcuts page in Settings, every shortcut in the groups General, Workspaces, Views and Lists, with Search or run on ⌘K, Search on ⌘F, Report a bug on ⌘I and a ⌘⌥ key for each view from Overview to Slack threads">
</picture>

<sub>Screenshot from Goodboy 0.40.1</sub>

### Script drawer

Pin the scripts you use and run them from the session.

- Open the Scripts pane from **Scripts** on the right rail, or with ⌘⌥S.
- It lists scripts in one list per branch, headed by the project and the branch they run on. Services (dev servers and watchers) come first, then the scripts that run and end.
- Each row shows the script's name and its command in mono.
- A click on a row opens its output. The row's one control is **Run** or **Stop**. **Pin**, **Restart**, **Open in terminal** and the rest live in the right click menu.
- **Open in terminal** opens a terminal in that branch's worktree with the command typed in, not run.
- A script runs on the branch you are on: the branch page, or the agent or run you opened. A terminal opens there too, and its tab names the branch.
- From ⌘K, a script runs at once when its project has one branch in the session. With more than one and no branch on screen, a second step asks **Run Replay settlement batch on which branch?**, the branch that ran a script last first.
- A running service shows its dot and uptime. CPU and memory are two rows in the card you get when you rest on its status.
- Its port opens beside the session on a click, and in your own browser on **⌘-click**.
- **Run** on a Service starts it in place and leaves the list as it is. The row's last line, uptime and port are the feedback. A click on the row, or Enter, opens its output.
- A project with more than one Service has **Start all services** on its header. It starts the ones that are not running.
- **Run** on a Command shows the Command's live output in place of the list, with **Run again**, **Copy output**, **Add to message** and **Back to scripts**.
- **Add to message** attaches the log to the session's composer without sending it. The log is titled with the script, the exit code and the worktree. The same verb is in the row's right click menu.
- A line a program redraws (a progress bar, a spinner) shows as its last frame, one line.
- A running script takes no input. Its pane says **Output only. Stop ends it.**
- A running script puts a dot on **Scripts**. A run that failed puts a red one there until you open its output.
- A script that ends while you are in another session raises a toast, "Check posting drift failed in ledger-core", with **Open output**.
- When Goodboy quits with services running, the first Scripts view after the next launch has one row, **Start the 2 services that were running**, with **Start** and **Dismiss**. It lists only Services that still exist in the folder they ran in and are not running.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/keyboard-script-drawer-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/keyboard-script-drawer-light.webp" alt="The Scripts pane grouped by project, and the Check posting drift output open on the right: Failed after 12s in ledger-core on nw/fix-settlement-replay, the failing vitest output, Run again, Exit 1 and Copy output">
</picture>

<sub>Screenshot from Goodboy 0.40.1</sub>

### Open in editor

Jump into VS Code, Cursor, Zed, the JetBrains IDEs, Sublime Text, Vim or Neovim, at the worktree or the file. **Open with**, in **Settings › General**, picks the editor, the terminal app and the browser that links and artifacts open in. **Open in external terminal** sits in the menus of a session, a branch folder, a worktree and a folder in Files. It opens the folder in Terminal.app, iTerm, Warp or Ghostty, whichever are installed. A file path with a line number in a terminal opens at that line in your editor. `code -g`, `zed` and `subl` take `file:line:col`. The JetBrains IDEs take `--line` and `--column`. Linux uses the system terminal.

### Explore

Browse the session folder as a file tree on the **Changes** page of a branch. **All files** beside **Changed** swaps the list of changed files for the whole folder, and **⌘⌥X** opens it there.

- A changed file carries a letter and its line counts. An unchanged file is muted.
- A click on a changed file scrolls to its diff. A click on an unchanged file reads it in place, with its line count, **Open in editor** and **Back to the changes**.
- The filter field searches the loaded and changed files. **Hide files** folds the list, and **F** or **/** bring it back.
- A branch with no change says **No changes against main** and offers **All files**.

### Browser

Open your dev server, a port or a link beside the session or on a page of its own, without leaving Goodboy.

- **Browser** at the foot of the right rail, or Go › **Show or Hide Browser**, shows or hides the browser beside the work, on any page. The Session pages fold to icons while it is open. Its tooltip counts the open tabs; the button shows no number.
- In a window narrower than 1100 pixels the right rail keeps its icons only, with the names in the tooltips, so a narrow panel still opens beside the page. The Browser then lies over the page, left of the rail, behind a veil. A click on the veil or **⌘⇧W** closes it; **Esc** does too once you click outside the web page, since the page keeps Esc for itself.
- The address bar shows the page, not its address: the icon, the title and the host. Click it, or press **⌘L**, to see the full address selected and type a new one. **Esc** puts the title back. The icon is the site's own when it has one, and a letter when it has none.
- While a page loads, a thin line breathes under the address row and Reload becomes **Stop**. A page that never finishes says so after 30 seconds. **Back** and **Forward** turn off when there is nothing behind or ahead.
- **More** holds **Add to message**, Open in your browser, **Open full page**, Copy address, Duplicate and Close tab. On macOS it also holds **Inspect in Safari**, which shows the tab in Safari's Develop menu.
- **Add to message** puts the text you see on the page on the message box as a chip with the title, the site and the word count. It also sits in the right-click menu of a tab, and **⌘⇧S** does the same for the shown tab.
- The page is read when you press it, never before. Nothing goes to the agent until you send the message, and the × on the chip takes it away.
- A page over 60,000 characters is cut, and the text says so at the end. A key or a token in the text is hidden.
- A page that moved to another site since you pressed is not read. A failure says why under the address row, with **Retry**.
- **Open full page** makes it full size on the Browser page. It lists every tab, grouped by session, then the pins of each project. **Dock**, last in the address row, puts it back. The page never reloads, so a half-typed form stays.
- The page has no title band: the trail, the address row, then the page. The first button of the address row folds the tab list, and **New tab** is the last row of the list.
- Pick a tab on the Browser page to show it there. The trail at the top goes back to its session, and a reload comes back to the same tab.
- The address is a command field. Type an address and press **Enter** to open it beside the session, or **⌘Enter** to open it in your browser. A localhost address opens your dev server.
- Type a word to find a tab of any session, a project pin or a page this session visited. The list floats over the page under the address and shows only while you type, so clicking the address alone lists nothing. Words are never searched on the web; when nothing matches, one quiet line says so. The arrows move between rows.
- Type the path of a local page, image or PDF, like `~/harborline/plan.html`, to open it in a tab. The tab shows the path, takes the page's title, and Reload reads the file again. The page reads only the files in its folder and the folders under it. A missing file, a folder or another kind of file says why under the address. A link or a page never opens a local file.
- A port chip, a running Service's port, a link in a conversation, a decision or an artifact and a web address in a terminal open beside the session. The tab already on that page is shown when there is one. **⌘-click** opens your own browser instead. Sign-in and connect links keep opening your own browser.
- **Settings → App → General → Open with → Links in a session** picks where a plain click goes: **In Goodboy** or **In your browser**. **⌘-click** always opens your own browser.
- A terminal with no session sends its links to your own browser.
- Rest on a localhost link, or on a web address in a terminal, to see where a click goes before you open it.
- While the browser is on screen, its keys are the ones every browser uses. **⌘L** goes to the address. **⌘T** opens a new tab. **⌘W** closes the shown tab, and with no tab left it closes the browser. **⌘⇧T** reopens the last tab you closed, up to five. **⌘⇧[** and **⌘⇧]** step through the tabs. **⌘D** pins or unpins the shown tab. **⌘⇧S** sends the page to the agent. **⌘F** finds text in the page. Elsewhere these keep their other meaning, so ⌘L stays Ask and ⌘F stays Search.
- **Console**, the button after More, or **⌘⇧J**, opens the console under the page. **Console** lists what the page logged, with its errors, and **Network** the requests that failed, each with its count. It starts over at every load. **Clear** empties the list you see, and **Send to** the agent puts both lists on the message box as one file you can remove. Nothing is read while the console is closed.
- The find bar sits under the address row and never covers the page. It says **Found** or **Not found**, and the page highlights the match. **Enter** goes to the next match and **⇧Enter** to the previous one. **Esc** or **Done** clears the highlight and closes the bar.
- A pin is never closed by **⌘W**. Unpin it first.
- Click into the page and the page keeps the keys. Click the address row or a tab to give them back.
- **⌘K** lists the tabs of every session in the workspace and the pins, with the session as the detail. Pick one to show it. Type an address or the path of a local page there and **Open** it beside the session.
- Tabs belong to the session. Pin a tab to keep it in every session of the project. Tabs close when the session is archived.
- Each workspace keeps its own cookies and site data, so a sign-in never shows in another workspace. Switching workspace closes the other one's tabs, and they reopen at their address when you show them.
- A tab hidden for 10 minutes closes its page and keeps its address and title in the list. A window keeps four live tabs, and a fifth closes the one hidden longest. A tab you are looking at never closes.
- **Open in your browser** hands a web page to your own browser at any time.

## Under the hood

This part is for contributors and agents who change the feature.

- Terminal dock: ``⌃` `` (`terminal.studio`) and ⌘⌥T (`session.terminal`) both run `toggleTerminalDock`. ``⌃` `` passes `shouldFocusFirst`: an open Terminal without the focus gets it, a focused one closes. Off a session page it opens `openWorkspaceTerminal`, a drawer with `sessionId: null`. `openTerminalOnPage` and `dockTerminalPage` move between dock and page, `dockEmptyTerminalPage` docks a terminal from the empty page, and [studios.md](../navigation/studios.md) owns the Terminal page.
- The Desk: `useDeskFollowsTools` opens the Desk when a tool opens on the Overview. `landingOf` (`store/slices/navigation/`) is the one entry rule and `deskLandingOf` feeds it the session. `useDeskLanding` opens the tools after the saved grid is read and closes the Desk when its last tool goes (`closeDesk`). No shortcut id switches the face: `session.desk` is gone from the registry and the menu, and a saved override for it is dropped (`overrides.test.ts`). `closeCurrentLevel` (⌘W) closes a Desk tool through `deskToolToClose`. `useDeskOwner` holds the Desk through `desk_hold` in `window_heartbeat.rs`. `landingOf.test.ts`, `useDeskLanding/index.test.tsx`, `useDeskOwner/index.test.tsx` and `desk-nav.rows.tsx` cover each case.
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
- Browser console: `useConsoleEntries` pulls `browser_console_read`, and `applyConsoleRead` keeps the latest cursor. `BrowserConsole` draws the region and `consoleAttachmentOf` the file. [browser.md](../browser.md#console) owns the hook, the read and the caps. `browser.console` is the key.
- Files: the Changes page switches between **Changed** and **All files** (`useChangesMode`); the file chord opens it on All files.

- Context entry: `togglePane` and `openContextDrawer` default to Goal; `withoutRemovedPages` restores former Context addresses beside Overview.

- Places rail: `apps/desktop/src/App.tsx` supplies `AppShell.leftRail` without a fold control; `apps/desktop/src/app/components/ShellLeft/index.tsx` keeps it visible beside the page.
- Move keys: `useMoveKeys` runs on the Overview column and the Desk column. Enter is `list.open` and clicks the `data-move-verb` button of `data-move-primary`, and declines when it is disabled. S is `move.notNow` and calls the `onNotNow` of the card's menu target, with its Undo. J and K reuse `useRowFocusKeys` on `data-move-verb`. Both keys wait unless `isFaceShown`. The `list` scope entries live in `listShortcuts.ts`.
- List keys: `useListKeys` follows a selected row (Tasks, Notifications, Scripts). `useRowFocusKeys` moves the focus between the rows of a list with no selected row (Chat, Runs, Artifacts, Workflows, Terminal, Monitoring). `useSearchKey` takes **/** alone for a field. The Board reads the same registry entries inside `useBoardArrowKeys`.
