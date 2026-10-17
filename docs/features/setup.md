# Set up

Get from install to a first agent. Connect a provider, check what it can do, link your tools and tell agents who you are.

### Welcome to Goodboy

Five short steps take you from install to a first agent reading your project: **Provider**, **Project**, **Code host**, **Tasks** and **First session**. Code host and tasks are optional, and **Skip setup** takes you straight in. The last step hands you a session draft already filled in.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/setup-welcome-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/setup-welcome-light.webp" alt="The Welcome to Goodboy screen: a Setup stepper with Provider, Project, Code host, Tasks and First session, the line Five short steps, then an agent reads your project, four rows with their time, and a Get started button">
</picture>

<sub>Screenshot from Goodboy 0.27.1</sub>

### Provider connection

Connect the provider you already pay for, with a login or an API key. Each card says where it stands, such as **Connected** or **Not signed in**, and **Connect** walks you through the sign-in. You can add more providers later.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/setup-provider-connection-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/setup-provider-connection-light.webp" alt="The Provider step of setup: Claude marked Connected, Cursor Not signed in with a Connect button, Codex with an Error status and a Connect button, and Gemini Not installed with a Set up manually button, above Back and Continue">
</picture>

<sub>Screenshot from Goodboy 0.27.1</sub>

### One page per provider

Each provider has its own page in **Providers & models** with its usage, the models shown in the picker, its permissions and your account. Providers billed per token say so instead of showing usage windows.

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

Connect GitHub, GitLab, Bitbucket, Linear, Jira, Sentry and Slack from one page, and see the account behind each. A project can use a different account than its workspace. Keys stay in your system credential store.

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
