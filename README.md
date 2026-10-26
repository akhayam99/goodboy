<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./docs/readme/readme-hero-dark.webp">
  <img src="./docs/readme/readme-hero-light.webp" alt="Goodboy with the Harborline session Stop retried webhooks posting a second credit open on its Overview: the Projects card lists payments-api and notify-relay with their branches, one branch unfolded to its pull request, comments, files with a diff stat and checks; the Activity timeline interleaves three runs on Claude, Codex and Cursor models; the shared Context drawer shows the decisions that changed; the top bar shows the Repositories entry, provider limits and two sessions that need you" width="880">
</picture>

<sub>Screenshot from Goodboy 0.27.1</sub>

[![ci](https://img.shields.io/github/actions/workflow/status/akhayam99/goodboy/ci.yml?branch=main&style=for-the-badge&logo=githubactions&logoColor=white&label=ci&labelColor=15181b)](https://github.com/akhayam99/goodboy/actions/workflows/ci.yml)
[![release](https://img.shields.io/github/v/release/akhayam99/goodboy?style=for-the-badge&logo=github&logoColor=white&label=release&labelColor=15181b&color=0e9aa4)](https://github.com/akhayam99/goodboy/releases/latest)
[![stars](https://img.shields.io/github/stars/akhayam99/goodboy?style=for-the-badge&logo=github&logoColor=white&label=%E2%AD%90%20stars&labelColor=15181b&color=3d444d)](https://github.com/akhayam99/goodboy/stargazers)

![Tauri 2](https://img.shields.io/badge/Tauri%202-15181b?style=for-the-badge&logo=tauri&logoColor=24C8DB)
![React 19](https://img.shields.io/badge/React%2019-15181b?style=for-the-badge&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-15181b?style=for-the-badge&logo=typescript&logoColor=3178C6)
![SQLite](https://img.shields.io/badge/SQLite-15181b?style=for-the-badge&logo=sqlite&logoColor=0F80CC)

</div>

<br>

Goodboy runs coding agents side by side on your own repositories, one session for each goal. It is a desktop app for **macOS** and **Linux**.

[**Features →**](./FEATURES.md)&emsp;[Privacy](#privacy)&emsp;[Install](#install)&emsp;[Run from source](#run-from-source)&emsp;[Documentation](#documentation)&emsp;[Contributors](#contributors)&emsp;[Support](#support-goodboy)

<br>

## The board

Every task is a session, and the board shows where each one stands. Six lanes, **Building**, **Running**, **Needs you**, **In review**, **Done** and **Archived**, sit in that order. A session moves to the lane that matches what is happening in it, and the ones that wait for you sit in **Needs you**.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/board-stage-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/board-stage-light.webp" alt="The Harborline board with its sessions in six lanes, from Building to Archived">
</picture>

<sub>Screenshot from Goodboy 0.27.1</sub>

## Workflows

A workflow splits a task into steps, such as scout, plan, implement and review. Each step is its own agent with its own role, model and effort, and it starts from a short brief. You choose how much it asks you and how much it may spend.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workflow-run-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workflow-run-light.webp" alt="A workflow run with three steps, the second one open with its conversation">
</picture>

<sub>Screenshot from Goodboy 0.27.1</sub>

## Shared context

What one agent learns, the next one reads. The goal, decisions and a running summary travel with the session, so a new agent starts informed and nobody tells the story twice.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/context-drawer-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/context-drawer-light.webp" alt="The Context drawer of a session with its decisions and what changed since you last looked">
</picture>

<sub>Screenshot from Goodboy 0.27.1</sub>

## Pull request review

The **Branch** page holds one branch: its pull request, review comments, changed files, commits and checks. Check the comments you want and press **Fix**, and an agent turns them into commits in its own copy of the branch. Nothing leaves your machine until you push. It works on GitHub, GitLab and Bitbucket.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/review-pr-page-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/review-pr-page-light.webp" alt="The Pull request tab of the Branch page with its state, checks and readiness">
</picture>

<sub>Screenshot from Goodboy 0.27.1</sub>

## Chat

Ask about your repos without starting a session. **Chat** reads every project and never changes a file. When an answer is worth acting on, **Start work from chat** starts a session from it.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/agents-workspace-chat-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/agents-workspace-chat-light.webp" alt="Chat in Harborline with the answer to a question about three payments-api files">
</picture>

<sub>Screenshot from Goodboy 0.27.1</sub>

## Features

The [feature guide](./FEATURES.md) lists the main features of each area, with a page per area for the rest. [goodboy-ai.dev](https://goodboy-ai.dev) tells the same story in a minute.

<br>

<a id="where-your-work-lives"></a>

## Privacy

- Tasks, decisions, settings and usage records stay on your computer, in `~/.goodboy`
- Prompts go to the provider you chose
- Tool keys go in your system credential store
- No account, and no Goodboy server

[What leaves your machine](./SECURITY.md#your-data) lists every request Goodboy makes.

<br>

## Install

On **macOS**, with Homebrew:

```bash
brew install --cask akhayam99/tap/goodboy
```

Or pick a package from the [latest release](https://github.com/akhayam99/goodboy/releases/latest):

- **macOS**: the `.dmg`, then drop Goodboy in Applications
- **Linux**: `AppImage`, `.deb` or `.rpm`

Goodboy runs the agents you already pay for: Claude, Codex, Cursor and four more. You sign in to each from the app, or paste its key, and keys stay in your system's password store.

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

Start with the page for what you want to do:

- [Your first task](./docs/first-session.md): from install to a merged pull request
- [Concepts](./docs/concepts.md): sessions, workspaces, projects and how they fit
- [Providers](./docs/providers.md): installation and sign-in for each one
- [Workflows](./docs/workflows.md): steps, the orchestrator and hands-free runs
- [Keyboard shortcuts](./docs/features/keyboard.md): every chord, by area
- [Where your data lives](./SECURITY.md#your-data): what stays on your computer and what leaves it
- [Query bridge](./docs/query-bridge.md): how agents read from your tools
- [Walkthroughs](./docs/walkthroughs/fix-a-failing-check.md): fix a failing check, comment on a plan, review with comments in place

Working on Goodboy? Start at the [contributor map](./docs/README.md), then read [Architecture](./docs/architecture.md).

<br>

## Contributors

[<img src=".github/contributor-akhayam99.png" width="56" height="56" alt="Amin Khayam">](https://github.com/akhayam99)
&nbsp;
[<img src=".github/contributor-teckperry.png" width="56" height="56" alt="Luca Laudiero">](https://github.com/teckperry)
&nbsp;
[<img src=".github/contributor-lucapav01.png" width="56" height="56" alt="LucaPav01">](https://github.com/LucaPav01)
&nbsp;
[<img src=".github/contributor-samux01.png" width="56" height="56" alt="Samuele">](https://github.com/Samux01)
&nbsp;
[<img src=".github/contributor-stefanozanini.png" width="56" height="56" alt="Stefano Zanini">](https://github.com/stefanozanini)

<br>

## Support Goodboy

The best support is using it.

- Run it on your real work
- Press **⌘I** in the app when something feels off, or you have an idea
- Open an [issue](https://github.com/akhayam99/goodboy/issues)
- Send a pull request
- Leave a star if it earns one

[![Star Goodboy on GitHub](https://img.shields.io/github/stars/akhayam99/goodboy?style=for-the-badge&logo=github&logoColor=white&label=%E2%AD%90%20Star%20Goodboy&labelColor=15181b&color=0e9aa4)](https://github.com/akhayam99/goodboy/stargazers)
