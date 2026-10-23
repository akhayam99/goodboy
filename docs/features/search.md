# Search and navigation

Find any session, message, plan or action, and reach it from the keyboard. One sidebar holds every place you go, and **⌘K** and **⌘F** cover the rest.

### Sidebar

Every place you go sits in one sidebar on the left: **New session**, then **Sessions**, **Tasks**, **Chat** and **Terminal** (each with a **+** to start one), **Workflows**, **Impact** and **Monitoring**, then your pinned and recent sessions, and **Settings**. The sidebar looks the same on every screen. Click a session and its row stays selected while the session opens with its own rail at the left of the page: **Pin**, **Refresh** and **⋯** on top, then its pages (**Overview**, **Runs**, **Agents**, **Artifacts** and **Questions**) with their counts, a **Folders** card that folds each folder and branch, every branch led by its pull request icon in its color and holding its pull request, comments, files and checks, a **Linked** card with the work linked to it. The **⋯** holds **Spend and limit**, **Archive** and **Delete** with the session's other actions. At the right of the page, the session tools carry their words: **Ask**, **Terminal**, **Explore**, **Context**, **Agents** and **Scripts**. A branch, a run or **Auto** steps the rail one level in, and **‹** steps back out. **⌘B** folds the sidebar into a slim bar of icons, and **⌥⌘B** or the rail's own button folds the rail, the same key that folds the list beside Chat, Terminal, the Guide and Settings. In a narrow window the sidebar folds first, then the rail. An amber dot on **Sessions** says sessions need you, and one on **Monitoring** names the pinned port that is down.

### Go anywhere

Reach any screen without the mouse. **⌘K** opens a window where a few letters find any session, agent, plan, page or script in any workspace, and **Enter** opens it.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/search-go-anywhere-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/search-go-anywhere-light.webp" alt="The palette after typing webhook: Ask about this session and Ask in chat, then Jump to with two sessions named Stop retried webhooks posting a second credit (payments-api and notify-relay) and the Replay a webhook event script, with the details of the first session on the right">
</picture>

<sub>Screenshot from Goodboy 0.27.1</sub>

### Command palette

Press **⌘K** to act on what you are looking at. Inside a session it opens on **Next**, the step Goodboy would take now, then the actions that fit the session, ranked by how often you use them. Any text you type can also go to **Ask in Chat** as a new question.

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

Right click a session, agent, run, artifact, pull request, file or message to see every action it has. The `⋯` menu and the palette list the same actions, and one that cannot run says why.
