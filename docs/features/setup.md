# Set up

Get from install to a first agent: connect a provider, check what it can do, link your tools and tell agents who you are.

### Welcome to Goodboy

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/setup-welcome-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/setup-welcome-light.webp" alt="The Welcome to Goodboy screen: a Setup stepper with Provider, Project, Code host, Tasks and First session, the line Five short steps, then an agent reads your project, four rows with their time, and a Get started button">
</picture>

<sub>Screenshot from Goodboy 0.13.1</sub>

Follow five short steps from install to a first agent reading your project: **Provider**, **Project**, **Code host**, **Tasks** and **First session**. Code host and tasks are optional, steps that do not apply to you are skipped, and **Skip setup** takes you straight in. The last step hands you a session draft already filled in.

### Provider connection

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/setup-provider-connection-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/setup-provider-connection-light.webp" alt="The Provider step of setup: Claude marked Connected, Cursor Not signed in with a Connect button, Codex with an Error status and a Connect button, and Gemini Not installed with a Set up manually button">
</picture>

<sub>Screenshot from Goodboy 0.13.1</sub>

Pick the provider you already pay for and connect it with a login or an API key. Each card says what the provider needs and where it stands: **Connected**, **Not signed in**, **Not installed**. **Connect** walks you through the sign-in, and **Open the sign-in page again** helps when no browser tab opened. You can add more providers later.

### One page per provider

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/setup-provider-page-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/setup-provider-page-light.webp" alt="The Claude page in Settings under Providers and models: Usage with a Weekly bar at 84% used, Models in the picker showing Haiku, Sonnet, Opus and Fable, Permissions with Claude, and Account signed in as harborline-platform on the Max plan">
</picture>

<sub>Screenshot from Goodboy 0.13.1</sub>

Find everything about a provider on its own page in **Providers & models**: **Usage** with the weekly window, **Models in the picker** with a switch per model, **Permissions**, and **Account** with **Sign in again** and **Disconnect**. Providers billed per token say so instead of showing usage windows.

### Update the provider CLI

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/setup-cli-update-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/setup-cli-update-light.webp" alt="The top of the Claude page with a banner reading Opus 5.5 needs a newer Claude CLI, You have Claude CLI 2.1.260, Update to 2.1.280 or newer, and an Update Claude CLI button">
</picture>

<sub>Screenshot from Goodboy 0.13.1</sub>

See when a model needs a newer CLI, right under the Account rows of the provider page, and press **Update Claude CLI** to install it. The update waits for running turns to finish. A turn the CLI refuses retries on the closest model in the same family.

### Permissions for each provider

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/setup-permissions-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/setup-permissions-light.webp" alt="Workspace Permissions in Settings: four default modes (Read only, Ask first, Edits allowed, Full access) and a table of what Claude, Codex, Cursor, Gemini and OpenCode family each do with them, marked Works, Partly, Runs Read only or Ignored, plus Rules and Role limits rows">
</picture>

<sub>Screenshot from Goodboy 0.13.1</sub>

Check which permission modes a provider can honor before you pick one: **Read only**, **Ask first**, **Edits allowed** and **Full access**. The table marks each cell as **Works**, **Partly** or **Runs Read only**, with the reason underneath, and adds a **Rules** row and a **Role limits** row. A mode a provider cannot honor never runs looser: **Ask first** on Codex runs as **Read only**. The default mode for new sessions sits above the table.

### Integrations

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/setup-integrations-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/setup-integrations-light.webp" alt="Settings under Integrations, 5 of 7 connected: GitHub, GitLab, Bitbucket, Linear, Jira, Sentry and Slack in the left list with a status dot each, and the Linear page open showing Connected as Dana R. on linear.app/harborline">
</picture>

<sub>Screenshot from Goodboy 0.13.1</sub>

Connect GitHub, GitLab, Bitbucket, Linear, Jira, Sentry and Slack from one page. The list shows the account behind each tool and how many are connected, and each tool opens to its own page. Give a project a different account than its workspace when you need to. Keys stay in your system credential store.

### About you

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/setup-about-you-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/setup-about-you-light.webp" alt="The About you section of workspace settings with four fields: Your roles (Tech Lead, Backend Engineer), About your work, How agents should work with you, and Explain more when it touches (Rust), with a See who reads what link">
</picture>

<sub>Screenshot from Goodboy 0.13.1</sub>

Tell agents once who you are and how you like to work, in four short parts: **Your job**, **About your work**, **How agents should work with you** and **Explain more when it touches**. **See who reads what** shows which role reads each part. Under **Explain more when it touches**, **Learned · 12 · Open** opens what agents explained about your topics in this workspace, grouped by topic, with the project and age of each one. A learning from a deleted session stays and says **Deleted session**.

### Settings

Find any setting from the sidebar: Settings takes it over with **Back to app**, a **Search settings** field and every page. **Settings** at the foot of the sidebar and **⌘,** open on the page you used last, or on General the first time after the app starts. The rail lists **App**, **Workspace**, **Providers & models** and **Integrations**, and a small dot marks a row that needs you, named by what is wrong. Every page is also in the palette, like **Settings: Storage**; a link that names a page opens that page. **Open with**, in General, picks the editor worktrees open in and the browser for links and artifacts. Drag the edge of a rail, or use the keys or a double click, to resize it, and each one remembers its width.

**Also in this area**

| Feature       | What it does for you                                           |
| ------------- | -------------------------------------------------------------- |
| Settings rail | Each settings area says what needs you, like folders not found |
