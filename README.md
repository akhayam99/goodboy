<div align="center">

# Goodboy

**Stop re-explaining yourself.**

[![ci](https://img.shields.io/github/actions/workflow/status/akhayam99/goodboy/ci.yml?branch=main&label=ci)](https://github.com/akhayam99/goodboy/actions/workflows/ci.yml)
[![release](https://img.shields.io/github/v/release/akhayam99/goodboy?label=release)](https://github.com/akhayam99/goodboy/releases/latest)
[![stars](https://img.shields.io/github/stars/akhayam99/goodboy?label=stars)](https://github.com/akhayam99/goodboy/stargazers)
[![macOS](https://img.shields.io/badge/macOS-Intel%20%26%20Apple%20Silicon-lightgrey)](#install)
[![Linux](https://img.shields.io/badge/Linux-AppImage%20%C2%B7%20deb%20%C2%B7%20rpm-lightgrey)](#install)
[![license](https://img.shields.io/github/license/akhayam99/goodboy)](./LICENSE)

[Install](#install) · [Providers](#providers) · [Concepts](./docs/concepts.md) · [Design](./DESIGN.md) · [goodboy-ai.dev](https://goodboy-ai.dev)

</div>

> **Read this when** you are new here, human or agent, and want the pitch, the
> install steps and what ships today. **Not for** working conventions once you
> are building. Go to [AGENTS.md](./AGENTS.md).

You have a repo, a goal, and four CLIs open in four windows, each holding a
slightly different version of the same task. By evening you have spent more
time pasting the goal into the next chat than building.

Goodboy is a desktop app for macOS and Linux that holds the goal, the plan and
the decisions once, then hands them to whichever agent you run next. Every turn
is rebuilt from that shared record instead of resumed from a vendor's session
blob, so you can stop Claude halfway, give the same task to Codex, and repeat
nothing.

Open source, every feature included, no account. One connected CLI is enough to
start.

## What it does today

**Home is a board, not a chat window.** Every session in the workspace sits in
one of six columns: building, running, needs you, in review, done, archived. A
card carries the goal, a status line, when it last moved, and how many agents
are on it. From the card you open the session in your editor or in a terminal.

**Every session gets its own git worktree and branch.** Your main checkout is
never the thing an agent edits, so several sessions run at once without
fighting over the same files.

**Context is a record, not scrollback.** The goal, the decisions, the open
questions, the plans and the running summary are rows in a SQLite file on your
disk. The next agent is briefed by that file rather than by you.

**Seven agent CLIs, one brief.** A turn is assembled from that stored record
every time, so a task is not tied to whichever provider started it. A workflow
chains steps, and each step carries its own provider, model and effort, so a
scouting step does not run at planning prices.

**What today costs is in the header.** Goodboy meters usage locally and shows
the running total for the day next to the count of sessions waiting on you.

## Providers

Bring the subscription you already pay for. Goodboy drives the official CLIs on
your machine, on your existing plan. Three of the seven run through the
OpenCode runtime, and the two that need an API key keep it in your OS
credential store.

| Provider   | Install the CLI                                                | Runs on                                              |
| ---------- | -------------------------------------------------------------- | ---------------------------------------------------- |
| Claude     | `npm install -g @anthropic-ai/claude-code`                     | Claude Max or Pro                                    |
| Cursor     | `curl https://cursor.com/install -fsS \| bash`                 | Cursor Pro                                           |
| Codex      | `npm install -g @openai/codex`                                 | A ChatGPT plan, or `OPENAI_API_KEY`                  |
| Gemini     | `curl -fsSL https://antigravity.google/cli/install.sh \| bash` | Google AI Pro, or `GEMINI_API_KEY`. The CLI is `agy` |
| OpenCode   | `npm install -g opencode-ai`                                   | Nothing, zero-key models included                    |
| OpenRouter | `npm install -g opencode-ai`                                   | An OpenRouter API key                                |
| Moonshot   | `npm install -g opencode-ai`                                   | A Moonshot API key                                   |

Those commands are the ones the app runs for you when you connect a provider.
Login, logout and the per-provider caveats: [docs/providers.md](./docs/providers.md).

## Your work

GitHub is the code host Goodboy expects, and six services connect on top of it:
Linear, Sentry, GitLab, Jira, Bitbucket and Slack. Pull requests from GitHub
and merge requests from GitLab collect in one review list, and Bitbucket brings
its own pull request view. An issue from a tracker becomes a session with the
goal and the branch name already filled in, and a Slack thread starts one the
same way.

Every connection is optional, and each holds its personal API key in your OS
credential store. Each one covers a slice of its service rather than the whole API, and
the release notes say which slice when it lands.

## Install

**macOS.** Intel and Apple Silicon in one universal build, signed and
notarized, so it opens without the unidentified-developer warning.

```bash
brew install --cask akhayam99/tap/goodboy
```

Or drag the `.dmg` from the
[latest release](https://github.com/akhayam99/goodboy/releases/latest) to
Applications.

**Linux.** x86_64 as an AppImage, a `.deb` or an `.rpm` on the same
[release](https://github.com/akhayam99/goodboy/releases/latest). The packages
declare `libc6 (>= 2.39)` and the GTK stack they link against, so apt and rpm
resolve the rest. That floor means Ubuntu 24.04 and Debian 13 upward.

```bash
sudo apt install ./Goodboy_<version>_amd64.deb
sudo rpm -i Goodboy-<version>-1.x86_64.rpm
chmod +x Goodboy_<version>_amd64.AppImage
```

Credentials go to the freedesktop Secret Service, GNOME Keyring or KWallet, so
a keyring daemon has to be running before you save a personal API key.

**Windows** is a build from source for now. Security posture and the credential
caveat: [SECURITY.md](./SECURITY.md).

**Updates.** On macOS an update control appears when a new release ships, and
one click downloads and relaunches. Homebrew handles it too, with
`brew upgrade --cask goodboy`. On Linux, take the new package from the release.

## Run it

```bash
pnpm install
pnpm tauri:dev
```

Needs **Node 20 or newer**, **pnpm 10** and a working **Rust** toolchain, and
CI builds on Node 22. Platform prereqs:
<https://v2.tauri.app/start/prerequisites/>. Dev-loop notes:
[apps/desktop/README.md](./apps/desktop/README.md).

**Tauri 2 · React 19 · TypeScript · Tailwind v4 · Zustand · SQLite**, in a
pnpm + Turborepo monorepo: `apps/desktop` plus `packages/{ui,core,db,types}`.

## What stays on your machine

Goodboy is an orchestration layer. There is no backend, there are no accounts,
and what you write reaches only the services you connected yourself. A few
things sit outside that sentence and are listed below with the rest: a local
diagnostics file, the check for a new version, and a crash report you choose to
send. `SECURITY.md` carries the full list.

- **The app carries no telemetry.** No usage pings, no opt-in switch to find
  later, nothing sent in the background. When a crash takes the screen down,
  Goodboy can fill in a GitHub issue with the error, and only your click opens
  it.
- **The website is not the app.** `goodboy-ai.dev` runs Google Tag Manager and
  Vercel's analytics and speed tools to see how the page itself is doing.
  Reading about Goodboy is measured. Running it is not.
- API keys stay on your machine, in your OS credential store.
- Prompts and responses travel between you and the provider you picked, and
  nowhere else.
- What you send to a connected service reaches that service. A comment posted
  to GitHub is a comment on GitHub, and its API key travels with the request.
  Local storage does not mean nothing leaves.
- Local persistence is one SQLite file, `~/.goodboy/data.db`: workspaces,
  sessions, agents, messages, context, plans, local usage records, skills,
  settings. Cleared when you ask, and not before.
- **Every launch appends a few lines to `~/.goodboy/boot-breadcrumbs.log`.** A
  timestamp, a launch id, the boot phase and how long that phase took. The
  phase and the detail are matched against a fixed set of allowed values before
  the line is written, so no path, argument or credential can reach it, and the
  file never leaves your machine. [SECURITY.md](./SECURITY.md) has the
  allowlist, the file mode and the rotation.
- **A release build asks GitHub whether a newer version exists.** It requests
  the update manifest published with the releases: once as a window opens, then
  again when that window regains focus or becomes visible, and once an hour
  while it stays visible. Only those later checks are spaced half an hour apart,
  the one at open is not, so launching and clicking into the app sends two
  requests. That is the only network request Goodboy makes on its own with
  nothing connected at all. It carries no data about you, and an update it finds
  is verified against the signing key shipped in the app before anything is
  installed.
- **Reporting a crash opens a prefilled GitHub issue in your browser.** When the
  app stops rendering it offers a Report button, and nothing leaves until you
  press it. The link carries the app version, the error message, and at most
  1,500 characters of the part that says where in the app it broke, with home
  folders shortened to `~` while project and file paths stay as they are. GitHub
  receives that text as the prefilled page loads, not when you submit it, and
  the whole link is capped at 4,096 bytes so a long report is trimmed further to
  fit. Submitting the form is what turns it into a public issue. Close the tab
  and nothing is filed.

If Goodboy disappeared tomorrow, your data would be untouched, because it was
never ours.

## How it ships

Goodboy ships Goodboy. Releases are decided, built, verified and drafted by an
autonomous loop of agents, with a human reviewing after rather than before.
Every pull request is checked by a different agent than the one that wrote it,
and anything not yet exercised against a live service is named in the release
notes. The loop answers to a written floor it cannot edit on its own authority:
it never touches signing material or secrets, never force-pushes, never
publishes without a human, and stops rather than guess.

## Help out

Try it. If something breaks, feels off or is missing, open an issue: the bug
control in the top right, Settings, "Report an issue" in the command palette,
or straight on GitHub. The in-app form sends the app version, a type, an area,
a title, your notes, and any images you attach. Nothing else. Half-formed
thoughts welcome, and "this feels wrong" is a valid bug report. Issues are
triaged every release cycle, so you get an answer even when it is "not yet". A
request for something the project refuses on principle, tracking above all,
gets a written no rather than silence.

## Contributors

<a href="https://github.com/akhayam99"><img src="https://avatars.githubusercontent.com/u/87425758?s=120" width="56" height="56" alt="Amin Khayam" style="border-radius:50%" /></a>
<a href="https://github.com/teckperry"><img src="https://avatars.githubusercontent.com/u/85160151?s=120" width="56" height="56" alt="Luca Laudiero" style="border-radius:50%" /></a>

## More

- [docs/concepts.md](./docs/concepts.md): what every object in the app is
- [docs/providers.md](./docs/providers.md): connecting and disconnecting a CLI
- [docs/tone-of-voice.md](./docs/tone-of-voice.md): how Goodboy talks
- [DESIGN.md](./DESIGN.md): how it looks and behaves
- [CONVENTIONS.md](./CONVENTIONS.md) · [AGENTS.md](./AGENTS.md): contributor rules
- Roadmap and the delivery organization live in `goodboy-atlas`, a private
  repository. The app never depends on it, and contributing never requires it.

## License

[MIT](./LICENSE) © Amin Khayam
