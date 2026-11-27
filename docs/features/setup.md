# Set up

Get from install to a first agent. Check the agents on this Mac, make a workspace from your folders, link your tools and tell agents who you are.

### Your agents

Setup opens on your agents, step one of three from install to a first agent reading your code. The steps are **Agents**, **Workspace** and **First session**, and the first one opens with the welcome and the line that nothing is pushed until you say so.

#### Check your agents

Goodboy runs the coding agents already on this Mac, and one ready agent is enough. Claude, Codex, Cursor, Gemini and Copilot each have a row. Each row says where its CLI stands:

- **Ready**, with its version and account.
- **Not signed in**, with **Sign in**.
- **Not installed**, with **Install** and the exact command.
- **Can't start**, with the CLI's output and **Check again**.
- **Update needed**, with **Update**, when the CLI is too old to report its sign in.

Rows check again when you come back to the window. The agent marked **Default** becomes the default of your first workspace. Providers billed by API key sit behind **Use an API key instead**.

#### Leave and resume setup

Nothing is saved until you create a workspace.

- **Set up later** sits in the header. The next launch opens at the step you left.
- Escape goes back one step and never ends setup.
- If one step of the launch takes ten seconds, the splash says so and offers **Restart**.
- If making the workspace fails, the reason shows in the action row of the Workspace step and the buttons stay.
- A setup card on the Board counts the three steps, **Setup · 2 of 3** beside a small meter. It folds finished steps into one line, gives the open step the one button, and offers **Resume setup** while setup is paused.

#### First session

The last step is the same **Start a run** field a session uses, filled with a starter and set to Scout, which reads the folder and changes nothing.

- With a task tool connected and an open issue, it opens on **Pick an issue** with the first issue selected. **Draft the brief** takes it to the New session page.
- With a tool and no open issue, or no tool, it stays on **Ask about the code**. It has a **Connect Linear or Jira** link that opens the tools and brings you back.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/setup-agents-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/setup-agents-light.webp" alt="The first setup screen, the Agents step under the heading Welcome to Goodboy, with the steps Agents, Workspace and First session and Set up later along the top: Claude Ready and marked Default with Claude Code 2.1.280 and its account, Codex Not signed in with Sign in, Cursor and Copilot Not installed with Install, Gemini Not installed with Set up, the Use an API key instead row, the line 1 ready, checks again when you come back, and Continue">
</picture>

<sub>Screenshot from Goodboy 0.40.1</sub>

### Your first workspace

A workspace is what you work on: one repository, or a folder that holds several. Nothing is saved until **Create**.

#### Add a folder

Drop a folder or press **Choose folder** (⌘O). The workspace takes the folder's name, so acme-web becomes Acme web, which you can edit in place.

- A folder of repositories lists them checked.
- A plain folder asks whether it is a **Code project** or **Documents**. The answer is preselected from what the folder holds, with git offered at **Create** for code.
- A folder another workspace holds asks whether to move it here.

#### Find folders

Under the drop area, **Likely folders** lists the places code usually lives, as boxes to tick. It shows only the ones this Mac has: ~/code, ~/dev, ~/Developer, ~/work and the like, plus ~/Documents on macOS.

A tick reads nothing. **Look in 2 folders** reads the ticked ones, and their repositories appear checked.

#### Clone a repository

A repository that is not on this Mac clones from the same step. **Clone it** takes a GitHub, GitLab or Bitbucket address: `https://github.com/owner/name`, `git@github.com:owner/name.git` or `owner/name`, which asks for the host.

- The destination starts as `~/Developer/<name>` and stays editable.
- The clone shows its progress with **Cancel**, and a cancel removes the partial folder.
- A folder that already holds files is never overwritten. Setup offers the next free name, such as `name-2`.
- A private repository clones with the login `gh`, `glab` or git already holds. With none, the line names the command to run and Connections, where hosts connect. A public repository needs no login.
- A network failure offers **Retry**.
- On success the folder is added exactly like a ticked one.

**Start from scratch** makes a new repository instead.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/setup-workspace-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/setup-workspace-light.webp" alt="The Workspace step of setup, Your first workspace: the line A workspace is what you work on, one repository or a folder that holds several, a drop area reading Drop a folder here, the link Start from scratch, and Back and Choose folder">
</picture>

<sub>Screenshot from Goodboy 0.40.1</sub>

### Home

A window with no workspace open shows Home, which lists your workspaces with their folder count and where their folders live. Home also holds the Goodboy tile with the version. **New workspace** (⌘N) opens the same form in place. With no workspace yet, Home says where setup paused and offers **Resume setup**. **Reopen the last workspace on launch** opens your last workspace at launch instead.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/setup-home-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/setup-home-light.webp" alt="Home with the Goodboy tile and its version, the Workspaces list with Harborline 3 projects, Northwind 2 projects, Acme web 1 project and Cascadia 4 projects, each with where it lives and when it was last opened, a New workspace button, and the switch Reopen the last workspace on launch">
</picture>

<sub>Screenshot from Goodboy 0.40.1</sub>

### One page per provider

Each provider has its own page in **Connections** with its usage first, then the models shown in the picker, your account and what works with it. Providers billed per token say so instead of showing usage windows.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/setup-provider-page-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/setup-provider-page-light.webp" alt="The Claude page in Connect: a warning that Claude is about to run out, Usage with a 5-hour window at 85% used and a Weekly bar at 48% used, Models in the picker showing Haiku, Sonnet, Opus and Fable, and the Account group">
</picture>

<sub>Screenshot from Goodboy 0.40.1</sub>

### Update the provider CLI

When a model needs a newer provider CLI, the provider page says so and one button installs it. The update waits for running turns to finish.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/setup-cli-update-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/setup-cli-update-light.webp" alt="The Account group at the foot of the Claude page: the signed in account with Claude CLI 2.1.260, and a banner reading Opus 5.5, Sonnet 5.5 and Haiku 5.5 need a newer Claude CLI, You have Claude CLI 2.1.260, Update to 2.1.293 or newer, with an Update Claude CLI button">
</picture>

<sub>Screenshot from Goodboy 0.40.1</sub>

### Permissions for each provider

See which permission modes a provider can honor before you pick one, from **Read only** to **Full access**. A mode a provider cannot honor never runs looser: it falls back to a stricter one and the table says why.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/setup-permissions-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/setup-permissions-light.webp" alt="The What works with Codex table on a provider page, 1 of 6 work fully: Read only Works, Ask first Not available, Edits allowed Partly, Full access Partly, Rules Not followed and Role limits Asked, not locked, each with its reason in words">
</picture>

<sub>Screenshot from Goodboy 0.40.1</sub>

### Integrations

Connect GitHub, GitLab, Bitbucket, Linear, Jira, Sentry and Slack from **Connections**, and see the account behind each. A folder can use a different account than its workspace. Keys stay in your system credential store. Each tile says when it was last checked and turns red only when the tool needs you, for example a key that left this Mac's keychain. A page menu holds **Open in Tasks**, **Check again** and **Disconnect**.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/setup-integrations-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/setup-integrations-light.webp" alt="The GitHub page in Connect: what GitHub does in Harborline (Pull requests, Reviews waiting on you and Issues in Tasks), the all-workspaces account connected as harborline-bot with a personal API key, and Use a different key for Harborline">
</picture>

<sub>Screenshot from Goodboy 0.40.1</sub>

### About you

Tell agents once who you are and how you like to work, in four short fields. **See who reads what** shows which agent role reads each part, and **Explanations** collects what agents explained to you about your topics.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/setup-about-you-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/setup-about-you-light.webp" alt="The About you page of workspace settings with the Profile card: Your job (Tech Lead, Backend Engineer), About your work, How agents should work with you, Explain more when it touches (Rust, Database migrations, Idempotency), the Explanations count with Open and a See who reads what link">
</picture>

<sub>Screenshot from Goodboy 0.40.1</sub>

### Settings

Settings opens from the foot of the places rail or with **⌘,**, on the page you used last. It is a page like the others: the places rail stays visible.

#### Pages

Its pages sit in their own list at its left, which folds, in two groups named for where they apply. Each page is one thing you came to change.

- **This Mac**, for every workspace, holds Look and alerts, Editor, terminal, git, Keyboard shortcuts, Storage and search and Backup and reset.
- Your workspace, by its name, holds Projects, About you, **Models**, Permissions, Branches and Replies and commits.
- Its last row, **Run defaults are in Workflows**, opens Workflows on Every run, where the run defaults, the edit mode of new sessions, the Lead and the roles live.
- The **iPhone** page joins the list once a phone is paired. Until then Search settings and Search or run find it.
- A phone icon sits before the bell in the top bar. Its dot says Live, Offline or a pairing problem, and a click shows the phone or opens the iPhone page. A switch on that page hides it.

#### Find a setting

**Search settings**, at the top of the list, finds any setting by its name, its old name or its help line.

- A result names the setting and its page. It opens the page and lights the row for a moment.
- The arrows move, Return opens and Esc clears.
- When nothing matches, the list says so and points to **⌘K** for actions like Export.
- Searching Providers or Integrations finds **Go to Connections**. Runs, Run defaults or Start as finds the link to Every run.
- Every page and every setting is also in Search or run (**⌘K**), tagged Setting. A dot marks a page that needs you.

#### Look and alerts

- **Appearance** holds the theme and **More contrast**. Search or run has the theme too: type Theme for **Theme: dark**, **Theme: light** and **Theme: system**.
- **More contrast** gives stronger borders, hover marks and quiet text. It turns on by itself when your system asks for more contrast, and on request with the switch, which is remembered on this Mac.
- **Notifications** holds **Banner when away** and **Dock badge**. The banner asks once and the badge starts on. Both are remembered on this Mac.
- **Updates** ends the page: the version you run, **Check for updates**, What's new and the switch to download in the background. A new version puts its dot on Look and alerts.

#### Editor, terminal, git and storage

- **Editor, terminal, git** holds the apps that open your files, the built-in terminal's command status and how often Goodboy checks origin.
- **Storage and search** ends with the search index, since the index is disk too.
- When folders hold a value of their own for a setting, its row says how many ("2 folders use their own"). A folder's own After merge rule is marked **From project**, so you stop wondering why one folder behaves differently.

**Also in this area**

| Feature       | What it does for you                                           |
| ------------- | -------------------------------------------------------------- |
| Settings rail | Each settings area says what needs you, like folders not found |

## Under the hood

This part is for contributors and agents who change the feature.

- Update needed: `agentRowOf` turns a found CLI whose auth reason is `cli_too_old` into the `outdated` row, and its button runs `updateProviderCli`. The version gate is in `docs/providers.md`, How the checks read the answer.
- Settings in several windows: `listenSettingChanges` reads the `goodboy:data-changed` event described in `docs/event-bus.md`.
- Settings rail: `settingsDirectory` builds both groups. `appSectionOf` opens the old `updates` id on Look and alerts and the old `advanced` id on Editor, terminal, git (`devtools`). `workspacePageOf` opens `models` and every model row id on Models. `isRunDefaultsFocus` in `settingRows.ts` sends the old Runs page and its rows to Every run. iPhone is hidden until `useIsIphonePaired` reads a paired phone from `bridge_status`.

- Settings beside the places rail: `apps/desktop/src/App.tsx` supplies `AppShell.leftRail`; `apps/desktop/src/app/components/ShellLeft/index.tsx` keeps Settings in its foot.
