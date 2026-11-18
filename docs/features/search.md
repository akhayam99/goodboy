# Search and navigation

Find any session, message, plan or action, and reach it from the keyboard. The places rail keeps workspace navigation on the left, and **⌘K** and **⌘F** cover the rest.

### Places rail

Move between Board, Tasks, Workflows, Chat, Connect and Impact from the places rail on the left.

**New** sits first and opens **New session**. A dot marks a draft waiting there while you are elsewhere. The six places follow, with **Impact** quieter and last. **Connect** opens **Connections**, whose full name appears on hover. **Board** stays highlighted while a session is open.

An amber number on **Board** counts sessions that need you. A dot on **Tasks** marks new tasks. The rail holds no session list. **Monitoring** opens from the Go menu or **⌘K**.

The rail keeps the same places on every page. It never folds or resizes. In a window narrower than 1100 pixels, the words below the icons move into tooltips.

At the foot sit **Settings**, then **Report**, then the **Goodboy** mark. With an update waiting, the mark becomes an **Update** mark. Before you create a workspace, only this foot appears.

Open **Sessions** in the top bar, or press **⌘B**, to find a session by title or project. Pinned sessions come first. **Open Board** shows finished sessions too.

A session opens on its Overview, with its title, **New** and **⋯** above the page tabs. The tabs are **Overview**, **Runs**, **Artifacts**, **Questions** and **Context**. Runs, Artifacts and Questions carry counts.

The **Context** tab holds a **Projects** card that folds each folder and branch, and a **Linked** card with the work linked to it. Every branch is led by its pull request icon in its color. Click one to open its Branch page, with the tabs **Conversation**, **Changes**, **Commits**, **Checks**, **Work** and **Comments**.

The **⋯** holds **Ask about this session**, **Pin session**, **Refresh session**, **Archive** and **Delete**. The limit and the rest of the session's actions are in the Board row's menu and in ⌘K.

A branch, an artifact or a run keeps the head and shows crumbs such as **Overview › Artifacts › Plan** in place of the tabs. Each crumb is a link, and **Esc** goes one crumb up.

**Ask about this session**, from the **⋯** or ⌘L, opens a detail panel beside the page. From left to right a window holds the places rail, the page, the detail panel, the open tools and the tools rail. On a narrow window a panel lies over the page with a scrim.

The tools rail sits at the right edge of every page: **Terminal**, **Browser**, **Scripts**, **Ask** and **Monitor**, each named with its shortcut on hover. A click opens the tool to its left, and the rail never moves. Tools stay open as you move between pages. **Open full page** in a tool's header makes it a page, and **Dock**, last in the page's first row, puts it back.

Open more tools and they share the space, up to four in two columns of two, each in its own card. **F6** moves between the page and the panels, and **⌘⇧W** closes the one with the focus. With two tools open, a button in their heads stacks them or puts them side by side. Each session keeps its own layout and brings it back when you return.

In a window narrower than 1100 pixels the tools rail shows icons only. A narrow tool still sits beside the page, and the Browser lies over it.

**⌥⌘B** folds the list beside the page you are on, such as the files of the Changes page, Chat, Terminal, the Guide or Settings. Each of those lists has its Hide button at its top left.

A drawer that opens in the side slot keeps the one it replaced. That one waits in a chip at the left of the drawer head. **Esc**, the close button or **⌘⇧W** brings it back with its state. A third open drops the oldest.

### Go anywhere

Reach any screen without the mouse. **⌘K** opens a window where a few letters find any session, agent, plan, page or script in any workspace, and **Enter** opens it.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/search-go-anywhere-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/search-go-anywhere-light.webp" alt="Search or run after typing webhook: Ask about this session and Ask in chat, then Jump to with two sessions named Stop retried webhooks posting a second credit (payments-api and notify-relay) and the Replay a webhook event script, with the details of the first session on the right">
</picture>

<sub>Screenshot from Goodboy 0.27.1</sub>

### Search or run

Press **⌘K**, or click **Search or run** in the top bar, to act on what you are looking at. Inside a session it opens on **Next**, the step Goodboy would take now, then the actions that fit the session, ranked by how often you use them. Any text you type can also go to **Ask in Chat** as a new question. Delete stays out of the default list; typing its name finds it.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/search-command-palette-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/search-command-palette-light.webp" alt="Search or run on the agent Resolve review on payments-api#318: Next offers Answer open questions, For this agent lists Show its changes, Message this agent, Rename, Change model, Copy name and Delete agent, and For this session follows, with the Commands and Search switch at the top right">
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

Right click a session, agent, run, artifact, pull request, file or message to see every action it has. The `⋯` menu and Search or run list the same actions, and one that cannot run says why. On a session scope that has not loaded yet, an empty Search or run draws skeleton rows instead of "Nothing to do here yet".

## Under the hood

- **Places rail**: `apps/desktop/src/app/components/ShellLeft/index.tsx` renders New, the places and the foot. `apps/desktop/src/shared/navigation/destinations.ts` owns their order, Connect's full name and Monitoring's menu home. `apps/desktop/src/shared/navigation/railPlaceOf.ts` keeps Board current for an open session.
- **Places rail signals**: `apps/desktop/src/app/components/ShellLeft/railMarkOf.ts` selects Board's count and Tasks' dot from `apps/desktop/src/app/components/ShellLeft/useDoorSignals/index.ts`. New's draft mark is derived in `apps/desktop/src/app/components/ShellLeft/index.tsx`.
- **Places rail size**: `apps/desktop/src/App.tsx` supplies the rail to `packages/ui/src/components/AppShell.tsx` without a fold or resize control. `packages/ui/src/components/ShellRail/useShellRailForm/index.ts`, `packages/ui/src/components/ShellRail/shellRailGeometry.ts` and `packages/ui/src/components/ShellRail/ShellRailItem.tsx` own the width breakpoint, words and tooltips.

- **Tools rail and grid**: `apps/desktop/src/app/components/ShellToolRail.tsx` puts the rail on the window edge, and `apps/desktop/src/features/session/components/SessionTools/sessionTools.ts` lists the five tools. `apps/desktop/src/store/slices/drawer/gridAfterOpen.ts` places a new tool, `packages/ui/src/dockLayout.ts` lays out the page, detail, grid and rail, and `apps/desktop/src/features/workspace/hooks/useSessionDockGrid/watchSessionDockGrid.ts` saves and restores the grid per session.

- **Sessions**: `apps/desktop/src/app/components/AppTopBar/index.tsx` mounts `apps/desktop/src/features/workspace/components/SessionsPopover/index.tsx`. Its panel owns title and project filtering, keyboard selection and pin actions.
