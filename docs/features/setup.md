# Set up

Get from install to a first agent. Connect a provider, check what it can do, link your tools and tell agents who you are.

### Welcome to Goodboy

Five short steps take you from install to a first agent reading your project: **Provider**, **Project**, **Code host**, **Tasks** and **First session**. Code host and tasks are optional, and **Skip setup** takes you straight in. The last step hands you a session draft already filled in.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/setup-welcome-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/setup-welcome-light.webp" alt="The Welcome to Goodboy screen: a Setup stepper with Provider, Project, Code host, Tasks and First session, the line Five short steps, then an agent reads your project, four rows with their time, and a Get started button">
</picture>

<sub>Screenshot from Goodboy 0.13.1</sub>

### Provider connection

Connect the provider you already pay for, with a login or an API key. Each card says where it stands, such as **Connected** or **Not signed in**, and **Connect** walks you through the sign-in. You can add more providers later.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/setup-provider-connection-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/setup-provider-connection-light.webp" alt="The Provider step of setup: Claude marked Connected, Cursor Not signed in with a Connect button, Codex with an Error status and a Connect button, and Gemini Not installed with a Set up manually button">
</picture>

<sub>Screenshot from Goodboy 0.13.1</sub>

### One page per provider

Each provider has its own page in **Providers & models** with its usage, the models shown in the picker, its permissions and your account. Providers billed per token say so instead of showing usage windows.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/setup-provider-page-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/setup-provider-page-light.webp" alt="The Claude page in Settings under Providers and models: Usage with a Weekly bar at 84% used, Models in the picker showing Haiku, Sonnet, Opus and Fable, Permissions with Claude, and Account signed in as harborline-platform on the Max plan">
</picture>

<sub>Screenshot from Goodboy 0.13.1</sub>

### Update the provider CLI

When a model needs a newer provider CLI, the provider page says so and one button installs it. The update waits for running turns to finish.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/setup-cli-update-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/setup-cli-update-light.webp" alt="The top of the Claude page with a banner reading Opus 5.5 needs a newer Claude CLI, You have Claude CLI 2.1.260, Update to 2.1.280 or newer, and an Update Claude CLI button">
</picture>

<sub>Screenshot from Goodboy 0.13.1</sub>

### Permissions for each provider

See which permission modes a provider can honor before you pick one, from **Read only** to **Full access**. A mode a provider cannot honor never runs looser: it falls back to a stricter one and the table says why.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/setup-permissions-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/setup-permissions-light.webp" alt="Workspace Permissions in Settings: four default modes (Read only, Ask first, Edits allowed, Full access) and a table of what Claude, Codex, Cursor, Gemini and OpenCode family each do with them, marked Works, Partly, Runs Read only or Ignored, plus Rules and Role limits rows">
</picture>

<sub>Screenshot from Goodboy 0.13.1</sub>

### Integrations

Connect GitHub, GitLab, Bitbucket, Linear, Jira, Sentry and Slack from one page, and see the account behind each. A project can use a different account than its workspace. Keys stay in your system credential store.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/setup-integrations-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/setup-integrations-light.webp" alt="Settings under Integrations, 5 of 7 connected: GitHub, GitLab, Bitbucket, Linear, Jira, Sentry and Slack in the left list with a status dot each, and the Linear page open showing Connected as Dana R. on linear.app/harborline">
</picture>

<sub>Screenshot from Goodboy 0.13.1</sub>

### About you

Tell agents once who you are and how you like to work, in four short fields. **See who reads what** shows which agent role reads each part, and **Explanations** collects what agents explained to you about your topics.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/setup-about-you-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/setup-about-you-light.webp" alt="The About you section of workspace settings with four fields: Your roles (Tech Lead, Backend Engineer), About your work, How agents should work with you, and Explain more when it touches (Rust), with a See who reads what link">
</picture>

<sub>Screenshot from Goodboy 0.13.1</sub>

### Settings

Settings opens from the foot of the sidebar or with **⌘,**, on the page you used last. **Search settings** finds any setting, every page is also in the command palette, and a dot marks a page that needs you.

**Also in this area**

| Feature       | What it does for you                                           |
| ------------- | -------------------------------------------------------------- |
| Settings rail | Each settings area says what needs you, like folders not found |
