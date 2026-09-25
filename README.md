<div align="center">

<img src=".github/readme-hero.png" alt="Goodboy, stop re-explaining yourself" width="880">

[![ci](https://img.shields.io/github/actions/workflow/status/akhayam99/goodboy/ci.yml?branch=main&style=for-the-badge&logo=githubactions&logoColor=white&label=ci&labelColor=15181b)](https://github.com/akhayam99/goodboy/actions/workflows/ci.yml)
[![release](https://img.shields.io/github/v/release/akhayam99/goodboy?style=for-the-badge&logo=github&logoColor=white&label=release&labelColor=15181b&color=0e9aa4)](https://github.com/akhayam99/goodboy/releases/latest)
[![stars](https://img.shields.io/github/stars/akhayam99/goodboy?style=for-the-badge&logo=github&logoColor=white&label=%E2%AD%90%20stars&labelColor=15181b&color=3d444d)](https://github.com/akhayam99/goodboy/stargazers)
[![license](https://img.shields.io/badge/license-FSL--1.1--MIT-3d444d?style=for-the-badge&labelColor=15181b)](./LICENSE.md)

[![Install](https://img.shields.io/badge/Install-0e9aa4?style=for-the-badge&logo=homebrew&logoColor=white)](#install)
[![Providers](https://img.shields.io/badge/Providers-15181b?style=for-the-badge)](#providers-and-quota)
[![Concepts](https://img.shields.io/badge/Concepts-15181b?style=for-the-badge)](./docs/concepts.md)
[![Documentation](https://img.shields.io/badge/Documentation-15181b?style=for-the-badge)](./docs/README.md)
[![goodboy-ai.dev](https://img.shields.io/badge/goodboy--ai.dev-15181b?style=for-the-badge)](https://goodboy-ai.dev)

![Tauri 2](https://img.shields.io/badge/Tauri%202-15181b?style=for-the-badge&logo=tauri&logoColor=24C8DB)
![React 19](https://img.shields.io/badge/React%2019-15181b?style=for-the-badge&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-15181b?style=for-the-badge&logo=typescript&logoColor=3178C6)
![SQLite](https://img.shields.io/badge/SQLite-15181b?style=for-the-badge&logo=sqlite&logoColor=0F80CC)

</div>

<br>

Goodboy is a free, source-available desktop app for **macOS** and **Linux** that
runs coding agents on your work.

You describe a task once. The goal, the decisions and the running summary
belong to the task, not to a provider's chat.

Stop Claude halfway, hand the rest to Codex and come back tomorrow. Nobody
needs briefing again, and it all runs on the plan you already pay for.

<br>

## The board

Every task you start is a **session**, and every session sits on one board.

- Columns follow where each task is: **building**, **running**, **needs you**, **in review**, **done**
- Each card shows the project, the pull request, the cost so far and the issues the task came from
- The **needs you** column is where a task waits for your answer

![The Goodboy board for a workspace: cards under building, running, needs you and in review, one with an open question and some linked to a Linear, Sentry, Jira or GitHub issue, with the done and archived columns folded at the end](./docs/images/board-shell.png)

<br>

## Session overview

Open a session and the **Overview** holds everything about that task.

- The goal, the decisions taken and a running summary
- The issues it is linked to, from GitHub, Linear, Sentry and the other tools
- Every repository it works on, with its branch and pull request

Below it, **Activity** draws the work as one tree: numbered steps growing from the bottom, with the agents they started, the plans, the questions and the pull requests on one timeline.

- Every step shows its provider, model and effort in the same columns, with its time and cost once it has them
- Once Goodboy has timed enough similar steps, a running step fills a ring with the time it has left
- A step waiting on you, a failed one and a queued one look different at a glance, and the next thing to do sits on top
- Click the colored line to open a workflow, click a row to open that agent, question or artifact

Come back after a day and you know where things stand.

![The Overview of a session: the goal with its decisions and summary, a GitHub, a Linear and a Sentry issue linked, two repositories with branches in review and one merged, and an Activity tree with a suggested next step, numbered steps showing model, effort, time left and cost, a question waiting for an answer and a workflow on its own line](./docs/images/activity-run.png)

<br>

## Workflows

A **workflow** splits a task into steps, for example explore, plan, implement, test.

- Each step runs as a new agent with a short brief
- Each step has its own provider, model and effort: explore on a cheap model, plan on a strong one
- Pick a ready workflow, build your own, or let the **orchestrator** choose the next step as the work goes

The builder shows the plan as the tree it will become, with an estimate of how long it takes once your workspace has enough timed steps. **Orchestrated** comes first and adds agents one at a time. In a custom or preset plan you change each step's provider, model, effort, role and instructions in place. Autorun is one switch, and runs show a readable name instead of the raw goal.

![The workflow builder on Orchestrated: the goal, an example of the steps the orchestrator will pick, its model, optional guidance, and the start, autorun and spend cap controls](./docs/images/workflow-builder.png)

A running workflow reads like Activity, with a box on top to tell the orchestrator something before its next decision.

![A workflow run in progress: four scouts on three different cheap models, a planner and an implementer done, a second implementer running on another provider, and a tester queued, each with its model, effort and cost](./docs/images/workflow-run.png)

<br>

## Branches and worktrees

Agents work in their own copy of the code, not in yours.

- Every repository a session uses gets its own git worktree and branch
- Several sessions run at the same time without conflicts
- One session can work on more repositories, and on more branches of the same one, each with its own pull request
- From each row you open a terminal, run a project script or open the code in your editor

![The Overview of a session: its decisions and summary, a ledger-core repository with three branches of a six part pull request series, one merged and one with its files kept, a notify-relay branch in review with its terminal and script actions, and pull requests opened and merged in Activity](./docs/images/mounts.png)

<br>

## Plans, reports and wireframes

When an agent writes a **plan**, a **report** or a **wireframe**, Goodboy saves it as an artifact with its own page.

- The next agent reads it instead of scrolling a chat
- A plan waits for you to run it, and says so, then stays in the list with the agent that ran it
- Filter by plans, reports or wireframes, and reopen or print any of them whenever you want

![The Artifacts tab of a session filtered to plans: one active plan ready for the next agent and two consumed plans below it](./docs/images/artifacts-lens-shell.png)

<br>

## Questions from the agents

When an agent needs a decision, it asks you, and the session moves to **needs you**.

- Every question comes with suggested answers you can pick or rewrite
- Choose **let an agent answer** to hand it to another agent, with a hint if you want
- The agent's answer counts as yours

![The Questions tab of a session: one open question with two answers already picked and the option to let an agent answer, and four answered questions below, one of them answered by an agent](./docs/images/open-questions.png)

<br>

## Pull request review

The **Review** tab shows a pull request with its checks and every comment thread.

- Send a comment to an agent: it fixes the code in a local commit and drafts the reply
- Each thread is marked: a question for you, a reply ready, a comment that changed
- Nothing is pushed or posted until you approve it

![The Review tab of a session: comment threads on a pull request marked as a question for you, a changed comment and two replies ready, with the push and resolve action at the bottom](./docs/images/resolve-queue-shell.png)

<br>

## Providers and quota

<div align="center">
  <img src=".github/providers.png" alt="Claude, Codex, Cursor, Gemini, OpenCode, OpenRouter and Moonshot" width="860">
</div>

Each provider signs in the way its own tool does.

- **Claude**, **Cursor** and **Codex**: the CLI login you already have
- **Gemini**: the Antigravity app
- **OpenCode**: its own login
- **OpenRouter** and **Moonshot**: an API key

In **Settings** you pick the default provider, the pool Goodboy can switch between and the model for each kind of task. Each provider can have a monthly cap: when one runs out, hits a rate limit or goes down, the next turn moves to another provider in the pool, and the chat tells you which one and why.

When a model needs a newer CLI than the one you have, Goodboy shows both versions and an update button, in Providers and in the chat.

[The provider guide](./docs/providers.md) covers installation and what each provider does differently.

![Settings, Providers and models: the seven providers with their connection state, Claude marked as needing a CLI update, the default provider, the routing pool and the model picked for each task](./docs/images/providers.png)

<br>

## Costs

The **Impact** studio tracks what the agents spend.

- Split by provider, by model and by session
- Next to the monthly cap and the alert threshold
- So you see which models are worth what they cost

![The Impact page: spend per provider and per session in the rail, one provider against its monthly cap and alert threshold, and its cost broken down by model](./docs/images/impact.png)

<br>

## Inbox

<div align="center">
  <img src=".github/integrations.png" alt="GitHub, GitLab, Bitbucket, Jira, Linear, Sentry and Slack" width="860">
</div>

Connect your tools and the **Inbox** lists their issues, pull requests, threads and errors in one place.

- Filter by tool or by kind
- Open an item and read it without leaving Goodboy
- Start a session from an item and Goodboy drafts a short title and goal, with a link back to it
- Keep the brief, edit it, or go back to the issue text before you press **Launch session**

Agents read from the same tools while they work, through the [query bridge](./docs/query-bridge.md).

![The Inbox: issues, errors and threads from GitHub, Linear, Jira, Sentry and Slack in one list, a Linear issue open with its fields and description, and a launch box holding the brief drafted from it: a title, a goal and when it counts as done](./docs/images/inbox.png)

<br>

## Notifications

The bell collects what Goodboy needs you to know: a step that failed, a session close to its cap, a pull request opened.

- One compact row each, with its action next to it
- Filters for unread, needs action, severity and source, each with its count
- **This workspace** by default, every workspace one click away
- **j** and **k** move through the list, **e** dismisses

![Notifications: six compact rows, two with an action button, filters by view, severity and source with their counts, a switch between this workspace and all of them, and the keys to move, act and dismiss](./docs/images/notifications.png)

<br>

## Chat

Every agent in a session has its own chat, for when you want to steer it yourself.

- Plans show up as cards that open the full artifact
- File edits are grouped under one row
- Open questions appear inline, including the ones another agent is answering for you

![A session chat: the agent's plan as its own card, three file edits under one row, a question answered by another agent and a blocking one an agent is answering right now](./docs/images/chat-shell.png)

<br>

## Also in the box

- **Terminal**, **Explore** and **Diff** tabs on every session, one shortcut each
- A **command palette** for sessions, tabs and pages
- Open the worktree in **VS Code** or **Cursor** when you want to type yourself
- Pair a **phone** to follow a session away from the desk

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

## Where your work lives

Everything Goodboy knows about your work stays on your machine.

- Task context, settings and usage records live in SQLite, in `~/.goodboy`
- The routing that picks the next provider runs locally too
- Prompts go to the provider you chose, and nothing else follows them

If Goodboy disappeared tomorrow your data would be untouched, because it was
never ours. [SECURITY.md](./SECURITY.md) has the detail.

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

<br>

## License

Source-available under [FSL-1.1-MIT](./LICENSE.md) © Amin Khayam. Use it for
your own projects or at work, just don't offer it, or something built on it,
as a competing product or service.
