# Set up

Get from install to a first agent. Check the agents on this Mac, make a workspace from your folders, link your tools and tell agents who you are.

### Welcome to Goodboy

Four short steps take you from install to a first agent reading your code: **Agents**, **Workspace**, **Tools**, which is optional, and **First session**. Welcome already names the agents it found on this Mac, and nothing is saved until you create a workspace. **Set up later** sits in the header, Escape goes back one step and never ends setup, and the next launch opens at the step you left. The Goodboy menu counts the four steps, **Setup · 2 of 4**, and offers **Resume setup** while setup is paused.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/setup-welcome-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/setup-welcome-light.webp" alt="The Welcome to Goodboy screen: the Goodboy tile above the line Run coding agents side by side on your own repositories, Found Claude and Codex on this Mac, a Get started button, and the steps Agents, Workspace, Tools and First session with Set up later along the top">
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

A workspace is what you work on: one repository, or a folder that holds several. Drop a folder or press **Choose folder** (⌘O), and the workspace takes the folder's name, so acme-web becomes Acme web, which you can edit in place. A folder of repositories lists them checked, a plain folder offers git init, and a folder another workspace holds asks whether to move it here. **Start from scratch** makes a new repository instead. Nothing is saved until **Create**.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/setup-workspace-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/setup-workspace-light.webp" alt="The Workspace step of setup, Your first workspace: the line A workspace is what you work on, one repository or a folder that holds several, a drop area reading Drop a folder here, the link Start from scratch, and Back and Choose folder">
</picture>

<sub>Screenshot from Goodboy 0.27.1</sub>

### Home

A window with no workspace open shows Home: the Goodboy tile with the version, your workspaces with their folder count and where their folders live, and **New workspace** (⌘N), which opens the same form in place. With no workspace yet, Home says where setup paused and offers **Resume setup**. **Reopen the last workspace on launch** opens your last workspace at launch instead.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/setup-home-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/setup-home-light.webp" alt="Home with the Goodboy tile and its version, the Workspaces list with Harborline 3 folders, Northwind 2 folders, Acme web 1 folder and Cascadia 4 folders, each with where its folders live and when it was last opened, a New workspace button, and the switch Reopen the last workspace on launch">
</picture>

<sub>Screenshot from Goodboy 0.27.1</sub>

### One page per provider

Each provider has its own page in **Providers and models** with its usage, the models shown in the picker, its permissions and your account. Providers billed per token say so instead of showing usage windows.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/setup-provider-page-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/setup-provider-page-light.webp" alt="The Claude page in Settings under Providers and models: a warning that Claude is about to run out, Usage with a 5-hour window at 85% used and a Weekly bar at 48% used, Models in the picker showing Haiku, Sonnet, Opus and Fable, and Permissions with Claude">
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

Connect GitHub, GitLab, Bitbucket, Linear, Jira, Sentry and Slack from one page, and see the account behind each. A folder can use a different account than its workspace. Keys stay in your system credential store.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/setup-integrations-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/setup-integrations-light.webp" alt="Settings under Integrations: GitHub, GitLab, Bitbucket, Linear, Jira, Sentry and Slack in the left list with a status dot each, and the GitHub page open showing the all-workspaces account connected as harborline-bot with a personal API key, This workspace and Open in Tasks">
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

Settings opens from the foot of the sidebar or with **⌘,**, on the page you used last. **Search settings** finds any setting, every page is also in the command palette, and a dot marks a page that needs you.

**Also in this area**

| Feature       | What it does for you                                           |
| ------------- | -------------------------------------------------------------- |
| Settings rail | Each settings area says what needs you, like folders not found |
