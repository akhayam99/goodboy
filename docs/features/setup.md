# Set up

Get from install to a first agent. Check the agents on this Mac, make a workspace from your folders, link your tools and tell agents who you are.

### Welcome to Goodboy

Four short steps take you from install to a first agent reading your code: **Agents**, **Workspace**, **Tools**, which is optional, and **First session**. Welcome already names the agents it found on this Mac, and nothing is saved until you create a workspace. **Set up later** sits in the header, Escape goes back one step and never ends setup, and the next launch opens at the step you left. If one step of the launch takes ten seconds, the splash says so and offers **Restart**. If making the workspace fails, the reason shows in the action row of the Workspace step and the buttons stay. The Goodboy menu counts the four steps, **Setup · 2 of 4**, and offers **Resume setup** while setup is paused. The last step is the same **Start a run** field a session uses, filled with a starter and set to Scout, which reads the folder and changes nothing, with the Limit chip beside it. With a task tool connected and an open issue it opens on **Pick up an issue** with the first issue selected, and **Draft the brief** takes it to the New session page; with a tool and no open issue, or no tool, it stays on **Ask about the code**.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/setup-welcome-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/setup-welcome-light.webp" alt="The Welcome to Goodboy screen: the Goodboy tile above the line Goodboy runs coding agents side by side on your own repositories, one session for each goal, Found Claude and Codex on this Mac, a Get started button, and the steps Agents, Workspace, Tools and First session with Set up later along the top">
</picture>

<sub>Screenshot from Goodboy 0.27.1</sub>

### Your agents

Goodboy runs the coding agents already on this Mac, and one ready agent is enough. Each row says where its CLI stands: **Ready** with its version and account, **Not signed in** with **Sign in**, **Not installed** with **Install** and the exact command, or **Can't start** with the CLI's output and **Check again**. Rows check again when you come back to the window. The agent marked **Default** becomes the default of your first workspace, and providers billed by API key sit behind **Use an API key instead**.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/setup-agents-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/setup-agents-light.webp" alt="The Your agents step of setup: Claude Ready and marked Default with Claude Code 2.1.280 and its account, Codex Not signed in with Sign in, Cursor and Gemini Not installed with Install and Set up, the Use an API key instead row, the line 1 ready, checks again when you come back, and Back and Continue">
</picture>

<sub>Screenshot from Goodboy 0.27.1</sub>

### Your first workspace

A workspace is what you work on: one repository, or a folder that holds several. Drop a folder or press **Choose folder** (⌘O), and the workspace takes the folder's name, so acme-web becomes Acme web, which you can edit in place. A folder of repositories lists them checked, a plain folder asks whether it is a **Code project** or **Documents** (preselected from what it holds, with git offered at **Create** for code), and a folder another workspace holds asks whether to move it here. Under the drop area, **Likely folders** lists the places code usually lives (~/code, ~/dev, ~/Developer, ~/work and the like, only the ones this Mac has, plus ~/Documents on macOS) as boxes to tick. A tick reads nothing: **Look in 2 folders** reads the ticked ones, and their repositories appear checked. A repository that is not on this Mac clones from the same step. **Clone it** takes a GitHub, GitLab or Bitbucket address (`https://github.com/owner/name`, `git@github.com:owner/name.git` or `owner/name`, which asks for the host). The destination starts as `~/Developer/<name>` and stays editable. The clone shows its progress with **Cancel**, and a cancel removes the partial folder. A folder that already holds files is never overwritten: setup offers the next free name, such as `name-2`. A private repository clones with the login `gh`, `glab` or git already holds. With none, the line names the command to run and the Tools step where hosts connect. A public repository needs no login. A network failure offers **Retry**. **Clone** and Enter wait while a folder is being read. On success the folder is added exactly like a ticked one. **Start from scratch** makes a new repository instead. Nothing is saved until **Create**.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/setup-workspace-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/setup-workspace-light.webp" alt="The Workspace step of setup, Your first workspace: the line A workspace is what you work on, one repository or a folder that holds several, a drop area reading Drop a folder here, the link Start from scratch, and Back and Choose folder">
</picture>

<sub>Screenshot from Goodboy 0.27.1</sub>

### Home

A window with no workspace open shows Home, which lists your workspaces with their folder count and where their folders live. Home also holds the Goodboy tile with the version. **New workspace** (⌘N) opens the same form in place. With no workspace yet, Home says where setup paused and offers **Resume setup**. **Reopen the last workspace on launch** opens your last workspace at launch instead.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/setup-home-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/setup-home-light.webp" alt="Home with the Goodboy tile and its version, the Workspaces list with Harborline 3 folders, Northwind 2 folders, Acme web 1 folder and Cascadia 4 folders, each with where its folders live and when it was last opened, a New workspace button, and the switch Reopen the last workspace on launch">
</picture>

<sub>Screenshot from Goodboy 0.27.1</sub>

### One page per provider

Each provider has its own page in **Providers and models** with its usage, the models shown in the picker, its permissions and your account. Providers billed per token say so instead of showing usage windows.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/setup-provider-page-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/setup-provider-page-light.webp" alt="The Claude page in Settings › Providers and models: a warning that Claude is about to run out, Usage with a 5-hour window at 85% used and a Weekly bar at 48% used, Models in the picker showing Haiku, Sonnet, Opus and Fable, and Permissions with Claude">
</picture>

<sub>Screenshot from Goodboy 0.27.1</sub>

### Update the provider CLI

When a model needs a newer provider CLI, the provider page says so and one button installs it. The update waits for running turns to finish.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/setup-cli-update-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/setup-cli-update-light.webp" alt="The Account group at the foot of the Claude page: the signed in account with Claude CLI 2.1.260, and a banner reading Opus 5.5 and Sonnet 5.5 need a newer Claude CLI, You have Claude CLI 2.1.260, Update to 2.1.284 or newer, with an Update Claude CLI button">
</picture>

<sub>Screenshot from Goodboy 0.27.1</sub>

### Permissions for each provider

See which permission modes a provider can honor before you pick one, from **Read only** to **Full access**. A mode a provider cannot honor never runs looser: it falls back to a stricter one and the table says why.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/setup-permissions-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/setup-permissions-light.webp" alt="The Permissions with Codex table on a provider page: Read only Works, Ask first Not available, Edits allowed Partly, Full access Partly, Rules Not followed and Role limits Asked, not locked, each with its reason in words">
</picture>

<sub>Screenshot from Goodboy 0.27.1</sub>

### Integrations

Connect GitHub, GitLab, Bitbucket, Linear, Jira, Sentry and Slack from one page, and see the account behind each. A folder can use a different account than its workspace. Keys stay in your system credential store. The left list shows a dot only on an integration that needs you, for example a key that left this Mac's keychain, with the reason as its tooltip. A page menu holds **Open in Tasks**, **Check again** and **Disconnect**.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/setup-integrations-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/setup-integrations-light.webp" alt="Settings › Integrations: GitHub, GitLab, Bitbucket, Linear, Jira, Sentry and Slack in the left list with a status dot each, and the GitHub page open showing the all-workspaces account connected as harborline-bot with a personal API key, This workspace and Open in Tasks">
</picture>

<sub>Screenshot from Goodboy 0.27.1</sub>

### About you

Tell agents once who you are and how you like to work, in four short fields. **See who reads what** shows which agent role reads each part, and **Explanations** collects what agents explained to you about your topics.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/setup-about-you-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/setup-about-you-light.webp" alt="The About you page of workspace settings with the Profile card: Your job (Tech Lead, Backend Engineer), About your work, How agents should work with you, Explain more when it touches (Rust, Database migrations, Idempotency), the Explanations count with Open and a See who reads what link">
</picture>

<sub>Screenshot from Goodboy 0.27.1</sub>

### Settings

Settings opens from the foot of the sidebar or with **⌘,**, on the page you used last. **Search settings** finds any setting, every page is also in the command palette, and a dot marks a page that needs you. Under App, General, **Appearance** holds the theme (the palette has it too: type Theme for **Theme: dark**, **Theme: light** and **Theme: system**; the top bar has no theme switch) and **More contrast**: stronger borders, hover marks and quiet text, on its own when your system asks for more contrast and on request with the switch, which is remembered on this Mac. Below it, **Notifications** holds **Banner when you are away** and **Dock badge**: the banner asks once, the badge starts on, and both are remembered on this Mac and shared by its windows. A setting you save in one window shows in the other windows at once, without a reload. When folders hold a value of their own for a setting, its row says how many ("2 folders use their own"), and a folder's own After merge rule is marked **From project**, so you stop wondering why one folder behaves differently.

**Also in this area**

| Feature       | What it does for you                                           |
| ------------- | -------------------------------------------------------------- |
| Settings rail | Each settings area says what needs you, like folders not found |

## Under the hood

This part is for contributors and agents who change the feature.

- Settings in several windows: `listenSettingChanges` reads the `goodboy:data-changed` event described in `docs/event-bus.md`.
