# Goodboy

**Stop re-explaining yourself.**

You have a repo. You have a goal. You also have four CLIs open in four
windows, each holding a slightly different version of the same task. By
evening you've spent more time pasting the goal back into the next chat
than actually building.

Goodboy is a desktop app that holds the goal, the plan and the context once,
then hands them to whichever agent you want to run next. Same brief, same
memory, different model. Conversation, plans, decisions and PR state stay in
a local SQLite on your machine. Your keys, your data, your bandwidth.

<img width="3972" height="2234" alt="CleanShot 2026-06-10 at 10 38 18@2x" src="https://github.com/user-attachments/assets/0d9d8bf4-df65-4b48-97af-ca97f5f56109" />

## Why it exists

Switching between `Claude`, `Codex`, `Cursor` and `Gemini` ten times a day was
eating my afternoons. Every new tab meant rebuilding the same mental
scratchpad from scratch, then watching the next model run off in a slightly
different direction. Eventually I got fed up and built this.

Open source. Every feature included. No paywall, no telemetry, no account.

## What's inside

**Shared context, not vendor sessions.** Goal, decisions, last summary, open
questions. A summarizer keeps it fresh after every turn. Edit any field by
hand when the agents get it wrong. The next agent shows up already briefed.

**Provider swap mid-task, without amnesia.** Each turn is rebuilt from the
shared context, never resumed from a vendor's session blob. Drop Claude
halfway, hand the same task to Cursor, Codex or Gemini, watch it pick up clean.

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

**Cost meter that taps your shoulder.** Every session shows what it's costing
as it runs. Goodboy nudges you before you burn Opus on a one-liner.

## Providers

Bring the subscription you already pay for. Goodboy drives the official CLIs
locally, on your existing plan, never on a metered API key.

| Provider               | CLI                                  | Subscription     |
| ---------------------- | ------------------------------------ | ---------------- |
| **Anthropic (Claude)** | `npm i -g @anthropic-ai/claude-code` | Claude Max / Pro |
| **Cursor**             | Cursor desktop app                   | Cursor Pro       |
| **OpenAI (Codex)**     | `npm i -g @openai/codex`             | ChatGPT Pro      |
| **Google (Gemini)**    | `npm i -g @google/gemini-cli`        | Google AI Pro    |

One connected CLI is enough to start. Full guide:
[docs/providers.md](./docs/providers.md).

## Install

macOS, Intel and Apple Silicon, one universal build. Signed and notarized
by Apple, so it opens with no security prompts.

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

## More

- [docs/tone-of-voice.md](./docs/tone-of-voice.md): how Goodboy talks
- [VISION.md](./VISION.md): the why, at length
- [DESIGN.md](./DESIGN.md): how it looks and behaves
- [CONVENTIONS.md](./CONVENTIONS.md) · [CLAUDE.md](./CLAUDE.md): contributor rules

## License

[MIT](./LICENSE) © Amin Khayam
