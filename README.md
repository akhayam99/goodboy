<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./docs/readme/readme-hero-dark.webp">
  <img src="./docs/readme/readme-hero-light.webp" alt="Goodboy, stop re-explaining yourself" width="880">
</picture>

[![ci](https://img.shields.io/github/actions/workflow/status/akhayam99/goodboy/ci.yml?branch=main&style=for-the-badge&logo=githubactions&logoColor=white&label=ci&labelColor=15181b)](https://github.com/akhayam99/goodboy/actions/workflows/ci.yml)
[![release](https://img.shields.io/github/v/release/akhayam99/goodboy?style=for-the-badge&logo=github&logoColor=white&label=release&labelColor=15181b&color=0e9aa4)](https://github.com/akhayam99/goodboy/releases/latest)
[![stars](https://img.shields.io/github/stars/akhayam99/goodboy?style=for-the-badge&logo=github&logoColor=white&label=%E2%AD%90%20stars&labelColor=15181b&color=3d444d)](https://github.com/akhayam99/goodboy/stargazers)

[![Install](https://img.shields.io/badge/Install-0e9aa4?style=for-the-badge&logo=homebrew&logoColor=white)](#install)
[![Features](https://img.shields.io/badge/Features-15181b?style=for-the-badge)](./FEATURES.md)
[![Providers](https://img.shields.io/badge/Providers-15181b?style=for-the-badge)](./docs/providers.md)
[![Concepts](https://img.shields.io/badge/Concepts-15181b?style=for-the-badge)](./docs/concepts.md)
[![Documentation](https://img.shields.io/badge/Documentation-15181b?style=for-the-badge)](./docs/README.md)
[![goodboy-ai.dev](https://img.shields.io/badge/goodboy--ai.dev-15181b?style=for-the-badge)](https://goodboy-ai.dev)

![Tauri 2](https://img.shields.io/badge/Tauri%202-15181b?style=for-the-badge&logo=tauri&logoColor=24C8DB)
![React 19](https://img.shields.io/badge/React%2019-15181b?style=for-the-badge&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-15181b?style=for-the-badge&logo=typescript&logoColor=3178C6)
![SQLite](https://img.shields.io/badge/SQLite-15181b?style=for-the-badge&logo=sqlite&logoColor=0F80CC)

</div>

<br>

Goodboy started as a free desktop app for coding agents, on **macOS** and **Linux**. It grew into an ADE, an agentic development environment: agents from the providers you connect do the work, and Goodboy gives that work its structure.

The idea is small. A task keeps its own goal, decisions and summary, so the agents working on it do not need the story told twice. Here is what happens when you hand it one.

<br>

## The board

You pick an issue from Linear. Goodboy drafts a title and a goal from it, and the task lands on the **board** as a session. From there the board moves it for you, between **building**, **running**, **needs you** and **in review**, with done work folded to the side, as the work changes. Each card shows its pull request and what it has cost so far.

Tasks come from the tools you connect: [GitHub, GitLab, Bitbucket, Jira, Linear, Sentry and Slack](https://github.com/akhayam99/goodboy/blob/main/FEATURES.md#supported-tools). Or press **New** to pick up a task, run a workflow or ask an agent, or to [start blank](https://github.com/akhayam99/goodboy/blob/main/FEATURES.md#start-blank) and add the goal later.

[See how it works →](https://github.com/akhayam99/goodboy/blob/main/FEATURES.md#the-board)

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./docs/readme/s01-board-dark.webp">
  <img src="./docs/readme/s01-board-light.webp" alt="The Harborline board: eleven sessions across building, running, needs you and in review, with the webhook fix in review on pull request 318 at $3.47">
</picture>

<br>

## Workflows

A **workflow** splits the task into steps, and each step is a fresh agent with a short brief. In **Orchestrated** mode a model picks the next step after each one finishes and writes down why. The same builder opens from **New**, so the session and its run start together.

That is also where the money goes. In the run below, a scout read the posting path for two cents. The planner spent $1.28, because that is the step that has to think. Want to steer? Queue a hint for the next decision, or have the orchestrator read it now.

[See how it works →](https://github.com/akhayam99/goodboy/blob/main/FEATURES.md#workflows)

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./docs/readme/s04-workflow-run-dark.webp">
  <img src="./docs/readme/s04-workflow-run-light.webp" alt="An orchestrated run with scouts, a planner, two implementers and a tester, each on its own model with its own cost, a hint waiting for the next decision, and a short recap">
</picture>

<br>

## Shared context

Every agent on the task reads the same **goal**, the numbered **decisions** and a **summary** that updates after each turn. Decisions Goodboy records keep why they were made, shown right under them in the context drawer. When the plan changes its mind, the new decision says what it replaced and why, and the next agent starts from there. Open any agent and **View as sent** shows the exact text it received.

Claude runs out halfway through? With another eligible provider connected, the turn can move there, and the chat says where it went. The top bar shows how much of your Claude and Codex plans is left before you start.

[See how it works →](https://github.com/akhayam99/goodboy/blob/main/FEATURES.md#shared-context)

<img src=".github/providers.png" alt="Claude, Cursor, Codex, Gemini, OpenCode, OpenRouter and Moonshot" width="880">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./docs/readme/s08-context-dark.webp">
  <img src="./docs/readme/s08-context-light.webp" alt="An implementer's brief as sent to Codex next to the Context drawer, where decision 3 replaced decision 1 with its reason">
</picture>

<br>

## Pull request review

The review comes back with seven comments. Select them and press **Resolve**. An agent writes each fix as a local commit and drafts the reply in your voice, and you approve it, send it back, or mark it **Will not fix**. One more action pushes the fixes, posts the replies and resolves the threads on GitHub.

[See how it works →](https://github.com/akhayam99/goodboy/blob/main/FEATURES.md#resolve)

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./docs/readme/s12-resolve-dark.webp">
  <img src="./docs/readme/s12-resolve-light.webp" alt="Seven review comments on pull request 318 grouped by file, with replies ready to review, one fix committed and one comment waiting for an answer">
</picture>

<br>

## Chat

Every agent still has its own chat when you want to steer by hand. Type while it works and your message waits for its turn, or send it now and interrupt. Restart Goodboy or install an update, and the agents that were working pick up where they stopped.

The inbox, plans and wireframes, history rewriting, storage cleanup, security findings and the rest are in [FEATURES.md](./FEATURES.md), with screenshots. Something broke? Press **⌘I** in the app and report it in one line. [goodboy-ai.dev](https://goodboy-ai.dev) tells the story in a minute.

[See how it works →](https://github.com/akhayam99/goodboy/blob/main/FEATURES.md#agents-and-chat)

<br>

## Install

On **macOS**, with Homebrew:

```bash
brew install --cask akhayam99/tap/goodboy
```

Or pick a package from the [latest release](https://github.com/akhayam99/goodboy/releases/latest):

- **macOS**: the `.dmg`, then drop Goodboy in Applications
- **Linux**: `AppImage`, `.deb` or `.rpm`

[See how it works →](https://github.com/akhayam99/goodboy/blob/main/FEATURES.md#set-up)

<br>

<a id="where-your-work-lives"></a>

## Privacy

- Tasks, decisions, settings and usage records stay on your computer, in `~/.goodboy`
- Prompts go to the provider you chose
- Tool keys go in your system credential store
- No account, and no Goodboy server

[See how it works →](https://github.com/akhayam99/goodboy/blob/main/FEATURES.md#security-backup-and-updates)

<br>

## Run from source

You need **Node 22** or newer, **pnpm 10.33.4** and a **Rust** toolchain.

```bash
pnpm install
pnpm tauri:dev
```

- `pnpm tauri:build` produces a production build
- The [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) list the platform packages
- The [desktop notes](./apps/desktop/README.md) cover the local loop

<br>

## Documentation

Start at the [documentation index](./docs/README.md). From there:

- [Concepts](./docs/concepts.md): sessions, workspaces, projects and how they fit
- [Workflows](./docs/workflows.md): steps, the orchestrator and hands-free runs
- [Providers](./docs/providers.md): installation and sign-in for each one
- [Query bridge](./docs/query-bridge.md): how agents read from your tools
- [Architecture](./docs/architecture.md): how the app is built

<br>

## Contributors

[<img src=".github/contributor-akhayam99.png" width="56" height="56" alt="Amin Khayam">](https://github.com/akhayam99)
&nbsp;
[<img src=".github/contributor-teckperry.png" width="56" height="56" alt="Luca Laudiero">](https://github.com/teckperry)
&nbsp;
[<img src=".github/contributor-lucapav01.png" width="56" height="56" alt="LucaPav01">](https://github.com/LucaPav01)

<br>

## Support Goodboy

The best support is using it.

- Run it on your real work
- Open an [issue](https://github.com/akhayam99/goodboy/issues) when something feels off
- Send a pull request
- Leave a star if it earns one

[![Star Goodboy on GitHub](https://img.shields.io/github/stars/akhayam99/goodboy?style=for-the-badge&logo=github&logoColor=white&label=%E2%AD%90%20Star%20Goodboy&labelColor=15181b&color=0e9aa4)](https://github.com/akhayam99/goodboy/stargazers)
