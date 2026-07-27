<div align="center">

<img src=".github/readme-banner.png" alt="Goodboy, stop re-explaining yourself" width="760" />

[![ci](https://img.shields.io/github/actions/workflow/status/akhayam99/goodboy/ci.yml?branch=main&label=ci)](https://github.com/akhayam99/goodboy/actions/workflows/ci.yml)
[![release](https://img.shields.io/github/v/release/akhayam99/goodboy?label=release&color=06b6d4)](https://github.com/akhayam99/goodboy/releases/latest)
[![stars](https://img.shields.io/github/stars/akhayam99/goodboy?label=stars&color=06b6d4)](https://github.com/akhayam99/goodboy/stargazers)
[![providers](https://img.shields.io/badge/providers-Claude%20%C2%B7%20Cursor%20%C2%B7%20Codex%20%C2%B7%20Gemini%20%C2%B7%20OpenCode%20%C2%B7%20OpenRouter-06b6d4)](#providers)
[![platform](https://img.shields.io/badge/macOS-Intel%20%26%20Apple%20Silicon-111111)](#install)
[![license](https://img.shields.io/github/license/akhayam99/goodboy?color=06b6d4)](./LICENSE)

<img src=".github/readme-integrations.png" alt="Integrates with GitHub, GitLab, Linear and Sentry" width="480" />

[Install](#install) · [Providers](#providers) · [Vision](./VISION.md) · [Design](./DESIGN.md) · [goodboy-ai.dev](https://goodboy-ai.dev)

</div>

<img width="3972" height="2234" alt="Goodboy desktop app" src="https://github.com/user-attachments/assets/4708c589-a8e6-4f6c-a80a-222b32cc237e" />

You have a repo. You have a goal. You also have four CLIs open in four
windows, each holding a slightly different version of the same task. By
evening you've spent more time pasting the goal back into the next chat
than actually building.

Goodboy is a desktop app that holds the goal, the plan and the context once,
then hands them to whichever agent you want to run next. Same brief, same
memory, different model. Conversation, plans, decisions and PR state stay in
a local SQLite on your machine. Your keys, your data, your bandwidth.

## Why it exists

Switching between `Claude`, `Codex`, `Cursor`, `Gemini`, `OpenCode` and
`OpenRouter` ten times a day was eating my afternoons. Every new tab meant
rebuilding the same mental scratchpad from scratch, then watching the next
model run off in a slightly different direction. Eventually I got fed up and
built this.

Open source. Every feature included. No paywall, no telemetry, no account.

## What's inside

**Shared context, not vendor sessions.** Goal, decisions, last summary, open
questions. A summarizer keeps it fresh after every turn. Edit any field by
hand when the agents get it wrong. The next agent shows up already briefed.

**Provider swap mid-task, without amnesia.** Each turn is rebuilt from the
shared context, never resumed from a vendor's session blob. Drop Claude
halfway, hand the same task to Cursor, Codex, Gemini, OpenCode or OpenRouter,
watch it pick up clean.

**Workflows for the multi-step stuff.** Refactor incoming? Line up a sequence:
a cheap model to scout the area, a smart one to plan it, a mid one to
implement, another to review, a cheap one to open the PR. Each step picks its
own provider and model, so you're never paying Opus prices to run a grep.

**Plans as artifacts, not transcript scrollback.** Agents write the plan
before they touch your code, and it stays put: something you can read, edit
and hand to whichever model implements it. Not a message that scrolls away.

**GitHub Studio.** Every pull request you're involved in, in one inbox,
bucketed by state (draft, in review, approved, merged). Open one and you've
got the body, the lifecycle controls and the unresolved comments in a single
view. Reply yourself, or hand a comment to an agent to resolve.

**Linear Studio.** Every open issue assigned to you, bucketed by Linear
state. Pick one and the goal is already written, the branch is named, the
linked PR is recognized. Hit launch and a session is on it, with the issue
tagged in the rail above. Already shipped a PR for that issue? Pick
"Continue on PR" instead of "Start fresh" and the same branch comes back,
ready for the next round.

**GitLab and Sentry too.** GitLab merge requests and issues get the same
studio treatment as GitHub. A Sentry error turns into a session with the
stack trace already written into the goal and the branch named, ready to
debug.

**Cost meter that taps your shoulder.** Every session shows what it's costing
as it runs. Goodboy nudges you before you burn Opus on a one-liner.

## The board

Home is a board, not a chat window. Open a workspace and every session is in
front of you at once, grouped by where it stands: needs you, running, in
review, building, done. Each card carries the goal, the live cost, the PR
state and the agents on it, one click from the chat, the diff, the terminal or
your editor.

Open a session and an overview leads: what needs you, the workflow activity,
the artifacts and a glance at files, agents, plans and the pull request. Chat,
the diff, the studios and the terminal are lenses you navigate to, not a wall
of scrollback. Click a workflow in the activity and it opens focused with the
rest collapsed, or advance its next step without leaving the overview. The
diff reads like an editor: syntax-highlighted for the common languages, neutral
for the rest. The top bar rolls up what needs you, what's running and today's
spend.

## Providers

Bring the subscription you already pay for. Goodboy drives the official CLIs
locally, on your existing plan. OpenRouter is the one exception: an API-key
provider that runs through the OpenCode runtime, with the key held in your OS
keychain.

| Provider                 | CLI                                                            | Subscription                   |
| ------------------------ | -------------------------------------------------------------- | ------------------------------ |
| **Anthropic (Claude)**   | `npm i -g @anthropic-ai/claude-code`                           | Claude Max / Pro               |
| **Cursor**               | Cursor desktop app                                             | Cursor Pro                     |
| **OpenAI (Codex)**       | `npm i -g @openai/codex`                                       | ChatGPT Pro                    |
| **Google (Antigravity)** | `curl -fsSL https://antigravity.google/cli/install.sh \| bash` | Google AI Pro                  |
| **OpenCode** (beta)      | `npm i -g opencode-ai`                                         | None, zero-key models included |
| **OpenRouter** (beta)    | Runs through the OpenCode runtime, no separate install         | OpenRouter API key             |

One connected CLI is enough to start. Full guide:
[docs/providers.md](./docs/providers.md).

## Install

macOS only for now, Intel and Apple Silicon in one universal build. Signed
and notarized by Apple, so it opens without the unidentified-developer
warning. Linux and Windows builds are in progress.

**Homebrew (recommended).**

```bash
brew install --cask akhayam99/tap/goodboy
```

**Direct download.** Grab the `.dmg` from the
[latest release](https://github.com/akhayam99/goodboy/releases/latest) and
drag Goodboy to Applications.

**Updates are automatic.** When a new release ships, a "Restart to update"
control appears in the status bar and next to the sidebar logo. One click
downloads it and relaunches; Homebrew users can also
`brew upgrade --cask goodboy`.

## Run it

```bash
pnpm install

pnpm tauri:dev      # hot reload, fastest to iterate
pnpm tauri:build    # produces an installable binary in apps/desktop/src-tauri/target/release/bundle/
```

Needs **Node ≥ 20**, **pnpm ≥ 10** and a working **Rust** toolchain (Tauri
shells out to `cargo`). Platform prereqs:
<https://v2.tauri.app/start/prerequisites/>.

Hacking on the app itself? The dev-loop notes live in
[apps/desktop/README.md](./apps/desktop/README.md).

## Help out

Try it. If something breaks, feels weird or is missing, open an issue.
Half-formed thoughts welcome. Screenshots welcome. "This feels off" is a
perfectly valid bug report.

## Stack

**Tauri 2 · React 19 · TypeScript · Tailwind v4 · Zustand · SQLite**, in a
pnpm + Turborepo monorepo: `apps/desktop` plus `packages/{ui,core,db,types}`.

## Star history

<a href="https://www.star-history.com/?repos=akhayam99%2Fgoodboy&type=date&legend=top-left">
  <img src="https://api.star-history.com/svg?repos=akhayam99/goodboy&type=Date" alt="Star history chart" width="640" />
</a>

## More

- [docs/tone-of-voice.md](./docs/tone-of-voice.md): how Goodboy talks
- [VISION.md](./VISION.md): the why, at length
- [DESIGN.md](./DESIGN.md): how it looks and behaves
- [CONVENTIONS.md](./CONVENTIONS.md) · [CLAUDE.md](./CLAUDE.md): contributor rules

## License

[MIT](./LICENSE) © Amin Khayam
