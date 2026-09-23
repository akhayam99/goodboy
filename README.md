<div align="center">

<img src=".github/readme-hero.png" alt="Goodboy, stop re-explaining yourself" width="880">

[![ci](https://img.shields.io/github/actions/workflow/status/akhayam99/goodboy/ci.yml?branch=main&style=flat-square&label=ci&labelColor=15181b)](https://github.com/akhayam99/goodboy/actions/workflows/ci.yml)
[![release](https://img.shields.io/github/v/release/akhayam99/goodboy?style=flat-square&label=release&labelColor=15181b&color=0e9aa4)](https://github.com/akhayam99/goodboy/releases/latest)
[![stars](https://img.shields.io/github/stars/akhayam99/goodboy?style=flat-square&label=stars&labelColor=15181b&color=3d444d)](https://github.com/akhayam99/goodboy/stargazers)
[![license](https://img.shields.io/badge/license-FSL--1.1--MIT-3d444d?style=flat-square&labelColor=15181b)](./LICENSE.md)

[Install](#install) &nbsp;·&nbsp; [Providers](#providers-and-quota) &nbsp;·&nbsp; [Concepts](./docs/concepts.md) &nbsp;·&nbsp; [Documentation](./docs/README.md) &nbsp;·&nbsp; [goodboy-ai.dev](https://goodboy-ai.dev)

<sub>Tauri 2 &nbsp;·&nbsp; React 19 &nbsp;·&nbsp; TypeScript &nbsp;·&nbsp; SQLite</sub>

</div>

<br>

Goodboy is a free, source-available desktop app for macOS and Linux that runs
coding agents on your work.

You describe a task once. The goal, the decisions and the running summary
belong to the task, not to a provider's chat.

Stop Claude halfway, hand the rest to Codex and come back tomorrow. Nobody
needs briefing again, and it all runs on the plan you already pay for.

<br>

## The board

Every task you start is a session, and all sessions sit on one board, grouped
by where they are: building, running, needs you, in review, done. Each card
shows the project, the pull request, the cost so far and the issues the task
came from, so you see at a glance which one is waiting on you.

![The Goodboy board for a workspace: cards under building, running, needs you and in review, some linked to a Linear, Sentry, Jira or GitHub issue, with the done and archived columns folded at the end](./docs/images/board-shell.png)

<br>

## Session overview

Open a session and the Overview shows everything about that task: the goal,
the decisions taken, a running summary, the linked issues and the
repositories it works on, each with its branch and pull request.

Below it, the Activity feed lists what happened, in order: every workflow
step, the agents it started, the plans and reports, the questions, the pull
requests opened and merged. Come back after a day and you know where things
stand without scrolling a chat.

![The Overview of a session: the goal with its decisions and summary, a GitHub, a Linear and a Sentry issue linked, two repositories with one branch merged and one in review, and an Activity feed where a finished workflow and a running one overlap, one step split into three agents and one of those handed its question to a fourth, with the wireframe, the plan, the report and a merged pull request in between](./docs/images/activity-run.png)

<br>

## Workflows

A workflow splits a task into steps, for example explore, plan, implement,
test. Each step runs as a new agent with a short brief and its own provider,
model and effort, so the exploring runs on a cheap model and the planning on
a strong one.

Pick a ready workflow, build your own, or describe the goal and let the
orchestrator choose the next step as the work goes.

![A workflow run in progress: four scouts on three different cheap models, a planner that asked for one provider and ran on another, an implementer done, a second implementer still running, and a tester queued](./docs/images/workflow-run.png)

<br>

## Branches and worktrees

Agents work in their own copy of the code, not in yours. Every repository a
session uses gets its own git worktree and branch, so several sessions run at
the same time without conflicts.

One session can work on more than one repository, and on more than one branch
of the same repository, each with its own pull request. From each row you
open a terminal, run a project script or open the code in your editor.

![The Projects section of a session: two repositories mounted, one with three branches of a pull request series and a merged one shown, each with its worktree, and the terminal, scripts and editor actions of a row](./docs/images/mounts.png)

<br>

## Plans, reports and wireframes

When an agent writes a plan, a report or a wireframe, Goodboy saves it as an
artifact with its own page instead of leaving it in the chat. The next agent
reads it, a newer version replaces it, and you can reopen or print it
whenever you want.

![The Artifacts studio: a rail grouping the session's plans, reports and wireframes, with a report open on the right](./docs/images/artifact-report.png)

<br>

## Questions from the agents

When an agent needs a decision, it asks you a question and the session moves
to needs you. Each question comes with suggested answers you can pick or
rewrite.

If you would rather not decide, let another agent answer it, with a hint from
you if you want. Its answer counts as yours.

![An open question from an agent with its suggested answers, a free-text field and a let an agent answer option, under the question it already answered](./docs/images/open-questions.png)

<br>

## Pull request review

The Review lens shows a pull request with its checks and every comment
thread. Send a comment to an agent: it fixes the code in a local commit and
drafts the reply. Nothing is pushed or posted until you approve it.

![The Resolve queue for a pull request: comment threads with their state, two replies ready to post, one question for you, one settled but not published](./docs/images/resolve.png)

<br>

## Providers and quota

<div align="center">
  <img src=".github/providers.png" alt="Claude, Codex, Cursor, Gemini, OpenCode, OpenRouter and Moonshot" width="860">
</div>

Claude, Cursor and Codex use the CLI login you already have, the others take
an API key. In settings you pick the default provider, the pool Goodboy can
switch between and the model for each kind of task.

Each provider can have a monthly cap. When one runs out, hits a rate limit or
goes down, the next turn moves to another provider in the pool, and the chat
tells you which one and why. [The provider guide](./docs/providers.md) covers
installation and what each provider does differently.

![The provider settings: seven providers with their connection state, the default provider, the routing pool Goodboy can pick from, and a model chosen per task](./docs/images/providers.png)

<br>

## Costs

The Impact studio tracks what the agents spend, per provider, per model and
per session, next to the monthly cap and the alert threshold. You see which
models are worth what they cost.

![The Impact studio: spend per provider and per session in the rail, one provider against its monthly cap and alert threshold, and its cost broken down by model](./docs/images/impact.png)

<br>

## Inbox

<div align="center">
  <img src=".github/integrations.png" alt="GitHub, GitLab, Bitbucket, Jira, Linear, Sentry and Slack" width="860">
</div>

Connect GitHub, GitLab, Bitbucket, Jira, Linear, Sentry or Slack, and the Inbox
lists their issues, pull requests, threads and errors in one place. Open an
item and start a session from it, with the goal already filled in from the
issue.

Agents can read from the same tools while they work, through the
[query bridge](./docs/query-bridge.md).

![The Inbox: issues, errors and threads from GitHub, Linear, Jira, Sentry and Slack in one list, a Linear issue open with its fields and description, and a launch box that starts a session from it](./docs/images/inbox.png)

<br>

## Chat

Every agent in a session has its own chat, for when you want to steer it
yourself. Plans show up as cards that open the full artifact, file edits are
grouped, and open questions appear inline, including the ones another agent
is answering for you.

![A session chat: the agent's plan as its own artifact, three files edited, a question answered by another agent and a second one an agent is answering right now, with the other sessions in the sidebar](./docs/images/chat-shell.png)

<br>

## Also in the box

- Terminal, Explore and Diff lenses on every session, one shortcut each
- A command palette for sessions, lenses and studios
- Open the worktree in VS Code or Cursor when you want to type yourself
- Pair a phone to follow a session away from the desk

<br>

## Install

On macOS:

```bash
brew install --cask akhayam99/tap/goodboy
```

Or take the `.dmg` from the
[latest release](https://github.com/akhayam99/goodboy/releases/latest) and drop
Goodboy in Applications. Linux releases ship as AppImage, `.deb` and `.rpm` on
the same page.

<br>

## Where your work lives

The task context, the settings and the usage records sit in SQLite on your
machine, and so does the routing that picks the next provider. Prompts go to
the provider you chose, and nothing else follows them.

[SECURITY.md](./SECURITY.md) has the detail. If Goodboy disappeared tomorrow
your data would be untouched, because it was never ours.

<br>

## Run from source

You need Node 20 or newer, pnpm 10.33.4 and a Rust toolchain.

```bash
pnpm install
pnpm tauri:dev
```

`pnpm tauri:build` produces a production build. The
[Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) list the
platform packages, and the [desktop notes](./apps/desktop/README.md) cover the
local loop.

<br>

## Documentation

Start at the [documentation index](./docs/README.md), which leads to
[concepts](./docs/concepts.md), [workflows](./docs/workflows.md),
[providers](./docs/providers.md), the [query bridge](./docs/query-bridge.md)
and [architecture](./docs/architecture.md).

<br>

## Contributors

[<img src=".github/contributor-akhayam99.png" width="56" height="56" alt="Amin Khayam">](https://github.com/akhayam99)
&nbsp;
[<img src=".github/contributor-teckperry.png" width="56" height="56" alt="Luca Laudiero">](https://github.com/teckperry)

Your face fits here too. Pick an
[issue](https://github.com/akhayam99/goodboy/issues), open a pull request, and
read [AGENTS.md](./AGENTS.md) and [CONVENTIONS.md](./CONVENTIONS.md) before you
start.

<br>

## Support Goodboy

The best support is using it.

- Run it on your real work
- Open an issue when something feels off
- Send a pull request
- Leave a star if it earns one

[![Star Goodboy on GitHub](https://img.shields.io/github/stars/akhayam99/goodboy?style=for-the-badge&logo=github&logoColor=white&label=%E2%AD%90%20Star%20Goodboy&labelColor=15181b&color=0e9aa4)](https://github.com/akhayam99/goodboy/stargazers)

<br>

## License

Source-available under [FSL-1.1-MIT](./LICENSE.md) © Amin Khayam. Use it for
your own projects or at work, just don't offer it, or something built on it,
as a competing product or service.
