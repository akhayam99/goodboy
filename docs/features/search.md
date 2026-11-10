# Search and navigation

Find any session, message, plan or action, and reach it from the keyboard. One sidebar holds every place you go, and **⌘K** and **⌘F** cover the rest.

### Sidebar

Every place you go sits in one sidebar on the left. It looks the same on every screen. From top to bottom:

- **New session**
- **Sessions** and **Tasks** (the work of your other tools)
- **Workflows** and **Chat**. Chat has a **+** to start one.
- the quieter **Impact** and **Monitoring**. Monitoring shows a warning dot when a pinned port is down.
- your pinned and recent sessions
- **Settings**

Click a session and its row stays selected. The session opens with its own rail at the left of the page. From top to bottom:

- **Pin**, **Refresh** and **⋯**
- its pages (**Overview**, **Runs**, **Artifacts** and **Questions**) with their counts
- a **Projects** card that folds each folder and branch. Every branch is led by its pull request icon in its color and holds its pull request, comments, changes and checks.
- a **Linked** card with the work linked to it

The **⋯** holds **Limit**, **Archive** and **Delete** with the session's other actions.

At the right of every page, the right rail is a column of icons, each named with its shortcut on hover. In a session, **Session** holds **Explore**, **Context**, **Ask this session**, **Agents** and **Scripts**. At the foot, on every page, sit **Terminal** and **Browser**, for the whole workspace. They stay open as you move between pages. **Open as page** makes either one full size, and **Dock** puts it back. The active tool shows its name below its icon. A ring marks the tool waiting behind the drawer in the side slot.

A branch, a run or **Auto** steps the rail one level in. **‹** steps back out.

**⌘B**, or the sidebar button at the top left of the window, folds the sidebar into a slim bar of icons, on every page. It stays as you left it: starting a new session never unfolds it. Folded, the sidebar draws only sessions that need you, run or have unread news, each as its state node; the rest wait behind a `+N` button. Branches show the request state icon. Each tooltip names the state.

**⌥⌘B** or the rail's own button folds the rail. It is the same key that folds the list beside Chat, Terminal, the Guide and Settings, and each of those lists has its Hide button at its top left. Opening a drawer folds the rail when needed; closing it restores your fold.

An amber dot on **Sessions** says sessions need you. A dot on **Monitoring** names the pinned port that is down.

A drawer that opens in the side slot keeps the one it replaced. That one waits in a chip at the left of the drawer head. **Esc**, the close button or **⌘⇧W** brings it back with its state. A third open drops the oldest.

### Go anywhere

Reach any screen without the mouse. **⌘K** opens a window where a few letters find any session, agent, plan, page or script in any workspace, and **Enter** opens it.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/search-go-anywhere-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/search-go-anywhere-light.webp" alt="The palette after typing webhook: Ask about this session and Ask in chat, then Jump to with two sessions named Stop retried webhooks posting a second credit (payments-api and notify-relay) and the Replay a webhook event script, with the details of the first session on the right">
</picture>

<sub>Screenshot from Goodboy 0.27.1</sub>

### Search or run

Press **⌘K**, or click **Search or run** in the top bar, to act on what you are looking at. Inside a session it opens on **Next**, the step Goodboy would take now, then the actions that fit the session, ranked by how often you use them. Any text you type can also go to **Ask in Chat** as a new question. Delete stays out of the default list; typing its name finds it.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/search-command-palette-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/search-command-palette-light.webp" alt="The command palette on the agent Resolve review on payments-api#318: Next offers Answer open questions, For this agent lists Show its changes, Message this agent, Rename, Change model, Copy name and Delete agent, and For this session follows, with the Commands and Search switch at the top right">
</picture>

<sub>Screenshot from Goodboy 0.27.1</sub>

### Search

Find a message, a plan, a decision, an issue or a branch with **⌘F**. Search starts in the open session and widens to the workspace or everything, with filters for type, project and date. **Open in transcript** lands on the hit in context, and the index stays on your computer.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/search-overlay-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/search-overlay-light.webp" alt="Search for credit in the session Stop retried webhooks posting a second credit: two messages, the session, the plan Dedupe on the event id, the issue HBL-412 and pull request #318 as results, the filters Type, Project, Provider, Status and Date above them, and the picked message with Open in transcript and its actions on the right">
</picture>

<sub>Screenshot from Goodboy 0.27.1</sub>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/search-jump-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/search-jump-light.webp" alt="The session transcript after opening a hit, with credit highlighted in the messages and a find bar reading credit, 2 of 3, with previous, next and close buttons">
</picture>

<sub>Screenshot from Goodboy 0.27.1</sub>

### Right click menus

Right click a session, agent, run, artifact, pull request, file or message to see every action it has. The `⋯` menu and the palette list the same actions, and one that cannot run says why. On a session scope that has not loaded yet, an empty palette draws skeleton rows instead of "Nothing to do here yet".
