<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./docs/readme/readme-hero-dark.webp">
  <img src="./docs/readme/readme-hero-light.webp" alt="Goodboy, a development environment that structures agent work: the overview of a Harborline session with its tasks by stage, its projects and its pull requests" width="880">
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

Goodboy is a desktop app for coding agents, on **macOS** and **Linux**. Connect the providers you already use, Claude, Codex, Cursor and four more, point it at your repos, and hand it a task. Each task becomes a session that keeps its own goal, decisions and summary, so every agent that works on it starts briefed and nobody tells the story twice.

<br>

## For developers

Inside a session every chat has one job. A scout reads the code on a light model, a planner decides on a strong one, implementers write and a tester checks. Agents work in their own copy of each repo, so your checkout stays yours, and a task that spans payments-api and notify-relay gets a branch and a pull request in each.

Five tasks in flight? The activity bar keeps each one where you left it, and **⌘K** and **⌘F** take you anywhere. Review comments from GitHub, GitLab or Bitbucket come back as commits, several fixed side by side, with the reply drafted in your voice, and a messy branch gets tidied by dragging its commits around. When you only want an answer, **Chat** reads every project of the workspace without changing a file, and one press turns the answer into a session.

<br>

## For leads and project managers

The board shows where every task stands, **building**, **running**, **needs you** or **in review**, with its pull request and what it has cost so far. Work starts from Linear, Jira, GitHub, GitLab, Bitbucket, Sentry or Slack with the brief already drafted, and plans and decisions are written down next to the task instead of lost in a chat. Set a monthly cap per provider and Goodboy warns you before you cross it, not after.

<br>

## Install

On **macOS**, with Homebrew:

```bash
brew install --cask akhayam99/tap/goodboy
```

Or pick a package from the [latest release](https://github.com/akhayam99/goodboy/releases/latest):

- **macOS**: the `.dmg`, then drop Goodboy in Applications
- **Linux**: `AppImage`, `.deb` or `.rpm`

<br>

## Features

Every feature, with pictures, is in [FEATURES.md](./FEATURES.md). [goodboy-ai.dev](https://goodboy-ai.dev) tells the same story in a minute.

<br>

<a id="where-your-work-lives"></a>

## Privacy

- Tasks, decisions, settings and usage records stay on your computer, in `~/.goodboy`
- Prompts go to the provider you chose
- Tool keys go in your system credential store
- No account, and no Goodboy server

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
- Press **⌘I** in the app when something feels off, or you have an idea
- Open an [issue](https://github.com/akhayam99/goodboy/issues)
- Send a pull request
- Leave a star if it earns one

[![Star Goodboy on GitHub](https://img.shields.io/github/stars/akhayam99/goodboy?style=for-the-badge&logo=github&logoColor=white&label=%E2%AD%90%20Star%20Goodboy&labelColor=15181b&color=0e9aa4)](https://github.com/akhayam99/goodboy/stargazers)
